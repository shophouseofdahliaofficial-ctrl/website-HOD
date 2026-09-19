export type StickerAssetType = 'svg' | 'png';

export interface StickerAsset {
  id: string;
  name: string;
  category: string;
  tags: string[];
  url: string;
  type: StickerAssetType;
}

export type StickerPackId = 'openmoji' | string;
