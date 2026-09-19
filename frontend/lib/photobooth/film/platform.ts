/** True on iPhone / iPad / iPod Safari (and iPadOS desktop UA). */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Canvas 2D context tuned per platform — iOS can fail with desynchronized. */
export function createPreviewCanvasContext(
  canvas: HTMLCanvasElement,
  readback = false,
): CanvasRenderingContext2D | null {
  const base: CanvasRenderingContext2DSettings = readback
    ? { alpha: false, willReadFrequently: true }
    : { alpha: false };

  if (!isIOS()) {
    const ctx = canvas.getContext('2d', { ...base, desynchronized: true });
    if (ctx) return ctx;
  }

  return canvas.getContext('2d', base);
}

/** iOS Safari will not decode camera frames when the video is display:none. */
export function primeVideoForCanvasCapture(video: HTMLVideoElement): void {
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.muted = true;
  video.playsInline = true;
  if (video.paused) {
    video.play().catch(() => {});
  }
}

export function isVideoFrameReady(video: HTMLVideoElement): boolean {
  return video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0;
}

/** DOM image sources share top-left origin; WebGL textures use bottom-left — always flip Y. */
export function uploadWebGLTextureSource(
  gl: WebGLRenderingContext,
  texture: WebGLTexture,
  source: TexImageSource,
): void {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
}
