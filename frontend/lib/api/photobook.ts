import { apiClient } from '@/lib/api/client';
import type { PhotobookProjectJson, PhotobookProjectRecord } from '@/lib/photobook/projectTypes';

export const photobookApi = {
  async listProjects(): Promise<PhotobookProjectRecord[]> {
    const rows = await apiClient.get<PhotobookProjectRecord[]>('/api/photobook/projects');
    return Array.isArray(rows) ? rows : [];
  },

  async getProject(projectId: string): Promise<PhotobookProjectRecord> {
    return apiClient.get<PhotobookProjectRecord>(`/api/photobook/projects/${projectId}`);
  },

  async saveProject(input: {
    projectId?: string;
    productId: string;
    variationId?: string;
    projectName: string;
    projectJson: PhotobookProjectJson;
    quantity: number;
    price?: number;
    pageCount: number;
    status?: 'draft' | 'cart';
    preview?: Blob;
  }): Promise<PhotobookProjectRecord> {
    const form = new FormData();
    if (input.projectId) form.append('projectId', input.projectId);
    form.append('productId', input.productId);
    if (input.variationId) form.append('variationId', input.variationId);
    form.append('projectName', input.projectName);
    form.append('projectJson', JSON.stringify(input.projectJson));
    form.append('quantity', String(input.quantity));
    form.append('pageCount', String(input.pageCount));
    if (input.price != null) form.append('price', String(input.price));
    if (input.status) form.append('status', input.status);
    if (input.preview) form.append('preview', input.preview, 'preview.jpg');

    const client = apiClient.getInstance();
    const url = input.projectId
      ? `/api/photobook/projects/${input.projectId}`
      : '/api/photobook/projects';
    const method = input.projectId ? 'put' : 'post';

    const response = await client.request<{ success: boolean; data: PhotobookProjectRecord }>({
      url,
      method,
      data: form,
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
    });
    return response.data.data;
  },

  async uploadImage(projectId: string, imageId: string, file: Blob, filename: string): Promise<{ url: string }> {
    const form = new FormData();
    form.append('imageId', imageId);
    form.append('image', file, filename);

    const client = apiClient.getInstance();
    const response = await client.post<{ success: boolean; data: { url: string } }>(
      `/api/photobook/projects/${projectId}/images`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 },
    );
    return response.data.data;
  },

  async addToCart(projectId: string): Promise<PhotobookProjectRecord> {
    return apiClient.post<PhotobookProjectRecord>(`/api/photobook/projects/${projectId}/add-to-cart`);
  },

  async finalizeWithPdf(projectId: string, printPdf: Blob): Promise<PhotobookProjectRecord> {
    const form = new FormData();
    form.append('printPdf', printPdf, 'print.pdf');

    const client = apiClient.getInstance();
    const response = await client.post<{ success: boolean; data: PhotobookProjectRecord }>(
      `/api/photobook/projects/${projectId}/finalize`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 },
    );
    return response.data.data;
  },

  async deleteProject(projectId: string): Promise<void> {
    await apiClient.delete(`/api/photobook/projects/${projectId}`);
  },

  async submitEditorFeedback(input: {
    productId?: number | string;
    projectId?: string;
    issueType: string;
    rating: number;
    message?: string;
  }): Promise<{ id: string }> {
    return apiClient.post<{ id: string }>('/api/photobook/feedback', input);
  },
};
