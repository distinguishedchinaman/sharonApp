import { test, expect, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { DEFAULT_PLAYERS, Game } from '../../src/lib/model';
const KEY = 'one-more-game:journal:v1';
async function nav(page: Page, name: string) {
  const mobile = (page.viewportSize()?.width ?? 1440) <= 700;
  await page.getByRole('navigation', { name: mobile ? 'Mobile navigation' : 'Primary navigation', exact: true }).getByRole('link', { name, exact: true }).click();
  await expect(page.getByText('Opening your journal…')).toHaveCount(0);
}
async function openRecord(page: Page) {
  const mobile = (page.viewportSize()?.width ?? 1440) <= 700;
  await page.locator(mobile ? '.mobile-record' : '.header-record').click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
async function games(page: Page): Promise<Game[]> { return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).games, KEY); }
async function clearSamples(page: Page) {
  await nav(page, 'More');
  await page.getByRole('button', { name: 'Delete sample data', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete sample data', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.data-status')).toContainText('0 sample games');
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'BEN', exact: true })).toBeVisible();
});
test('sample dashboard, accessible screens, and phone layout', async ({ page }, testInfo) => {
  await expect(page.locator('.head-to-head')).toContainText('Ben wins');
  expect(await games(page)).toHaveLength(10);
  expect((await games(page)).every(g => g.isSample)).toBeTruthy();
  await page.screenshot({ path: `/tmp/one-more-game-${testInfo.project.name}.png`, fullPage: true });
  for (const name of ['History', 'Stats', 'More', 'Home']) {
    await nav(page, name);
    const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, screen: window.innerWidth }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.screen);
  }
  await nav(page, 'Stats');
  await expect(page.getByText('5', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Worth celebrating', { exact: true })).toBeVisible();
});
test('record, photo, refresh persistence, details, edit, and confirmed deletion', async ({ page }) => {
  await clearSamples(page);
  await openRecord(page);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('spinbutton', { name: "Ben's score" }).fill('430');
  await dialog.getByRole('spinbutton', { name: "Sharon's score" }).fill('415');
  await expect(dialog.getByText('Ben wins by 15 points.')).toBeVisible();
  await dialog.getByRole('button', { name: /Add a little more/ }).click();
  await dialog.getByLabel('Location', { exact: true }).fill('Our kitchen');
  await dialog.getByLabel('A note to remember').fill('A lovely real game.');
  await dialog.getByLabel('Who went first?').selectOption('sharon');
  await dialog.getByLabel('Game photo').setInputFiles('public/icon-192.png');
  await expect(dialog.getByAltText('Photo attached to this game')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save game', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await games(page)).toHaveLength(1);
  await page.reload();
  await expect(page.locator('.data-status')).toContainText('1 real games');
  await nav(page, 'History');
  await page.getByRole('button', { name: /Our kitchen/ }).click();
  await expect(page).toHaveURL(/\/games\//);
  await expect(page.getByRole('dialog').getByText('A lovely real game.')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();
  await page.getByRole('button', { name: 'Edit game', exact: true }).click();
  await page.getByRole('dialog').getByRole('spinbutton', { name: "Sharon's score" }).fill('440');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Sharon wins by 10 points')).toBeVisible();
  await page.getByRole('button', { name: 'Delete game', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await games(page)).toHaveLength(1);
  await page.getByRole('button', { name: 'Delete game', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete game', exact: true }).click();
  await expect(page).toHaveURL(/\/history$/);
  expect(await games(page)).toHaveLength(0);
});
test('history filters, search, and sorting use recorded data', async ({ page }) => {
  await nav(page, 'History');
  await expect(page.locator('.history-list .game-card')).toHaveCount(10);
  await page.getByRole('button', { name: 'Ben wins', exact: true }).click();
  await expect(page.locator('.history-list .game-card')).toHaveCount(5);
  await page.getByRole('button', { name: 'Sharon wins', exact: true }).click();
  await expect(page.locator('.history-list .game-card')).toHaveCount(4);
  await page.getByRole('button', { name: 'Ties', exact: true }).click();
  await expect(page.locator('.history-list .game-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'All games', exact: true }).click();
  await page.getByLabel('Filter by game type').selectOption('Tournament');
  await expect(page.locator('.history-list .game-card')).toHaveCount(1);
  await page.getByLabel('Filter by game type').selectOption('all');
  await page.getByLabel('Sort games').selectOption('closest');
  await expect(page.locator('.history-list .game-card').first()).toContainText('A tie');
  await page.getByLabel('Search games').fill('Lake George');
  await expect(page.locator('.history-list .game-card')).toHaveCount(2);
});
test('JSON export, validated merge, explicit replace, and invalid import preserve records', async ({ page }) => {
  await nav(page, 'More');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export data/ }).click();
  const backupDownload = await downloadPromise;
  const backup = JSON.parse(await readFile((await backupDownload.path())!, 'utf8'));
  expect(backup.games).toHaveLength(10); expect(backup.players).toHaveLength(2);
  await page.getByLabel('Import JSON backup').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await expect(page.getByRole('status').filter({ hasText: 'not valid JSON' })).toBeVisible();
  expect(await games(page)).toHaveLength(10);
  const one = { ...backup, games: [{ ...backup.games[0], id: 'import-real', isSample: false, benScore: 900 }] };
  await page.getByLabel('Import JSON backup').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(one)) });
  await expect(page.getByRole('dialog').getByText('Backup validated')).toBeVisible();
  expect(await games(page)).toHaveLength(10);
  await page.getByRole('button', { name: 'Merge new games', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await games(page)).toHaveLength(11);
  await page.getByLabel('Import JSON backup').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(one)) });
  await page.getByRole('button', { name: /Replace the entire/ }).click();
  expect(await games(page)).toHaveLength(11);
  await page.getByRole('button', { name: 'Confirm replace journal', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await games(page)).toHaveLength(1);
  await page.reload(); await expect(page.locator('.data-status')).toContainText('1 real games');
});
test('manual ratings persist and failed refresh leaves them intact', async ({ page }) => {
  await nav(page, 'More');
  const profile = page.locator('.player-profile.ben');
  await profile.getByRole('button', { name: 'Enter ratings manually', exact: true }).click();
  await page.getByLabel('Ben NASPA rating').fill('1550');
  await page.getByLabel('Ben WGPO rating').fill('1600');
  await page.getByRole('button', { name: 'Save Ben’s ratings' }).click();
  await expect(profile.locator('.profile-ratings')).toContainText('1550');
  await page.route('**/api/ratings', route => route.fulfill({ json: { ratings: DEFAULT_PLAYERS.map(p => ({ id: p.id, naspaRating: null, wgpoRating: null, error: 'Refresh failed; saved ratings kept.', checkedAt: new Date().toISOString(), cached: false })) } }));
  await page.getByRole('button', { name: 'Update ratings', exact: true }).click();
  await expect(page.locator('.ratings-notice')).toContainText('Refresh failed');
  await expect(profile.locator('.profile-ratings')).toContainText('1550');
  await page.reload(); await expect(profile.locator('.profile-ratings')).toContainText('1550');
});
test('corrupt storage is reported without replacing the original saved bytes', async ({ page }) => {
  await page.evaluate(key => localStorage.setItem(key, 'my broken but important backup'), KEY);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your saved journal needs attention.' })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe('my broken but important backup');
});
test('failed storage write leaves the previous game saved and keeps the form open', async ({ page }) => {
  await openRecord(page);
  await page.getByRole('spinbutton', { name: "Ben's score" }).fill('400');
  await page.getByRole('spinbutton', { name: "Sharon's score" }).fill('350');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'Save game', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('could not save');
  expect(await games(page)).toHaveLength(10);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'BEN', exact: true })).toBeVisible();
  expect(await games(page)).toHaveLength(10);
});
test('production app starts offline and can open a previously uncached local game URL', async ({ page, context }) => {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const journal = await games(page);
  const id = journal[0].id;
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'BEN', exact: true })).toBeVisible();
  await page.goto(`/games/${id}`);
  await expect(page.getByRole('dialog').getByText('This is an example game, not your real history.')).toBeVisible();
  await context.setOffline(false);
});
