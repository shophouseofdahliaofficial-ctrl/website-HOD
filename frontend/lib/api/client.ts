import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { resolveApiBaseUrl } from '@/lib/utils/apiBaseUrl';
import { tokenStorage, clearAuth } from '@/lib/utils/storage';
import { ApiResponse } from '@/types';

/**
 * Axios instance with base configuration
 * Handles authentication token injection and error handling
 */
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: resolveApiBaseUrl(),
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor: Add auth token; re-resolve API base (avoids wrong baked env on milko.in)
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        config.baseURL = resolveApiBaseUrl();
        const token = tokenStorage.get();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor: Handle errors globally
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiResponse<unknown>>) => {
        // Handle network errors (no response from server)
        if (!error.response) {
          console.error('[API Client] Network error:', error.message);
          if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
            return Promise.reject({
              message: 'Unable to connect to server. Please check if the backend is running.',
              status: 0,
              data: null,
            });
          }
          if (error.message.includes('timeout')) {
            return Promise.reject({
              message: 'Request timed out. Please try again.',
              status: 0,
              data: null,
            });
          }
          return Promise.reject({
            message: error.message || 'Network error. Please check your connection.',
            status: 0,
            data: null,
          });
        }

        // Handle 401 Unauthorized - clear auth and redirect to login
        // BUT don't redirect if we're on public routes (homepage, login, signup)
        if (error.response?.status === 401) {
          clearAuth();
          if (typeof window !== 'undefined') {
            const currentPath = window.location.pathname;
            // Public routes where we don't want to redirect to login
            const publicRoutes = ['/', '/auth/login', '/auth/signup'];
            const isPublicRoute = publicRoutes.includes(currentPath) || currentPath.startsWith('/auth/');
            
            // Only redirect if not on a public route
            if (!isPublicRoute) {
              const r =
                currentPath +
                (typeof window !== 'undefined' ? window.location.search : '');
              window.location.replace(
                `/auth/login?redirect=${encodeURIComponent(r)}`
              );
            }
          }
        }

        // Extract error message from different response formats
        let errorMessage = 'An error occurred';
        if (error.response?.data && typeof error.response.data === 'object' && error.response.data !== null) {
          // Backend returns { success: false, error: "message" } for errors
          if ('error' in error.response.data) {
            errorMessage = (error.response.data as any).error;
          } 
          // Or { success: false, message: "message" }
          else if ('message' in error.response.data) {
            errorMessage = (error.response.data as any).message;
          }
          // Or standard ApiResponse format
          else if ('message' in error.response.data && error.response.data.message) {
            errorMessage = (error.response.data as any).message;
          }
        } else if (error.response?.data) {
          const rawData = error.response.data as any;
          if (typeof rawData === 'string') {
            // Handle cases where server returns a string error or HTML page (like 404/502)
            if (rawData.includes('<!DOCTYPE html>')) {
              errorMessage = `Server Error (${error.response.status}): The backend returned an HTML page. Ensure your API URL is correct.`;
            } else {
              errorMessage = rawData;
            }
          }
        } else if (error.message) {
          errorMessage = error.message;
        }

        const base = error.config?.baseURL ? String(error.config.baseURL).replace(/\/$/, '') : '';
        const path = error.config?.url ? String(error.config.url) : '';
        const resolvedUrl =
          base && path ? `${base}${path.startsWith('/') ? path : `/${path}`}` : path || base || undefined;

        console.error('[API Client] API error:', {
          status: error.response?.status,
          message: errorMessage,
          url: error.config?.url,
          baseURL: error.config?.baseURL,
          resolvedUrl,
        });

        if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG_API === '1') {
          console.info('[API Client] debug', {
            hostname: window.location.hostname,
            resolvedUrl,
            hasToken: !!tokenStorage.get(),
          });
        }

        // Return error in consistent format
        return Promise.reject({
          message: errorMessage,
          status: error.response?.status,
          data: error.response?.data,
        });
      }
    );
  }

  /**
   * Get the axios instance
   */
  getInstance(): AxiosInstance {
    return this.client;
  }

  /**
   * GET request
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<ApiResponse<T>>(url, config);
    return response.data.data as T;
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<ApiResponse<T>>(url, data, config);
    return response.data.data as T;
  }

  /**
   * PUT request
   */
  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<ApiResponse<T>>(url, data, config);
    return response.data.data as T;
  }

  /**
   * PATCH request
   */
  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<ApiResponse<T>>(url, data, config);
    return response.data.data as T;
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<ApiResponse<T>>(url, config);
    return response.data.data as T;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

