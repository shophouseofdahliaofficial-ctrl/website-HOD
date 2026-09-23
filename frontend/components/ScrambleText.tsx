'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

const CHARS_LOWER = 'abcdefghijklmnopqrstuvwxyz';
const CHARS_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMS = '0123456789';

interface ScrambleTextProps {
  text: string;
  className?: string;
  triggerOnChange?: boolean;
  triggerKey?: string | number | null;
  speed?: 'normal' | 'fast' | 'ultra-fast';
}

/**
 * High-fashion typographic scramble / decode hover effect:
 * Rapidly scrambles through random characters before resolving cleanly back to original text.
 */
export default function ScrambleText({
  text,
  className,
  triggerOnChange = false,
  triggerKey,
  speed = 'fast',
}: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const triggerScramble = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    let frame = 0;
    const maxFrames = speed === 'ultra-fast' ? 3 : speed === 'fast' ? 4 : 6;
    const intervalTime = speed === 'ultra-fast' ? 15 : speed === 'fast' ? 18 : 25;

    intervalRef.current = setInterval(() => {
      frame++;

      if (frame >= maxFrames) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplayText(text);
        return;
      }

      setDisplayText(
        text
          .split('')
          .map((char) => {
            if (char === ' ') return ' ';
            if (char === '.' || char === ',' || char === '-' || char === '/') return char;
            if (/[A-Z]/.test(char)) {
              return CHARS_UPPER[Math.floor(Math.random() * CHARS_UPPER.length)];
            }
            if (/[0-9]/.test(char)) {
              return NUMS[Math.floor(Math.random() * NUMS.length)];
            }
            return CHARS_LOWER[Math.floor(Math.random() * CHARS_LOWER.length)];
          })
          .join('')
      );
    }, intervalTime);
  }, [text, speed]);

  useEffect(() => {
    if (triggerKey !== undefined && triggerKey !== null) {
      triggerScramble();
    } else if (triggerOnChange) {
      triggerScramble();
    } else {
      setDisplayText(text);
    }
  }, [text, triggerKey, triggerOnChange, triggerScramble]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <span
      className={className}
      onMouseEnter={triggerScramble}
      style={{ display: 'inline-block' }}
    >
      {displayText}
    </span>
  );
}
