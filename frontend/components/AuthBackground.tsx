'use client';

import { useState, useEffect } from 'react';
import styles from './AuthBackground.module.css';

const BG_IMAGES = [
  'https://plus.unsplash.com/premium_photo-1771772686698-63ddd4ad1fb0?q=80&w=378&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://plus.unsplash.com/premium_photo-1772375004476-d75916615a44?q=80&w=893&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://plus.unsplash.com/premium_photo-1770914038395-1c0ee5787834?q=80&w=875&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://plus.unsplash.com/premium_photo-1771673064534-49cd2af4b7c5?q=80&w=824&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
];

export default function AuthBackground() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Preload images in memory to guarantee zero blink on swap
    BG_IMAGES.forEach((src) => {
      if (typeof window !== 'undefined') {
        const img = new Image();
        img.src = src;
      }
    });

    setMounted(true);

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % BG_IMAGES.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.bgWrapper}>
      {BG_IMAGES.map((src, idx) => (
        <div
          key={src}
          className={`${styles.bgLayer} ${mounted && activeIndex === idx ? styles.activeLayer : ''}`}
          style={{ backgroundImage: `url('${src}')` }}
        />
      ))}
    </div>
  );
}
