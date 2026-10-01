import { Journal } from './model';
import { sampleJournal } from './sample';
import { validateJournal } from './validation';
export const STORAGE_KEY = 'one-more-game:journal:v1';
export interface SaveOptions { replaceAll?: boolean }
export interface JournalRepository {
  load(): Promise<Journal>;
  save(journal: Journal, expected?: Journal, options?: SaveOptions): Promise<Journal | void>;
  export?(journal: Journal): Promise<Journal>;
}
export const localRepository: JournalRepository = {
  async load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      const journal = validateJournal(parsed);
      if (parsed.games.some((game: { gameType: string }) => ['Casual', 'Tournament', 'Club', 'Practice', 'Other'].includes(game.gameType))) {
        // Preserve the original bytes before the user-requested category migration.
        if (!localStorage.getItem(`${STORAGE_KEY}:before-categories`)) localStorage.setItem(`${STORAGE_KEY}:before-categories`, raw);
        await this.save(journal);
      }
      return journal;
    }
    const initial = sampleJournal();
    await this.save(initial);
    return initial;
  },
  async save(journal, expected) {
    if (expected && localStorage.getItem(STORAGE_KEY) !== JSON.stringify(expected)) {
      throw new Error('Your journal changed in another tab. Refresh to load the latest games, then try again.');
    }
    const validated = validateJournal(journal);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(validated)); }
    catch { throw new Error('Your browser could not save this change. Storage may be full or disabled. Export a backup and try a smaller photo. Your previous saved data is unchanged.'); }
  },
};
