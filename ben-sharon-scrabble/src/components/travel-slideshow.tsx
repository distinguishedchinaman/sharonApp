'use client';
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';

const photos = [
  { src: '/travel/travel-01.webp', position: '30% 20%', alt: 'Ben and Sharon enjoying a picnic together' },
  { src: '/travel/travel-02.webp', position: '50% 55%', alt: 'Sharon and Ben with their bicycles on a woodland trail' },
  { src: '/travel/travel-03.webp', position: '50% 35%', alt: 'Friends gathered around a dinner table' },
  { src: '/travel/travel-04.webp', position: '65% 45%', alt: 'Ben and Sharon playing Scrabble at a table' },
  { src: '/travel/travel-05.webp', position: '50% 55%', alt: 'Ben and Sharon posing together at an escape room' },
  { src: '/travel/travel-06.webp', position: '50% 25%', alt: 'Sharon enjoying a celebratory dessert' },
  { src: '/travel/travel-07.webp', position: '50% 35%', alt: 'Ben and Sharon enjoying a game in the kitchen' },
  { src: '/travel/travel-08.webp', position: '50% 40%', alt: 'Players posing together at a Scrabble event' },
  { src: '/travel/travel-09.webp', position: '35% 70%', alt: 'Sharon on a street beneath colorful neon signs' },
  { src: '/travel/travel-10.webp', position: '50% 35%', alt: 'Sharon and friends sharing a restaurant meal' },
  { src: '/travel/travel-11.webp', position: '50% 35%', alt: 'Friends enjoying dinner together' },
  { src: '/travel/travel-12.webp', position: '10% 30%', alt: 'Ben and Sharon playing Scrabble together indoors' },
  { src: '/travel/travel-13.webp', position: '25% 50%', alt: 'Ben and Sharon sharing a meal beside the water' },
  { src: '/travel/travel-14.webp', position: '45% 80%', alt: 'Ben beneath a flowering cherry tree' },
  { src: '/travel/travel-15.webp', position: '45% 65%', alt: 'Sharon beneath a flowering cherry tree' },
  { src: '/travel/travel-16.webp', position: '50% 65%', alt: 'Ben and Sharon taking a selfie by the water' },
  { src: '/travel/travel-17.webp', position: '50% 35%', alt: 'Ben and Sharon beside a river in the forest' },
];

function randomPhotoExcept(current: number) {
  const candidate = Math.floor(Math.random() * (photos.length - 1));
  return candidate >= current ? candidate + 1 : candidate;
}

export function TravelSlideshow() {
  const [selection, setSelection] = useState<{ current: number; next: number } | null>(null);
  const current = selection?.current ?? 0;
  const next = selection?.next ?? 1;
  const [loaded, setLoaded] = useState<number[]>([]);
  const [fading, setFading] = useState(false);
  const [paused, setPaused] = useState(false);
  const ready = selection !== null && loaded.includes(next);
  const advance = useCallback(() => {
    if (!ready) return;
    setSelection({ current: next, next: randomPhotoExcept(next) });
    setFading(false);
  }, [ready, next]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const first = Math.floor(Math.random() * photos.length);
      setSelection({ current: first, next: randomPhotoExcept(first) });
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPaused(media.matches || document.hidden);
    update();
    media.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => { media.removeEventListener('change', update); document.removeEventListener('visibilitychange', update); };
  }, []);
  useEffect(() => {
    if (!ready || paused) return;
    const timer = setTimeout(() => {
      if (fading) advance();
      else setFading(true);
    }, fading ? 1200 : 5800);
    return () => clearTimeout(timer);
  }, [ready, paused, fading, advance]);
  return <div className="travel-slideshow" aria-label="Ben and Sharon’s travel photos">
    {(selection ? [current, next] : []).map(index => <Image key={photos[index].src} src={photos[index].src} alt={index === current ? photos[index].alt : ''} fill sizes="(max-width: 700px) 100vw, 45vw" loading={index === current ? 'eager' : 'lazy'} unoptimized className={`travel-slide ${index === next ? `travel-slide-next ${fading ? 'is-visible' : ''}` : ''}`} style={{ objectPosition: photos[index].position }} onLoad={() => setLoaded(values => values.includes(index) ? values : [...values, index])} />)}
    <button type="button" className="travel-advance" aria-label="Show next travel photo" onClick={advance} disabled={!ready} />
    <button type="button" className="travel-pause" aria-label={paused ? 'Play travel slideshow' : 'Pause travel slideshow'} onClick={() => setPaused(value => !value)}>{paused ? '▶' : 'Ⅱ'}</button>
  </div>;
}
