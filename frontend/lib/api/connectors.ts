import { apiClient } from './client';

export type ConnectorScope = 'drive' | 'photos';

export type ConnectorStatus = {
  connected: boolean;
  connectedAt?: string;
};

export type ConnectorStatusResponse = {
  drive: ConnectorStatus;
  photos: ConnectorStatus;
};

export type AccessTokenResponse = {
  access_token: string;
  expires_in: number;
};

export const connectorsApi = {
  /** Exchange an authorization code for a refresh token (connect). */
  async exchangeCode(code: string, scope: ConnectorScope): Promise<{ connected: boolean; scope: string }> {
    return apiClient.post('/api/connectors/google/exchange', { code, scope });
  },

  /** Get a fresh access token using the stored refresh token. */
  async getAccessToken(scope: ConnectorScope): Promise<AccessTokenResponse> {
    return apiClient.get(`/api/connectors/google/token?scope=${scope}`);
  },

  /** Disconnect a connector (delete stored refresh token). */
  async disconnect(scope: ConnectorScope): Promise<{ disconnected: boolean; scope: string }> {
    return apiClient.delete(`/api/connectors/google/disconnect?scope=${scope}`);
  },

  /** Get connection status for current user. */
  async getStatus(): Promise<ConnectorStatusResponse> {
    return apiClient.get('/api/connectors/google/status');
  },

  /** Create a Google Photos Picker session. */
  async createPhotosSession(): Promise<{ sessionId: string; pickerUri: string }> {
    return apiClient.post('/api/connectors/google/photos/session');
  },

  /** Poll a Google Photos Picker session status. */
  async pollPhotosSession(sessionId: string): Promise<{ mediaItemsSet: boolean; mediaItems?: any[] }> {
    return apiClient.get(`/api/connectors/google/photos/session/${encodeURIComponent(sessionId)}`);
  },
};
