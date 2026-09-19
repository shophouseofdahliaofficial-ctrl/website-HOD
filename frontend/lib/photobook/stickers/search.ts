import type { StickerAsset } from './types';

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** Local O(n) filter over cached sticker metadata (name, tags, category). */
export function filterStickerAssets(assets: StickerAsset[], query: string): StickerAsset[] {
  const q = normalizeQuery(query);
  if (!q) return assets;
  return assets.filter((asset) => {
    if (asset.name.toLowerCase().includes(q)) return true;
    if (asset.category.toLowerCase().includes(q)) return true;
    return asset.tags.some((tag) => tag.toLowerCase().includes(q));
  });
}
