'use client';
import { ArrowRight, Flame, Heart, Plus, Sparkles, TrendingUp, Trophy } from 'lucide-react';
import Link from 'next/link';
import { Game, Journal, newestFirst } from '@/lib/model';
import { milestones, statistics } from '@/lib/statistics';
import { BoardArt } from './board-art';
import { EmptyState, GameCard, number, Tile } from './ui';
export function HomeView({ journal, onRecord, onOpen }: { journal: Journal; onRecord: () => void; onOpen: (game: Game) => void }) {
  const s = statistics(journal.games);
  const recent = [...journal.games].sort(newestFirst).slice(0, 3);
  const ben = journal.players.find(p => p.id === 'ben')!;
  const sharon = journal.players.find(p => p.id === 'sharon')!;
  const achievements = milestones(journal.games);
  return <>
    <section className="rivalry-card"><div className="rivalry-content"><div className="eyebrow rivalry-eyebrow"><span className="status-dot" />THE BEST KIND OF COMPETITION</div>
      <div className="player-match"><div className="player-name"><h2>BEN</h2><div className="subtle-ratings">NWL {ben.naspaRating ?? '—'} <span>·</span> WGPO {ben.wgpoRating ?? '—'}</div></div><span className="match-vs">vs</span><div className="player-name sharon"><h2>SHARON</h2><div className="subtle-ratings">NWL {sharon.naspaRating ?? '—'} <span>·</span> WGPO {sharon.wgpoRating ?? '—'}</div></div></div>
      <div className="head-to-head"><div><strong>{s.record.ben}</strong><span>Ben wins</span></div><span className="record-separator">:</span><div className="sharon"><strong>{s.record.sharon}</strong><span>Sharon wins</span></div><div className="ties-score"><strong>{s.record.ties}</strong><span>Ties</span></div></div>
      <div className="record-track" aria-label={`Ben ${s.record.ben} wins, Sharon ${s.record.sharon} wins, ${s.record.ties} ties`}><span className="ben-track" style={{ flex: s.record.ben || (s.record.total ? 0 : 1) }} /><span className="tie-track" style={{ flex: s.record.ties }} /><span className="sharon-track" style={{ flex: s.record.sharon || (s.record.total ? 0 : 1) }} /></div>
      <div className="rivalry-footer"><span><Heart size={14} />{s.record.total} games together</span><Link href="/more">Player ratings <ArrowRight size={13} /></Link></div>
    </div><BoardArt /></section>
    <div className="metric-grid"><div className="metric-card"><span className="metric-icon"><TrendingUp size={18} /></span><span className="metric-label">AVERAGE SCORE</span><div className="paired-metric"><strong>{number(s.ben.average)}<small>Ben</small></strong><span>/</span><strong>{number(s.sharon.average)}<small>Sharon</small></strong></div></div>
      <div className="metric-card"><span className="metric-icon terra"><Trophy size={18} /></span><span className="metric-label">PERSONAL BESTS</span><div className="paired-metric"><strong>{number(s.ben.high)}<small>Ben</small></strong><span>/</span><strong>{number(s.sharon.high)}<small>Sharon</small></strong></div></div>
      <div className="metric-card streak-card"><span className="metric-icon amber"><Flame size={19} /></span><span className="metric-label">CURRENT STREAK</span><div className="streak-metric"><strong>{s.currentStreak.count || '—'}</strong><span>{s.currentStreak.player ? <>{s.currentStreak.player === 'ben' ? 'Ben' : 'Sharon'}’s on a roll<small>{s.currentStreak.count === 1 ? 'One win. More to come?' : 'consecutive wins'}</small></> : <>A fresh start<small>The next move is yours.</small></>}</span></div></div></div>
    <div className="home-bottom-grid"><section className="card recent-card"><div className="section-heading"><h2>Fresh from the board</h2><Link href="/history">All games <ArrowRight size={15} /></Link></div>{recent.length ? <div className="game-list">{recent.map(g => <GameCard compact key={g.id} game={g} onOpen={onOpen} />)}</div> : <EmptyState action={<button className="button primary" onClick={onRecord}><Plus size={16} />Record your first game</button>} />}</section>
      <section className="story-card"><div className="story-heading"><Sparkles size={19} /><span className="eyebrow">THE STORY SO FAR</span></div><h2>More than<br />just a score.</h2><p>A few little moments worth remembering.</p>{achievements.length ? achievements.slice(-2).reverse().map(m => <button className="mini-milestone" key={m.title} onClick={() => { const g = journal.games.find(g => g.id === m.gameId); if (g) onOpen(g); }}><span className="milestone-icon">{m.kind === 'heart' ? <Heart size={18} /> : <Sparkles size={18} />}</span><span><strong>{m.title}</strong><small>{m.description}</small></span><ArrowRight size={14} /></button>) : <div className="story-empty">Your first game is your first milestone.<br />Let’s make a little history.</div>}<Link className="story-link" href="/stats">Explore your stats <ArrowRight size={15} /></Link></section>
    </div><div className="page-note"><Tile letter="Q" points={10} small /><span>A good word. A better memory.</span></div>
  </>;
}
