import { apiClient } from '@/lib/api/client';
import type { PhotoboothProjectJson, PhotoboothProjectRecord, PhotoboothVibeId } from '@/lib/photobooth/projectTypes';

export type PhotoboothConfig = {
  productId: number | null;
  polaroidProductId?: number | null;
  stripProductId?: number | null;
  pricePerPolaroid: number;
  deliveryFee: number;
};

export function getPhotoboothProductIdForVibe(
  config: PhotoboothConfig,
  vibeId: 'polaroid' | 'strip',
): number | null {
  if (vibeId === 'strip') {
    return config.stripProductId ?? config.productId;
  }
  return config.polaroidProductId ?? config.productId;
}

/** Metadata only — no image blobs (PDF is the sole uploaded asset). */
export function sanitizeProjectJsonForUpload(
  projectJson: PhotoboothProjectJson,
  printScale?: number,
): Omit<PhotoboothProjectJson, 'capturedPhotos'> & {
  capturedPhotos: Array<{ filterId: string; frameId?: number }>;
} {
  return {
    ...projectJson,
    capturedPhotos: projectJson.capturedPhotos.map((photo) => ({
      filterId: photo.filterId,
      frameId: photo.frameId,
    })),
    printScale,
  };
}

export const photoboothApi = {
  async getConfig(): Promise<PhotoboothConfig> {
    return apiClient.get<PhotoboothConfig>('/api/photobooth/config');
  },

  async createProject(input: {
    projectId?: string;
    projectType: PhotoboothVibeId;
    projectJson: PhotoboothProjectJson;
    quantity: number;
    printPdf: Blob;
    printScale?: number;
  }): Promise<PhotoboothProjectRecord> {
    const form = new FormData();
    if (input.projectId) form.append('projectId', input.projectId);
    form.append('projectType', input.projectType);
    form.append(
      'projectJson',
      JSON.stringify(sanitizeProjectJsonForUpload(input.projectJson, input.printScale)),
    );
    form.append('quantity', String(input.quantity));
    form.append('printPdf', input.printPdf, 'print.pdf');

    const client = apiClient.getInstance();
    const response = await client.post<{ success: boolean; data: PhotoboothProjectRecord }>(
      '/api/photobooth/projects',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 },
    );
    return response.data.data;
  },

  async deleteProject(projectId: string): Promise<void> {
    await apiClient.delete(`/api/photobooth/projects/${projectId}`);
  },
};
