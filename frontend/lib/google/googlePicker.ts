import { connectorsApi } from '@/lib/api/connectors';
import { tokenStorage } from '@/lib/utils/storage';
import { resolveApiBaseUrl } from '@/lib/utils/apiBaseUrl';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
export const PHOTOS_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
const GAPI_SCRIPT = 'https://apis.google.com/js/api.js';
const GSI_SCRIPT = 'https://accounts.google.com/gsi/client';

const PICKER_VIEW_DOCS_IMAGES = 'docs-images';
const PICKER_VIEW_PHOTOS = 'photos';

export type GooglePickedImage = {
  id: string;
  name: string;
  mimeType: string;
  url?: string;
};

export type GoogleImagePickResult = {
  dataUrls: string[];
  rejectedNames: string[];
};

type GoogleGlobal = typeof google;

let gapiLoadPromise: Promise<GoogleGlobal> | null = null;
let gsiLoadPromise: Promise<GoogleGlobal> | null = null;

function getClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
}

function getApiKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';
}

export function isGooglePickerConfigured(): boolean {
  return Boolean(getClientId() && getApiKey());
}

function getGoogleFromWindow(): GoogleGlobal | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { google?: GoogleGlobal }).google ?? null;
}

async function waitForGoogle(
  isReady: (googleApi: GoogleGlobal) => boolean,
  errorMessage: string,
): Promise<GoogleGlobal> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const googleApi = getGoogleFromWindow();
    if (googleApi && isReady(googleApi)) {
      return googleApi;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(errorMessage);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function waitForGapi(): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (window.gapi?.load) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error('Google API client failed to load.');
}

async function loadGapiPicker(): Promise<GoogleGlobal> {
  if (gapiLoadPromise) return gapiLoadPromise;

  gapiLoadPromise = (async () => {
    await loadScript(GAPI_SCRIPT);
    await waitForGapi();

    await new Promise<void>((resolve, reject) => {
      window.gapi!.load('picker', {
        callback: resolve,
        onerror: reject,
      });
    });

    return waitForGoogle(
      (g) => Boolean(g?.picker?.PickerBuilder),
      'Google Picker failed to initialize.',
    );
  })();

  return gapiLoadPromise;
}

async function loadGsiClient(): Promise<GoogleGlobal> {
  if (gsiLoadPromise) return gsiLoadPromise;

  gsiLoadPromise = (async () => {
    await loadScript(GSI_SCRIPT);
    return waitForGoogle(
      (g) => Boolean((g as any)?.accounts?.oauth2?.initCodeClient),
      'Google sign-in client failed to load.',
    );
  })();

  return gsiLoadPromise;
}

// ─── Server-side auth code flow ───────────────────────────────────────────────

/**
 * Request an authorization code from Google using the popup-based code flow.
 * This code is then sent to the backend to exchange for a refresh token.
 */
export async function requestGoogleAuthCode(scope: string): Promise<string> {
  const googleApi = await loadGsiClient();

  const clientId = getClientId();
  if (!clientId) {
    throw new Error('Google upload is not configured.');
  }

  return new Promise((resolve, reject) => {
    const codeClient = (googleApi as any).accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope,
      ux_mode: 'popup',
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        if (!response.code) {
          reject(new Error('No authorization code received.'));
          return;
        }
        resolve(response.code);
      },
      error_callback: (error: any) => {
        reject(new Error(error?.type || 'popup_closed'));
      },
    });

    codeClient.requestCode();
  });
}

/**
 * Get a fresh access token from the backend (which uses the stored refresh token).
 * Falls back to the legacy client-side token flow if the backend returns 404 (not connected).
 */
export async function getAccessTokenFromBackend(source: 'drive' | 'photos'): Promise<string> {
  const result = await connectorsApi.getAccessToken(source);
  return result.access_token;
}

// ─── Legacy client-side token flow (used as fallback) ─────────────────────────

/**
 * Request an access token directly from Google (client-side implicit flow).
 * Used as fallback when the user hasn't connected via the server-side flow.
 */
export async function requestGoogleAccessToken(scope: string, promptMode: 'select' | 'none' = 'select'): Promise<string> {
  // Check localStorage cache first
  if (typeof window !== 'undefined' && promptMode === 'none') {
    try {
      const cachedStr = localStorage.getItem(`milko_gtoken_${scope}`);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr) as { token: string; expiresAt: number };
        // Check if still valid (5-minute buffer)
        if (cached.expiresAt > Date.now() + 5 * 60 * 1000) {
          return cached.token;
        }
      }
    } catch (e) {
      console.error('Failed to read cached token:', e);
    }
  }

  const googleApi = await loadGsiClient();

  const clientId = getClientId();
  if (!clientId) {
    throw new Error('Google upload is not configured.');
  }

  return new Promise((resolve, reject) => {
    const tokenClient = (googleApi as any).accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      callback: async (response: any) => {
        if (response.error) {
          // If silent refresh failed because interaction or consent is required, fallback to prompt
          if (promptMode === 'none' && (response.error === 'interaction_required' || response.error === 'consent_required')) {
            try {
              const freshToken = await requestGoogleAccessToken(scope, 'select');
              resolve(freshToken);
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(response.error_description || response.error));
          }
          return;
        }
        if (!response.access_token) {
          reject(new Error('No Google access token received.'));
          return;
        }

        // Cache the token in localStorage
        if (typeof window !== 'undefined') {
          try {
            const expiresAt = Date.now() + 3600 * 1000; // 1 hour
            localStorage.setItem(
              `milko_gtoken_${scope}`,
              JSON.stringify({ token: response.access_token, expiresAt })
            );
          } catch (e) {
            console.error('Failed to write cached token:', e);
          }
        }

        resolve(response.access_token);
      },
      error_callback: (error: any) => {
        reject(new Error(error?.type || 'popup_closed'));
      },
    });

    tokenClient.requestAccessToken({ prompt: promptMode === 'none' ? 'none' : '' });
  });
}

