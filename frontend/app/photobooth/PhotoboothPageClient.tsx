'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Instrument_Serif } from 'next/font/google';
import FrameOptionsScrollRow from '@/components/photobooth/FrameOptionsScrollRow';
import PhotoboothHero from '@/components/photobooth/PhotoboothHero';
import styles from './page.module.css';
import heroStyles from '@/components/photobooth/photobooth.module.css';
import Logo from '@/components/Logo';
import {
  applyCanvasBakedFilter,
  captureCanvasBakedStill,
  INST_C_CSS_PREVIEW,
  INST_SQ_CSS_PREVIEW,
  INST_SQC_CSS_PREVIEW,
  CLASSIC_U_CSS_PREVIEW,
  isCanvasBakedFilter,
} from '@/lib/photobooth/film';
import { DemoFeedPreview, LiveCameraFeed } from '@/components/photobooth/InstCLivePreview';
import {
  buildPngBlob,
  buildZipBlob,
  downloadBlob,
  keepsakeEntryFilename,
  keepsakeZipFilename,
} from '@/lib/photobooth/downloadKeepsakesZip';
import { generateKeepsakeDataUrl, KEEPSAKE_DOWNLOAD_SCALE } from '@/lib/photobooth/generateKeepsake';
import {
  PRINT_PRICE_PER_POLAROID,
  calculatePrintOrderTotal,
} from '@/lib/photobooth/purchaseConstants';
import { clearPendingPurchase } from '@/lib/photobooth/pendingPurchase';
import { prepareGuestPhotoboothForCart } from '@/lib/photobooth/guestPurchase';
import {
  executePhotoboothPurchase,
  rollbackPhotoboothProject,
  type PurchaseProgress,
} from '@/lib/photobooth/purchaseFlow';
import type { PhotoboothProjectJson } from '@/lib/photobooth/projectTypes';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import PhotoboothPurchaseProgress from '@/components/photobooth/PhotoboothPurchaseProgress';
import { contentApi } from '@/lib/api';

const COMPLETION_PRINTER_IMAGE = '/ChatGPT Image Jun 4, 2026, 10_49_24 PM.png';
const PRINT_CAROUSEL_PAGE_SIZE = 3;

/** Sample photo used when demo polaroid feed toggle is enabled (replaces live webcam). */
const DEMO_POLAROID_FEED_URL =
  'https://res.cloudinary.com/djihr7crd/image/upload/v1781238197/photo_2026-06-12_09-46-51_cftjbn.jpg';

type CompletionSequenceStep =
  | 'idle'
  | 'exit'
  | 'printer'
  | 'print'
  | 'done';

const SEQUENCE_STEPS: CompletionSequenceStep[] = [
  'idle', 'exit', 'printer', 'print', 'done',
];

const isSequenceAtOrPast = (current: CompletionSequenceStep, target: CompletionSequenceStep) =>
  SEQUENCE_STEPS.indexOf(current) >= SEQUENCE_STEPS.indexOf(target);

const getStackMergeOffset = (idx: number) => {
  const col = idx % 3;
  const row = Math.floor(idx / 3);
  const x = (col - 1) * 115;
  const y = row * 105;
  return { x: `${x}%`, y: `${y}%` };
};

const STRIP_SLOT_COUNT = 3;

type CapturedPhotoItem = {
  url: string;
  filterId: string;
  frameId?: number;
  stripSlotUrls?: [string, string, string];
};

const createEmptyStripSlots = (): (CapturedPhotoItem | null)[] =>
  Array.from({ length: STRIP_SLOT_COUNT }, () => null);

const createEmptyStripCollection = (count: number) =>
  Array.from({ length: count }, () => createEmptyStripSlots());

const isStripComplete = (
  slots: (CapturedPhotoItem | null)[] | undefined | null,
): slots is [CapturedPhotoItem, CapturedPhotoItem, CapturedPhotoItem] =>
  Array.isArray(slots) && slots.length === STRIP_SLOT_COUNT && slots.every((slot) => slot != null);

const getFirstEmptyStripSlot = (slots: (CapturedPhotoItem | null)[] | undefined | null) => {
  const normalized = Array.isArray(slots) ? slots : createEmptyStripSlots();
  const emptyIdx = normalized.findIndex((slot) => slot == null);
  return emptyIdx === -1 ? STRIP_SLOT_COUNT - 1 : emptyIdx;
};

const buildStripCapturedPhoto = (
  slots: [CapturedPhotoItem, CapturedPhotoItem, CapturedPhotoItem],
  frameId: number,
): CapturedPhotoItem => ({
  url: slots[0].url,
  filterId: slots[0].filterId,
  frameId,
  stripSlotUrls: [slots[0].url, slots[1].url, slots[2].url],
});

const stripSlotsMatchCaptured = (
  slots: (CapturedPhotoItem | null)[],
  captured: CapturedPhotoItem,
): boolean => {
  if (!captured.stripSlotUrls || !isStripComplete(slots)) return false;
  return captured.stripSlotUrls.every((url, slotIdx) => slots[slotIdx]?.url === url);
};

const buildKeepsakePhotosFromState = (
  selectedVibe: string | null,
  capturedPhotos: (CapturedPhotoItem | null)[],
  stripSlotPhotos: (CapturedPhotoItem | null)[][],
  cardFrames: number[],
  selectedFrame: number,
  quantity: number,
): CapturedPhotoItem[] => {
  if (selectedVibe === 'strip') {
    const stripCount = Math.max(quantity, capturedPhotos.length, stripSlotPhotos.length);
    const photos: CapturedPhotoItem[] = [];

    for (let idx = 0; idx < stripCount; idx += 1) {
      const slots = stripSlotPhotos[idx] ?? createEmptyStripSlots();
      if (!isStripComplete(slots)) continue;

      const frameId = cardFrames[idx] ?? capturedPhotos[idx]?.frameId ?? selectedFrame;
      const captured = capturedPhotos[idx];
      const completeSlots = slots as [CapturedPhotoItem, CapturedPhotoItem, CapturedPhotoItem];

      if (captured?.stripSlotUrls && stripSlotsMatchCaptured(slots, captured)) {
        photos.push({
          url: captured.url,
          filterId: captured.filterId,
          frameId,
          stripSlotUrls: [
            captured.stripSlotUrls[0],
            captured.stripSlotUrls[1],
            captured.stripSlotUrls[2],
          ],
        });
      } else {
        photos.push(buildStripCapturedPhoto(completeSlots, frameId));
      }
    }

    return photos;
  }
  return capturedPhotos.filter((photo): photo is CapturedPhotoItem => photo !== null);
};

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: 'italic',
  display: 'swap',
});

const steps = [
  {
    id: 1,
    title: "1. Choose Your Vibe",
    body: "Start with the perfect frame either strips or polaroids. Pick a Polaroid style that matches the mood of your memory.",
    image: "/polaroid_choices.png",
    align: "left"
  },
  {
    id: 2,
    title: "2. Bring Your Photo In",
    body: "Click your favorite shot and watch it seamlessly become part of your chosen Polaroid.",
    image: "https://images.unsplash.com/photo-1719985968573-2f002f676a30?q=80&w=388&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    align: "right"
  },
  {
    id: 3,
    title: "3. Enhance the Moment",
    body: "Apply carefully crafted filters and effects to give your photo its own unique character.",
    image: "/polaroid_enhanced.png",
    align: "left"
  },
  {
    id: 4,
    title: "4. Make It Truly Yours",
    body: "Add the finishing touches with custom text, colors, stickers, and personal details.",
    image: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600&q=80",
    align: "right"
  }
];

const vibes = [
  {
    id: 'polaroid',
    name: 'Retro Polaroid',
    description: 'The timeless classic. A square photo with the iconic wide white margin at the bottom.',
    images: [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1000&q=90',
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1000&q=90',
      'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1000&q=90'
    ],
    type: 'polaroid'
  },
  {
    id: 'strip',
    name: 'Film Strip',
    description: 'The nostalgic arcade style. A vertical strip of 3 photos stacked with border details.',
    images: [
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1000&q=90',
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1000&q=90',
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1000&q=90'
    ],
    type: 'strip'
  }
];

const easeInOut = (x: number) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

const stackCardExtraStyles = [
  { x: -42, y: 15, rotate: -11, zIndex: 9 }, // idx = 1
  { x: 45, y: 20, rotate: 10, zIndex: 8 },  // idx = 2
  { x: -28, y: -32, rotate: -9, zIndex: 7 }, // idx = 3
  { x: 32, y: -28, rotate: 12, zIndex: 6 },  // idx = 4
  { x: -52, y: -8, rotate: -15, zIndex: 5 }, // idx = 5
  { x: 55, y: -12, rotate: 18, zIndex: 4 },  // idx = 6
  { x: -22, y: 45, rotate: -19, zIndex: 3 }, // idx = 7
  { x: 38, y: 40, rotate: 22, zIndex: 2 }   // idx = 8
];

const FILTERS = [
  { id: 'original', name: 'Original', filterCss: 'none' },
  { id: 'retro', name: 'Retro', filterCss: INST_C_CSS_PREVIEW },
  { id: 'inst-sq', name: 'Vivid', filterCss: INST_SQ_CSS_PREVIEW },
  { id: 'film', name: 'Film', filterCss: INST_SQC_CSS_PREVIEW },
  { id: 'flash', name: 'Bright', filterCss: 'brightness(1.25) contrast(1.1) saturate(1.15)' },
  { id: 'sunkissed', name: 'Warm', filterCss: 'sepia(0.4) saturate(1.35) hue-rotate(-10deg) brightness(1.05)' },
  { id: 'autumn', name: 'Autumn', filterCss: CLASSIC_U_CSS_PREVIEW },
  { id: 'noir', name: 'Pop', filterCss: 'saturate(1.55) contrast(1.2) brightness(0.95)' },
  { id: 'lomo', name: 'Noir', filterCss: 'grayscale(1) contrast(1.4) brightness(0.9)' }
];

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
};

