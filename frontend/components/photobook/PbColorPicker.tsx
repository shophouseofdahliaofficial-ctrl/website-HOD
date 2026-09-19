'use client';

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from '../ProductDetailsModal.module.css';

const PICKER_WIDTH = 260;
const PICKER_HEIGHT = 300;
const WHEEL_SIZE = 200;
const RING_THICKNESS = 23;
const INNER_GAP = 4;
const INNER_DIAMETER = WHEEL_SIZE - (RING_THICKNESS + INNER_GAP) * 2;
const TRIANGLE_CANVAS_SIZE = INNER_DIAMETER;
const TRIANGLE_RADIUS = INNER_DIAMETER / 2 - 1;

type Point = { x: number; y: number };

function hexToRgb(hex: string) {
  const cleanHex = hex.replace(/^#/, '');
  let r = 0, g = 0, b = 0;
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.slice(0, 2), 16);
    g = parseInt(cleanHex.slice(2, 4), 16);
    b = parseInt(cleanHex.slice(4, 6), 16);
  }
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHsv(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

function hsvToRgb(h: number, s: number, v: number) {
  h /= 360;
  s /= 100;
  v /= 100;
  let r = 0, g = 0, b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function getTriangleVertices(cx: number, cy: number, radius: number, hueDeg: number) {
  // Hue 0° = north (top) to match CSS conic-gradient; increases clockwise on screen.
  const pointAt = (angleDeg: number): Point => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + radius * Math.sin(rad),
      y: cy - radius * Math.cos(rad),
    };
  };
  return {
    hue: pointAt(hueDeg),
    white: pointAt(hueDeg + 120),
    black: pointAt(hueDeg - 120),
  };
}

function barycentric(px: number, py: number, v0: Point, v1: Point, v2: Point) {
  const denom = (v1.y - v2.y) * (v0.x - v2.x) + (v2.x - v1.x) * (v0.y - v2.y);
  if (Math.abs(denom) < 0.0001) return { a: -1, b: -1, c: -1 };
  const a = ((v1.y - v2.y) * (px - v2.x) + (v2.x - v1.x) * (py - v2.y)) / denom;
  const b = ((v2.y - v0.y) * (px - v2.x) + (v0.x - v2.x) * (py - v2.y)) / denom;
  const c = 1 - a - b;
  return { a, b, c };
}

function svFromBarycentric(a: number, b: number) {
  return {
    s: Math.max(0, Math.min(100, Math.round(a * 100))),
    v: Math.max(0, Math.min(100, Math.round((a + b) * 100))),
  };
}

function barycentricFromSv(s: number, v: number) {
  const a = s / 100;
  const b = v / 100 - a;
  const c = 1 - a - b;
  return { a, b, c };
}

function pointFromBarycentric(bc: { a: number; b: number; c: number }, vHue: Point, vWhite: Point, vBlack: Point): Point {
  return {
    x: bc.a * vHue.x + bc.b * vWhite.x + bc.c * vBlack.x,
    y: bc.a * vHue.y + bc.b * vWhite.y + bc.c * vBlack.y,
  };
}

function renderSvTriangle(canvas: HTMLCanvasElement, hue: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = TRIANGLE_CANVAS_SIZE;
  canvas.width = size;
  canvas.height = size;
  const cx = size / 2;
  const cy = size / 2;
  const verts = getTriangleVertices(cx, cy, TRIANGLE_RADIUS, hue);
  const image = ctx.createImageData(size, size);
  const data = image.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const bc = barycentric(x, y, verts.hue, verts.white, verts.black);
      if (bc.a < 0 || bc.b < 0 || bc.c < 0) continue;
      const { s, v } = svFromBarycentric(bc.a, bc.b);
      const rgb = hsvToRgb(hue, s, v);
      const i = (y * size + x) * 4;
      data[i] = rgb.r;
      data[i + 1] = rgb.g;
      data[i + 2] = rgb.b;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
}

