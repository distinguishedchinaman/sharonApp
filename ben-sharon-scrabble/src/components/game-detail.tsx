/* eslint-disable @next/next/no-img-element -- Embedded photos are resized before storage; no remote image delivery is used. */
'use client';
import { CalendarDays, MapPin, Pencil, Trash2, Trophy } from 'lucide-react';
import { formatDate, Game, gamePhotos, margin, winner } from '@/lib/model';
import { SampleBadge, Tile } from './ui';
export function GameDetail({ game, onEdit, onDelete }: { game: Game; onEdit: () => void; onDelete: () => void }) {
  const w = winner(game);
  return <div className="game-detail">{game.isSample && <p className="sample-detail"><SampleBadge /> This is an example game, not your real history.</p>}
    <div className="detail-scoreboard"><div><Tile letter="B" points={3} /><span>BEN</span><strong>{game.benScore}</strong></div><span className="versus">vs</span><div><Tile letter="S" /><span>SHARON</span><strong>{game.sharonScore}</strong></div></div>
    <div className={`detail-winner ${w}`}><Trophy size={18} />{w === 'tie' ? 'A tie — perfectly matched' : `${w === 'ben' ? 'Ben' : 'Sharon'} wins by ${margin(game)} points`}</div>
    <dl className="detail-facts"><div><dt><CalendarDays size={15} />Date</dt><dd>{formatDate(game.date)}</dd></div><div><dt><MapPin size={15} />Location</dt><dd>{game.location || 'Not recorded'}</dd></div><div><dt>Game type</dt><dd>{game.gameType}</dd></div><div><dt>First to play</dt><dd>{game.firstPlayer ? game.firstPlayer === 'ben' ? 'Ben' : 'Sharon' : 'Not recorded'}</dd></div></dl>
    <div className="detail-notes"><span className="eyebrow">A NOTE TO REMEMBER</span><p>{game.notes || 'No notes for this game. Sometimes the scores say it all.'}</p></div>
    <dl className="detail-facts"><div><dt>Ben’s bingos</dt><dd>{game.benBingos?.join(', ') || 'Not recorded'}</dd></div><div><dt>Sharon’s bingos</dt><dd>{game.sharonBingos?.join(', ') || 'Not recorded'}</dd></div></dl>
    <div className="detail-gallery">{gamePhotos(game).map((photo, index) => photo.photoUrl && <div className="detail-photo" key={photo.id}><a href={photo.photoUrl} target="_blank" rel="noreferrer" aria-label={`Open photo ${index + 1}`}><img src={photo.photoUrl} alt={`Game photo ${index + 1} from ${formatDate(game.date)}`} /></a></div>)}</div>
    <div className="detail-actions"><button className="button secondary" onClick={onEdit}><Pencil size={16} />Edit game</button><button className="button danger-quiet" onClick={onDelete}><Trash2 size={16} />Delete game</button></div>
  </div>;
}