function captureFilteredStill(
  source: CanvasImageSource,
  width: number,
  height: number,
  filterId: string,
  mirror = false,
): string | null {
  const filterObj = FILTERS.find(f => f.id === filterId) || FILTERS[0];
  if (isCanvasBakedFilter(filterId)) {
    return captureCanvasBakedStill(source, width, height, filterId, mirror);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.filter = filterObj.filterCss;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg');
}

export default function PhotoboothPageClient() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();

  const [photoboothLinks, setPhotoboothLinks] = useState<{ polaroidsUrl?: string; photostripsUrl?: string } | null>(null);

  useEffect(() => {
    const fetchLinks = async () => {
      try {
        const data = await contentApi.getByType('photobooth_links');
        if (data && data.metadata) {
          setPhotoboothLinks({
            polaroidsUrl: data.metadata.polaroidsUrl || '',
            photostripsUrl: data.metadata.photostripsUrl || '',
          });
        }
      } catch (err) {
        console.error('Failed to fetch photobooth links:', err);
      }
    };
    fetchLinks();
  }, []);

  const [isBoothOpen, setIsBoothOpen] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null);
  const [polaroidClickKey, setPolaroidClickKey] = useState(0);
  const [stripClickKey, setStripClickKey] = useState(0);
  const [boothStep, setBoothStep] = useState(1);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [selectedMoments, setSelectedMoments] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<(CapturedPhotoItem | null)[]>([]);
  const [stripSlotPhotos, setStripSlotPhotos] = useState<(CapturedPhotoItem | null)[][]>([]);
  const guideRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const ctaContainerRef = useRef<HTMLDivElement>(null);
  const [isCtaSticky, setIsCtaSticky] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const filterStripRef = useRef<HTMLDivElement>(null);
  const filterToggleRef = useRef<HTMLButtonElement>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof globalThis.setInterval> | null>(null);
  const isCountdownActiveRef = useRef(false);
  const activeCardIndexRef = useRef(activeCardIndex);
  const quantityRef = useRef(quantity);
  const capturedPhotosRef = useRef(capturedPhotos);
  const stripSlotPhotosRef = useRef(stripSlotPhotos);
  const isAutoCaptureRunningRef = useRef(false);
  const activeFilterRef = useRef('original');
  const captureModeRef = useRef<'auto' | 'manual'>('manual');
  const stopExitTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const boothContentRef = useRef<HTMLDivElement>(null);
  const sequenceAbortRef = useRef(false);

  const [completionSequenceStep, setCompletionSequenceStep] = useState<CompletionSequenceStep>('idle');
  const [stackedCount, setStackedCount] = useState(1);
  const [printOutputCount, setPrintOutputCount] = useState(0);
  const [showActionStrip, setShowActionStrip] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isPrintOrderOpen, setIsPrintOrderOpen] = useState(false);
  const [isPrintOrderVisible, setIsPrintOrderVisible] = useState(false);
  const [isPurchaseInProgress, setIsPurchaseInProgress] = useState(false);
  const [purchaseProgress, setPurchaseProgress] = useState<PurchaseProgress | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const printOrderCloseTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const printCarouselWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeCardIndexRef.current = activeCardIndex;
  }, [activeCardIndex]);

  useEffect(() => {
    quantityRef.current = quantity;
  }, [quantity]);

  const [step3TransitionStarted, setStep3TransitionStarted] = useState(false);
  const [isStep3Transitioning, setIsStep3Transitioning] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isStreamMirrored, setIsStreamMirrored] = useState(true);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const checkCameras = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoInputs.length > 1);
      }).catch((err) => {
        console.warn("enumerateDevices failed:", err);
      });
    }
  }, []);

  useEffect(() => {
    checkCameras();
  }, [checkCameras, cameraStream]);

  const [selectedOption, setSelectedOption] = useState<'camera' | 'upload' | null>(null);
  const [isSelectionFinalized, setIsSelectionFinalized] = useState(false);
  const [hasFinalizedOnce, setHasFinalizedOnce] = useState(false);
  const [isCloseConfirmationOpen, setIsCloseConfirmationOpen] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<'close' | 'back'>('close');
  const [editingFromCompletion, setEditingFromCompletion] = useState(false);


  const [isCapturePopupOpen, setIsCapturePopupOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState<'auto' | 'manual'>('manual');
  const [isAutoCaptureRunning, setIsAutoCaptureRunning] = useState(false);
  const [isStopButtonExiting, setIsStopButtonExiting] = useState(false);
  const [manualRecordEntering, setManualRecordEntering] = useState(false);
  const [autoSeconds, setAutoSeconds] = useState<3 | 5 | 10>(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [isFlashEnabled, setIsFlashEnabled] = useState(false);
  const isFlashEnabledRef = useRef(false);

  useEffect(() => {
    isFlashEnabledRef.current = isFlashEnabled;
  }, [isFlashEnabled]);
  const [activeFilter, setActiveFilter] = useState<string>('original');
  const [isFilterStripOpen, setIsFilterStripOpen] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState<number>(0);
  const [cardFrames, setCardFrames] = useState<number[]>([]);
  const [isDemoPolaroidFeed, setIsDemoPolaroidFeed] = useState(false);
  const [isDemoFeedReady, setIsDemoFeedReady] = useState(false);
  const demoPolaroidImgRef = useRef<HTMLImageElement | null>(null);
  const isDemoPolaroidFeedRef = useRef(false);
  const selectedVibeRef = useRef<string | null>(null);
  // Show the action strip 2s after the lid has closed (done step)
  useEffect(() => {
    if (completionSequenceStep === 'done') {
      const timer = setTimeout(() => setShowActionStrip(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [completionSequenceStep]);

  // Lock page scroll for the entire print sequence; unlock only when action strip appears
  useEffect(() => {
    const isActive =
      completionSequenceStep !== 'idle' &&
      completionSequenceStep !== 'exit' &&
      !showActionStrip;
    if (isActive) {
      // Lock both html and body — Next.js scrolls on the html element
      const prevHtml = document.documentElement.style.overflow;
      const prevBody = document.body.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      return () => {
        document.documentElement.style.overflow = prevHtml;
        document.body.style.overflow = prevBody;
      };
    }
  }, [completionSequenceStep, showActionStrip]);


  useEffect(() => {
    capturedPhotosRef.current = capturedPhotos;
  }, [capturedPhotos]);

  useEffect(() => {
    stripSlotPhotosRef.current = stripSlotPhotos;
  }, [stripSlotPhotos]);

  const isStripVibe = selectedVibe === 'strip';

  const getStripSlotsFor = useCallback(
    (stripIdx: number) => stripSlotPhotos[stripIdx] ?? createEmptyStripSlots(),
    [stripSlotPhotos],
  );

  const activeStripSlot = useMemo(() => {
    if (!isStripVibe) return 0;
    return getFirstEmptyStripSlot(getStripSlotsFor(activeCardIndex));
  }, [isStripVibe, getStripSlotsFor, activeCardIndex, stripSlotPhotos]);

  const getCapturedPhotoCount = useCallback(() => {
    if (isStripVibe) {
      return stripSlotPhotos.filter(isStripComplete).length;
    }
    return capturedPhotos.filter((photo) => photo != null).length;
  }, [isStripVibe, stripSlotPhotos, capturedPhotos]);

  const getQueueCounterTotal = useCallback(() => {
    if (isStripVibe) {
      return stripSlotPhotos.filter((strip) => strip.some((slot) => slot != null)).length;
    }
    return capturedPhotos.filter((photo) => photo != null).length;
  }, [isStripVibe, stripSlotPhotos, capturedPhotos]);

  const hasAnyCapturedPhotos = useCallback(() => {
    if (isStripVibe) {
      return stripSlotPhotos.some((strip) => strip.some((slot) => slot != null));
    }
    return capturedPhotos.some((photo) => photo != null);
  }, [isStripVibe, stripSlotPhotos, capturedPhotos]);

  const isCurrentCaptureFrameFilled = useCallback(() => {
    if (isStripVibe) {
      const slots = getStripSlotsFor(activeCardIndex);
      if (isStripComplete(slots)) return true;
      return slots[activeStripSlot] != null;
    }
    return capturedPhotos[activeCardIndex] != null;
  }, [isStripVibe, getStripSlotsFor, activeCardIndex, activeStripSlot, capturedPhotos]);

  // Sync selectedFrame with the frameId of the active keepsake photo
  useEffect(() => {
    const activeFrame = cardFrames[activeCardIndex];
    if (typeof activeFrame === 'number') {
      setSelectedFrame(activeFrame);
    }
  }, [activeCardIndex, cardFrames]);

  // Adjust cardFrames length to match quantity
  useEffect(() => {
    setCardFrames(prev => {
      if (prev.length === quantity) return prev;
      if (prev.length > quantity) {
        return prev.slice(0, quantity);
      }
      const next = [...prev];
      while (next.length < quantity) {
        next.push(selectedFrame);
      }
      return next;
    });
  }, [quantity, selectedFrame]);

  const keepsakePhotos = useMemo(
    () => buildKeepsakePhotosFromState(selectedVibe, capturedPhotos, stripSlotPhotos, cardFrames, selectedFrame, quantity),
    [selectedVibe, capturedPhotos, stripSlotPhotos, cardFrames, selectedFrame, quantity],
  );

  useEffect(() => {
    isAutoCaptureRunningRef.current = isAutoCaptureRunning;
  }, [isAutoCaptureRunning]);

  useEffect(() => {
    captureModeRef.current = captureMode;
  }, [captureMode]);

  useEffect(() => {
    activeFilterRef.current = activeFilter;
  }, [activeFilter]);

  useEffect(() => {
    isDemoPolaroidFeedRef.current = isDemoPolaroidFeed;
  }, [isDemoPolaroidFeed]);

  useEffect(() => {
    selectedVibeRef.current = selectedVibe;
  }, [selectedVibe]);

  useEffect(() => {
    if (!isDemoPolaroidFeed) {
      demoPolaroidImgRef.current = null;
      setIsDemoFeedReady(false);
      return;
    }
    let cancelled = false;
    setIsDemoFeedReady(false);
    loadImage(DEMO_POLAROID_FEED_URL)
      .then((img) => {
        if (!cancelled) {
          demoPolaroidImgRef.current = img;
          setIsDemoFeedReady(true);
        }
      })
      .catch((err) => {
        console.warn('Failed to preload demo polaroid feed image:', err);
        if (!cancelled) setIsDemoFeedReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isDemoPolaroidFeed]);

  useEffect(() => {
    if (!isFilterStripOpen) return;

    const handleOutsideInteraction = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        filterStripRef.current?.contains(target) ||
        filterToggleRef.current?.contains(target)
      ) {
        return;
      }
      setIsFilterStripOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideInteraction);
    document.addEventListener('touchstart', handleOutsideInteraction);
    return () => {
      document.removeEventListener('mousedown', handleOutsideInteraction);
      document.removeEventListener('touchstart', handleOutsideInteraction);
    };
  }, [isFilterStripOpen]);

  const currentFilter = FILTERS.find(f => f.id === activeFilter) || FILTERS[0];
  const currentFilterCss = currentFilter.filterCss;
  /** Canvas-baked filters use preview canvas — CSS only for others */
  const vibePlaceholderFilterCss = isCanvasBakedFilter(activeFilter) ? 'none' : currentFilterCss;


  useEffect(() => {
    if (boothStep === 3) {
      setCapturedPhotos((prev) => {
        if (prev.length === quantity) return prev;
        const next = Array.from({ length: quantity }, () => null) as (CapturedPhotoItem | null)[];
        for (let i = 0; i < Math.min(prev.length, quantity); i += 1) {
          next[i] = prev[i];
        }
        return next;
      });
      setStripSlotPhotos((prev) => {
        if (prev.length === quantity) return prev;
        const next = createEmptyStripCollection(quantity);
        for (let i = 0; i < Math.min(prev.length, quantity); i += 1) {
          next[i] = prev[i] ?? createEmptyStripSlots();
        }
        return next;
      });
      return;
    }
    setCapturedPhotos(Array(quantity).fill(null));
    setStripSlotPhotos(createEmptyStripCollection(quantity));
    setActiveCardIndex(0);
  }, [quantity, boothStep]);

  const allPhotosFilled = capturedPhotos.length === quantity && capturedPhotos.every(p => p !== null);

  const isButtonEnabled = boothStep === 1
    ? !!selectedVibe
    : boothStep === 2
      ? !!selectedOption
      : true;

  const handleFinalizeSelection = () => {
    setCapturedPhotos((prev) => {
      const next = [...prev];
      if (next.length > 0 && next[next.length - 1] === null) {
        next.pop();
      }
      setQuantity(next.length);
      setStripSlotPhotos((prevStrips) => prevStrips.slice(0, next.length));
      return next;
    });
    setIsSelectionFinalized(true);
    setHasFinalizedOnce(true);
    stopCamera();
  };


  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 640 }, height: { ideal: 640 } }
      });
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack ? videoTrack.getSettings() : null;
      const actualFacingMode = settings?.facingMode;
      const shouldMirror = actualFacingMode !== 'environment';
      setIsStreamMirrored(shouldMirror);
      setCameraStream(stream);
      setIsCameraActive(true);
    } catch (err) {
      console.warn("Camera access failed or unavailable, starting simulated camera preview:", err);
      setIsCameraActive(true);
    }
  };

  const isEditingLocked = showActionStrip;

  const handleCompletionEdit = useCallback((idx: number) => {
    if (isEditingLocked) return;
    setActiveCardIndex(idx);
    setIsSelectionFinalized(false);
    setEditingFromCompletion(true);
    if (selectedVibe === 'strip') {
      const photo = capturedPhotos[idx];
      if (photo?.stripSlotUrls) {
        setStripSlotPhotos((prev) => {
          const next = [...prev];
          next[idx] = photo.stripSlotUrls!.map((url) => ({
            url,
            filterId: photo.filterId,
            frameId: photo.frameId,
          }));
          stripSlotPhotosRef.current = next;
          return next;
        });
      }
    }
    if (selectedOption === 'camera') {
      startCamera(facingMode);
    }
  }, [capturedPhotos, facingMode, isEditingLocked, selectedOption, selectedVibe]);

  const handleCompletionDelete = useCallback((idx: number) => {
    if (isEditingLocked) return;
    setStripSlotPhotos((prev) => prev.filter((_, i) => i !== idx));
    setCapturedPhotos((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) {
        setQuantity(1);
        setActiveCardIndex(0);
        setStripSlotPhotos(createEmptyStripCollection(1));
        setIsSelectionFinalized(false);
        if (selectedOption === 'camera') {
          startCamera(facingMode);
        }
        return [null];
      }
      setQuantity(next.length);
      setActiveCardIndex((current) => Math.min(current, next.length - 1));
      return next;
    });
  }, [facingMode, isEditingLocked, selectedOption]);

  const handleCaptureDelete = useCallback((idx: number) => {
    setCapturedPhotos((prev) => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
    setActiveCardIndex(idx);
    if (selectedOption === 'camera') {
      startCamera(facingMode);
    }
  }, [facingMode, selectedOption]);

  const renderPolaroidFrameActions = (
    idx: number,
    mode: 'completion' | 'capture',
  ) => (
    <div className={styles.polaroidFrameActions}>
      <button
        type="button"
        className={styles.polaroidFrameActionBtn}
        aria-label="Edit photo"
        onClick={(e) => {
          e.stopPropagation();
          if (mode === 'completion') {
            handleCompletionEdit(idx);
          } else {
            setActiveCardIndex(idx);
          }
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <button
        type="button"
        className={`${styles.polaroidFrameActionBtn} ${styles.polaroidFrameActionBtnDanger}`}
        aria-label="Delete photo"
        onClick={(e) => {
          e.stopPropagation();
          if (mode === 'completion') {
            handleCompletionDelete(idx);
          } else {
            handleCaptureDelete(idx);
          }
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22" aria-hidden="true">
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </button>
    </div>
  );

  const capturePhotoAsync = useCallback(async (): Promise<string | null> => {
    let activeVideoTrack: MediaStreamTrack | null = null;

    if (isFlashEnabledRef.current) {
      setShowFlash(true);

      if (cameraStream) {
        const videoTrack = cameraStream.getVideoTracks()[0];
        if (videoTrack) {
          try {
            const capabilities = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as any;
            if (capabilities && capabilities.torch) {
              await videoTrack.applyConstraints({
                advanced: [{ torch: true } as any],
              });
              activeVideoTrack = videoTrack;
            }
          } catch (err) {
            console.debug('Hardware torch not available or failed:', err);
          }
        }
      }

      // Allow flashlight / screen flash to illuminate the scene before capturing the frame
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Keep flashlight on for full ~1 second total duration (750ms remaining)
      setTimeout(async () => {
        setShowFlash(false);
        if (activeVideoTrack) {
          try {
            await activeVideoTrack.applyConstraints({
              advanced: [{ torch: false } as any],
            });
          } catch {}
        }
      }, 750);
    }

    const filterId = activeFilterRef.current;

    if (isDemoPolaroidFeedRef.current && selectedVibeRef.current === 'polaroid') {
      const img = demoPolaroidImgRef.current;
      if (img && img.naturalWidth > 0) {
        const captured = captureFilteredStill(
          img,
          img.naturalWidth || 640,
          img.naturalHeight || 640,
          filterId,
        );
        if (captured) return captured;
      }
    }

    if (videoRef.current && cameraStream) {
      const video = videoRef.current;
      const captured = captureFilteredStill(
        video,
        video.videoWidth || 640,
        video.videoHeight || 640,
        filterId,
        isStreamMirrored,
      );
      if (captured) return captured;
    }

    const vibeImages = vibes.find(v => v.id === selectedVibeRef.current)?.images || [];
    return vibeImages[activeCardIndexRef.current % vibeImages.length] || '/polaroid_enhanced.png';
  }, [cameraStream, isStreamMirrored]);

  const advanceAfterStripComplete = useCallback((stripIdx: number) => {
    setTimeout(() => {
      setActiveCardIndex((current) => {
        if (current !== stripIdx) return current;
        if (stripIdx < quantityRef.current - 1) {
          return stripIdx + 1;
        }
        setStripSlotPhotos((prev) => {
          const next = [...prev, createEmptyStripSlots()];
          stripSlotPhotosRef.current = next;
          return next;
        });
        setCapturedPhotos((prevPhotos) => {
          const nextPhotos = [...prevPhotos, null];
          capturedPhotosRef.current = nextPhotos;
          return nextPhotos;
        });
        setQuantity((q) => q + 1);
        return stripIdx + 1;
      });
    }, 1000);
  }, []);

  const commitManualCapture = useCallback(async (targetIdx?: number) => {
    const idx = targetIdx ?? activeCardIndexRef.current;
    if (isDemoPolaroidFeedRef.current && !isDemoFeedReady) return;

    if (selectedVibeRef.current === 'strip') {
      const slots = [...(stripSlotPhotosRef.current[idx] ?? createEmptyStripSlots())];
      const slotIdx = getFirstEmptyStripSlot(slots);
      if (slots[slotIdx] != null || isStripComplete(slots)) return;

      const photo = await capturePhotoAsync();
      if (!photo) return;
      const frameId = cardFrames[idx] ?? selectedFrame;
      slots[slotIdx] = { url: photo, filterId: activeFilter, frameId };

      setStripSlotPhotos((prev) => {
        const next = [...prev];
        next[idx] = slots;
        stripSlotPhotosRef.current = next;
        return next;
      });

      if (isStripComplete(slots)) {
        const completePhoto = buildStripCapturedPhoto(
          slots as [CapturedPhotoItem, CapturedPhotoItem, CapturedPhotoItem],
          frameId,
        );
        setCapturedPhotos((prev) => {
          const next = [...prev];
          next[idx] = completePhoto;
          capturedPhotosRef.current = next;
          return next;
        });
        advanceAfterStripComplete(idx);
      }
      return;
    }

    if (capturedPhotosRef.current[idx] != null) return;

    const photo = await capturePhotoAsync();
    if (!photo) return;
    const frameId = cardFrames[idx] ?? selectedFrame;
    setCapturedPhotos(prev => {
      const next = [...prev];
      next[idx] = { url: photo, filterId: activeFilter, frameId };
      capturedPhotosRef.current = next;
      return next;
    });

    setTimeout(() => {
      setActiveCardIndex((current) => {
        if (current !== idx) return current;
        const q = quantityRef.current;
        if (idx >= q - 1) {
          setCapturedPhotos((prevPhotos) => {
            const nextPhotos = [...prevPhotos, null];
            capturedPhotosRef.current = nextPhotos;
            return nextPhotos;
          });
          setQuantity(q + 1);
        }
        return current + 1;
      });
    }, 1000);
  }, [activeFilter, advanceAfterStripComplete, capturePhotoAsync, cardFrames, isDemoFeedReady, selectedFrame]);

  const clearAutoCaptureTimers = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    isCountdownActiveRef.current = false;
  }, []);

  const pauseAutoCapture = useCallback(() => {
    clearAutoCaptureTimers();
    setIsAutoCaptureRunning(false);
    isAutoCaptureRunningRef.current = false;
    setCountdown(null);
  }, [clearAutoCaptureTimers]);

  const clearStopExitTimer = useCallback(() => {
    if (stopExitTimerRef.current) {
      clearTimeout(stopExitTimerRef.current);
      stopExitTimerRef.current = null;
    }
  }, []);

  const advanceToNextAutoFrame = useCallback(() => {
    const idx = activeCardIndexRef.current;
    const qty = quantityRef.current;

    if (selectedVibeRef.current === 'strip') {
      const slots = stripSlotPhotosRef.current[idx] ?? createEmptyStripSlots();
      if (!isStripComplete(slots)) return;
    }

    if (idx < qty - 1) {
      setActiveCardIndex(idx + 1);
      return;
    }

    if (selectedVibeRef.current === 'strip') {
      setStripSlotPhotos((prev) => {
        const next = [...prev, createEmptyStripSlots()];
        stripSlotPhotosRef.current = next;
        return next;
      });
    }

    setCapturedPhotos((prev) => {
      const next = [...prev, null];
      capturedPhotosRef.current = next;
      return next;
    });
    setQuantity(qty + 1);
    setActiveCardIndex(idx + 1);
  }, []);

  const startAutoCountdownForCurrentFrame = useCallback(() => {
    if (
      boothStep !== 3 ||
      captureModeRef.current !== 'auto' ||
      !isAutoCaptureRunningRef.current ||
      (!isCameraActive && !isDemoPolaroidFeedRef.current) ||
      isSelectionFinalized
    ) {
      return;
    }

    const idx = activeCardIndexRef.current;
    if (selectedVibeRef.current === 'strip') {
      const slots = stripSlotPhotosRef.current[idx] ?? createEmptyStripSlots();
      const slotIdx = getFirstEmptyStripSlot(slots);
      if (slots[slotIdx] != null || isStripComplete(slots)) {
        return;
      }
    } else if (capturedPhotosRef.current[idx] != null) {
      return;
    }

    if (isCountdownActiveRef.current || countdownIntervalRef.current) {
      return;
    }

    isCountdownActiveRef.current = true;
    let remaining = autoSeconds;
    setCountdown(remaining);

    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;

      if (remaining > 0) {
        setCountdown(remaining);
        return;
      }

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      isCountdownActiveRef.current = false;
      setCountdown(0);

      globalThis.setTimeout(async () => {
        if (!isAutoCaptureRunningRef.current || captureModeRef.current !== 'auto') {
          setCountdown(null);
          return;
        }

        const currentIdx = activeCardIndexRef.current;

        if (selectedVibeRef.current === 'strip') {
          const slots = [...(stripSlotPhotosRef.current[currentIdx] ?? createEmptyStripSlots())];
          const slotIdx = getFirstEmptyStripSlot(slots);
          if (slots[slotIdx] != null || isStripComplete(slots)) {
            setCountdown(null);
            return;
          }

          const photo = await capturePhotoAsync();
          if (!photo) {
            setCountdown(null);
            return;
          }

          const frameId = cardFrames[currentIdx] ?? selectedFrame;
          slots[slotIdx] = { url: photo, filterId: activeFilterRef.current, frameId };
          setStripSlotPhotos((prev) => {
            const next = [...prev];
            next[currentIdx] = slots;
            stripSlotPhotosRef.current = next;
            return next;
          });

          if (isStripComplete(slots)) {
            const completePhoto = buildStripCapturedPhoto(
              slots as [CapturedPhotoItem, CapturedPhotoItem, CapturedPhotoItem],
              frameId,
            );
            setCapturedPhotos((prev) => {
              const next = [...prev];
              next[currentIdx] = completePhoto;
              capturedPhotosRef.current = next;
              return next;
            });
          }

          setCountdown(null);

          autoAdvanceTimerRef.current = globalThis.setTimeout(() => {
            autoAdvanceTimerRef.current = null;
            if (isStripComplete(slots)) {
              advanceToNextAutoFrame();
            } else {
              startAutoCountdownForCurrentFrame();
            }
          }, 1500);
          return;
        }

        if (capturedPhotosRef.current[currentIdx] != null) {
          setCountdown(null);
          return;
        }

        const photo = await capturePhotoAsync();
        if (!photo) {
          setCountdown(null);
          return;
        }
        setCapturedPhotos((prev) => {
          const next = [...prev];
          next[currentIdx] = { url: photo, filterId: activeFilterRef.current, frameId: selectedFrame };
          capturedPhotosRef.current = next;
          return next;
        });
        setCountdown(null);

        autoAdvanceTimerRef.current = globalThis.setTimeout(() => {
          autoAdvanceTimerRef.current = null;
          advanceToNextAutoFrame();
        }, 1500);
      }, 500);
    }, 1000);
  }, [advanceToNextAutoFrame, autoSeconds, boothStep, capturePhotoAsync, cardFrames, isCameraActive, isSelectionFinalized, selectedFrame]);

  const processUploadedImage = (dataUrl: string) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 640;
      canvas.height = img.naturalHeight || 640;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const filterObj = FILTERS.find(f => f.id === activeFilter) || FILTERS[0];
        if (isCanvasBakedFilter(activeFilter)) {
          ctx.filter = 'none';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          applyCanvasBakedFilter(canvas, activeFilter);
        } else {
          ctx.filter = filterObj.filterCss;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        const processedUrl = canvas.toDataURL('image/jpeg');
        const targetIdx = activeCardIndex;
        const frameId = cardFrames[targetIdx] ?? selectedFrame;

        if (selectedVibe === 'strip') {
          const slots = [...(stripSlotPhotosRef.current[targetIdx] ?? createEmptyStripSlots())];
          const slotIdx = getFirstEmptyStripSlot(slots);
          if (slots[slotIdx] == null && !isStripComplete(slots)) {
            slots[slotIdx] = { url: processedUrl, filterId: activeFilter, frameId };
            setStripSlotPhotos((prev) => {
              const next = [...prev];
              next[targetIdx] = slots;
              stripSlotPhotosRef.current = next;
              return next;
            });

            if (isStripComplete(slots)) {
              const completePhoto = buildStripCapturedPhoto(
                slots as [CapturedPhotoItem, CapturedPhotoItem, CapturedPhotoItem],
                frameId,
              );
              setCapturedPhotos((prev) => {
                const next = [...prev];
                next[targetIdx] = completePhoto;
                capturedPhotosRef.current = next;
                return next;
              });
              advanceAfterStripComplete(targetIdx);
            }
          }
          return;
        }

        setCapturedPhotos(prev => {
          const next = [...prev];
          next[targetIdx] = { url: processedUrl, filterId: activeFilter, frameId };
          return next;
        });

        // Automatically advance to the next frame after 1s in manual mode
        setTimeout(() => {
          setActiveCardIndex((current) => {
            if (current !== targetIdx) return current;
            const q = quantityRef.current;
            if (targetIdx >= q - 1) {
              setCapturedPhotos((prevPhotos) => {
                const nextPhotos = [...prevPhotos, null];
                capturedPhotosRef.current = nextPhotos;
                return nextPhotos;
              });
              setQuantity(q + 1);
            }
            return current + 1;
          });
        }, 1000);
      }
    };
    img.crossOrigin = 'anonymous';
    img.src = dataUrl;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && typeof event.target.result === 'string') {
          processUploadedImage(event.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownloadKeepsakes = useCallback(async () => {
    const photos = keepsakePhotos;
    if (photos.length === 0) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    const wait = (ms: number) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, ms));

    setDownloadProgress(5);
    await wait(150);

    const vibe = vibes.find(v => v.id === selectedVibe);
    const vibeImages = vibe?.images || [];
    const vibeId = selectedVibe || 'polaroid';

    try {
      const entries: { filename: string; dataUrl: string }[] = [];

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        let downloadUrl = photo.url;
        const frameId = typeof photo.frameId === 'number' ? photo.frameId : selectedFrame;
        try {
          downloadUrl = await generateKeepsakeDataUrl(
            photo,
            vibeId,
            vibeImages,
            frameId,
            { scale: KEEPSAKE_DOWNLOAD_SCALE },
          );
        } catch (err) {
          console.error('Failed to generate composite keepsake image for download:', err);
        }

        entries.push({
          filename: keepsakeEntryFilename(i, vibeId),
          dataUrl: downloadUrl,
        });

        setDownloadProgress(5 + Math.round(((i + 1) / photos.length) * 85));
        await wait(40);
      }

      setDownloadProgress(95);

      if (entries.length === 1) {
        downloadBlob(buildPngBlob(entries[0].dataUrl), keepsakeZipFilename(1));
      } else {
        const zipBlob = buildZipBlob(entries);
        downloadBlob(zipBlob, keepsakeZipFilename(entries.length));
      }

      setDownloadProgress(100);
    } catch (err) {
      console.error('Failed to export keepsakes:', err);
    }
  }, [keepsakePhotos, selectedVibe, selectedFrame]);

  const resetCompletionSequence = useCallback(() => {
    sequenceAbortRef.current = true;
    setCompletionSequenceStep('idle');
    setStackedCount(1);
    setPrintOutputCount(0);
    setShowActionStrip(false);
  }, []);

  const runCompletionSequence = useCallback(async () => {
    if (completionSequenceStep !== 'idle') return;

    const photos = keepsakePhotos;
    if (photos.length === 0) return;

    sequenceAbortRef.current = false;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        globalThis.setTimeout(() => {
          if (!sequenceAbortRef.current) resolve();
        }, ms);
      });

    setStackedCount(1);
    setPrintOutputCount(0);

    // Step 1: Exit Fade
    setCompletionSequenceStep('exit');
    await wait(450); // wait for full screen fade out
    if (sequenceAbortRef.current) return;

    // Step 2: Printer slides down
    setCompletionSequenceStep('printer');
    await wait(1100); // give the printer and box time to slide fully into view
    if (sequenceAbortRef.current) return;

    // Step 3: Print cards
    setCompletionSequenceStep('print');
    // Wait a bit for dropDistance measurement to fire before first card
    await wait(400);
    if (sequenceAbortRef.current) return;
    for (let i = 0; i < photos.length; i++) {
      setPrintOutputCount(i + 1);
      await wait(900); // time between each card
      if (sequenceAbortRef.current) return;
    }

    // Step 4: Wait for last card to land, then close
    await wait(700);
    if (sequenceAbortRef.current) return;

    // Step 5: Done — lid slides up
    setCompletionSequenceStep('done');
  }, [keepsakePhotos, completionSequenceStep]);

  const printOrderCount = keepsakePhotos.length;
  const printOrderTotal = calculatePrintOrderTotal(printOrderCount);

  const buildPurchaseInput = useCallback(() => {
    const photos = keepsakePhotos;
    const vibe = vibes.find((v) => v.id === selectedVibe);
    return {
      selectedVibe: (selectedVibe || 'polaroid') as 'polaroid' | 'strip',
      quantity: photos.length,
      selectedFrame,
      cardFrames,
      capturedPhotos: photos,
      vibeImages: vibe?.images || [],
    };
  }, [keepsakePhotos, cardFrames, selectedFrame, selectedVibe]);

  const runPurchasePipeline = useCallback(async (pendingProject?: PhotoboothProjectJson) => {
    if (isPurchaseInProgress) return;
    setPurchaseError(null);
    setIsPurchaseInProgress(true);
    setPurchaseProgress({ step: 'rendering', percent: 0, message: 'Starting…' });

    let createdProjectId: string | null = null;

    try {
      const baseInput = buildPurchaseInput();
      const input = pendingProject
        ? {
          ...baseInput,
          selectedVibe: pendingProject.selectedVibe,
          quantity: pendingProject.quantity,
          selectedFrame: pendingProject.selectedFrame,
          cardFrames: pendingProject.cardFrames,
          capturedPhotos: pendingProject.capturedPhotos.map((photo, idx) => ({
            ...photo,
            stripSlotUrls: photo.stripSlotUrls ?? baseInput.capturedPhotos[idx]?.stripSlotUrls,
          })),
          projectJson: pendingProject,
        }
        : baseInput;

      const { project, cartItem } = await executePhotoboothPurchase(
        input,
        (progress) => setPurchaseProgress(progress),
      );
      createdProjectId = project.id;

      const addResult = addItem(cartItem);
      if (!addResult.ok) {
        await rollbackPhotoboothProject(project.id);
        throw new Error('Could not add item to cart');
      }

      clearPendingPurchase();
      setIsPrintOrderVisible(false);
      setIsPrintOrderOpen(false);
      setPurchaseProgress({ step: 'done', percent: 100, message: 'Redirecting to cart…' });
      router.push('/cart');
    } catch (err: unknown) {
      if (createdProjectId) {
        await rollbackPhotoboothProject(createdProjectId);
      }
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Purchase failed. Please try again.';
      setPurchaseError(message);
      setPurchaseProgress(null);
    } finally {
      setIsPurchaseInProgress(false);
    }
  }, [addItem, buildPurchaseInput, isPurchaseInProgress, router]);

  const runGuestPurchasePipeline = useCallback(async () => {
    if (isPurchaseInProgress) return;
    setPurchaseError(null);
    setIsPurchaseInProgress(true);
    setPurchaseProgress({ step: 'rendering', percent: 0, message: 'Starting…' });

    try {
      const cartItem = await prepareGuestPhotoboothForCart(
        buildPurchaseInput(),
        (progress) => setPurchaseProgress(progress),
      );

      const addResult = addItem(cartItem);
      if (!addResult.ok) {
        throw new Error('Could not add item to cart');
      }

      setIsPrintOrderVisible(false);
      setIsPrintOrderOpen(false);
      setPurchaseProgress({ step: 'done', percent: 100, message: 'Redirecting to cart…' });
      router.push('/cart');
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Could not add to cart. Please try again.';
      setPurchaseError(message);
      setPurchaseProgress(null);
    } finally {
      setIsPurchaseInProgress(false);
    }
  }, [addItem, buildPurchaseInput, isPurchaseInProgress, router]);

  const handleBuyNow = useCallback(() => {
    if (printOrderCount === 0 || isPurchaseInProgress) return;

    if (!isAuthenticated) {
      void runGuestPurchasePipeline();
      return;
    }

    void runPurchasePipeline();
  }, [isAuthenticated, isPurchaseInProgress, printOrderCount, runGuestPurchasePipeline, runPurchasePipeline]);

  const printCarouselItems = useMemo(() => {
    if (printOrderCount === 0) return [];
    if (printOrderCount <= PRINT_CAROUSEL_PAGE_SIZE) return keepsakePhotos;
    return [...keepsakePhotos, ...keepsakePhotos];
  }, [keepsakePhotos, printOrderCount]);

  const printCarouselAnimates = printOrderCount > PRINT_CAROUSEL_PAGE_SIZE;

  useEffect(() => {
    if (!isPrintOrderOpen) return;
    const node = printCarouselWrapRef.current;
    if (!node) return;

    const gapPx = 16;
    const visible = PRINT_CAROUSEL_PAGE_SIZE;

    const syncCarouselItemWidth = () => {
      const wrapWidth = node.clientWidth;
      if (wrapWidth <= 0) return;
      const itemWidth = (wrapWidth - (visible - 1) * gapPx) / visible;
      node.style.setProperty('--carousel-item-width', `${itemWidth}px`);
    };

    syncCarouselItemWidth();
    const observer = new ResizeObserver(syncCarouselItemWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isPrintOrderOpen, isPrintOrderVisible]);

  const openPrintOrderPopup = useCallback(() => {
    if (printOrderCloseTimerRef.current) {
      clearTimeout(printOrderCloseTimerRef.current);
      printOrderCloseTimerRef.current = null;
    }
    setIsPrintOrderOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsPrintOrderVisible(true));
    });
  }, []);

  const closePrintOrderPopup = useCallback(() => {
    setIsPrintOrderVisible(false);
    if (printOrderCloseTimerRef.current) {
      clearTimeout(printOrderCloseTimerRef.current);
    }
    printOrderCloseTimerRef.current = globalThis.setTimeout(() => {
      setIsPrintOrderOpen(false);
      printOrderCloseTimerRef.current = null;
    }, 420);
  }, []);

  const renderKeepsakeFrame = useCallback((
    photo: CapturedPhotoItem,
    idx: number,
    compact = false,
    forCarousel = false,
  ) => {
    const filterObj = FILTERS.find(f => f.id === photo.filterId) || FILTERS[0];
    const capturedPhotoFilterCss = isCanvasBakedFilter(filterObj.id) ? 'none' : filterObj.filterCss;
    const vibeImageFilterCss = filterObj.filterCss;
    const padding = compact ? '6px 6px 22px' : '10px 10px 42px';
    const cardFrameId = typeof photo.frameId === 'number' ? photo.frameId : selectedFrame;
    let frameClass = '';
    if (cardFrameId === 1) {
      frameClass = styles.polaroidFrameBlobPattern;
    } else if (cardFrameId === 2) {
      frameClass = styles.polaroidFrameStickerPopPattern;
    } else if (cardFrameId === 3) {
      frameClass = styles.polaroidFrameComicBlastPattern;
    } else if (cardFrameId === 4) {
      frameClass = styles.polaroidFrameCandyPinkPattern;
    } else if (cardFrameId === 5) {
      frameClass = styles.polaroidFrameSweetKissPattern;
    } else if (cardFrameId === 6) {
      frameClass = styles.polaroidFrameStarlightPattern;
    } else if (cardFrameId === 7) {
      frameClass = styles.polaroidFrameBluebellPattern;
    } else if (cardFrameId === 8) {
      frameClass = styles.polaroidFramePixelPaintPattern;
    }

    if (selectedVibe === 'polaroid') {
      if (forCarousel) {
        return (
          <div className={`${styles.polaroidFrameContainer} ${frameClass} ${styles.printOrderCarouselFrame}`}>
            <div className={styles.polaroidInnerSlot}>
              <img
                src={photo.url}
                alt={`Keepsake ${idx + 1}`}
                className={styles.stackImg}
                draggable={false}
                style={{ filter: capturedPhotoFilterCss }}
              />
            </div>
          </div>
        );
      }

      return (
        <div className={`${styles.polaroidFrameContainer} ${frameClass}`} style={{ margin: 0, width: '100%', height: '100%', padding }}>
          <div
            className={styles.polaroidInnerSlot}
            style={cardFrameId === 8 ? {
              position: 'absolute',
              left: '25.9755%',
              top: '13.7272%',
              width: '66.93%',
              height: '68.09%',
              aspectRatio: 'auto'
            } : {
              position: 'relative',
              width: '100%',
              aspectRatio: '1/1'
            }}
          >
            <img
              src={photo.url}
              alt={`Keepsake ${idx + 1}`}
              className={styles.stackImg}
              draggable={false}
              style={{ filter: capturedPhotoFilterCss }}
            />
          </div>
        </div>
      );
    }

    const stripSlotSources: (string | null)[] = photo.stripSlotUrls
      ? [...photo.stripSlotUrls]
      : [photo.url, null, null];
    const renderStripSlotImage = (slotUrl: string | null, slotIdx: number) => {
      if (!slotUrl) {
        const fallbackUrl = vibes.find(v => v.id === selectedVibe)?.images[slotIdx] || vibes[0].images[slotIdx];
        return (
          <img
            src={fallbackUrl}
            alt=""
            className={styles.stackImg}
            draggable={false}
            style={{ filter: vibeImageFilterCss }}
          />
        );
      }
      return (
        <img
          src={slotUrl}
          alt={`Keepsake ${idx + 1}-${slotIdx + 1}`}
          className={styles.stackImg}
          draggable={false}
          style={{ filter: capturedPhotoFilterCss }}
        />
      );
    };

    if (forCarousel) {
      return (
        <div className={`${styles.polaroidFrameContainer} ${frameClass} ${styles.printOrderCarouselFrame}`}>
          <div className={styles.stripColumn}>
            {stripSlotSources.map((slotUrl, slotIdx) => (
              <div key={slotIdx} className={styles.stripMiniImg}>
                {renderStripSlotImage(slotUrl, slotIdx)}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className={`${styles.polaroidFrameContainer} ${frameClass}`} style={{ margin: 0, width: '100%', height: '100%', padding: compact ? '3px 3px 17px' : '7px 7px 39px' }}>
        <div className={styles.stripColumn} style={{ gap: compact ? '2px' : '5px', width: '100%', height: '100%' }}>
          {stripSlotSources.map((slotUrl, slotIdx) => (
            <div key={slotIdx} className={styles.stripMiniImg} style={{ aspectRatio: '1/1', position: 'relative' }}>
              {renderStripSlotImage(slotUrl, slotIdx)}
            </div>
          ))}
        </div>
      </div>
    );
  }, [selectedVibe, selectedFrame]);

  const closeBooth = () => {
    setIsBoothOpen(false);
    setBoothStep(1);
    setSelectedMoments(null);
    setQuantity(1);
    setSelectedOption(null);
    setIsSelectionFinalized(false);
    setHasFinalizedOnce(false);
    setIsCloseConfirmationOpen(false);
    setEditingFromCompletion(false);
    stopCamera();
    setActiveCardIndex(0);
    setCapturedPhotos([null]);
    setStripSlotPhotos(createEmptyStripCollection(1));
    setIsCapturePopupOpen(false);
    setIsPrintOrderOpen(false);
    setIsPrintOrderVisible(false);
    if (printOrderCloseTimerRef.current) {
      clearTimeout(printOrderCloseTimerRef.current);
      printOrderCloseTimerRef.current = null;
    }
    setCountdown(null);
    setCaptureMode('manual');
    setIsAutoCaptureRunning(false);
    isAutoCaptureRunningRef.current = false;
    setActiveFilter('original');
    setIsFilterStripOpen(false);
    setIsStopButtonExiting(false);
    setManualRecordEntering(false);
    clearStopExitTimer();
    clearAutoCaptureTimers();
    resetCompletionSequence();
  };

  useEffect(() => {
    if (boothStep !== 3) {
      setStep3TransitionStarted(false);
      setIsStep3Transitioning(false);
    } else {
      setIsStep3Transitioning(true);
      const startTimer = setTimeout(() => {
        setStep3TransitionStarted(true);
      }, 50);
      const endTimer = setTimeout(() => {
        setIsStep3Transitioning(false);
      }, 1500);
      return () => {
        clearTimeout(startTimer);
        clearTimeout(endTimer);
      };
    }
  }, [boothStep]);

  useEffect(() => {
    if (boothStep === 2) {
      setQuantity(1);
      const interval = setInterval(() => {
        setQuantity(q => {
          if (q < 4) return q + 1;
          clearInterval(interval);
          return q;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [boothStep]);

  useEffect(() => {

    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  useEffect(() => {
    if (isCameraActive && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => { });
    }
  }, [isCameraActive, cameraStream]);

  // Callback ref: assigns stream the instant the <video> element mounts
  const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && cameraStream) {
      if (node.srcObject !== cameraStream) {
        node.srcObject = cameraStream;
        node.play().catch(() => { });
      }
    }
  }, [cameraStream]);

  const renderLiveStripSlot = useCallback((
    stripIdx: number,
    slotIdx: number,
    isActiveCard: boolean,
  ) => {
    const slots = stripSlotPhotos[stripIdx] ?? createEmptyStripSlots();
    const captured = slots[slotIdx];
    const slotFilterCss = (filterId: string) =>
      isCanvasBakedFilter(filterId) ? 'none' : (FILTERS.find((f) => f.id === filterId)?.filterCss || 'none');

    if (captured) {
      return (
        <img
          src={captured.url}
          alt=""
          className={styles.stackImg}
          draggable={false}
          style={{ filter: slotFilterCss(captured.filterId) }}
        />
      );
    }

    const currentSlot = getFirstEmptyStripSlot(slots);
    const isFutureStrip = stripIdx > activeCardIndex;
    const isFutureSlotOnActiveStrip = isActiveCard && slotIdx > currentSlot;
    const isWaitingForCamera = isActiveCard && stripIdx === activeCardIndex && slotIdx === currentSlot && !isCameraActive;
    const isLiveSlot =
      isActiveCard &&
      stripIdx === activeCardIndex &&
      slotIdx === currentSlot &&
      isCameraActive;

    if (isLiveSlot) {
      return (
        <>
          {cameraStream ? (
            <LiveCameraFeed
              filterId={activeFilter}
              filterCss={currentFilterCss}
              mirror={isStreamMirrored}
              className={styles.cameraVideo}
              cameraStream={cameraStream}
              previewActive={isActiveCard && stripIdx === activeCardIndex}
              setVideoRef={
                isActiveCard && stripIdx === activeCardIndex
                  ? videoCallbackRef
                  : (node) => {
                    if (node && cameraStream && node.srcObject !== cameraStream) {
                      node.srcObject = cameraStream;
                      node.play().catch(() => { });
                    }
                  }
              }
              attachStream={isActiveCard && stripIdx === activeCardIndex}
            />
          ) : (
            <div className={styles.simulatedCamera} style={{ fontSize: '0.4rem' }}>
              <div className={styles.simulatedCameraPulse} style={{ width: '10px', height: '10px' }} />
            </div>
          )}
          {isActiveCard && captureMode === 'auto' && countdown !== null && (
            <div className={styles.countdownOverlay}>
              <div className={styles.countdownNumber} style={{ fontSize: '1.25rem' }}>
                {countdown === 0 ? '📸' : countdown}
              </div>
            </div>
          )}
          {isActiveCard && showFlash && <div className={styles.cameraFlash} />}
        </>
      );
    }

    if (isFutureStrip || isFutureSlotOnActiveStrip || isWaitingForCamera) {
      return (
        <div className={styles.stripAwaitingSlot}>
          <span>Awaiting....</span>
        </div>
      );
    }

    return (
      <div className={styles.stripAwaitingSlot}>
        <span>Awaiting....</span>
      </div>
    );
  }, [
    activeCardIndex,
    activeFilter,
    cameraStream,
    captureMode,
    countdown,
    currentFilterCss,
    isCameraActive,
    showFlash,
    stripSlotPhotos,
    videoCallbackRef,
  ]);

  useEffect(() => {
    if (isBoothOpen) {
      document.body.setAttribute('data-booth-open', 'true');
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.body.removeAttribute('data-booth-open');
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.body.removeAttribute('data-booth-open');
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [isBoothOpen]);

  const handleStartCaptureSession = () => {
    setIsCapturePopupOpen(false);
    if (captureMode === 'auto') {
      setIsAutoCaptureRunning(true);
      isAutoCaptureRunningRef.current = true;
      globalThis.setTimeout(() => {
        if (isAutoCaptureRunningRef.current && captureModeRef.current === 'auto') {
          startAutoCountdownForCurrentFrame();
        }
      }, 150);
    } else {
      setIsAutoCaptureRunning(false);
      isAutoCaptureRunningRef.current = false;
      clearAutoCaptureTimers();
      setCountdown(null);
    }
    if (!cameraStream) {
      startCamera(facingMode);
    }
  };

  const handleStopAutoCapture = () => {
    if (isStopButtonExiting) return;

    pauseAutoCapture();
    setIsStopButtonExiting(true);
    clearStopExitTimer();

    stopExitTimerRef.current = globalThis.setTimeout(() => {
      stopExitTimerRef.current = null;
      setCaptureMode('manual');
      captureModeRef.current = 'manual';
      setIsStopButtonExiting(false);
      setManualRecordEntering(true);
      globalThis.setTimeout(() => setManualRecordEntering(false), 500);
    }, 500);
  };

  // Start auto countdown when advancing to a new empty frame or when camera becomes ready
  useEffect(() => {
    if (
      boothStep !== 3 ||
      captureMode !== 'auto' ||
      !isAutoCaptureRunning ||
      (!isCameraActive && !isDemoPolaroidFeed) ||
      isSelectionFinalized ||
      isCurrentCaptureFrameFilled() ||
      isCountdownActiveRef.current ||
      countdownIntervalRef.current
    ) {
      return;
    }

    startAutoCountdownForCurrentFrame();
  }, [
    boothStep,
    captureMode,
    isAutoCaptureRunning,
    isCameraActive,
    activeCardIndex,
    activeStripSlot,
    isCurrentCaptureFrameFilled,
    isSelectionFinalized,
    isDemoPolaroidFeed,
    startAutoCountdownForCurrentFrame,
  ]);

  useEffect(() => {
    if (!isAutoCaptureRunning || captureMode !== 'auto') {
      clearAutoCaptureTimers();
      if (!isAutoCaptureRunning) {
        setCountdown(null);
      }
    }
  }, [captureMode, isAutoCaptureRunning, clearAutoCaptureTimers]);

  useEffect(() => {
    return () => {
      clearAutoCaptureTimers();
      clearStopExitTimer();
    };
  }, [clearAutoCaptureTimers, clearStopExitTimer]);



  useEffect(() => {
    const handleScroll = () => {
      const viewportHeight = window.innerHeight;
      const scrollY = window.scrollY;

      // Dynamic scroll-driven text blur & fade transition for the hero brand text (row1, row2, signature)
      const heroRatio = Math.min(1, scrollY / 350);
      const heroEased = heroRatio * heroRatio;
      const heroBlur = heroEased * 8;
      const heroOpacity = 1 - heroEased * 1.0;

      const brandBlock = document.querySelector(`.${heroStyles.brandBlock}`);

      if (brandBlock instanceof HTMLElement) {
        brandBlock.style.filter = heroBlur > 0.1 ? `blur(${heroBlur}px)` : '';
        brandBlock.style.opacity = `${heroOpacity}`;
      }

      // Dynamic scroll-driven text blur & fade transition for the start description section
      const startSection = document.getElementById('start');
      if (startSection) {
        const rect = startSection.getBoundingClientRect();
        const sectionCenter = rect.top + rect.height / 2;
        const viewportCenter = viewportHeight / 2;
        const distanceFromCenter = Math.abs(sectionCenter - viewportCenter);

        const settleWindow = viewportHeight * 0.12;
        let ratio = 0;
        if (distanceFromCenter > settleWindow) {
          const maxDistance = viewportHeight * 0.45;
          ratio = Math.min(1, (distanceFromCenter - settleWindow) / maxDistance);
        }

        const easedRatio = ratio * ratio;
        const blurVal = easedRatio * 8;
        const opacityVal = 1 - easedRatio * 0.75;

        const title = startSection.querySelector(`.${styles.sectionTitle}`);
        const body = startSection.querySelector(`.${styles.sectionBody}`);
        const cta = startSection.querySelector(`.${styles.cta}`);

        if (title instanceof HTMLElement) {
          title.style.filter = blurVal > 0.1 ? `blur(${blurVal}px)` : '';
          title.style.opacity = `${opacityVal}`;
        }
        if (body instanceof HTMLElement) {
          body.style.filter = blurVal > 0.1 ? `blur(${blurVal}px)` : '';
          body.style.opacity = `${opacityVal}`;
        }
        if (cta instanceof HTMLElement) {
          cta.style.filter = 'none';
          cta.style.opacity = '1';
        }
      }

      if (ctaContainerRef.current && typeof window !== 'undefined' && window.innerWidth <= 768) {
        const rect = ctaContainerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        // Dock when the container's natural position enters the bottom of the viewport
        if (rect.top <= viewportHeight - 110) {
          setIsCtaSticky(false);
        } else {
          setIsCtaSticky(true);
        }
      } else {
        setIsCtaSticky(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  return (
    <main className={styles.page}>
      <PhotoboothHero />

      <div className={styles.spotlightText}>
        Want to be on the spotlight?{' '}
        <a
          href="https://www.instagram.com/myscribble.in/"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.spotlightLink}
        >
          Message us
        </a>
      </div>

      <section id="start" className={styles.section} aria-labelledby="pb-section-title">
        <h2 id="pb-section-title" className={styles.sectionTitle}>
          Paste your moments into a living scrapbook
        </h2>
        <p className={styles.sectionBody}>
          Pick a frame, drop in your photos, and let the orbit carry the rest. PhotoBooth turns everyday
          snapshots into a warm, editorial keepsake — tape, tilt, and all.
        </p>
        <div ref={ctaContainerRef} className={styles.ctaContainer}>
          <button
            onClick={() => setIsBoothOpen(true)}
            className={`${styles.cta} ${styles.shimmerCta} ${isCtaSticky && !isBoothOpen ? styles.ctaSticky : styles.ctaDocked}`}
          >
            Open the booth
          </button>
          <span style={{ color: '#a1a1aa', fontSize: '0.82rem', fontWeight: 500, letterSpacing: '0.06em', fontFamily: 'var(--font-inter), sans-serif' }}>
            Beta
          </span>
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.wideSection} ${styles.guideWrapper}`}
        aria-labelledby="pb-how-it-works-title"
      >
        <div className={styles.mainAccordionItem}>
          <button
            type="button"
            className={styles.mainAccordionHeader}
            onClick={() => setIsHowItWorksOpen(prev => !prev)}
            aria-expanded={isHowItWorksOpen}
          >
            <h2 id="pb-how-it-works-title" className={`${styles.sectionTitle} ${styles.mainAccordionTitle}`}>
              But, How does it work?
            </h2>
            <span className={styles.mainAccordionIcon}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="40"
                height="40"
                style={{
                  transition: 'transform 0.3s ease',
                  transform: isHowItWorksOpen ? 'rotate(90deg)' : 'rotate(0deg)'
                }}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
          </button>
          <div className={`${styles.mainAccordionContent} ${isHowItWorksOpen ? styles.mainAccordionContentOpen : ''}`}>
            <div className={styles.mainAccordionInner}>
              <div className={styles.stepsVerticalList}>
                {steps.map((step) => {
                  return (
                    <div key={step.id} className={styles.stepRow}>
                      <div className={styles.stepTextCol}>
                        <h3 className={`${styles.stepRowTitle} ${instrumentSerif.className}`}>{step.title}</h3>
                        <p className={styles.stepRowDesc}>{step.body}</p>
                        {step.id === 4 && (
                          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.6rem' }}>
                            <button
                              onClick={() => setIsBoothOpen(true)}
                              className={`${styles.cta} ${styles.shimmerCta}`}
                            >
                              Open the booth
                            </button>
                            <span style={{ color: '#a1a1aa', fontSize: '0.82rem', fontWeight: 500, letterSpacing: '0.06em', fontFamily: 'var(--font-inter), sans-serif', marginLeft: '2.2rem' }}>
                              Beta
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Sticky Step 1 Continue Bar */}
      {isBoothOpen && boothStep === 1 && selectedVibe !== null && (
        <div className={styles.mobileStep1StickyFooter}>
          <button
            type="button"
            className={`${styles.continueButton} ${styles.continueButtonEnabled}`}
            onClick={() => {
              if (boothStep === 1) {
                setBoothStep(2);
              }
            }}
          >
            <span className={styles.continueBtnText}>Continue</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>
      )}

      {/* PhotoBooth Fullscreen Popup Overlay */}
      <div
        className={`${styles.boothOverlay} ${isBoothOpen ? styles.boothOverlayActive : ''}`}
        data-step={boothStep}
        data-step1-selected={boothStep === 1 && selectedVibe !== null ? 'true' : undefined}
        data-completed={activeCardIndex === quantity}
        data-finalized={isSelectionFinalized ? 'true' : undefined}
        data-printer-active={isSelectionFinalized && isSequenceAtOrPast(completionSequenceStep, 'printer') && completionSequenceStep !== 'done' ? 'true' : undefined}
        data-show-close={showActionStrip ? 'true' : undefined}
        data-editing-from-completion={editingFromCompletion ? 'true' : undefined}
        data-lenis-prevent
      >
        {boothStep === 3 && !isSelectionFinalized && !hasFinalizedOnce && !editingFromCompletion && (
          <button
            onClick={() => {
              const hasAnyCaptured = hasAnyCapturedPhotos();
              if (hasAnyCaptured) {
                setConfirmationAction('back');
                setIsCloseConfirmationOpen(true);
              } else {
                stopCamera();
                setBoothStep(2);
                setActiveCardIndex(0);
              }
            }}
            className={styles.topLeftBackButton}
            aria-label="Go back"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back</span>
          </button>
        )}
        {boothStep === 3 && quantity > 1 && !isSelectionFinalized && (
          <>
            <button
              type="button"
              className={`${styles.navArrow} ${styles.navArrowLeft}`}
              onClick={() => setActiveCardIndex(prev => Math.max(0, prev - 1))}
              disabled={activeCardIndex === 0}
              aria-label="Previous card"
            >
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="50" height="50">
                <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                <g id="SVGRepo_iconCarrier">
                  <path d="M14 7L9 12L14 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                </g>
              </svg>
            </button>
            <button
              type="button"
              className={`${styles.navArrow} ${styles.navArrowRight}`}
              onClick={() => setActiveCardIndex(prev => Math.min(quantity - 1, prev + 1))}
              disabled={activeCardIndex === quantity - 1}
              aria-label="Next card"
            >
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="50" height="50">
                <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                <g id="SVGRepo_iconCarrier">
                  <path d="M10 7L15 12L10 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                </g>
              </svg>
            </button>
          </>
        )}
        {/* Fullscreen screen flash glow effect */}
        {showFlash && (
          <div className={styles.screenFlashOverlay} aria-hidden="true" />
        )}
        <button
          onClick={() => {
            const hasAnyCaptured = hasAnyCapturedPhotos();
            if (hasAnyCaptured) {
              setConfirmationAction('close');
              setIsCloseConfirmationOpen(true);
            } else {
              closeBooth();
            }
          }}
          className={styles.closeBoothButton}
          aria-label="Close booth"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
            <g id="SVGRepo_iconCarrier">
              <path fillRule="evenodd" clipRule="evenodd" d="M19.207 6.207a1 1 0 0 0-1.414-1.414L12 10.586 6.207 4.793a1 1 0 0 0-1.414 1.414L10.586 12l-5.793 5.793a1 1 0 1 0 1.414 1.414L12 13.414l5.793 5.793a1 1 0 0 0 1.414-1.414L13.414 12l5.793-5.793z" fill="currentColor"></path>
            </g>
          </svg>
        </button>
        {boothStep === 3 && !isSelectionFinalized && (
          <button
            type="button"
            className={`${styles.flashToggleBtn} ${isFlashEnabled ? styles.flashToggleBtnActive : ''}`}
            onClick={() => setIsFlashEnabled((prev) => !prev)}
            aria-label={isFlashEnabled ? 'Turn off flash' : 'Turn on flash'}
            title={isFlashEnabled ? 'Flash ON' : 'Flash OFF'}
          >
            {isFlashEnabled ? (
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
                <path d="M13 2L3 14h7v8l11-13h-8l0-7z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true">
                <path d="M13 2L3 14h7v8l11-13h-8l0-7z" />
                <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2.2" />
              </svg>
            )}
          </button>
        )}
        {boothStep === 3 && !isSelectionFinalized && (
          <button
            type="button"
            className={`${styles.cameraContinueBtn} ${styles.mobileHeaderContinueBtn} ${styles.cameraContinueBtnIconOnly}`}
            onClick={() => {
              if (editingFromCompletion) {
                stopCamera();
                setEditingFromCompletion(false);
                setIsSelectionFinalized(true);
              } else {
                handleFinalizeSelection();
              }
            }}
            disabled={getCapturedPhotoCount() === 0}
            aria-label={editingFromCompletion ? 'Done editing' : 'Continue'}
            title={editingFromCompletion ? 'Done editing' : 'Continue'}
          >
            {editingFromCompletion ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        )}
        <div
          ref={boothContentRef}
          className={`${styles.boothContent} ${isSelectionFinalized ? styles.boothContentFinalized : ''}`}
        >
          {!isSelectionFinalized && (
            <div className={styles.boothHeader}>
              <div key={boothStep} className={styles.boothTitleBlock}>
                <h2 className={styles.boothTitle}>
                  {boothStep === 1 ? 'Pick Your Vibe' : 'Lets Add Some Memories'}
                </h2>
                <p className={styles.boothDescription}>
                  {boothStep === 1
                    ? 'Every memory has a style. Choose how yours gets remembered.'
                    : 'Take a photo now or upload one from your gallery.'}
                </p>
              </div>
            </div>
          )}

          {isSelectionFinalized ? (
            <div
              className={styles.completionContainer}
              data-sequence-step={completionSequenceStep}
            >
              {(completionSequenceStep === 'idle' || completionSequenceStep === 'exit') && (
                <div className={styles.completionHeader}>
                  <h2
                    className={`${styles.boothTitle} ${styles.completionSequenceTitle} ${isSequenceAtOrPast(completionSequenceStep, 'exit') ? styles.completionSequenceBlurOut : ''}`}
                    style={{ textAlign: 'center', fontStyle: 'italic' }}
                  >
                    Your Keepsakes
                  </h2>
                  <p
                    className={`${styles.boothDescription} ${styles.completionSequenceDescription} ${isSequenceAtOrPast(completionSequenceStep, 'exit') ? styles.completionSequenceBlurOut : ''}`}
                    style={{ textAlign: 'center', margin: '0.5rem auto 0' }}
                  >
                    {isEditingLocked
                      ? 'Your keepsakes are ready. Download them or order prints below.'
                      : 'Here are your customized moments. Save them to your scrapbook or retake them.'}
                  </p>
                </div>
              )}

              {!isSequenceAtOrPast(completionSequenceStep, 'printer') && (
                <div
                  className={`${styles.completionGrid} ${selectedVibe === 'strip' ? styles.completionGridStrip : ''} ${isSequenceAtOrPast(completionSequenceStep, 'exit') ? styles.completionSequenceBlurOut : ''}`}
                >
                  {keepsakePhotos.map((photo, idx) => {
                    const mergeOffset = getStackMergeOffset(idx);
                    const isStacked = false;
                    const isStackingNow = false;
                    const isWaiting = false;

                    return (
                      <div
                        key={idx}
                        className={`${styles.completionCardWrapper} ${selectedVibe === 'polaroid'
                          ? styles.completionCardWrapperPolaroid
                          : styles.completionCardWrapperStrip
                          } ${isStacked ? styles.completionCardStacked : ''} ${isStackingNow ? styles.completionCardStacking : ''} ${isWaiting ? styles.completionCardWaiting : ''}`}
                        style={{
                          animationDelay: completionSequenceStep === 'idle' ? `${idx * 0.15}s` : '0s',
                          cursor: completionSequenceStep === 'idle' && !isEditingLocked ? 'pointer' : 'default',
                          pointerEvents: completionSequenceStep === 'idle' && !isEditingLocked ? 'auto' : 'none',
                          ['--merge-from-x' as string]: mergeOffset.x,
                          ['--merge-from-y' as string]: mergeOffset.y,
                          ['--stack-index' as string]: String(idx),
                        }}
                        onClick={() => {
                          if (completionSequenceStep !== 'idle') return;
                          handleCompletionEdit(idx);
                        }}
                      >
                        <div className={styles.completionFrameShell}>
                          {renderKeepsakeFrame(photo, idx)}
                          {completionSequenceStep === 'idle' && !isEditingLocked && (
                            renderPolaroidFrameActions(idx, 'completion')
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Printer animation scene and packaging box */}
              {completionSequenceStep !== 'idle' && (
                <div
                  className={`${styles.printerSceneWrapper} ${showActionStrip ? styles.printerSceneShifted : ''}`}
                >
                  <div className={`${styles.printerScene} ${completionSequenceStep === 'done' ? styles.printerSceneDone : ''}`}>
                    <div className={styles.printerMachineWrap}>
                      <img
                        src={selectedVibe === 'strip' ? '/strip_printer.png' : COMPLETION_PRINTER_IMAGE}
                        alt="Photo printer"
                        className={`${styles.printerMachine} ${isSequenceAtOrPast(completionSequenceStep, 'printer') ? styles.printerMachineVisible : ''}`}
                        draggable={false}
                      />

                      {/* Status LED Light */}
                      <div
                        className={`${styles.printerLedLight} ${completionSequenceStep === 'print' || completionSequenceStep === 'done' ? styles.printerLedActive : ''
                          } ${completionSequenceStep === 'print'
                            ? styles.printerLedPrinting
                            : completionSequenceStep === 'done'
                              ? styles.printerLedDone
                              : ''
                          }`}
                      />

                      {/* Polaroid cards stack renders inside the printerMachineWrap for perfect alignment and slot clipping! */}
                      <div className={styles.printerOutputStack} data-output-stack="true">
                        {keepsakePhotos.slice(0, printOutputCount).map((photo, idx) => (
                          <div
                            key={`output-${idx}`}
                            className={`${styles.printerPolaroidCard} ${styles.printerPolaroidEmerging} ${selectedVibe === 'polaroid' ? styles.printerPolaroidCardPolaroid : styles.printerPolaroidCardStrip}`}
                            style={{ ['--output-index' as string]: String(idx) }}
                          >
                            {renderKeepsakeFrame(photo, idx, true)}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Scroll down shimmer hint — mobile only, shown when box is packed */}
                    {completionSequenceStep === 'done' && (
                      <div className={styles.scrollDownHint}>
                        <span className={styles.scrollDownShimmer}>Scroll down</span>
                        <svg
                          className={styles.scrollDownArrow}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          width="14"
                          height="14"
                          aria-hidden="true"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    )}

                    {/* Open packaging box base (1.png) - z-index 5, below polaroids */}
                    <div className={`${styles.boxContainer} ${selectedVibe === 'strip' ? styles.boxContainerStrip : ''} ${isSequenceAtOrPast(completionSequenceStep, 'printer') ? styles.boxContainerVisible : ''} ${completionSequenceStep === 'done' ? styles.boxClosed : ''}`}>
                      <img
                        src={selectedVibe === 'strip' ? '/12.png' : '/1.png'}
                        alt="Open box"
                        className={styles.boxOpenImg}
                      />
                    </div>

                    {/* Box lid (2.png) - z-index 25, above polaroids */}
                    <div className={`${styles.boxLidContainer} ${selectedVibe === 'strip' ? styles.boxLidContainerStrip : ''} ${isSequenceAtOrPast(completionSequenceStep, 'printer') ? styles.boxLidContainerVisible : ''}`}>
                      <img
                        src={selectedVibe === 'strip' ? '/13.png' : '/2.png'}
                        alt="Closed box"
                        className={`${styles.boxClosedImg} ${completionSequenceStep === 'done' ? styles.boxClosedImgVisible : ''}`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Strip rendered bottom but not sticky — shown 2s after lid closes */}
              {showActionStrip && (
                <div
                  className={`${styles.completionActionStrip} ${styles.completionActionStripScrollable} ${styles.completionActionStripEnter}`}
                >
                  <div className={styles.completionActionRow}>
                    <button
                      type="button"
                      className={`${styles.completionActionBtn} ${styles.completionActionBtnPrimary}`}
                      onClick={handleDownloadKeepsakes}
                    >
                      <svg
                        className={styles.completionActionBtnIcon}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        width="18"
                        height="18"
                        aria-hidden="true"
                      >
                        <path d="M12 3v12" />
                        <path d="M7 10l5 5 5-5" />
                        <path d="M5 21h14" />
                      </svg>
                      Download Now
                    </button>
                    <span className={styles.completionActionOr} aria-hidden="true">OR</span>
                    <button
                      type="button"
                      className={`${styles.completionActionBtn} ${styles.completionActionBtnSecondary}`}
                      onClick={openPrintOrderPopup}
                    >
                      <svg
                        className={styles.completionActionBtnIcon}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        width="18"
                        height="18"
                        aria-hidden="true"
                      >
                        <path d="M6 9V2h12v7" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <path d="M6 14h12v8H6z" />
                      </svg>
                      Get them printed: ₹14/Pc
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.vibesContainer}>
              <div className={styles.vibesGrid}>
                {vibes.map((vibe) => {
                  const isSelected = selectedVibe === vibe.id;

                  let step2Class = '';
                  if (boothStep === 2 || boothStep === 3) {
                    if (isSelected) {
                      if (boothStep === 2) {
                        step2Class = vibe.id === 'polaroid' ? styles.vibeCardStep2Polaroid : styles.vibeCardStep2Strip;
                      } else {
                        step2Class = vibe.id === 'polaroid' ? styles.vibeCardStep3Polaroid : styles.vibeCardStep3Strip;
                      }
                    } else {
                      step2Class = styles.vibeCardHidden;
                    }
                  }

                  const momentsChoices = vibe.id === 'polaroid'
                    ? [
                      { count: 1, label: 'Single Polaroid', desc: '1 classic memory frame.' },
                      { count: 4, label: 'Double Pair', desc: '4 photo layout cards.' },
                      { count: 9, label: 'Scrapbook Pack', desc: '9 editorial square prints.' }
                    ]
                    : [
                      { count: 1, label: 'Single Strip', desc: '1 photobooth vertical film strip.' },
                      { count: 2, label: 'Double Strips', desc: '2 matching vertical film strips.' },
                      { count: 4, label: 'Arcade Pack', desc: '4 vertical strip photo frames.' }
                    ];

                  return (
                    <div key={vibe.id} className={styles.gridCell}>
                      <div
                        role="button"
                        tabIndex={boothStep === 1 ? 0 : -1}
                        className={`${styles.vibeCard} ${isSelected ? styles.vibeCardActive : ''} ${step2Class} ${(boothStep === 2 || boothStep === 3) ? styles.vibeCardPreview : ''}`}
                        onClick={() => {
                          if (boothStep === 2 || boothStep === 3) return;
                          setSelectedVibe(vibe.id);
                          if (vibe.id === 'polaroid') {
                            setPolaroidClickKey(prev => prev + 1);
                          } else {
                            setStripClickKey(prev => prev + 1);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (boothStep === 2 || boothStep === 3) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedVibe(vibe.id);
                            if (vibe.id === 'polaroid') {
                              setPolaroidClickKey(prev => prev + 1);
                            } else {
                              setStripClickKey(prev => prev + 1);
                            }
                          }
                        }}
                      >
                        <div className={styles.vibeVisualWrapper}>
                          {isSelected && (
                            <div
                              key={vibe.id === 'polaroid' ? polaroidClickKey : stripClickKey}
                              className={styles.vibeGradientLight}
                              style={{ display: boothStep === 3 ? 'none' : '' }}
                            />
                          )}
                          <div className={styles.selectIndicator}>
                            {isSelected && (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="12" height="12">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            )}
                          </div>

                          <div className={`${styles.photoStack} ${styles[`stack-${vibe.type}`]}`}>
                            {boothStep === 3 ? (
                              <div
                                className={styles.queueContainer}
                                style={{ cursor: 'default', pointerEvents: 'auto' }}
                                data-transitioning={isStep3Transitioning}
                              >
                                {!isSelectionFinalized && (
                                  <div className={styles.queueHeader}>
                                    {vibe.type === 'polaroid' && (
                                      <label className={styles.demoFeedToggle}>
                                        <input
                                          type="checkbox"
                                          checked={isDemoPolaroidFeed}
                                          onChange={(e) => setIsDemoPolaroidFeed(e.target.checked)}
                                        />
                                        <span className={styles.demoFeedToggleTrack} aria-hidden="true">
                                          <span className={styles.demoFeedToggleThumb} />
                                        </span>
                                        <span className={styles.demoFeedToggleLabel}>Sample photo feed</span>
                                      </label>
                                    )}
                                    <div className={`${styles.queueCounter} ${styles.queueCounterMobile}`}>
                                      <span>Total: {vibe.type === 'strip' ? getQueueCounterTotal() : getCapturedPhotoCount()}</span>
                                      <span className={styles.queueCounterDot} aria-hidden="true">·</span>
                                      <span>Current: {activeCardIndex + 1}</span>
                                    </div>
                                  </div>
                                )}
                                {Array.from({ length: quantity }).map((_, idx) => {
                                  const diff = idx - activeCardIndex;
                                  const isPast = diff < 0;
                                  const isActive = diff === 0;
                                  const isFuture = diff > 0;

                                  let cardStyle: React.CSSProperties = {};
                                  if (!step3TransitionStarted) {
                                    // Initial state: mimic Step 2 stack card layout
                                    if (idx === 0) {
                                      cardStyle = {
                                        transform: 'translate(-50%, -50%) scale(1.85) rotate(0deg)',
                                        zIndex: 10,
                                        opacity: 1,
                                        pointerEvents: 'none',
                                      };
                                    } else {
                                      const extra = stackCardExtraStyles[(idx - 1) % stackCardExtraStyles.length];
                                      cardStyle = {
                                        transform: `translate(calc(-50% + ${extra.x}px), calc(-50% + ${extra.y}px)) rotate(${extra.rotate}deg) scale(1.8)`,
                                        zIndex: extra.zIndex,
                                        opacity: 1,
                                        pointerEvents: 'none',
                                      };
                                    }
                                  } else {
                                    // Standard Step 3 horizontal lineup styles
                                    if (vibe.type === 'polaroid') {
                                      if (isSelectionFinalized) {
                                        const xOffset = diff * 180;
                                        const scale = isActive ? 2.8 : 1.8;
                                        const opacity = 1.0;
                                        cardStyle = {
                                          transform: `translate(calc(-50% + ${xOffset}px), -50%) scale(${scale}) rotate(0deg)`,
                                          zIndex: isActive ? 10 : 5 - Math.abs(diff),
                                          opacity: opacity,
                                          pointerEvents: 'none',
                                        };
                                      } else {
                                        if (isActive) {
                                          cardStyle = {
                                            transform: 'translate(-50%, -50%) scale(2.8) rotate(0deg)',
                                            zIndex: 10,
                                            opacity: 1,
                                            pointerEvents: 'none',
                                          };
                                        } else if (isFuture) {
                                          const xOffset = diff * 150 + 200;
                                          const scale = Math.max(1.0, 2.0 - diff * 0.2);
                                          const opacity = 1.0;
                                          cardStyle = {
                                            transform: `translate(calc(-50% + ${xOffset}px), -50%) scale(${scale}) rotate(0deg)`,
                                            zIndex: 10 - diff,
                                            opacity: opacity,
                                            pointerEvents: 'none',
                                          };
                                        } else {
                                          const xOffset = diff * 150 - 200;
                                          const scale = Math.max(1.0, 2.0 + diff * 0.2);
                                          const opacity = 1.0;
                                          cardStyle = {
                                            transform: `translate(calc(-50% + ${xOffset}px), -50%) scale(${scale}) rotate(0deg)`,
                                            zIndex: 5 + diff,
                                            opacity: opacity,
                                            pointerEvents: 'none',
                                          };
                                        }
                                      }
                                    } else {
                                      if (isSelectionFinalized) {
                                        const xOffset = diff * 120;
                                        const scale = isActive ? 2.4 : 1.5;
                                        const opacity = isActive ? 1.0 : 0.55;
                                        cardStyle = {
                                          transform: `translate(calc(-50% + ${xOffset}px), -50%) scale(${scale}) rotate(0deg)`,
                                          zIndex: isActive ? 10 : 5 - Math.abs(diff),
                                          opacity: opacity,
                                          pointerEvents: 'none',
                                        };
                                      } else {
                                        if (isActive) {
                                          cardStyle = {
                                            transform: 'translate(-50%, -50%) scale(2.4) rotate(0deg)',
                                            zIndex: 10,
                                            opacity: 1,
                                            pointerEvents: 'none',
                                          };
                                        } else if (isFuture) {
                                          const xOffset = diff * 110 + 130;
                                          const scale = Math.max(0.9, 1.8 - diff * 0.18);
                                          cardStyle = {
                                            transform: `translate(calc(-50% + ${xOffset}px), -50%) scale(${scale}) rotate(0deg)`,
                                            zIndex: 10 - diff,
                                            opacity: 1,
                                            pointerEvents: 'none',
                                          };
                                        } else {
                                          const xOffset = diff * 110 - 130;
                                          const scale = Math.max(0.9, 1.8 + diff * 0.18);
                                          cardStyle = {
                                            transform: `translate(calc(-50% + ${xOffset}px), -50%) scale(${scale}) rotate(0deg)`,
                                            zIndex: 5 + diff,
                                            opacity: 1,
                                            pointerEvents: 'none',
                                          };
                                        }
                                      }
                                    }
                                  }

                                  const savedFrameId = capturedPhotos[idx]?.frameId;
                                  const cardFrameId = typeof cardFrames[idx] === 'number' ? cardFrames[idx] : (typeof savedFrameId === 'number' ? savedFrameId : selectedFrame);
                                  let frameClass = '';
                                  if (cardFrameId === 1) {
                                    frameClass = styles.polaroidFrameBlobPattern;
                                  } else if (cardFrameId === 2) {
                                    frameClass = styles.polaroidFrameStickerPopPattern;
                                  } else if (cardFrameId === 3) {
                                    frameClass = styles.polaroidFrameComicBlastPattern;
                                  } else if (cardFrameId === 4) {
                                    frameClass = styles.polaroidFrameCandyPinkPattern;
                                  } else if (cardFrameId === 5) {
                                    frameClass = styles.polaroidFrameSweetKissPattern;
                                  } else if (cardFrameId === 6) {
                                    frameClass = styles.polaroidFrameStarlightPattern;
                                  } else if (cardFrameId === 7) {
                                    frameClass = styles.polaroidFrameBluebellPattern;
                                  } else if (cardFrameId === 8) {
                                    frameClass = styles.polaroidFramePixelPaintPattern;
                                  }

                                  return (
                                    <div
                                      key={idx}
                                      className={`${styles.queueCard} ${isActive ? styles.queueCardActive : ''} ${isPast ? styles.queueCardPast : ''} ${isFuture ? styles.queueCardFuture : ''} ${vibe.type === 'polaroid' ? styles.queueCardPolaroid : styles.queueCardStrip} ${frameClass}`}
                                      style={{
                                        ...cardStyle,
                                        cursor: (selectedOption === 'upload' && isActive && (
                                          vibe.type === 'polaroid'
                                            ? !capturedPhotos[idx]
                                            : !isStripComplete(getStripSlotsFor(idx))
                                        )) || (selectedOption === 'camera' && isDemoPolaroidFeed && isDemoFeedReady && isActive && !capturedPhotos[idx] && vibe.type === 'polaroid') ? 'pointer' : 'default',
                                        pointerEvents: allPhotosFilled && capturedPhotos[idx] && vibe.type === 'polaroid' ? 'auto' : cardStyle.pointerEvents,
                                      }}
                                      draggable={false}
                                      onClick={() => {
                                        if (!isActive) return;
                                        if (vibe.type === 'strip' && isStripComplete(getStripSlotsFor(idx))) return;
                                        if (vibe.type === 'polaroid' && capturedPhotos[idx]) return;
                                        if (selectedOption === 'upload') {
                                          fileInputRef.current?.click();
                                        } else if (
                                          selectedOption === 'camera' &&
                                          isDemoPolaroidFeed &&
                                          isDemoFeedReady &&
                                          vibe.type === 'polaroid'
                                        ) {
                                          commitManualCapture(idx);
                                        }
                                      }}
                                    >
                                      {vibe.type === 'polaroid' ? (
                                        <div className={`${styles.polaroidFrameContainer} ${frameClass}`} style={{ margin: 0, maxWidth: 'none', width: '100%', height: '100%', padding: '8px 8px 30px' }}>
                                          {allPhotosFilled && capturedPhotos[idx] && (
                                            renderPolaroidFrameActions(idx, 'capture')
                                          )}
                                          <div
                                            className={styles.polaroidInnerSlot}
                                            style={{
                                              ...(cardFrameId === 8 ? {
                                                position: 'absolute',
                                                left: '25.9755%',
                                                top: '13.7272%',
                                                width: '66.93%',
                                                height: '68.09%',
                                                aspectRatio: 'auto',
                                              } : {}),
                                              cursor: isDemoPolaroidFeed && isActive && capturedPhotos[idx] == null && isDemoFeedReady
                                                ? 'pointer'
                                                : undefined,
                                            }}
                                            onClick={(e) => {
                                              if (
                                                isDemoPolaroidFeed &&
                                                isActive &&
                                                capturedPhotos[idx] == null &&
                                                isDemoFeedReady &&
                                                selectedOption === 'camera'
                                              ) {
                                                e.stopPropagation();
                                                commitManualCapture(idx);
                                              }
                                            }}
                                          >
                                            {capturedPhotos[idx] == null ? (
                                              isCameraActive || (isDemoPolaroidFeed && vibe.type === 'polaroid') ? (
                                                <>
                                                  {isDemoPolaroidFeed && vibe.type === 'polaroid' ? (
                                                    <DemoFeedPreview
                                                      filterId={activeFilter}
                                                      filterCss={currentFilterCss}
                                                      src={DEMO_POLAROID_FEED_URL}
                                                      className={styles.cameraVideo}
                                                      crossOrigin="anonymous"
                                                      imgRef={demoPolaroidImgRef}
                                                      previewActive={isActive}
                                                      onLoad={(img) => {
                                                        demoPolaroidImgRef.current = img;
                                                        setIsDemoFeedReady(true);
                                                      }}
                                                    />
                                                  ) : cameraStream ? (
                                                    <LiveCameraFeed
                                                      filterId={activeFilter}
                                                      filterCss={currentFilterCss}
                                                      mirror={isStreamMirrored}
                                                      className={styles.cameraVideo}
                                                      cameraStream={cameraStream}
                                                      previewActive={isActive}
                                                      setVideoRef={
                                                        isActive
                                                          ? videoCallbackRef
                                                          : (node) => {
                                                            if (node && cameraStream && node.srcObject !== cameraStream) {
                                                              node.srcObject = cameraStream;
                                                              node.play().catch(() => { });
                                                            }
                                                          }
                                                      }
                                                      attachStream={isActive}
                                                    />
                                                  ) : (
                                                    <div className={styles.simulatedCamera}>
                                                      <div className={styles.simulatedCameraPulse} />
                                                      <span>Webcam Feed</span>
                                                    </div>
                                                  )}
                                                  {isActive && captureMode === 'auto' && countdown !== null && (
                                                    <div className={styles.countdownOverlay}>
                                                      <div className={styles.countdownNumber}>
                                                        {countdown === 0 ? '📸' : countdown}
                                                      </div>
                                                    </div>
                                                  )}
                                                  {isActive && showFlash && <div className={styles.cameraFlash} />}
                                                </>
                                              ) : (
                                                <img src={vibe.images[idx % vibe.images.length]} alt="" className={styles.stackImg} draggable={false} style={{ filter: vibePlaceholderFilterCss }} />
                                              )
                                            ) : (
                                              <img src={capturedPhotos[idx]?.url || vibe.images[idx % vibe.images.length]} alt="" className={styles.stackImg} draggable={false} style={{ filter: capturedPhotos[idx] ? (isCanvasBakedFilter(capturedPhotos[idx].filterId) ? 'none' : (FILTERS.find(f => f.id === capturedPhotos[idx]?.filterId)?.filterCss || 'none')) : vibePlaceholderFilterCss }} />
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className={styles.stripColumn} style={{ gap: '2px', width: '100%', height: '100%' }}>
                                          {Array.from({ length: STRIP_SLOT_COUNT }).map((_, slotIdx) => (
                                            <div key={slotIdx} className={styles.stripMiniImg} style={{ aspectRatio: '1/1', position: 'relative' }}>
                                              {renderLiveStripSlot(idx, slotIdx, isActive)}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              vibe.type === 'polaroid' ? (
                                <>
                                  <div className={`${styles.stackCard} ${styles.stackCardLeft}`}>
                                    <div className={styles.stackImgWrapper}>
                                      <img src={vibe.images[0]} alt="" className={styles.stackImg} />
                                    </div>
                                  </div>
                                  <div className={`${styles.stackCard} ${styles.stackCardRight}`}>
                                    <div className={styles.stackImgWrapper}>
                                      <img src={vibe.images[1]} alt="" className={styles.stackImg} />
                                    </div>
                                  </div>
                                  <div className={`${styles.stackCard} ${styles.stackCardCenter}`}>
                                    <div className={styles.stackImgWrapper}>
                                      {isCameraActive ? (
                                        cameraStream ? (
                                          <LiveCameraFeed
                                            filterId={activeFilter}
                                            filterCss={currentFilterCss}
                                            mirror={isStreamMirrored}
                                            className={styles.cameraVideo}
                                            cameraStream={cameraStream}
                                            setVideoRef={videoCallbackRef}
                                          />
                                        ) : (
                                          <div className={styles.simulatedCamera}>
                                            <div className={styles.simulatedCameraPulse} />
                                            <span>Webcam Feed</span>
                                          </div>
                                        )
                                      ) : (
                                        <img src={vibe.images[2]} alt="" className={styles.stackImg} style={{ filter: vibePlaceholderFilterCss }} />
                                      )}
                                    </div>
                                  </div>
                                  {(boothStep === 2 || boothStep === 3) && Array.from({ length: 8 }).map((_, idx) => {
                                    const isVisible = quantity - 1 > idx;
                                    const imageIndex = (idx + 1) % vibe.images.length;
                                    return (
                                      <div
                                        key={idx}
                                        className={`${styles.stackCard} ${styles[`stackCardExtra${idx + 1}`]} ${isVisible ? styles.stackCardExtraVisible : ''}`}
                                      >
                                        <div className={styles.stackImgWrapper}>
                                          <img src={vibe.images[imageIndex]} alt="" className={styles.stackImg} style={{ filter: vibePlaceholderFilterCss }} />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </>
                              ) : (
                                <>
                                  <div className={`${styles.stackCard} ${styles.stackCardLeft}`}>
                                    <div className={styles.stripColumn}>
                                      <div className={styles.stripMiniImg}><img src={vibe.images[0]} alt="" className={styles.stackImg} style={{ filter: vibePlaceholderFilterCss }} /></div>
                                      <div className={styles.stripMiniImg}><img src={vibe.images[1]} alt="" className={styles.stackImg} style={{ filter: vibePlaceholderFilterCss }} /></div>
                                      <div className={styles.stripMiniImg}><img src={vibe.images[2]} alt="" className={styles.stackImg} style={{ filter: vibePlaceholderFilterCss }} /></div>
                                    </div>
                                  </div>
                                  <div className={`${styles.stackCard} ${styles.stackCardRight}`}>
                                    <div className={styles.stripColumn}>
                                      <div className={styles.stripMiniImg}><img src={vibe.images[1]} alt="" className={styles.stackImg} style={{ filter: vibePlaceholderFilterCss }} /></div>
                                      <div className={styles.stripMiniImg}><img src={vibe.images[2]} alt="" className={styles.stackImg} style={{ filter: vibePlaceholderFilterCss }} /></div>
                                      <div className={styles.stripMiniImg}><img src={vibe.images[0]} alt="" className={styles.stackImg} style={{ filter: vibePlaceholderFilterCss }} /></div>
                                    </div>
                                  </div>
                                  <div className={`${styles.stackCard} ${styles.stackCardCenter}`}>
                                    <div className={styles.stripColumn}>
                                      <div className={styles.stripMiniImg}>
                                        {isCameraActive ? (
                                          cameraStream ? (
                                            <LiveCameraFeed
                                              filterId={activeFilter}
                                              filterCss={currentFilterCss}
                                              mirror={isStreamMirrored}
                                              className={styles.cameraVideo}
                                              cameraStream={cameraStream}
                                              setVideoRef={videoCallbackRef}
                                            />
                                          ) : (
                                            <div className={styles.simulatedCamera}>
                                              <div className={styles.simulatedCameraPulse} />
                                              <span>Feed</span>
                                            </div>
                                          )
                                        ) : (
                                          <img src={vibe.images[2]} alt="" className={styles.stackImg} style={{ filter: vibePlaceholderFilterCss }} />
                                        )}
                                      </div>
                                      <div className={styles.stripMiniImg}><img src={vibe.images[0]} alt="" className={styles.stackImg} style={{ filter: vibePlaceholderFilterCss }} /></div>
                                      <div className={styles.stripMiniImg}><img src={vibe.images[1]} alt="" className={styles.stackImg} style={{ filter: vibePlaceholderFilterCss }} /></div>
                                    </div>
                                  </div>
                                  {(boothStep === 2 || boothStep === 3) && Array.from({ length: 8 }).map((_, idx) => {
                                    const isVisible = quantity - 1 > idx;
                                    const img0 = vibe.images[(idx + 1) % vibe.images.length];
                                    const img1 = vibe.images[(idx + 2) % vibe.images.length];
                                    const img2 = vibe.images[(idx + 3) % vibe.images.length];
                                    return (
                                      <div
                                        key={idx}
                                        className={`${styles.stackCard} ${styles[`stackCardExtra${idx + 1}`]} ${isVisible ? styles.stackCardExtraVisible : ''}`}
                                      >
                                        <div className={styles.stripColumn}>
                                          <div className={styles.stripMiniImg}><img src={img0} alt="" className={styles.stackImg} style={{ filter: vibePlaceholderFilterCss }} /></div>
                                          <div className={styles.stripMiniImg}><img src={img1} alt="" className={styles.stackImg} style={{ filter: vibePlaceholderFilterCss }} /></div>
                                          <div className={styles.stripMiniImg}><img src={img2} alt="" className={styles.stackImg} style={{ filter: vibePlaceholderFilterCss }} /></div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </>
                              )
                            )}
                          </div>
                        </div>

                        <div className={styles.vibeInfo}>
                          <span className={styles.vibeName}>{vibe.name}</span>
                          <span className={styles.vibeDesc}>{vibe.description}</span>
                        </div>
                      </div>

                      {/* Moments options fade in inside the vacated grid cell */}
                      {boothStep === 2 && ((vibe.id === 'polaroid' && selectedVibe === 'polaroid') || (vibe.id === 'strip' && selectedVibe === 'strip')) && (
                        <div className={styles.momentsOptions}>
                          {/* Option 1: Capture Now */}
                          <div className={styles.optionBlock}>
                            <span className={styles.optionOverTitle}>
                              Click now
                            </span>
                            <button
                              type="button"
                              className={`${styles.uploadButton} ${selectedOption === 'camera' ? styles.uploadButtonActive : ''}`}
                              onClick={() => {
                                setSelectedOption('camera');
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" style={{ marginRight: '8px' }}>
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                <circle cx="12" cy="13" r="4"></circle>
                              </svg>
                              Capture Now
                            </button>
                          </div>

                          {/* Divider */}
                          <div className={styles.dividerContainer}>
                            <div className={styles.dashedLine} />
                            <span className={styles.orText}>OR</span>
                          </div>

                          {/* Option 2: Upload Gallery Photo */}
                          <div className={styles.optionBlock}>
                            <span className={styles.optionOverTitle}>Upload from gallery</span>
                            <button
                              type="button"
                              className={`${styles.uploadButton} ${selectedOption === 'upload' ? styles.uploadButtonActive : ''}`}
                              onClick={() => {
                                setSelectedOption('upload');
                                console.log('Trigger upload...');
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" style={{ marginRight: '8px' }}>
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                              </svg>
                              Upload gallery photo
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {boothStep === 3 && (
                isSelectionFinalized ? null : (
                  <div className={styles.cameraControls}>
                    <div className={`${styles.queueCounter} ${styles.queueCounterDesktop}`}>
                      <span>Total: {isStripVibe ? getQueueCounterTotal() : getCapturedPhotoCount()}</span>
                      <span className={styles.queueCounterDot} aria-hidden="true">·</span>
                      <span>Current: {activeCardIndex + 1}</span>
                    </div>
                    <div className={styles.cameraBtnGroup}>
                      {/* Filter Option */}
                      <button
                        ref={filterToggleRef}
                        type="button"
                        className={styles.cameraSideBtn}
                        onClick={() => {
                          setIsFilterStripOpen(true);
                        }}
                        aria-label="Filter presets"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="25" height="25">
                          <line x1="4" y1="21" x2="4" y2="14" />
                          <line x1="4" y1="10" x2="4" y2="3" />
                          <line x1="12" y1="21" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12" y2="3" />
                          <line x1="20" y1="21" x2="20" y2="16" />
                          <line x1="20" y1="12" x2="20" y2="3" />
                          <line x1="2" y1="14" x2="6" y2="14" />
                          <line x1="10" y1="8" x2="14" y2="8" />
                          <line x1="18" y1="16" x2="22" y2="16" />
                        </svg>
                      </button>

                      {/* Left Button: Retake/Refresh */}
                      <button
                        type="button"
                        className={styles.cameraSideBtn}
                        onClick={() => {
                          if (isStripVibe) {
                            if (capturedPhotos[activeCardIndex] !== null) {
                              setCapturedPhotos((prev) => {
                                const next = [...prev];
                                next[activeCardIndex] = null;
                                capturedPhotosRef.current = next;
                                return next;
                              });
                              setStripSlotPhotos((prev) => {
                                const next = [...prev];
                                next[activeCardIndex] = createEmptyStripSlots();
                                stripSlotPhotosRef.current = next;
                                return next;
                              });
                              if (selectedOption === 'camera') {
                                startCamera(facingMode);
                              }
                              return;
                            }

                            const slots = [...getStripSlotsFor(activeCardIndex)];
                            const lastFilled = slots.map((slot, slotIdx) => (slot ? slotIdx : -1)).filter((slotIdx) => slotIdx >= 0).pop();
                            if (lastFilled !== undefined) {
                              slots[lastFilled] = null;
                              setStripSlotPhotos((prev) => {
                                const next = [...prev];
                                next[activeCardIndex] = slots;
                                stripSlotPhotosRef.current = next;
                                return next;
                              });
                              setCapturedPhotos((prev) => {
                                const next = [...prev];
                                next[activeCardIndex] = null;
                                capturedPhotosRef.current = next;
                                return next;
                              });
                              if (selectedOption === 'camera') {
                                startCamera(facingMode);
                              }
                              return;
                            }
                          } else if (capturedPhotos[activeCardIndex] !== null) {
                            setCapturedPhotos(prev => {
                              const next = [...prev];
                              next[activeCardIndex] = null;
                              return next;
                            });
                            if (selectedOption === 'camera') {
                              startCamera(facingMode);
                            }
                            return;
                          }

                          if (selectedOption === 'camera') {
                            stopCamera();
                            startCamera(facingMode);
                          }
                        }}
                        aria-label="Retake shot"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="25" height="25">
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <polyline points="3 3 3 8 8 8" />
                        </svg>
                      </button>

                      {/* Middle Button: Stop (auto) / Record / Confirm Check */}
                      {captureMode === 'auto' || isStopButtonExiting ? (
                        <button
                          type="button"
                          className={`${styles.recordCircleBtn} ${styles.recordCircleBtnStop} ${isStopButtonExiting ? styles.recordCircleBtnStopExiting : ''}`}
                          onClick={handleStopAutoCapture}
                          disabled={isStopButtonExiting}
                          aria-label="Stop auto capture"
                        >
                          Stop
                        </button>
                      ) : capturedPhotos[activeCardIndex] ? (
                        <button
                          type="button"
                          className={`${styles.recordCircleBtn} ${styles.recordCircleBtnCheck}`}
                          onClick={() => {
                            if (isStripVibe) {
                              if (activeCardIndex < quantity - 1) {
                                setActiveCardIndex((prev) => prev + 1);
                              } else {
                                setStripSlotPhotos((prev) => [...prev, createEmptyStripSlots()]);
                                setCapturedPhotos((prev) => [...prev, null]);
                                setQuantity((q) => q + 1);
                                setActiveCardIndex((prev) => prev + 1);
                              }
                              return;
                            }
                            if (activeCardIndex < quantity - 1) {
                              setActiveCardIndex(prev => prev + 1);
                            } else {
                              setCapturedPhotos(prev => [...prev, null]);
                              setQuantity(q => q + 1);
                              setActiveCardIndex(prev => prev + 1);
                            }
                          }}
                          aria-label="Confirm moment"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" width="25" height="25">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                      ) : (
                        selectedOption === 'upload' ? (
                          <button
                            type="button"
                            className={styles.recordCircleBtn}
                            onClick={() => fileInputRef.current?.click()}
                            aria-label="Upload photo"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#1a1814',
                              border: '2px solid #1a1814'
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <polyline points="21 15 16 10 5 21" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={`${styles.recordCircleBtn} ${manualRecordEntering ? styles.recordCircleBtnManualEnter : ''}`}
                            onClick={() => commitManualCapture()}
                            disabled={!cameraStream && !(isDemoPolaroidFeed && isDemoFeedReady)}
                            aria-label="Record moment"
                          />
                        )
                      )}

                      {/* Right Button: Flip Camera */}
                      {selectedOption === 'camera' && hasMultipleCameras && (
                        <button
                          type="button"
                          className={styles.cameraSideBtn}
                          onClick={() => {
                            const nextMode = facingMode === 'user' ? 'environment' : 'user';
                            setFacingMode(nextMode);
                            startCamera(nextMode);
                          }}
                          aria-label="Flip camera"
                        >
                          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="25" height="25">
                            <path d="M18.5 19H19C20.1046 19 21 18.1046 21 17L21 7C21 5.89543 20.1046 5 19 5H17.3284C16.798 5 16.2893 4.78929 15.9142 4.41421L15.0858 3.58579C14.7107 3.21071 14.202 3 13.6716 3H10.3284C9.79799 3 9.28929 3.21071 8.91421 3.58579L8.08579 4.41421C7.71071 4.78929 7.20201 5 6.67157 5H5C3.89543 5 3 5.89543 3 7V17C3 18.1046 3.89543 19 5 19H11C13.2091 19 15 17.2091 15 15C15 12.7909 13.2091 11 11 11H8M8 11L10 9M8 11L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}

                      {/* Timer Option */}
                      {selectedOption === 'camera' && (
                        <button
                          type="button"
                          className={styles.cameraSideBtn}
                          onClick={() => {
                            pauseAutoCapture();
                            setIsCapturePopupOpen(true);
                          }}
                          aria-label="Self timer"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="25" height="25">
                            <circle cx="12" cy="13" r="8" />
                            <polyline points="12 9 12 13 15 15" />
                            <line x1="12" y1="2" x2="12" y2="5" />
                            <line x1="9" y1="2" x2="15" y2="2" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      className={`${styles.cameraContinueBtn} ${!editingFromCompletion ? styles.cameraContinueBtnIconOnly : ''}`}
                      onClick={() => {
                        if (editingFromCompletion) {
                          // Return to completion screen after editing
                          stopCamera();
                          setEditingFromCompletion(false);
                          setIsSelectionFinalized(true);
                        } else {
                          handleFinalizeSelection();
                        }
                      }}
                      disabled={getCapturedPhotoCount() === 0}
                      style={editingFromCompletion ? {
                        background: '#1a1814',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                      } : undefined}
                    >
                      {editingFromCompletion ? (
                        <>
                          Done Editing
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.18)',
                            flexShrink: 0,
                          }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                        </>
                      ) : (
                        <>
                          <span className={styles.continueBtnText}>Continue</span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                )
              )}
            </div>
          )}

          {!isSelectionFinalized && (
            <div className={`${styles.boothFooter} ${boothStep === 1 && selectedVibe !== null ? styles.boothFooterStep1Sticky : ''}`}>
              {boothStep > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    if (boothStep === 3) {
                      stopCamera();
                      setBoothStep(2);
                    } else {
                      setBoothStep(1);
                      setQuantity(1);
                      setSelectedOption(null);
                    }
                  }}
                  className={styles.backTextButton}
                >
                  Back
                </button>
              )}
              <button
                disabled={!isButtonEnabled}
                className={`${styles.continueButton} ${isButtonEnabled ? styles.continueButtonEnabled : ''
                  } ${boothStep === 2 ? styles.continueButtonStep2 : ''}`}
                onClick={() => {
                  if (boothStep === 1) {
                    setBoothStep(2);
                  } else if (boothStep === 2) {
                    if (selectedOption === 'camera') {
                      setBoothStep(3);
                      setQuantity(1);
                      setCapturedPhotos([null]);
                      setStripSlotPhotos(createEmptyStripCollection(1));
                      setActiveCardIndex(0);
                      setIsSelectionFinalized(false);
                      startCamera(facingMode);
                    } else if (selectedOption === 'upload') {
                      const redirectUrl = selectedVibe === 'polaroid'
                        ? (photoboothLinks?.polaroidsUrl || '/product/2')
                        : (photoboothLinks?.photostripsUrl || '/product/4');
                      console.log('Redirecting upload gallery to:', redirectUrl);
                      
                      let finalUrl = redirectUrl;
                      if (finalUrl.includes('localhost')) {
                        finalUrl = finalUrl.replace(/localhost(:\d+)?/g, 'myscribble.in');
                        if (finalUrl.startsWith('http://')) {
                          finalUrl = finalUrl.replace('http://', 'https://');
                        }
                      }
                      
                      if (finalUrl.startsWith('http://') || finalUrl.startsWith('https://')) {
                        window.location.href = finalUrl;
                      } else {
                        router.push(finalUrl);
                      }
                    } else {
                      setBoothStep(3);
                      setQuantity(1);
                      setCapturedPhotos([null]);
                      setStripSlotPhotos(createEmptyStripCollection(1));
                      setActiveCardIndex(0);
                      setIsSelectionFinalized(false);
                    }
                  } else {
                    console.log('Selected vibe:', selectedVibe, 'Selected quantity:', quantity);
                  }
                }}
              >
                <span key={boothStep} className={styles.buttonTextInner}>
                  {boothStep === 1 ? 'Continue' : 'Build My Memory'}
                </span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Sticky Continue action strip rendered outside boothContent */}
        {isSelectionFinalized && (completionSequenceStep === 'idle' || completionSequenceStep === 'exit') && (
          <div
            className={`${styles.completionActionStrip} ${completionSequenceStep === 'exit' ? styles.completionActionStripExiting : ''}`}
          >
            <button
              type="button"
              className={`${styles.completionActionBtn} ${styles.completionActionBtnPrimary} ${styles.completionContinueBtn}`}
              onClick={runCompletionSequence}
              disabled={completionSequenceStep !== 'idle'}
            >
              Continue({getCapturedPhotoCount()})
              <svg
                className={styles.completionActionBtnIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
            <p className={styles.completionActionDisclaimer}>
              Photos cannot be edited after you click Continue. Hover/Click a polaroid to edit or delete.
            </p>
          </div>
        )}

        {/* Capture Mode Popup */}
        <div className={`${styles.popupOverlay} ${isCapturePopupOpen ? styles.popupOverlayActive : ''}`}>
          <div className={styles.popupContainer}>
            <button
              onClick={() => setIsCapturePopupOpen(false)}
              className={styles.popupCloseButton}
              aria-label="Close popup"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <h3 className={styles.popupTitle}>Choose Your Capture Mode</h3>
            <p className={styles.popupDescription}>
              Choose automatic countdown capture or take photos manually.
            </p>
            <div className={styles.popupOptionsGrid}>
              <div
                role="button"
                tabIndex={0}
                className={`${styles.popupCard} ${captureMode === 'auto' ? styles.popupCardActive : ''}`}
                onClick={() => {
                  setCaptureMode('auto');
                  setIsAutoCaptureRunning(false);
                  isAutoCaptureRunningRef.current = false;
                  clearAutoCaptureTimers();
                  setCountdown(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setCaptureMode('auto');
                    setIsAutoCaptureRunning(false);
                    isAutoCaptureRunningRef.current = false;
                    clearAutoCaptureTimers();
                    setCountdown(null);
                  }
                }}
              >
                <div className={styles.popupCardIcon}>⏱</div>
                <h4 className={styles.popupCardTitle}>Auto Capture</h4>
                <p className={styles.popupCardDesc}>Take photos automatically with a countdown.</p>
                {captureMode === 'auto' && (
                  <div className={styles.timerOptionsRow} onClick={(e) => e.stopPropagation()}>
                    {([3, 5, 10] as const).map((secs) => (
                      <button
                        key={secs}
                        type="button"
                        className={`${styles.timerPill} ${autoSeconds === secs ? styles.timerPillActive : ''}`}
                        onClick={() => setAutoSeconds(secs)}
                      >
                        {secs}s
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div
                role="button"
                tabIndex={0}
                className={`${styles.popupCard} ${captureMode === 'manual' ? styles.popupCardActive : ''}`}
                onClick={() => {
                  setCaptureMode('manual');
                  setIsAutoCaptureRunning(false);
                  isAutoCaptureRunningRef.current = false;
                  clearAutoCaptureTimers();
                  setCountdown(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setCaptureMode('manual');
                    setIsAutoCaptureRunning(false);
                    isAutoCaptureRunningRef.current = false;
                    clearAutoCaptureTimers();
                    setCountdown(null);
                  }
                }}
              >
                <div className={styles.popupCardIcon}>📸</div>
                <h4 className={styles.popupCardTitle}>Manual Capture</h4>
                <p className={styles.popupCardDesc}>Take each photo yourself by pressing the Capture button.</p>
              </div>
            </div>
            <button
              type="button"
              className={styles.popupActionBtn}
              onClick={handleStartCaptureSession}
            >
              Resume
            </button>
          </div>
        </div>

        {/* Filter Presets Strip */}
        <div
          ref={filterStripRef}
          className={`${styles.filterStrip} ${isFilterStripOpen ? styles.filterStripOpen : ''}`}
        >
          <div className={styles.filterStripHeader}>
            <span className={styles.filterStripTitle}>Choose Your Capture Style</span>
            <button
              type="button"
              className={styles.filterStripCloseBtn}
              onClick={() => setIsFilterStripOpen(false)}
              aria-label="Close styles"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <FrameOptionsScrollRow>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`${styles.filterItem} ${activeFilter === f.id ? styles.filterItemActive : ''}`}
                onClick={() => {
                  setActiveFilter(f.id);
                  setIsFilterStripOpen(false);
                }}
              >
                <div className={styles.filterPreviewContainer}>
                  {isCameraActive && cameraStream ? (
                    <video
                      autoPlay
                      playsInline
                      muted
                      className={styles.miniCameraVideo}
                      style={{
                        transform: 'none',
                        filter: f.id === 'original' ? 'none' : f.filterCss,
                      }}
                      ref={(el) => {
                        if (el && cameraStream) {
                          el.srcObject = cameraStream;
                        }
                      }}
                    />
                  ) : (
                    <span className={styles.filterOriginalMuted} />
                  )}
                  {activeFilter === f.id && (
                    <div className={styles.filterCheckIndicator}>
                      {f.id === 'original' ? (
                        <span className={styles.filterCheckText}>original</span>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="12" height="12">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      )}
                    </div>
                  )}
                </div>
                <span className={styles.filterLabel}>{f.name}</span>
              </button>
            ))}
          </FrameOptionsScrollRow>

          {/* Polaroid/Photostrip Frame Presets Row */}
          <div className={styles.frameStripContainer}>
            <div className={styles.frameStripHeader}>
              <span className={styles.frameStripTitle}>{selectedVibe === 'strip' ? 'Photostrip Frame Options' : 'Polaroid Frame Options'}</span>
            </div>
            <FrameOptionsScrollRow>
              {Array.from({ length: 9 }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`${styles.frameItem} ${selectedFrame === idx ? styles.frameItemActive : ''}`}
                  onClick={() => {
                    setSelectedFrame(idx);
                    setCardFrames(prev => {
                      const next = [...prev];
                      if (next.length > activeCardIndex) {
                        next[activeCardIndex] = idx;
                      }
                      return next;
                    });
                    setCapturedPhotos(prev => {
                      const next = [...prev];
                      const targetIdx = next.length > activeCardIndex ? activeCardIndex : next.length - 1;
                      if (next[targetIdx]) {
                        next[targetIdx] = {
                          ...next[targetIdx]!,
                          frameId: idx
                        };
                      }
                      return next;
                    });
                    setIsFilterStripOpen(false);
                  }}
                >
                  <div className={styles.framePreviewContainer}>
                    {selectedVibe === 'strip' ? (
                      <div
                        className={
                          idx === 1 ? styles.polaroidFrameBlobPattern :
                          idx === 2 ? styles.polaroidFrameStickerPopPattern :
                          idx === 3 ? styles.polaroidFrameComicBlastPattern :
                          idx === 4 ? styles.polaroidFrameCandyPinkPattern :
                          idx === 5 ? styles.polaroidFrameSweetKissPattern :
                          idx === 6 ? styles.polaroidFrameStarlightPattern :
                          idx === 7 ? styles.polaroidFrameBluebellPattern :
                          idx === 8 ? styles.polaroidFramePixelPaintPattern : ''
                        }
                        style={{
                          width: '100%',
                          height: '100%',
                          backgroundColor: idx === 0 ? '#ffffff' : undefined
                        }}
                      />
                    ) : (() => {
                      const videoEl = isCameraActive && cameraStream && (
                        <video
                          ref={(node) => {
                            if (node && node.srcObject !== cameraStream) {
                              node.srcObject = cameraStream;
                              node.play().catch(() => { });
                            }
                          }}
                          autoPlay
                          playsInline
                          muted
                          className={`${styles.framePreviewVideo} ${idx === 8 ? styles.framePreviewVideoPixelPaint : ''}`}
                          style={{ transform: 'none' }}
                        />
                      );

                      if (idx === 1) {
                        return <div className={styles.framePreviewBlob}>{videoEl}</div>;
                      } else if (idx === 2) {
                        return <div className={styles.framePreviewStickerPop}>{videoEl}</div>;
                      } else if (idx === 3) {
                        return <div className={styles.framePreviewComicBlast}>{videoEl}</div>;
                      } else if (idx === 4) {
                        return <div className={styles.framePreviewCandyPink}>{videoEl}</div>;
                      } else if (idx === 5) {
                        return <div className={styles.framePreviewSweetKiss}>{videoEl}</div>;
                      } else if (idx === 6) {
                        return <div className={styles.framePreviewStarlight}>{videoEl}</div>;
                      } else if (idx === 7) {
                        return <div className={styles.framePreviewBluebell}>{videoEl}</div>;
                      } else if (idx === 8) {
                        return <div className={styles.framePreviewPixelPaint}>{videoEl}</div>;
                      } else {
                        return <div className={styles.framePreviewWhite}>{videoEl}</div>;
                      }
                    })()}
                    {selectedFrame === idx && (
                      <div className={styles.frameCheckIndicator}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="10" height="10">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                    )}
                  </div>
                  <span className={styles.frameLabel}>
                    {idx === 0 ? 'Classic White' : idx === 1 ? 'Splatter Blob' : idx === 2 ? 'Sticker Pop' : idx === 3 ? 'Comic Blast' : idx === 4 ? 'Candy Pink' : idx === 5 ? 'Sweet Kiss' : idx === 6 ? 'Starlight' : idx === 7 ? 'Bluebell' : idx === 8 ? 'Pixel Paint' : 'White Frame'}
                  </span>
                </button>
              ))}
            </FrameOptionsScrollRow>
          </div>
        </div>

        {/* Close Confirmation Popup */}
        <div className={`${styles.popupOverlay} ${isCloseConfirmationOpen ? styles.popupOverlayActive : ''}`}>
          <div className={styles.popupContainer}>
            <div className={styles.popupCardIcon}>{confirmationAction === 'back' ? '🔙' : '⚠️'}</div>
            <h3 className={styles.popupTitle}>Hold Up!</h3>
            <p className={styles.popupDescription}>
              {confirmationAction === 'back'
                ? 'Going back will erase your captured photos fr. You sure about that?'
                : 'If you exit now, your progress will be erased fr. Are you sure you want to leave?'
              }
            </p>
            <div className={styles.popupConfirmationActions}>
              <button
                type="button"
                className={styles.popupActionBtn}
                onClick={() => {
                  setIsCloseConfirmationOpen(false);
                  if (confirmationAction === 'back') {
                    stopCamera();
                    setCapturedPhotos([null]);
                    setStripSlotPhotos(createEmptyStripCollection(1));
                    setActiveCardIndex(0);
                    setBoothStep(2);
                  } else {
                    closeBooth();
                  }
                }}
                style={{
                  background: '#ab0000',
                  color: '#ffffff',
                  margin: 0,
                  width: '100%',
                }}
              >
                Yes, continue 💀
              </button>
              <button
                type="button"
                className={styles.popupActionBtn}
                onClick={() => setIsCloseConfirmationOpen(false)}
                style={{
                  background: 'rgba(26, 24, 20, 0.08)',
                  color: '#1a1814',
                  margin: 0,
                  width: '100%',
                }}
              >
                Nah, keep vibing ✨
              </button>
            </div>
          </div>
        </div>

        {/* Print order bottom sheet */}
        {isPrintOrderOpen && (
          <div
            className={`${styles.printOrderOverlay} ${isPrintOrderVisible ? styles.printOrderOverlayActive : ''}`}
            onClick={closePrintOrderPopup}
            role="presentation"
          >
            <div
              className={`${styles.printOrderSheet} ${isPrintOrderVisible ? styles.printOrderSheetActive : ''}`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="print-order-title"
            >
              <button
                type="button"
                onClick={closePrintOrderPopup}
                className={styles.printOrderCloseBtn}
                aria-label="Close print order"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              <div className={styles.printOrderSheetScroll}>
                <h2 id="print-order-title" className={styles.printOrderTitle}>
                  Get them printed!
                </h2>

                <div ref={printCarouselWrapRef} className={styles.printOrderCarouselWrap}>
                  <div
                    className={`${styles.printOrderCarouselTrack} ${printCarouselAnimates ? styles.printOrderCarouselTrackAnimated : styles.printOrderCarouselTrackStatic}`}
                    style={{
                      ['--carousel-duration' as string]: `${Math.max(printOrderCount * 4, 16)}s`,
                    }}
                  >
                    {printCarouselItems.map((photo, idx) => (
                      <div
                        key={`print-carousel-${idx}`}
                        className={`${styles.printOrderCarouselItem} ${selectedVibe === 'polaroid' ? styles.printOrderCarouselItemPolaroid : styles.printOrderCarouselItemStrip}`}
                      >
                        {renderKeepsakeFrame(photo, idx % printOrderCount, true, true)}
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.printOrderPricing}>
                  <p className={styles.printOrderPricingLine}>
                    ₹{PRINT_PRICE_PER_POLAROID} × {printOrderCount} {printOrderCount === 1 ? 'polaroid' : 'polaroids'}
                  </p>
                  <p className={styles.printOrderPricingLine}>
                    Convenience & delivery charges: ₹100
                  </p>
                  <p className={styles.printOrderPricingTotal}>₹{printOrderTotal}</p>
                </div>

                <div className={styles.printOrderActions}>
                  <button
                    type="button"
                    className={styles.printOrderBuyBtn}
                    onClick={handleBuyNow}
                    disabled={isPurchaseInProgress || printOrderCount === 0}
                  >
                    {isPurchaseInProgress ? 'Processing…' : 'Buy Now'}
                  </button>
                  <p className={styles.printOrderSecureCheckout}>
                    <svg
                      className={styles.printOrderVerifiedIcon}
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Secure Checkout
                  </p>
                </div>
                <div className={styles.printOrderSecureGraphicContainer}>
                  <img
                    src="/scr.graphs.png"
                    alt="Checkout details graphic"
                    className={styles.printOrderSecureGraphic}
                    draggable={false}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Download Progress Popup */}
        {isDownloading && (
          <div className={`${styles.downloadPopupOverlay} ${styles.downloadPopupOverlayActive}`}>
            <div className={styles.downloadPopupContainer}>
              <button
                onClick={() => setIsDownloading(false)}
                className={styles.popupCloseButton}
                aria-label="Close popup"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              <h3 className={styles.downloadPopupTitle}>Your download has started!</h3>
              <p className={styles.downloadPopupDesc}>
                We are generating your high-quality keepsakes
                {keepsakePhotos.length > 1 ? ' and packaging them into a ZIP file' : ''}.
              </p>

              {/* Progress bar container */}
              <div className={styles.progressBarWrapper}>
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <span className={styles.progressText}>{Math.round(downloadProgress)}% Completed</span>

              {keepsakePhotos.length > 1 && (
                <p className={styles.downloadPopupWarning}>
                  All {keepsakePhotos.length} keepsakes will download as one ZIP file.
                </p>
              )}

              {/* Retry Download Block */}
              <div className={styles.retryWrapper}>
                <span className={styles.retryText}>Download didn&apos;t happen?</span>
                <button
                  type="button"
                  className={styles.retryButton}
                  onClick={handleDownloadKeepsakes}
                >
                  Download again
                </button>
              </div>

              {/* Attribution Logo */}
              <div className={styles.popupAttribution}>
                <span className={styles.popupFromText}>From</span>
                <Logo textClassName={styles.popupLogoText} imageClassName={styles.popupLogoImage} />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Hidden file input for gallery uploads */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />

      <PhotoboothPurchaseProgress
        open={isPurchaseInProgress || !!purchaseError}
        progress={purchaseProgress}
        error={purchaseError}
        onClose={() => {
          setPurchaseError(null);
          setPurchaseProgress(null);
        }}
      />
    </main>
  );
}