// ─── Picker and download helpers ──────────────────────────────────────────────

async function openPickerWithToken(
  viewId: string,
  accessToken: string,
): Promise<GooglePickedImage[]> {
  const googleApi = await loadGapiPicker();

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Google upload is not configured.');
  }

  return new Promise((resolve, reject) => {
    try {
      const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
      
      const pickerApi = googleApi.picker as any;
      let view: any = viewId;
      if (viewId === 'docs-images') {
        // Use DOCS_IMAGES view to guarantee only image files are shown.
        // Do NOT set DocsViewMode.GRID (default layout) and do NOT include
        // folders so the picker shows only images.
        const docsView = new pickerApi.DocsView(pickerApi.ViewId.DOCS_IMAGES);
        docsView.setIncludeFolders(false);
        view = docsView;
      }

      const builder = new googleApi.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .enableFeature(googleApi.picker.Feature.MULTISELECT_ENABLED);

      if (originUrl) {
        (builder as any).setOrigin(originUrl);
      }

      const picker = builder
        .setCallback((data: any) => {
          const documents: any[] = data.docs || data.documents || data[pickerApi.Response.DOCUMENTS] || [];
          if (data.action === googleApi.picker.Action.PICKED && documents.length) {
            resolve(
              documents.map((doc) => ({
                id: doc.id,
                name: doc.name,
                mimeType: doc.mimeType,
                url: doc.url,
              })),
            );
            return;
          }

          if (data.action === googleApi.picker.Action.CANCEL) {
            resolve([]);
          }
        })
        .build();

      picker.setVisible(true);
    } catch (error) {
      reject(error);
    }
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read image'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'));
    reader.readAsDataURL(blob);
  });
}

async function downloadDriveImage(fileId: string, accessToken: string): Promise<Blob> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to download image from Google Drive.');
  }

  return response.blob();
}

async function downloadPhotosImage(doc: GooglePickedImage, accessToken: string): Promise<Blob> {
  console.log('[GooglePhotos] Attempting to download photo:', doc);
  if (!doc.url) {
    throw new Error('No image URL available for download.');
  }

  const baseUrl = resolveApiBaseUrl();
  const proxyUrl = `${baseUrl}/api/connectors/google/photos/proxy?url=${encodeURIComponent(doc.url)}`;
  console.log('[GooglePhotos] Fetching from proxy URL:', proxyUrl);

  const token = tokenStorage.get();
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(proxyUrl, { headers });
  if (!response.ok) {
    console.error('[GooglePhotos] Proxy download failed with status:', response.status, response.statusText);
    throw new Error('Failed to download image from Google Photos proxy.');
  }

  const blob = await response.blob();
  console.log('[GooglePhotos] Successfully downloaded blob, size:', blob.size);
  return blob;
}

async function downloadPickedImages(
  docs: GooglePickedImage[],
  accessToken: string,
  source: 'drive' | 'photos',
  maxSizeBytes: number,
): Promise<GoogleImagePickResult> {
  console.log('[GooglePhotos] downloadPickedImages starting with docs:', docs, 'source:', source);
  const dataUrls: string[] = [];
  const rejectedNames: string[] = [];

  for (const doc of docs) {
    console.log('[GooglePhotos] Processing doc:', doc);
    if (!doc.mimeType.startsWith('image/')) {
      console.warn('[GooglePhotos] Skipping non-image file type:', doc.mimeType);
      continue;
    }

    try {
      const blob =
        source === 'drive'
          ? await downloadDriveImage(doc.id, accessToken)
          : await downloadPhotosImage(doc, accessToken);

      if (blob.size > maxSizeBytes) {
        console.warn('[GooglePhotos] File too large:', doc.name, 'size:', blob.size, 'max:', maxSizeBytes);
        rejectedNames.push(doc.name);
        continue;
      }

      const dataUrl = await blobToDataUrl(blob);
      console.log('[GooglePhotos] Successfully read dataUrl for:', doc.name, 'length:', dataUrl.length);
      dataUrls.push(dataUrl);
    } catch (err) {
      console.error('[GooglePhotos] Failed to download or convert:', doc.name, err);
      rejectedNames.push(doc.name);
    }
  }

  console.log('[GooglePhotos] downloadPickedImages finished. dataUrls count:', dataUrls.length, 'rejected count:', rejectedNames.length);
  return { dataUrls, rejectedNames };
}

