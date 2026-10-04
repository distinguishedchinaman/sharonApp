import { DEFAULT_PLAYERS, GAME_TYPES, LEGACY_GAME_TYPES, GamePhoto, Game, Journal, Player } from './model';
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= '2200-12-31';
}
const timestamp = (value: unknown): value is string => text(value, 40) && !Number.isNaN(Date.parse(value));
export function validateGame(value: unknown, allowCloudPhotos = false): Game {
  if (!isObject(value) || !text(value.id, 100) || !/^[A-Za-z0-9_-]{1,100}$/.test(value.id) || !validDate(value.date) ||
    !integer(value.benScore, 0, 9999) || !integer(value.sharonScore, 0, 9999) ||
    !text(value.location, 120) || !text(value.notes, 5000) ||
    ![...GAME_TYPES, ...LEGACY_GAME_TYPES].includes(value.gameType as never) || (typeof value.firstPlayer !== 'string' || !['ben', 'sharon', ''].includes(value.firstPlayer)) ||
    typeof value.isSample !== 'boolean' || !timestamp(value.createdAt) || !timestamp(value.updatedAt)) {
    throw new Error('A game has missing or invalid fields. Scores must be whole numbers from 0 to 9,999 and dates must be valid.');
  }
  const photoPath = value.photoPath;
  if (photoPath !== undefined && photoPath !== null && !(allowCloudPhotos && text(photoPath, 240) && /^[0-9a-f-]{36}\/[A-Za-z0-9_-]{1,100}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(photoPath))) throw new Error('Invalid cloud photo reference. Import a portable JSON backup with embedded photos.');
  const signedPhoto = allowCloudPhotos && typeof photoPath === 'string' && text(value.photoUrl, 4096) && /^https?:\/\//.test(value.photoUrl);
  if (value.photoUrl !== null && !signedPhoto && !(text(value.photoUrl, 900_000) && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value.photoUrl))) {
    throw new Error('A photo is invalid. Backups must use embedded JPEG, PNG, or WebP images.');
  }
  const bingos = (field: string) => {
    const words = value[field];
    if (words === undefined) return undefined;
    if (!Array.isArray(words) || words.length > 50 || words.some(word => typeof word !== 'string' || !/^[A-Za-z?]{2,30}\*?$/.test(word))) throw new Error('Enter bingo words separated by commas, using letters, ? for blanks, and an optional trailing * for phonies.');
    return words.map(word => String(word).toUpperCase());
  };
  const benBingos = bingos('benBingos'), sharonBingos = bingos('sharonBingos');
  let additionalPhotos: GamePhoto[] | undefined;
  if (value.additionalPhotos !== undefined) {
    if (!Array.isArray(value.additionalPhotos) || value.additionalPhotos.length > 11) throw new Error('A game can have up to 12 photos.');
    additionalPhotos = value.additionalPhotos.map(photo => {
      if (!isObject(photo) || !text(photo.id, 100) || !/^[A-Za-z0-9_-]{1,100}$/.test(photo.id)) throw new Error('Invalid photo ID.');
      const checked = validateGame({ ...value, additionalPhotos: undefined, photoUrl: photo.photoUrl, photoPath: photo.photoPath }, allowCloudPhotos);
      return { id: photo.id, photoUrl: checked.photoUrl, ...(checked.photoPath ? { photoPath: checked.photoPath } : {}) };
    });
    if (new Set(additionalPhotos.map(photo => photo.id)).size !== additionalPhotos.length || additionalPhotos.some(photo => photo.id === 'primary')) throw new Error('Duplicate photo IDs.');
  }
  return { id: value.id, date: value.date, benScore: value.benScore as number, sharonScore: value.sharonScore as number, location: value.location, gameType: !allowCloudPhotos && LEGACY_GAME_TYPES.includes(value.gameType as never) ? 'In Person - Evening' : value.gameType as Game['gameType'], firstPlayer: value.firstPlayer as Game['firstPlayer'], notes: value.notes, photoUrl: value.photoUrl as string | null, isSample: value.isSample, createdAt: value.createdAt, updatedAt: value.updatedAt, ...(additionalPhotos !== undefined ? { additionalPhotos } : {}), ...(benBingos !== undefined ? { benBingos } : {}), ...(sharonBingos !== undefined ? { sharonBingos } : {}), ...(typeof photoPath === 'string' ? { photoPath } : {}) };
}
function validatePlayer(value: unknown): Player {
  if (!isObject(value) || (typeof value.id !== 'string' || !['ben', 'sharon'].includes(value.id)) || !text(value.name, 60) || !value.name.trim() ||
    !(value.naspaRating === null || integer(value.naspaRating, 0, 4000)) || !(value.wgpoRating === null || integer(value.wgpoRating, 0, 4000)) ||
    !(value.ratingsLastUpdated === null || timestamp(value.ratingsLastUpdated)) || ![null, 'manual', 'cross-tables'].includes(value.ratingSource as string | null)) {
    throw new Error('A player profile has invalid ratings or fields.');
  }
  const player = DEFAULT_PLAYERS.find(p => p.id === value.id)!;
  return { ...player, name: value.name, naspaRating: value.naspaRating as number | null, wgpoRating: value.wgpoRating as number | null, ratingsLastUpdated: value.ratingsLastUpdated as string | null, ratingSource: value.ratingSource as Player['ratingSource'] };
}
export function validateJournal(input: unknown, allowCloudPhotos = false): Journal {
  if (!isObject(input) || input.version !== 1 || !Array.isArray(input.games) || input.games.length > 50_000 || !Array.isArray(input.players) || input.players.length !== 2) {
    throw new Error('This is not a version 1 Anniversary Series backup. Nothing has been changed.');
  }
  const games = input.games.map(game => validateGame(game, allowCloudPhotos));
  if (new Set(games.map(g => g.id)).size !== games.length) throw new Error('The backup contains duplicate game IDs. Nothing has been changed.');
  const players = input.players.map(validatePlayer);
  if (new Set(players.map(p => p.id)).size !== 2) throw new Error('The backup must contain both Ben and Sharon.');
  return { version: 1, games, players };
}
export function mergeJournal(current: Journal, incoming: Journal) {
  const ids = new Set(current.games.map(g => g.id));
  const additions = incoming.games.filter(g => !ids.has(g.id));
  // A merge never changes an existing game or player profile.
  return { journal: { ...current, games: [...current.games, ...additions] }, added: additions.length, skipped: incoming.games.length - additions.length };
}
