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
  speed?: 'slow' | 'normal' | 'fast' | 'ultra-fast';
}

/**
 * High-fashion typographic scramble / decode hover effect:
 * Scrambles through random characters with zero layout shift / jitter.
 * Each character slot width is strictly locked to the original character width using an invisible
 * normal-flow anchor and an absolute overlay, ensuring parent button width NEVER expands on hover.
 */
export default function ScrambleText({
  text,
  className,
  triggerOnChange = false,
  triggerKey,
  speed = 'normal',
}: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const triggerScramble = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    let frame = 0;
    // Slower, elegant, luxury editorial pacing
    const maxFrames =
      speed === 'ultra-fast'
        ? 6
        : speed === 'fast'
        ? 9
        : speed === 'slow'
        ? 15
        : 11; // 'normal' default

    const intervalTime =
      speed === 'ultra-fast'
        ? 28
        : speed === 'fast'
        ? 36
        : speed === 'slow'
        ? 52
        : 42; // 'normal' default

    intervalRef.current = setInterval(() => {
      frame++;

      if (frame >= maxFrames) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplayText(text);
        return;
      }

      const chars = text.split('');
      const resolvedCount = Math.floor(((frame - 2) / (maxFrames - 2)) * chars.length);

      setDisplayText(
        chars
          .map((char, index) => {
            if (char === ' ') return ' ';
            if (char === '.' || char === ',' || char === '-' || char === '/' || char === '!' || char === '?') return char;

            // Progressive decode: earlier letters settle smoothly towards the end
            if (frame > 2 && index < resolvedCount) {
              return char;
            }

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

  const origChars = Array.from(text);
  const dispChars = Array.from(displayText);

  return (
    <span
      className={className}
      onMouseEnter={triggerScramble}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        whiteSpace: 'nowrap',
        verticalAlign: 'baseline',
      }}
    >
      {origChars.map((origChar, i) => {
        const dispChar = dispChars[i] ?? origChar;
        const isSpace = origChar === ' ';

        if (isSpace) {
          return (
            <span key={i} style={{ display: 'inline-block', width: '0.28em' }}>
              &nbsp;
            </span>
          );
        }

        return (
          <span
            key={i}
            style={{
              position: 'relative',
              display: 'inline-block',
              verticalAlign: 'baseline',
              lineHeight: 'inherit',
              flexShrink: 0,
            }}
          >
            {/* Invisible original anchor char in normal document flow strictly holding exact width and height */}
            <span
              style={{
                opacity: 0,
                visibility: 'hidden',
                pointerEvents: 'none',
                userSelect: 'none',
                display: 'inline-block',
                lineHeight: 'inherit',
              }}
              aria-hidden="true"
            >
              {origChar}
            </span>

            {/* Scrambling visible char centered as absolute overlay. Zero width contribution, zero layout shift. */}
            <span
              style={{
                position: 'absolute',
                left: '50%',
                top: 0,
                bottom: 0,
                transform: 'translateX(-50%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                userSelect: 'none',
                lineHeight: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {dispChar}
            </span>
          </span>
        );
      })}
    </span>
  );
}
