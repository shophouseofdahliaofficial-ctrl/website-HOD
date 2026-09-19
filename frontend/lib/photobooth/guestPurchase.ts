import { getPhotoboothProductIdForVibe, photoboothApi } from '@/lib/api/photobooth';
import { generateA4PrintPdf } from '@/lib/photobooth/a4PrintPdf';
import {
  generateKeepsakeDataUrl,
  KEEPSAKE_DOWNLOAD_SCALE,
} from '@/lib/photobooth/generateKeepsake';
import { calculatePrintOrderTotal } from '@/lib/photobooth/purchaseConstants';
import type { PurchaseProgress } from '@/lib/photobooth/purchaseFlow';
import {
  clearPendingPurchase,
  readPendingPrintPdfBlob,
  readPendingPurchase,
  savePendingPurchase,
} from '@/lib/photobooth/pendingPurchase';
import type { PhotoboothProjectJson } from '@/lib/photobooth/projectTypes';
import type { CartItem } from '@/lib/utils/cart';
import { getCartStorage } from '@/lib/utils/cart';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

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
    })),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Logged-out buy flow: render locally, stash PDF in sessionStorage, add guest cart line.
 */
export async function prepareGuestPhotoboothForCart(
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
    }[];
    vibeImages: string[];
    projectJson?: PhotoboothProjectJson;
  },
  onProgress?: (progress: PurchaseProgress) => void,
): Promise<CartItem> {
  const photos = input.capturedPhotos;
  if (photos.length === 0) throw new Error('No photos to purchase');

  const projectJson = input.projectJson || buildProjectJson(input);
  const vibeId = input.selectedVibe;
  const clientPendingId = crypto.randomUUID();

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

  onProgress?.({ step: 'pdf', percent: 45, message: 'Preparing your print order…' });
  const printPdf = await generateA4PrintPdf(renderedPngs, vibeId);

  onProgress?.({ step: 'saving', percent: 70, message: 'Saving to cart…' });

  const config = await photoboothApi.getConfig();
  const productId = getPhotoboothProductIdForVibe(config, vibeId);
  if (!productId) throw new Error('Photobooth product is not configured');

  const previewUrl = await createCartPreviewDataUrl(renderedPngs[0]);
  const price = calculatePrintOrderTotal(photos.length);

  await savePendingPurchase({
    projectJson,
    vibeImages: input.vibeImages,
    clientPendingId,
    printPdf,
  });

  onProgress?.({ step: 'cart', percent: 100, message: 'Added to cart' });

  return {
    productId: String(productId),
    quantity: 1,
    customizations: {
      photoboothProject: {
        clientPendingId,
        pendingFinalize: true,
        projectType: vibeId,
        previewUrl,
        polaroidCount: photos.length,
        price,
        label: `${photos.length} ${vibeId === 'strip' ? 'photo strip(s)' : 'polaroid(s)'} print`,
      },
    },
  };
}

/**
 * After login: upload pending PDF, create server project, update cart line.
 */
export async function finalizePendingPhotoboothCartItems(userId: string): Promise<void> {
  const pending = readPendingPurchase();
  const printPdf = await readPendingPrintPdfBlob();
  if (!pending || !printPdf) return;

  const cart = getCartStorage(userId);
  const items = cart.get();
  const pendingItems = items.filter(
    (it) => it.customizations?.photoboothProject?.pendingFinalize
      && it.customizations.photoboothProject.clientPendingId === pending.clientPendingId,
  );
  if (pendingItems.length === 0) return;

  const projectId = crypto.randomUUID();
  let project;

  try {
    project = await photoboothApi.createProject({
      projectId,
      projectType: pending.projectJson.selectedVibe,
      projectJson: pending.projectJson,
      quantity: pending.projectJson.capturedPhotos.length,
      printPdf,
      printScale: KEEPSAKE_DOWNLOAD_SCALE,
    });
  } catch (err) {
    throw err;
  }

  const nextItems = items.map((it) => {
    const pb = it.customizations?.photoboothProject;
    if (!pb?.pendingFinalize || pb.clientPendingId !== pending.clientPendingId) return it;

    return {
      ...it,
      customizations: {
        ...it.customizations,
        photoboothProject: {
          projectId: project.id,
          projectType: pb.projectType,
          previewUrl: pb.previewUrl,
          polaroidCount: pb.polaroidCount,
          price: project.price,
          label: pb.label,
        },
      },
    };
  });

  cart.setAll(nextItems);
  clearPendingPurchase();
}

export async function finalizePendingPhotoboothCartItemsSafe(userId: string): Promise<void> {
  try {
    await finalizePendingPhotoboothCartItems(userId);
  } catch (err) {
    const pending = readPendingPurchase();
    if (pending) {
      console.error('[photobooth] Failed to finalize pending cart item:', err);
    }
  }
}
