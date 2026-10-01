'use client';
import { useEffect, useId, useRef } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { formatDate, Game, margin, winner } from '@/lib/model';
export function Tile({ letter, points = 1, small = false }: { letter: string; points?: number; small?: boolean }) {
  return <span className={`letter-tile ${small ? 'small' : ''}`} aria-hidden="true">{letter}<sub>{points}</sub></span>;
}
export function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} aria-labelledby={id} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal-content"><div className="modal-heading"><div><span className="eyebrow">YOUR SCRABBLE JOURNAL</span><h2 id={id}>{title}</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={21} /></button></div>{children}</div>
  </dialog>;
}
export function SampleBadge() { return <span className="sample-badge">SAMPLE</span>; }
export function GameCard({ game, onOpen, compact = false }: { game: Game; onOpen: (game: Game) => void; compact?: boolean }) {
  const w = winner(game);
  return <button className={`game-card ${compact ? 'compact' : ''}`} onClick={() => onOpen(game)}>
    <span className="game-date"><span className="date-day">{new Date(`${game.date}T12:00:00`).getDate()}</span><span>{new Date(`${game.date}T12:00:00`).toLocaleDateString('en', { month: 'short' })}</span></span>
    <span className="game-card-main"><span className="game-label">{game.location || game.gameType}{game.isSample && <SampleBadge />}</span><span className="game-subtitle">{formatDate(game.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}<span className="dot">·</span>{game.gameType}</span></span>
    <span className="game-scores"><span className={w === 'ben' ? 'score-winner ben' : ''}><small>BEN</small>{game.benScore}</span><span className="score-divider">:</span><span className={w === 'sharon' ? 'score-winner sharon' : ''}><small>SHARON</small>{game.sharonScore}</span></span>
    <span className={`game-result ${w}`}><span>{w === 'tie' ? 'A tie' : w === 'ben' ? 'Ben wins' : 'Sharon wins'}</span><small>{w === 'tie' ? 'Evenly matched' : `by ${margin(game)} points`}</small></span><ArrowUpRight size={17} className="game-arrow" />
  </button>;
}
export function EmptyState({ title = 'Your story starts here.', text = 'Two scores. A few good words. Record your first game together.', action }: { title?: string; text?: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-tiles"><Tile letter="B" points={3} /><Tile letter="S" /></div><h3>{title}</h3><p>{text}</p>{action}</div>;
}
export function number(value: number | null, digits = 0) { return value === null ? '—' : value.toLocaleString('en', { maximumFractionDigits: digits, minimumFractionDigits: digits }); }
