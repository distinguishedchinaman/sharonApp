/* eslint-disable @next/next/no-img-element -- Embedded photos are resized before storage; no remote image delivery is used. */
'use client';
import { useState } from 'react';
import { Camera, Check, ChevronDown, LoaderCircle, Plus, X } from 'lucide-react';
import { Game, GamePhoto, gamePhotos, GAME_TYPES, GameType, localDate, PlayerId } from '@/lib/model';
import { validateGame } from '@/lib/validation';
import { localPhotoStorage } from '@/lib/photos';
import { Tile } from './ui';
export function GameEntry({ game, games, onSave, cloud = false }: { game?: Game; games: Game[]; cloud?: boolean; onSave: (game: Game) => Promise<void> }) {
  const [ben, setBen] = useState(game ? String(game.benScore) : '');
  const [sharon, setSharon] = useState(game ? String(game.sharonScore) : '');
  const [date, setDate] = useState(game?.date ?? localDate());
  const [location, setLocation] = useState(game?.location ?? '');
  const [gameType, setGameType] = useState<GameType>(game && GAME_TYPES.includes(game.gameType as never) ? game.gameType : 'In Person - Evening');
  const [first, setFirst] = useState<PlayerId | ''>(game?.firstPlayer ?? '');
  const [notes, setNotes] = useState(game?.notes ?? '');
  const [photos, setPhotos] = useState<GamePhoto[]>(game ? gamePhotos(game) : []);
  const [benBingos, setBenBingos] = useState(game?.benBingos?.join(', ') ?? '');
  const [sharonBingos, setSharonBingos] = useState(game?.sharonBingos?.join(', ') ?? '');
  const [optional, setOptional] = useState(!!game && !!(game.location || game.notes || game.photoUrl || game.firstPlayer || game.benBingos?.length || game.sharonBingos?.length || game.gameType !== 'In Person - Evening'));
  const [busy, setBusy] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [error, setError] = useState('');
  async function choosePhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])]; event.target.value = ''; if (!files.length) return;
    if (photos.length + files.length > 12) { setError('Choose up to 12 photos per game.'); return; }
    setProcessingPhoto(true); setError('');
    try {
      const additions: GamePhoto[] = [];
      for (const file of files) additions.push({ id: crypto.randomUUID(), photoUrl: await localPhotoStorage.prepare(file) });
      setPhotos(current => [...current, ...additions]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not read these photos.'); }
    finally { setProcessingPhoto(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (!ben.trim() || !sharon.trim()) throw new Error('Enter both scores to save your game.');
      const timestamp = new Date().toISOString();
      const next = validateGame({ id: game?.id ?? crypto.randomUUID(), date, benScore: Number(ben), sharonScore: Number(sharon), location: location.trim(), gameType, firstPlayer: first, notes: notes.trim(), photoUrl: photos[0]?.photoUrl ?? null, photoPath: photos[0]?.photoPath, additionalPhotos: photos.slice(1).map(p => ({ ...p, id: p.id === 'primary' ? crypto.randomUUID() : p.id })), benBingos: benBingos.split(/[,;\n]+/).map(w => w.trim()).filter(Boolean), sharonBingos: sharonBingos.split(/[,;\n]+/).map(w => w.trim()).filter(Boolean), isSample: game?.isSample ?? false, createdAt: game?.createdAt ?? timestamp, updatedAt: timestamp }, cloud);
      await onSave(next);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this game. Please try again.'); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="game-form">
    <label className="field date-field">Date<input aria-label="Date" type="date" value={date} required min="1900-01-01" max="2200-12-31" onChange={e => setDate(e.target.value)} /></label>
    <div className="score-inputs"><label className="score-input ben"><span><Tile letter="B" small points={3} />Ben’s score</span><input aria-label="Ben's score" autoFocus type="number" inputMode="numeric" min="0" max="9999" step="1" placeholder="0" required value={ben} onChange={e => setBen(e.target.value)} /></label><label className="score-input sharon"><span><Tile letter="S" small />Sharon’s score</span><input aria-label="Sharon's score" type="number" inputMode="numeric" min="0" max="9999" step="1" placeholder="0" required value={sharon} onChange={e => setSharon(e.target.value)} /></label></div>
    <div className="score-preview">{ben !== '' && sharon !== '' ? Number(ben) === Number(sharon) ? 'Perfectly matched. This one’s a tie.' : `${Number(ben) > Number(sharon) ? 'Ben' : 'Sharon'} wins by ${Math.abs(Number(ben) - Number(sharon))} points.` : ''}</div>
    <button className="optional-toggle" type="button" onClick={() => setOptional(!optional)} aria-expanded={optional}><Plus size={17} />Add a little more <span>location, bingos, photos</span><ChevronDown size={16} className={optional ? 'rotated' : ''} /></button>
    {optional && <div className="optional-fields"><div className="form-row"><label className="field">Location<input maxLength={120} placeholder="Where did you play?" list="locations" value={location} onChange={e => setLocation(e.target.value)} /><datalist id="locations">{[...new Set(games.map(g => g.location).filter(Boolean))].sort().map(l => <option key={l} value={l} />)}</datalist></label><label className="field">Game type<select aria-label="Game type" value={gameType} onChange={e => setGameType(e.target.value as GameType)}>{GAME_TYPES.map(t => <option key={t}>{t}</option>)}</select></label></div>
      <label className="field">Who went first?<select value={first} onChange={e => setFirst(e.target.value as PlayerId | '')}><option value="">Not recorded</option><option value="ben">Ben</option><option value="sharon">Sharon</option></select></label>
      <div className="form-row"><label className="field">Ben’s bingos<textarea aria-label="Ben's bingos" rows={2} maxLength={1600} placeholder="Words separated by commas; add * after phonies" value={benBingos} onChange={e => setBenBingos(e.target.value)} /></label><label className="field">Sharon’s bingos<textarea aria-label="Sharon's bingos" rows={2} maxLength={1600} placeholder="Words separated by commas; add * after phonies" value={sharonBingos} onChange={e => setSharonBingos(e.target.value)} /></label></div>
      <label className="field">A note to remember<textarea rows={3} maxLength={5000} placeholder="The brilliant word. The questionable challenge. The cup of tea." value={notes} onChange={e => setNotes(e.target.value)} /></label>
      <div className="entry-photo-grid">{photos.map((photo, index) => <div className="photo-preview" key={photo.id}>{photo.photoUrl ? <img src={photo.photoUrl} alt={`Game attachment ${index + 1}`} /> : <p>Saved photo</p>}<button type="button" className="icon-button" aria-label={index ? `Remove photo ${index + 1}` : 'Remove photo'} onClick={() => setPhotos(current => current.filter(p => p.id !== photo.id))}><X size={18} /></button></div>)}</div>
      {photos.length < 12 && <div className="photo-source-options">
        <label className="photo-upload"><Camera size={21} /><span>Take a photo<small>Use your camera</small></span><input aria-label="Take game photo" type="file" accept="image/*" capture="environment" disabled={processingPhoto || busy} onChange={choosePhotos} /></label>
        <label className="photo-upload"><Camera size={21} /><span>{processingPhoto ? 'Preparing your photos…' : 'Choose from camera roll'}<small>Photos & Live Photo stills · up to 12 photos</small></span><input aria-label="Game photo" type="file" multiple accept="image/*" disabled={processingPhoto || busy} onChange={choosePhotos} /></label>
      </div>}

    </div>}
    {error && <p role="alert" className="error-message">{error}</p>}
    <button className="button primary full-width save-game" disabled={busy || processingPhoto} type="submit">{busy ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}{game ? 'Save changes' : 'Save game'}</button><p className="form-footnote">{cloud ? 'Saved to your shared journal. Visible on both phones.' : 'Saved on this device. Yours to keep.'}</p>
  </form>;
}