// ─── Main pick functions (used by upload modal) ───────────────────────────────

async function pickGoogleImages(
  viewId: string,
  scope: string,
  source: 'drive' | 'photos',
  maxSizeBytes: number,
  tokenSource: 'backend' | 'client' = 'backend',
): Promise<GoogleImagePickResult> {
  if (!isGooglePickerConfigured()) {
    throw new Error('Google upload is not configured.');
  }

  let accessToken: string;

  if (tokenSource === 'backend') {
    // Server-side flow: get a fresh token from the backend (which uses stored refresh token)
    accessToken = await getAccessTokenFromBackend(source);
  } else {
    // Legacy client-side flow (fallback)
    accessToken = await requestGoogleAccessToken(scope, 'none');
  }

  const docs = await openPickerWithToken(viewId, accessToken);

  if (docs.length === 0) {
    return { dataUrls: [], rejectedNames: [] };
  }

  return downloadPickedImages(docs, accessToken, source, maxSizeBytes);
}

export function pickGoogleDriveImages(
  maxSizeBytes: number,
  tokenSource: 'backend' | 'client' = 'backend',
): Promise<GoogleImagePickResult> {
  return pickGoogleImages(PICKER_VIEW_DOCS_IMAGES, DRIVE_SCOPE, 'drive', maxSizeBytes, tokenSource);
}

export async function pickGooglePhotosImages(
  maxSizeBytes: number,
  tokenSource: 'backend' | 'client' = 'backend',
): Promise<GoogleImagePickResult> {
  if (!isGooglePickerConfigured()) {
    throw new Error('Google upload is not configured.');
  }

  let accessToken: string;
  if (tokenSource === 'backend') {
    accessToken = await getAccessTokenFromBackend('photos');
  } else {
    accessToken = await requestGoogleAccessToken(PHOTOS_SCOPE, 'none');
  }

  // Create Picking Session on backend
  const { sessionId, pickerUri } = await connectorsApi.createPhotosSession();

  // Open Google Photos Picker UI in a popup
  const popupWidth = 600;
  const popupHeight = 750;
  const left = typeof window !== 'undefined' ? window.screen.width / 2 - popupWidth / 2 : 0;
  const top = typeof window !== 'undefined' ? window.screen.height / 2 - popupHeight / 2 : 0;
  const popup = typeof window !== 'undefined' ? window.open(
    `${pickerUri}/autoclose`,
    'GooglePhotosPicker',
    `width=${popupWidth},height=${popupHeight},top=${top},left=${left},scrollbars=yes`
  ) : null;

  // Poll backend for completion status
  let completed = false;
  let mediaItems: any[] = [];
  const maxPolls = 60; // 3 minutes timeout (3s * 60)
  let pollCount = 0;

  while (pollCount < maxPolls) {
    console.log(`[GooglePhotos] Active polling attempt ${pollCount + 1}...`);

    if (!popup || popup.closed) {
      console.log('[GooglePhotos] Popup detected as closed. Polling for final status with retry logic...');
      // Poll up to 4 times with 750ms gaps (≤3s total) to catch server-side
      // selections that arrive slightly after the popup closes.
      // The spinner stays visible throughout this wait so the user always sees
      // feedback whether they selected or dismissed.
      for (let attempt = 1; attempt <= 4; attempt++) {
        const finalStatus = await connectorsApi.pollPhotosSession(sessionId);
        console.log(`[GooglePhotos] Final check attempt ${attempt}:`, finalStatus);
        if (finalStatus.mediaItemsSet) {
          completed = true;
          mediaItems = finalStatus.mediaItems || [];
          break;
        }
        if (attempt < 4) {
          await new Promise((resolve) => setTimeout(resolve, 750));
        }
      }
      break;
    }

    const status = await connectorsApi.pollPhotosSession(sessionId);
    console.log(`[GooglePhotos] Active poll status response:`, status);

    if (status.mediaItemsSet) {
      completed = true;
      mediaItems = status.mediaItems || [];
      try {
        popup.close();
      } catch {}
      break;
    }

    pollCount++;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  if (!completed || mediaItems.length === 0) {
    console.log('[GooglePhotos] No media items set or not completed', { completed, mediaItems });
    return { dataUrls: [], rejectedNames: [] };
  }

  console.log('[GooglePhotos] Polling completed. Raw mediaItems:', mediaItems);

  const docs: GooglePickedImage[] = mediaItems.map((item: any) => {
    const baseUrl = item.mediaFile?.baseUrl;
    const downloadUrl = baseUrl ? `${baseUrl}=w4096-h4096` : undefined;
    return {
      id: item.id,
      name: item.mediaFile?.filename || 'photo.jpg',
      mimeType: item.mediaFile?.mimeType || 'image/jpeg',
      url: downloadUrl,
    };
  });

  console.log('[GooglePhotos] Mapped docs:', docs);

  return downloadPickedImages(docs, accessToken, 'photos', maxSizeBytes);
}
