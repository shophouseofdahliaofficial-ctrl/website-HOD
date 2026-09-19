import type { PbFabricSerialized } from '@/components/photobook/canvas';
import type { PbFabricTextStyle } from '@/components/photobook/canvas';
import type { PbLayoutId } from '@/components/photobook/canvas/layouts';

export type PbPageMeta = {
  id: string;
  label: string;
  bg?: string;
  layout?: string;
  caption?: string;
  slotImages?: Array<string | undefined>;
  fontFamily?: string;
  pageTextStyle?: Partial<PbFabricTextStyle>;
  locked?: boolean;
  layoutFrameGapEnabled?: boolean;
};

export type PhotobookUploadedImageMeta = {
  id: string;
  bunnyUrl: string;
  name: string;
};

export type PhotobookProjectJson = {
  version: 1;
  projectName: string;
  productId: string;
  variationId?: string;
  selectedCustomizations: Record<string, string>;
  textPersonalizations: Record<string, string>;
  pageSizeCm: { width: number; height: number };
  pageSizePx: { widthPx: number; heightPx: number };
  quantity: number;
  pages: PbPageMeta[];
  fabricByPageId: Record<string, PbFabricSerialized>;
  uploadedImages: PhotobookUploadedImageMeta[];
};

export type PhotobookProjectStatus = 'draft' | 'cart' | 'purchased';

export type PhotobookProjectRecord = {
  id: string;
  userId: string;
  productId: number;
  variationId?: number | null;
  projectName: string;
  projectJson: PhotobookProjectJson;
  previewUrl?: string | null;
  generatedPdfUrl?: string | null;
  quantity: number;
  price?: number | null;
  status: PhotobookProjectStatus;
  isLocked: boolean;
  pageCount: number;
  lastEditedAt: string;
  expiresAt?: string | null;
  createdAt: string;
  productName?: string | null;
};

export type PhotobookCartProject = {
  projectId: string;
  previewUrl: string;
  projectName: string;
  pageCount: number;
  productId: string;
  variationId?: string;
};
