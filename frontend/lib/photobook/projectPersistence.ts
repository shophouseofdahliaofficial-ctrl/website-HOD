import { photobookApi } from '@/lib/api/photobook';
import type { PbCanvasSerialized } from '@/components/photobook/canvas';
import type { PbPageMeta, PhotobookProjectJson, PhotobookUploadedImageMeta } from '@/lib/photobook/projectTypes';
import {
  cloneFabricJson,
  walkAndReplaceUrls,
} from '@/lib/photobook/printPdf';
import {
  collectRemoteImageUrlsFromFabric,
  generateProjectPreviewBlob,
  isCloudinaryStickerUrl,
  isLocalImageUrl,
} from '@/lib/photobook/canvasExport';
import type { PhotobookPageSizePx } from '@/lib/product/photobookDimensions';

export type PbUploadedImageEntry = {
  id: string;
  url: string;
  name: string;
  bunnyUrl?: string;
};

export type PersistPhotobookInput = {
  projectId?: string;
  productId: string;
  variationId?: string;
  projectName: string;
  quantity: number;
  price?: number;
  pageSizeCm: { width: number; height: number };
  pageSizePx: PhotobookPageSizePx;
  selectedCustomizations: Record<string, string>;
  textPersonalizations: Record<string, string>;
  pages: PbPageMeta[];
  fabricByPageId: Record<string, PbCanvasSerialized>;
  uploadedImages: PbUploadedImageEntry[];
  imageFileMap: Map<string, File>;
  pageIds: string[];
  status?: 'draft' | 'cart';
};

const bunnyUrlByLocalRef = new Map<string, string>();

export function rememberBunnyUrl(localRef: string, bunnyUrl: string) {
  bunnyUrlByLocalRef.set(localRef, bunnyUrl);
}

export function getKnownBunnyUrl(localRef: string): string | undefined {
  return bunnyUrlByLocalRef.get(localRef);
}

async function localUrlToBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

