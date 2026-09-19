import { zipSync } from 'fflate';

/** Copy bytes into a standalone ArrayBuffer for Blob construction. */
function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

/** Decode a data URL (base64) into raw bytes for ZIP packaging. */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export type ZipEntry = {
  filename: string;
  dataUrl: string;
};

/** Build a ZIP blob from data-URL image entries. */
export function buildZipBlob(entries: ZipEntry[]): Blob {
  const files: Record<string, Uint8Array> = {};
  for (const entry of entries) {
    files[entry.filename] = dataUrlToBytes(entry.dataUrl);
  }
  const zipped = zipSync(files, { level: 6 });
  return new Blob([bytesToArrayBuffer(zipped)], { type: 'application/zip' });
}

/** Trigger a single file download in the browser. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Build a PNG blob from a data URL. */
export function buildPngBlob(dataUrl: string): Blob {
  return new Blob([bytesToArrayBuffer(dataUrlToBytes(dataUrl))], { type: 'image/png' });
}

export function keepsakeZipFilename(count: number): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return count === 1
    ? `Scribble-keepsake-${stamp}.png`
    : `Scribble-keepsakes-${count}-${stamp}.zip`;
}

export function keepsakeEntryFilename(index: number, vibeId: string): string {
  const kind = vibeId === 'strip' ? 'film-strip' : 'polaroid';
  return `Scribble-${kind}-${String(index + 1).padStart(2, '0')}.png`;
}
