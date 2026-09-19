import { apiClient } from './client';

export interface Category {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
}

/**
 * Get all categories
 */
export const getAllCategories = async (): Promise<Category[]> => {
  return apiClient.get<Category[]>('/api/categories');
};

/**
 * Create a new category
 */
export const createCategory = async (input: CreateCategoryInput): Promise<Category> => {
  return apiClient.post<Category>('/api/admin/categories', input);
};

/**
 * Update a category
 */
export const updateCategory = async (id: string, input: UpdateCategoryInput): Promise<Category> => {
  return apiClient.put<Category>(`/api/admin/categories/${id}`, input);
};

/**
 * Delete a category
 */
export const deleteCategory = async (id: string): Promise<void> => {
  return apiClient.delete<void>(`/api/admin/categories/${id}`);
};
