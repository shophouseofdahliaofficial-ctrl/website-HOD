'use client';

import React, { useEffect, useState, useRef } from 'react';
import styles from './TopAmbientGlow.module.css';

export default function TopAmbientGlow() {
  const [activeKey, setActiveKey] = useState<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleTrigger = () => {
      // Clear any existing timer
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Generate a new key to restart CSS animation cleanly
      setActiveKey(Date.now());

      // Remove component after animation finishes (2.35s)
      timeoutRef.current = setTimeout(() => {
        setActiveKey(null);
      }, 2350);
    };

    window.addEventListener('trigger-top-red-glow', handleTrigger);
    return () => {
      window.removeEventListener('trigger-top-red-glow', handleTrigger);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!activeKey) return null;

  return (
    <div key={activeKey} className={styles.topGlowContainer} aria-hidden="true">
      <div className={styles.ambientAura} />
      <div className={styles.ambientCore} />
      <div className={styles.ambientWash} />
    </div>
  );
}
