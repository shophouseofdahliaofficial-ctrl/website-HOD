'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

const CHARS = 'abcdefghijklmnopqrstuvwxyz';

interface ScrambleTextProps {
  text: string;
  className?: string;
}

/**
 * High-fashion typographic scramble / decode hover effect:
 * Rapidly scrambles through random characters for a few milliseconds
 * before resolving cleanly back to original text letter by letter.
 */
export default function ScrambleText({ text, className }: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setDisplayText(text);
  }, [text]);

  const triggerScramble = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    let frame = 0;
    const MAX_FRAMES = 6; // smooth flicker frames

    intervalRef.current = setInterval(() => {
      frame++;

      if (frame >= MAX_FRAMES) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplayText(text);
        return;
      }

      setDisplayText(
        text
          .split('')
          .map((char) => {
            if (char === ' ') return ' ';
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join('')
      );
    }, 40);
  }, [text]);

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
