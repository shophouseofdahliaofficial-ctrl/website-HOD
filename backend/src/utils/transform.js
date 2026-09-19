/**
 * Data Transformation Utilities
 * Converts database snake_case to API camelCase
 */

/** PostgreSQL `DATE` → `YYYY-MM-DD` using UTC calendar fields (matches node-pg DATE → Date at UTC midnight). */
function pgDateOnlyToYmd(value) {
  if (value == null || value === undefined) return undefined;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(value);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    return y && m && d ? `${y}-${m}-${d}` : value.toISOString().slice(0, 10);
  }
  const s = String(value).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return undefined;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(dt);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return y && m && d ? `${y}-${m}-${d}` : dt.toISOString().slice(0, 10);
}

/**
 * Transform subscription row from database to API format
 * @param {Object} row - Database row with snake_case
 * @returns {Object} API format with camelCase
 */
const transformSubscription = (row) => {
  if (!row) return null;

  const snapshotAddress = row.checkout_delivery_address && typeof row.checkout_delivery_address === 'object'
    ? row.checkout_delivery_address
    : null;
  const joinedAddress = row.address_id ? {
    id: String(row.address_id),
    name: row.address_name,
    street: row.address_street,
    city: row.address_city,
    state: row.address_state,
    postalCode: row.address_postal_code,
    country: row.address_country || 'India',
    phone: row.address_phone || undefined,
    latitude: row.address_latitude !== null && row.address_latitude !== undefined ? parseFloat(row.address_latitude) : undefined,
    longitude: row.address_longitude !== null && row.address_longitude !== undefined ? parseFloat(row.address_longitude) : undefined,
  } : null;
  const deliveryAddress = snapshotAddress
    ? {
      id: snapshotAddress.id != null ? String(snapshotAddress.id) : (joinedAddress?.id || ''),
      name: snapshotAddress.name || '',
      street: snapshotAddress.street || '',
      city: snapshotAddress.city || '',
      state: snapshotAddress.state || '',
      postalCode: snapshotAddress.postalCode || snapshotAddress.postal_code || '',
      country: snapshotAddress.country || 'India',
      phone: snapshotAddress.phone || undefined,
      latitude:
        snapshotAddress.latitude !== null && snapshotAddress.latitude !== undefined
          ? parseFloat(snapshotAddress.latitude)
          : undefined,
      longitude:
        snapshotAddress.longitude !== null && snapshotAddress.longitude !== undefined
          ? parseFloat(snapshotAddress.longitude)
          : undefined,
    }
    : joinedAddress;

  return {
    id: String(row.id),
    userId: String(row.user_id),
    productId: String(row.product_id),
    variationId: row.product_variation_id != null ? String(row.product_variation_id) : undefined,
    addressId: row.address_id ? String(row.address_id) : undefined,
    product: row.product_name ? {
      id: String(row.product_id),
      name: row.product_name,
      description: row.product_description,
      pricePerLitre: parseFloat(row.price_per_litre),
      imageUrl: row.product_image_url,
      isActive: row.product_id ? true : false, // Assume active if product exists
      createdAt: row.created_at?.toISOString(),
      updatedAt: row.updated_at?.toISOString(),
    } : undefined,
    deliveryAddress: deliveryAddress || undefined,
    litresPerDay: parseFloat(row.litres_per_day),
    durationMonths: parseInt(row.duration_months),
    durationDays:
      row.duration_days !== null && row.duration_days !== undefined
        ? parseInt(row.duration_days, 10)
        : undefined,
    deliveryTime: row.delivery_time,
    status: row.status,
    startDate: pgDateOnlyToYmd(row.start_date),
    endDate: pgDateOnlyToYmd(row.end_date),
    razorpaySubscriptionId: row.razorpay_subscription_id,
    checkoutOrderId: row.checkout_order_id ? String(row.checkout_order_id) : undefined,
    trialCheckoutOrderId: row.trial_checkout_order_id ? String(row.trial_checkout_order_id) : undefined,
    trialCheckoutOrderTotal:
      row.trial_checkout_order_total != null && row.trial_checkout_order_total !== undefined
        ? parseFloat(row.trial_checkout_order_total)
        : undefined,
    paymentMethod: row.payment_method || 'online',
    frequency: row.frequency || 'daily',
    totalQty: row.total_qty !== null && row.total_qty !== undefined ? parseFloat(row.total_qty) : undefined,
    deliveredQty: row.delivered_qty !== null && row.delivered_qty !== undefined ? parseFloat(row.delivered_qty) : undefined,
    remainingQty: row.remaining_qty !== null && row.remaining_qty !== undefined ? parseFloat(row.remaining_qty) : undefined,
    perUnitPrice: row.per_unit_price !== null && row.per_unit_price !== undefined ? parseFloat(row.per_unit_price) : undefined,
    totalAmount: row.total_amount !== null && row.total_amount !== undefined ? parseFloat(row.total_amount) : undefined,
    totalAmountPaid: row.total_amount_paid !== null && row.total_amount_paid !== undefined ? parseFloat(row.total_amount_paid) : undefined,
    discountAmount: row.discount_amount !== null && row.discount_amount !== undefined ? parseFloat(row.discount_amount) : undefined,
    platformFee: row.platform_fee !== null && row.platform_fee !== undefined ? parseFloat(row.platform_fee) : undefined,
    walletUsed: row.wallet_used !== null && row.wallet_used !== undefined ? parseFloat(row.wallet_used) : undefined,
    purchasedAt: row.purchased_at ? new Date(row.purchased_at).toISOString() : undefined,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : undefined,
    renewedAt: row.renewed_at ? new Date(row.renewed_at).toISOString() : undefined,
    initialStartDate: row.initial_start_date ? pgDateOnlyToYmd(row.initial_start_date) : undefined,
    autopayStatus: row.autopay_status || undefined,
    autopayFailureReason: row.autopay_failure_reason || undefined,
    firstDayShiftApplied: row.first_day_shift_applied === true || row.first_day_shift_applied === 't',
    firstDayShiftReason: row.first_day_shift_reason || undefined,
    isTrial: row.is_trial === true || row.is_trial === 't',
    trialCreditAmount: row.trial_credit_amount !== null && row.trial_credit_amount !== undefined ? parseFloat(row.trial_credit_amount) : undefined,
    trialCreditUsed: row.trial_credit_used === true || row.trial_credit_used === 't',
    trialShifted: row.trial_shifted === true || row.trial_shifted === 't',
    upgradeFromTrialSubscriptionId:
      row.upgrade_from_trial_subscription_id != null && row.upgrade_from_trial_subscription_id !== undefined
        ? String(row.upgrade_from_trial_subscription_id)
        : undefined,
    variationSize: row.product_variation_size || undefined,
    variationMultiplier: row.product_variation_multiplier ? parseFloat(row.product_variation_multiplier) : undefined,
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
    // Extended fields from joins (for admin view)
    userName: row.user_name || undefined,
    userEmail: row.user_email || undefined,
  };
};

