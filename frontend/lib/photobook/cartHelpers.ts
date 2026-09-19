import type { CartItem } from '@/lib/utils/cart';
import type { PhotobookCartProject } from '@/lib/photobook/projectTypes';

export function getPhotobookCartProject(it: CartItem): PhotobookCartProject | null {
  return it.customizations?.photobookProject ?? null;
}

export function isPhotobookCartItem(it: CartItem): boolean {
  return !!getPhotobookCartProject(it);
}