async function resolveUploadBlob(
  localUrl: string,
  imageFileMap: Map<string, File>,
  uploadedImages: PbUploadedImageEntry[],
): Promise<{ blob: Blob; filename: string; imageId: string } | null> {
  const byGallery = uploadedImages.find((img) => img.url === localUrl || img.bunnyUrl === localUrl);
  if (byGallery) {
    const file = imageFileMap.get(byGallery.id);
    if (file) {
      return { blob: file, filename: file.name, imageId: byGallery.id };
    }
    if (byGallery.bunnyUrl && !isLocalImageUrl(byGallery.bunnyUrl)) {
      return null;
    }
  }

  const blob = await localUrlToBlob(localUrl);
  if (!blob) return null;

  const imageId = byGallery?.id || `img_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const filename = byGallery?.name || `upload_${imageId}.jpg`;
  return { blob, filename, imageId };
}

async function ensureProjectId(input: PersistPhotobookInput): Promise<string> {
  if (input.projectId) return input.projectId;

  const emptyJson: PhotobookProjectJson = {
    version: 1,
    projectName: input.projectName,
    productId: input.productId,
    variationId: input.variationId,
    selectedCustomizations: input.selectedCustomizations,
    textPersonalizations: input.textPersonalizations,
    pageSizeCm: input.pageSizeCm,
    pageSizePx: input.pageSizePx,
    quantity: input.quantity,
    pages: input.pages.map((p) => ({ ...p, slotImages: p.slotImages?.map((u) => (isLocalImageUrl(u) ? undefined : u)) })),
    fabricByPageId: {},
    uploadedImages: [],
  };

  const created = await photobookApi.saveProject({
    productId: input.productId,
    variationId: input.variationId,
    projectName: input.projectName,
    projectJson: emptyJson,
    quantity: input.quantity,
    price: input.price,
    pageCount: input.pages.length,
    status: 'draft',
  });

  return created.id;
}

type FabricImageRef = { type?: string; src?: string; sourceUrl?: string };

function resolvePersistedRemoteImageUrl(obj: FabricImageRef): string | undefined {
  for (const url of [obj.sourceUrl, obj.src]) {
    if (!url || isLocalImageUrl(url) || isCloudinaryStickerUrl(url)) continue;
    return url;
  }
  return undefined;
}

/** Map transient blob:/data: refs to already-uploaded Bunny URLs (live canvas keeps blob src). */
function seedRemoteUrlsFromFabric(
  fabricByPageId: Record<string, PbCanvasSerialized>,
  urlMap: Map<string, string>,
) {
  for (const fabric of Object.values(fabricByPageId)) {
    const objects = (fabric as { objects?: FabricImageRef[] }).objects || [];
    for (const obj of objects) {
      if (obj.type !== 'Image' && obj.type !== 'image') continue;
      const remote = resolvePersistedRemoteImageUrl(obj);
      if (!remote) continue;
      if (obj.sourceUrl) urlMap.set(obj.sourceUrl, remote);
      if (obj.src) {
        urlMap.set(obj.src, remote);
        if (isLocalImageUrl(obj.src)) rememberBunnyUrl(obj.src, remote);
      }
    }
  }
}

async function uploadPendingImages(
  projectId: string,
  input: PersistPhotobookInput,
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  seedRemoteUrlsFromFabric(input.fabricByPageId, urlMap);

  for (const img of input.uploadedImages) {
    if (img.bunnyUrl) {
      urlMap.set(img.url, img.bunnyUrl);
      urlMap.set(img.id, img.bunnyUrl);
      rememberBunnyUrl(img.url, img.bunnyUrl);
      continue;
    }
    const known = getKnownBunnyUrl(img.url);
    if (known) {
      urlMap.set(img.url, known);
      continue;
    }
    if (!isLocalImageUrl(img.url)) {
      urlMap.set(img.url, img.url);
      continue;
    }

    const file = input.imageFileMap.get(img.id);
    if (!file) continue;

    const uploaded = await photobookApi.uploadImage(projectId, img.id, file, file.name);
    urlMap.set(img.url, uploaded.url);
    urlMap.set(img.id, uploaded.url);
    rememberBunnyUrl(img.url, uploaded.url);
  }

  const localUrls = new Set<string>();
  for (const page of input.pages) {
    for (const slot of page.slotImages || []) {
      if (isLocalImageUrl(slot)) localUrls.add(slot!);
    }
  }
  for (const fabric of Object.values(input.fabricByPageId)) {
    const objects = (fabric as { objects?: FabricImageRef[] }).objects || [];
    for (const obj of objects) {
      if (obj.type !== 'Image' && obj.type !== 'image') continue;
      const remote = resolvePersistedRemoteImageUrl(obj);
      if (remote) {
        if (obj.src && isLocalImageUrl(obj.src)) urlMap.set(obj.src, remote);
        continue;
      }
      for (const url of [obj.src, obj.sourceUrl]) {
        if (isLocalImageUrl(url)) localUrls.add(url!);
      }
    }
  }

  for (const localUrl of localUrls) {
    if (urlMap.has(localUrl)) continue;
    const known = getKnownBunnyUrl(localUrl);
    if (known) {
      urlMap.set(localUrl, known);
      continue;
    }
    if (isCloudinaryStickerUrl(localUrl)) {
      urlMap.set(localUrl, localUrl);
      continue;
    }

    const payload = await resolveUploadBlob(localUrl, input.imageFileMap, input.uploadedImages);
    if (!payload) continue;

    const existing = urlMap.get(payload.imageId);
    if (existing) {
      urlMap.set(localUrl, existing);
      continue;
    }

    const uploaded = await photobookApi.uploadImage(
      projectId,
      payload.imageId,
      payload.blob,
      payload.filename,
    );
    urlMap.set(localUrl, uploaded.url);
    urlMap.set(payload.imageId, uploaded.url);
    rememberBunnyUrl(localUrl, uploaded.url);
  }

  return urlMap;
}

function applyUrlMapToProject(input: PersistPhotobookInput, urlMap: Map<string, string>) {
  const replace = (url: string) => {
    if (isCloudinaryStickerUrl(url)) return url;
    return urlMap.get(url) || getKnownBunnyUrl(url) || url;
  };

  const pages: PbPageMeta[] = input.pages.map((page) => ({
    ...(page.id === 'bc'
      ? { ...page, bg: '#ffffff', layout: 'blank', caption: '', slotImages: [] }
      : page),
    slotImages: page.slotImages?.map((u) => (u ? replace(u) : u)),
  }));

  const fabricByPageId: Record<string, PbCanvasSerialized> = {};
  for (const [pageId, fabric] of Object.entries(input.fabricByPageId)) {
    if (pageId === 'bc') continue;
    fabricByPageId[pageId] = walkAndReplaceUrls(cloneFabricJson(fabric), replace) as PbCanvasSerialized;
  }

  const uploadedImages: PhotobookUploadedImageMeta[] = input.uploadedImages
    .map((img) => {
      const bunnyUrl = urlMap.get(img.url) || img.bunnyUrl || getKnownBunnyUrl(img.url);
      if (!bunnyUrl || isLocalImageUrl(bunnyUrl)) return null;
      return { id: img.id, bunnyUrl, name: img.name };
    })
    .filter((x): x is PhotobookUploadedImageMeta => !!x);

  const projectJson: PhotobookProjectJson = {
    version: 1,
    projectName: input.projectName,
    productId: input.productId,
    variationId: input.variationId,
    selectedCustomizations: input.selectedCustomizations,
    textPersonalizations: input.textPersonalizations,
    pageSizeCm: input.pageSizeCm,
    pageSizePx: input.pageSizePx,
    quantity: input.quantity,
    pages,
    fabricByPageId,
    uploadedImages,
  };

  return projectJson;
}

function assertNoLocalUrlsInJson(json: PhotobookProjectJson) {
  const jsonStr = JSON.stringify(json);
  if (jsonStr.includes('blob:') || jsonStr.includes('data:image')) {
    throw new Error('Some images failed to upload. Please try saving again.');
  }
}

export async function persistPhotobookProject(input: PersistPhotobookInput) {
  const projectId = await ensureProjectId(input);
  const urlMap = await uploadPendingImages(projectId, input);
  const projectJson = applyUrlMapToProject(input, urlMap);
  assertNoLocalUrlsInJson(projectJson);

  const preview = await generateProjectPreviewBlob(input.pageIds);

  const saved = await photobookApi.saveProject({
    projectId,
    productId: input.productId,
    variationId: input.variationId,
    projectName: input.projectName,
    projectJson,
    quantity: input.quantity,
    price: input.price,
    pageCount: input.pages.length,
    status: input.status || 'draft',
    preview: preview || undefined,
  });

  return saved;
}

export function hydrateUploadedImagesFromProject(json: PhotobookProjectJson): PbUploadedImageEntry[] {
  const fromMeta = (json.uploadedImages || []).map((img) => ({
    id: img.id,
    url: img.bunnyUrl,
    name: img.name,
    bunnyUrl: img.bunnyUrl,
  }));
  if (fromMeta.length > 0) return fromMeta;

  const seen = new Set<string>();
  const restored: PbUploadedImageEntry[] = [];
  for (const fabric of Object.values(json.fabricByPageId || {})) {
    const objects = (fabric as { objects?: Array<{ type?: string; pbKind?: string; src?: string; sourceUrl?: string }> })?.objects;
    if (!Array.isArray(objects)) continue;
    for (const obj of objects) {
      if (obj.type !== 'Image' && obj.type !== 'image') continue;
      const remoteUrl = obj.sourceUrl || obj.src;
      if (!remoteUrl || isLocalImageUrl(remoteUrl) || isCloudinaryStickerUrl(remoteUrl) || seen.has(remoteUrl)) {
        continue;
      }
      seen.add(remoteUrl);
      restored.push({
        id: `img_restored_${restored.length + 1}`,
        url: remoteUrl,
        name: 'Photo',
        bunnyUrl: remoteUrl,
      });
    }
  }
  return restored;
}

export function collectAllBunnyUrls(json: PhotobookProjectJson): string[] {
  const urls = new Set<string>();
  for (const img of json.uploadedImages || []) {
    if (img.bunnyUrl) urls.add(img.bunnyUrl);
  }
  for (const fabric of Object.values(json.fabricByPageId || {})) {
    collectRemoteImageUrlsFromFabric(fabric).forEach((u) => urls.add(u));
  }
  return [...urls];
}
