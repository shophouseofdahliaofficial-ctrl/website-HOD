export type PhotoboothVibeId = 'polaroid' | 'strip';

export type PhotoboothCapturedPhoto = {
  url: string;
  filterId: string;
  frameId?: number;
  stripSlotUrls?: [string, string, string];
  x?: number;
  y?: number;
  scale?: number;
  naturalWidth?: number;
  naturalHeight?: number;
  containerWidth?: number;
  containerHeight?: number;
  stripSlotTransforms?: any[];
};

export type PhotoboothProjectJson = {
  version: 1;
  selectedVibe: PhotoboothVibeId;
  quantity: number;
  selectedFrame: number;
  cardFrames: number[];
  capturedPhotos: PhotoboothCapturedPhoto[];
  createdAt: string;
  printScale?: number;
  generatedPdfUrl?: string | null;
};

export type PhotoboothProjectRecord = {
  id: string;
  userId: string;
  projectType: PhotoboothVibeId;
  projectJson: PhotoboothProjectJson;
  previewUrl: string | null;
  generatedPdfUrl: string | null;
  quantity: number;
  price: number;
  createdAt: string;
  productId: number | null;
};

export type PhotoboothCartCustomization = {
  photoboothProject: {
    projectId?: string;
    clientPendingId?: string;
    pendingFinalize?: boolean;
    projectType: PhotoboothVibeId;
    previewUrl: string;
    polaroidCount: number;
    price: number;
    label: string;
  };
};
