'use client';

import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { triggerSparkleBurst } from '@/lib/utils/sparkleBurst';
import { Product, ProductVariation, ProductReview, VariationGroup, VariantValue } from '@/types';
import { productsApi, apiClient } from '@/lib/api';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  readScopedPincode,
  scopedPincodeKey,
  scopedPincodeStatusKey,
  writeScopedPincode,
} from '@/lib/utils/userScopedStorage';
import { animateToCart } from '@/lib/utils/cartAnimation';
import { cartIconRefStore } from '@/lib/utils/cartIconRef';
import styles from './ProductDetailsModal.module.css';
import cardStyles from './ProductsSection.module.css';
import RatingBadge from '@/components/ui/RatingBadge';
import { toSafeHtml } from '@/lib/utils/sanitizeHtml';
import { getUploadsVariationHint, isUploadsVariationActive, resolveUploadFlags } from '@/lib/product/uploadsVariation';
import { getOrderedProductImageUrls, getPrimaryProductImageUrl } from '@/lib/utils/productImages';
import { getAverageProductRating, getProductReviewCount, formatShortReviewCount } from '@/lib/utils/productReviewStats';
import { getFirstVariationForCard, getCardDiscountOff, getCardPriceDisplay, getProductDisplayUnitLabel } from '@/lib/utils/productCardPricing';
import { useCategoryMap } from '@/hooks/useCategoryMap';
import ProductPrintUploadModal, {
  type PrintUploadMode,
  type UploadedPrintItem,
} from '@/components/product/ProductPrintUploadModal';
import ProductDetailBanners from '@/components/product/ProductDetailBanners';
import ProductDigitalFlipbook from '@/components/product/ProductDigitalFlipbook';
import Logo from '@/components/Logo';

function UploadImagesButtonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="-9 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        fill="currentColor"
        d="M13.48 17.6c-0.48 0-0.84 0.36-0.84 0.84v3.92c0 0.48-0.36 0.84-0.84 0.84h-9.28c-0.48 0-0.84-0.36-0.84-0.84v-3.92c0-0.44-0.36-0.84-0.84-0.84s-0.84 0.4-0.84 0.84v3.92c0 1.4 1.12 2.52 2.52 2.52h9.28c1.4 0 2.52-1.12 2.52-2.52v-3.92c0-0.44-0.36-0.84-0.84-0.84zM7.76 7.4c-0.040-0.040-0.2-0.28-0.6-0.28s-0.56 0.24-0.6 0.28l-3.52 3.52c-0.32 0.32-0.32 0.84 0 1.2 0.32 0.32 0.84 0.32 1.2 0l2.080-2.12v7.92c0 0.48 0.36 0.84 0.84 0.84s0.84-0.36 0.84-0.84v-7.92l2.080 2.080c0.32 0.32 0.84 0.32 1.2 0 0.32-0.32 0.32-0.84 0-1.2l-3.52-3.48z"
      />
    </svg>
  );
}

function EditUploadedImagesButtonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0-4.24-4.24L3.76 15.76A1 1 0 0 0 3.6 16.4L4 20z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 6.5l4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const removePriceFromName = (name: string): string => {
  if (!name) return '';
  return name.replace(/\s*(?:\(\s*[+-]?\s*(?:₹|Rs\.?)\s*\d+(?:\.\d+)?\s*\)|[+-]?\s*(?:₹|Rs\.?)\s*\d+(?:\.\d+)?)/gi, '').trim();
};

interface ProductDetailsModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  mode?: 'default' | 'trial';
  onAddTrialProduct?: (payload: { product: Product; variation: ProductVariation | null }) => void;
  onRelatedProductClick?: (product: Product) => void;
  isFlatPage?: boolean;
}

