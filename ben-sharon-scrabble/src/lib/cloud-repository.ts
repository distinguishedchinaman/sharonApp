import { SupabaseClient } from '@supabase/supabase-js';
import { Game, Journal, Player } from './model';
import { journalChanges, storedGame, StoredGame } from './journal-changes';
import { JournalRepository, SaveOptions } from './storage';
import { validateJournal } from './validation';
export type SyncState = 'connecting' | 'live' | 'reconnecting' | 'offline';
interface Snapshot { revision: number; games: StoredGame[]; players: Player[] }
const BUCKET = 'game-photos';
const PHOTO_TTL = 3600;
export class CloudRepository implements JournalRepository {
  private revisions = new WeakMap<Journal, number>();
  constructor(readonly client: SupabaseClient, readonly householdId: string) {}
  private async hydrate(snapshot: Snapshot): Promise<Journal> {
    const paths = snapshot.games.flatMap(g => g.photoPath ? [g.photoPath] : []);
    const urls = new Map<string, string>();
    if (paths.length) {
      const { data, error } = await this.client.storage.from(BUCKET).createSignedUrls(paths, PHOTO_TTL);
      if (error) throw new Error('Games are safe, but their private photos could not be loaded. Check your connection and retry.');
      for (const entry of data ?? []) if (entry.path && entry.signedUrl && !entry.error) urls.set(entry.path, entry.signedUrl);
      if (paths.some(path => !urls.has(path))) throw new Error('A saved photo could not be loaded. Your cloud data has not been changed.');
    }
    const journal = validateJournal({ version: 1, games: snapshot.games.map(g => ({ ...g, photoPath: g.photoPath ?? undefined, photoUrl: g.photoPath ? urls.get(g.photoPath) ?? null : null })), players: snapshot.players }, true);
    this.revisions.set(journal, snapshot.revision);
    return journal;
  }
  revision(journal: Journal): number { return this.revisions.get(journal) ?? -1; }
  async load(): Promise<Journal> {
    const { data, error } = await this.client.rpc('get_journal', { target_household: this.householdId });
    if (error) throw new Error(error.code === '42501' ? 'Sign in with an invited email to open the shared journal.' : 'Could not load the shared journal. Check your connection and retry.');
    return this.hydrate(data as Snapshot);
  }
  async save(next: Journal, expected?: Journal, options?: SaveOptions): Promise<Journal> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('You’re offline. Reconnect before saving; this change has not been sent to the shared journal.');
    if (!expected) throw new Error('Load the latest shared journal before saving.');
    validateJournal(next, true);
    const prepared: Journal = { ...next, games: [] };
    const uploaded: string[] = [];
    let posted = false;
    try {
      for (const game of next.games) {
        const old = expected.games.find(g => g.id === game.id);
        if (game.photoUrl?.startsWith('data:') && !(game.photoPath && game.photoPath === old?.photoPath && game.photoUrl === old.photoUrl)) {
          const blob = await (await fetch(game.photoUrl)).blob();
          const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
          const path = `${this.householdId}/${game.id}/${crypto.randomUUID()}.${extension}`;
          const { error } = await this.client.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
          if (error) throw new Error('The photo could not be uploaded. The game has not been saved. Check your connection and try again.');
          uploaded.push(path);
          prepared.games.push({ ...game, photoPath: path, photoUrl: null });
        } else prepared.games.push(game);
      }
      const changes = journalChanges(expected, prepared);
      const revision = this.revisions.get(expected);
      if (options?.replaceAll && revision === undefined) throw new Error('Reload the shared journal before replacing it.');
      posted = true;
      const { data, error } = await this.client.rpc('apply_journal_changes', { target_household: this.householdId, game_changes: changes.games, player_changes: changes.players, expected_revision: options?.replaceAll ? revision : null });
      if (error) {
        if (error.code === '40001') throw new Error(error.message);
        throw new Error('The shared save could not be confirmed. Your draft is still here. Reload the journal to check whether it reached the cloud before trying again.');
      }
      // Reuse already displayed/prepared images immediately after the committed save.
      // The next live refresh obtains new signed URLs; a temporary signing failure
      // must not report an already committed game as an unsaved draft.
      const snapshot = data as Snapshot;
      try { return await this.hydrate(snapshot); } catch { /* The committed data remains safe; a live refresh will retry photo signing. */ }
      const known = new Map(next.games.map(g => [g.id, g.photoUrl]));
      const saved = validateJournal({ version: 1, games: snapshot.games.map(g => ({ ...g, photoPath: g.photoPath ?? undefined, photoUrl: g.photoPath ? known.get(g.id) ?? null : null })), players: snapshot.players }, true);
      this.revisions.set(saved, snapshot.revision);
      return saved;
    } catch (error) {
      // Once a request is sent, a timeout can have an unknown commit outcome.
      // Keep its uploads; deleting them could destroy a successfully saved photo.
      if (!posted && uploaded.length) await this.client.storage.from(BUCKET).remove(uploaded);
      throw error;
    }
  }
  async export(journal: Journal): Promise<Journal> {
    const games: Game[] = [];
    for (const game of journal.games) {
      const { photoPath, ...portable } = game;
      if (photoPath) {
        const { data, error } = await this.client.storage.from(BUCKET).download(photoPath);
        if (error || !data) throw new Error('A photo could not be downloaded. No incomplete backup was exported; retry when connected.');
        portable.photoUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not prepare a photo for backup.')); reader.readAsDataURL(data); });
      }
      games.push(portable);
    }
    return validateJournal({ ...journal, games });
  }
  subscribe(onChange: (journal: Journal) => void, onState: (state: SyncState) => void, onError: (message: string) => void): () => void {
    let closed = false, loading = false, again = false, channelLive = false;
    const refresh = async () => {
      if (closed) return;
      if (loading) { again = true; return; }
      loading = true;
      try { const journal = await this.load(); if (!closed) { onChange(journal); onState(channelLive ? 'live' : 'reconnecting'); } }
      catch (error) { if (!closed) { onState(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'reconnecting'); onError(error instanceof Error ? error.message : 'Could not refresh the shared journal.'); } }
      finally { loading = false; if (again && !closed) { again = false; void refresh(); } }
    };
    const channel = this.client.channel(`journal-${this.householdId}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${this.householdId}` }, () => { void refresh(); })
      .subscribe(status => {
        if (closed) return;
        if (status === 'SUBSCRIBED') { channelLive = true; onState('live'); void refresh(); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { channelLive = false; onState('reconnecting'); onError('Live updates are reconnecting. Your saved games are safe.'); }
      });
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const online = () => { onState('connecting'); void refresh(); };
    const offline = () => onState('offline');
    // Covers mobile sleep/reconnect and refreshes expiring private photo URLs.
    const timer = setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) void refresh(); }, 30_000);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('online', online); window.addEventListener('offline', offline); window.addEventListener('focus', online);
    return () => { closed = true; clearInterval(timer); document.removeEventListener('visibilitychange', visible); window.removeEventListener('online', online); window.removeEventListener('offline', offline); window.removeEventListener('focus', online); void this.client.removeChannel(channel); };
  }
}
// A display-only URL is never trusted as a database or backup photo reference.
export { storedGame };
