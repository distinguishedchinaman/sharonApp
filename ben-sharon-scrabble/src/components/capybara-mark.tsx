'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';

const poseCount = 25;
export function CapybaraMark() {
  const [pose, setPose] = useState<number | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setPose(Math.floor(Math.random() * poseCount)), 0);
    return () => clearTimeout(timer);
  }, []);
  function changePose() {
    if (pose === null) return;
    const random = Math.floor(Math.random() * (poseCount - 1));
    setPose(random >= pose ? random + 1 : random);
  }
  return <button type="button" className="capybara-mark" aria-label="Show another random capybara pose" title="Click for another capybara pose" onClick={changePose} disabled={pose === null}>
    {pose !== null && <Image src={`/capybara/pose-${String(pose + 1).padStart(2, '0')}.webp`} alt="Cute capybara in glasses and a teal sweater" width={160} height={160} unoptimized />}
  </button>;
}
