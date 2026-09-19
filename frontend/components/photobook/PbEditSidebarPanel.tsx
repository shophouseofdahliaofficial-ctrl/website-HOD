'use client';

import { useState, useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode, RefObject } from 'react';
import PbCropIcon from './PbCropIcon';
import PbColorPicker from './PbColorPicker';
import type { PbFabricObjectEditMeta } from './canvas/objectMeta';
import {
  PB_FRAME_IMAGE_FILTERS,
  normalizeFrameImageFilter,
  type PbFrameImageStylePatch,
} from './canvas/frameImageStyle';
import { PB_DEFAULT_FRAME_BORDER_COLOR } from './canvas/frameMeta';
import { PB_LINE_DEFAULT_STROKE_WIDTH } from './canvas/customLines';
import type { PbFabricTextAlign, PbFabricTextStyle, PbFabricTextTransform } from './canvas/textStyle';
import styles from '../ProductDetailsModal.module.css';

type PbTipHandlers = {
  onMouseEnter: (e: ReactMouseEvent) => void;
  onMouseMove?: (e: ReactMouseEvent) => void;
  onMouseLeave: () => void;
};

export type PbEditHoverTarget = {
  pageId: string;
  meta: PbFabricObjectEditMeta;
};

export type PbBgSwatch = { name: string; value: string };

export type PbPhotobookFontOption = { name: string; family: string };

type PbPageBackgroundEdit = {
  swatches: PbBgSwatch[];
  activeBg: string;
  isCustomBgActive: boolean;
  customBgPickerValue: string;
  customBgInputRef: RefObject<HTMLInputElement>;
  onSelectBg: (color: string) => void;
};

type PbPageHeadlineEdit = {
  style: PbFabricTextStyle;
  text?: string;
  onApply: (patch: Partial<PbFabricTextStyle>) => void;
  onUpdateText?: (text: string) => void;
};

function normalizeHexColor(val: string): string | null {
  let hex = val.trim().toUpperCase();
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }
  if (/^[0-9A-F]{6}$/i.test(hex)) {
    return '#' + hex;
  }
  if (/^[0-9A-F]{3}$/i.test(hex)) {
    return '#' + hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  return null;
}

function figmaSliderBg(pct: number): string {
  return `linear-gradient(to right, var(--figma-slider-fill) 0%, var(--figma-slider-fill) ${pct}%, var(--figma-slider-track) ${pct}%, var(--figma-slider-track) 100%)`;
}

type PbEditSidebarPanelProps = {
  hover: PbEditHoverTarget | null;
  cropActive: boolean;
  frameAdjustActive?: boolean;
  frameAdjustZoom?: number;
  pageBackground?: PbPageBackgroundEdit | null;
  pageHeadlineEdit?: PbPageHeadlineEdit | null;
  fonts?: PbPhotobookFontOption[];
  pbTip?: (text: string) => PbTipHandlers;
  onFillColorChange: (color: string) => void;
  onApplyTextStyle: (patch: Partial<PbFabricTextStyle>, skipPersist?: boolean) => void;
  onApplyShapeStyle: (patch: Record<string, any>, skipPersist?: boolean) => void;
  onToggleLock: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCrop: () => void;
  onApplyCrop: () => void;
  onCancelCrop: () => void;
  onFrameAdjust?: () => void;
  onApplyFrameAdjust?: () => void;
  onCancelFrameAdjust?: () => void;
  onFrameAdjustZoomChange?: (scale: number) => void;
  onApplyFrameImageStyle?: (patch: PbFrameImageStylePatch, skipPersist?: boolean) => void;
};

