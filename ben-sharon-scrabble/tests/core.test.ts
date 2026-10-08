import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PLAYERS, Game, Journal, localDate, margin, winner } from '../src/lib/model';
import { milestones, statistics } from '../src/lib/statistics';
import { sampleJournal } from '../src/lib/sample';
import { mergeJournal, validateGame, validateJournal, validDate } from '../src/lib/validation';
import { localRepository, STORAGE_KEY } from '../src/lib/storage';
import { parseRatings } from '../src/lib/ratings-parser';
function game(id: string, b: number, s: number, date = '2026-09-01'): Game {
  return { id, date, benScore: b, sharonScore: s, location: 'Kitchen', gameType: 'In Person - Evening', firstPlayer: '', notes: '', photoUrl: null, isSample: false, createdAt: `${date}T12:00:00Z`, updatedAt: `${date}T12:00:00Z` };
}
function journal(games: Game[]): Journal { return { version: 1, games, players: structuredClone(DEFAULT_PLAYERS) }; }
test('winner and margin handle zero, ties, and either winner', () => {
  assert.equal(winner(game('1', 0, 0)), 'tie'); assert.equal(margin(game('1', 310, 400)), 90);
  assert.equal(winner(game('1', 400, 310)), 'ben'); assert.equal(winner(game('1', 310, 400)), 'sharon');
});
test('statistics calculate records, score extrema, streaks, tied closest game, and scoped trends', () => {
  const games = [game('1', 400, 300, '2026-08-30'), game('2', 420, 350, '2026-09-01'), game('3', 380, 380, '2026-09-02'), game('4', 350, 400, '2026-09-03'), game('5', 330, 450, '2026-09-04')];
  const s = statistics(games, new Date('2026-09-20T12:00:00'));
  assert.deepEqual(s.record, { ben: 2, sharon: 2, ties: 1, total: 5 });
  assert.deepEqual(s.longest, { ben: 2, sharon: 2 }); assert.deepEqual(s.currentStreak, { player: 'sharon', count: 2 });
  assert.equal(s.ben.average, 376); assert.equal(s.sharon.average, 376); assert.equal(s.combinedAverage, 752);
  assert.equal(s.averageMargin, 85); assert.equal(s.averageDifference, 0); assert.equal(s.closest?.id, '3');
  assert.equal(s.biggestBen?.id, '1'); assert.equal(s.biggestSharon?.id, '5');
  assert.equal(s.month.total, 4); assert.equal(s.year.total, 5); assert.equal(s.byLocation[0].total, 5);
  assert.deepEqual(statistics([...games, game('6', 100, 100, '2026-09-05')]).currentStreak, { player: null, count: 0 });
});
test('empty and one-sided records do not invent scores or winning margins', () => {
  const empty = statistics([]); assert.equal(empty.ben.high, null); assert.equal(empty.combinedAverage, null); assert.equal(empty.closest, null);
  const tie = statistics([game('1', 0, 0)]); assert.equal(tie.averageMargin, null); assert.equal(tie.biggestBen, null); assert.equal(tie.ben.low, 0);
  assert.deepEqual(milestones([]), []);
});
test('recent form orders same-day games by creation time and not input order', () => {
  const a = game('a', 100, 50); const b = { ...game('b', 50, 100), createdAt: '2026-09-01T15:00:00Z' };
  assert.deepEqual(statistics([b, a]).currentStreak, { player: 'sharon', count: 1 });
});
test('milestones establish win counts and streaks from actual games and omit comebacks', () => {
  const games = Array.from({ length: 100 }, (_, i) => game(`g${String(i).padStart(3, '0')}`, 400, 300));
  const titles = milestones(games).map(m => m.title);
  assert.ok(titles.includes('Ben’s 50th win')); assert.ok(titles.includes('100 games together')); assert.ok(titles.includes('Ben’s 10-game streak'));
  assert.equal(titles.some(t => /comeback/i.test(t)), false);
});
test('date and import validation reject malformed dates, unsafe photos, duplicate IDs, and bad scores', () => {
  assert.equal(validDate('2025-02-29'), false); assert.equal(validDate('2024-02-29'), true); assert.equal(validDate('2026-99-01'), false);
  assert.match(localDate(new Date(2026, 8, 4)), /^2026-09-04$/);
  for (const bad of [-1, 1.5, NaN, 10_000, '400']) assert.throws(() => validateGame({ ...game('1', 300, 400), benScore: bad }));
  assert.throws(() => validateJournal(journal([game('1', 1, 2), game('1', 3, 4)])), /duplicate/);
  assert.throws(() => validateJournal({ ...journal([]), players: [DEFAULT_PLAYERS[0], DEFAULT_PLAYERS[0]] }));
  assert.throws(() => validateGame({ ...game('1', 1, 2), photoUrl: 'javascript:alert(1)' }));
  assert.throws(() => validateGame({ ...game('1', 1, 2), photoUrl: 'data:image/svg+xml;base64,abc' }));
  assert.throws(() => validateGame({ ...game('1', 1, 2), firstPlayer: [] }));
});
test('backup round-trip retains photos and merges never overwrite existing games or profiles', () => {
  const a = { ...game('1', 400, 300), photoUrl: 'data:image/jpeg;base64,YWJjZA==' };
  const current = journal([a]); const incoming = journal([game('1', 0, 500), game('2', 350, 360)]);
  assert.deepEqual(validateJournal(JSON.parse(JSON.stringify(current))), current);
  incoming.players[0].naspaRating = 1500;
  const merged = mergeJournal(current, incoming);
  assert.equal(merged.added, 1); assert.equal(merged.skipped, 1); assert.deepEqual(merged.journal.games[0], a); assert.equal(merged.journal.players[0].naspaRating, null);
});
test('local adapter persists sample initialization, rejects conflicting updates, and preserves unreadable data', async () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) } });
  const initial = await localRepository.load(); assert.equal(initial.games.length, 10); assert.ok(initial.games.every(g => g.isSample));
  const next = journal([game('real', 450, 400)]); await localRepository.save(next, initial); assert.deepEqual(await localRepository.load(), next);
  await assert.rejects(localRepository.save(initial, initial), /another tab/); assert.deepEqual(await localRepository.load(), next);
  values.set(STORAGE_KEY, 'broken backup'); await assert.rejects(localRepository.load()); assert.equal(values.get(STORAGE_KEY), 'broken backup');
  assert.equal(sampleJournal().games.length, 10);
});
test('rating parser accepts only explicit current labels and rejects ambiguity and historical numbers', () => {
  assert.deepEqual(parseRatings('<p>Current NASPA / NWL rating: <b>1520</b></p><p>Latest WGPO rating: 1600</p>'), { naspaRating: 1520, wgpoRating: 1600 });
  assert.throws(() => parseRatings('<table><tr><td>2026 tournament NWL rating 1800</td></tr></table>'), /confidently/);
  assert.throws(() => parseRatings('Current NWL rating: 1400. Current NWL rating: 1500.'), /confidently/);
  assert.deepEqual(parseRatings('Current NWL rating: 1400'), { naspaRating: 1400, wgpoRating: null });
});
test('ratings service coalesces concurrent requests and caches both success and failure', async () => {
  const { getRatings } = await import('../src/lib/ratings-service');
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async input => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 5));
    return String(input).includes('15872') ? new Response('Current NWL rating: 1500; Current WGPO rating: 1600') : new Response('Unavailable', { status: 403 });
  };
  try {
    const [first, concurrent] = await Promise.all([getRatings(), getRatings()]);
    assert.equal(calls, 2); assert.equal(first[0].naspaRating, 1500); assert.match(first[1].error!, /403/);
    assert.deepEqual(first, concurrent);
    const cached = await getRatings(); assert.equal(calls, 2); assert.ok(cached.every(r => r.cached));
  } finally { globalThis.fetch = originalFetch; }
});

