/* eslint-disable @next/next/no-img-element -- Embedded photos are resized before storage; no remote image delivery is used. */
'use client';
import { useState } from 'react';
import { Camera, Check, ChevronDown, LoaderCircle, Plus, X } from 'lucide-react';
import { Game, GAME_TYPES, GameType, localDate, PlayerId } from '@/lib/model';
import { validateGame } from '@/lib/validation';
import { localPhotoStorage } from '@/lib/photos';
import { Tile } from './ui';
export function GameEntry({ game, games, onSave, cloud = false }: { game?: Game; games: Game[]; cloud?: boolean; onSave: (game: Game) => Promise<void> }) {
  const [ben, setBen] = useState(game ? String(game.benScore) : '');
  const [sharon, setSharon] = useState(game ? String(game.sharonScore) : '');
  const [date, setDate] = useState(game?.date ?? localDate());
  const [location, setLocation] = useState(game?.location ?? '');
  const [gameType, setGameType] = useState<GameType>(game?.gameType ?? 'Casual');
  const [first, setFirst] = useState<PlayerId | ''>(game?.firstPlayer ?? '');
  const [notes, setNotes] = useState(game?.notes ?? '');
  const [photo, setPhoto] = useState<string | null>(game?.photoUrl ?? null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [optional, setOptional] = useState(!!game && !!(game.location || game.notes || game.photoUrl || game.firstPlayer || game.gameType !== 'Casual'));
  const [busy, setBusy] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (!ben.trim() || !sharon.trim()) throw new Error('Enter both scores to save your game.');
      const timestamp = new Date().toISOString();
      const next = validateGame({ id: game?.id ?? crypto.randomUUID(), date, benScore: Number(ben), sharonScore: Number(sharon), location: location.trim(), gameType, firstPlayer: first, notes: notes.trim(), photoUrl: photo, photoPath: !photoRemoved && !photo?.startsWith('data:') ? game?.photoPath : undefined, isSample: game?.isSample ?? false, createdAt: game?.createdAt ?? timestamp, updatedAt: timestamp }, cloud);
      await onSave(next);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this game. Please try again.'); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="game-form">
    <label className="field date-field">Date<input aria-label="Date" type="date" value={date} required min="1900-01-01" max="2200-12-31" onChange={e => setDate(e.target.value)} /></label>
    <div className="score-inputs"><label className="score-input ben"><span><Tile letter="B" small points={3} />Ben’s score</span><input aria-label="Ben's score" autoFocus type="number" inputMode="numeric" min="0" max="9999" step="1" placeholder="0" required value={ben} onChange={e => setBen(e.target.value)} /></label><label className="score-input sharon"><span><Tile letter="S" small />Sharon’s score</span><input aria-label="Sharon's score" type="number" inputMode="numeric" min="0" max="9999" step="1" placeholder="0" required value={sharon} onChange={e => setSharon(e.target.value)} /></label></div>
    <div className="score-preview">{ben !== '' && sharon !== '' ? Number(ben) === Number(sharon) ? 'Perfectly matched. This one’s a tie.' : `${Number(ben) > Number(sharon) ? 'Ben' : 'Sharon'} wins by ${Math.abs(Number(ben) - Number(sharon))} points.` : 'A good game deserves a place in the journal.'}</div>
    <button className="optional-toggle" type="button" onClick={() => setOptional(!optional)} aria-expanded={optional}><Plus size={17} />Add a little more <span>location, notes, photo</span><ChevronDown size={16} className={optional ? 'rotated' : ''} /></button>
    {optional && <div className="optional-fields"><div className="form-row"><label className="field">Location<input maxLength={120} placeholder="Where did you play?" list="locations" value={location} onChange={e => setLocation(e.target.value)} /><datalist id="locations">{[...new Set(games.map(g => g.location).filter(Boolean))].sort().map(l => <option key={l} value={l} />)}</datalist></label><label className="field">Game type<select value={gameType} onChange={e => setGameType(e.target.value as GameType)}>{GAME_TYPES.map(t => <option key={t}>{t}</option>)}</select></label></div>
      <label className="field">Who went first?<select value={first} onChange={e => setFirst(e.target.value as PlayerId | '')}><option value="">Not recorded</option><option value="ben">Ben</option><option value="sharon">Sharon</option></select></label>
      <label className="field">A note to remember<textarea rows={3} maxLength={5000} placeholder="The brilliant word. The questionable challenge. The cup of tea." value={notes} onChange={e => setNotes(e.target.value)} /></label>
      {photo ? <div className="photo-preview"><img src={photo} alt="Photo attached to this game" /><button type="button" className="icon-button" aria-label="Remove photo" onClick={() => { setPhoto(null); setPhotoRemoved(true); }}><X size={18} /></button></div> : <label className="photo-upload"><Camera size={21} /><span>{processingPhoto ? 'Preparing your photo…' : 'Add a game photo'}<small>JPEG, PNG, or WebP · resized for your journal</small></span><input aria-label="Game photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={processingPhoto} onChange={async e => { const file = e.target.files?.[0]; if (!file) return; setProcessingPhoto(true); setError(''); try { setPhoto(await localPhotoStorage.prepare(file)); } catch (err) { setError(err instanceof Error ? err.message : 'Could not read this photo.'); } finally { setProcessingPhoto(false); } }} /></label>}
    </div>}
    {error && <p role="alert" className="error-message">{error}</p>}
    <button className="button primary full-width save-game" disabled={busy || processingPhoto} type="submit">{busy ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}{game ? 'Save changes' : 'Save game'}</button><p className="form-footnote">{cloud ? 'Saved to your shared journal. Visible on both phones.' : 'Saved on this device. Yours to keep.'}</p>
  </form>;
}