function PbTextStyleControls({
  style: textStyle,
  fonts,
  pbTip,
  onApplyTextStyle,
  locked,
  onToggleLock,
  onDuplicate,
  isEmoji = false,
  showLetterSpacing = false,
}: {
  style: PbFabricTextStyle;
  fonts: PbPhotobookFontOption[];
  pbTip?: (text: string) => PbTipHandlers;
  onApplyTextStyle: (patch: Partial<PbFabricTextStyle>, skipPersist?: boolean) => void;
  locked?: boolean;
  onToggleLock?: () => void;
  onDuplicate?: () => void;
  isEmoji?: boolean;
  showLetterSpacing?: boolean;
}) {
  const tip = (text: string) => (pbTip ? pbTip(text) : {});
  const [activeDropdown, setActiveDropdown] = useState<'font' | 'weight' | 'size' | null>(null);
  const [fontSearch, setFontSearch] = useState('');
  const [activeColorPicker, setActiveColorPicker] = useState<'fill' | null>(null);
  const fillToggleRef = useRef<HTMLButtonElement>(null);

  const originalFontRef = useRef<string>(textStyle.fontFamily);
  const previewFontRef = useRef<string | null>(null);

  // Synchronize original font when activeDropdown is font
  useEffect(() => {
    if (activeDropdown === 'font') {
      originalFontRef.current = textStyle.fontFamily;
      previewFontRef.current = null;
    }
  }, [activeDropdown, textStyle.fontFamily]);

  // Revert preview on unmount
  useEffect(() => {
    return () => {
      if (previewFontRef.current !== null) {
        onApplyTextStyle({ fontFamily: originalFontRef.current }, true);
        previewFontRef.current = null;
      }
    };
  }, [onApplyTextStyle]);
  
  // Local state for hex input so typing/pasting works smoothly
  const [hexInput, setHexInput] = useState((textStyle.fill || '#000000').toUpperCase());
  const [isHexFocused, setIsHexFocused] = useState(false);
  
  useEffect(() => {
    if (!isHexFocused) {
      setHexInput((textStyle.fill || '#000000').toUpperCase());
    }
  }, [textStyle.fill, isHexFocused]);

  const matchedFont =
    fonts.find((f) => f.family === textStyle.fontFamily) ??
    fonts.find((f) => textStyle.fontFamily.includes(f.name));

  const filteredFonts = fonts.filter((f) =>
    fontSearch.trim()
      ? f.name.toLowerCase().includes(fontSearch.trim().toLowerCase())
      : true
  );

  useEffect(() => {
    if (!activeDropdown) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      let clickedInsideActive = false;
      if (activeDropdown === 'font') {
        clickedInsideActive = !!target.closest('.' + styles.figmaDropdownRow);
      } else if (activeDropdown === 'weight') {
        clickedInsideActive = !!target.closest('.' + styles.figmaSelectHalfWrapper);
      } else if (activeDropdown === 'size') {
        clickedInsideActive = !!target.closest('.' + styles.figmaInputGroupHalf);
      }
      
      if (!clickedInsideActive) {
        if (activeDropdown === 'font' && previewFontRef.current !== null) {
          onApplyTextStyle({ fontFamily: originalFontRef.current }, true);
          previewFontRef.current = null;
        }
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick, { capture: true });
    return () => document.removeEventListener('mousedown', handleOutsideClick, { capture: true });
  }, [activeDropdown, onApplyTextStyle]);

  const getWeightValue = () => {
    return textStyle.bold ? 'bold' : 'regular';
  };

  const handleWeightChange = (val: string) => {
    onApplyTextStyle({ bold: val === 'bold' });
  };

  const hexColor = (textStyle.fill || '#000000').toUpperCase();

  return (
    <div className={styles.figmaPanelWrapper}>
      
      {/* Fill Section */}
      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Fill</span>
        </div>
        
        <div className={styles.figmaFillRow}>
          <div className={styles.figmaFillLeft}>
            <div className={styles.figmaColorPreviewContainer} style={{ position: 'relative' }}>
              <button
                ref={fillToggleRef}
                type="button"
                className={styles.figmaColorPreviewWrap}
                onClick={() => !isEmoji && activeColorPicker !== 'fill' && setActiveColorPicker('fill')}
                disabled={isEmoji}
                style={isEmoji ? { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' } : undefined}
                aria-label="Fill color picker"
                data-color-picker-toggle="true"
              >
                <span className={styles.figmaColorSwatch} style={{ backgroundColor: textStyle.fill }} />
              </button>
              {activeColorPicker === 'fill' && (
                <PbColorPicker
                  anchorRef={fillToggleRef}
                  color={textStyle.fill}
                  onPreview={(c) => onApplyTextStyle({ fill: c }, true)}
                  onChange={(color) => onApplyTextStyle({ fill: color })}
                  onClose={() => setActiveColorPicker(null)}
                  align="bottom-left"
                />
              )}
            </div>
            
            <input
              type="text"
              value={hexInput}
              maxLength={7}
              onFocus={() => setIsHexFocused(true)}
              onBlur={() => {
                setIsHexFocused(false);
                const normalized = normalizeHexColor(hexInput);
                if (normalized) {
                  onApplyTextStyle({ fill: normalized });
                  setHexInput(normalized);
                } else {
                  setHexInput((textStyle.fill || '#000000').toUpperCase());
                }
              }}
              onChange={(e) => {
                const rawVal = e.target.value.toUpperCase();
                setHexInput(rawVal);
                const normalized = normalizeHexColor(rawVal);
                if (normalized) {
                  onApplyTextStyle({ fill: normalized });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const normalized = normalizeHexColor(hexInput);
                  if (normalized) {
                    onApplyTextStyle({ fill: normalized });
                    setHexInput(normalized);
                  } else {
                    setHexInput((textStyle.fill || '#000000').toUpperCase());
                  }
                  e.currentTarget.blur();
                }
              }}
              disabled={isEmoji}
              style={isEmoji ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              className={styles.figmaHexInput}
              aria-label="Hex color code"
            />
          </div>

          <div className={styles.figmaFillRight}>
            <div className={styles.figmaFillOpacity}>
              <button
                type="button"
                className={styles.figmaOpacityBtn}
                onClick={() => {
                  const currentVal = Math.round(textStyle.opacity * 100);
                  const nextVal = Math.max(0, currentVal - 10);
                  onApplyTextStyle({ opacity: nextVal / 100 });
                }}
                title="Decrease opacity"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <input
                type="text"
                value={`${Math.round(textStyle.opacity * 100)}%`}
                onChange={(e) => {
                  const val = parseInt(e.target.value.replace('%', ''));
                  if (Number.isFinite(val) && val >= 0 && val <= 100) {
                    onApplyTextStyle({ opacity: val / 100 });
                  }
                }}
                className={styles.figmaOpacityInput}
                aria-label="Fill opacity"
              />
              <button
                type="button"
                className={styles.figmaOpacityBtn}
                onClick={() => {
                  const currentVal = Math.round(textStyle.opacity * 100);
                  const nextVal = Math.min(100, currentVal + 10);
                  onApplyTextStyle({ opacity: nextVal / 100 });
                }}
                title="Increase opacity"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.figmaDivider} />

      {/* Typography Section */}
      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Typography</span>
        </div>

        {/* Font Family Dropdown */}
        <div className={styles.figmaDropdownRow} style={{ position: 'relative' }}>
          <button
            type="button"
            className={styles.figmaSelectBtn}
            onClick={() => {
              if (isEmoji) return;
              const next = activeDropdown === 'font' ? null : 'font';
              if (next === null && previewFontRef.current !== null) {
                onApplyTextStyle({ fontFamily: originalFontRef.current }, true);
                previewFontRef.current = null;
              }
              setActiveDropdown(next);
            }}
            disabled={isEmoji}
            style={isEmoji ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            aria-label={`Font family: ${matchedFont?.name ?? textStyle.fontFamily}`}
          >
            <span>{matchedFont?.name ?? textStyle.fontFamily}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: activeDropdown === 'font' ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          
          {activeDropdown === 'font' && (
            <div className={styles.customDropdownList}>
              <div className={styles.customDropdownSearch}>
                <input
                  type="text"
                  placeholder="Search fonts..."
                  value={fontSearch}
                  onChange={(e) => setFontSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className={styles.figmaSearchInput}
                  autoFocus
                />
              </div>
              <div className={styles.customDropdownOptions}
                onMouseLeave={() => {
                  if (previewFontRef.current !== null) {
                    onApplyTextStyle({ fontFamily: originalFontRef.current }, true);
                    previewFontRef.current = null;
                  }
                }}
              >
                {filteredFonts.map((font) => (
                  <div
                    key={font.name}
                    className={`${styles.customDropdownOption} ${textStyle.fontFamily === font.family ? styles.customDropdownOptionActive : ''}`}
                    onMouseEnter={() => {
                      onApplyTextStyle({ fontFamily: font.family }, true);
                      previewFontRef.current = font.family;
                    }}
                    onClick={() => {
                      // Commit the chosen font permanently
                      originalFontRef.current = font.family;
                      previewFontRef.current = null;
                      onApplyTextStyle({ fontFamily: font.family });
                      setActiveDropdown(null);
                      setFontSearch('');
                    }}
                    style={{ fontFamily: font.family }}
                  >
                    {font.name}
                  </div>
                ))}
                {filteredFonts.length === 0 && (
                  <div className={styles.figmaEmptyText}>No fonts found.</div>
                )}
              </div>
            </div>
          )}
        </div>
 
        {/* Weight & Size */}
        <div className={styles.figmaRow}>
          <div className={styles.figmaSelectHalfWrapper} style={{ position: 'relative' }}>
            <button
              type="button"
              className={styles.figmaSelectBtn}
              onClick={() => !isEmoji && setActiveDropdown(activeDropdown === 'weight' ? null : 'weight')}
              disabled={isEmoji}
              style={isEmoji ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              aria-label={`Font weight: ${getWeightValue()}`}
            >
              <span>{getWeightValue() === 'bold' ? 'Bold' : 'Regular'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: activeDropdown === 'weight' ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {activeDropdown === 'weight' && (
              <div className={styles.customDropdownList}>
                <div className={styles.customDropdownOptions}>
                  <div
                    className={`${styles.customDropdownOption} ${getWeightValue() === 'regular' ? styles.customDropdownOptionActive : ''}`}
                    onClick={() => {
                      handleWeightChange('regular');
                      setActiveDropdown(null);
                    }}
                  >
                    Regular
                  </div>
                  <div
                    className={`${styles.customDropdownOption} ${getWeightValue() === 'bold' ? styles.customDropdownOptionActive : ''}`}
                    onClick={() => {
                      handleWeightChange('bold');
                      setActiveDropdown(null);
                    }}
                  >
                    Bold
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={styles.figmaInputGroupHalf} style={{ position: 'relative' }}>
            <input
              type="text"
              value={Math.round(textStyle.fontSize)}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                const n = Number(val);
                if (n > 0) {
                  onApplyTextStyle({ fontSize: n });
                }
              }}
              className={styles.figmaInput}
              aria-label="Font size"
              style={{ paddingRight: '24px' }}
            />
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'size' ? null : 'size')}
              style={{
                position: 'absolute',
                right: '6px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: '#a3a3a3',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                padding: 0,
              }}
              aria-label="Toggle font size options"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: activeDropdown === 'size' ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {activeDropdown === 'size' && (
              <div className={styles.customDropdownList} style={{ width: '80px', right: 0, left: 'auto', maxHeight: '200px' }}>
                <div className={styles.customDropdownOptions}>
                  {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72, 96].map((size) => (
                    <div
                      key={size}
                      className={`${styles.customDropdownOption} ${Math.round(textStyle.fontSize) === size ? styles.customDropdownOptionActive : ''}`}
                      onClick={() => {
                        onApplyTextStyle({ fontSize: size });
                        setActiveDropdown(null);
                      }}
                    >
                      {size}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.figmaDivider} />

      {/* Style Section */}
      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Style</span>
        </div>
        <div className={styles.figmaRow}>
          <div className={styles.figmaButtonGroup}>
            <button
              type="button"
              className={`${styles.figmaAlignBtn} ${textStyle.underline ? styles.figmaAlignBtnActive : ''}`}
              onClick={() => onApplyTextStyle({ underline: !textStyle.underline })}
              aria-pressed={textStyle.underline}
              title="Underline"
            >
              U
            </button>
            <button
              type="button"
              className={`${styles.figmaAlignBtn} ${textStyle.strikethrough ? styles.figmaAlignBtnActive : ''}`}
              onClick={() => onApplyTextStyle({ strikethrough: !textStyle.strikethrough })}
              aria-pressed={textStyle.strikethrough}
              title="Strikethrough"
            >
              S
            </button>
            <button
              type="button"
              className={`${styles.figmaAlignBtn} ${textStyle.italic ? styles.figmaAlignBtnActive : ''}`}
              onClick={() => onApplyTextStyle({ italic: !textStyle.italic })}
              aria-pressed={textStyle.italic}
              title="Italic"
              style={{ fontStyle: 'italic' }}
            >
              I
            </button>
            <button
              type="button"
              className={`${styles.figmaAlignBtn} ${(textStyle.textTransform ?? 'none') !== 'none' ? styles.figmaAlignBtnActive : ''}`}
              onClick={() => {
                const textTransforms: PbFabricTextTransform[] = ['none', 'uppercase', 'lowercase', 'capitalize'];
                const currentTransform = textStyle.textTransform ?? 'none';
                const nextIndex = (textTransforms.indexOf(currentTransform) + 1) % textTransforms.length;
                const nextTransform = textTransforms[nextIndex];
                onApplyTextStyle({ textTransform: nextTransform });
              }}
              title={
                (textStyle.textTransform ?? 'none') === 'uppercase'
                  ? 'Uppercase'
                  : (textStyle.textTransform ?? 'none') === 'lowercase'
                  ? 'Lowercase'
                  : (textStyle.textTransform ?? 'none') === 'capitalize'
                  ? 'Capitalize'
                  : 'Text Transform'
              }
              aria-pressed={(textStyle.textTransform ?? 'none') !== 'none'}
              style={
                (textStyle.textTransform ?? 'none') === 'uppercase'
                  ? { textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '9px' }
                  : (textStyle.textTransform ?? 'none') === 'lowercase'
                  ? { textTransform: 'lowercase', letterSpacing: '0.04em', fontSize: '9px' }
                  : undefined
              }
            >
              {(() => {
                const currentTransform = textStyle.textTransform ?? 'none';
                if (currentTransform === 'uppercase') return 'AA';
                if (currentTransform === 'lowercase') return 'aa';
                if (currentTransform === 'capitalize') return 'Aa';
                return 'Ag';
              })()}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.figmaDivider} />

      {/* Alignment Section */}
      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Alignment</span>
        </div>
        <div className={styles.figmaRow}>
          <div className={styles.figmaButtonGroup}>
            {(
              [
                ['left', <svg key="left" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h10M4 18h14" /></svg>],
                ['center', <svg key="center" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M6 12h12M5 18h14" /></svg>],
                ['right', <svg key="right" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M10 12h10M6 18h14" /></svg>],
                ['justify', <svg key="justify" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>],
              ] as const
            ).map(([align, icon]) => (
              <button
                key={align}
                type="button"
                className={`${styles.figmaAlignBtn} ${textStyle.textAlign === align ? styles.figmaAlignBtnActive : ''}`}
                onClick={() => onApplyTextStyle({ textAlign: align as PbFabricTextAlign })}
                aria-pressed={textStyle.textAlign === align}
                title={`Align ${align}`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showLetterSpacing && (
        <>
          <div className={styles.figmaDivider} />

          {/* Letter Spacing Section */}
          <div className={styles.figmaSection}>
            <div className={styles.figmaSectionHeader}>
              <span className={styles.figmaSectionTitle}>Letter spacing</span>
            </div>
            {(() => {
              const letterSpacingVal = Math.round(textStyle.letterSpacing ?? 0);
              const letterSpacingPercent = Math.min(100, Math.max(0, ((letterSpacingVal + 100) / 200) * 100));
              const letterSpacingBg = figmaSliderBg(letterSpacingPercent);
              return (
                <div className={styles.figmaSliderContainer}>
                  <div className={styles.figmaSliderWrapper}>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={letterSpacingVal}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        onApplyTextStyle({ letterSpacing: n });
                      }}
                      disabled={locked}
                      className={styles.figmaSlider}
                      style={{ background: letterSpacingBg }}
                      aria-label="Letter spacing slider"
                    />
                    <div className={styles.figmaSliderValBox}>
                      {letterSpacingVal}px
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className={styles.figmaDivider} />

          {/* Line Height Section */}
          <div className={styles.figmaSection}>
            <div className={styles.figmaSectionHeader}>
              <span className={styles.figmaSectionTitle}>Line height</span>
            </div>
            {(() => {
              const lineHeightVal = textStyle.lineHeight ?? 1.16;
              const lineHeightPercent = Math.min(100, Math.max(0, ((lineHeightVal - 0.5) / 2.5) * 100));
              const lineHeightBg = figmaSliderBg(lineHeightPercent);
              return (
                <div className={styles.figmaSliderContainer}>
                  <div className={styles.figmaSliderWrapper}>
                    <input
                      type="range"
                      min="0.5"
                      max="3.0"
                      step="0.05"
                      value={lineHeightVal}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        onApplyTextStyle({ lineHeight: n });
                      }}
                      disabled={locked}
                      className={styles.figmaSlider}
                      style={{ background: lineHeightBg }}
                      aria-label="Line height slider"
                    />
                    <div className={styles.figmaSliderValBox}>
                      {lineHeightVal.toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      )}

      <div className={styles.figmaDivider} />

      {/* Options Section */}
      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Options</span>
        </div>
        <div className={styles.figmaRow}>
          <div className={styles.figmaButtonGroup}>
            {onToggleLock && (
              <button
                type="button"
                className={`${styles.figmaAlignBtn} ${locked ? styles.figmaAlignBtnActive : ''}`}
                onClick={onToggleLock}
                title={locked ? 'Unlock' : 'Lock'}
              >
                {locked ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 018 0v3" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 118 0v4" />
                  </svg>
                )}
              </button>
            )}
            {onDuplicate && (
              <button
                type="button"
                className={styles.figmaAlignBtn}
                onClick={onDuplicate}
                title="Duplicate"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}

function PbShapeStyleControls({
  meta,
  onApplyShapeStyle,
  locked,
  onToggleLock,
  onDuplicate,
  pbTip,
}: {
  meta: PbFabricObjectEditMeta;
  onApplyShapeStyle: (patch: Record<string, any>, skipPersist?: boolean) => void;
  locked?: boolean;
  onToggleLock?: () => void;
  onDuplicate?: () => void;
  pbTip?: (text: string) => PbTipHandlers;
}) {
  const tip = (text: string) => (pbTip ? pbTip(text) : {});
  const [activeDropdown, setActiveDropdown] = useState<'style' | null>(null);
  const [activeColorPicker, setActiveColorPicker] = useState<'fill' | 'stroke' | null>(null);
  const fillToggleRef = useRef<HTMLButtonElement>(null);
  const strokeToggleRef = useRef<HTMLButtonElement>(null);

  // Local state for hex inputs so typing/pasting works smoothly
  const [hexFillInput, setHexFillInput] = useState((meta.fill || '#3b82f6').toUpperCase());
  const [isHexFillFocused, setIsHexFillFocused] = useState(false);

  const [hexStrokeInput, setHexStrokeInput] = useState((meta.stroke || '#000000').toUpperCase());
  const [isHexStrokeFocused, setIsHexStrokeFocused] = useState(false);

  useEffect(() => {
    if (!isHexFillFocused) {
      setHexFillInput((meta.fill || '#3b82f6').toUpperCase());
    }
  }, [meta.fill, isHexFillFocused]);

  useEffect(() => {
    if (!isHexStrokeFocused) {
      setHexStrokeInput((meta.stroke || '#000000').toUpperCase());
    }
  }, [meta.stroke, isHexStrokeFocused]);

  const strokeDashArray = meta.strokeDashArray;

  const getBorderStyleLabel = () => {
    if (!strokeDashArray) return 'Solid';
    if (strokeDashArray[0] === 2) return 'More dashed';
    return 'Dashed';
  };

  const handleBorderStyleChange = (type: 'solid' | 'dashed' | 'moreDashed') => {
    if (type === 'solid') {
      onApplyShapeStyle({ strokeDashArray: null });
    } else if (type === 'dashed') {
      onApplyShapeStyle({ strokeDashArray: [6, 6] });
    } else if (type === 'moreDashed') {
      onApplyShapeStyle({ strokeDashArray: [2, 2] });
    }
    setActiveDropdown(null);
  };

  useEffect(() => {
    if (!activeDropdown) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const clickedInsideDropdown = !!target.closest('.' + styles.figmaFillRight);
      if (!clickedInsideDropdown) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick, { capture: true });
    return () => document.removeEventListener('mousedown', handleOutsideClick, { capture: true });
  }, [activeDropdown]);

  const hexFill = (meta.fill || '#3b82f6').toUpperCase();
  const hexStroke = (meta.stroke || '#000000').toUpperCase();

  return (
    <div className={styles.figmaPanelWrapper}>
      
      {/* Fill Color Section */}
      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Fill</span>
        </div>
        
        <div className={styles.figmaFillRow}>
          <div className={styles.figmaFillLeft} style={{ borderRadius: '50px' }}>
            <div className={styles.figmaColorPreviewContainer} style={{ position: 'relative' }}>
              <button
                ref={fillToggleRef}
                type="button"
                className={styles.figmaColorPreviewWrap}
                onClick={() => activeColorPicker !== 'fill' && setActiveColorPicker('fill')}
                aria-label="Fill color picker"
                data-color-picker-toggle="true"
              >
                <span className={styles.figmaColorSwatch} style={{ backgroundColor: meta.fill }} />
              </button>
              {activeColorPicker === 'fill' && (
                <PbColorPicker
                  anchorRef={fillToggleRef}
                  color={meta.fill || '#3b82f6'}
                  onPreview={(c) => onApplyShapeStyle({ fill: c }, true)}
                  onChange={(color) => onApplyShapeStyle({ fill: color })}
                  onClose={() => setActiveColorPicker(null)}
                  align="bottom-left"
                />
              )}
            </div>
            
            <input
              type="text"
              value={hexFillInput}
              maxLength={7}
              onFocus={() => setIsHexFillFocused(true)}
              onBlur={() => {
                setIsHexFillFocused(false);
                const normalized = normalizeHexColor(hexFillInput);
                if (normalized) {
                  onApplyShapeStyle({ fill: normalized });
                  setHexFillInput(normalized);
                } else {
                  setHexFillInput((meta.fill || '#3b82f6').toUpperCase());
                }
              }}
              onChange={(e) => {
                const rawVal = e.target.value.toUpperCase();
                setHexFillInput(rawVal);
                const normalized = normalizeHexColor(rawVal);
                if (normalized) {
                  onApplyShapeStyle({ fill: normalized });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const normalized = normalizeHexColor(hexFillInput);
                  if (normalized) {
                    onApplyShapeStyle({ fill: normalized });
                    setHexFillInput(normalized);
                  } else {
                    setHexFillInput((meta.fill || '#3b82f6').toUpperCase());
                  }
                  e.currentTarget.blur();
                }
              }}
              className={styles.figmaHexInput}
              aria-label="Fill hex code"
            />
          </div>
        </div>
      </div>

      <div className={styles.figmaDivider} />

      {/* Stroke / Border Section */}
      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Border Color</span>
        </div>

        {/* Stroke Color & Dash Style dropdown row */}
        <div className={styles.figmaFillRow} style={{ marginBottom: '0px' }}>
          <div className={styles.figmaFillLeft}>
            <div className={styles.figmaColorPreviewContainer} style={{ position: 'relative' }}>
              <button
                ref={strokeToggleRef}
                type="button"
                className={styles.figmaColorPreviewWrap}
                onClick={() => activeColorPicker !== 'stroke' && setActiveColorPicker('stroke')}
                aria-label="Stroke color picker"
                data-color-picker-toggle="true"
              >
                <span className={styles.figmaColorSwatch} style={{ backgroundColor: meta.stroke || '#000000' }} />
              </button>
              {activeColorPicker === 'stroke' && (
                <PbColorPicker
                  anchorRef={strokeToggleRef}
                  color={meta.stroke || '#000000'}
                  onPreview={(c) => onApplyShapeStyle({ stroke: c }, true)}
                  onChange={(color) => onApplyShapeStyle({ stroke: color })}
                  onClose={() => setActiveColorPicker(null)}
                  align="bottom-left"
                />
              )}
            </div>
            
            <input
              type="text"
              value={hexStrokeInput}
              maxLength={7}
              onFocus={() => setIsHexStrokeFocused(true)}
              onBlur={() => {
                setIsHexStrokeFocused(false);
                const normalized = normalizeHexColor(hexStrokeInput);
                if (normalized) {
                  onApplyShapeStyle({ stroke: normalized });
                  setHexStrokeInput(normalized);
                } else {
                  setHexStrokeInput((meta.stroke || '#000000').toUpperCase());
                }
              }}
              onChange={(e) => {
                const rawVal = e.target.value.toUpperCase();
                setHexStrokeInput(rawVal);
                const normalized = normalizeHexColor(rawVal);
                if (normalized) {
                  onApplyShapeStyle({ stroke: normalized });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const normalized = normalizeHexColor(hexStrokeInput);
                  if (normalized) {
                    onApplyShapeStyle({ stroke: normalized });
                    setHexStrokeInput(normalized);
                  } else {
                    setHexStrokeInput((meta.stroke || '#000000').toUpperCase());
                  }
                  e.currentTarget.blur();
                }
              }}
              className={styles.figmaHexInput}
              aria-label="Stroke hex code"
            />
          </div>

          <div className={styles.figmaFillRight} style={{ position: 'relative', width: '120px' }}>
            <button
              type="button"
              className={`${styles.figmaSelectBtn} ${styles.figmaSelectBtnBorderLeft}`}
              onClick={() => !meta.locked && setActiveDropdown(activeDropdown === 'style' ? null : 'style')}
              disabled={meta.locked}
              style={{
                borderRadius: '0px 55px 55px 0px',
                height: '38px',
                padding: '0 12px 0 16px',
              }}
              aria-label={`Border style: ${getBorderStyleLabel()}`}
            >
              <span>{getBorderStyleLabel()}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: activeDropdown === 'style' ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            
            {activeDropdown === 'style' && (
              <div className={styles.customDropdownList} style={{ width: '120px', right: 0, left: 'auto' }}>
                <div className={styles.customDropdownOptions}>
                  <div
                    className={`${styles.customDropdownOption} ${getBorderStyleLabel() === 'Solid' ? styles.customDropdownOptionActive : ''}`}
                    onClick={() => handleBorderStyleChange('solid')}
                  >
                    Solid
                  </div>
                  <div
                    className={`${styles.customDropdownOption} ${getBorderStyleLabel() === 'Dashed' ? styles.customDropdownOptionActive : ''}`}
                    onClick={() => handleBorderStyleChange('dashed')}
                  >
                    Dashed
                  </div>
                  <div
                    className={`${styles.customDropdownOption} ${getBorderStyleLabel() === 'More dashed' ? styles.customDropdownOptionActive : ''}`}
                    onClick={() => handleBorderStyleChange('moreDashed')}
                  >
                    More dashed
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.figmaDivider} />

      {/* Border Weight Section */}
      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Border Weight</span>
        </div>

        {/* Border Width (Stroke weight) range slider */}
        {(() => {
          const strokeWidthVal = Math.round(meta.strokeWidth ?? 0);
          const strokePercent = Math.min(100, Math.max(0, (strokeWidthVal / 30) * 100));
          const strokeBg = figmaSliderBg(strokePercent);
          return (
            <div className={styles.figmaSliderContainer}>
              <div className={styles.figmaSliderWrapper}>
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={strokeWidthVal}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    onApplyShapeStyle({ strokeWidth: n });
                  }}
                  disabled={meta.locked}
                  className={styles.figmaSlider}
                  style={{ background: strokeBg }}
                  aria-label="Border width slider"
                />
                <div className={styles.figmaSliderValBox}>
                  {strokeWidthVal}px
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {meta.objectType === 'rect' && (
        <>
          <div className={styles.figmaDivider} />
          {/* Border Radius Section */}
          <div className={styles.figmaSection}>
            <div className={styles.figmaSectionHeader}>
              <span className={styles.figmaSectionTitle}>Corner Radius</span>
            </div>
            {(() => {
              const rxVal = Math.round(meta.rx ?? 0);
              const rxPercent = Math.min(100, Math.max(0, rxVal));
              const rxBg = figmaSliderBg(rxPercent);
              return (
                <div className={styles.figmaSliderWrapper}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={rxVal}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      onApplyShapeStyle({ rx: n, ry: n });
                    }}
                    disabled={meta.locked}
                    className={styles.figmaSlider}
                    style={{ background: rxBg }}
                    aria-label="Corner radius slider"
                  />
                  <div className={styles.figmaSliderValBox}>
                    {rxVal}px
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      )}

      <div className={styles.figmaDivider} />

      {/* Options Section */}
      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Options</span>
        </div>
        <div className={styles.figmaRow}>
          <div className={styles.figmaButtonGroup}>
            {onToggleLock && (
              <button
                type="button"
                className={`${styles.figmaAlignBtn} ${locked ? styles.figmaAlignBtnActive : ''}`}
                onClick={onToggleLock}
                title={locked ? 'Unlock' : 'Lock'}
              >
                {locked ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 018 0v3" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 118 0v4" />
                  </svg>
                )}
              </button>
            )}
            {onDuplicate && (
              <button
                type="button"
                className={styles.figmaAlignBtn}
                onClick={onDuplicate}
                title="Duplicate"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getStartMarkerSvg(value: string) {
  switch (value) {
    case 'none':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="8" />
          <line x1="6.3" y1="6.3" x2="17.7" y2="17.7" />
        </svg>
      );
    case 'arrow':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 7l-5 5 5 5" />
          <line x1="4" y1="12" x2="19" y2="12" />
        </svg>
      );
    case 'circle':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="6" cy="12" r="3" />
          <line x1="9" y1="12" x2="19" y2="12" />
        </svg>
      );
    case 'square':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="9" width="6" height="6" />
          <line x1="10" y1="12" x2="19" y2="12" />
        </svg>
      );
    case 'diamond':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 8L3 12l4 4 4-4z" />
          <line x1="11" y1="12" x2="19" y2="12" />
        </svg>
      );
    case 'bar':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="5" y1="7" x2="5" y2="17" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
    case 'arrow-filled':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 7l-5 5 5 5Z" fill="currentColor" />
          <line x1="4" y1="12" x2="19" y2="12" />
        </svg>
      );
    case 'circle-filled':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="6" cy="12" r="3" fill="currentColor" />
          <line x1="6" y1="12" x2="19" y2="12" />
        </svg>
      );
    case 'square-filled':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="9" width="6" height="6" fill="currentColor" />
          <line x1="4" y1="12" x2="19" y2="12" />
        </svg>
      );
    case 'diamond-filled':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 8L3 12l4 4 4-4z" fill="currentColor" />
          <line x1="3" y1="12" x2="19" y2="12" />
        </svg>
      );
    default:
      return null;
  }
}

function getEndMarkerSvg(value: string) {
  switch (value) {
    case 'none':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="8" />
          <line x1="6.3" y1="6.3" x2="17.7" y2="17.7" />
        </svg>
      );
    case 'arrow':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 7l5 5-5 5" />
          <line x1="5" y1="12" x2="20" y2="12" />
        </svg>
      );
    case 'circle':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="18" cy="12" r="3" />
          <line x1="5" y1="12" x2="15" y2="12" />
        </svg>
      );
    case 'square':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="14" y="9" width="6" height="6" />
          <line x1="5" y1="12" x2="14" y2="12" />
        </svg>
      );
    case 'diamond':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 8l4 4-4 4-4-4z" />
          <line x1="5" y1="12" x2="13" y2="12" />
        </svg>
      );
    case 'bar':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="19" y1="7" x2="19" y2="17" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
    case 'arrow-filled':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 7l5 5-5 5Z" fill="currentColor" />
          <line x1="5" y1="12" x2="20" y2="12" />
        </svg>
      );
    case 'circle-filled':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="18" cy="12" r="3" fill="currentColor" />
          <line x1="5" y1="12" x2="18" y2="12" />
        </svg>
      );
    case 'square-filled':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="14" y="9" width="6" height="6" fill="currentColor" />
          <line x1="5" y1="12" x2="20" y2="12" />
        </svg>
      );
    case 'diamond-filled':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 8l4 4-4 4-4-4z" fill="currentColor" />
          <line x1="5" y1="12" x2="21" y2="12" />
        </svg>
      );
    default:
      return null;
  }
}

function PbLineStyleControls({
  meta,
  onApplyShapeStyle,
  locked,
  onToggleLock,
  onDuplicate,
  pbTip,
}: {
  meta: PbFabricObjectEditMeta;
  onApplyShapeStyle: (patch: Record<string, any>, skipPersist?: boolean) => void;
  locked?: boolean;
  onToggleLock?: () => void;
  onDuplicate?: () => void;
  pbTip?: (text: string) => PbTipHandlers;
}) {
  const tip = (text: string) => (pbTip ? pbTip(text) : {});
  const isTransparent = meta.stroke === 'transparent';
  const strokeDashArray = meta.strokeDashArray;
  const [activeColorPicker, setActiveColorPicker] = useState<'stroke' | null>(null);
  const lineColorToggleRef = useRef<HTMLButtonElement>(null);

  // Local state for hex input so typing/pasting works smoothly
  const [hexStrokeInput, setHexStrokeInput] = useState((meta.stroke && meta.stroke !== 'transparent' ? meta.stroke : '#ff1e68').toUpperCase());
  const [isHexStrokeFocused, setIsHexStrokeFocused] = useState(false);

  useEffect(() => {
    if (!isHexStrokeFocused) {
      setHexStrokeInput((meta.stroke && meta.stroke !== 'transparent' ? meta.stroke : '#ff1e68').toUpperCase());
    }
  }, [meta.stroke, isHexStrokeFocused]);

  const getActiveStyle = () => {
    if (isTransparent) return 'none';
    if (!strokeDashArray) return 'solid';
    if (strokeDashArray[0] === 14 || strokeDashArray[0] === 12) return 'long-dash';
    if (strokeDashArray[0] === 6) return 'medium-dash';
    return 'dotted';
  };

  const handleStyleSelect = (style: string) => {
    const fallbackColor = meta.stroke && meta.stroke !== 'transparent' ? meta.stroke : '#ff1e68';
    if (style === 'none') {
      onApplyShapeStyle({ stroke: 'transparent' });
    } else if (style === 'solid') {
      onApplyShapeStyle({ stroke: fallbackColor, strokeDashArray: null });
    } else if (style === 'long-dash') {
      onApplyShapeStyle({ stroke: fallbackColor, strokeDashArray: [14, 6] });
    } else if (style === 'medium-dash') {
      onApplyShapeStyle({ stroke: fallbackColor, strokeDashArray: [6, 4] });
    } else if (style === 'dotted') {
      onApplyShapeStyle({ stroke: fallbackColor, strokeDashArray: [2, 3] });
    }
  };

  const hexStroke = (meta.stroke || '#ff1e68').toUpperCase();

  const markerStyles = [
    { value: 'none', label: 'None' },
    { value: 'arrow', label: 'Arrow' },
    { value: 'circle', label: 'Circle' },
    { value: 'square', label: 'Square' },
    { value: 'diamond', label: 'Diamond' },
    { value: 'bar', label: 'Flat Bar' },
    { value: 'arrow-filled', label: 'Arrow Filled' },
    { value: 'circle-filled', label: 'Circle Filled' },
    { value: 'square-filled', label: 'Square Filled' },
    { value: 'diamond-filled', label: 'Diamond Filled' },
  ];

  const activeStyle = getActiveStyle();
  const isRounded = meta.strokeLineCap !== 'butt';

  return (
    <div className={styles.figmaPanelWrapper}>
      {/* Line Color Section */}
      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Line Color</span>
        </div>
        <div className={styles.figmaFillRow}>
          <div className={styles.figmaFillLeft}>
            <div className={styles.figmaColorPreviewContainer} style={{ position: 'relative' }}>
              <button
                ref={lineColorToggleRef}
                type="button"
                className={styles.figmaColorPreviewWrap}
                onClick={() => activeColorPicker !== 'stroke' && setActiveColorPicker('stroke')}
                aria-label="Line color picker"
                data-color-picker-toggle="true"
              >
                <span className={styles.figmaColorSwatch} style={{ backgroundColor: meta.stroke || '#ff1e68' }} />
              </button>
              {activeColorPicker === 'stroke' && (
                <PbColorPicker
                  anchorRef={lineColorToggleRef}
                  color={meta.stroke || '#ff1e68'}
                  onPreview={(c) => onApplyShapeStyle({ stroke: c }, true)}
                  onChange={(color) => onApplyShapeStyle({ stroke: color })}
                  onClose={() => setActiveColorPicker(null)}
                  align="bottom-left"
                />
              )}
            </div>
            <input
              type="text"
              value={hexStrokeInput}
              maxLength={7}
              onFocus={() => setIsHexStrokeFocused(true)}
              onBlur={() => {
                setIsHexStrokeFocused(false);
                const normalized = normalizeHexColor(hexStrokeInput);
                if (normalized) {
                  onApplyShapeStyle({ stroke: normalized });
                  setHexStrokeInput(normalized);
                } else {
                  setHexStrokeInput((meta.stroke && meta.stroke !== 'transparent' ? meta.stroke : '#ff1e68').toUpperCase());
                }
              }}
              onChange={(e) => {
                const rawVal = e.target.value.toUpperCase();
                setHexStrokeInput(rawVal);
                const normalized = normalizeHexColor(rawVal);
                if (normalized) {
                  onApplyShapeStyle({ stroke: normalized });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const normalized = normalizeHexColor(hexStrokeInput);
                  if (normalized) {
                    onApplyShapeStyle({ stroke: normalized });
                    setHexStrokeInput(normalized);
                  } else {
                    setHexStrokeInput((meta.stroke && meta.stroke !== 'transparent' ? meta.stroke : '#ff1e68').toUpperCase());
                  }
                  e.currentTarget.blur();
                }
              }}
              className={styles.figmaHexInput}
              aria-label="Line hex code"
            />
          </div>

          <div className={styles.figmaFillRight}>
            <div className={styles.figmaFillOpacity}>
              <button
                type="button"
                className={styles.figmaOpacityBtn}
                onClick={() => {
                  const currentVal = Math.round((meta.opacity ?? 1) * 100);
                  const nextVal = Math.max(0, currentVal - 10);
                  onApplyShapeStyle({ opacity: nextVal / 100 });
                }}
                title="Decrease opacity"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <input
                type="text"
                value={`${Math.round((meta.opacity ?? 1) * 100)}%`}
                onChange={(e) => {
                  const val = parseInt(e.target.value.replace('%', ''));
                  if (Number.isFinite(val) && val >= 0 && val <= 100) {
                    onApplyShapeStyle({ opacity: val / 100 });
                  }
                }}
                className={styles.figmaOpacityInput}
                aria-label="Line opacity"
              />
              <button
                type="button"
                className={styles.figmaOpacityBtn}
                onClick={() => {
                  const currentVal = Math.round((meta.opacity ?? 1) * 100);
                  const nextVal = Math.min(100, currentVal + 10);
                  onApplyShapeStyle({ opacity: nextVal / 100 });
                }}
                title="Increase opacity"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.figmaDivider} />

      {/* Style & End Caps Section */}
      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Style</span>
        </div>
        <div className={styles.figmaLineStyleGroup}>
          {[
            { key: 'solid', label: 'Solid', icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="4" y1="12" x2="20" y2="12" />
              </svg>
            )},
            { key: 'long-dash', label: 'Dashed', icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="12" x2="9" y2="12" />
                <line x1="15" y1="12" x2="21" y2="12" />
              </svg>
            )},
            { key: 'medium-dash', label: 'More Dashed', icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="12" x2="5.5" y2="12" />
                <line x1="10.5" y1="12" x2="13.5" y2="12" />
                <line x1="18.5" y1="12" x2="21" y2="12" />
              </svg>
            )},
            { key: 'dotted', label: 'Dotted', icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1, 5">
                <line x1="4" y1="12" x2="20" y2="12" />
              </svg>
            )},
          ].map((item) => {
            const isActive = activeStyle === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleStyleSelect(item.key)}
                className={`${styles.figmaLineOptionBtn} ${styles.figmaLineStyleBtn} ${isActive ? styles.figmaLineOptionBtnActive : ''}`}
                title={item.label}
              >
                {item.icon}
              </button>
            );
          })}
        </div>

        {/* Rounded Ends Toggle switch */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          padding: '6px 0',
          marginTop: '4px'
        }}>
          <span className={styles.figmaToggleLabel}>Rounded Ends</span>
          <button
            type="button"
            onClick={() => onApplyShapeStyle({ strokeLineCap: isRounded ? 'butt' : 'round' })}
            style={{
              width: '36px',
              height: '20px',
              borderRadius: '99px',
              backgroundColor: isRounded ? '#ef0035' : '#4d4d4d',
              position: 'relative',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              transition: 'background-color 0.2s ease',
              outline: 'none'
            }}
            aria-label="Toggle rounded ends"
            aria-pressed={isRounded}
          >
            <div style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              position: 'absolute',
              top: '3px',
              left: isRounded ? '19px' : '3px',
              transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }} />
          </button>
        </div>
      </div>

      <div className={styles.figmaDivider} />

      {/* Weight Section */}
      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Weight</span>
        </div>
        {(() => {
          const strokeWidthVal = Math.round(meta.strokeWidth ?? PB_LINE_DEFAULT_STROKE_WIDTH);
          const strokePercent = Math.min(100, Math.max(0, (strokeWidthVal / 30) * 100));
          const strokeBg = figmaSliderBg(strokePercent);
          return (
            <div className={styles.figmaSliderContainer}>
              <div className={styles.figmaSliderWrapper}>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={strokeWidthVal}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    onApplyShapeStyle({ strokeWidth: n });
                  }}
                  disabled={locked}
                  className={styles.figmaSlider}
                  style={{ background: strokeBg }}
                  aria-label="Line weight slider"
                />
                <div className={styles.figmaSliderValBox}>
                  {strokeWidthVal}px
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      <div className={styles.figmaDivider} />

      {/* Line Start Marker */}
      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Line Start</span>
        </div>
        <div className={styles.figmaLineMarkerGroup}>
          {markerStyles.map((item) => {
            const active = (meta.lineStartMarker || 'none') === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onApplyShapeStyle({ lineStartMarker: item.value })}
                className={`${styles.figmaLineOptionBtn} ${active ? styles.figmaLineOptionBtnActive : ''}`}
                title={item.label}
              >
                {getStartMarkerSvg(item.value)}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.figmaDivider} />

      {/* Line End Marker */}
      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Line End</span>
        </div>
        <div className={styles.figmaLineMarkerGroup}>
          {markerStyles.map((item) => {
            const active = (meta.lineEndMarker || 'none') === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onApplyShapeStyle({ lineEndMarker: item.value })}
                className={`${styles.figmaLineOptionBtn} ${active ? styles.figmaLineOptionBtnActive : ''}`}
                title={item.label}
              >
                {getEndMarkerSvg(item.value)}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.figmaDivider} />

      {/* Options Section */}
      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Options</span>
        </div>
        <div className={styles.figmaRow}>
          <div className={styles.figmaButtonGroup}>
            {onToggleLock && (
              <button
                type="button"
                className={`${styles.figmaAlignBtn} ${locked ? styles.figmaAlignBtnActive : ''}`}
                onClick={onToggleLock}
                title={locked ? 'Unlock' : 'Lock'}
              >
                {locked ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 018 0v3" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 118 0v4" />
                  </svg>
                )}
              </button>
            )}
            {onDuplicate && (
              <button
                type="button"
                className={styles.figmaAlignBtn}
                onClick={onDuplicate}
                title="Duplicate"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PbDrawingStyleControls({
  meta,
  onApplyShapeStyle,
  onFillColorChange,
  locked,
  onToggleLock,
  onDuplicate,
  pbTip,
}: {
  meta: PbFabricObjectEditMeta;
  onApplyShapeStyle: (patch: Record<string, any>, skipPersist?: boolean) => void;
  onFillColorChange: (color: string) => void;
  locked?: boolean;
  onToggleLock?: () => void;
  onDuplicate?: () => void;
  pbTip?: (text: string) => PbTipHandlers;
}) {
  const tip = (text: string) => (pbTip ? pbTip(text) : {});
  const [activeColorPicker, setActiveColorPicker] = useState<'stroke' | null>(null);
  const colorToggleRef = useRef<HTMLButtonElement>(null);

  // Local state for hex input so typing/pasting works smoothly
  const [hexColorInput, setHexColorInput] = useState((meta.fill || '#ff1e68').toUpperCase());
  const [isHexFocused, setIsHexFocused] = useState(false);

  useEffect(() => {
    if (!isHexFocused) {
      setHexColorInput((meta.fill || '#ff1e68').toUpperCase());
    }
  }, [meta.fill, isHexFocused]);

  const strokeWidthVal = meta.strokeWidth ?? 3;
  const strokeWidthPercent = Math.min(100, Math.max(0, ((strokeWidthVal - 1) / 49) * 100));
  const strokeWidthBg = `linear-gradient(to right, var(--pb-pink) 0%, var(--pb-pink) ${strokeWidthPercent}%, var(--pb-border) ${strokeWidthPercent}%, var(--pb-border) 100%)`;

  const opacityVal = Math.round((meta.opacity ?? 1) * 100);
  const opacityPercent = Math.min(100, Math.max(0, opacityVal));
  const opacityBg = `linear-gradient(to right, var(--pb-pink) 0%, var(--pb-pink) ${opacityPercent}%, var(--pb-border) ${opacityPercent}%, var(--pb-border) 100%)`;

  return (
    <div className={styles.figmaPanelWrapper}>
      {/* Color Section */}
      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Color</span>
        </div>
        <div className={styles.figmaFillRow}>
          <div className={styles.figmaFillLeft}>
            <div className={styles.figmaColorPreviewContainer} style={{ position: 'relative' }}>
              <button
                ref={colorToggleRef}
                type="button"
                className={styles.figmaColorPreviewWrap}
                onClick={() => activeColorPicker !== 'stroke' && setActiveColorPicker('stroke')}
                aria-label="Color picker"
                data-color-picker-toggle="true"
                disabled={locked}
              >
                <span className={styles.figmaColorSwatch} style={{ backgroundColor: meta.fill || '#ff1e68' }} />
              </button>
              {activeColorPicker === 'stroke' && (
                <PbColorPicker
                  anchorRef={colorToggleRef}
                  color={meta.fill || '#ff1e68'}
                  onPreview={(c) => onFillColorChange(c)}
                  onChange={(color) => onFillColorChange(color)}
                  onClose={() => setActiveColorPicker(null)}
                  align="bottom-left"
                />
              )}
            </div>
            <input
              type="text"
              value={hexColorInput}
              maxLength={7}
              onFocus={() => setIsHexFocused(true)}
              onBlur={() => {
                setIsHexFocused(false);
                const normalized = normalizeHexColor(hexColorInput);
                if (normalized) {
                  onFillColorChange(normalized);
                  setHexColorInput(normalized);
                } else {
                  setHexColorInput((meta.fill || '#ff1e68').toUpperCase());
                }
              }}
              onChange={(e) => {
                const rawVal = e.target.value.toUpperCase();
                setHexColorInput(rawVal);
                const normalized = normalizeHexColor(rawVal);
                if (normalized) {
                  onFillColorChange(normalized);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const normalized = normalizeHexColor(hexColorInput);
                  if (normalized) {
                    onFillColorChange(normalized);
                    setHexColorInput(normalized);
                  } else {
                    setHexColorInput((meta.fill || '#ff1e68').toUpperCase());
                  }
                  e.currentTarget.blur();
                }
              }}
              className={styles.figmaHexInput}
              disabled={locked}
              aria-label="Hex color code"
            />
          </div>

          <div className={styles.figmaFillRight}>
            <div className={styles.figmaFillOpacity}>
              <button
                type="button"
                className={styles.figmaOpacityBtn}
                onClick={() => {
                  const nextVal = Math.max(0, opacityVal - 10);
                  onApplyShapeStyle({ opacity: nextVal / 100 });
                }}
                disabled={locked}
                title="Decrease opacity"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <input
                type="text"
                value={`${opacityVal}%`}
                onChange={(e) => {
                  const val = parseInt(e.target.value.replace('%', ''));
                  if (Number.isFinite(val) && val >= 0 && val <= 100) {
                    onApplyShapeStyle({ opacity: val / 100 });
                  }
                }}
                disabled={locked}
                className={styles.figmaOpacityInput}
                aria-label="Opacity"
              />
              <button
                type="button"
                className={styles.figmaOpacityBtn}
                onClick={() => {
                  const nextVal = Math.min(100, opacityVal + 10);
                  onApplyShapeStyle({ opacity: nextVal / 100 });
                }}
                disabled={locked}
                title="Increase opacity"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.figmaDivider} />

      {/* Brush Size / Weight Section */}
      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Brush Size</span>
        </div>
        <div className={styles.figmaSliderRow}>
          <input
            type="range"
            min="1"
            max="50"
            step="1"
            value={strokeWidthVal}
            onChange={(e) => onApplyShapeStyle({ strokeWidth: Number(e.target.value) })}
            disabled={locked}
            className={styles.figmaSlider}
            style={{ background: strokeWidthBg }}
            aria-label="Brush size slider"
          />
          <div className={styles.figmaSliderValBox}>{strokeWidthVal}px</div>
        </div>
      </div>

      <div className={styles.figmaDivider} />

      {/* Options Section */}
      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Options</span>
        </div>
        <div className={styles.figmaRow}>
          <div className={styles.figmaButtonGroup}>
            {onToggleLock && (
              <button
                type="button"
                className={`${styles.figmaAlignBtn} ${locked ? styles.figmaAlignBtnActive : ''}`}
                onClick={onToggleLock}
                title={locked ? 'Unlock' : 'Lock'}
              >
                {locked ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 018 0v3" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 118 0v4" />
                  </svg>
                )}
              </button>
            )}
            {onDuplicate && (
              <button
                type="button"
                className={styles.figmaAlignBtn}
                onClick={onDuplicate}
                title="Duplicate"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PbFrameImageStyleControls({
  meta,
  onFrameAdjust,
  onApplyFrameImageStyle,
  isFloatingImage = false,
}: {
  meta: PbFabricObjectEditMeta;
  onFrameAdjust?: () => void;
  onApplyFrameImageStyle?: (patch: PbFrameImageStylePatch, skipPersist?: boolean) => void;
  isFloatingImage?: boolean;
}) {
  const angleVal = Math.round(meta.angle ?? 0);
  const radiusVal = Math.round(meta.frameCornerRadius ?? 0);
  const activeFilter = normalizeFrameImageFilter(meta.frameFilter);
  const frameBorderEnabled = meta.frameBorderEnabled === true;
  const borderPaddingVal = Math.round(meta.frameBorderPadding ?? 0);
  const borderColorVal = meta.frameBorderColor || PB_DEFAULT_FRAME_BORDER_COLOR;
  const borderWeightVal = Math.round(meta.frameBorderWeight ?? 2);
  const anglePercent = Math.min(100, Math.max(0, (angleVal / 360) * 100));
  const angleBg = figmaSliderBg(anglePercent);
  const radiusPercent = Math.min(100, Math.max(0, radiusVal));
  const radiusBg = figmaSliderBg(radiusPercent);
  const borderPaddingPercent = Math.min(100, Math.max(0, (borderPaddingVal / 80) * 100));
  const borderPaddingBg = figmaSliderBg(borderPaddingPercent);
  const borderWeightPercent = Math.min(100, Math.max(0, ((borderWeightVal - 1) / 23) * 100));
  const borderWeightBg = figmaSliderBg(borderWeightPercent);
  const [borderColorPickerOpen, setBorderColorPickerOpen] = useState(false);
  const borderColorToggleRef = useRef<HTMLButtonElement>(null);

  return (
    <div className={styles.figmaPanelWrapper}>
      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Image</span>
        </div>
        {onFrameAdjust ? (
          <button
            type="button"
            className={`${styles.pbEditActionBtn} ${styles.pbFrameImageAdjustBtn}`}
            onClick={onFrameAdjust}
          >
            <span className={styles.pbEditActionIcon} aria-hidden="true">
              <PbCropIcon size={18} />
            </span>
            <span>Adjust</span>
          </button>
        ) : null}
      </div>

      <div className={styles.figmaDivider} />

      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Rotate</span>
        </div>
        <div className={styles.figmaSliderRow}>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={angleVal}
            onChange={(e) => onApplyFrameImageStyle?.({ angle: Number(e.target.value) })}
            className={styles.figmaSlider}
            style={{ background: angleBg }}
            aria-label="Rotate image"
          />
          <div className={styles.figmaSliderValBox}>{angleVal}°</div>
        </div>
      </div>

      <div className={styles.figmaDivider} />

      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Filters</span>
        </div>
        <div className={styles.pbFrameImageFilterRow}>
          {PB_FRAME_IMAGE_FILTERS.map((filter) => {
            const isActive = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                className={`${styles.pbFrameImageFilterBtn} ${isActive ? styles.pbFrameImageFilterBtnActive : ''}`}
                onClick={() => onApplyFrameImageStyle?.({ frameFilter: filter.id })}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.figmaDivider} />

      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Border Radius</span>
        </div>
        <div className={styles.figmaSliderRow}>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={radiusVal}
            onChange={(e) => onApplyFrameImageStyle?.({ frameCornerRadius: Number(e.target.value) })}
            className={styles.figmaSlider}
            style={{ background: radiusBg }}
            aria-label="Frame corner radius"
          />
          <div className={styles.figmaSliderValBox}>{radiusVal}px</div>
        </div>
      </div>

      <div className={styles.figmaDivider} />

      <div className={styles.figmaSection}>
        <div className={styles.figmaSectionHeader}>
          <span className={styles.figmaSectionTitle}>Border Padding</span>
        </div>
        <div className={styles.figmaSliderRow}>
          <input
            type="range"
            min={0}
            max={80}
            step={1}
            value={borderPaddingVal}
            onChange={(e) => onApplyFrameImageStyle?.({ frameBorderPadding: Number(e.target.value) })}
            className={styles.figmaSlider}
            style={{ background: borderPaddingBg }}
            aria-label="Frame border padding"
          />
          <div className={styles.figmaSliderValBox}>{borderPaddingVal}px</div>
        </div>
      </div>

      {isFloatingImage ? (
        <div className={styles.pbImageBorderAdvancedHidden}>
          <div className={styles.figmaDivider} />

          <div className={styles.figmaSection}>
            <div className={styles.figmaSectionHeader}>
              <span className={styles.figmaSectionTitle}>Border Color</span>
            </div>
            <div className={styles.figmaColorPreviewContainer} style={{ position: 'relative' }}>
              <button
                ref={borderColorToggleRef}
                type="button"
                className={styles.figmaColorPreviewWrap}
                onClick={() => setBorderColorPickerOpen((open) => !open)}
                aria-label="Border color"
                data-color-picker-toggle="true"
              >
                <span className={styles.figmaColorSwatch} style={{ backgroundColor: borderColorVal }} />
              </button>
              {borderColorPickerOpen ? (
                <PbColorPicker
                  anchorRef={borderColorToggleRef}
                  color={borderColorVal}
                  onPreview={(color) => onApplyFrameImageStyle?.({ frameBorderColor: color })}
                  onChange={(color) => onApplyFrameImageStyle?.({ frameBorderColor: color })}
                  onClose={() => setBorderColorPickerOpen(false)}
                  align="bottom-left"
                />
              ) : null}
            </div>
          </div>

          <div className={styles.figmaDivider} />

          <div className={styles.figmaSection}>
            <div className={styles.figmaSectionHeader}>
              <span className={styles.figmaSectionTitle}>Border Weight</span>
            </div>
            <div className={styles.figmaSliderRow}>
              <input
                type="range"
                min={1}
                max={24}
                step={1}
                value={borderWeightVal}
                onChange={(e) => onApplyFrameImageStyle?.({ frameBorderWeight: Number(e.target.value) })}
                className={styles.figmaSlider}
                style={{ background: borderWeightBg }}
                aria-label="Border weight"
              />
              <div className={styles.figmaSliderValBox}>{borderWeightVal}px</div>
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.figmaDivider} />

      <div className={styles.figmaSection}>
        <div className={styles.figmaToggleRow}>
          <span className={styles.figmaToggleLabel}>Enable border frame?</span>
          <button
            type="button"
            className={`${styles.figmaToggleSwitch} ${frameBorderEnabled ? styles.figmaToggleSwitchActive : ''}`}
            onClick={() => onApplyFrameImageStyle?.({ frameBorderEnabled: !frameBorderEnabled })}
            aria-label="Toggle frame border"
            aria-pressed={frameBorderEnabled}
          >
            <span
              className={`${styles.figmaToggleKnob} ${frameBorderEnabled ? styles.figmaToggleKnobActive : ''}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function PbPageBackgroundSection({
  pageBackground,
}: {
  pageBackground: PbPageBackgroundEdit;
}) {
  const { swatches, activeBg, isCustomBgActive, customBgPickerValue, onSelectBg } =
    pageBackground;
  const [activeColorPicker, setActiveColorPicker] = useState(false);
  const customBgToggleRef = useRef<HTMLDivElement>(null);

  return (
    <div className={styles.pbEditPageBgSection}>
      <h4 className={styles.pbEditSectionTitle}>Page background</h4>
      <p className={styles.pbPanelDesc}>Background color for the selected page.</p>
      <div className={styles.pbBackgroundGrid}>
        {swatches.map((color) => (
          <div
            key={color.value}
            className={`${styles.pbBgSwatchWrapper} ${activeBg === color.value ? styles.pbBgSwatchWrapperActive : ''}`}
            onClick={() => onSelectBg(color.value)}
            title={color.name}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectBg(color.value);
              }
            }}
          >
            <div className={styles.pbBgSwatch} style={{ backgroundColor: color.value }} />
            <span className={styles.pbBgSwatchLabel}>{color.name}</span>
          </div>
        ))}
        <div
          ref={customBgToggleRef}
          className={`${styles.pbBgSwatchWrapper} ${isCustomBgActive ? styles.pbBgSwatchWrapperActive : ''}`}
          onClick={() => !activeColorPicker && setActiveColorPicker(true)}
          title="Custom color"
          data-color-picker-toggle="true"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setActiveColorPicker(true);
            }
          }}
          style={{ position: 'relative' }}
        >
          <div
            className={`${styles.pbBgSwatch} ${styles.pbBgSwatchCustom}`}
            style={isCustomBgActive ? { backgroundColor: activeBg } : undefined}
          />
          <span className={styles.pbBgSwatchLabel}>Custom</span>
          {activeColorPicker && (
            <PbColorPicker
              anchorRef={customBgToggleRef}
              color={customBgPickerValue}
              onPreview={(color) => onSelectBg(color)}
              onChange={(color) => onSelectBg(color)}
              onClose={() => setActiveColorPicker(false)}
              align="top"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function PbEditSidebarPanel({
  hover,
  cropActive,
  frameAdjustActive = false,
  frameAdjustZoom = 1,
  pageBackground,
  pageHeadlineEdit,
  fonts = [],
  pbTip,
  onFillColorChange,
  onApplyTextStyle,
  onApplyShapeStyle,
  onToggleLock,
  onDuplicate,
  onDelete,
  onCrop,
  onApplyCrop,
  onCancelCrop,
  onFrameAdjust,
  onApplyFrameAdjust,
  onCancelFrameAdjust,
  onFrameAdjustZoomChange,
  onApplyFrameImageStyle,
}: PbEditSidebarPanelProps) {
  const tip = (text: string) => (pbTip ? pbTip(text) : {});
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
  const objectColorToggleRef = useRef<HTMLButtonElement>(null);

  if (cropActive) {
    return (
      <div className={styles.pbSidebarPanel}>
        <h3 className={styles.pbPanelTitle}>Crop image</h3>
        <p className={styles.pbPanelDesc}>Drag the handles to adjust the crop area, then apply.</p>
        <div className={styles.pbEditActions}>
          <button
            type="button"
            className={`${styles.pbEditActionBtn} ${styles.pbEditActionBtnPrimary}`}
            onClick={onApplyCrop}
            {...tip('Apply crop')}
          >
            <span className={styles.pbEditActionIcon} aria-hidden="true">
              <PbCropIcon size={18} />
            </span>
            <span>Apply crop</span>
          </button>
          <button
            type="button"
            className={styles.pbEditActionBtn}
            onClick={onCancelCrop}
            {...tip('Cancel crop')}
          >
            <span>Cancel</span>
          </button>
        </div>
      </div>
    );
  }

  if (frameAdjustActive) {
    return (
      <div className={styles.pbSidebarPanel}>
        <h3 className={styles.pbPanelTitle}>Adjust image</h3>
        <p className={styles.pbPanelDesc}>
          Drag the image to reposition it inside the frame. Use the corner handles or zoom slider to scale.
        </p>
        <label className={styles.pbFrameCropZoomLabel}>
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={frameAdjustZoom}
            onChange={(e) => onFrameAdjustZoomChange?.(parseFloat(e.target.value))}
            className={styles.pbFrameCropZoomSlider}
          />
        </label>
        <div className={styles.pbEditActions}>
          <button
            type="button"
            className={`${styles.pbEditActionBtn} ${styles.pbEditActionBtnPrimary}`}
            onClick={onApplyFrameAdjust}
            {...tip('Done adjusting')}
          >
            <span className={styles.pbEditActionIcon} aria-hidden="true">
              <PbCropIcon size={18} />
            </span>
            <span>Done</span>
          </button>
          <button
            type="button"
            className={styles.pbEditActionBtn}
            onClick={onCancelFrameAdjust}
            {...tip('Cancel adjust')}
          >
            <span>Cancel</span>
          </button>
        </div>
      </div>
    );
  }

  if (!hover) {
    return (
      <div className={styles.pbSidebarPanel}>
        <h3 className={styles.pbPanelTitle}>Edit</h3>
        {pageHeadlineEdit ? (
          <>
            <div className={styles.pbPanelDesc}>
              <span className={styles.pbEditObjectType}>Page headline</span>
              {pageHeadlineEdit.onUpdateText && (
                <div className={styles.figmaInputGroup} style={{ marginTop: '8px', width: '100%', height: '32px' }}>
                  <input
                    type="text"
                    className={styles.figmaInput}
                    value={pageHeadlineEdit.text || ''}
                    onChange={(e) => {
                      pageHeadlineEdit.onUpdateText?.(e.target.value);
                    }}
                    style={{ paddingLeft: '8px' }}
                    placeholder="Edit headline text..."
                    aria-label="Edit headline text"
                  />
                </div>
              )}
            </div>
            <PbTextStyleControls
              style={pageHeadlineEdit.style}
              fonts={fonts}
              pbTip={pbTip}
              onApplyTextStyle={pageHeadlineEdit.onApply}
            />
          </>
        ) : pageBackground ? (
          <PbPageBackgroundSection pageBackground={pageBackground} />
        ) : (
          <p className={styles.pbPanelDesc}>
            Click on the canvas, or select an image, sticker, emoji, or text to edit here.
          </p>
        )}
      </div>
    );
  }

  const { meta } = hover;
  const isFramePhoto = meta.pbKind === 'frame-image';
  const isFloatingImage = meta.pbKind === 'image';
  const isCanvasImage = isFramePhoto || isFloatingImage;
  const isEmptyPhotoFrame = meta.pbKind === 'image-frame' && !meta.frameFilled;
  const deleteActionLabel = isCanvasImage ? 'Delete Image' : 'Delete';
  const isShape = meta.label === 'Shape';
  const isLine = meta.label === 'Line' || meta.pbKind === 'line';
  const isDrawing = meta.label === 'Drawing' || meta.pbKind === 'draw';
  const actions: Array<{
    key: string;
    label: string;
    node: ReactNode;
    delayMs: number;
  }> = [];

  if (meta.textStyle) {
    // Text styling is shown in the dedicated section below.
  } else if (meta.showColor && !isShape && !isLine && !isDrawing) {
    actions.push({
      key: 'color',
      label: 'Change color',
      delayMs: 0,
      node: (
        <div style={{ position: 'relative' }}>
          <button
            ref={objectColorToggleRef}
            type="button"
            className={styles.pbEditActionBtn}
            title="Change color"
            {...tip('Change color')}
            onClick={() => activeColorPicker !== 'object-color' && setActiveColorPicker('object-color')}
            data-color-picker-toggle="true"
          >
            <span className={styles.pbEditActionIcon} aria-hidden="true">
              <span className={styles.pbEditColorSwatch} style={{ backgroundColor: meta.fill }} />
            </span>
            <span>Color</span>
          </button>
          {activeColorPicker === 'object-color' && (
            <PbColorPicker
              anchorRef={objectColorToggleRef}
              color={meta.fill || '#000000'}
              onPreview={(color) => onFillColorChange(color)}
              onChange={(color) => onFillColorChange(color)}
              onClose={() => setActiveColorPicker(null)}
              align="bottom-left"
            />
          )}
        </div>
      ),
    });
  }

  if (meta.showCrop && !isCanvasImage) {
    actions.push({
      key: 'crop',
      label: 'Crop image',
      delayMs: 60,
      node: (
        <button type="button" className={styles.pbEditActionBtn} onClick={onCrop} {...tip('Crop image')}>
          <span className={styles.pbEditActionIcon} aria-hidden="true">
            <PbCropIcon size={18} />
          </span>
          <span>Crop</span>
        </button>
      ),
    });
  }

  if (!meta.textStyle && !isShape && !isLine && !isDrawing && !isCanvasImage && !isEmptyPhotoFrame) {
    actions.push({
      key: 'lock',
      label: meta.locked ? 'Unlock' : 'Lock',
      delayMs: 120,
      node: (
        <button type="button" className={styles.pbEditActionBtn} onClick={onToggleLock} {...tip(meta.locked ? 'Unlock' : 'Lock')}>
          <span className={styles.pbEditActionIcon} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {meta.locked ? (
                <>
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 018 0v3" />
                </>
              ) : (
                <>
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 118 0v4" />
                </>
              )}
            </svg>
          </span>
          <span>{meta.locked ? 'Unlock' : 'Lock'}</span>
        </button>
      ),
    });

    actions.push({
      key: 'duplicate',
      label: 'Duplicate',
      delayMs: 180,
      node: (
        <button type="button" className={styles.pbEditActionBtn} onClick={onDuplicate} {...tip('Duplicate')}>
          <span className={styles.pbEditActionIcon} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M4 16V6a2 2 0 012-2h10" />
            </svg>
          </span>
          <span>Duplicate</span>
        </button>
      ),
    });
  }

  if (!isEmptyPhotoFrame) {
    actions.push({
      key: 'delete',
      label: deleteActionLabel,
      delayMs: 240,
      node: (
        <button
          type="button"
          className={`${styles.pbEditActionBtn} ${styles.pbEditActionBtnDanger}`}
          onClick={onDelete}
        >
          <span className={styles.pbEditActionIcon} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </span>
          <span>{deleteActionLabel}</span>
        </button>
      ),
    });
  }

  return (
    <div className={styles.pbSidebarPanel}>
      <h3 className={styles.pbPanelTitle}>Edit</h3>
      <div className={styles.pbPanelDesc}>
        <span className={styles.pbEditObjectType}>{meta.label}</span>
        {meta.textStyle && meta.text !== undefined && (
          <div className={styles.figmaInputGroup} style={{ marginTop: '8px', width: '100%', height: '32px' }}>
            <input
              type="text"
              className={styles.figmaInput}
              value={meta.text || ''}
              onChange={(e) => {
                onApplyTextStyle({ text: e.target.value } as any);
              }}
              style={{ paddingLeft: '8px' }}
              placeholder="Edit text..."
              aria-label="Edit text"
            />
          </div>
        )}
      </div>

      {meta.textStyle ? (
        <PbTextStyleControls
          style={meta.textStyle}
          fonts={fonts}
          pbTip={pbTip}
          onApplyTextStyle={onApplyTextStyle}
          locked={meta.locked}
          onToggleLock={onToggleLock}
          onDuplicate={onDuplicate}
          isEmoji={meta.pbKind === 'emoji'}
          showLetterSpacing={meta.pbKind !== 'emoji'}
        />
      ) : null}

      {isCanvasImage ? (
        <PbFrameImageStyleControls
          meta={meta}
          onFrameAdjust={isFramePhoto ? onFrameAdjust : onCrop}
          onApplyFrameImageStyle={onApplyFrameImageStyle}
          isFloatingImage={isFloatingImage}
        />
      ) : null}

      {isShape ? (
        <PbShapeStyleControls
          meta={meta}
          onApplyShapeStyle={onApplyShapeStyle}
          locked={meta.locked}
          onToggleLock={onToggleLock}
          onDuplicate={onDuplicate}
          pbTip={pbTip}
        />
      ) : null}

      {isLine ? (
        <PbLineStyleControls
          meta={meta}
          onApplyShapeStyle={onApplyShapeStyle}
          locked={meta.locked}
          onToggleLock={onToggleLock}
          onDuplicate={onDuplicate}
          pbTip={pbTip}
        />
      ) : null}

      {isDrawing ? (
        <PbDrawingStyleControls
          meta={meta}
          onApplyShapeStyle={onApplyShapeStyle}
          onFillColorChange={onFillColorChange}
          locked={meta.locked}
          onToggleLock={onToggleLock}
          onDuplicate={onDuplicate}
          pbTip={pbTip}
        />
      ) : null}

      <div className={styles.pbEditActions}>
        {actions.map((action) => (
          <div
            key={action.key}
            className={styles.pbEditActionItem}
            style={{ animationDelay: `${action.delayMs}ms` }}
          >
            {action.node}
          </div>
        ))}
      </div>
    </div>
  );
}
