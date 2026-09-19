import { getPhotoboothProductIdForVibe, photoboothApi } from '@/lib/api/photobooth';
import { generateA4PrintPdf } from '@/lib/photobooth/a4PrintPdf';
import {
  generateKeepsakeDataUrl,
  KEEPSAKE_DOWNLOAD_SCALE,
} from '@/lib/photobooth/generateKeepsake';
import type { PhotoboothProjectJson, PhotoboothProjectRecord } from '@/lib/photobooth/projectTypes';
import type { CartItem } from '@/lib/utils/cart';

export type PurchaseProgressStep =
  | 'rendering'
  | 'pdf'
  | 'uploading'
  | 'saving'
  | 'cart'
  | 'done';

export type PurchaseProgress = {
  step: PurchaseProgressStep;
  percent: number;
  message: string;
};

type VibeImages = string[];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Small JPEG preview for cart only — not uploaded to Bunny. */
async function createCartPreviewDataUrl(fullPngDataUrl: string): Promise<string> {
  const img = await loadImage(fullPngDataUrl);
  const maxW = 360;
  const scale = maxW / img.width;
  const w = maxW;
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return fullPngDataUrl;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.88);
}

function buildProjectJson(input: {
  selectedVibe: 'polaroid' | 'strip';
  quantity: number;
  selectedFrame: number;
  cardFrames: number[];
  capturedPhotos: {
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
  }[];
}): PhotoboothProjectJson {
  return {
    version: 1,
    selectedVibe: input.selectedVibe,
    quantity: input.quantity,
    selectedFrame: input.selectedFrame,
    cardFrames: input.cardFrames,
    capturedPhotos: input.capturedPhotos.map((p) => ({
      url: p.url,
      filterId: p.filterId,
      frameId: p.frameId,
      ...(p.stripSlotUrls ? { stripSlotUrls: p.stripSlotUrls } : {}),
      x: p.x,
      y: p.y,
      scale: p.scale,
      naturalWidth: p.naturalWidth,
      naturalHeight: p.naturalHeight,
      containerWidth: p.containerWidth,
      containerHeight: p.containerHeight,
      stripSlotTransforms: p.stripSlotTransforms,
    })),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Full purchase pipeline: render → A4 PDF → Bunny upload → Supabase save.
 */
export async function executePhotoboothUpload(
  input: {
    selectedVibe: 'polaroid' | 'strip';
    quantity: number;
    selectedFrame: number;
    cardFrames: number[];
    capturedPhotos: {
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
    }[];
    vibeImages: VibeImages;
    projectJson?: PhotoboothProjectJson;
  },
  onProgress?: (progress: PurchaseProgress) => void,
): Promise<{ project: PhotoboothProjectRecord; cartPreviewUrl: string }> {
  const photos = input.capturedPhotos;
  if (photos.length === 0) throw new Error('No photos to purchase');

  const projectJson = input.projectJson || buildProjectJson(input);
  const vibeId = input.selectedVibe;

  onProgress?.({ step: 'rendering', percent: 5, message: 'Rendering your polaroids…' });

  const renderedPngs: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const frameId = typeof photo.frameId === 'number' ? photo.frameId : input.selectedFrame;
    const dataUrl = await generateKeepsakeDataUrl(
      photo,
      vibeId,
      input.vibeImages,
      frameId,
      { scale: KEEPSAKE_DOWNLOAD_SCALE },
    );
    renderedPngs.push(dataUrl);
    onProgress?.({
      step: 'rendering',
      percent: 5 + Math.round(((i + 1) / photos.length) * 35),
      message: `Rendering polaroid ${i + 1} of ${photos.length}…`,
    });
  }

  onProgress?.({ step: 'pdf', percent: 45, message: 'Generating high-resolution prints…' });
  const printPdf = await generateA4PrintPdf(renderedPngs, vibeId);
  onProgress?.({ step: 'pdf', percent: 60, message: 'Prints ready' });

  onProgress?.({ step: 'uploading', percent: 65, message: 'Uploading high-resolution prints…' });

  const projectId = crypto.randomUUID();
  let project: PhotoboothProjectRecord;

  try {
    project = await photoboothApi.createProject({
      projectId,
      projectType: vibeId,
      projectJson,
      quantity: photos.length,
      printPdf,
      printScale: KEEPSAKE_DOWNLOAD_SCALE,
    });
  } catch (err) {
    throw err;
  }

  onProgress?.({ step: 'saving', percent: 90, message: 'Project saved' });

  const cartPreviewUrl = await createCartPreviewDataUrl(renderedPngs[0]);

  return { project, cartPreviewUrl };
}

export async function executePhotoboothPurchase(
  input: Parameters<typeof executePhotoboothUpload>[0],
  onProgress?: (progress: PurchaseProgress) => void,
): Promise<{ project: PhotoboothProjectRecord; cartItem: CartItem }> {
  const { project, cartPreviewUrl } = await executePhotoboothUpload(input, onProgress);
  
  const config = await photoboothApi.getConfig();
  const productId = project.productId ?? getPhotoboothProductIdForVibe(config, input.selectedVibe);
  if (!productId) throw new Error('Photobooth product is not configured');

  const cartItem: CartItem = {
    productId: String(productId),
    quantity: 1,
    customizations: {
      photoboothProject: {
        projectId: project.id,
        projectType: input.selectedVibe,
        previewUrl: cartPreviewUrl,
        polaroidCount: input.capturedPhotos.length,
        price: project.price,
        label: `${input.capturedPhotos.length} ${input.selectedVibe === 'strip' ? 'photo strip(s)' : 'polaroid(s)'} print`,
      },
    },
  };

  onProgress?.({ step: 'cart', percent: 100, message: 'Added to cart' });

  return { project, cartItem };
}

/**
 * Adapter for ProductPrintUploadModal UploadedPrintItems
 */
export async function executePrintModalUpload(
  items: any[],
  mode: 'polaroid' | 'strip',
  onProgress?: (progress: PurchaseProgress) => void,
): Promise<{ project: PhotoboothProjectRecord; cartPreviewUrl: string }> {
  // Map modal items to capturedPhotos format
  let capturedPhotos: any[] = [];
  
  if (mode === 'polaroid') {
    capturedPhotos = items.map(item => ({
      url: item.url,
      filterId: item.filterId,
      frameId: item.frameId,
      x: item.x,
      y: item.y,
      scale: item.scale,
      naturalWidth: item.naturalWidth,
      naturalHeight: item.naturalHeight,
      containerWidth: item.containerWidth,
      containerHeight: item.containerHeight,
    }));
  } else {
    // For strips, group every 3 items into a single capturedPhoto with stripSlotUrls
    const chunkedStrips = [];
    for (let i = 0; i < items.length; i += 3) {
      chunkedStrips.push(items.slice(i, i + 3));
    }
    
    capturedPhotos = chunkedStrips.map(chunk => {
      // Use the first frameId as the frameId for the whole strip (as strips apply the frame globally)
      const primaryItem = chunk[0];
      return {
        url: primaryItem.url,
        filterId: primaryItem.filterId,
        frameId: primaryItem.frameId,
        stripSlotUrls: [
          chunk[0]?.url || '',
          chunk[1]?.url || '',
          chunk[2]?.url || '',
        ],
        stripSlotTransforms: chunk.map(item => ({
          x: item.x,
          y: item.y,
          scale: item.scale,
          naturalWidth: item.naturalWidth,
          naturalHeight: item.naturalHeight,
          containerWidth: item.containerWidth,
          containerHeight: item.containerHeight,
        }))
      };
    });
  }

  return executePhotoboothUpload({
    selectedVibe: mode,
    quantity: 1, // handled by cart quantity later
    selectedFrame: capturedPhotos[0]?.frameId || 1,
    cardFrames: [],
    capturedPhotos,
    vibeImages: [], // Not needed for modal since user selected all photos
  }, onProgress);
}

/**
 * Roll back a partially created project if cart add fails.
 */
export async function rollbackPhotoboothProject(projectId: string): Promise<void> {
  try {
    await photoboothApi.deleteProject(projectId);
  } catch (err) {
    console.error('[photobooth] Failed to roll back project:', err);
  }
}
