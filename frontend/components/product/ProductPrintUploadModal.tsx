'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import headerStyles from '@/components/Header.module.css';
import styles from './ProductPrintUploadModal.module.css';
const boothStyles = styles;
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  applyCaptureFilterToDataUrl,
  FILTER_PREVIEW_SAMPLE_IMAGE,
  getCaptureFilterCss,
  getFramePreviewClassName,
  getFramePreviewLabel,
  getPolaroidFrameClassName,
  PRINT_CAPTURE_FILTERS,
} from '@/lib/product/printFilters';
import {
  isGooglePickerConfigured,
  pickGoogleDriveImages,
  pickGooglePhotosImages,
  requestGoogleAuthCode,
  DRIVE_SCOPE,
  PHOTOS_SCOPE,
} from '@/lib/google/googlePicker';
import { connectorsApi } from '@/lib/api/connectors';

const MAX_IMAGE_SIZE_BYTES = 6 * 1024 * 1024;

export type PrintUploadMode = 'polaroid' | 'strip';
type StylePanel = 'capture' | 'border';

export type UploadedPrintItem = {
  id: string;
  sourceUrl: string;
  url: string;
  filterId: string;
  frameId: number;
  scale?: number;
  x?: number;
  y?: number;
  naturalWidth?: number;
  naturalHeight?: number;
  containerWidth?: number;
  containerHeight?: number;
};

type ProductPrintUploadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onContinue?: (payload: { items: UploadedPrintItem[]; mode: PrintUploadMode }) => void;
  initialItems?: UploadedPrintItem[];
  initialMode?: PrintUploadMode;
  polaroidEnabled: boolean;
  stripEnabled: boolean;
  maxImages?: number;
};

function makeItemId() {
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isFileDragEvent(e: React.DragEvent) {
  return Array.from(e.dataTransfer.types).includes('Files');
}

function partitionImageFiles(files: FileList | File[]) {
  const accepted: File[] = [];
  const rejected: File[] = [];

  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue;
    if (file.size > MAX_IMAGE_SIZE_BYTES) rejected.push(file);
    else accepted.push(file);
  }

  return { accepted, rejected };
}

function readFilesAsDataUrls(files: File[]): Promise<string[]> {
  return Promise.all(
    files.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') resolve(reader.result);
            else reject(new Error('Failed to read image'));
          };
          reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'));
          reader.readAsDataURL(file);
        }),
    ),
  );
}

function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = url;
  });
}

type EmptySlotProps = {
  slotIdx: number;
  onUploadClick: () => void;
  onDropFiles: (files: FileList | File[]) => void;
};

