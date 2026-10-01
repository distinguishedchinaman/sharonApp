export const GAME_TYPES = ['Casual', 'Tournament', 'Club', 'Practice', 'Other'] as const;
export type GameType = (typeof GAME_TYPES)[number];
export type PlayerId = 'ben' | 'sharon';
export type Winner = PlayerId | 'tie';
export interface Game {
  id: string;
  date: string;
  benScore: number;
  sharonScore: number;
  location: string;
  gameType: GameType;
  firstPlayer: PlayerId | '';
  notes: string;
  photoUrl: string | null;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface Player {
  id: PlayerId;
  name: string;
  crossTablesUrl: string;
  naspaRating: number | null;
  wgpoRating: number | null;
  ratingsLastUpdated: string | null;
  ratingSource: 'manual' | 'cross-tables' | null;
}
export interface Journal {
  version: 1;
  games: Game[];
  players: Player[];
}
export const DEFAULT_PLAYERS: Player[] = [
  { id: 'ben', name: 'Ben', crossTablesUrl: 'https://www.cross-tables.com/results.php?playerid=15872', naspaRating: null, wgpoRating: null, ratingsLastUpdated: null, ratingSource: null },
  { id: 'sharon', name: 'Sharon', crossTablesUrl: 'https://www.cross-tables.com/results.php?p=22923', naspaRating: null, wgpoRating: null, ratingsLastUpdated: null, ratingSource: null },
];
export const winner = (game: Pick<Game, 'benScore' | 'sharonScore'>): Winner => game.benScore === game.sharonScore ? 'tie' : game.benScore > game.sharonScore ? 'ben' : 'sharon';
export const margin = (game: Pick<Game, 'benScore' | 'sharonScore'>) => Math.abs(game.benScore - game.sharonScore);
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function formatDate(date: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en', options ?? { month: 'short', day: 'numeric', year: 'numeric' });
}
// Same-day games keep their original entry order, including after an edit.
export const newestFirst = (a: Game, b: Game) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