function computePickerPosition(
  anchorRect: DOMRect,
  align: PbColorPickerProps['align'],
): { top: number; left: number } {
  const gap = 8;
  const gapSide = 12;
  let top = 0;
  let left = 0;

  switch (align) {
    case 'bottom-left':
      top = anchorRect.bottom + gap;
      left = anchorRect.left;
      break;
    case 'bottom-right':
      top = anchorRect.bottom + gap;
      left = anchorRect.right - PICKER_WIDTH;
      break;
    case 'left':
      top = anchorRect.top;
      left = anchorRect.left - PICKER_WIDTH - gapSide;
      break;
    case 'top':
      top = anchorRect.top - PICKER_HEIGHT - gapSide;
      left = anchorRect.left + anchorRect.width / 2 - PICKER_WIDTH / 2;
      break;
    case 'right':
    default:
      top = anchorRect.top;
      left = anchorRect.right + gapSide;
      break;
  }

  const margin = 8;
  left = Math.max(margin, Math.min(left, window.innerWidth - PICKER_WIDTH - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - PICKER_HEIGHT - margin));
  return { top, left };
}

function readPhotobookTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  const root = document.querySelector('[data-photobook-editor]');
  return root?.getAttribute('data-pb-theme') === 'dark' ? 'dark' : 'light';
}

type DragMode = 'hue' | 'sv';

