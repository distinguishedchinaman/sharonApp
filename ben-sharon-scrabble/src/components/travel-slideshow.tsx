'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';

const photos = [
  { src: '/travel/travel-01.webp', position: '30% 20%', alt: 'Ben and Sharon enjoying a picnic together' },
  { src: '/travel/travel-02.webp', position: '50% 55%', alt: 'Sharon and Ben with their bicycles on a woodland trail' },
];

export function TravelSlideshow() {
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState<number[]>([]);
  const [fading, setFading] = useState(false);
  const [paused, setPaused] = useState(false);
  const next = (current + 1) % photos.length;
  const ready = loaded.includes(next);
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
      if (fading) { setCurrent(next); setFading(false); }
      else setFading(true);
    }, fading ? 1200 : 5800);
    return () => clearTimeout(timer);
  }, [ready, paused, fading, next]);
  return <div className="travel-slideshow" aria-label="Ben and Sharon’s travel photos">
    {[current, next].map(index => <Image key={photos[index].src} src={photos[index].src} alt={index === current ? photos[index].alt : ''} fill sizes="(max-width: 700px) 100vw, 45vw" loading={index === current ? 'eager' : 'lazy'} unoptimized className={`travel-slide ${index === next ? `travel-slide-next ${fading ? 'is-visible' : ''}` : ''}`} style={{ objectPosition: photos[index].position }} onLoad={() => setLoaded(values => values.includes(index) ? values : [...values, index])} />)}
    <button type="button" className="travel-pause" aria-label={paused ? 'Play travel slideshow' : 'Pause travel slideshow'} onClick={() => setPaused(value => !value)}>{paused ? '▶' : 'Ⅱ'}</button>
  </div>;
}
