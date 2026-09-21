/**
 * Global Cart Icon Ref Store
 * Allows access to cart icon elements from anywhere for animation
 */

const cartIconRefs: {
  mobile?: HTMLElement;
  desktop?: HTMLElement;
} = {};

function isVisibleElement(el: HTMLElement | undefined | null): el is HTMLElement {
  if (!el || typeof window === 'undefined') return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    // If not measured yet but connected to DOM, consider usable
    return document.body.contains(el);
  }
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
  getMobile: (): HTMLElement | undefined => {
    if (isVisibleElement(cartIconRefs.mobile)) return cartIconRefs.mobile;
    if (typeof document !== 'undefined') {
      const el = document.querySelector<HTMLElement>('[data-cart-target="mobile"], .mobileCartButton, [data-cart-icon="mobile"], a[aria-label="Cart"]');
      if (isVisibleElement(el)) return el;
    }
    return cartIconRefs.mobile;
  },
  getDesktop: (): HTMLElement | undefined => {
    if (isVisibleElement(cartIconRefs.desktop)) return cartIconRefs.desktop;
    if (typeof document !== 'undefined') {
      const el = document.querySelector<HTMLElement>('[data-cart-target="desktop"], button[aria-label="Cart"], [data-cart-icon="desktop"]');
      if (isVisibleElement(el)) return el;
    }
    return cartIconRefs.desktop;
  },
  getAny: (): HTMLElement | undefined => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const isMobile = window.innerWidth <= 767;

      if (isMobile) {
        if (isVisibleElement(cartIconRefs.mobile)) return cartIconRefs.mobile;
        const domMobile = document.querySelector<HTMLElement>('[data-cart-target="mobile"], .mobileCartButton, a[aria-label="Cart"]');
        if (isVisibleElement(domMobile)) {
          cartIconRefs.mobile = domMobile;
          return domMobile;
        }
      } else {
        if (isVisibleElement(cartIconRefs.desktop)) return cartIconRefs.desktop;
        const domDesktop = document.querySelector<HTMLElement>('[data-cart-target="desktop"], button[aria-label="Cart"], [data-cart-icon="desktop"]');
        if (isVisibleElement(domDesktop)) {
          cartIconRefs.desktop = domDesktop;
          return domDesktop;
        }
      }

      // Check stored refs as backup
      if (isVisibleElement(cartIconRefs.desktop)) return cartIconRefs.desktop;
      if (isVisibleElement(cartIconRefs.mobile)) return cartIconRefs.mobile;

      // Query any cart element in document
      const anyTarget = document.querySelector<HTMLElement>(
        '[data-cart-target], [data-cart-icon-wrapper], [data-cart-icon], [class*="cartIconWrapper"], [class*="cartButton"], [class*="mobileCartButton"], [aria-label="Cart"]'
      );
      if (anyTarget) {
        return anyTarget;
      }
    }

    return cartIconRefs.desktop || cartIconRefs.mobile;
  },
};