/**
 * Transform product row from database to API format
 * @param {Object} row - Database row with snake_case
 * @returns {Object} API format with camelCase
 */
const transformProduct = (row) => {
  if (!row) return null;

  const parsedDeliveryPincodes = Array.isArray(row.delivery_pincodes)
    ? row.delivery_pincodes
    : typeof row.delivery_pincodes === 'string'
      ? (() => {
        try {
          const parsed = JSON.parse(row.delivery_pincodes);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
      : [];
  const deliveryPincodeConfigs = parsedDeliveryPincodes
    .map((entry) => {
      if (entry && typeof entry === 'object') {
        return {
          pincode: String(entry.pincode || '').trim(),
          deliveryTimeText: String(entry.deliveryTimeText || '').trim(),
        };
      }
      return { pincode: String(entry || '').trim(), deliveryTimeText: '' };
    })
    .filter((entry) => /^\d{6}$/.test(entry.pincode));
  const deliveryPincodes = deliveryPincodeConfigs.map((entry) => entry.pincode);

  const parsedAccordionItems = Array.isArray(row.accordion_items)
    ? row.accordion_items
    : typeof row.accordion_items === 'string'
      ? (() => {
        try {
          const parsed = JSON.parse(row.accordion_items);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
      : [];

  const parsedCustomizationOptions = Array.isArray(row.customization_options)
    ? row.customization_options
    : typeof row.customization_options === 'string'
      ? (() => {
        try {
          const parsed = JSON.parse(row.customization_options);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
      : [];

  const parsedCustomizationCombinations = Array.isArray(row.customization_combinations)
    ? row.customization_combinations
    : typeof row.customization_combinations === 'string'
      ? (() => {
        try {
          const parsed = JSON.parse(row.customization_combinations);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
      : [];

  const parseJsonObject = (value, fallback) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
      } catch {
        return fallback;
      }
    }
    return fallback;
  };

  const parsedDetailBanners = parseJsonObject(row.detail_banners, { images: [], adaptToFullImageRatio: false, displayMode: 'stacked' });
  const parsedDigitalFlipbook = parseJsonObject(row.digital_flipbook, { enabled: false, sections: [] });

  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    pricePerLitre: parseFloat(row.price_per_litre),
    sellingPrice: row.selling_price !== null ? parseFloat(row.selling_price) : null,
    compareAtPrice: row.compare_at_price !== null ? parseFloat(row.compare_at_price) : null,
    taxPercent: row.tax_percent !== null && row.tax_percent !== undefined ? parseFloat(row.tax_percent) : 0,
    imageUrl: row.image_url,
    isActive: row.is_active,
    isMembershipEligible: row.is_membership_eligible || false,
    quantity: row.quantity !== null ? parseInt(row.quantity) : 0,
    lowStockThreshold: row.low_stock_threshold !== null ? parseInt(row.low_stock_threshold) : 10,
    maxQuantity: row.max_quantity !== null && row.max_quantity !== undefined ? parseInt(row.max_quantity) : 99,
    categoryId: row.category_id ? String(row.category_id) : null,
    isNationwideDelivery: Boolean(row.is_nationwide_delivery),
    deliveryPincodes,
    deliveryPincodeConfigs,
    deliveryTimeText: typeof row.delivery_time_text === 'string' ? row.delivery_time_text : null,
    isCustomizable: Boolean(row.is_customizable),
    photobookEditorEnabled: Boolean(row.photobook_editor_enabled),
    buyNowEnabled: row.buy_now_enabled === undefined || row.buy_now_enabled === null
      ? true
      : Boolean(row.buy_now_enabled),
    buyAgainEnabled: row.buy_again_enabled === undefined || row.buy_again_enabled === null
      ? true
      : Boolean(row.buy_again_enabled),
    polaroidUploadEnabled: Boolean(row.polaroid_upload_enabled),
    stripUploadEnabled: Boolean(row.strip_upload_enabled),
    hoverNextImage: Boolean(row.hover_next_image),
    accordionItems: parsedAccordionItems.map(item => ({
      title: String(item?.title || '').trim(),
      htmlContent: String(item?.htmlContent || item?.content || item?.html_content || '').trim()
    })),
    customizationOptions: parsedCustomizationOptions,
    customizationCombinations: parsedCustomizationCombinations,
    detailBanners: {
      images: Array.isArray(parsedDetailBanners.images)
        ? parsedDetailBanners.images.map((url) => String(url || '').trim()).filter(Boolean)
        : [],
      adaptToFullImageRatio: Boolean(parsedDetailBanners.adaptToFullImageRatio),
      displayMode: parsedDetailBanners.displayMode === 'carousel' ? 'carousel' : 'stacked',
    },
    digitalFlipbook: {
      enabled: Boolean(parsedDigitalFlipbook.enabled),
      hardcoverColor: typeof parsedDigitalFlipbook.hardcoverColor === 'string'
        && /^#[0-9A-Fa-f]{6}$/.test(parsedDigitalFlipbook.hardcoverColor.trim())
        ? parsedDigitalFlipbook.hardcoverColor.trim().toLowerCase()
        : '#5f6b3d',
      sections: Array.isArray(parsedDigitalFlipbook.sections)
        ? parsedDigitalFlipbook.sections.map((section, index) => ({
          id: String(section?.id || `section-${index + 1}`),
          title: String(section?.title || '').trim(),
          imageUrls: Array.isArray(section?.imageUrls)
            ? section.imageUrls.map((url) => String(url || '').trim()).filter(Boolean)
            : [],
        })).filter((section) => section.title)
        : [],
    },
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
  };
};

/**
 * Transform user row from database to API format
 * @param {Object} row - Database row with snake_case
 * @returns {Object} API format with camelCase
 */
const transformUser = (row) => {
  if (!row) return null;

  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    phone: row.phone || undefined,
    role: row.role ? row.role.toLowerCase() : 'customer', // Normalize to lowercase
    dateOfBirth: pgDateOnlyToYmd(row.date_of_birth),
    weddingDate: pgDateOnlyToYmd(row.wedding_date),
    telegramId: row.telegram_id || undefined,
    avatarUrl: row.avatar_url || undefined,
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
    lifetimeSavings: row.lifetime_savings !== null && row.lifetime_savings !== undefined ? parseFloat(row.lifetime_savings) : 0,
  };
};

/**
 * Transform delivery schedule row from database to API format
 * @param {Object} row - Database row with snake_case
 * @returns {Object} API format with camelCase
 */
const transformDeliverySchedule = (row) => {
  if (!row) return null;

  const isTrial =
    row.is_trial === true ||
    row.is_trial === 't' ||
    (row.trial_checkout_order_id != null && String(row.trial_checkout_order_id).trim() !== '');

  const hasCheckoutOrder =
    row.checkout_order_id != null && String(row.checkout_order_id).trim() !== '';
  const subPm = row.payment_method != null ? String(row.payment_method).trim() : '';
  const ordPm =
    row.checkout_order_payment_method != null ? String(row.checkout_order_payment_method).trim() : '';
  const pickPayment =
    hasCheckoutOrder && ordPm
      ? ordPm
      : subPm.length > 0
        ? subPm
        : ordPm.length > 0
          ? ordPm
          : 'online';

  return {
    id: String(row.id),
    subscriptionId: String(row.subscription_id),
    deliveryDate: pgDateOnlyToYmd(row.delivery_date) || null,
    status: row.status,
    createdAt: row.created_at?.toISOString(),
    // Extended fields from joins
    userId: row.user_id ? String(row.user_id) : undefined,
    litresPerDay: row.litres_per_day ? parseFloat(row.litres_per_day) : undefined,
    deliveryTime: row.delivery_time || undefined,
    productId: row.product_id != null && row.product_id !== undefined ? String(row.product_id) : undefined,
    variationSize: row.product_variation_size ? String(row.product_variation_size).trim() : undefined,
    productName: row.product_name || undefined,
    userName: row.user_name || undefined,
    userEmail: row.user_email || undefined,
    trialShifted: row.trial_shifted === true || row.trial_shifted === 't',
    isTrial,
    subscriptionStatus: row.subscription_status
      ? String(row.subscription_status).toLowerCase()
      : undefined,
    paymentMethod: pickPayment.toLowerCase(),
    frequency: row.frequency || 'daily',
    durationDays: row.duration_days != null ? parseInt(row.duration_days, 10) : undefined,
    startDate: pgDateOnlyToYmd(row.start_date) || null,
  };
};

module.exports = {
  transformSubscription,
  transformProduct,
  transformUser,
  transformDeliverySchedule,
  pgDateOnlyToYmd,
};
