import { Journal } from './model';
import { sampleJournal } from './sample';
import { validateJournal } from './validation';
export const STORAGE_KEY = 'one-more-game:journal:v1';
// Replace this adapter with a household-scoped Supabase repository in Phase 2.
export interface JournalRepository {
  load(): Promise<Journal>;
  save(journal: Journal, expected?: Journal): Promise<void>;
}
export const localRepository: JournalRepository = {
  async load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) return validateJournal(JSON.parse(raw));
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