export default function ProductDetailsModal({
  product,
  isOpen,
  onClose,
  mode = 'default',
  onAddTrialProduct,
  onRelatedProductClick,
  isFlatPage = false,
}: ProductDetailsModalProps) {
  const router = useRouter();
  const { addItem, items } = useCart();
  const { user, isAuthenticated } = useAuth();
  const pinUserId = user?.id ?? null;
  const { showToast } = useToast();
  const categoryMap = useCategoryMap();

  useEffect(() => {
    if (isOpen && !isFlatPage && product?.id) {
      router.push(`/product/${product.id}`);
      if (onClose) onClose();
    }
  }, [isOpen, isFlatPage, product?.id, router, onClose]);

  if (!isFlatPage) {
    return null;
  }

  const addToCartButtonRef = useRef<HTMLButtonElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const reviewSummaryRef = useRef<HTMLDivElement>(null);
  const detailsSectionRef = useRef<HTMLDivElement>(null);
  const imageSectionRef = useRef<HTMLDivElement>(null);
  const imageGridRef = useRef<HTMLDivElement>(null);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [productDetails, setProductDetails] = useState<Product | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);
  const [pincode, setPincode] = useState('');
  const [isPincodeAvailable, setIsPincodeAvailable] = useState<boolean | null>(null);
  const [isCheckingPincode, setIsCheckingPincode] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedCustomizations, setSelectedCustomizations] = useState<Record<string, string>>({});
  const [textPersonalizations, setTextPersonalizations] = useState<Record<string, string>>({});
  const [textPersonalizationDone, setTextPersonalizationDone] = useState<Record<string, boolean>>({});
  const [animatedPrice, setAnimatedPrice] = useState<number | null>(null);

  const [isPrintUploadOpen, setIsPrintUploadOpen] = useState(false);
  const [uploadedPrintItems, setUploadedPrintItems] = useState<UploadedPrintItem[]>([]);
  const [uploadedPrintMode, setUploadedPrintMode] = useState<PrintUploadMode>('polaroid');
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const [showRatingDetailsPopup, setShowRatingDetailsPopup] = useState(false);
  const [ratingMeterAnimateIn, setRatingMeterAnimateIn] = useState(false);

  const displayProduct: Product = productDetails || product;
  const isTrialMode = mode === 'trial';

  // Fetch full details
  useEffect(() => {
    let isMounted = true;
    if (product?.id) {
      setLoadingDetails(true);
      productsApi
        .getById(product.id)
        .then((data) => {
          if (isMounted && data) {
            setProductDetails(data);
          }
        })
        .catch((err) => {
          console.error('Failed to load product details:', err);
        })
        .finally(() => {
          if (isMounted) setLoadingDetails(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [product?.id]);

  // Fetch related products
  useEffect(() => {
    let isMounted = true;
    if (displayProduct?.categoryId) {
      setLoadingRelated(true);
      productsApi
        .getAll({ categoryId: displayProduct.categoryId })
        .then((res) => {
          if (isMounted) {
            const list = Array.isArray(res) ? res : (res as any)?.products || [];
            setRelatedProducts(list.filter((p: Product) => p.id !== displayProduct.id).slice(0, 4));
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoadingRelated(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [displayProduct?.categoryId, displayProduct?.id]);

  // Read saved pincode
  useEffect(() => {
    const savedPin = readScopedPincode(pinUserId);
    if (savedPin) {
      setPincode(savedPin);
    }
  }, [pinUserId]);

  const variations = useMemo(() => displayProduct.variations || [], [displayProduct.variations]);

  useEffect(() => {
    if (variations.length > 0 && !selectedVariationId) {
      const firstAvailable = variations.find((v) => v.isAvailable) || variations[0];
      if (firstAvailable) setSelectedVariationId(firstAvailable.id);
    }
  }, [variations, selectedVariationId]);

  const selectedVariation = useMemo(() => {
    return variations.find((v) => v.id === selectedVariationId) || variations[0] || null;
  }, [variations, selectedVariationId]);

  // Customization combinations calculation
  const currentCombination = useMemo(() => {
    if (!displayProduct.customizationCombinations || displayProduct.customizationCombinations.length === 0) {
      return null;
    }
    return displayProduct.customizationCombinations.find((combo) => {
      if (!combo.isActive) return false;
      return Object.entries(combo.combinationKeys || {}).every(
        ([groupId, valueId]) => selectedCustomizations[groupId] === valueId,
      );
    });
  }, [displayProduct.customizationCombinations, selectedCustomizations]);

  // Base pricing
  const basePrice = displayProduct.sellingPrice ?? displayProduct.pricePerLitre ?? 0;
  const baseCompareAtPrice = displayProduct.compareAtPrice ?? null;

  const unitPrice = useMemo(() => {
    if (currentCombination?.price != null) {
      return currentCombination.price;
    }
    if (selectedVariation?.priceMultiplier != null) {
      return basePrice * selectedVariation.priceMultiplier;
    }
    return basePrice;
  }, [currentCombination, selectedVariation, basePrice]);

  const originalUnitPrice = useMemo(() => {
    if (currentCombination?.compareAtPrice != null) {
      return currentCombination.compareAtPrice;
    }
    if (baseCompareAtPrice != null) {
      const mult = selectedVariation?.priceMultiplier ?? 1;
      return baseCompareAtPrice * mult;
    }
    return null;
  }, [currentCombination, baseCompareAtPrice, selectedVariation]);

  const unitOff = originalUnitPrice && originalUnitPrice > unitPrice ? originalUnitPrice - unitPrice : 0;
  const unitLabel = getProductDisplayUnitLabel(displayProduct);

  const productMaxQuantity = displayProduct.maxQuantity || 99;
  const safeQty = Math.max(1, Math.min(quantity, productMaxQuantity));

  const isProductOutOfStock = displayProduct.quantity !== undefined && displayProduct.quantity <= 0;
  const isAtMaxQuantity = safeQty >= productMaxQuantity;

  const remainingCartCapacity = useMemo(() => {
    const existing = items.find((i) => i.productId === displayProduct.id);
    const inCart = existing ? existing.quantity : 0;
    return Math.max(0, productMaxQuantity - inCart);
  }, [items, displayProduct.id, productMaxQuantity]);

  // Image collage
  const collageItems = useMemo(() => {
    const urls = getOrderedProductImageUrls(displayProduct);
    return urls.length > 0 ? urls : [getPrimaryProductImageUrl(displayProduct)];
  }, [displayProduct]);

  // Reviews
  const reviews = useMemo(() => {
    return (displayProduct.reviews || []).filter((r: ProductReview) => r.isApproved);
  }, [displayProduct.reviews]);

  const feedback = displayProduct.feedbackAggregates;
  const averageRating = useMemo(() => {
    if (reviews.length > 0) {
      return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    }
    return feedback?.qualityStars ?? 5.0;
  }, [reviews, feedback]);

  const { resolvedPolaroidUploadEnabled, resolvedStripUploadEnabled } = useMemo(
    () => resolveUploadFlags(displayProduct, selectedVariation),
    [displayProduct, selectedVariation],
  );

  const uploadsVariationGroup = useMemo(() => {
    return (displayProduct.customizationOptions || []).find((g) => g.type === 'uploads');
  }, [displayProduct.customizationOptions]);

  const printUploadEnabled = resolvedPolaroidUploadEnabled || resolvedStripUploadEnabled;
  const showUploadsInVariations = Boolean(
    uploadsVariationGroup && (resolvedPolaroidUploadEnabled || resolvedStripUploadEnabled),
  );
  const printUploadCompleted = uploadedPrintItems.length > 0;

  // Customization group state handlers
  const isGroupEnabled = useCallback(
    (index: number) => {
      const groups = displayProduct.customizationOptions || [];
      if (index === 0) return true;
      for (let i = 0; i < index; i++) {
        const prevGroup = groups[i];
        if (prevGroup.type === 'uploads') {
          if (!printUploadCompleted) return false;
        } else if (prevGroup.type === 'text_input') {
          const allDone = prevGroup.values.every((v) => textPersonalizationDone[`${prevGroup.id}_${v.id}`]);
          if (!allDone) return false;
        } else {
          if (!selectedCustomizations[prevGroup.id]) return false;
        }
      }
      return true;
    },
    [displayProduct.customizationOptions, printUploadCompleted, selectedCustomizations, textPersonalizationDone],
  );

  const requiresCustomizationCompletion = useMemo(() => {
    const groups = displayProduct.customizationOptions || [];
    if (!displayProduct.isCustomizable || groups.length === 0) return false;
    return groups.some((g, idx) => !isGroupEnabled(idx + 1) && idx < groups.length - 1);
  }, [displayProduct.customizationOptions, displayProduct.isCustomizable, isGroupEnabled]);

  const handlePincodeCheck = useCallback(async () => {
    if (!pincode || pincode.length !== 6) return;
    setIsCheckingPincode(true);
    try {
      if (displayProduct.isNationwideDelivery) {
        setIsPincodeAvailable(true);
        writeScopedPincode(pinUserId, pincode);
      } else {
        const allowed = displayProduct.deliveryPincodes || [];
        const isAvail = allowed.includes(pincode);
        setIsPincodeAvailable(isAvail);
        if (isAvail) writeScopedPincode(pinUserId, pincode);
      }
    } finally {
      setIsCheckingPincode(false);
    }
  }, [pincode, displayProduct, pinUserId]);

  const handleToggleFavorite = useCallback(() => {
    setIsFavorite((prev) => {
      const next = !prev;
      showToast(next ? 'Added to favorites' : 'Removed from favorites', 'success');
      return next;
    });
  }, [showToast]);

  const handleAddToCart = useCallback(() => {
    if (isProductOutOfStock) {
      showToast('Out of stock', 'error');
      return;
    }
    if (requiresCustomizationCompletion) {
      showToast('Please complete all variation options before adding to cart.', 'error');
      return;
    }
    if (remainingCartCapacity <= 0) {
      showToast(`Maximum order quantity is ${productMaxQuantity}`, 'error');
      return;
    }

    const printUploadCustomization = printUploadCompleted
      ? {
          printUpload: {
            items: uploadedPrintItems,
            mode: uploadedPrintMode,
            count: uploadedPrintItems.length,
          },
        }
      : {};

    const result = addItem({
      productId: displayProduct.id,
      variationId: selectedVariation?.id ?? undefined,
      quantity: safeQty,
      customizations: {
        selectedOptions: selectedCustomizations,
        textPersonalization: textPersonalizations,
        ...printUploadCustomization,
      },
    });

    if (result.ok) {
      showToast('Added to cart', 'success');
      if (addToCartButtonRef.current) {
        animateToCart(addToCartButtonRef.current, cartIconRefStore.current);
      }
    } else {
      showToast('Could not add to cart', 'error');
    }
  }, [
    isProductOutOfStock,
    requiresCustomizationCompletion,
    remainingCartCapacity,
    printUploadCompleted,
    uploadedPrintItems,
    uploadedPrintMode,
    addItem,
    displayProduct.id,
    selectedVariation,
    safeQty,
    selectedCustomizations,
    textPersonalizations,
    showToast,
    productMaxQuantity,
  ]);

  const handleBuyNow = useCallback(() => {
    handleAddToCart();
    router.push('/checkout');
  }, [handleAddToCart, router]);

  const scrollToReviewSummary = useCallback(() => {
    setShowRatingDetailsPopup(true);
    setRatingMeterAnimateIn(true);
  }, []);

  const sharePageUrl = typeof window !== 'undefined' ? window.location.href : '';

  const renderStockStatus = () => {
    const hasVariations = variations && variations.length > 0;
    const isInStock = !isProductOutOfStock && (hasVariations ? variations.some((v) => v.isAvailable) : true);
    const qty = displayProduct.quantity ?? 0;
    const lowStockThreshold = displayProduct.lowStockThreshold ?? 10;
    const isLowStock = qty > 0 && qty < lowStockThreshold;

    return (
      <div className={`${styles.stockStatus} ${isInStock ? (isLowStock ? styles.lowStock : styles.inStock) : styles.outOfStock}`}>
        {isInStock ? (
          <>
            <svg className={styles.stockIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{isLowStock ? 'Low in stock' : 'In Stock'}</span>
          </>
        ) : (
          <>
            <svg className={styles.stockIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M15 9L9 15M9 9L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>Out of stock</span>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={isFlatPage ? styles.flatPageContainer : styles.modalOverlay}>
      {isFlatPage && (
        <div className={styles.flatPageNav}>
          <button
            onClick={onClose}
            className={styles.flatPageBackLink}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ marginRight: '0.5rem', transform: 'rotate(180deg)', display: 'inline-block', verticalAlign: 'middle' }}
            >
              <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ verticalAlign: 'middle' }}>Back to products</span>
          </button>
        </div>
      )}

      <div
        ref={isFlatPage ? undefined : modalContentRef}
        className={isFlatPage ? styles.flatPageBody : styles.modalContent}
        onClick={(e) => e.stopPropagation()}
      >
        {loadingDetails ? (
          <div className={styles.shimmerWrapper}>
            <div className={styles.shimmerImage} />
            <div className={styles.shimmerDetails}>
              <div className={styles.shimmerTitle} />
              <div className={styles.shimmerRating} />
              <div className={styles.shimmerPrice} />
              <div className={styles.shimmerButtons}>
                <div className={styles.shimmerButton} />
                <div className={styles.shimmerButton} />
              </div>
            </div>
          </div>
        ) : (
          <div className={isFlatPage ? undefined : styles.modalBody} style={isFlatPage ? { display: 'contents' } : undefined}>
            {/* Left Side - Images */}
            <div className={styles.imageSection} ref={imageSectionRef}>
              {displayProduct.isCustomizable && !isFlatPage ? (
                <div className={`${cardStyles.assuredBadge} ${cardStyles.customizableBadge} ${styles.productCustomizableBadge}`}>
                  <span>Customizable</span>
                </div>
              ) : null}

              {collageItems.length > 0 ? (
                <div className={styles.imageGridWrapper}>
                  <div ref={imageGridRef} className={styles.imageGrid}>
                    {collageItems.map((item, idx) => (
                      <div
                        key={idx}
                        className={styles.imageGridItem}
                        onClick={() => {
                          setSelectedImageIndex(idx);
                          setIsImageZoomOpen(true);
                        }}
                      >
                        <Image
                          src={item}
                          alt={`${displayProduct.name} ${idx + 1}`}
                          width={600}
                          height={600}
                          className={styles.gridImage}
                          sizes="(max-width: 640px) 50vw, 280px"
                        />
                      </div>
                    ))}
                  </div>
                  {collageItems.length > 1 && (
                    <div className={styles.imagePaginationDots}>
                      {collageItems.map((_, dotIdx) => (
                        <span
                          key={dotIdx}
                          className={`${styles.paginationDot} ${selectedImageIndex === dotIdx ? styles.paginationDotActive : ''}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.placeholderImage}>
                  <Logo />
                </div>
              )}
            </div>

            {/* Right Side - Details */}
            <div className={styles.detailsSection} ref={detailsSectionRef}>
              <div className={styles.productOverviewCard}>
                {/* Product Title & Share */}
                <div className={styles.productHeader}>
                  <h1 className={styles.productTitle}>
                    <span>{displayProduct.name}</span>
                    <div className={styles.shareRow}>
                      <button
                        type="button"
                        className={`${styles.favoriteTrigger} ${isFavorite ? styles.favoriteTriggerActive : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isFavorite) triggerSparkleBurst(e.currentTarget);
                          handleToggleFavorite();
                        }}
                        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <svg
                          className={styles.favoriteTriggerIcon}
                          viewBox="0 0 24 24"
                          fill={isFavorite ? '#ff0155' : 'none'}
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                      </button>
                      <div className={styles.shareWrap} ref={shareMenuRef}>
                        <button
                          type="button"
                          className={styles.shareTrigger}
                          onClick={() => setShareMenuOpen((open) => !open)}
                          aria-label="Share product"
                        >
                          <svg className={styles.shareTriggerIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.8" />
                            <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                            <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.8" />
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </h1>
                </div>

                {/* Rating */}
                {reviews.length > 0 && (
                  <div
                    className={styles.productRating}
                    role="button"
                    tabIndex={0}
                    onClick={scrollToReviewSummary}
                    aria-label="View customer reviews"
                  >
                    <span className={styles.ratingScore}>{averageRating.toFixed(1)}</span>
                    <svg className={styles.ratingStarIcon} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                    <span className={styles.ratingDivider} />
                    <span className={styles.ratingCount}>({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})</span>
                  </div>
                )}

                {/* Stock status */}
                <div className={styles.stockStatusMobileOnly}>{renderStockStatus()}</div>

                {/* Price */}
                <div className={styles.priceSection}>
                  <div className={styles.priceContainer}>
                    <div className={styles.singlePriceContainer}>
                      <span className={styles.currentPrice}>₹{Math.round(unitPrice)}</span>
                      {originalUnitPrice && originalUnitPrice > unitPrice ? (
                        <span className={styles.originalPrice}>₹{Math.round(originalUnitPrice)}</span>
                      ) : null}
                    </div>
                  </div>
                  {unitOff > 0 && (
                    <div className={styles.discountBadge}>₹{Math.round(unitOff)} OFF</div>
                  )}
                </div>

                {/* Quantity + Variations */}
                <div className={styles.purchaseSection}>
                  {productMaxQuantity > 1 && !isTrialMode ? (
                    <div className={styles.qtyRow}>
                      <div className={styles.qtyLabel}>Qty</div>
                      <div className={styles.qtyControl} aria-label="Quantity selector">
                        <button
                          type="button"
                          className={styles.qtyButton}
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          aria-label="Decrease quantity"
                        >
                          -
                        </button>
                        <input
                          className={styles.qtyInput}
                          value={safeQty}
                          inputMode="numeric"
                          onChange={(e) => {
                            const n = parseInt(e.target.value || '1', 10);
                            setQuantity(Number.isFinite(n) ? n : 1);
                          }}
                          aria-label="Quantity"
                        />
                        <button
                          type="button"
                          className={styles.qtyButton}
                          onClick={() => {
                            if (isProductOutOfStock) return;
                            if (remainingCartCapacity <= 0 || safeQty >= remainingCartCapacity) {
                              showToast(`Maximum order quantity is ${productMaxQuantity}`, 'error');
                              return;
                            }
                            setQuantity((q) => Math.min(productMaxQuantity, q + 1));
                          }}
                          aria-label="Increase quantity"
                          disabled={isAtMaxQuantity || isProductOutOfStock}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Variations selector */}
                  {variations.length > 0 && (
                    <div className={styles.variationPicker}>
                      <div className={styles.variationRow}>
                        <div className={styles.variationLabel}>Size / Style</div>
                        <div className={styles.variationsGrid}>
                          {variations.map((v) => {
                            const isActive = v.id === selectedVariationId;
                            return (
                              <button
                                key={v.id}
                                type="button"
                                className={`${styles.variationButton} ${isActive ? styles.variationActive : ''} ${v.isAvailable ? '' : styles.variationDisabled}`}
                                disabled={!v.isAvailable}
                                onClick={() => setSelectedVariationId(v.id)}
                              >
                                {removePriceFromName(v.size)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Print upload button if active */}
                  {printUploadEnabled && !showUploadsInVariations && !isTrialMode ? (
                    <button
                      type="button"
                      className={`${styles.uploadImagesButton} ${printUploadCompleted ? styles.uploadImagesButtonEdit : ''}`}
                      onClick={() => setIsPrintUploadOpen(true)}
                    >
                      {printUploadCompleted ? (
                        <EditUploadedImagesButtonIcon className={styles.uploadImagesButtonIcon} />
                      ) : (
                        <UploadImagesButtonIcon className={styles.uploadImagesButtonIcon} />
                      )}
                      <span>{printUploadCompleted ? 'Edit uploaded Images' : 'Upload Images'}</span>
                    </button>
                  ) : null}

                  {/* Action buttons */}
                  <div className={styles.actionButtons}>
                    {isTrialMode ? (
                      <button
                        type="button"
                        className={`${styles.buyNowButton} ${styles.trialModeButton}`}
                        disabled={isProductOutOfStock}
                        onClick={() => {
                          onAddTrialProduct?.({
                            product: displayProduct,
                            variation: selectedVariation ?? null,
                          });
                          onClose();
                        }}
                      >
                        Add for trial pack
                      </button>
                    ) : (
                      <>
                        <button
                          ref={addToCartButtonRef}
                          type="button"
                          className={styles.addToCartButton}
                          disabled={isProductOutOfStock || remainingCartCapacity <= 0}
                          onClick={handleAddToCart}
                        >
                          Add to Cart
                        </button>
                        {displayProduct.buyNowEnabled !== false && (
                          <button
                            type="button"
                            className={styles.buyNowButton}
                            disabled={isProductOutOfStock}
                            onClick={handleBuyNow}
                          >
                            Buy Now
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Delivery Checker */}
                <div className={styles.deliverySection}>
                  <div className={styles.deliveryTitle}>Check Delivery</div>
                  <div className={styles.pincodeInputRow}>
                    <input
                      type="text"
                      className={styles.pincodeInput}
                      placeholder="Enter 6-digit pincode"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setPincode(val);
                        setIsPincodeAvailable(null);
                      }}
                    />
                    <button
                      type="button"
                      className={styles.pincodeCheckButton}
                      disabled={pincode.length !== 6 || isCheckingPincode}
                      onClick={handlePincodeCheck}
                    >
                      {isCheckingPincode ? 'Checking...' : 'Check'}
                    </button>
                  </div>
                  {isPincodeAvailable !== null && (
                    <div className={isPincodeAvailable ? styles.pincodeSuccess : styles.pincodeError}>
                      {isPincodeAvailable ? 'Delivery available in your area' : 'Delivery not available for this pincode'}
                    </div>
                  )}
                </div>

                {/* Description */}
                {displayProduct.description && (
                  <div className={styles.descriptionSection}>
                    <div className={styles.descriptionTitle}>About Product</div>
                    <div
                      className={styles.descriptionContent}
                      dangerouslySetInnerHTML={{ __html: toSafeHtml(displayProduct.description) }}
                    />
                  </div>
                )}
              </div>

              {/* Banners */}
              {displayProduct.detailBanners && displayProduct.detailBanners.images?.length > 0 && (
                <ProductDetailBanners banners={displayProduct.detailBanners} />
              )}

              {/* Related Products */}
              {relatedProducts.length > 0 && (
                <div className={styles.relatedSection}>
                  <h3 className={styles.relatedHeading}>You May Also Like</h3>
                  <div className={styles.relatedGrid}>
                    {relatedProducts.map((rel) => (
                      <Link
                        key={rel.id}
                        href={`/product/${rel.id}`}
                        className={styles.relatedCard}
                        onClick={() => onRelatedProductClick?.(rel)}
                      >
                        <div className={styles.relatedImageWrap}>
                          <Image
                            src={getPrimaryProductImageUrl(rel)}
                            alt={rel.name}
                            fill
                            className={styles.relatedImage}
                            sizes="(max-width: 640px) 50vw, 200px"
                          />
                        </div>
                        <div className={styles.relatedInfo}>
                          <div className={styles.relatedName}>{rel.name}</div>
                          <div className={styles.relatedPrice}>₹{Math.round(rel.sellingPrice ?? rel.pricePerLitre)}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Product Print Upload Modal */}
      {printUploadEnabled && isPrintUploadOpen && (
        <ProductPrintUploadModal
          isOpen={isPrintUploadOpen}
          onClose={() => setIsPrintUploadOpen(false)}
          polaroidEnabled={resolvedPolaroidUploadEnabled}
          stripEnabled={resolvedStripUploadEnabled}
          initialItems={uploadedPrintItems}
          initialMode={uploadedPrintMode}
          onContinue={({ items: nextItems, mode: nextMode }) => {
            setUploadedPrintItems(nextItems);
            setUploadedPrintMode(nextMode);
            setIsPrintUploadOpen(false);
            showToast(`${nextItems.length} photos customized and saved!`, 'success');
          }}
        />
      )}
    </div>
  );
}
