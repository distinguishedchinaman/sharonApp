import { DEFAULT_PLAYERS, PlayerId } from './model';
import { parseRatings, ParsedRatings } from './ratings-parser';
export interface RatingResult extends ParsedRatings { id: PlayerId; checkedAt: string; error: string | null; cached: boolean }
interface Entry { result: RatingResult; expiresAt: number }
const cache = new Map<PlayerId, Entry>();
const pending = new Map<PlayerId, Promise<RatingResult>>();
async function retrieve(id: PlayerId): Promise<RatingResult> {
  const existing = cache.get(id);
  if (existing && existing.expiresAt > Date.now()) return { ...existing.result, cached: true };
  const inFlight = pending.get(id);
  if (inFlight) return inFlight;
  const request = (async () => {
    let result: RatingResult;
    try {
      const player = DEFAULT_PLAYERS.find(p => p.id === id)!;
      const response = await fetch(player.crossTablesUrl, { headers: { 'User-Agent': 'OneMoreGame/1.0 (personal ratings journal)', Accept: 'text/html' }, signal: AbortSignal.timeout(12_000), redirect: 'error', cache: 'no-store' });
      if (!response.ok) throw new Error(`Cross-Tables returned HTTP ${response.status}. Saved ratings have been kept.`);
      const html = await response.text();
      if (html.length > 2_000_000) throw new Error('The ratings response was unexpectedly large.');
      result = { id, ...parseRatings(html), checkedAt: new Date().toISOString(), error: null, cached: false };
    } catch (error) {
      const message = error instanceof Error && !/fetch failed|aborted|timeout/i.test(error.message) ? error.message : 'Cross-Tables could not be reached. Saved ratings have been kept; you can enter ratings manually.';
      result = { id, naspaRating: null, wgpoRating: null, checkedAt: new Date().toISOString(), error: message, cached: false };
    }
    // Successful lookups: once per day. Failed lookups: at most once per hour.
    cache.set(id, { result, expiresAt: Date.now() + (result.error ? 60 * 60_000 : 24 * 60 * 60_000) });
    return result;
  })();
  pending.set(id, request);
  try { return await request; } finally { pending.delete(id); }
}
export async function getRatings() { return Promise.all(DEFAULT_PLAYERS.map(p => retrieve(p.id))); }
