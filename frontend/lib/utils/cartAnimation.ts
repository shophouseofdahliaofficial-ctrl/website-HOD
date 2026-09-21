/**
 * Cart Animation Utility
 * Creates a flying product image animation from source element to cart icon
 */

import { cartIconRefStore } from './cartIconRef';

export interface CartAnimationOptions {
  imageUrl: string;
  sourceElement: HTMLElement;
  targetElement?: HTMLElement | null;
  onComplete?: () => void;
}

export function animateToCart(
  optionsOrSource: CartAnimationOptions | HTMLElement | null | undefined,
  maybeTarget?: HTMLElement | null,
  maybeImageUrl?: string,
  maybeOnComplete?: () => void,
): void {
  let imageUrl = '';
  let sourceElement: HTMLElement | null | undefined = null;
  let targetElement: HTMLElement | null | undefined = null;
  let onComplete: (() => void) | undefined = undefined;

  if (optionsOrSource && 'sourceElement' in optionsOrSource) {
    imageUrl = optionsOrSource.imageUrl || '';
    sourceElement = optionsOrSource.sourceElement;
    targetElement = optionsOrSource.targetElement;
    onComplete = optionsOrSource.onComplete;
  } else if (optionsOrSource instanceof HTMLElement || (optionsOrSource && typeof (optionsOrSource as any).getBoundingClientRect === 'function')) {
    sourceElement = optionsOrSource as HTMLElement;
    targetElement = maybeTarget;
    imageUrl = maybeImageUrl || '';
    onComplete = maybeOnComplete;
  }

  // Fallback target resolution if not supplied or not in DOM
  if (!targetElement || (typeof document !== 'undefined' && !document.body.contains(targetElement))) {
    targetElement = cartIconRefStore.getAny() || null;
  }

  if (!sourceElement || !targetElement) {
    if (onComplete) onComplete();
    return;
  }

  // Get positions
  const sourceRect = sourceElement.getBoundingClientRect();
  const targetRect = targetElement.getBoundingClientRect();

  // Create flying image element
  const flyingImage = document.createElement('div');
  flyingImage.style.position = 'fixed';
  flyingImage.style.width = '50px';
  flyingImage.style.height = '50px';
  flyingImage.style.borderRadius = '8px';
  flyingImage.style.overflow = 'hidden';
  flyingImage.style.zIndex = '10000';
  flyingImage.style.pointerEvents = 'none';
  flyingImage.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
  flyingImage.style.opacity = '1';
  flyingImage.style.transition = 'none';

  // Set initial position (center of source element)
  const startX = sourceRect.left + sourceRect.width / 2 - 25;
  const startY = sourceRect.top + sourceRect.height / 2 - 25;
  flyingImage.style.left = `${startX}px`;
  flyingImage.style.top = `${startY}px`;

  // Create image inside
  const img = document.createElement('img');
  img.src = imageUrl;
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'cover';
  img.onerror = () => {
    // Fallback if image fails to load
    flyingImage.style.background = '#ffffff';
    flyingImage.style.display = 'flex';
    flyingImage.style.alignItems = 'center';
    flyingImage.style.justifyContent = 'center';
    flyingImage.innerHTML = '<img src="/house-of-dahlia-logo.png" alt="House Of Dahlia" style="max-width:70%;max-height:70%;object-fit:contain;" />';
  };
  flyingImage.appendChild(img);

  document.body.appendChild(flyingImage);

  // Force reflow
  flyingImage.offsetHeight;

  // Calculate target position (center of cart icon)
  const targetX = targetRect.left + targetRect.width / 2 - 25;
  const targetY = targetRect.top + targetRect.height / 2 - 25;

  // Animate using requestAnimationFrame for smooth animation
  const duration = 600; // milliseconds
  const startTime = performance.now();

  function animate(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function (ease-in-out-cubic)
    const ease = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    // Calculate current position
    const currentX = startX + (targetX - startX) * ease;
    const currentY = startY + (targetY - startY) * ease;

    // Scale down as it approaches target
    const scale = 1 - (progress * 0.5);
    const opacity = 1 - progress * 0.3;

    flyingImage.style.left = `${currentX}px`;
    flyingImage.style.top = `${currentY}px`;
    flyingImage.style.transform = `scale(${scale})`;
    flyingImage.style.opacity = `${opacity}`;

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Animation complete
      document.body.removeChild(flyingImage);
      if (onComplete) {
        onComplete();
      }
    }
  }

  requestAnimationFrame(animate);
}
