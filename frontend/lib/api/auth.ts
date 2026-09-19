import { AxiosHeaders } from 'axios';
import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import { tokenStorage, userStorage, clearAuth } from '@/lib/utils/storage';
import { AuthResponse, User } from '@/types';
import { normalizeUserProfile } from '@/lib/utils/userProfile';

/**
 * Authentication API Service
 */
export const authApi = {
  /**
   * Login with email and password
   */
  login: async (email: string, password: string): Promise<AuthResponse> => {
    try {
      console.log('[AUTH API] Attempting login for:', email);
      const response = await apiClient.post<AuthResponse>(API_ENDPOINTS.AUTH.LOGIN, {
        email,
        password,
      });

      if (!response || !response.token) {
        throw new Error('Invalid response from server: missing token');
      }

      if (!response.user) {
        throw new Error('Invalid response from server: missing user data');
      }

      console.log('[AUTH API] Login successful, user role:', response.user.role);

      // Store token and user data
      tokenStorage.set(response.token);
      const storedUser = normalizeUserProfile(response.user) || response.user;
      userStorage.set(storedUser);

      return { ...response, user: storedUser };
    } catch (error: any) {
      console.error('[AUTH API] Login error:', error);
      // Re-throw with better error message
      if (error.message) {
        throw error;
      }
      throw new Error('Login failed. Please check your credentials and try again.');
    }
  },

  /**
   * Sign up new customer
   */
  signup: async (name: string, email: string, password: string): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>(API_ENDPOINTS.AUTH.SIGNUP, {
      name,
      email,
      password,
    });

    // Store token and user data
    tokenStorage.set(response.token);
    const storedUser = normalizeUserProfile(response.user) || response.user;
    userStorage.set(storedUser);

    return { ...response, user: storedUser };
  },

  /**
   * Get current user info
   */
  getCurrentUser: async (): Promise<User> => {
    try {
      console.log('[AUTH API] Fetching current user...');
      const user = await apiClient.get<User>(API_ENDPOINTS.AUTH.ME, {
        headers: new AxiosHeaders(),
        params: {
          _ts: Date.now(),
        },
      });
      console.log('[AUTH API] Current user fetched, role:', user?.role);
      return user;
    } catch (error: any) {
      console.error('[AUTH API] getCurrentUser error:', error);
      throw error;
    }
  },

  /**
   * Exchange Supabase token for our JWT token (for OAuth users)
   */
  exchangeToken: async (supabaseToken: string): Promise<{ token: string }> => {
    const response = await apiClient.post<{ token: string }>(API_ENDPOINTS.AUTH.EXCHANGE_TOKEN, {
      token: supabaseToken,
    });
    return response;
  },

  /**
   * Update current user profile
   */
  updateProfile: async (body: {
    name: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string | null;
    weddingDate?: string | null;
  }): Promise<User> => {
    const user = await apiClient.patch<User>(API_ENDPOINTS.AUTH.PROFILE, body);
    const normalized = normalizeUserProfile(user) || user;
    userStorage.set(normalized);
    return normalized;
  },

  /**
   * Change password (email/password accounts only; verifies current password via Supabase)
   */
  changePassword: async (body: { currentPassword: string; newPassword: string }): Promise<void> => {
    await apiClient.post<{ ok: true }>(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, body);
  },

  /**
   * Logout (clear local storage)
   */
  logout: async (): Promise<void> => {
    try {
      await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
    } catch (error) {
      // Even if API call fails, clear local storage
      console.error('Logout API error:', error);
    } finally {
      clearAuth();
    }
  },

  checkEmail: async (email: string): Promise<{ registered: boolean; googleOnly: boolean }> => {
    return await apiClient.post<{ registered: boolean; googleOnly: boolean }>(API_ENDPOINTS.AUTH.CHECK_EMAIL, { email });
  },

  /**
   * Log in / Register with Telegram authentication data
   */
  loginWithTelegram: async (telegramData: any): Promise<AuthResponse> => {
    try {
      console.log('[AUTH API] Attempting Telegram login for ID:', telegramData.id);
      const response = await apiClient.post<AuthResponse>('/api/auth/telegram', telegramData);

      if (!response || !response.token) {
        throw new Error('Invalid response from server: missing token');
      }

      if (!response.user) {
        throw new Error('Invalid response from server: missing user data');
      }

      console.log('[AUTH API] Telegram login successful, user role:', response.user.role);

      // Store token and user data
      tokenStorage.set(response.token);
      const storedUser = normalizeUserProfile(response.user) || response.user;
      userStorage.set(storedUser);

      return { ...response, user: storedUser };
    } catch (error: any) {
      console.error('[AUTH API] Telegram login error:', error);
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw new Error(error.message || 'Telegram login failed. Please try again.');
    }
  },
};

