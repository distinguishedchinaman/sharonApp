'use client';
import { useState } from 'react';
import { ArrowDownUp, Search, SlidersHorizontal } from 'lucide-react';
import { Game, GAME_TYPES, margin, matchesGameType, newestFirst, winner } from '@/lib/model';
import { EmptyState, GameCard } from './ui';
export function HistoryView({ games, onOpen }: { games: Game[]; onOpen: (game: Game) => void }) {
  const [outcome, setOutcome] = useState('all');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState('newest');
  const [search, setSearch] = useState('');
  const filtered = games.filter(g => (outcome === 'all' || winner(g) === outcome) && matchesGameType(g, type) && `${g.location} ${g.notes} ${g.date} ${g.benBingos?.join(" ") ?? ""} ${g.sharonBingos?.join(" ") ?? ""}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => {
    if (sort === 'oldest') return newestFirst(b, a);
    if (sort === 'closest') return margin(a) - margin(b) || newestFirst(a, b);
    if (sort === 'biggest') return margin(b) - margin(a) || newestFirst(a, b);
    if (sort === 'highest') return (b.benScore + b.sharonScore) - (a.benScore + a.sharonScore) || newestFirst(a, b);
    return newestFirst(a, b);
  });
  return <><section className="history-controls"><div className="filter-tabs" role="group" aria-label="Filter by winner">{[['all', 'All games'], ['ben', 'Ben wins'], ['sharon', 'Sharon wins'], ['tie', 'Ties']].map(([value, label]) => <button key={value} className={outcome === value ? 'active' : ''} aria-pressed={outcome === value} onClick={() => setOutcome(value)}>{label}</button>)}</div><div className="filter-row"><label className="search-field"><Search size={17} /><input aria-label="Search games" placeholder="Find a place or a memory…" value={search} onChange={e => setSearch(e.target.value)} /></label><label className="select-control"><SlidersHorizontal size={16} /><select aria-label="Filter by game type" value={type} onChange={e => setType(e.target.value)}><option value="all">All game types</option><option value="In Person">In Person · all subtypes</option><option value="Woogles">Woogles · all subtypes</option>{GAME_TYPES.map(t => <option key={t}>{t}</option>)}</select></label><label className="select-control"><ArrowDownUp size={16} /><select aria-label="Sort games" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="closest">Closest game</option><option value="biggest">Biggest margin</option><option value="highest">Highest combined score</option></select></label></div></section>
    <div className="history-count">{filtered.length} {filtered.length === 1 ? 'game' : 'games'}<span>{games.some(g => g.isSample) ? ' · Includes clearly marked sample games' : ' · Every game has a story'}</span></div>
    <section className="card history-list">{filtered.length ? filtered.map(g => <GameCard key={g.id} game={g} onOpen={onOpen} />) : <EmptyState title={games.length ? 'No games match just yet.' : 'A blank page, a fresh board.'} text={games.length ? 'Try another filter or search to find your game.' : 'Record your first game to start your shared history.'} />}</section>
  </>;
}
