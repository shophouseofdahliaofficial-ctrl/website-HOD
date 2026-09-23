/**
 * Spawns a radial burst of small solid red particle dots around the target element
 * that move outwards, fall down under gravity, and disappear.
 */
export function triggerSparkleBurst(target: HTMLElement | EventTarget | null) {
  if (typeof window === 'undefined') return;

  const element = target as HTMLElement;
  if (!element || typeof element.getBoundingClientRect !== 'function') return;

  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const particleCount = 14;
  const colors = [
    '#AF5D6A',
    '#AF5D6A',
    '#b86875',
    '#a45360',
    '#c27582',
  ];

  for (let i = 0; i < particleCount; i++) {
    const dot = document.createElement('span');
    dot.className = 'favorite-sparkle-dot';

    // Calculate radial angle and velocity
    const angle = (i / particleCount) * Math.PI * 2 + (Math.random() * 0.35 - 0.17);
    const distance = 16 + Math.random() * 22; // 16px to 38px burst radius
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const fallDistance = 28 + Math.random() * 20; // 28px to 48px gravity drop
    const size = (2.5 + Math.random() * 2).toFixed(1); // 2.5px to 4.5px small dots
    const color = colors[Math.floor(Math.random() * colors.length)];
    const duration = 0.7 + Math.random() * 0.25; // 0.7s to 0.95s

    dot.style.cssText = `
      position: fixed;
      left: ${centerX}px;
      top: ${centerY}px;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${color};
      pointer-events: none;
      z-index: 999999;
      --dx: ${dx.toFixed(1)}px;
      --dy: ${dy.toFixed(1)}px;
      --fall: ${fallDistance.toFixed(1)}px;
      animation: favoriteSparkleFall ${duration.toFixed(2)}s cubic-bezier(0.2, 0.8, 0.4, 1) forwards;
    `;

    document.body.appendChild(dot);

    setTimeout(() => {
      dot.remove();
    }, duration * 1000 + 50);
  }
}
