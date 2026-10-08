'use client';
import { useId, useState } from 'react';
import { Game, formatDate } from '@/lib/model';
import { scoreTrend } from '@/lib/statistics';
import { GameCard } from './ui';

export function ScoreTrend({ games, onOpen }: { games: Game[]; onOpen: (game: Game) => void }) {
  const [range, setRange] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const points = scoreTrend(games, range === 'all' ? undefined : Number(range));
  const selected = points.find(g => g.id === selectedId) ?? points.at(-1);
  const highest = points.reduce((max, g) => Math.max(max, g.benScore, g.sharonScore), 0);
  const ceiling = Math.max(100, Math.ceil(highest / 100) * 100);
  const x = (index: number) => points.length === 1 ? 380 : 55 + index * 650 / (points.length - 1);
  const y = (score: number) => 232 - score / ceiling * 200;
  const line = (player: 'ben' | 'sharon') => points.map((g, i) => `${x(i)},${y(g[player === 'ben' ? 'benScore' : 'sharonScore'])}`).join(' ');
  return <section className="card score-trend-card">
    <div className="section-heading"><h2 id={titleId}>Score trends</h2><label className="trend-range">Show<select aria-label="Score trend time period" value={range} onChange={e => setRange(e.target.value)}><option value="all">All games</option><option value="30">Last 30 games</option><option value="10">Last 10 games</option></select></label></div>
    <div className="score-trend-legend"><span className="ben">● Ben</span><span className="sharon">● Sharon</span></div>
    <p id={descriptionId} className="trend-description">Each point is one game, ordered by date. Choose a game below to see its scores.</p>
    <div className="score-chart-scroll"><svg className="score-chart" viewBox="0 0 760 280" role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
      {[0, 1, 2, 3, 4].map(step => { const value = ceiling * step / 4; return <g key={step}><line x1="55" x2="705" y1={y(value)} y2={y(value)} className="chart-grid" /><text x="45" y={y(value) + 5} textAnchor="end">{value}</text></g>; })}
      <polyline points={line('ben')} className="score-chart-line ben" /><polyline points={line('sharon')} className="score-chart-line sharon" />
      {points.map((g, i) => <g key={g.id}>{(['ben', 'sharon'] as const).map(player => <circle key={player} cx={x(i)} cy={y(g[player === 'ben' ? 'benScore' : 'sharonScore'])} r={g.id === selected?.id ? 5 : 3} className={`score-chart-point ${player}`} />)}</g>)}
      {points[0] && <text x="55" y="263">{formatDate(points[0].date, { month: 'short', day: 'numeric', year: 'numeric' })}</text>}
      {points.length > 1 && <text x="705" y="263" textAnchor="end">{formatDate(points[points.length - 1].date, { month: 'short', day: 'numeric', year: 'numeric' })}</text>}
    </svg></div>
    {selected && <><label className="field trend-game-picker">Game<select aria-label="Game on score trend" value={selected.id} onChange={e => setSelectedId(e.target.value)}>{points.map((g, i) => <option key={g.id} value={g.id}>{formatDate(g.date)} · Game {i + 1} · Ben {g.benScore} / Sharon {g.sharonScore}</option>)}</select></label><GameCard compact game={selected} onOpen={onOpen} /></>}
    {points.length === 1 && <p className="trend-description">One game so far. Your trend line will appear after the next game.</p>}
  </section>;
}
