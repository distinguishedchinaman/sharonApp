import { Game, gameCategory, PlayerId, localDate, margin, newestFirst, winner } from './model';
export function record(games: Game[]) {
  return { ben: games.filter(g => winner(g) === 'ben').length, sharon: games.filter(g => winner(g) === 'sharon').length, ties: games.filter(g => winner(g) === 'tie').length, total: games.length };
}
const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export function firstPlayerStatistics(games: Game[]) {
  const known = games.filter(g => g.firstPlayer === 'ben' || g.firstPlayer === 'sharon');
  const forPlayer = (player: PlayerId, first: boolean) => {
    const selected = known.filter(g => (g.firstPlayer === player) === first);
    const wins = selected.filter(g => winner(g) === player).length;
    return { games: selected.length, wins, ties: selected.filter(g => winner(g) === 'tie').length,
      average: average(selected.map(g => g[player === 'ben' ? 'benScore' : 'sharonScore'])),
      winRate: selected.length ? 100 * wins / selected.length : null };
  };
  return { unknown: games.length - known.length,
    ben: { first: forPlayer('ben', true), second: forPlayer('ben', false) },
    sharon: { first: forPlayer('sharon', true), second: forPlayer('sharon', false) } };
}

export function scoreTrend(games: Game[], limit?: number) {
  const sorted = [...games].sort(newestFirst);
  return (limit === undefined ? sorted : sorted.slice(0, limit)).reverse();
}
export function statistics(games: Game[], now = new Date()) {
  const sorted = [...games].sort(newestFirst);
  const chronological = [...sorted].reverse();
  const longest = { ben: 0, sharon: 0 };
  let streakPlayer: PlayerId | null = null;
  let run = 0;
  let brokenStreak: { player: PlayerId; previousPlayer: PlayerId; count: number } | null = null;
  for (const g of chronological) {
    const w = winner(g);
    brokenStreak = w !== 'tie' && streakPlayer && w !== streakPlayer && run >= 2
      ? { player: w, previousPlayer: streakPlayer, count: run }
      : null;
    if (w === 'tie') { streakPlayer = null; run = 0; continue; }
    run = w === streakPlayer ? run + 1 : 1;
    streakPlayer = w;
    longest[w] = Math.max(longest[w], run);
  }
  const closest = [...sorted].sort((a, b) => margin(a) - margin(b))[0] ?? null;
  const biggest = (player: PlayerId) => sorted.filter(g => winner(g) === player).sort((a, b) => margin(b) - margin(a))[0] ?? null;
  const scores = (player: PlayerId) => {
    const values = games.map(g => g[player === 'ben' ? 'benScore' : 'sharonScore']);
    return { average: average(values), high: values.length ? values.reduce((a, b) => Math.max(a, b)) : null, low: values.length ? values.reduce((a, b) => Math.min(a, b)) : null };
  };
  const grouped = (key: 'location' | 'gameType' | 'category') => {
    const groups = new Map<string, Game[]>();
    for (const g of games) { const k = (key === 'category' ? gameCategory(g) : g[key]) || 'Not recorded'; groups.set(k, [...(groups.get(k) ?? []), g]); }
    return [...groups].map(([label, values]) => ({ label, ...record(values) })).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  };
  const margins = new Map<number, number>();
  for (const g of games) margins.set(margin(g), (margins.get(margin(g)) ?? 0) + 1);
  const frequency = Math.max(0, ...margins.values());
  const commonMargins = [...margins].filter(([, n]) => n === frequency).map(([m]) => m).sort((a, b) => a - b);
  const combined = sorted.map(g => g.benScore + g.sharonScore);
  const today = localDate(now);
  const highestCombined = [...sorted].sort((a, b) => (b.benScore + b.sharonScore) - (a.benScore + a.sharonScore))[0] ?? null;
  return {
    record: record(games), ben: scores('ben'), sharon: scores('sharon'),
    combinedAverage: average(combined), combinedHigh: combined.length ? combined.reduce((a, b) => Math.max(a, b)) : null,
    combinedLow: combined.length ? combined.reduce((a, b) => Math.min(a, b)) : null,
    averageMargin: average(games.filter(g => winner(g) !== 'tie').map(margin)),
    averageDifference: average(games.map(g => g.benScore - g.sharonScore)),
    closest, biggestBen: biggest('ben'), biggestSharon: biggest('sharon'), highestCombined,
    longest, currentStreak: { player: streakPlayer, count: run }, brokenStreak, last5: record(sorted.slice(0, 5)), last10: record(sorted.slice(0, 10)),
    month: record(games.filter(g => g.date.slice(0, 7) === today.slice(0, 7))), year: record(games.filter(g => g.date.slice(0, 4) === today.slice(0, 4))),
    byLocation: grouped('location'), byType: grouped('gameType'), byCategory: grouped('category'), commonMargins, commonMarginFrequency: frequency,
  };
}
export interface Milestone { title: string; description: string; gameId: string; kind: 'trophy' | 'spark' | 'heart' }
export function milestones(games: Game[]): Milestone[] {
  if (!games.length) return [];
  const sorted = [...games].sort(newestFirst).reverse();
  const result: Milestone[] = [];
  const wins = { ben: 0, sharon: 0 };
  sorted.forEach((g, i) => {
    const w = winner(g);
    if (w !== 'tie') {
      wins[w]++;
      if (wins[w] % 50 === 0) result.push({ title: `${w === 'ben' ? 'Ben' : 'Sharon'}’s ${wins[w]}th win`, description: 'A rivalry worth keeping.', gameId: g.id, kind: 'trophy' });
    }
    if ((i + 1) % 100 === 0) result.push({ title: `${i + 1} games together`, description: 'So many words. So many memories.', gameId: g.id, kind: 'heart' });
  });
  for (const p of ['ben', 'sharon'] as const) {
    const best = [...sorted].sort((a, b) => b[`${p}Score`] - a[`${p}Score`])[0];
    result.push({ title: `${p === 'ben' ? 'Ben' : 'Sharon'}’s personal best`, description: `${best[`${p}Score`]} points in a single game.`, gameId: best.id, kind: 'trophy' });
  }
  const s = statistics(games);
  if (s.closest) result.push({ title: s.closest.benScore === s.closest.sharonScore ? 'Perfectly matched' : 'Down to the last tile', description: s.closest.benScore === s.closest.sharonScore ? 'A tie. A point for togetherness.' : `Your closest game: just ${margin(s.closest)} points apart.`, gameId: s.closest.id, kind: 'heart' });
  if (s.highestCombined) result.push({ title: 'A very good word day', description: `${s.combinedHigh} combined points. Your best together.`, gameId: s.highestCombined.id, kind: 'spark' });
  let streak: 'ben' | 'sharon' | null = null;
  let count = 0;
  for (const g of sorted) {
    const w = winner(g);
    if (w === 'tie') { streak = null; count = 0; continue; }
    count = streak === w ? count + 1 : 1; streak = w;
    if (count % 10 === 0) result.push({ title: `${w === 'ben' ? 'Ben' : 'Sharon'}’s ${count}-game streak`, description: 'An uninterrupted run of wins.', gameId: g.id, kind: 'trophy' });
  }
  return result;
}
