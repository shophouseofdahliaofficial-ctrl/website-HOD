import { resolveApiBaseUrl } from './apiBaseUrl';

/** @deprecated Prefer resolveApiBaseUrl() or apiClient (per-request base URL). */
export const API_BASE_URL = resolveApiBaseUrl();

export { resolveApiBaseUrl };

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/api/auth/login',
    SIGNUP: '/api/auth/signup',
    LOGOUT: '/api/auth/logout',
    ME: '/api/auth/me',
    PROFILE: '/api/auth/profile',
    CHANGE_PASSWORD: '/api/auth/change-password',
    REFRESH: '/api/auth/refresh',
    EXCHANGE_TOKEN: '/api/auth/exchange-token',
    CHECK_EMAIL: '/api/auth/check-email',
  },
  // Products
  PRODUCTS: {
    LIST: '/api/products',
    DETAIL: (id: string) => `/api/products/${id}`,
  },
  // Subscriptions
  SUBSCRIPTIONS: {
    LIST: '/api/subscriptions',
    CREATE: '/api/subscriptions',
    CREATE_TRIAL_PACK: '/api/subscriptions/trial-pack',
    ESTIMATE_TRIAL_PACK: '/api/subscriptions/trial-pack/estimate',
    VERIFY_TRIAL_PACK_PAYMENT: '/api/subscriptions/trial-pack/verify-payment',
    VERIFY_PAYMENT: '/api/subscriptions/verify-payment',
    DETAIL: (id: string) => `/api/subscriptions/${id}`,
    PAUSE: (id: string) => `/api/subscriptions/${id}/pause`,
    RESUME: (id: string) => `/api/subscriptions/${id}/resume`,
    CANCEL: (id: string) => `/api/subscriptions/${id}/cancel`,
    CANCEL_TODAY: (id: string) => `/api/subscriptions/${id}/cancel-today`,
    SETUP_AUTOPAY: (id: string) => `/api/subscriptions/${id}/setup-autopay`,
    VERIFY_AUTOPAY_SETUP: (id: string) => `/api/subscriptions/${id}/verify-autopay-setup`,
    REMOVE_AUTOPAY: (id: string) => `/api/subscriptions/${id}/remove-autopay`,
    RENEW_INIT: (id: string) => `/api/subscriptions/${id}/renew-init`,
    RENEW_VERIFY: (id: string) => `/api/subscriptions/${id}/renew-verify`,
    PAUSE_DATE: (id: string) => `/api/subscriptions/${id}/pause-date`,
  },
  WALLET: {
    SUMMARY: '/api/wallet',
    TOPUP: '/api/wallet/topup',
    VERIFY_TOPUP: '/api/wallet/verify-topup',
  },
  GIFTCARDS: {
    CREATE: '/api/giftcards/create',
    REDEEM: '/api/giftcards/redeem',
    HISTORY: '/api/giftcards/history',
  },
  // Banners
  BANNERS: {
    LIST: '/api/banners',
  },
  // Content
  CONTENT: {
    GET: (type: string) => `/api/content/${type}`,
    INCREMENT_WAITING: (type: string) => `/api/content/${type}/increment-waiting`,
  },
  // Coupons
  COUPONS: {
    VALIDATE: '/api/coupons/validate',
    LIST: '/api/coupons',
  },
  // Addresses
  ADDRESSES: {
    LIST: '/api/addresses',
    CREATE: '/api/addresses',
    DETAIL: (id: string) => `/api/addresses/${id}`,
    UPDATE: (id: string) => `/api/addresses/${id}`,
    DELETE: (id: string) => `/api/addresses/${id}`,
  },
  DELIVERY_TRACKING: {
    LIST: '/api/deliveries',
    MARK_DELIVERED: '/api/mark-delivered',
  },
  // Admin
  ADMIN: {
    PRODUCTS: {
      LIST: '/api/admin/products',
      CREATE: '/api/admin/products',
      DETAIL: (id: string) => `/api/admin/products/${id}`,
      UPDATE: (id: string) => `/api/admin/products/${id}`,
      DELETE: (id: string) => `/api/admin/products/${id}`,
      ADD_IMAGE: (id: string) => `/api/admin/products/${id}/images`,
      REORDER_IMAGES: (id: string) => `/api/admin/products/${id}/images/reorder`,
      DELETE_IMAGE: (id: string, imageId: string) => `/api/admin/products/${id}/images/${imageId}`,
      ADD_VARIATION: (id: string) => `/api/admin/products/${id}/variations`,
      UPDATE_VARIATION: (id: string, variationId: string) => `/api/admin/products/${id}/variations/${variationId}`,
      DELETE_VARIATION: (id: string, variationId: string) => `/api/admin/products/${id}/variations/${variationId}`,
      ADD_REVIEW: (id: string) => `/api/admin/products/${id}/reviews`,
      UPDATE_REVIEW: (id: string, reviewId: string) => `/api/admin/products/${id}/reviews/${reviewId}`,
      DELETE_REVIEW: (id: string, reviewId: string) => `/api/admin/products/${id}/reviews/${reviewId}`,
      UPLOAD_DETAIL_ASSET: (id: string) => `/api/admin/products/${id}/detail-assets`,
      UPLOAD_CUSTOMIZATION_ASSET: (id: string) => `/api/admin/products/${id}/customization-assets`,
      UPLOAD_PENDING_CUSTOMIZATION_ASSET: '/api/admin/products/customization-assets',
    },
    USERS: {
      LIST: '/api/admin/users',
      DETAIL: (id: string) => `/api/admin/users/${id}`,
    },
    CUSTOMERS: {
      LOOKUP_EMAIL: '/api/admin/customers/lookup-email',
      STATS: '/api/admin/customers',
      UPDATE_WALLET: (id: string) => `/api/admin/customers/${id}/wallet`,
    },
    SUBSCRIPTIONS: {
      LIST: '/api/admin/subscriptions',
      DETAIL: (id: string) => `/api/admin/subscriptions/${id}`,
      PAUSE: (id: string) => `/api/admin/subscriptions/${id}/pause`,
      RESUME: (id: string) => `/api/admin/subscriptions/${id}/resume`,
    },
    DELIVERIES: {
      LIST: '/api/admin/deliveries',
      UPDATE_STATUS: (id: string) => `/api/admin/deliveries/${id}`,
    },
    ORDERS: {
      LIST: '/api/admin/orders',
      PENDING_COUNT: '/api/admin/orders/pending-count',
      MANUAL_CREATE: '/api/admin/orders/manual',
      MARK_PACKAGE_PREPARED: (id: string) => `/api/admin/orders/${id}/mark-package-prepared`,
      MARK_OUT_FOR_DELIVERY: (id: string) => `/api/admin/orders/${id}/mark-out-for-delivery`,
      MARK_DELIVERED: (id: string) => `/api/admin/orders/${id}/mark-delivered`,
      MARK_FULFILLED: (id: string) => `/api/admin/orders/${id}/mark-fulfilled`,
      DETAIL: (id: string) => `/api/admin/orders/${id}`,
    },
    ORDER_DELIVERIES: {
      LIST: '/api/admin/order-deliveries',
      DETAIL: (id: string) => `/api/admin/orders/${id}`,
      PENDING_COUNT: '/api/admin/orders/pending-count',
      MARK_OUT_FOR_DELIVERY: (id: string) => `/api/admin/orders/${id}/mark-out-for-delivery`,
      MARK_DELIVERED: (id: string) => `/api/admin/orders/${id}/mark-delivered`,
      MARK_FULFILLED: (id: string) => `/api/admin/orders/${id}/mark-fulfilled`,
      ORDER_DELIVERY_STOPS: '/api/admin/order-delivery-stops',
    },
    BANNERS: {
      LIST: '/api/admin/banners',
      CREATE: '/api/admin/banners',
      UPDATE: (id: string) => `/api/admin/banners/${id}`,
      DELETE: (id: string) => `/api/admin/banners/${id}`,
    },
    CONTENT: {
      LIST: '/api/admin/content',
      GET: (type: string) => `/api/admin/content/${type}`,
      UPDATE: (type: string) => `/api/admin/content/${type}`,
      TOGGLE_STATUS: (type: string) => `/api/admin/content/${type}/status`,
      UPLOAD_IMAGE: (type: string) => `/api/admin/content/${type}/image`,
    },
    LOGO: {
      UPLOAD: '/api/admin/logo',
    },
    FAVICON: {
      UPLOAD: '/api/admin/favicon',
    },
    COUPONS: {
      LIST: '/api/admin/coupons',
      CREATE: '/api/admin/coupons',
      DETAIL: (id: string) => `/api/admin/coupons/${id}`,
      UPDATE: (id: string) => `/api/admin/coupons/${id}`,
      DELETE: (id: string) => `/api/admin/coupons/${id}`,
    },
    MEDIA: {
      LIST: '/api/admin/media',
      UPLOAD: '/api/admin/media/upload',
      DELETE: '/api/admin/media',
    },
  },
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'milko_auth_token',
  USER: 'milko_user',
} as const;

// Coming Soon bypass cookie (set when user enters admin panel password)
export const COMING_SOON_BYPASS_COOKIE = 'milko_coming_soon_bypass';

// Admin access cookie (set when logged-in user is admin; lets middleware allow access during coming-soon)
export const MILKO_ADMIN_COOKIE = 'milko_admin_access';
