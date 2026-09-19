/** Scene-space max dimension when inserting stickers from the library. */
export const STICKER_INSERT_MAX_SCENE_PX = 120;

/** Page size for infinite-scroll batches in the sticker grid. */
export const STICKER_GRID_PAGE_SIZE = 48;

const OPENMOJI_CLOUDINARY_FOLDER = 'openmoji/svg';

export function getCloudinaryCloudName(): string {
  return process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || 'djihr7crd';
}

export function getOpenMojiCloudinaryFolder(): string {
  const override = process.env.NEXT_PUBLIC_OPENMOJI_CLOUDINARY_FOLDER?.replace(/^\/|\/$/g, '');
  return override || OPENMOJI_CLOUDINARY_FOLDER;
}

export function getOpenMojiMetadataUrl(): string {
  return process.env.NEXT_PUBLIC_OPENMOJI_METADATA_URL?.trim() || '/openmoji/metadata.json';
}

/** Cloudinary delivery base for OpenMoji SVG assets (no trailing slash). */
export function getOpenMojiAssetBase(): string {
  const override = process.env.NEXT_PUBLIC_OPENMOJI_ASSET_BASE_URL?.replace(/\/$/, '');
  if (override) return override;
  const cloudName = getCloudinaryCloudName();
  const folder = getOpenMojiCloudinaryFolder();
  return `https://res.cloudinary.com/${cloudName}/image/upload/${folder}`;
}

/** @deprecated Use getOpenMojiAssetBase */
export function getOpenMojiCdnBase(): string {
  return getOpenMojiAssetBase();
}

export function buildOpenMojiSvgUrl(id: string): string {
  return `${getOpenMojiAssetBase()}/${id.toUpperCase()}.svg`;
}
