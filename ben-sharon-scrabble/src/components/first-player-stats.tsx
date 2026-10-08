import { Game } from '@/lib/model';
import { firstPlayerStatistics } from '@/lib/statistics';
import { number } from './ui';

export function FirstPlayerStats({ games }: { games: Game[] }) {
  const stats = firstPlayerStatistics(games);
  return <section className="card first-player-card"><div className="section-heading"><h2>Who goes first?</h2></div>
    <p className="trend-description">Compare each player’s results when playing first or second.</p>
    <div className="first-player-grid">{(['ben', 'sharon'] as const).map(player => <div key={player}><h3>{player === 'ben' ? 'Ben' : 'Sharon'}</h3><table className={`first-player-table ${player}`}><thead><tr><th scope="col">Playing</th><th scope="col">Games</th><th scope="col">Average</th><th scope="col">Win rate</th></tr></thead><tbody>{(['first', 'second'] as const).map(order => { const row = stats[player][order]; return <tr key={order}><th scope="row">{order === 'first' ? 'First' : 'Second'}</th><td>{row.games}</td><td className="first-player-score">{number(row.average, 1)}</td><td>{row.winRate === null ? '—' : `${number(row.winRate, 1)}%`}</td></tr>; })}</tbody></table></div>)}</div>
    <p className="trend-description">Win rate counts wins out of all games in that group, including ties. {stats.unknown > 0 ? `${stats.unknown} ${stats.unknown === 1 ? 'game excluded because the first player wasn’t recorded' : 'games excluded because the first player wasn’t recorded'}.` : 'First player recorded for every game.'}</p>
  </section>;
}