test('home streak notes describe only the latest streak or break and clear on ties', () => {
  function sequence(outcomes: string[]) {
    return outcomes.map((outcome, index) => game(String(index), outcome === 'sharon' ? 300 : 400, outcome === 'ben' ? 300 : 400, `2026-09-${String(index + 1).padStart(2, '0')}`));
  }
  for (const player of ['ben', 'sharon'] as const) {
    const other = player === 'ben' ? 'sharon' : 'ben';
    const streak = sequence(Array(5).fill(player));
    assert.deepEqual(statistics(streak).currentStreak, { player, count: 5 });
    assert.equal(statistics(streak).brokenStreak, null);
    const broken = sequence([player, player, player, player, player, other]);
    assert.deepEqual(statistics([...broken].reverse()).brokenStreak, { player: other, previousPlayer: player, count: 5 });
    const newStreak = statistics(sequence([player, player, other, other]));
    assert.equal(newStreak.brokenStreak, null);
    assert.deepEqual(newStreak.currentStreak, { player: other, count: 2 });
    const tied = statistics(sequence([player, player, other, 'tie']));
    assert.equal(tied.brokenStreak, null);
    assert.deepEqual(tied.currentStreak, { player: null, count: 0 });
    assert.equal(statistics(sequence([player, other])).brokenStreak, null);
    assert.equal(statistics(sequence([player, player, 'tie', other])).brokenStreak, null);
  }
  assert.equal(statistics([]).brokenStreak, null);
});

test('first-player stats exclude unknown starters and count ties in win-rate denominator', async () => {
  const { firstPlayerStatistics } = await import('../src/lib/statistics');
  const games = [
    { ...game('a', 400, 300), firstPlayer: 'ben' as const },
    { ...game('b', 300, 300), firstPlayer: 'ben' as const },
    { ...game('c', 350, 450), firstPlayer: 'sharon' as const },
    game('unknown', 999, 0),
  ];
  const s = firstPlayerStatistics(games);
  assert.equal(s.unknown, 1);
  assert.deepEqual(s.ben.first, { games: 2, wins: 1, ties: 1, average: 350, winRate: 50 });
  assert.deepEqual(s.sharon.second, { games: 2, wins: 0, ties: 1, average: 300, winRate: 0 });
  assert.equal(s.sharon.first.average, 450); assert.equal(s.sharon.first.winRate, 100);
  assert.equal(s.ben.second.winRate, 0);
  assert.equal(firstPlayerStatistics([]).ben.first.average, null);
  assert.equal(firstPlayerStatistics([game('unknown', 0, 0)]).sharon.second.winRate, null);
});
test('score trends select recent games before plotting oldest first without mutating input', async () => {
  const { scoreTrend } = await import('../src/lib/statistics');
  const a = game('a', 400, 300, '2026-09-01');
  const b = { ...game('b', 300, 400, '2026-09-01'), createdAt: '2026-09-01T15:00:00Z' };
  const c = game('c', 350, 350, '2026-09-02');
  const input = [c, a, b];
  assert.deepEqual(scoreTrend(input).map(g => g.id), ['a', 'b', 'c']);
  assert.deepEqual(scoreTrend(input, 2).map(g => g.id), ['b', 'c']);
  assert.deepEqual(input.map(g => g.id), ['c', 'a', 'b']);
  assert.deepEqual(scoreTrend([]), []);
  assert.deepEqual(scoreTrend([a], 10), [a]);
});
