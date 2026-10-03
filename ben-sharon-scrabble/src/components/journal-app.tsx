'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BarChart3, BookOpen, Check, ChevronRight, Download, Ellipsis, Heart, House, Plus, ShieldCheck, X } from 'lucide-react';
import { DEFAULT_PLAYERS, Game, gamePhotos, Journal, Player, winner } from '@/lib/model';
import { prepareVictoryFanfare } from '@/lib/victory-fanfare';
import { localRepository, SaveOptions, STORAGE_KEY } from '@/lib/storage';
import { CloudRepository, SyncState } from '@/lib/cloud-repository';
import { useJournalConnection } from './cloud-provider';
import { mergeJournal, validateJournal } from '@/lib/validation';
import type { RatingResult } from '@/lib/ratings-service';
import { HomeView } from './home-view';
import { HistoryView } from './history-view';
import { StatisticsView } from './statistics-view';
import { AnniversaryTimer } from './anniversary-timer';
import { MoreView } from './more-view';
import { GameEntry } from './game-entry';
import { GameDetail } from './game-detail';
import { Modal, Tile } from './ui';
type Tab = 'home' | 'history' | 'stats' | 'more';
type DialogState = { kind: 'record'; game?: Game } | { kind: 'confirm'; title: string; message: string; action: () => Promise<void>; label: string } | { kind: 'import'; incoming: Journal } | null;
const tabs = [{ id: 'home', href: '/', label: 'Home', icon: House }, { id: 'history', href: '/history', label: 'History', icon: BookOpen }, { id: 'stats', href: '/stats', label: 'Stats', icon: BarChart3 }, { id: 'more', href: '/more', label: 'More', icon: Ellipsis }] as const;
const headings = { home: ['A little friendly rivalry.', 'Every word. Every win. Every game together.'], history: ['A history worth keeping.', 'The close calls, the big wins, and everything in between.'], stats: ['Your rivalry, by the numbers.', 'A little perspective on all those good games.'], more: ['Made for the two of you.', 'Your profiles, your ratings, your memories.'] };
function download(value: string, filename: string) {
  const url = URL.createObjectURL(new Blob([value], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function JournalApp({ initialTab, initialGameId }: { initialTab: Tab; initialGameId?: string }) {
  const router = useRouter();
  const connection = useJournalConnection();
  const { repository, cloud } = connection;
  const [syncState, setSyncState] = useState<SyncState>('connecting');
  const [syncError, setSyncError] = useState('');
  const [localBackup, setLocalBackup] = useState<Journal | null>(null);
  const [reload, setReload] = useState(0);
  const [offlineGameId, setOfflineGameId] = useState<string | undefined>();
  const [journal, setJournal] = useState<Journal | null>(null);
  const [loadError, setLoadError] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState('');
  const [ratingsBusy, setRatingsBusy] = useState(false);
  const [ratingsMessage, setRatingsMessage] = useState('');
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [replaceArmed, setReplaceArmed] = useState(false);
  useEffect(() => {
    let live = true;
    const adopt = (data: Journal) => {
      if (!live) return;
      setLoadError(''); setSyncError('');
      setJournal(current => repository instanceof CloudRepository && current && repository.revision(current) > repository.revision(data) ? current : data);
      const path = window.location.pathname.match(/^\/games\/([^/]+)$/);
      if (!initialGameId && path) setOfflineGameId(decodeURIComponent(path[1]));
    };
    repository.load().then(adopt).catch(err => { if (live) setLoadError(err instanceof Error ? err.message : 'Could not open your journal.'); });
    if (cloud) {
      Promise.resolve().then(() => { if (!live) return; try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) setLocalBackup(validateJournal(JSON.parse(raw))); } catch { setSyncError('Your old local data could not be read. Keep its original backup; it has not been changed.'); } });
    }
    const unsubscribe = repository instanceof CloudRepository ? repository.subscribe(adopt, state => { if (live) setSyncState(state); }, message => { if (live) setSyncError(message); }) : () => {};
    const changed = (event: StorageEvent) => { if (!cloud && event.key === STORAGE_KEY) { repository.load().then(data => { adopt(data); if (live) setToast('Journal updated from another tab.'); }).catch(() => { if (live) setLoadError('Saved data changed in another tab and could not be read. Your data has not been overwritten.'); }); } };
    window.addEventListener('storage', changed);
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) { void navigator.serviceWorker.register('/sw.js').catch(() => { /* Online use remains available when offline caching is unsupported. */ }); }
    return () => { live = false; unsubscribe(); window.removeEventListener('storage', changed); };
  }, [initialGameId, repository, cloud, reload]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 6500); return () => clearTimeout(timer); }, [toast]);
  async function persist(next: Journal, options?: SaveOptions, expected = journal) {
    const saved = await repository.save(next, expected ?? undefined, options);
    setJournal(current => repository instanceof CloudRepository && current && saved && repository.revision(current) > repository.revision(saved) ? current : saved ?? next);
  }
  async function saveGame(game: Game) {
    if (!journal) return;
    const exists = journal.games.some(g => g.id === game.id);
    const original = dialog?.kind === 'record' ? dialog.game : undefined;
    const expected = original ? { ...journal, games: journal.games.some(g => g.id === original.id) ? journal.games.map(g => g.id === original.id ? original : g) : [...journal.games, original] } : journal;
    const fanfare = !exists && !original && !game.isSample && winner(game) === 'sharon' ? prepareVictoryFanfare() : undefined;
    try {
      await persist({ ...journal, games: exists ? journal.games.map(g => g.id === game.id ? game : g) : [...journal.games, game] }, undefined, expected);
    } catch (error) {
      fanfare?.dispose();
      throw error;
    }
    fanfare?.play();
    setDialog(null); setToast(exists ? 'Game updated. The story continues.' : 'Game saved. Here’s to one more.');
  }
  async function savePlayer(player: Player, original?: Player) { if (!journal) return; const expected = original ? { ...journal, players: journal.players.map(p => p.id === original.id ? original : p) } : journal; await persist({ ...journal, players: journal.players.map(p => p.id === player.id ? player : p) }, undefined, expected); setToast(`${player.name}’s ratings saved.`); }
  async function refreshRatings() {
    if (!journal || ratingsBusy) return;
    setRatingsBusy(true); setRatingsMessage('');
    try {
      const response = await fetch('/api/ratings');
      if (!response.ok) throw new Error('Ratings service is unavailable. Your previous ratings are unchanged.');
      const data: { ratings: RatingResult[] } = await response.json();
      const good = data.ratings.filter(r => !r.error);
      if (good.length) await persist({ ...journal, players: journal.players.map(p => { const r = good.find(r => r.id === p.id); return r ? { ...p, naspaRating: r.naspaRating ?? p.naspaRating, wgpoRating: r.wgpoRating ?? p.wgpoRating, ratingsLastUpdated: r.checkedAt, ratingSource: 'cross-tables' } : p; }) });
      const failed = data.ratings.filter(r => r.error);
      setRatingsMessage(failed.length ? failed.map(r => `${r.id === 'ben' ? 'Ben' : 'Sharon'}: ${r.error}`).join(' ') : 'Ratings checked and saved. Successful lookups are cached for 24 hours.');
    } catch (e) { setRatingsMessage(e instanceof Error ? e.message : 'Could not refresh ratings. Saved ratings are unchanged.'); } finally { setRatingsBusy(false); }
  }
  async function exportData() {
    if (!journal) return;
    try {
      const portable = repository.export ? await repository.export(journal) : journal;
      download(JSON.stringify({ ...portable, exportedAt: new Date().toISOString(), app: 'One More Game' }, null, 2), `one-more-game-${new Date().toISOString().slice(0, 10)}.json`);
      setToast('Backup downloaded. Keep it somewhere safe.');
    } catch (error) { setToast(error instanceof Error ? error.message : 'Could not export a complete backup. Please retry.'); }
  }
  async function importData(file: File) {
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('This backup is larger than 25 MB. Please choose a smaller file.');
      const incoming = validateJournal(JSON.parse(await file.text()));
      setDialogError(''); setReplaceArmed(false); setDialog({ kind: 'import', incoming });
    } catch (e) { setToast(e instanceof SyntaxError ? 'This file is not valid JSON. Nothing has changed.' : e instanceof Error ? e.message : 'Could not read this backup. Nothing has changed.'); }
  }
  const activeGameId = initialGameId ?? offlineGameId;
  const selected = journal?.games.find(g => g.id === activeGameId);
  const closeDetails = () => { setOfflineGameId(undefined); router.push('/history'); };
  const openGame = (g: Game) => router.push(`/games/${encodeURIComponent(g.id)}`);
  const showConfirm = (value: Extract<DialogState, { kind: 'confirm' }>) => { setDialogError(''); setDialog(value); };
  const recordGame = () => { if (journal && !loadError) { setDialogError(''); setDialog({ kind: 'record' }); } };
  async function runAction(action: () => Promise<void>) { setConfirmBusy(true); setDialogError(''); try { await action(); setDialog(null); } catch (e) { setDialogError(e instanceof Error ? e.message : 'Could not save changes.'); } finally { setConfirmBusy(false); } }
  return <div className="app-shell"><a href="#main" className="skip-link">Skip to content</a>
    <aside className="sidebar"><Link href="/" className="brand" aria-label="One More Game home"><div className="brand-tiles"><Tile letter="S" /><Tile letter="B" points={3} /></div><div className="brand-name">one more<br /><strong>game.</strong></div></Link><span className="sidebar-kicker">BEN & SHARON’S JOURNAL</span><nav aria-label="Primary navigation" className="desktop-nav">{tabs.map(t => <Link key={t.id} href={t.href} className={initialTab === t.id ? 'active' : ''} aria-current={initialTab === t.id ? 'page' : undefined}><t.icon size={20} strokeWidth={1.7} />{t.label}{initialTab === t.id && <span className="nav-dot" />}</Link>)}</nav><button className="button primary sidebar-record" onClick={recordGame} disabled={!journal || !!loadError}><Plus size={18} />Record game</button><div className="sidebar-bottom"><div className="sidebar-quote"><Heart size={17} /><p>Good words.<br />Great company.</p><span>Made for two.</span></div><div className="local-label"><span className="status-dot" />{cloud ? syncState === 'live' ? 'SHARED JOURNAL · LIVE' : syncState === 'offline' ? 'SHARED JOURNAL · OFFLINE' : 'SHARED · RECONNECTING' : 'SAVED ON THIS DEVICE'}</div></div></aside>
    <div className="main-wrapper"><header className="topbar"><Link className="mobile-brand" href="/"><Tile letter="S" small /><Tile letter="B" small points={3} /><span>one more game.</span></Link><span className="topbar-label">A JOURNAL OF FRIENDLY COMPETITION</span><div className="topbar-right"><span className="private-label"><ShieldCheck size={14} />Your personal journal</span><span className="avatar ben">B</span><span className="avatar sharon">S</span></div></header>
      <main id="main">{initialTab !== 'home' && <div className="page-header"><div><div className="eyebrow page-eyebrow">{initialTab === 'history' ? 'YOUR GAME JOURNAL' : initialTab === 'stats' ? 'A HEALTHY DOSE OF COMPETITION' : 'THE LITTLE DETAILS'}</div><h1>{headings[initialTab][0]}</h1><p>{headings[initialTab][1]}</p></div><button className="button primary header-record" onClick={recordGame} disabled={!journal || !!loadError}><Plus size={19} />Record game</button></div>}
      {cloud && (syncError || syncState === 'offline') && <div className="sync-notice" role="status">{syncState === 'offline' ? 'You’re offline. Reconnect to save changes and see updates from the other phone.' : syncError}</div>}
      {loadError && cloud ? <section className="card recovery-card"><h2>Let’s reconnect your journal.</h2><p role="alert">{loadError}</p><p>Your shared games and original local data have not been changed.</p><button className="button secondary" onClick={() => setReload(reload + 1)}>Try again</button></section> : loadError ? <section className="card recovery-card"><h2>Your saved journal needs attention.</h2><p role="alert">{loadError}</p><p>Your browser’s saved data has not been overwritten. Download it before resetting, or use another browser if storage is disabled.</p><button className="button secondary" onClick={() => { const raw = localStorage.getItem(STORAGE_KEY); if (raw) download(raw, 'one-more-game-recovery.json'); }}><Download size={17} />Download saved data</button><button className="button danger-quiet" onClick={() => showConfirm({ kind: 'confirm', title: 'Reset this browser’s journal?', message: 'This permanently replaces the saved journal on this browser with an empty one. Download the recovery file first. No other devices are affected.', label: 'Reset local journal', action: async () => { const empty: Journal = { version: 1, games: [], players: structuredClone(DEFAULT_PLAYERS) }; await localRepository.save(empty); setJournal(empty); setLoadError(''); } })}>Reset local journal</button></section> : !journal ? <div className="loading-state"><div className="loading-tile"><Tile letter="B" /></div><p>Opening your journal…</p></div> : <>
        {journal.games.some(g => g.isSample) && <div className="sample-banner"><span><SparkleDot />You’re exploring with sample games. Your real story is still to come.</span><Link href="/more">Manage sample data <ChevronRight size={14} /></Link></div>}
        {initialTab === 'home' && <HomeView journal={journal} onRecord={recordGame} onOpen={openGame} />}
        {initialTab === 'history' && <HistoryView games={journal.games} onOpen={openGame} />}
        {initialTab === 'stats' && <StatisticsView games={journal.games} onOpen={openGame} />}
        {initialTab === 'more' && <MoreView journal={journal} cloud={cloud} syncState={syncState} accountName={connection.playerId === 'sharon' ? 'Sharon' : 'Ben'} onSignOut={connection.signOut ? async () => { try { await connection.signOut!(); } catch (error) { setToast(error instanceof Error ? error.message : 'Could not sign out.'); } } : undefined} localGameCount={localBackup?.games.filter(g => !g.isSample).length ?? 0} onImportLocal={localBackup ? () => { setDialogError(''); setReplaceArmed(false); setDialog({ kind: 'import', incoming: { ...localBackup, games: localBackup.games.filter(g => !g.isSample) } }); } : undefined} onSavePlayer={savePlayer} onExport={exportData} onImport={importData} onRatings={() => void refreshRatings()} ratingsBusy={ratingsBusy} ratingsMessage={ratingsMessage} onRemoveSamples={() => showConfirm({ kind: 'confirm', title: 'Make room for your own story?', message: `Delete all ${journal.games.filter(g => g.isSample).length} sample games? Your real games and player profiles will stay.`, label: 'Delete sample data', action: async () => { await persist({ ...journal, games: journal.games.filter(g => !g.isSample) }); setToast('Sample games removed. Ready for your first real game.'); } })} />}
        <footer className="app-footer"><span>BEN & SHARON <Heart size={11} /> ONE MORE GAME</span><AnniversaryTimer /></footer>
      </>}</main></div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{tabs.map(t => <Link key={t.id} href={t.href} className={initialTab === t.id ? 'active' : ''} aria-current={initialTab === t.id ? 'page' : undefined}><t.icon size={21} strokeWidth={1.8} /><span>{t.label}</span></Link>)}<button className="mobile-record" onClick={recordGame} aria-label="Record game" disabled={!journal || !!loadError}><Plus size={23} /></button></nav>
    {toast && <div className="toast" role="status"><Check size={17} /><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={16} /></button></div>}
    {dialog?.kind === 'record' && journal && <Modal title={dialog.game ? 'A little revision.' : 'Another game for the books.'} onClose={() => setDialog(null)}><GameEntry cloud={cloud} game={dialog.game} games={journal.games} onSave={saveGame} /></Modal>}
    {dialog?.kind === 'confirm' && <Modal title={dialog.title} onClose={() => { if (!confirmBusy) setDialog(null); }}><p className="confirm-copy">{dialog.message}</p>{dialogError && <p className="error-message" role="alert">{dialogError}</p>}<div className="confirm-actions"><button className="button secondary" disabled={confirmBusy} onClick={() => setDialog(null)}>Cancel</button><button className="button danger" disabled={confirmBusy} onClick={() => void runAction(dialog.action)}>{confirmBusy ? 'Saving…' : dialog.label}</button></div></Modal>}
    {dialog?.kind === 'import' && journal && <Modal title="A backup, ready to come home." onClose={() => { if (!confirmBusy) setDialog(null); }}><div className="import-summary"><Check size={21} /><div><strong>Backup validated</strong><span>{dialog.incoming.games.length} games · {dialog.incoming.games.reduce((count,g) => count + gamePhotos(g).length, 0)} photos · 2 player profiles</span></div></div><p className="confirm-copy">Choose how to restore it. Merging adds new game IDs and keeps existing games and profiles exactly as they are.</p><p className="import-counts">{mergeJournal(journal, dialog.incoming).added} new games · {mergeJournal(journal, dialog.incoming).skipped} existing IDs will be skipped</p>{dialogError && <p className="error-message" role="alert">{dialogError}</p>}<button className="button primary full-width" disabled={confirmBusy} onClick={() => void runAction(async () => { const merged = mergeJournal(journal, dialog.incoming); await persist(merged.journal); setToast(`Backup merged. ${merged.added} games added; ${merged.skipped} existing games kept.`); })}><Plus size={17} />Merge new games</button><div className="replace-option">{!replaceArmed ? <button className="text-button" onClick={() => setReplaceArmed(true)}>Replace the entire journal instead</button> : <><p className="error-message">This replaces all {journal.games.length} current games and both profiles with the backup. Export your current journal first if you want to keep it.</p><button className="button secondary" onClick={exportData}><Download size={16} />Export current journal</button><button className="button danger" disabled={confirmBusy} onClick={() => void runAction(async () => { await persist(dialog.incoming, { replaceAll: true }); setToast('Journal restored from your backup.'); })}>Confirm replace journal</button></>}</div></Modal>}
    {activeGameId && journal && !dialog && <Modal title={selected ? 'A game to remember.' : 'Game not found'} onClose={closeDetails}>{selected ? <GameDetail game={selected} onEdit={() => setDialog({ kind: 'record', game: selected })} onDelete={() => showConfirm({ kind: 'confirm', title: 'Delete this game?', message: `${cloud ? 'This game will be deleted from the shared journal on both phones.' : 'This game and its photo will be removed from this browser.'} This cannot be undone without a backup.`, label: 'Delete game', action: async () => { await persist({ ...journal, games: journal.games.filter(g => g.id !== selected.id) }); setToast('Game deleted.'); router.push('/history'); } })} /> : <><p className="confirm-copy">{cloud ? 'This game is not in your shared journal. It may have been deleted on the other phone.' : 'This game is not in this browser’s journal. Games are stored per device in local mode.'}</p><button className="button secondary" onClick={closeDetails}>Back to history <ArrowRight size={16} /></button></>}</Modal>}
  </div>;
}
function SparkleDot() { return <span className="sample-dot" aria-hidden="true">✦</span>; }
