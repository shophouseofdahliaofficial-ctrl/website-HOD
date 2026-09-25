/**
 * Global utility to trigger the ambient top red glow effect.
 */
export function triggerTopRedGlow() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('trigger-top-red-glow'));
  }
}
