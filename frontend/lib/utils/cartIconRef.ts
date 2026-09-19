/**
 * Global Cart Icon Ref Store
 * Allows access to cart icon elements from anywhere for animation
 */

const cartIconRefs: {
  mobile?: HTMLElement;
  desktop?: HTMLElement;
} = {};

function isVisibleElement(el: HTMLElement | undefined): el is HTMLElement {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return true;
}

export const cartIconRefStore = {
  setMobile: (element: HTMLElement | null) => {
    if (element) {
      cartIconRefs.mobile = element;
    } else {
      delete cartIconRefs.mobile;
    }
  },
  setDesktop: (element: HTMLElement | null) => {
    if (element) {
      cartIconRefs.desktop = element;
    } else {
      delete cartIconRefs.desktop;
    }
  },
  getMobile: (): HTMLElement | undefined => cartIconRefs.mobile,
  getDesktop: (): HTMLElement | undefined => cartIconRefs.desktop,
  getAny: (): HTMLElement | undefined => {
    if (typeof window !== 'undefined') {
      const desktop = cartIconRefs.desktop;
      const mobile = cartIconRefs.mobile;

      if (isVisibleElement(desktop)) return desktop;
      if (isVisibleElement(mobile)) return mobile;
    }

    return cartIconRefs.desktop || cartIconRefs.mobile;
  },
};
