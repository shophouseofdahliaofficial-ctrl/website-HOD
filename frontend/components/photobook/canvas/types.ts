import type { Canvas, FabricObject, SerializedObjectProps } from 'fabric';
import { PB_PAGE_SIZE_PX, PB_VIEW_PAD_PX } from './constants';

export type FabricModule = typeof import('fabric');
export type { Canvas, FabricObject };

export type PbCanvasSerialized = Record<string, unknown>;

export type FabricJsonObject = SerializedObjectProps & {
  pbKind?: string;
  pbTextPreset?: string;
};

export type PbCanvasObject = FabricObject & {
  pbKind?: string;
  pbTextPreset?: string;
  name?: string;
};

export type PageContentRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function getPageContentRect(): PageContentRect {
  return {
    left: PB_VIEW_PAD_PX,
    top: PB_VIEW_PAD_PX,
    width: PB_PAGE_SIZE_PX,
    height: PB_PAGE_SIZE_PX,
  };
}
