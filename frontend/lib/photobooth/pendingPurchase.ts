import type { PhotoboothProjectJson } from '@/lib/photobooth/projectTypes';

const STORAGE_KEY = 'milko_photobooth_pending_purchase_v1';
const PDF_STORAGE_KEY = 'milko_photobooth_pending_pdf_v1';

export type PendingPhotoboothPurchase = {
  projectJson: PhotoboothProjectJson;
  vibeImages: string[];
  clientPendingId: string;
  savedAt: string;
};

// IndexedDB database helper for storing large PDF Blobs without sessionStorage quota limits
const DB_NAME = 'milko_photobooth_db';
const DB_VERSION = 1;
const STORE_NAME = 'pending_purchases';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

async function dbGet(key: string): Promise<any> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Get failed'));
  });
}

async function dbSet(key: string, value: any): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Put failed'));
  });
}

async function dbDel(key: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Delete failed'));
  });
}

export async function savePendingPurchase(payload: Omit<PendingPhotoboothPurchase, 'savedAt'> & { printPdf: Blob }): Promise<void> {
  if (typeof window === 'undefined') return;

  const meta: PendingPhotoboothPurchase = {
    projectJson: payload.projectJson,
    vibeImages: payload.vibeImages,
    clientPendingId: payload.clientPendingId,
    savedAt: new Date().toISOString(),
  };

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  await dbSet(PDF_STORAGE_KEY, payload.printPdf);
}

export function readPendingPurchase(): PendingPhotoboothPurchase | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPhotoboothPurchase;
    if (!parsed?.projectJson?.version || !parsed.clientPendingId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function readPendingPrintPdfBlob(): Promise<Blob | null> {
  if (typeof window === 'undefined') return null;
  try {
    const blob = await dbGet(PDF_STORAGE_KEY);
    if (blob instanceof Blob) return blob;
    return null;
  } catch {
    return null;
  }
}

export function clearPendingPurchase(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
  dbDel(PDF_STORAGE_KEY).catch((err) => {
    console.error('[photobooth] Failed to delete pending PDF from IndexedDB:', err);
  });
}
