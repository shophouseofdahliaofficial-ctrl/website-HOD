import type { PbTextPresetKind } from './constants';
import type { PbCanvasSerialized } from './types';

export type { PbCanvasSerialized };
import type { PbCanvasTextStyle } from './textStyle';

export type PbImageInsertOptions = {
  /** Max width/height in scene pixels; keeps aspect ratio. */
  maxSceneDimension?: number;
  /** Move the new image above other user content after insert. */
  bringToFront?: boolean;
};

/** Imperative API for one photobook page canvas (gallery, tools, sidebar). */
export type PbCanvasPageApi = {
  addImageFromUrl: (url: string, x?: number, y?: number, options?: PbImageInsertOptions) => Promise<void>;
  addImageFromScenePoint: (url: string, sceneX: number, sceneY: number) => Promise<void>;
  addImageFromClientEvent: (url: string, event: MouseEvent | DragEvent) => Promise<void>;
  addShape: (shapeName: string) => Promise<void>;
  addCustomLine: (lineType: 'straight' | 'curve' | 'zigzag') => Promise<void>;
  addEmoji: (emoji: string) => Promise<void>;
  addCanvasText: (text?: string) => Promise<void>;
  addTextPreset: (preset: PbTextPresetKind) => Promise<void>;
  duplicateActiveObject: () => boolean;
  toggleLockActiveObject: () => boolean;
  setActiveObjectFill: (color: string) => void;
  applyActiveTextStyle: (patch: Partial<PbCanvasTextStyle>, skipPersist?: boolean) => void;
  applyActiveObjectStyle: (patch: Record<string, any>, skipPersist?: boolean) => void;
  cropActiveImage: () => void;
  applyImageCrop: () => void;
  cancelImageCrop: () => void;
  reloadFromData: (data: PbCanvasSerialized | undefined) => Promise<void>;
  removeActiveObject: () => boolean;
  /** Re-sync canvas CSS/backstore to DOM zoom host (not a zoom transform). */
  refreshDisplayScale: (opts?: { cssOnly?: boolean; domZoom?: number }) => void;
  clearSelection?: () => void;
  applyLayout: (layoutId: string, frameGapEnabled?: boolean) => void;
  applyCoverDesign: (designId: string) => void;
  placeImageInFirstEmptyFrame: (url: string) => Promise<boolean>;
  placeImageInFrameById: (frameId: string, url: string) => Promise<boolean>;
  placeImageInFrameAtPoint: (url: string, event: MouseEvent | DragEvent) => Promise<boolean>;
  hasFilledFrames: () => boolean;
  openFrameCropModal: () => boolean;
  applyFrameAdjust: () => void;
  cancelFrameAdjust: () => void;
  setFrameAdjustZoom: (scale: number) => void;
  applyFrameCrop: (frameId: string, crop: import('./frameMeta').PbFrameCrop) => void;
  applyFrameImageStyle: (patch: import('./frameImageStyle').PbFrameImageStylePatch) => void;
  /** Serialize the live canvas document (for save before debounced state catches up). */
  captureDocumentSnapshot: () => PbCanvasSerialized | undefined;
  handleGalleryDragOver?: (url: string | null | undefined, event: DragEvent) => void;
  handleGalleryDragLeave?: () => void;
  handleGalleryDrop?: (
    url: string,
    event: DragEvent,
    options?: { isSticker?: boolean },
  ) => Promise<void>;
};

/** @deprecated Use PbCanvasPageApi */
export type PbFabricPageApi = PbCanvasPageApi;

/** @deprecated Use PbCanvasSerialized */
export type PbFabricSerialized = PbCanvasSerialized;
