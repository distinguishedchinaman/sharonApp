'use client';
import { useEffect, useState } from 'react';

// Explicit EST offsets keep these moments identical on both phones, wherever they are.
const START = Date.parse('2026-02-12T20:30:00-05:00');
const ANNIVERSARY = Date.parse('2027-02-12T20:30:00-05:00');
export function AnniversaryTimer() {
  const [now, setNow] = useState<number | null>(null);
  const [countUp, setCountUp] = useState(false);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = setInterval(update, 1000);
    const initial = setTimeout(update, 0);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); clearTimeout(initial); document.removeEventListener('visibilitychange', update); };
  }, []);
  const minutes = now === null ? null : Math.floor(Math.max(0, countUp ? now - START : ANNIVERSARY - now) / 60_000);
  const days = minutes === null ? '—' : Math.floor(minutes / 1440);
  const hours = minutes === null ? '—' : Math.floor(minutes % 1440 / 60);
  const mins = minutes === null ? '—' : minutes % 60;
  const arrived = now !== null && now >= ANNIVERSARY;
  return <div className="anniversary-timer">
    <span className="anniversary-label">{countUp ? 'Our time together' : arrived ? 'Happy 1 year anniversary ♥' : 'Countdown to 1 year anniversary'}</span>
    <div className="anniversary-digits" role="timer" aria-label={`${days} days, ${hours} hours, ${mins} minutes`}>
      <span><strong>{days}</strong> days</span><span><strong>{hours}</strong> hours</span><span><strong>{mins}</strong> minutes</span>
    </div>
    <button type="button" className="anniversary-toggle" aria-pressed={countUp} onClick={() => setCountUp(value => !value)}>{countUp ? 'Show anniversary countdown' : 'Show our time together'}</button>
  </div>;
}