export interface PbColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  onPreview?: (color: string) => void;
  onClose: () => void;
  align?: 'right' | 'left' | 'top' | 'bottom-left' | 'bottom-right';
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export default function PbColorPicker({
  color,
  onChange,
  onPreview,
  onClose,
  align = 'right',
  anchorRef,
}: PbColorPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const triangleCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragModeRef = useRef<DragMode | null>(null);
  const pendingCommitRef = useRef<string | null>(null);
  const suppressCloseUntilRef = useRef(0);

  const defaultHex = color || '#000000';
  const initialRgb = hexToRgb(defaultHex);
  const initialHsv = rgbToHsv(initialRgb.r, initialRgb.g, initialRgb.b);

  const [h, setH] = useState(initialHsv.h);
  const [s, setS] = useState(initialHsv.s);
  const [v, setV] = useState(initialHsv.v);
  const [hexInput, setHexInput] = useState(defaultHex);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [floatingPos, setFloatingPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setTheme(readPhotobookTheme());
    const root = document.querySelector('[data-photobook-editor]');
    if (!root) return;
    const observer = new MutationObserver(() => setTheme(readPhotobookTheme()));
    observer.observe(root, { attributes: true, attributeFilter: ['data-pb-theme', 'class'] });
    return () => observer.disconnect();
  }, []);

  const updateFloatingPosition = useCallback(() => {
    const anchor = anchorRef?.current;
    if (!anchor) return;
    setFloatingPos(computePickerPosition(anchor.getBoundingClientRect(), align));
  }, [anchorRef, align]);

  useLayoutEffect(() => {
    updateFloatingPosition();
    window.addEventListener('resize', updateFloatingPosition);
    return () => window.removeEventListener('resize', updateFloatingPosition);
  }, [updateFloatingPosition]);

  useLayoutEffect(() => {
    if (!mounted) return;
    const canvas = triangleCanvasRef.current;
    if (canvas) renderSvTriangle(canvas, h);
  }, [h, mounted]);

  useEffect(() => {
    if (isInputFocused || dragModeRef.current) return;
    if (color && color.toUpperCase() !== hexInput.toUpperCase()) {
      const rgb = hexToRgb(color);
      const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
      setH(hsv.h);
      setS(hsv.s);
      setV(hsv.v);
      setHexInput(color.toUpperCase());
    }
  }, [color, isInputFocused, hexInput]);

  const onCloseRef = useRef(onClose);
  const onChangeRef = useRef(onChange);
  const onPreviewRef = useRef(onPreview);
  useEffect(() => {
    onCloseRef.current = onClose;
    onChangeRef.current = onChange;
    onPreviewRef.current = onPreview;
  }, [onClose, onChange, onPreview]);

  const commitColor = useCallback((hex: string) => {
    pendingCommitRef.current = null;
    onChangeRef.current(hex);
  }, []);

  const previewColor = useCallback((hex: string) => {
    pendingCommitRef.current = hex;
    setHexInput(hex);
    onPreviewRef.current?.(hex);
  }, []);

  const beginDrag = useCallback((mode: DragMode) => {
    dragModeRef.current = mode;
    setIsDragging(true);
    suppressCloseUntilRef.current = Date.now() + 500;
    document.body.setAttribute('data-pb-color-picker-interacting', 'true');
  }, []);

  const endDrag = useCallback(() => {
    dragModeRef.current = null;
    setIsDragging(false);
    suppressCloseUntilRef.current = Date.now() + 300;
    document.body.removeAttribute('data-pb-color-picker-interacting');
    if (pendingCommitRef.current) {
      commitColor(pendingCommitRef.current);
    }
  }, [commitColor]);

  useEffect(() => {
    return () => {
      document.body.removeAttribute('data-pb-color-picker-interacting');
    };
  }, []);

  useEffect(() => {
    const shouldIgnore = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (Date.now() < suppressCloseUntilRef.current) return true;
      if (dragModeRef.current) return true;
      if (document.body.hasAttribute('data-pb-color-picker-interacting')) return true;
      if (target.closest('[data-color-picker-root]')) return true;
      if (target.closest('[data-color-picker-toggle]')) return true;
      return false;
    };

    const handleOutside = (e: Event) => {
      if (shouldIgnore(e.target)) return;
      if (containerRef.current?.contains(e.target as Node)) return;
      onCloseRef.current();
    };

    document.addEventListener('pointerdown', handleOutside, true);
    return () => document.removeEventListener('pointerdown', handleOutside, true);
  }, []);

  const applyHsv = useCallback((nextH: number, nextS: number, nextV: number, commit: boolean) => {
    setH(nextH);
    setS(nextS);
    setV(nextV);
    const rgb = hsvToRgb(nextH, nextS, nextV);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    if (commit) {
      commitColor(hex);
    } else {
      previewColor(hex);
    }
  }, [commitColor, previewColor]);

  const getWheelMetrics = useCallback(() => {
    const rect = wheelRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const outerR = rect.width / 2;
    const innerR = outerR - RING_THICKNESS;
    return { cx, cy, outerR, innerR, rect };
  }, []);

  const getTriangleVertsInWheel = useCallback((cx: number, cy: number) => {
    const localCx = TRIANGLE_CANVAS_SIZE / 2;
    const localCy = TRIANGLE_CANVAS_SIZE / 2;
    const localVerts = getTriangleVertices(localCx, localCy, TRIANGLE_RADIUS, h);
    const toWheel = (p: Point): Point => ({
      x: cx + p.x - localCx,
      y: cy + p.y - localCy,
    });
    return {
      hue: toWheel(localVerts.hue),
      white: toWheel(localVerts.white),
      black: toWheel(localVerts.black),
    };
  }, [h]);

  const getDragModeAtPoint = useCallback((clientX: number, clientY: number): DragMode | null => {
    const metrics = getWheelMetrics();
    if (!metrics) return null;
    const { cx, cy, outerR, innerR } = metrics;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    
    // Generous Hue Ring click detection
    if (dist > innerR - 2 && dist <= outerR + 8) return 'hue';
    // SV click matches anywhere inside the inner circle bounds
    if (dist <= innerR - INNER_GAP) return 'sv';
    return null;
  }, [getWheelMetrics]);

  const updateFromPointer = useCallback((clientX: number, clientY: number, mode: DragMode) => {
    const metrics = getWheelMetrics();
    if (!metrics) return;
    const { cx, cy } = metrics;
    const dx = clientX - cx;
    const dy = clientY - cy;

    if (mode === 'hue') {
      // 0° = north (top), clockwise — matches CSS conic-gradient
      let angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      applyHsv(Math.round(angle), s, v, false);
      return;
    }

    const verts = getTriangleVertsInWheel(cx, cy);
    const bc = barycentric(clientX, clientY, verts.hue, verts.white, verts.black);
    
    // Clamp barycentric coordinates to the triangle bounds
    let a = Math.max(0, Math.min(1, bc.a));
    let b = Math.max(0, Math.min(1, bc.b));
    let c = Math.max(0, Math.min(1, bc.c));
    const sum = a + b + c;
    if (sum > 0) {
      a /= sum;
      b /= sum;
      c /= sum;
    } else {
      a = 0; b = 0; c = 1;
    }
    
    const { s: newS, v: newV } = svFromBarycentric(a, b);
    applyHsv(h, newS, newV, false);
  }, [applyHsv, getWheelMetrics, getTriangleVertsInWheel, h, s, v]);

  const handleWheelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const mode = getDragModeAtPoint(e.clientX, e.clientY);
    if (!mode) return;
    beginDrag(mode);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX, e.clientY, mode);
  };

  const handleWheelPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const mode = dragModeRef.current;
    if (!mode) return;
    e.preventDefault();
    e.stopPropagation();
    updateFromPointer(e.clientX, e.clientY, mode);
  };

  const handleWheelPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragModeRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    endDrag();
  };

  useEffect(() => {
    if (!isDragging) return;
    const onWindowPointerUp = () => endDrag();
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerUp);
    return () => {
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
    };
  }, [isDragging, endDrag]);

  const handleEyedropper = async () => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          const pickedHex = result.sRGBHex.toUpperCase();
          const rgb = hexToRgb(pickedHex);
          const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
          setH(hsv.h);
          setS(hsv.s);
          setV(hsv.v);
          setHexInput(pickedHex);
          commitColor(pickedHex);
        }
      } catch {
        /* cancelled */
      }
    } else {
      alert('Your browser does not support the eyedropper API. Please try Chrome, Edge, or Opera.');
    }
  };

  const handleHexInputChange = (val: string) => {
    setHexInput(val);
    let cleanVal = val.toUpperCase();
    if (!cleanVal.startsWith('#')) cleanVal = '#' + cleanVal;

    const isValid6Hex = /^#[0-9A-F]{6}$/i.test(cleanVal);
    const isValid3Hex = /^#[0-9A-F]{3}$/i.test(cleanVal);
    if (!isValid6Hex && !isValid3Hex) return;

    let finalHex = cleanVal;
    if (isValid3Hex) {
      finalHex = '#' + cleanVal[1] + cleanVal[1] + cleanVal[2] + cleanVal[2] + cleanVal[3] + cleanVal[3];
    }
    const rgb = hexToRgb(finalHex);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    setH(hsv.h);
    setS(hsv.s);
    setV(hsv.v);
    previewColor(finalHex);
  };

  const commitHexInput = () => {
    if (pendingCommitRef.current) {
      commitColor(pendingCommitRef.current);
      return;
    }
    let cleanVal = hexInput.toUpperCase();
    if (!cleanVal.startsWith('#')) cleanVal = '#' + cleanVal;
    if (/^#[0-9A-F]{6}$/i.test(cleanVal)) {
      commitColor(cleanVal);
    } else if (color) {
      setHexInput(color.toUpperCase());
    }
  };

  const activeRgb = hsvToRgb(h, s, v);
  const activeColor = rgbToHex(activeRgb.r, activeRgb.g, activeRgb.b);

  const hueRad = (h * Math.PI) / 180;
  const ringMidR = (WHEEL_SIZE - RING_THICKNESS) / 2;
  const hueCursorX = 50 + (Math.sin(hueRad) * ringMidR / WHEEL_SIZE) * 100;
  const hueCursorY = 50 - (Math.cos(hueRad) * ringMidR / WHEEL_SIZE) * 100;

  const localVerts = getTriangleVertices(TRIANGLE_CANVAS_SIZE / 2, TRIANGLE_CANVAS_SIZE / 2, TRIANGLE_RADIUS, h);
  const bc = barycentricFromSv(s, v);
  const svPoint = pointFromBarycentric(bc, localVerts.hue, localVerts.white, localVerts.black);
  const triangleOffset = (WHEEL_SIZE - TRIANGLE_CANVAS_SIZE) / 2;
  const svCursorX = ((triangleOffset + svPoint.x) / WHEEL_SIZE) * 100;
  const svCursorY = ((triangleOffset + svPoint.y) / WHEEL_SIZE) * 100;

  const stopPickerBubble = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const pickerNode = (
    <div
      ref={containerRef}
      data-color-picker-root="true"
      data-pb-theme={theme}
      className={`${styles.pbColorPickerContainer} ${styles.pbColorPickerFloating} ${styles.pbColorPickerRadial} ${theme === 'dark' ? styles.pbColorPickerFloatingDark : ''}`}
      style={floatingPos ? { top: floatingPos.top, left: floatingPos.left } : { visibility: 'hidden' }}
      onPointerDown={stopPickerBubble}
      onClick={stopPickerBubble}
      onMouseDown={stopPickerBubble}
    >
      <div
        ref={wheelRef}
        className={styles.pbColorPickerWheel}
        style={{ width: WHEEL_SIZE, height: WHEEL_SIZE, touchAction: 'none' }}
        onPointerDown={handleWheelPointerDown}
        onPointerMove={handleWheelPointerMove}
        onPointerUp={handleWheelPointerUp}
        onPointerCancel={handleWheelPointerUp}
      >
        <div className={styles.pbColorPickerWheelInner} aria-hidden="true" />
        <div className={styles.pbColorPickerHueRing} aria-hidden="true" />
        <canvas
          ref={triangleCanvasRef}
          className={styles.pbColorPickerSvTriangle}
          width={TRIANGLE_CANVAS_SIZE}
          height={TRIANGLE_CANVAS_SIZE}
          style={{ width: TRIANGLE_CANVAS_SIZE, height: TRIANGLE_CANVAS_SIZE }}
          aria-hidden="true"
        />
        <div
          className={styles.pbColorPickerHueCursor}
          style={{ left: `${hueCursorX}%`, top: `${hueCursorY}%` }}
          aria-hidden="true"
        />
        <div
          className={`${styles.pbColorPickerSvCursor} ${theme === 'dark' ? styles.pbColorPickerSvCursorDark : ''}`}
          style={{ left: `${svCursorX}%`, top: `${svCursorY}%` }}
          aria-hidden="true"
        />
      </div>

      <div className={styles.pbColorPickerControls}>
        <div className={styles.pbColorPickerControlsTop}>
          <button type="button" className={styles.pbColorPickerEyedropperBtn} onClick={handleEyedropper} title="Pick color from screen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.pbColorPickerEyedropperIcon}>
              <path d="m2 22 1-1c1-1 3-1 4 0l1 1" />
              <path d="M19 3a2.1 2.1 0 0 1 3 3L8 20H4v-4L19 3Z" />
            </svg>
          </button>
          <div className={styles.pbColorPickerSwatchCircle} style={{ backgroundColor: activeColor }} />
          <div className={styles.pbColorPickerInputGroup}>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => handleHexInputChange(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => {
                setIsInputFocused(false);
                commitHexInput();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitHexInput();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className={styles.pbColorPickerHexInput}
              maxLength={7}
              aria-label="Hex color value"
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(pickerNode, document.body);
}
