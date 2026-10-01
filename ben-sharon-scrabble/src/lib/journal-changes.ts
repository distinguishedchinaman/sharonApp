import { Game, Journal, Player } from './model';
export type StoredGame = Omit<Game, 'photoUrl' | 'photoPath'> & { photoUrl: null; photoPath: string | null };
export interface Change<T> { id: string; before: T | null; after: T | null }
export function storedGame(game: Game): StoredGame {
  // Signed display URLs expire and must never be used in conflict comparisons.
  const { photoUrl: _displayUrl, photoPath, ...data } = game;
  void _displayUrl;
  return { ...data, photoUrl: null, photoPath: photoPath ?? null };
}
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = Object.keys(a).sort(), right = Object.keys(b).sort();
  return left.length === right.length && left.every((key, i) => key === right[i] && sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
function changes<T extends { id: string }>(before: T[], after: T[]): Change<T>[] {
  const old = new Map(before.map(x => [x.id, x]));
  const next = new Map(after.map(x => [x.id, x]));
  return [...new Set([...old.keys(), ...next.keys()])].flatMap(id => {
    const a = old.get(id) ?? null, b = next.get(id) ?? null;
    return sameValue(a, b) ? [] : [{ id, before: a, after: b }];
  });
}
export function journalChanges(before: Journal, after: Journal): { games: Change<StoredGame>[]; players: Change<Player>[] } {
  return { games: changes(before.games.map(storedGame), after.games.map(storedGame)), players: changes(before.players, after.players) };
}
