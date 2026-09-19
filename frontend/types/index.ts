// User and Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'admin' | 'customer';
  createdAt: string;
  lifetimeSavings?: number;
  dateOfBirth?: string;
  weddingDate?: string;
  avatarUrl?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Product Types
export interface ProductImage {
  id: string;
  productId: string;
  imageUrl: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariation {
  id: string;
  productId: string;
  size: string; // e.g., "0.5L", "1L", "2L", "5L"
  priceMultiplier: number;
  price?: number; // Actual price for this variation (overrides priceMultiplier if set)
  /** Strikethrough / "was" price for this size (optional) */
  compareAtPrice?: number | null;
  isAvailable: boolean;
  displayOrder: number;
  weight?: number; // Weight in kg
  createdAt: string;
  updatedAt: string;
}

export interface ProductReview {
  id: string;
  productId: string;
  userId?: string;
  reviewerName: string;
  rating: number; // 1-5
  comment?: string;
  isApproved: boolean;
  userName?: string;
  userEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDeliveryPincodeConfig {
  pincode: string;
  deliveryTimeText?: string;
}

export interface ProductFeedbackAggregates {
  qualityStars: number | null;
  deliveryAgentStars: number | null;
  onTimeStars: number | null;
  valueForMoneyStars: number | null;
  qualityCount: number;
  deliveryAgentCount: number;
  onTimeCount: number;
  valueForMoneyCount: number;
  ratingDistribution?: { 1: number; 2: number; 3: number; 4: number; 5: number };
}

export interface VariantValue {
  id: string;
  name: string;
  price?: number;
  compareAtPrice?: number;
  stock?: number;
  sku?: string;
  imageUrl?: string;
  hexCode?: string; // For colour palette
  label?: string; // For text input label
  placeholder?: string; // For text input placeholder
  charLimit?: number; // For text input limit
  photobookWidthCm?: number;
  photobookHeightCm?: number;
  isActive: boolean;
}

export interface VariationGroup {
  id: string;
  title: string; // e.g., "Binding", "Paper Type", "Colour", "Size"
  type: 'image_selector' | 'option_buttons' | 'colour_palette' | 'text_input' | 'uploads';
  values: VariantValue[];
  polaroidUploadEnabled?: boolean;
  stripUploadEnabled?: boolean;
  polaroidUploadHint?: string;
  stripUploadHint?: string;
  uploadHintBoth?: string;
  maxImagesMap?: Array<{ optionValue: string; maxImages: number }>;
}

export interface ProductCustomizationCombination {
  id: string;
  combinationKeys: Record<string, string>; // { [groupId]: valueId }
  price?: number;
  compareAtPrice?: number;
  stock?: number;
  sku?: string;
  imageUrl?: string;
  isActive: boolean;
}

export interface ProductDetailBanners {
  images: string[];
  adaptToFullImageRatio?: boolean;
  displayMode?: 'carousel' | 'stacked';
}

export interface FlipbookSection {
  id: string;
  title: string;
  imageUrls: string[];
}

export interface ProductDigitalFlipbook {
  enabled: boolean;
  sections: FlipbookSection[];
  hardcoverColor?: string;
}

export interface ProductReviewSummary {
  averageRating: number;
  count: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  pricePerLitre: number;
  sellingPrice?: number | null;
  compareAtPrice?: number | null;
  taxPercent?: number;
  imageUrl?: string | null;
  isActive: boolean;
  isMembershipEligible?: boolean;
  quantity?: number;
  lowStockThreshold?: number;
  maxQuantity?: number;
  categoryId?: string | null;
  isNationwideDelivery?: boolean;
  deliveryPincodes?: string[];
  deliveryPincodeConfigs?: ProductDeliveryPincodeConfig[];
  deliveryTimeText?: string | null;
  weight?: number; // Weight in kg
  isCustomizable?: boolean;
  photobookEditorEnabled?: boolean;
  buyNowEnabled?: boolean;
  buyAgainEnabled?: boolean;
  polaroidUploadEnabled?: boolean;
  stripUploadEnabled?: boolean;
  hoverNextImage?: boolean;
  createdAt: string;
  updatedAt: string;
  // Extended fields (when fetched with details)
  images?: ProductImage[];
  variations?: ProductVariation[];
  reviews?: ProductReview[];
  reviewSummary?: ProductReviewSummary;
  feedbackAggregates?: ProductFeedbackAggregates;
  accordionItems?: Array<{ title: string; htmlContent: string }>;
  customizationOptions?: VariationGroup[];
  customizationCombinations?: ProductCustomizationCombination[];
  detailBanners?: ProductDetailBanners;
  digitalFlipbook?: ProductDigitalFlipbook;
}

// Subscription Types
export interface Subscription {
  id: string;
  userId: string;
  productId: string;
  product?: Product;
  variationId?: string;
  variation?: ProductVariation;
  litresPerDay: number;
  durationMonths: number;
  /** Calendar days in the plan when set (preferred for display and renewals). */
  durationDays?: number;
  deliveryTime: string; // e.g., "08:00"
  status: 'pending' | 'active' | 'paused' | 'cancelled' | 'expired' | 'failed';
  startDate: string;
  endDate: string;
  razorpaySubscriptionId?: string;
  autopayStatus?: 'created' | 'authenticated' | 'active' | 'halted' | 'cancelled' | string;
  /** Set when subscription was created from cart checkout (UUID of orders row). */
  checkoutOrderId?: string;
  /** COD trial pack: links trial subscription rows to the checkout order for admin delivery flow. */
  trialCheckoutOrderId?: string;
  /** COD trial: full order total due at delivery (items + platform + delivery), when joined from `orders`. */
  trialCheckoutOrderTotal?: number;
  /** How the subscription was paid for at purchase (`online` | `cod` | `wallet`). */
  paymentMethod?: string;
  addressId?: string;
  deliveryAddress?: Address;
  totalQty?: number;
  deliveredQty?: number;
  remainingQty?: number;
  perUnitPrice?: number;
  totalAmount?: number;
  totalAmountPaid?: number;
  discountAmount?: number;
  platformFee?: number;
  walletUsed?: number;
  purchasedAt?: string;
  renewedAt?: string;
  cancelledAt?: string;
  initialStartDate?: string;
  /** Set when AutoPay setup failed twice (subscription expired automatically). */
  autopayFailureReason?: string;
  /** True when first calendar-day delivery was moved to end (bought/renewed after slot ended). */
  firstDayShiftApplied?: boolean;
  /** `morning_slot_passed` | `evening_slot_passed` | `purchased_within_delivery_window` (from backend). */
  firstDayShiftReason?: string;
  isTrial?: boolean;
  trialCreditAmount?: number;
  trialCreditUsed?: boolean;
  trialShifted?: boolean;
  /** Present on a full-plan row created while upgrading from a trial; Razorpay pays this row, then the trial is cancelled. */
  upgradeFromTrialSubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
  frequency?: 'daily' | 'alternate' | 'weekly' | 'monthly';
  // Per-day delivery rows (when subscription detail includes schedules)
  deliverySchedules?: Array<{
    deliveryDate: string;
    status: 'pending' | 'delivered' | 'skipped' | 'cancelled';
  }>;
  /** YYYY-MM-DD dates with no delivery (pauses); may not have a delivery_schedules row */
  pausedDates?: string[];
  // Extended fields from joins (for admin view)
  variationSize?: string;
  variationMultiplier?: number;
  userName?: string;
  userEmail?: string;
}

// Wallet Types
export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  source: 'razorpay' | 'refund' | 'purchase' | 'subscription';
  referenceId?: string | null;
  createdAt?: string | null;
}

export interface WalletSummary {
  balance: number;
  transactions: WalletTransaction[];
}

// Delivery Schedule Types
export interface DeliverySchedule {
  id: string;
  subscriptionId: string;
  deliveryDate: string; // YYYY-MM-DD
  status: 'pending' | 'delivered' | 'skipped' | 'cancelled';
  createdAt: string;
  // Extended fields from backend joins
  userId?: string;
  litresPerDay?: number;
  deliveryTime?: string;
  productId?: string;
  /** From `product_variations.size` when subscription stores `product_variation_id`. */
  variationSize?: string;
  productName?: string;
  userName?: string;
  userEmail?: string;
  /** True when subscription was upgraded from trial to full on the same row (`subscriptions.trial_shifted`). */
  trialShifted?: boolean;
  /** From joined subscription row (admin deliveries). */
  isTrial?: boolean;
  /** Subscription row status: pending | active | … (admin deliveries). */
  subscriptionStatus?: string;
  /** Plan payment method, e.g. cod | online (admin deliveries). */
  paymentMethod?: string;
}

// Paused Date Types
export interface PausedDate {
  id: string;
  subscriptionId: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Payment Types
export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  orderId: string;
  key?: string;
}

export interface SubscriptionCreateRequest {
  productId: string;
  variationId?: string;
  variation_id?: string;
  productVariationId?: string;
  product_variation_id?: string;
  litresPerDay: number;
  /** Exact plan length in days (e.g. 15). Prefer this over durationMonths when both are sent. */
  durationDays?: number;
  /** Legacy: month buckets of 30 days each when durationDays is omitted. */
  durationMonths?: number;
  deliveryTime: string;
  frequency?: 'daily' | 'alternate' | 'weekly' | 'monthly' | 'quarterly';
  paymentMethod?: 'online' | 'wallet';
  addressId?: string;
  /**
   * Used only as metadata for trial upgrade payment-init. The backend must not mark
   * the trial as used/converted until payment verification succeeds.
   */
  trialSubscriptionId?: string;
  totalAmount?: number;
  total_amount?: number;
  amount?: number;
}

export interface TrialPackCreateRequestItem {
  productId: string;
  variationId?: string;
}

/** Same first-day slot-shift rules as full subscriptions when `deliveryTime` is sent with the estimate. */
export interface TrialPackCalendarPreview {
  durationDays: number;
  firstDayShiftApplied: boolean;
  firstDayShiftReason: string | null;
  startYmd: string;
  endYmd: string;
}

/** Server-computed trial checkout (items + platform + delivery), same rules as cart checkout. */
export interface TrialPackCheckoutBreakdown {
  subtotal: number;
  platformFee: number;
  deliveryCharges: number;
  total: number;
  isFirstProductOrder: boolean;
  deliveryDistanceMeters: number | null;
  trialCalendar?: TrialPackCalendarPreview | null;
}

// Address Types
export interface Address {
  id: string;
  userId: string;
  name: string; // Address name/label (e.g., "Home", "Office")
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}
