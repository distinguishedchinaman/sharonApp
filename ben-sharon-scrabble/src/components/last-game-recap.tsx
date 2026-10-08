'use client';
import { useState } from 'react';
import Image from 'next/image';
import { ArrowRight, Camera, Trophy } from 'lucide-react';
import { formatDate, Game, gamePhotos, margin, winner } from '@/lib/model';
import { SampleBadge } from './ui';

export function LastGameRecap({ game, onOpen }: { game: Game; onOpen: (game: Game) => void }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);
  const photos = gamePhotos(game);
  const photo = photos[photoIndex % Math.max(1, photos.length)];
  const outcome = winner(game);
  const photoAvailable = photo?.photoUrl && !failedPhotos.includes(photo.id);
  const photoContent = photoAvailable ? <Image key={photo.photoUrl} src={photo.photoUrl!} alt={`Photo ${photoIndex % photos.length + 1} from the last game on ${formatDate(game.date)}`} fill sizes="(max-width: 700px) 100vw, 900px" unoptimized onError={() => setFailedPhotos(values => [...values, photo.id])} /> : <span className="recap-photo-empty"><Camera size={28} />{photos.length ? 'Photo temporarily unavailable' : 'No photo attached to this game'}</span>;
  return <section className="card last-game-card last-game-recap">
    <div className="section-heading"><h2>Last game</h2><button type="button" className="text-button" onClick={() => onOpen(game)}>View details <ArrowRight size={15} /></button></div>
    <p className="recap-date">{formatDate(game.date)} · {game.location || game.gameType} {game.isSample && <SampleBadge />}</p>
    {photos.length > 1 ? <button type="button" className="recap-photo" aria-label={`Photo ${photoIndex % photos.length + 1} of ${photos.length}. Show next game photo`} onClick={() => setPhotoIndex(value => (value + 1) % photos.length)}>{photoContent}<span className="recap-photo-count" aria-live="polite">{photoIndex % photos.length + 1} / {photos.length} · Tap for next photo</span></button> : <div className="recap-photo">{photoContent}</div>}
    <div className="detail-scoreboard recap-scoreboard">
      <div><span>BEN</span><strong className="score-with-trophy player-score ben">{game.benScore}{outcome === 'ben' && <><Trophy className="score-trophy" aria-label="Winning score" size={20} /><Image className="detail-victory-avatar ben" src="/ben-victory-avatar.webp" alt="Ben celebrating his win" width={80} height={150} unoptimized /></>}</strong></div>
      <span className="versus">vs</span>
      <div><span>SHARON</span><strong className="score-with-trophy player-score sharon">{game.sharonScore}{outcome === 'sharon' && <><Trophy className="score-trophy" aria-label="Winning score" size={20} /><Image className="detail-victory-avatar sharon" src="/sharon-victory-avatar.webp" alt="Sharon celebrating her win" width={80} height={150} unoptimized /></>}</strong></div>
    </div>
    <p className="recap-result">{outcome === 'tie' ? 'A tie — evenly matched' : `${outcome === 'ben' ? 'Ben' : 'Sharon'} wins by ${margin(game)} points`}</p>
    <div className="recap-small-details"><p><b>Ben’s bingos:</b> {game.benBingos?.join(', ') || 'Not recorded'}</p><p><b>Sharon’s bingos:</b> {game.sharonBingos?.join(', ') || 'Not recorded'}</p><p>{game.firstPlayer ? `${game.firstPlayer === 'ben' ? 'Ben' : 'Sharon'} went first` : 'First player not recorded'}</p>{game.notes.trim() && <p className="recap-notes"><b>Notes:</b> {game.notes}</p>}</div>
  </section>;
}