function EmptySlot({ slotIdx, onUploadClick, onDropFiles }: EmptySlotProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (!isFileDragEvent(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!isFileDragEvent(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isFileDragEvent(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) {
      void onDropFiles(e.dataTransfer.files);
    }
  };

  return (
    <div
      key={slotIdx}
      className={`${boothStyles.stripMiniImg} ${styles.emptySlot} ${isDragOver ? styles.emptySlotDragOver : ''}`}
      style={{
        aspectRatio: '1 / 1',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <button
        type="button"
        className={styles.slotUploadBtn}
        onClick={(e) => {
          e.stopPropagation();
          onUploadClick();
        }}
      >
        Upload
      </button>
    </div>
  );
}

export default function ProductPrintUploadModal({
  isOpen,
  onClose,
  onContinue,
  initialItems,
  initialMode,
  polaroidEnabled,
  stripEnabled,
  maxImages,
}: ProductPrintUploadModalProps) {
  const { showToast } = useToast();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || '';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const styleActionsRef = useRef<HTMLDivElement>(null);
  const filterStripRef = useRef<HTMLDivElement>(null);
  const gridItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [mode, setMode] = useState<PrintUploadMode>(polaroidEnabled ? 'polaroid' : 'strip');
  const [items, setItems] = useState<UploadedPrintItem[]>([]);
  const updateItems = useCallback(
    (ids: string[], updater: (item: UploadedPrintItem) => UploadedPrintItem) => {
      const idSet = new Set(ids);
      setItems((prev) => prev.map((item) => (idSet.has(item.id) ? updater(item) : item)));
    },
    [],
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [openStylePanel, setOpenStylePanel] = useState<StylePanel | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [resizingItemId, setResizingItemId] = useState<string | null>(null);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [googleUploadLoading, setGoogleUploadLoading] = useState<'drive' | 'photos' | null>(null);
  const [localUploadLoading, setLocalUploadLoading] = useState(false);
  const [activeConnectorModal, setActiveConnectorModal] = useState<'drive' | 'photos' | null>(null);
  const [verifyNoticeSource, setVerifyNoticeSource] = useState<'drive' | 'photos' | null>(null);
  const [connectorStatus, setConnectorStatus] = useState<{ drive: boolean; photos: boolean }>({ drive: false, photos: false });
  const [connectorStatusLoaded, setConnectorStatusLoaded] = useState(false);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const uploadMenuRef = useRef<HTMLDivElement>(null);

  // Fetch connector status from backend on mount
  useEffect(() => {
    if (!isOpen || !isAuthenticated || !user) return;
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const status = await connectorsApi.getStatus();
        if (cancelled) return;
        setConnectorStatus({
          drive: status.drive?.connected ?? false,
          photos: status.photos?.connected ?? false,
        });
      } catch (err) {
        console.error('[Upload] Failed to fetch connector status:', err);
      } finally {
        if (!cancelled) setConnectorStatusLoaded(true);
      }
    };
    void fetchStatus();
    return () => { cancelled = true; };
  }, [isOpen, isAuthenticated, user]);

  // Close resizing mode when clicking outside the slots
  useEffect(() => {
    if (!resizingItemId) return;
    const handleOutsideClick = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.print-upload-slot-container')) {
        setResizingItemId(null);
      }
    };
    window.addEventListener('pointerdown', handleOutsideClick);
    return () => window.removeEventListener('pointerdown', handleOutsideClick);
  }, [resizingItemId]);

  // Close upload menu when clicking outside
  useEffect(() => {
    if (!uploadMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(event.target as Node)) {
        setUploadMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [uploadMenuOpen]);

  const handleImagePointerDown = useCallback((
    e: React.PointerEvent,
    item: UploadedPrintItem,
    containerRect: DOMRect
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const currentX = item.x ?? 0;
    const currentY = item.y ?? 0;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      updateItems([item.id], (prev) => ({
        ...prev,
        x: currentX + dx,
        y: currentY + dy,
        containerWidth: containerRect.width,
        containerHeight: containerRect.height,
      }));
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [updateItems]);

  const handleScalePointerDown = useCallback((
    e: React.PointerEvent,
    item: UploadedPrintItem,
    slotRect: DOMRect
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const currentScale = item.scale ?? 1;
    const centerX = slotRect.left + slotRect.width / 2;
    const centerY = slotRect.top + slotRect.height / 2;

    const startX = e.clientX;
    const startY = e.clientY;
    const startDist = Math.hypot(startX - centerX, startY - centerY);
    const startScale = currentScale || 1;
    const initialDist = Math.hypot(startX - centerX, startY - centerY);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dist = Math.hypot(moveEvent.clientX - centerX, moveEvent.clientY - centerY);

      const scaleFactor = dist / initialDist;

      updateItems([item.id], (prev) => ({
        ...prev,
        scale: Math.max(0.1, currentScale * scaleFactor),
        containerWidth: slotRect.width,
        containerHeight: slotRect.height,
      }));
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [updateItems]);

  const renderBoundingBox = useCallback((item: UploadedPrintItem) => {
    return (
      <div
        className={styles.boundingBox}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setResizingItemId(null);
        }}
      >
        <div
          className={`${styles.handle} ${styles.handleTL}`}
          onPointerDown={(e) => {
            const rect = e.currentTarget.parentElement?.getBoundingClientRect() || new DOMRect();
            handleScalePointerDown(e, item, rect);
          }}
        />
        <div
          className={`${styles.handle} ${styles.handleTR}`}
          onPointerDown={(e) => {
            const rect = e.currentTarget.parentElement?.getBoundingClientRect() || new DOMRect();
            handleScalePointerDown(e, item, rect);
          }}
        />
        <div
          className={`${styles.handle} ${styles.handleBL}`}
          onPointerDown={(e) => {
            const rect = e.currentTarget.parentElement?.getBoundingClientRect() || new DOMRect();
            handleScalePointerDown(e, item, rect);
          }}
        />
        <div
          className={`${styles.handle} ${styles.handleBR}`}
          onPointerDown={(e) => {
            const rect = e.currentTarget.parentElement?.getBoundingClientRect() || new DOMRect();
            handleScalePointerDown(e, item, rect);
          }}
        />
        <button
          type="button"
          className={styles.boundingBoxDoneBtn}
          onClick={(e) => {
            e.stopPropagation();
            setResizingItemId(null);
          }}
          title="Done"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      </div>
    );
  }, [handleScalePointerDown]);

  const renderFrameOverlay = useCallback((frameId: number, isStrip: boolean) => {
    if (frameId === 0) {
      return (
        <div
          className={styles.frameOverlayWhite}
          style={
            isStrip
              ? { border: '8px solid #fff' }
              : { borderStyle: 'solid', borderWidth: '8px 8px 28px', borderColor: '#fff' }
          }
        />
      );
    }

    return (
      <div className={styles.frameOverlayPattern} />
    );
  }, []);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  const activeFilterId = selectedItem?.filterId ?? 'original';
  const activeFrameId = selectedItem?.frameId ?? 0;

  const chunkedStrips = useMemo(() => {
    const chunks: UploadedPrintItem[][] = [];
    for (let i = 0; i < items.length; i += 3) {
      chunks.push(items.slice(i, i + 3));
    }
    return chunks;
  }, [items]);

  const handleSetMode = useCallback((newMode: PrintUploadMode) => {
    setMode(newMode);
    if (items.length === 0) {
      setSelectedItemId(null);
      return;
    }
    if (newMode === 'strip') {
      const currentChunk = chunkedStrips.find(c => c.some(item => item.id === selectedItemId));
      if (currentChunk) {
        setSelectedItemId(currentChunk[0].id);
      } else {
        setSelectedItemId(items[0]?.id ?? null);
      }
    } else {
      if (!selectedItemId || !items.some(item => item.id === selectedItemId)) {
        setSelectedItemId(items[0]?.id ?? null);
      }
    }
  }, [items, selectedItemId, chunkedStrips]);

  useEffect(() => {
    if (!isOpen) return;
    const nextItems = initialItems?.length ? initialItems.map((item) => ({ ...item })) : [];
    setMode(initialMode ?? (polaroidEnabled ? 'polaroid' : 'strip'));
    setItems(nextItems);
    setSelectedItemId(nextItems[0]?.id ?? null);
    setIsDragging(false);
    setOpenStylePanel(null);
    setProcessingIds(new Set());
    setShowCloseConfirm(false);
    setResizingItemId(null);
  }, [isOpen, polaroidEnabled, stripEnabled, initialItems, initialMode]);

  useEffect(() => {
    if (!isOpen) return;

    const resetDrag = () => {
      setIsDragging(false);
    };

    window.addEventListener('dragend', resetDrag);
    return () => window.removeEventListener('dragend', resetDrag);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    document.body.setAttribute('data-print-upload-open', '');

    return () => {
      document.body.removeAttribute('data-print-upload-open');
    };
  }, [isOpen]);

  const handleRequestClose = useCallback(() => {
    if (items.length > 0) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
  }, [items.length, onClose]);

  const handleConfirmClose = useCallback(() => {
    setShowCloseConfirm(false);
    onClose();
  }, [onClose]);

  const handleContinue = useCallback(() => {
    if (items.length === 0) {
      showToast('Upload at least one image to continue.', 'error');
      return;
    }

    onContinue?.({ items, mode });
    onClose();
  }, [items, mode, onClose, onContinue, showToast]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showCloseConfirm) {
        setShowCloseConfirm(false);
        return;
      }
      if (openStylePanel) {
        setOpenStylePanel(null);
        return;
      }
      handleRequestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, openStylePanel, showCloseConfirm, handleRequestClose]);

  const addImages = useCallback(async (dataUrls: string[]) => {
    if (dataUrls.length === 0) return;
    let allowedUrls = dataUrls;
    if (maxImages !== undefined && items.length + dataUrls.length > maxImages) {
      const allowedCount = maxImages - items.length;
      if (allowedCount <= 0) {
        showToast(`You have reached the maximum upload limit of ${maxImages} images.`, 'error');
        return;
      }
      showToast(`You can only upload up to ${maxImages} images. Only the first ${allowedCount} new images were added.`, 'error');
      allowedUrls = dataUrls.slice(0, allowedCount);
    }
    const newItems: UploadedPrintItem[] = await Promise.all(
      allowedUrls.map(async (sourceUrl) => {
        const dims = await getImageDimensions(sourceUrl);
        return {
          id: makeItemId(),
          sourceUrl,
          url: sourceUrl,
          filterId: 'original',
          frameId: 0,
          naturalWidth: dims.width,
          naturalHeight: dims.height,
        };
      }),
    );
    setItems((prev) => [...prev, ...newItems]);
  }, [items.length, maxImages, showToast]);

  const reportOversizedFiles = useCallback(
    (rejected: File[]) => {
      if (rejected.length === 0) return;

      if (rejected.length === 1) {
        showToast(`${rejected[0].name} exceeds the 6MB limit and was not uploaded.`, 'error');
        return;
      }

      const names = rejected.map((file) => file.name).join(', ');
      showToast(
        `${rejected.length} images exceed the 6MB limit and were not uploaded: ${names}`,
        'error',
      );
    },
    [showToast],
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const { accepted, rejected } = partitionImageFiles(files);
      reportOversizedFiles(rejected);
      if (accepted.length === 0) return;

      setLocalUploadLoading(true);
      try {
        const dataUrls = await readFilesAsDataUrls(accepted);
        await addImages(dataUrls);
      } finally {
        setLocalUploadLoading(false);
      }
    },
    [addImages, reportOversizedFiles],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const reportOversizedNames = useCallback(
    (names: string[]) => {
      if (names.length === 0) return;

      if (names.length === 1) {
        showToast(`${names[0]} exceeds the 6MB limit and was not uploaded.`, 'error');
        return;
      }

      showToast(
        `${names.length} images exceed the 6MB limit and were not uploaded: ${names.join(', ')}`,
        'error',
      );
    },
    [showToast],
  );

  const handleGoogleUpload = useCallback(
    async (source: 'drive' | 'photos', bypassLoadingCheck = false) => {
      if (googleUploadLoading && !bypassLoadingCheck) return;

      if (!isGooglePickerConfigured()) {
        showToast('Google upload is not configured.', 'error');
        return;
      }

      setGoogleUploadLoading(source);
      try {
        // Use backend token (server-side refresh token flow).
        // Spinner stays on for the entire flow: picker open → popup close polling
        // → download → images added to frames. The finally block always clears it.
        const result =
          source === 'drive'
            ? await pickGoogleDriveImages(MAX_IMAGE_SIZE_BYTES, 'backend')
            : await pickGooglePhotosImages(MAX_IMAGE_SIZE_BYTES, 'backend');

        reportOversizedNames(result.rejectedNames);

        if (result.dataUrls.length === 0) return;

        await addImages(result.dataUrls);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Google upload failed.';
        const normalized = message.toLowerCase();
        if (
          normalized.includes('popup_closed') ||
          normalized.includes('access_denied') ||
          normalized.includes('user closed')
        ) {
          return;
        }
        // If token expired/revoked, mark as disconnected
        if (normalized.includes('revoked') || normalized.includes('not connected')) {
          setConnectorStatus((prev) => ({ ...prev, [source]: false }));
        }
        showToast(message, 'error');
      } finally {
        setGoogleUploadLoading(null);
      }
    },
    [addImages, googleUploadLoading, reportOversizedNames, showToast],
  );

  const handleConnectorConnect = useCallback(
    async (source: 'drive' | 'photos') => {
      if (googleUploadLoading) return;
      setGoogleUploadLoading(source);
      try {
        const scope = source === 'drive' ? DRIVE_SCOPE : PHOTOS_SCOPE;
        // Step 1: Get auth code from Google popup
        const code = await requestGoogleAuthCode(scope);
        // Step 2: Exchange code for refresh token via backend
        await connectorsApi.exchangeCode(code, source);
        setConnectorStatus((prev) => ({ ...prev, [source]: true }));
        showToast(
          `${source === 'drive' ? 'Google Drive' : 'Google Photos'} connected! You can now upload.`,
          'success'
        );
        // Step 3: Immediately open the picker (bypass the googleUploadLoading guard since we are still in the connect flow context)
        await handleGoogleUpload(source, true);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Connection failed.';
        const normalized = message.toLowerCase();
        if (
          normalized.includes('popup_closed') ||
          normalized.includes('access_denied') ||
          normalized.includes('user closed')
        ) {
          return;
        }
        showToast(message, 'error');
      } finally {
        setGoogleUploadLoading(null);
      }
    },
    [googleUploadLoading, handleGoogleUpload, showToast],
  );

  const resetDragState = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDialogDragEnter = useCallback((e: React.DragEvent) => {
    if (!isFileDragEvent(e)) return;
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDialogDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (!isFileDragEvent(e)) return;
      const next = e.relatedTarget as Node | null;
      if (next && e.currentTarget.contains(next)) return;
      resetDragState();
    },
    [resetDragState],
  );

  const handleDialogDragOver = useCallback((e: React.DragEvent) => {
    if (!isFileDragEvent(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  }, []);

  const handleDialogDrop = useCallback(
    (e: React.DragEvent) => {
      if (!isFileDragEvent(e)) return;
      e.preventDefault();
      resetDragState();
      void handleFiles(e.dataTransfer.files);
    },
    [handleFiles, resetDragState],
  );

  const applyFilterToItems = useCallback(
    async (filterId: string) => {
      if (!selectedItemId) {
        showToast('Select an image to apply filters.', 'error');
        return;
      }

      let ids = [selectedItemId];
      if (mode === 'strip') {
        const targetChunk = chunkedStrips.find((c) => c.some((item) => item.id === selectedItemId));
        if (targetChunk) {
          ids = targetChunk.map((item) => item.id);
        }
      }

      setProcessingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });

      await Promise.all(
        ids.map(async (id) => {
          const item = items.find((entry) => entry.id === id);
          if (!item) return;
          const processedUrl = await applyCaptureFilterToDataUrl(item.sourceUrl, filterId);
          updateItems([id], (entry) => ({
            ...entry,
            url: processedUrl,
            filterId,
          }));
        }),
      );

      setProcessingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    },
    [items, selectedItemId, showToast, updateItems, mode, chunkedStrips],
  );

  const applyFrameToItems = useCallback(
    (frameId: number) => {
      if (!selectedItemId) {
        showToast('Select an image to apply frames.', 'error');
        return;
      }

      let ids = [selectedItemId];
      if (mode === 'strip') {
        const targetChunk = chunkedStrips.find((c) => c.some((item) => item.id === selectedItemId));
        if (targetChunk) {
          ids = targetChunk.map((item) => item.id);
        }
      }

      updateItems(ids, (item) => ({ ...item, frameId }));
    },
    [selectedItemId, showToast, updateItems, mode, chunkedStrips],
  );

  const removeItem = useCallback((id: string) => {
    if (mode === 'strip') {
      const targetChunk = chunkedStrips.find((c) => c.some((item) => item.id === id));
      if (targetChunk) {
        const idsToRemove = new Set(targetChunk.map((item) => item.id));
        setItems((prev) => prev.filter((item) => !idsToRemove.has(item.id)));
        setSelectedItemId((prev) => (prev && idsToRemove.has(prev) ? null : prev));
        return;
      }
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedItemId((prev) => (prev === id ? null : prev));
  }, [mode, chunkedStrips]);

  const setGridItemRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) gridItemRefs.current.set(id, el);
    else gridItemRefs.current.delete(id);
  }, []);

  const handleDialogPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!selectedItemId) return;

      const target = e.target as Node;
      const selectedEl = gridItemRefs.current.get(selectedItemId);
      if (selectedEl?.contains(target)) return;
      if (styleActionsRef.current?.contains(target)) return;
      if (filterStripRef.current?.contains(target)) return;

      setSelectedItemId(null);
    },
    [selectedItemId],
  );

  const renderSlotImage = (item: UploadedPrintItem, isSlotResizing: boolean) => {
    const slotFilterCss = getCaptureFilterCss(item.filterId);
    const x = item.x ?? 0;
    const y = item.y ?? 0;
    const scale = item.scale ?? 1;
    const hasDims = item.naturalWidth && item.naturalHeight;
    const isPortrait = hasDims ? item.naturalHeight! >= item.naturalWidth! : true;
    const imgStyle: React.CSSProperties = {
      position: 'absolute',
      top: '50%',
      left: '50%',
      ...(hasDims
        ? isPortrait
          ? { width: '100%', height: 'auto' }
          : { width: 'auto', height: '100%' }
        : { width: '100%', height: '100%', objectFit: 'cover' as const }),
      maxWidth: 'none',
      maxHeight: 'none',
      display: 'block',
      transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`,
      filter: slotFilterCss,
    };

    if (!isSlotResizing) {
      return (
        <img
          src={item.url}
          alt=""
          draggable={false}
          style={{
            ...imgStyle,
            opacity: processingIds.has(item.id) ? 0.55 : 1,
          }}
        />
      );
    }

    return (
      <>
        {/* Ghost: full image at dull opacity, visible beyond frame */}
        <img
          src={item.url}
          alt=""
          draggable={false}
          style={{
            ...imgStyle,
            opacity: 0.35,
            cursor: 'move',
            zIndex: 1,
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.parentElement?.getBoundingClientRect() || new DOMRect();
            handleImagePointerDown(e, item, rect);
          }}
        />
        {/* Clipped: visible portion at full opacity within frame */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 5, borderRadius: 'inherit' }}>
          <img
            src={item.url}
            alt=""
            draggable={false}
            style={imgStyle}
          />
        </div>
      </>
    );
  };

  const renderPolaroidFrame = (item: UploadedPrintItem) => {
    const frameClass = getPolaroidFrameClassName(item.frameId, boothStyles);
    const isPixelPaint = item.frameId === 8;

    const isResizing = resizingItemId === item.id;
    return (
      <div className={`${boothStyles.polaroidFrameContainer} ${frameClass}`} style={{ position: 'relative' }}>
        <div
          className={`${boothStyles.polaroidInnerSlot} print-upload-slot-container ${isResizing ? styles.slotResizing : ''}`}
          style={
            isPixelPaint
              ? {
                position: 'absolute',
                left: '25.9755%',
                top: '13.7272%',
                width: '66.93%',
                height: '68.09%',
                aspectRatio: 'auto',
                overflow: isResizing ? 'visible' : 'hidden',
              }
              : { overflow: isResizing ? 'visible' : 'hidden' }
          }
          onDoubleClick={(e) => {
            e.stopPropagation();
            setResizingItemId(item.id);
          }}
        >
          {renderSlotImage(item, isResizing)}
          {isResizing && renderBoundingBox(item)}
        </div>
        {isResizing && renderFrameOverlay(item.frameId, false)}
      </div>
    );
  };

  const renderStripFrame = (chunk: UploadedPrintItem[]) => {
    const representativeItem = chunk[0];
    const frameClass = representativeItem
      ? getPolaroidFrameClassName(representativeItem.frameId, boothStyles)
      : '';
    const activeResizingItem = chunk.find((item) => item.id === resizingItemId);
    const isAnySlotResizing = !!activeResizingItem;

    return (
      <div className={`${boothStyles.polaroidFrameContainer} ${frameClass} ${styles.modalStripFrameContainer}`} style={{ padding: '8px', position: 'relative' }}>
        <div className={`${boothStyles.stripColumn} ${styles.modalStripColumn}`} style={{ gap: '2px', width: '100%' }}>
          {[0, 1, 2].map((slotIdx) => {
            const slotItem = chunk[slotIdx];
            if (!slotItem) {
              return (
                <EmptySlot
                  key={slotIdx}
                  slotIdx={slotIdx}
                  onUploadClick={openFilePicker}
                  onDropFiles={(files) => void handleFiles(files)}
                />
              );
            }

            const isResizing = resizingItemId === slotItem.id;

            return (
              <div
                key={slotIdx}
                className={`${boothStyles.stripMiniImg} print-upload-slot-container ${isResizing ? styles.slotResizing : ''}`}
                style={{
                  aspectRatio: '1 / 1',
                  position: 'relative',
                  overflow: isResizing ? 'visible' : 'hidden',
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setResizingItemId(slotItem.id);
                }}
              >
                {renderSlotImage(slotItem, isResizing)}
                {isResizing && renderBoundingBox(slotItem)}
              </div>
            );
          })}
        </div>
        {isAnySlotResizing && representativeItem && renderFrameOverlay(representativeItem.frameId, true)}
      </div>
    );
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const showModeTabs = polaroidEnabled && stripEnabled;
  const hasImages = items.length > 0;
  const isStylePanelOpen = openStylePanel !== null;
  const isUploading = googleUploadLoading !== null || localUploadLoading;

  return createPortal(
    <>
      <div
        className={styles.overlay}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-upload-title"
        data-lenis-prevent
        data-print-upload-modal
        onClick={handleRequestClose}
      >
        <div
          className={`${styles.dialog} ${hasImages ? styles.dialogExpanded : styles.dialogCompact} ${!hasImages && isInstructionsOpen ? styles.dialogCompactWithInstructions : ''}`}
          data-lenis-prevent
          onClick={(e) => e.stopPropagation()}
          onDragEnter={handleDialogDragEnter}
          onDragLeave={handleDialogDragLeave}
          onDragOver={handleDialogDragOver}
          onDrop={handleDialogDrop}
          onPointerDown={handleDialogPointerDown}
        >
          {isUploading && (
            <div className={styles.uploadingOverlay} aria-live="polite" aria-label="Importing images, please wait">
              <div className={styles.uploadingSpinner} aria-hidden="true" />
              <p className={styles.uploadingLabel}>
                {localUploadLoading ? 'Reading files…' : googleUploadLoading === 'drive' ? 'Importing from Drive…' : 'Importing from Photos…'}
              </p>
            </div>
          )}
          <div className={styles.header}>
            <h2 id="product-upload-title" className={styles.title}>
              Upload Images {maxImages !== undefined ? `(${items.length}/${maxImages})` : ''}
            </h2>
            <button
              type="button"
              className={styles.closeButton}
              onClick={handleRequestClose}
              aria-label="Close"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {showModeTabs ? (
            <div className={styles.modeTabs}>
              <button
                type="button"
                className={`${styles.modeTab} ${mode === 'polaroid' ? styles.modeTabActive : ''}`}
                onClick={() => handleSetMode('polaroid')}
              >
                Polaroids
              </button>
              <button
                type="button"
                className={`${styles.modeTab} ${mode === 'strip' ? styles.modeTabActive : ''}`}
                onClick={() => handleSetMode('strip')}
              >
                Strips
              </button>
            </div>
          ) : null}

          <div
            className={`${styles.body} ${!hasImages ? styles.bodyEmpty : ''} ${openStylePanel === 'capture'
              ? styles.bodyCapturePanelOpen
              : openStylePanel === 'border'
                ? styles.bodyBorderPanelOpen
                : styles.bodyFilterClosed
              }`}
            data-lenis-prevent
          >
            <div
              className={`${styles.dropZoneWrap} ${hasImages ? styles.dropZoneWrapHidden : ''} ${isInstructionsOpen ? styles.dropZoneWrapWithInstructions : ''}`}
              aria-hidden={hasImages}
            >
              {!authLoading && !isAuthenticated ? (
                <div className={styles.authGateWrap}>
                  <div className={styles.authGateIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3 className={styles.authGateTitle}>Login to upload images</h3>
                  <p className={styles.authGateSubtext}>
                    Sign in or create an account to upload your photos and customise your prints.
                  </p>
                  <button
                    type="button"
                    className={styles.authGateBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      const redirectPath = pathname + (typeof window !== 'undefined' ? window.location.search : '');
                      router.push(`/auth/login?redirect=${encodeURIComponent(redirectPath)}`);
                    }}
                  >
                    Log in / Sign up
                  </button>
                </div>
              ) : (
                <div className={`${styles.dropZone} ${styles.dropZoneEmpty}`}>
                  <div className={styles.dropZoneIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M12 19V12M12 12L9.75 14.3333M12 12L14.25 14.3333M6.6 17.8333C4.61178 17.8333 3 16.1917 3 14.1667C3 12.498 4.09438 11.0897 5.59198 10.6457C5.65562 10.6268 5.7 10.5675 5.7 10.5C5.7 7.46243 8.11766 5 11.1 5C14.0823 5 16.5 7.46243 16.5 10.5C16.5 10.5582 16.5536 10.6014 16.6094 10.5887C16.8638 10.5306 17.1284 10.5 17.4 10.5C19.3882 10.5 21 12.1416 21 14.1667C21 16.1917 19.3882 17.8333 17.4 17.8333"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <p className={styles.dropTitle}>Drag & drop photos here</p>
                  <p className={styles.dropHint}>PNG, JPG or HEIC from your device</p>
                  <p className={styles.dropSizeHint}>Max 6MB per image</p>
                  <button
                    type="button"
                    className={styles.uploadBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      openFilePicker();
                    }}
                  >
                    Browse Files
                  </button>
                  <div className={styles.googleButtonsRow}>
                    <button
                      type="button"
                      className={styles.googleBtn}
                      disabled={googleUploadLoading !== null}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (connectorStatus.drive) {
                          void handleGoogleUpload('drive');
                          return;
                        }

                        // Dynamic check fallback
                        setGoogleUploadLoading('drive');
                        try {
                          const status = await connectorsApi.getStatus();
                          const connected = status.drive?.connected ?? false;
                          setConnectorStatus({
                            drive: connected,
                            photos: status.photos?.connected ?? false,
                          });
                          setGoogleUploadLoading(null);

                          if (connected) {
                            void handleGoogleUpload('drive');
                          } else {
                            setActiveConnectorModal('drive');
                          }
                        } catch (err) {
                          setGoogleUploadLoading(null);
                          setActiveConnectorModal('drive');
                        }
                      }}
                    >
                      <svg className={styles.googleBtnIcon} viewBox="0 -13.5 256 256" preserveAspectRatio="xMidYMid"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path d="M19.3542312,196.033928 L30.644172,215.534816 C32.9900287,219.64014 36.3622164,222.86588 40.3210929,225.211737 C51.6602421,210.818376 59.5534225,199.772864 64.000634,192.075201 C68.5137119,184.263529 74.0609657,172.045039 80.6423954,155.41973 C62.9064315,153.085282 49.4659974,151.918058 40.3210929,151.918058 C31.545465,151.918058 18.1051007,153.085282 0,155.41973 C0,159.964996 1.17298825,164.510261 3.51893479,168.615586 L19.3542312,196.033928 Z" fill="#0066DA"> </path> <path d="M215.681443,225.211737 C219.64032,222.86588 223.012507,219.64014 225.358364,215.534816 L230.050377,207.470615 L252.483511,168.615586 C254.829368,164.510261 256.002446,159.964996 256.002446,155.41973 C237.79254,153.085282 224.376613,151.918058 215.754667,151.918058 C206.488712,151.918058 193.072785,153.085282 175.506888,155.41973 C182.010479,172.136093 187.484394,184.354584 191.928633,192.075201 C196.412073,199.863919 204.329677,210.909431 215.681443,225.211737 Z" fill="#EA4335"> </path> <path d="M128.001268,73.3111515 C141.121182,57.4655263 150.162898,45.2470011 155.126415,36.6555757 C159.123121,29.7376196 163.521739,18.6920726 168.322271,3.51893479 C164.363395,1.1729583 159.818129,0 155.126415,0 L100.876121,0 C96.1841079,0 91.638842,1.31958557 87.6799655,3.51893479 C93.7861943,20.9210065 98.9675428,33.3058067 103.224011,40.6733354 C107.927832,48.8151881 116.186918,59.6944602 128.001268,73.3111515 Z" fill="#00832D"> </path> <path d="M175.360141,155.41973 L80.6420959,155.41973 L40.3210929,225.211737 C44.2799694,227.557893 48.8252352,228.730672 53.5172481,228.730672 L202.485288,228.730672 C207.177301,228.730672 211.722567,227.411146 215.681443,225.211737 L175.360141,155.41973 Z" fill="#2684FC"> </path> <path d="M128.001268,73.3111515 L87.680265,3.51893479 C83.7213885,5.86488134 80.3489013,9.09044179 78.0030446,13.1960654 L3.51893479,142.223575 C1.17298825,146.329198 0,150.874464 0,155.41973 L80.6423954,155.41973 L128.001268,73.3111515 Z" fill="#00AC47"> </path> <path d="M215.241501,77.7099697 L177.999492,13.1960654 C175.653635,9.09044179 172.281148,5.86488134 168.322271,3.51893479 L128.001268,73.3111515 L175.360141,155.41973 L255.855999,155.41973 C255.855999,150.874464 254.682921,146.329198 252.337064,142.223575 L215.241501,77.7099697 Z" fill="#FFBA00"> </path> </g> </g></svg>
                      {googleUploadLoading === 'drive' ? 'Opening Drive…' : 'Upload from Drive'}
                    </button>
                    <button
                      type="button"
                      className={styles.googleBtn}
                      disabled={googleUploadLoading !== null}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (connectorStatus.photos) {
                          void handleGoogleUpload('photos');
                          return;
                        }

                        // Dynamic check fallback
                        setGoogleUploadLoading('photos');
                        try {
                          const status = await connectorsApi.getStatus();
                          const connected = status.photos?.connected ?? false;
                          setConnectorStatus({
                            drive: status.drive?.connected ?? false,
                            photos: connected,
                          });
                          setGoogleUploadLoading(null);

                          if (connected) {
                            void handleGoogleUpload('photos');
                          } else {
                            setActiveConnectorModal('photos');
                          }
                        } catch (err) {
                          setGoogleUploadLoading(null);
                          setActiveConnectorModal('photos');
                        }
                      }}
                    >
                      <svg className={styles.googleBtnIcon} viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path d="M64,58.1485714 C99.328,58.1485714 128,86.8205714 128,122.148571 L128,122.148571 L128,128 L5.85142857,128 C2.63314286,128 0,125.366857 0,122.148571 C0,86.8205714 28.672,58.1485714 64,58.1485714 L64,58.1485714 Z" fill="#FBBB05"> </path> <path d="M197.851429,64 C197.851429,99.328 169.179429,128 133.851429,128 L128,128 L128,5.85142857 C128,2.63314286 130.633143,0 133.851429,0 L133.851429,0 C169.179429,0 197.851429,28.672 197.851429,64 Z" fill="#E94335"> </path> <path d="M192,197.851429 C156.672,197.851429 128,169.179429 128,133.851429 L128,133.851429 L128,128 L250.148571,128 C253.366857,128 256,130.633143 256,133.851429 L256,133.851429 C256,169.179429 227.328,197.851429 192,197.851429 L192,197.851429 Z" fill="#4285F4"> </path> <path d="M58.1485714,192 C58.1485714,156.672 86.8205714,128 122.148571,128 L128,128 L128,250.148571 C128,253.366857 125.366857,256 122.148571,256 L122.148571,256 C86.8205714,256 58.1485714,227.328 58.1485714,192 Z" fill="#0F9D58"> </path> </g> </g></svg>
                      {googleUploadLoading === 'photos' ? 'Opening Photos…' : 'Upload from Photos'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className={styles.instructionsAccordion}>
              <button
                type="button"
                className={styles.accordionHeader}
                onClick={(e) => { e.stopPropagation(); setIsInstructionsOpen((p) => !p); }}
                aria-expanded={isInstructionsOpen}
              >
                <span className={styles.accordionTitle}>Instructions for Images uploading</span>
                <svg
                  className={`${styles.accordionChevron} ${isInstructionsOpen ? styles.accordionChevronOpen : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div
                className={`${styles.accordionContent} ${isInstructionsOpen ? styles.accordionContentOpen : ''}`}
              >
                <div className={styles.accordionInner}>
                  <p>Square images are highly recommended for the best fit inside the frames.</p>
                  <p>If your image is not square, simply double-click it to scale and adjust its position.</p>
                  <p>To remove an upload, select the item frame and click the delete (trash) icon in the top-right corner.</p>
                </div>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className={styles.hiddenInput}
              onChange={(e) => {
                if (e.target.files?.length) void handleFiles(e.target.files);
                e.target.value = '';
              }}
            />

            {items.length > 0 ? (
              <div className={styles.grid}>
                {mode === 'polaroid'
                  ? items.map((item, index) => (
                    <div
                      key={item.id}
                      ref={(el) => setGridItemRef(item.id, el)}
                      className={`${styles.gridItem} ${selectedItemId === item.id ? styles.gridItemSelected : ''} ${resizingItemId === item.id ? styles.gridItemActiveResize : ''}`}
                      onClick={() => setSelectedItemId(item.id)}
                    >
                      <span className={styles.itemNumber} aria-hidden="true">
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        aria-label="Remove image"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(item.id);
                        }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="22"
                          height="22"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                      <div className={styles.gridFrameWrap}>
                        {renderPolaroidFrame(item)}
                      </div>
                    </div>
                  ))
                  : chunkedStrips.map((chunk, index) => {
                    const firstItem = chunk[0];
                    const isSelected = selectedItemId === firstItem.id;
                    return (
                      <div
                        key={firstItem.id}
                        ref={(el) => setGridItemRef(firstItem.id, el)}
                        className={`${styles.gridItem} ${isSelected ? styles.gridItemSelected : ''} ${chunk.some((entry) => entry.id === resizingItemId) ? styles.gridItemActiveResize : ''}`}
                        onClick={() => setSelectedItemId(firstItem.id)}
                      >
                        <span className={styles.itemNumber} aria-hidden="true">
                          {index + 1}
                        </span>
                        <button
                          type="button"
                          className={styles.removeBtn}
                          aria-label="Remove strip"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItem(firstItem.id);
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="22"
                            height="22"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                        <div className={`${styles.gridFrameWrap} ${styles.stripGridFrame}`}>
                          {renderStripFrame(chunk)}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : null}
          </div>

          {hasImages && !isStylePanelOpen ? (
            <div className={styles.bottomActions}>
              <div
                ref={uploadMenuRef}
                className={styles.uploadMoreWrapper}
              >
                <div className={styles.splitBtn}>
                  <button
                    type="button"
                    className={`${styles.bottomActionBtn} ${styles.uploadMoreBtn}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isUploading) setUploadMenuOpen((prev) => !prev);
                    }}
                    disabled={isUploading}
                    aria-expanded={uploadMenuOpen}
                  >
                    {isUploading ? (
                      <span className={styles.btnSpinner} aria-hidden="true" />
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M16 5h6v6" />
                        <path d="m22 5-6 6" />
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="m21 15-3.172-3.172a2 2 0 0 0-2.828 0L9 19" />
                      </svg>
                    )}
                    <span>{isUploading ? 'Importing…' : 'Upload more'}</span>
                  </button>
                  <span className={styles.splitDivider} />
                  <button
                    type="button"
                    className={styles.splitArrowBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isUploading) setUploadMenuOpen((prev) => !prev);
                    }}
                    disabled={isUploading}
                    aria-label="Toggle upload options"
                    aria-expanded={uploadMenuOpen}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </button>
                </div>

                {uploadMenuOpen && (
                  <div className={styles.upperDropdown}>
                    <button
                      type="button"
                      className={styles.dropdownItem}
                      onClick={() => {
                        openFilePicker();
                        setUploadMenuOpen(false);
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g id="SVGRepo_bgCarrier" strokeWidth="0" />
                        <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round" />
                        <g id="SVGRepo_iconCarrier">
                          <path d="M12.5535 2.49392C12.4114 2.33852 12.2106 2.25 12 2.25C11.7894 2.25 11.5886 2.33852 11.4465 2.49392L7.44648 6.86892C7.16698 7.17462 7.18822 7.64902 7.49392 7.92852C7.79963 8.20802 8.27402 8.18678 8.55352 7.88108L11.25 4.9318V16C11.25 16.4142 11.5858 16.75 12 16.75C12.4142 16.75 12.75 16.4142 12.75 16V4.9318L15.4465 7.88108C15.726 8.18678 16.2004 8.20802 16.5061 7.92852C16.8118 7.64902 16.833 7.17462 16.5535 6.86892L12.5535 2.49392Z" fill="currentColor" />
                          <path d="M3.75 15C3.75 14.5858 3.41422 14.25 3 14.25C2.58579 14.25 2.25 14.5858 2.25 15V15.0549C2.24998 16.4225 2.24996 17.5248 2.36652 18.3918C2.48754 19.2919 2.74643 20.0497 3.34835 20.6516C3.95027 21.2536 4.70814 21.5125 5.60825 21.6335C6.47522 21.75 7.57754 21.75 8.94513 21.75H15.0549C16.4225 21.75 17.5248 21.75 18.3918 21.6335C19.2919 21.5125 20.0497 21.2536 20.6517 20.6516C21.2536 20.0497 21.5125 19.2919 21.6335 18.3918C21.75 17.5248 21.75 16.4225 21.75 15.0549V15C21.75 14.5858 21.4142 14.25 21 14.25C20.5858 14.25 20.25 14.5858 20.25 15C20.25 16.4354 20.2484 17.4365 20.1469 18.1919C20.0482 18.9257 19.8678 19.3142 19.591 19.591C19.3142 19.8678 18.9257 20.0482 18.1919 20.1469C17.4365 20.2484 16.4354 20.25 15 20.25H9C7.56459 20.25 6.56347 20.2484 5.80812 20.1469C5.07435 20.0482 4.68577 19.8678 4.40901 19.591C4.13225 19.3142 3.9518 18.9257 3.85315 18.1919C3.75159 17.4365 3.75 16.4354 3.75 15Z" fill="currentColor" />
                        </g>
                      </svg>
                      <span>From Local Device</span>
                    </button>
                    <button
                      type="button"
                      className={styles.dropdownItem}
                      onClick={() => {
                        if (connectorStatus.drive) {
                          void handleGoogleUpload('drive');
                        } else {
                          setActiveConnectorModal('drive');
                        }
                        setUploadMenuOpen(false);
                      }}
                    >
                      <svg viewBox="0 -13.5 256 256" width="18" height="18" preserveAspectRatio="xMidYMid">
                        <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                        <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                        <g id="SVGRepo_iconCarrier">
                          <g>
                            <path d="M19.3542312,196.033928 L30.644172,215.534816 C32.9900287,219.64014 36.3622164,222.86588 40.3210929,225.211737 C51.6602421,210.818376 59.5534225,199.772864 64.000634,192.075201 C68.5137119,184.263529 74.0609657,172.045039 80.6423954,155.41973 C62.9064315,153.085282 49.4659974,151.918058 40.3210929,151.918058 C31.545465,151.918058 18.1051007,153.085282 0,155.41973 C0,159.964996 1.17298825,164.510261 3.51893479,168.615586 L19.3542312,196.033928 Z" fill="#0066DA"></path>
                            <path d="M215.681443,225.211737 C219.64032,222.86588 223.012507,219.64014 225.358364,215.534816 L230.050377,207.470615 L252.483511,168.615586 C254.829368,164.510261 256.002446,159.964996 256.002446,155.41973 C237.79254,153.085282 224.376613,151.918058 215.754667,151.918058 C206.488712,151.918058 193.072785,153.085282 175.506888,155.41973 C182.010479,172.136093 187.484394,184.354584 191.928633,192.075201 C196.412073,199.863919 204.329677,210.909431 215.681443,225.211737 Z" fill="#EA4335"></path>
                            <path d="M128.001268,73.3111515 C141.121182,57.4655263 150.162898,45.2470011 155.126415,36.6555757 C159.123121,29.7376196 163.521739,18.6920726 168.322271,3.51893479 C164.363395,1.1729583 159.818129,0 155.126415,0 L100.876121,0 C96.1841079,0 91.638842,1.31958557 87.6799655,3.51893479 C93.7861943,20.9210065 98.9675428,33.3058067 103.224011,40.6733354 C107.927832,48.8151881 116.186918,59.6944602 128.001268,73.3111515 Z" fill="#00832D"></path>
                            <path d="M175.360141,155.41973 L80.6420959,155.41973 L40.3210929,225.211737 C44.2799694,227.557893 48.8252352,228.730672 53.5172481,228.730672 L202.485288,228.730672 C207.177301,228.730672 211.722567,227.411146 215.681443,225.211737 L175.360141,155.41973 Z" fill="#2684FC"></path>
                            <path d="M128.001268,73.3111515 L87.680265,3.51893479 C83.7213885,5.86488134 80.3489013,9.09044179 78.0030446,13.1960654 L3.51893479,142.223575 C1.17298825,146.329198 0,150.874464 0,155.41973 L80.6423954,155.41973 L128.001268,73.3111515 Z" fill="#00AC47"></path>
                            <path d="M215.241501,77.7099697 L177.999492,13.1960654 C175.653635,9.09044179 172.281148,5.86488134 168.322271,3.51893479 L128.001268,73.3111515 L175.360141,155.41973 L255.855999,155.41973 C255.855999,150.874464 254.682921,146.329198 252.337064,142.223575 L215.241501,77.7099697 Z" fill="#FFBA00"></path>
                          </g>
                        </g>
                      </svg>
                      <span>From Google Drive</span>
                    </button>
                    <button
                      type="button"
                      className={styles.dropdownItem}
                      onClick={() => {
                        if (connectorStatus.photos) {
                          void handleGoogleUpload('photos');
                        } else {
                          setActiveConnectorModal('photos');
                        }
                        setUploadMenuOpen(false);
                      }}
                    >
                      <svg viewBox="0 0 256 256" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                        <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                        <g id="SVGRepo_iconCarrier">
                          <g>
                            <path d="M64,58.1485714 C99.328,58.1485714 128,86.8205714 128,122.148571 L128,122.148571 L128,128 L5.85142857,128 C2.63314286,128 0,125.366857 0,122.148571 C0,86.8205714 28.672,58.1485714 64,58.1485714 L64,58.1485714 Z" fill="#FBBB05"></path>
                            <path d="M197.851429,64 C197.851429,99.328 169.179429,128 133.851429,128 L128,128 L128,5.85142857 C128,2.63314286 130.633143,0 133.851429,0 L133.851429,0 C169.179429,0 197.851429,28.672 197.851429,64 Z" fill="#E94335"></path>
                            <path d="M192,197.851429 C156.672,197.851429 128,169.179429 128,133.851429 L128,133.851429 L128,128 L250.148571,128 C253.366857,128 256,130.633143 256,133.851429 L256,133.851429 C256,169.179429 227.328,197.851429 192,197.851429 L192,197.851429 Z" fill="#4285F4"></path>
                            <path d="M58.1485714,192 C58.1485714,156.672 86.8205714,128 122.148571,128 L128,128 L128,250.148571 C128,253.366857 125.366857,256 122.148571,256 L122.148571,256 C86.8205714,256 58.1485714,227.328 58.1485714,192 Z" fill="#0F9D58"></path>
                          </g>
                        </g>
                      </svg>
                      <span>From Google Photos</span>
                    </button>
                  </div>
                )}
              </div>
              <div
                ref={styleActionsRef}
                className={styles.styleActionsGroup}
              >
                <div className={`${styles.filterFabWrap} ${selectedItemId ? styles.filterFabWrapGlow : ''}`}>
                  <button
                    type="button"
                    className={`${styles.bottomActionBtn} ${styles.filterFab}`}
                    onClick={() => setOpenStylePanel('capture')}
                    aria-label="Open capture style presets"
                  >
                    <svg
                      className={styles.filterFabIcon}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
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
                    <span className={styles.filterFabLabel}>Capture Style</span>
                  </button>
                </div>
                <div className={`${styles.filterFabWrap} ${selectedItemId ? styles.filterFabWrapGlow : ''}`}>
                  <button
                    type="button"
                    className={`${styles.bottomActionBtn} ${styles.filterFab}`}
                    onClick={() => setOpenStylePanel('border')}
                    aria-label="Open border style presets"
                  >
                    <svg
                      className={styles.filterFabIcon}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <rect x="7" y="7" width="10" height="10" rx="1" />
                    </svg>
                    <span className={styles.filterFabLabel}>Border Style</span>
                  </button>
                </div>
              </div>
              <button
                type="button"
                className={`${styles.bottomActionBtn} ${styles.continueBtn}`}
                onClick={handleContinue}
                aria-label="Continue"
              >
                <span>Continue</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={styles.continueIcon}
                  aria-hidden="true"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          ) : null}

          {items.length > 0 ? (
            <div ref={filterStripRef} className={styles.bottomStrip}>
              <div
                className={`${styles.filterStrip} ${isStylePanelOpen ? styles.filterStripOpen : ''} ${styles.dialogFilterStrip}`}
                data-lenis-prevent
              >
                {openStylePanel === 'capture' ? (
                  <>
                    <div className={styles.filterStripHeader}>
                      <span className={styles.filterStripTitle}>Choose Your Capture Style</span>
                      <button
                        type="button"
                        className={styles.filterStripCloseBtn}
                        onClick={() => setOpenStylePanel(null)}
                        aria-label="Close capture styles"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                    <div className={styles.optionsScrollRow}>
                      {PRINT_CAPTURE_FILTERS.map((filter) => (
                        <button
                          key={filter.id}
                          type="button"
                          className={`${styles.filterItem} ${activeFilterId === filter.id ? styles.filterItemActive : ''}`}
                          onClick={() => void applyFilterToItems(filter.id)}
                        >
                          <div className={styles.filterPreviewContainer}>
                            {filter.id === 'original' ? (
                              <span className={styles.filterOriginalMuted} />
                            ) : (
                              <img
                                src={FILTER_PREVIEW_SAMPLE_IMAGE}
                                alt=""
                                className={styles.filterPreviewImg}
                                style={{ filter: filter.filterCss, display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            )}
                            {activeFilterId === filter.id ? (
                              <div className={styles.filterCheckIndicator}>
                                {filter.id === 'original' ? (
                                  <span className={styles.filterCheckText}>original</span>
                                ) : (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="12" height="12">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </div>
                            ) : null}
                          </div>
                          <span className={styles.filterLabel}>{filter.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                {openStylePanel === 'border' ? (
                  <div className={styles.frameStripContainer}>
                    <div className={styles.filterStripHeader}>
                      <span className={styles.filterStripTitle}>
                        {mode === 'polaroid' ? 'Polaroid Frame Options' : 'Strip Frame Options'}
                      </span>
                      <button
                        type="button"
                        className={styles.filterStripCloseBtn}
                        onClick={() => setOpenStylePanel(null)}
                        aria-label="Close border styles"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                    <div className={styles.optionsScrollRow}>
                      {Array.from({ length: 9 }).map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`${styles.frameItem} ${activeFrameId === idx ? styles.frameItemActive : ''}`}
                          onClick={() => applyFrameToItems(idx)}
                        >
                          <div className={styles.framePreviewContainer}>
                            <div className={getFramePreviewClassName(idx, styles)} />
                            {activeFrameId === idx ? (
                              <div className={styles.frameCheckIndicator}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="10" height="10">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </div>
                            ) : null}
                          </div>
                          <span className={styles.frameLabel}>{getFramePreviewLabel(idx)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {items.length === 0 && (
            <div
              className={`${styles.dragOverlay} ${isDragging ? styles.dragOverlayVisible : ''}`}
              aria-hidden={!isDragging}
            >
              <p className={styles.dragOverlayText}>Drop your memories</p>
            </div>
          )}

          {showCloseConfirm ? (
            <div
              className={styles.confirmOverlay}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="upload-close-confirm-title"
              aria-describedby="upload-close-confirm-desc"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.confirmDialog}>
                <div className={styles.confirmIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <h3 id="upload-close-confirm-title" className={styles.confirmTitle}>
                  Discard uploads?
                </h3>
                <p id="upload-close-confirm-desc" className={styles.confirmText}>
                  Your images and all applied filters will be lost if you close now.
                </p>
                <div className={styles.confirmActions}>
                  <button
                    type="button"
                    className={styles.confirmCancelBtn}
                    onClick={() => setShowCloseConfirm(false)}
                  >
                    Keep editing
                  </button>
                  <button type="button" className={styles.confirmDiscardBtn} onClick={handleConfirmClose}>
                    Discard &amp; close
                  </button>
                </div>
              </div>
            </div>
          ) : null}

        </div>
      </div>

      {activeConnectorModal ? (
        <div
          className={styles.connectorOverlay}
          onClick={(e) => {
            e.stopPropagation();
            setActiveConnectorModal(null);
          }}
        >
          <div className={styles.connectorDialog} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.connectorCloseBtn}
              onClick={() => setActiveConnectorModal(null)}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <div className={styles.connectorHeader}>
              <div className={styles.connectorTitleSection}>
                <div className={styles.connectorLogoBig}>
                  {activeConnectorModal === 'drive' ? (
                    <svg viewBox="0 -13.5 256 256" width="40" height="40" preserveAspectRatio="xMidYMid"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path d="M19.3542312,196.033928 L30.644172,215.534816 C32.9900287,219.64014 36.3622164,222.86588 40.3210929,225.211737 C51.6602421,210.818376 59.5534225,199.772864 64.000634,192.075201 C68.5137119,184.263529 74.0609657,172.045039 80.6423954,155.41973 C62.9064315,153.085282 49.4659974,151.918058 40.3210929,151.918058 C31.545465,151.918058 18.1051007,153.085282 0,155.41973 C0,159.964996 1.17298825,164.510261 3.51893479,168.615586 L19.3542312,196.033928 Z" fill="#0066DA"> </path> <path d="M215.681443,225.211737 C219.64032,222.86588 223.012507,219.64014 225.358364,215.534816 L230.050377,207.470615 L252.483511,168.615586 C254.829368,164.510261 256.002446,159.964996 256.002446,155.41973 C237.79254,153.085282 224.376613,151.918058 215.754667,151.918058 C206.488712,151.918058 193.072785,153.085282 175.506888,155.41973 C182.010479,172.136093 187.484394,184.354584 191.928633,192.075201 C196.412073,199.863919 204.329677,210.909431 215.681443,225.211737 Z" fill="#EA4335"> </path> <path d="M128.001268,73.3111515 C141.121182,57.4655263 150.162898,45.2470011 155.126415,36.6555757 C159.123121,29.7376196 163.521739,18.6920726 168.322271,3.51893479 C164.363395,1.1729583 159.818129,0 155.126415,0 L100.876121,0 C96.1841079,0 91.638842,1.31958557 87.6799655,3.51893479 C93.7861943,20.9210065 98.9675428,33.3058067 103.224011,40.6733354 C107.927832,48.8151881 116.186918,59.6944602 128.001268,73.3111515 Z" fill="#00832D"> </path> <path d="M175.360141,155.41973 L80.6420959,155.41973 L40.3210929,225.211737 C44.2799694,227.557893 48.8252352,228.730672 53.5172481,228.730672 L202.485288,228.730672 C207.177301,228.730672 211.722567,227.411146 215.681443,225.211737 L175.360141,155.41973 Z" fill="#2684FC"> </path> <path d="M128.001268,73.3111515 L87.680265,3.51893479 C83.7213885,5.86488134 80.3489013,9.09044179 78.0030446,13.1960654 L3.51893479,142.223575 C1.17298825,146.329198 0,150.874464 0,155.41973 L80.6423954,155.41973 L128.001268,73.3111515 Z" fill="#00AC47"> </path> <path d="M215.241501,77.7099697 L177.999492,13.1960654 C175.653635,9.09044179 172.281148,5.86488134 168.322271,3.51893479 L128.001268,73.3111515 L175.360141,155.41973 L255.855999,155.41973 C255.855999,150.874464 254.682921,146.329198 252.337064,142.223575 L215.241501,77.7099697 Z" fill="#FFBA00"> </path> </g> </g></svg>
                  ) : (
                    <svg viewBox="0 0 256 256" width="36" height="36" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path d="M64,58.1485714 C99.328,58.1485714 128,86.8205714 128,122.148571 L128,122.148571 L128,128 L5.85142857,128 C2.63314286,128 0,125.366857 0,122.148571 C0,86.8205714 28.672,58.1485714 64,58.1485714 L64,58.1485714 Z" fill="#FBBB05"> </path> <path d="M197.851429,64 C197.851429,99.328 169.179429,128 133.851429,128 L128,128 L128,5.85142857 C128,2.63314286 130.633143,0 133.851429,0 L133.851429,0 C169.179429,0 197.851429,28.672 197.851429,64 Z" fill="#E94335"> </path> <path d="M192,197.851429 C156.672,197.851429 128,169.179429 128,133.851429 L128,133.851429 L128,128 L250.148571,128 C253.366857,128 256,130.633143 256,133.851429 L256,133.851429 C256,169.179429 227.328,197.851429 192,197.851429 L192,197.851429 Z" fill="#4285F4"> </path> <path d="M58.1485714,192 C58.1485714,156.672 86.8205714,128 122.148571,128 L128,128 L128,250.148571 C128,253.366857 125.366857,256 122.148571,256 L122.148571,256 C86.8205714,256 58.1485714,227.328 58.1485714,192 Z" fill="#0F9D58"> </path> </g> </g></svg>
                  )}
                </div>
                <div className={styles.connectorTitles}>
                  <h3 className={styles.connectorTitleText}>
                    {activeConnectorModal === 'drive' ? 'Google Drive' : 'Google Photos'}
                  </h3>
                  <span className={styles.connectorCategoryText}>
                    {activeConnectorModal === 'drive' ? 'Productivity' : 'Media'}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.connectorBody}>
              <p className={styles.connectorIntro}>
                Give Scribble access to your {activeConnectorModal === 'drive' ? 'Google Drive' : 'Google Photos'} files.
              </p>

              <div className={styles.connectorDivider} />

              <h4 className={styles.connectorAboutTitle}>About this Connector</h4>

              <div className={styles.connectorInfoRow}>
                <div className={styles.connectorInfoIcon}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className={styles.connectorInfoTextSection}>
                  <div className={styles.connectorInfoHead}>Access your files</div>
                  <div className={styles.connectorInfoBody}>
                    Search for files, photos of your {activeConnectorModal === 'drive' ? 'Google Drive' : 'Google Photos'} to import it.
                  </div>
                </div>
              </div>

              <div className={styles.connectorInfoRow}>
                <div className={styles.connectorInfoIcon}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div className={styles.connectorInfoTextSection}>
                  <div className={styles.connectorInfoHead}>We never train on your data</div>
                  <div className={styles.connectorInfoBody}>
                    Scribble does not train on your {activeConnectorModal === 'drive' ? 'Google Drive' : 'Google Photos'} data.
                  </div>
                </div>
              </div>

              <div className={styles.connectorInfoRow}>
                <div className={styles.connectorInfoIcon}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div className={styles.connectorInfoTextSection}>
                  <div className={styles.connectorInfoHead}>You control your data</div>
                  <div className={styles.connectorInfoBody}>
                    Disconnect anytime in your account settings.
                  </div>
                </div>
              </div>

              <button
                type="button"
                className={styles.connectorConnectBtnBottom}
                onClick={() => {
                  const source = activeConnectorModal;
                  setActiveConnectorModal(null);
                  setVerifyNoticeSource(source);
                }}
              >
                Connect
              </button>

              <div className={styles.connectorPrivacyPolicyText}>
                By connecting, you agree to our{' '}
                <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </Link>
                .
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {verifyNoticeSource && typeof document !== 'undefined' ? createPortal(
        <div
          className={styles.noticeOverlay}
          onClick={(e) => {
            e.stopPropagation();
            setVerifyNoticeSource(null);
          }}
        >
          <div className={styles.noticeDialog} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.noticeTitle}>Google OAuth Verification Notice (for Customers and Google)</h3>
            <div className={styles.noticeText}>
              <p className={styles.noticeParagraph}>
                When signing in with Google, you may see a message stating &quot;Google hasn't verified this app.&quot; This is not a security issue or data breach. The warning appears because Scribble's Google OAuth verification is currently under review and has not yet been approved by Google.
              </p>
              <p className={styles.noticeParagraph}>
                Scribble uses Google's official OAuth authentication system, and all user data is transmitted securely over encrypted connections. We only request the permissions necessary to provide the application's intended functionality, and user information is handled securely in accordance with our Privacy Policy.
              </p>
              <p className={styles.noticeParagraph}>
                This warning is a standard Google message shown to applications awaiting verification. Once Google completes the verification process, this warning will be automatically removed, and users will be able to sign in without seeing the unverified app screen.
              </p>
              <p className={styles.noticeParagraph}>
                We appreciate your patience while the verification process is completed.
              </p>
            </div>
            <div className={styles.noticeActions}>
              <button
                type="button"
                className={styles.noticeCancelBtn}
                onClick={() => setVerifyNoticeSource(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.noticeConfirmBtn}
                onClick={() => {
                  const source = verifyNoticeSource;
                  setVerifyNoticeSource(null);
                  void handleConnectorConnect(source);
                }}
              >
                I trust scribble, proceed
              </button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>,
    document.body,
  );
}
