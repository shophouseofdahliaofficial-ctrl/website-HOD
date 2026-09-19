import { subscribeInstCPreview, updateInstCPreviewSource } from './instCPreviewEngine';

/** @deprecated Use subscribeInstCPreview via InstCLivePreview component */
export type InstCPreviewState = {
  lastW: number;
  lastH: number;
};

export function createInstCPreviewState(): InstCPreviewState {
  return { lastW: 0, lastH: 0 };
}

/** Legacy export — engine handles rendering internally now */
export function renderInstCPreviewFrame(): void {
  // no-op: shared engine paints subscribed canvases
}

export const INST_C_FILTER_ID = 'retro';

export function isInstCFilter(filterId: string): boolean {
  return filterId === INST_C_FILTER_ID;
}

export { subscribeInstCPreview, updateInstCPreviewSource };
