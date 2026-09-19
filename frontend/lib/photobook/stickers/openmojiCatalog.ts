import { buildOpenMojiSvgUrl, getOpenMojiMetadataUrl } from './config';
import type { StickerAsset, StickerAssetType } from './types';

type RawStickerAsset = {
  id: string;
  name: string;
  category: string;
  tags?: string[];
  url?: string;
  type?: StickerAssetType;
};

let cachedAssets: StickerAsset[] | null = null;
let loadPromise: Promise<StickerAsset[]> | null = null;

function normalizeAsset(raw: RawStickerAsset): StickerAsset {
  const id = raw.id.toUpperCase();
  return {
    id,
    name: raw.name,
    category: raw.category,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    url: buildOpenMojiSvgUrl(id),
    type: raw.type === 'png' ? 'png' : 'svg',
  };
}

async function fetchOpenMojiMetadata(): Promise<StickerAsset[]> {
  const response = await fetch(getOpenMojiMetadataUrl(), { cache: 'force-cache' });
  if (!response.ok) {
    throw new Error(`Failed to load OpenMoji metadata (${response.status})`);
  }
  const json = (await response.json()) as RawStickerAsset[];
  if (!Array.isArray(json)) {
    throw new Error('OpenMoji metadata must be a JSON array');
  }
  return json.map(normalizeAsset);
}

/** Load OpenMoji sticker metadata once and keep it in memory for the session. */
export function loadOpenMojiCatalog(): Promise<StickerAsset[]> {
  if (cachedAssets) return Promise.resolve(cachedAssets);
  if (!loadPromise) {
    loadPromise = fetchOpenMojiMetadata()
      .then((assets) => {
        cachedAssets = assets;
        return assets;
      })
      .catch((error) => {
        loadPromise = null;
        throw error;
      });
  }
  return loadPromise;
}

export function getCachedOpenMojiCatalog(): StickerAsset[] | null {
  return cachedAssets;
}
