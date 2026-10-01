import { DEFAULT_PLAYERS, Game, Journal, localDate } from './model';
export function sampleJournal(): Journal {
  const scores = [[382, 410], [438, 395], [366, 372], [420, 420], [451, 402], [389, 431], [405, 397], [376, 428], [462, 415], [412, 398]];
  const games: Game[] = scores.map(([benScore, sharonScore], i) => {
    const date = new Date();
    date.setDate(date.getDate() - (9 - i) * 3 - 1);
    const iso = date.toISOString();
    return {
      id: `sample-${i + 1}`, date: localDate(date), benScore, sharonScore,
      location: ['Home', 'Coffee shop', 'Home', 'Lake George', 'Home'][i % 5],
      gameType: i === 4 ? 'Woogles - League' : i === 8 ? 'In Person - Afternoon' : 'In Person - Evening',
      firstPlayer: i % 2 ? 'ben' : 'sharon',
      notes: i === 9 ? 'A quiet evening, a pot of tea, and one more game. This is an example entry.' : 'Sample game — just here to show you around.',
      photoUrl: null, isSample: true, createdAt: iso, updatedAt: iso,
    };
  });
  return { version: 1, games, players: structuredClone(DEFAULT_PLAYERS) };
}
