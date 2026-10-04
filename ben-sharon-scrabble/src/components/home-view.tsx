'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Heart, Plus, Sparkles, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Game, Journal, newestFirst } from '@/lib/model';
import { milestones, statistics } from '@/lib/statistics';
import { prepareGolfClap } from '@/lib/golf-clap';
import { prepareVictoryFanfare } from '@/lib/victory-fanfare';
import { TravelSlideshow } from './travel-slideshow';
import { EmptyState, GameCard, number } from './ui';
export function HomeView({ journal, onRecord, onOpen }: { journal: Journal; onRecord: () => void; onOpen: (game: Game) => void }) {
  const [averageRange, setAverageRange] = useState<'all' | 10 | 5>('all');
  const nextAverageRange = averageRange === 'all' ? 10 : averageRange === 10 ? 5 : 'all';
  const averageRangeLabel = averageRange === 'all' ? 'All games' : `Last ${averageRange}`;
  const nextAverageRangeLabel = nextAverageRange === 'all' ? 'all games' : `last ${nextAverageRange} games`;
  const avatarSound = useRef<ReturnType<typeof prepareGolfClap>>(undefined);
  useEffect(() => () => avatarSound.current?.dispose(), []);
  function playAvatarSound(player: 'ben' | 'sharon') {
    avatarSound.current?.dispose();
    avatarSound.current = player === 'ben' ? prepareGolfClap() : prepareVictoryFanfare();
    avatarSound.current?.play();
  }
  const s = statistics(journal.games);
  function streakNote(player: 'ben' | 'sharon') {
    if (s.currentStreak.player === player && s.currentStreak.count >= 2) return `🔥 ${s.currentStreak.count} game winning streak`;
    if (s.brokenStreak?.player === player) return `🛑 ${player === 'ben' ? 'Ben' : 'Sharon'} just broke ${s.brokenStreak.previousPlayer === 'ben' ? 'Ben' : 'Sharon'}'s ${s.brokenStreak.count}-game winning streak`;
    return null;
  }
  const sorted = [...journal.games].sort(newestFirst);
  const averages = averageRange === 'all' ? s : statistics(sorted.slice(0, averageRange));
  const recent = sorted.slice(0, 3);
  const recentBingos = sorted.flatMap(game => [...(game.benBingos ?? []), ...(game.sharonBingos ?? [])]).slice(0, 30);
  const ben = journal.players.find(p => p.id === 'ben')!;
  const sharon = journal.players.find(p => p.id === 'sharon')!;
  const achievements = milestones(journal.games);
  return <>
    <section className="rivalry-card"><div className="rivalry-content"><div className="eyebrow rivalry-eyebrow"><span className="status-dot" />ANNIVERSARY SERIES</div>
      <div className="head-to-head">
        <div className="player-win-box">
          <div className="win-count-row"><button type="button" className="win-avatar ben-win-avatar" aria-label="Play Ben’s golf clap" onClick={() => playAvatarSound('ben')}><Image src="/benavatar.png" alt="" fill sizes="48px" /></button><strong aria-label={`${s.record.ben} Ben wins`}>{s.record.ben}</strong></div>
          <div className="player-name"><h2>BEN</h2><div className="subtle-ratings">NWL {ben.naspaRating ?? '—'} <span>·</span> WGPO {ben.wgpoRating ?? '—'}</div></div>
          {streakNote('ben') && <span className="win-streak-note">{streakNote('ben')}</span>}
        </div>
        <span className="match-vs">VS</span>
        <div className="player-win-box sharon">
          <div className="win-count-row"><button type="button" className="win-avatar sharon-win-avatar" aria-label="Play Sharon’s tadaa" onClick={() => playAvatarSound('sharon')}><Image src="/sharonavatar-transparent.png" alt="" fill sizes="48px" /></button><strong aria-label={`${s.record.sharon} Sharon wins`}>{s.record.sharon}</strong></div>
          <div className="player-name sharon"><h2>SHARON</h2><div className="subtle-ratings">NWL {sharon.naspaRating ?? '—'} <span>·</span> WGPO {sharon.wgpoRating ?? '—'}</div></div>
          {streakNote('sharon') && <span className="win-streak-note">{streakNote('sharon')}</span>}
        </div>
        {s.record.ties > 0 && <div className="ties-score"><strong>{s.record.ties}</strong><span>Ties</span></div>}
      </div>
      <div className="record-track" aria-label={`Ben ${s.record.ben} wins, Sharon ${s.record.sharon} wins, ${s.record.ties} ties`}><span className="ben-track" style={{ flex: s.record.ben || (s.record.total ? 0 : 1) }} /><span className="tie-track" style={{ flex: s.record.ties }} /><span className="sharon-track" style={{ flex: s.record.sharon || (s.record.total ? 0 : 1) }} /></div>
      <div className="rivalry-footer"><span><Heart size={14} />{s.record.total} games together <span className="first-counts">· Ben first: {journal.games.filter(g => g.firstPlayer === 'ben').length} · Sharon first: {journal.games.filter(g => g.firstPlayer === 'sharon').length}</span></span><Link href="/more">Player ratings <ArrowRight size={13} /></Link></div>
    </div></section>
    <div className="metric-grid home-average-grid"><div className="metric-card"><span className="metric-icon"><TrendingUp size={18} /></span><span className="metric-label">{averageRange === 'all' ? 'ALL-TIME AVERAGE' : `LAST ${averageRange} AVERAGE`}</span><div className="paired-metric" aria-live="polite"><strong>{number(averages.ben.average)}<small>Ben</small></strong><span>/</span><strong>{number(averages.sharon.average)}<small>Sharon</small></strong></div><button type="button" className="average-range-toggle" aria-label={`Average score: ${averageRangeLabel}. Show ${nextAverageRangeLabel}`} onClick={() => setAverageRange(nextAverageRange)}>Change Time Period <span aria-hidden="true">↔</span></button></div>
    </div>
    <div className="home-bottom-grid"><section className="card recent-card"><div className="section-heading"><h2>Fresh from the board</h2><Link href="/history">All games <ArrowRight size={15} /></Link></div>{recent.length ? <div className="game-list">{recent.map(g => <GameCard compact key={g.id} game={g} onOpen={onOpen} />)}</div> : <EmptyState action={<button className="button primary" onClick={onRecord}><Plus size={16} />Record your first game</button>} />}</section>
      <section className="story-card"><div className="story-heading"><Sparkles size={19} /><span className="eyebrow">THE STORY SO FAR</span></div><h2>More than<br />just a score.</h2><p>A few little moments worth remembering.</p>{achievements.length ? achievements.slice(-2).reverse().map(m => <button className="mini-milestone" key={m.title} onClick={() => { const g = journal.games.find(g => g.id === m.gameId); if (g) onOpen(g); }}><span className="milestone-icon">{m.kind === 'heart' ? <Heart size={18} /> : <Sparkles size={18} />}</span><span><strong>{m.title}</strong><small>{m.description}</small></span><ArrowRight size={14} /></button>) : <div className="story-empty">Your first game is your first milestone.<br />Let’s make a little history.</div>}<Link className="story-link" href="/stats">Explore your stats <ArrowRight size={15} /></Link></section>
    </div>
    <section className="card home-bingo-cloud" aria-label="Recent bingos">{recentBingos.length ? <ul className="bingo-cloud-words">{recentBingos.map((word, index) => <li key={`${index}-${word}`} className={`bingo-cloud-word bingo-cloud-style-${index % 5}`}>{word}</li>)}</ul> : <p className="bingo-cloud-empty">Your next bingo belongs here.</p>}</section>
    <section className="home-travel-card" aria-label="Travel memories"><TravelSlideshow /></section>
  </>;
}
