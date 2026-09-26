'use client';

import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { triggerSparkleBurst } from '@/lib/utils/sparkleBurst';
import { Product, ProductVariation, ProductReview, VariationGroup, VariantValue } from '@/types';
import { productsApi, apiClient, deliveryApi, contentApi, DeliveryPincodeCheckResponse } from '@/lib/api';
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
import ProductCardImage from '@/components/ui/ProductCardImage';
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
  initialPhotobookProjectId?: string;
}

export default function ProductDetailsModal({
  product,
  isOpen,
  onClose,
  mode = 'default',
  onAddTrialProduct,
  onRelatedProductClick,
  isFlatPage = false,
  initialPhotobookProjectId,
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
  const detailsSectionRef = useRef<HTMLDivElement | null>(null);
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
  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryPincodeCheckResponse | null>(null);
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
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [zoomPan, setZoomPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isZoomDragging, setIsZoomDragging] = useState<boolean>(false);
  const zoomDragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({ x: 0, y: 0, panX: 0, panY: 0 });
  const hasZoomMovedRef = useRef<boolean>(false);
  const [openAccordionIndex, setOpenAccordionIndex] = useState<number | null>(0);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [showRatingDetailsPopup, setShowRatingDetailsPopup] = useState(false);
  const [showSizeGuideModal, setShowSizeGuideModal] = useState(false);
  const [ratingMeterAnimateIn, setRatingMeterAnimateIn] = useState(false);
  const [trustpilotUrl, setTrustpilotUrl] = useState<string>('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string>('');

  useEffect(() => {
    contentApi
      .getByType('reviews')
      .then((data) => {
        if (data && data.isActive && data.metadata) {
          if (data.metadata.trustpilotUrl) setTrustpilotUrl(data.metadata.trustpilotUrl);
          if (data.metadata.googleReviewUrl) setGoogleReviewUrl(data.metadata.googleReviewUrl);
        }
      })
      .catch(() => {});
  }, []);

  const displayProduct: Product = productDetails || product || ({} as any);
  const isTrialMode = mode === 'trial';
  const showSkeleton = loadingDetails || !displayProduct?.id;

  // Fetch full details
  useEffect(() => {
    // Scroll window and containers to top whenever product changes
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    if (detailsSectionRef.current) {
      detailsSectionRef.current.scrollTop = 0;
    }
    if (imageGridRef.current) {
      imageGridRef.current.scrollTop = 0;
    }
    if (imageSectionRef.current) {
      imageSectionRef.current.scrollTop = 0;
    }
    if (modalContentRef.current) {
      modalContentRef.current.scrollTop = 0;
    }
    setSelectedImageIndex(0);

    let isMounted = true;
    if (product?.id) {
      setLoadingDetails(true);
      productsApi
        .getById(product.id, true)
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
        .getAll()
        .then((res) => {
          if (isMounted) {
            const list = Array.isArray(res) ? res : (res as any)?.products || [];
            setRelatedProducts(list.filter((p: Product) => p.id !== displayProduct.id).slice(0, 4));
          }
        })
        .catch(() => { })
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

  // Sync isFavorite from scoped localStorage
  useEffect(() => {
    if (!user || !displayProduct?.id) {
      setIsFavorite(false);
      return;
    }
    const favKey = `milko_favorites_u_${user.id}`;
    const syncFav = () => {
      try {
        const raw = localStorage.getItem(favKey);
        if (raw) {
          const map = JSON.parse(raw);
          setIsFavorite(Boolean(map[displayProduct.id]));
        } else {
          setIsFavorite(false);
        }
      } catch {
        setIsFavorite(false);
      }
    };
    syncFav();
    window.addEventListener('favorites-updated', syncFav);
    return () => {
      window.removeEventListener('favorites-updated', syncFav);
    };
  }, [user, displayProduct?.id]);

  // Compute deliverability whenever pincode or product changes (via Delhivery)
  useEffect(() => {
    if (!pincode || pincode.length !== 6) {
      setIsPincodeAvailable(null);
      setDeliveryDetails(null);
      return;
    }
    const pinNum = parseInt(pincode, 10);
    if (!pinNum || pinNum < 110000 || pinNum > 855999) {
      setIsPincodeAvailable(false);
      setDeliveryDetails(null);
      return;
    }

    let isMounted = true;
    setIsCheckingPincode(true);

    deliveryApi
      .checkPincode(pincode, displayProduct?.id)
      .then((res) => {
        if (!isMounted) return;
        setIsPincodeAvailable(res.deliverable);
        setDeliveryDetails(res);
        if (res.deliverable) {
          writeScopedPincode(pinUserId, pincode, 'available');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Delhivery check fallback:', err);
        setIsPincodeAvailable(false);
        setDeliveryDetails(null);
      })
      .finally(() => {
        if (isMounted) setIsCheckingPincode(false);
      });

    return () => {
      isMounted = false;
    };
  }, [pincode, displayProduct?.id, displayProduct?.isNationwideDelivery, displayProduct?.deliveryPincodes, pinUserId]);

  // Listen for pincode-updated event from Header modal
  useEffect(() => {
    const handlePincodeUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ pincode?: string; status?: string }>;
      const detail = customEvent.detail;
      if (detail?.pincode) {
        setPincode(detail.pincode);
      }
    };

    window.addEventListener('milko:pincode-updated', handlePincodeUpdated as EventListener);
    return () => {
      window.removeEventListener('milko:pincode-updated', handlePincodeUpdated as EventListener);
    };
  }, []);

  // Close share menu on outside click
  useEffect(() => {
    if (!shareMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShareMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [shareMenuOpen]);

  const variations = useMemo(() => displayProduct?.variations || [], [displayProduct?.variations]);

  useEffect(() => {
    if (variations.length > 0) {
      if (!selectedVariationId || !variations.some((v) => v.id === selectedVariationId)) {
        const firstAvailable = variations.find((v) => v.isAvailable) || variations[0];
        if (firstAvailable) setSelectedVariationId(firstAvailable.id);
      }
    }
  }, [variations, selectedVariationId]);

  useEffect(() => {
    setSelectedCustomizations({});
    setTextPersonalizations({});
    setTextPersonalizationDone({});
    setUploadedPrintItems([]);
  }, [displayProduct?.id]);

  useEffect(() => {
    if ((displayProduct.isCustomizable || (displayProduct.customizationOptions && displayProduct.customizationOptions.length > 0)) && displayProduct.customizationOptions && displayProduct.customizationOptions.length > 0) {
      if (displayProduct.customizationOptions.length === 1) {
        const g = displayProduct.customizationOptions[0];
        if (!selectedCustomizations[g.id] && g.values && g.values.length > 0) {
          if (g.type !== 'text_input' && g.type !== 'uploads') {
            const firstAvailable = g.values.find((val) => (val as any).isActive !== false) || g.values[0];
            if (firstAvailable) {
              setSelectedCustomizations((prev) => {
                if (prev[g.id]) return prev;
                return { ...prev, [g.id]: firstAvailable.id };
              });
            }
          }
        }
      }
    }
  }, [displayProduct.customizationOptions, displayProduct.isCustomizable, displayProduct.id]);

  const selectedVariation = useMemo(() => {
    return variations.find((v) => v.id === selectedVariationId) || variations[0] || null;
  }, [variations, selectedVariationId]);

  // Customization combinations calculation
  const currentCombination = useMemo(() => {
    if (!displayProduct?.customizationCombinations || displayProduct.customizationCombinations.length === 0) {
      return null;
    }
    const entries = Object.entries(selectedCustomizations);
    if (entries.length === 0) return null;

    return displayProduct.customizationCombinations.find((combo) => {
      if (combo.isActive === false) return false;
      const keys = combo.combinationKeys || {};
      return Object.entries(keys).every(
        ([groupId, valueId]) => String(selectedCustomizations[groupId]) === String(valueId),
      );
    });
  }, [displayProduct?.customizationCombinations, selectedCustomizations]);

  // Base pricing
  const basePrice = (displayProduct?.sellingPrice !== null && displayProduct?.sellingPrice !== undefined && Number.isFinite(Number(displayProduct?.sellingPrice)))
    ? Number(displayProduct.sellingPrice)
    : Number(displayProduct?.pricePerLitre || 0);

  const baseCompareAtPrice = (displayProduct?.compareAtPrice !== null && displayProduct?.compareAtPrice !== undefined && Number.isFinite(Number(displayProduct?.compareAtPrice)))
    ? Number(displayProduct.compareAtPrice)
    : null;

  const unitPrice = useMemo(() => {
    if (displayProduct.isCustomizable || (displayProduct.customizationOptions && displayProduct.customizationOptions.length > 0)) {
      if (currentCombination?.price != null && Number.isFinite(Number(currentCombination.price))) {
        let comboPrice = Number(currentCombination.price);
        if (textPersonalizations) {
          (displayProduct.customizationOptions || []).forEach((group) => {
            if (group.type === 'text_input') {
              (group.values || []).forEach((val) => {
                const inputKey = `${group.id}_${val.id}`;
                const textVal = textPersonalizations[inputKey] || '';
                if (textVal.trim() && typeof val.price === 'number' && Number.isFinite(val.price)) {
                  comboPrice += val.price;
                }
              });
            }
          });
        }
        return comboPrice;
      }

      let sellingSum = basePrice;
      Object.keys(selectedCustomizations).forEach((groupId) => {
        const valId = selectedCustomizations[groupId];
        const group = (displayProduct.customizationOptions || []).find((g) => g.id === groupId);
        const val = group ? (group.values || []).find((v) => String(v.id) === String(valId)) : null;
        if (val && typeof val.price === 'number' && Number.isFinite(val.price)) {
          sellingSum += val.price;
        }
      });

      if (textPersonalizations) {
        (displayProduct.customizationOptions || []).forEach((group) => {
          if (group.type === 'text_input') {
            (group.values || []).forEach((val) => {
              const inputKey = `${group.id}_${val.id}`;
              const textVal = textPersonalizations[inputKey] || '';
              if (textVal.trim() && typeof val.price === 'number' && Number.isFinite(val.price)) {
                sellingSum += val.price;
              }
            });
          }
        });
      }

      return sellingSum;
    }

    // Standard variations
    if (selectedVariation?.price != null && Number.isFinite(Number(selectedVariation.price))) {
      return Number(selectedVariation.price);
    }
    const mult = Number(selectedVariation?.priceMultiplier) || 1;
    return basePrice * mult;
  }, [
    displayProduct.isCustomizable,
    displayProduct.customizationOptions,
    currentCombination,
    basePrice,
    selectedCustomizations,
    textPersonalizations,
    selectedVariation,
  ]);

  const originalUnitPrice = useMemo(() => {
    if (displayProduct.isCustomizable || (displayProduct.customizationOptions && displayProduct.customizationOptions.length > 0)) {
      if (currentCombination?.compareAtPrice != null && Number.isFinite(Number(currentCombination.compareAtPrice))) {
        return Number(currentCombination.compareAtPrice);
      }
      if (baseCompareAtPrice != null) {
        let compareSum = baseCompareAtPrice;
        Object.keys(selectedCustomizations).forEach((groupId) => {
          const valId = selectedCustomizations[groupId];
          const group = (displayProduct.customizationOptions || []).find((g) => g.id === groupId);
          const val = group ? (group.values || []).find((v) => String(v.id) === String(valId)) : null;
          if (val && typeof val.price === 'number' && Number.isFinite(val.price)) {
            compareSum += val.price;
          }
        });
        return compareSum;
      }
      return null;
    }

    // Standard variations
    if (selectedVariation?.compareAtPrice != null && Number.isFinite(Number(selectedVariation.compareAtPrice))) {
      return Number(selectedVariation.compareAtPrice);
    }
    if (baseCompareAtPrice != null) {
      const mult = Number(selectedVariation?.priceMultiplier) || 1;
      return baseCompareAtPrice * mult;
    }
    return null;
  }, [
    displayProduct.isCustomizable,
    displayProduct.customizationOptions,
    currentCombination,
    baseCompareAtPrice,
    selectedCustomizations,
    selectedVariation,
  ]);

  const unitOff = originalUnitPrice && originalUnitPrice > unitPrice ? originalUnitPrice - unitPrice : 0;
  const unitLabel = getProductDisplayUnitLabel(displayProduct);

  const animatedPriceRef = useRef<number | null>(null);
  const [priceAnimKey, setPriceAnimKey] = useState<number>(0);
  const [priceDirY, setPriceDirY] = useState<number>(1);
  const prevUnitPriceRef = useRef<number>(0);

  useEffect(() => {
    animatedPriceRef.current = animatedPrice;
  }, [animatedPrice]);

  // Reset animatedPrice when product changes
  useEffect(() => {
    setAnimatedPrice(null);
  }, [displayProduct.id]);

  // Price Tweening Animation Effect
  useEffect(() => {
    if (animatedPriceRef.current === null) {
      setAnimatedPrice(unitPrice);
      return;
    }

    let startTimestamp: number | null = null;
    const startValue = animatedPriceRef.current;
    const endValue = unitPrice;
    const duration = 120;

    if (startValue === endValue) return;

    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);

      const easedProgress = progress * (2 - progress);
      const currentValue = startValue + (endValue - startValue) * easedProgress;

      setAnimatedPrice(currentValue);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [unitPrice]);

  useEffect(() => {
    if (prevUnitPriceRef.current !== unitPrice && prevUnitPriceRef.current !== 0) {
      const diff = unitPrice - prevUnitPriceRef.current;
      setPriceDirY(diff >= 0 ? 1 : -1);
      setPriceAnimKey((prev) => prev + 1);
    }
    prevUnitPriceRef.current = unitPrice;
  }, [unitPrice]);

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
    const urls = getOrderedProductImageUrls(displayProduct).filter(Boolean) as string[];
    const fallback = getPrimaryProductImageUrl(displayProduct);
    if (urls.length > 0) return urls;
    return fallback ? [fallback] : [];
  }, [displayProduct]);

  // Zoom overlay effects: lock scrollbar on page/body, handle wheel zoom, Esc / Arrow key nav
  useEffect(() => {
    if (!isImageZoomOpen) {
      setZoomScale(1);
      setZoomPan({ x: 0, y: 0 });
      return;
    }

    const prevBodyOverflow = document.body.style.overflow;
    const prevDocOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setZoomScale((prev) => {
        const delta = e.deltaY < 0 ? 0.25 : -0.25;
        const next = Math.min(4, Math.max(1, +(prev + delta).toFixed(2)));
        if (next === 1) {
          setZoomPan({ x: 0, y: 0 });
        }
        return next;
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1 || isZoomDragging) {
        e.preventDefault();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsImageZoomOpen(false);
      } else if (e.key === 'ArrowLeft') {
        setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : collageItems.length - 1));
        setZoomScale(1);
        setZoomPan({ x: 0, y: 0 });
      } else if (e.key === 'ArrowRight') {
        setSelectedImageIndex((prev) => (prev < collageItems.length - 1 ? prev + 1 : 0));
        setZoomScale(1);
        setZoomPan({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevDocOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isImageZoomOpen, collageItems.length, isZoomDragging]);

  // Gallery items expanded for 3 equal columns layout
  const displayGalleryItems = useMemo(() => {
    if (collageItems.length === 0) return [];
    if (collageItems.length === 1) return [collageItems[0], collageItems[0], collageItems[0]];
    if (collageItems.length === 2) return [collageItems[0], collageItems[1], collageItems[0]];
    return collageItems;
  }, [collageItems]);

  // Infinite track with 3 repeated sets for seamless 2-way infinite scrolling
  const infiniteGalleryItems = useMemo(() => {
    if (displayGalleryItems.length === 0) return [];
    return [...displayGalleryItems, ...displayGalleryItems, ...displayGalleryItems];
  }, [displayGalleryItems]);

  useEffect(() => {
    const el = imageGridRef.current;
    if (!el || displayGalleryItems.length === 0) return;

    const alignTrack = () => {
      const singleSetWidth = el.scrollWidth / 3;
      if (singleSetWidth > 0 && (el.scrollLeft === 0 || el.scrollLeft < singleSetWidth * 0.5 || el.scrollLeft > singleSetWidth * 2.5)) {
        el.scrollLeft = singleSetWidth;
      }
    };

    alignTrack();
    const timer1 = setTimeout(alignTrack, 50);
    const timer2 = setTimeout(alignTrack, 250);
    window.addEventListener('resize', alignTrack);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', alignTrack);
    };
  }, [displayGalleryItems.length]);

  const handleWheelOnDetails = useCallback((e: WheelEvent) => {
    if (isImageZoomOpen) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const el = detailsSectionRef.current;
    if (!el) return;

    if (isFlatPage) {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const maxScroll = Math.max(0, scrollHeight - clientHeight);
      const isScrollingDown = e.deltaY > 0;
      const isScrollingUp = e.deltaY < 0;
      const pageScrollY = typeof window !== 'undefined' ? (window.scrollY || document.documentElement.scrollTop || 0) : 0;

      if (isScrollingDown) {
        if (scrollTop < maxScroll - 0.5) {
          e.preventDefault();
          e.stopPropagation();
          const target = Math.min(maxScroll, el.scrollTop + e.deltaY);
          const leftover = (el.scrollTop + e.deltaY) - maxScroll;
          el.scrollTop = target;
          if (leftover > 0 && typeof window !== 'undefined') {
            window.scrollBy({ top: leftover, behavior: 'auto' });
          }
        } else {
          e.preventDefault();
          e.stopPropagation();
          if (typeof window !== 'undefined') {
            window.scrollBy({ top: e.deltaY, behavior: 'auto' });
          }
        }
      } else if (isScrollingUp) {
        if (pageScrollY > 0) {
          e.preventDefault();
          e.stopPropagation();
          const leftover = -(pageScrollY + e.deltaY);
          if (typeof window !== 'undefined') {
            window.scrollBy({ top: e.deltaY, behavior: 'auto' });
          }
          if (leftover > 0) {
            el.scrollTop = Math.max(0, el.scrollTop - leftover);
          }
        } else if (scrollTop > 0.5) {
          e.preventDefault();
          e.stopPropagation();
          el.scrollTop = Math.max(0, el.scrollTop + e.deltaY);
        }
      }
    } else {
      e.stopPropagation();
      const { scrollTop, scrollHeight, clientHeight } = el;
      const isScrollable = scrollHeight > clientHeight;

      if (!isScrollable) {
        e.preventDefault();
        return;
      }

      const isScrollingUp = e.deltaY < 0;
      const isScrollingDown = e.deltaY > 0;

      if (isScrollingUp && scrollTop <= 0) {
        e.preventDefault();
      } else if (isScrollingDown && Math.ceil(scrollTop + clientHeight) >= scrollHeight) {
        e.preventDefault();
      }
    }
  }, [isFlatPage]);

  const setDetailsSectionRef = useCallback((node: HTMLDivElement | null) => {
    if (detailsSectionRef.current) {
      detailsSectionRef.current.removeEventListener('wheel', handleWheelOnDetails);
    }
    detailsSectionRef.current = node;
    if (node) {
      node.addEventListener('wheel', handleWheelOnDetails, { passive: false });
    }
  }, [handleWheelOnDetails]);

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

  const ratingCounts = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (reviews.length > 0) {
      reviews.forEach((r) => {
        const rating = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
        counts[rating as 1 | 2 | 3 | 4 | 5] = (counts[rating as 1 | 2 | 3 | 4 | 5] || 0) + 1;
      });
    } else {
      counts[5] = 1;
    }
    return counts;
  }, [reviews]);

  useEffect(() => {
    if (!showRatingDetailsPopup) {
      setRatingMeterAnimateIn(false);
      return;
    }

    const frame = requestAnimationFrame(() => {
      setRatingMeterAnimateIn(true);
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [showRatingDetailsPopup]);

  const formatReviewRelativeDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
    const diffYears = Math.floor(diffDays / 365);
    return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
  };

  const renderReviewStars = (rating: number) => (
    <div className={styles.reviewRating} data-rating={rating} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${styles.reviewStarIcon} ${star <= rating ? styles.reviewStarFilled : styles.reviewStarEmpty}`}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557L3.04 10.385a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.111z" />
        </svg>
      ))}
    </div>
  );

  const RATING_METER_SEGMENT_COLORS = ['#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#15803d'];
  const RATING_METER_STROKE_WIDTH = 8;

  const buildRatingMeterArcPath = (
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ) => {
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy - radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy - radius * Math.sin(endAngle);
    return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
  };

  const renderSingleRatingMeter = (
    rating: number | null | undefined,
    key: string,
    label: string,
    animateIn: boolean
  ) => {
    const value = rating ?? 0;
    const displayValue = value > 0 ? value.toFixed(1) : '0';
    const segmentCount = RATING_METER_SEGMENT_COLORS.length;
    const clampedValue = Math.min(segmentCount, Math.max(0, value));
    const fullSegments = Math.floor(clampedValue);
    const partialFraction = clampedValue - fullSegments;

    return (
      <div key={key} className={styles.ratingMeterCard} title={label}>
        <div className={styles.ratingMeterShell}>
          <svg
            className={styles.ratingMeterSvg}
            viewBox="0 0 100 62"
            role="img"
            aria-label={`${label}: ${displayValue} out of 5`}
          >
            {RATING_METER_SEGMENT_COLORS.map((_, index) => {
              const startAngle = Math.PI - (index / segmentCount) * Math.PI;
              const endAngle = Math.PI - ((index + 1) / segmentCount) * Math.PI;

              return (
                <path
                  key={`${key}-bg-${index}`}
                  className={styles.ratingMeterSegmentBg}
                  d={buildRatingMeterArcPath(50, 48, 38, startAngle, endAngle)}
                  fill="none"
                  strokeWidth={RATING_METER_STROKE_WIDTH}
                  strokeLinecap="butt"
                />
              );
            })}
            {RATING_METER_SEGMENT_COLORS.map((color, index) => {
              const startAngle = Math.PI - (index / segmentCount) * Math.PI;
              const endAngle = Math.PI - ((index + 1) / segmentCount) * Math.PI;
              const isFull = index < fullSegments;
              const isPartial = index === fullSegments && partialFraction > 0;
              const shouldShow = isFull || isPartial;

              if (!shouldShow) {
                return null;
              }

              const targetFill = isPartial ? partialFraction : 1;

              return (
                <path
                  key={`${key}-segment-${index}`}
                  className={`${styles.ratingMeterSegment}${animateIn ? ` ${styles.ratingMeterSegmentFilled}` : ''}`}
                  d={buildRatingMeterArcPath(50, 48, 38, startAngle, endAngle)}
                  fill="none"
                  stroke={color}
                  strokeWidth={RATING_METER_STROKE_WIDTH}
                  strokeLinecap="butt"
                  pathLength={1}
                  style={{
                    ['--segment-fill' as string]: targetFill,
                    ['--segment-fill-gap' as string]: 1 - targetFill,
                    ['--segment-delay' as string]: `${index * 180}ms`,
                  }}
                />
              );
            })}
          </svg>
          <span className={styles.ratingMeterValue}>{displayValue}</span>
        </div>
        <span className={styles.ratingMeterLabel}>{label}</span>
      </div>
    );
  };

  const effectiveAccordionItems = useMemo(() => {
    if (displayProduct.accordionItems && displayProduct.accordionItems.length > 0) {
      return displayProduct.accordionItems.map((item) => ({
        title: (item.title || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<!--[\s\S]*$/g, '').trim(),
        content: ((item as any).content || (item as any).htmlContent || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<!--[\s\S]*$/g, '').trim(),
      }));
    }
    return [
      {
        title: 'Sustainability',
        content:
          'Our products are crafted with sustainably sourced, eco-friendly materials designed for endurance and minimal environmental footprint.',
      },
      {
        title: 'Whats inside?',
        content:
          'Premium quality materials, custom craftsmanship, and attention to detail engineered for high performance and durability.',
      },
    ];
  }, [displayProduct.accordionItems]);

  const uploadsVariationGroup = useMemo(() => {
    return (displayProduct?.customizationOptions || []).find((g) => g.type === 'uploads');
  }, [displayProduct?.customizationOptions]);

  const { polaroidEnabled: resolvedPolaroidUploadEnabled, stripEnabled: resolvedStripUploadEnabled } = useMemo(
    () => resolveUploadFlags(uploadsVariationGroup, displayProduct),
    [uploadsVariationGroup, displayProduct],
  );

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
          const allDone = (prevGroup.values || []).every((v) => textPersonalizationDone[`${prevGroup.id}_${v.id}`]);
          if (!allDone) return false;
        } else {
          if (!selectedCustomizations[prevGroup.id]) return false;
        }
      }
      return true;
    },
    [displayProduct.customizationOptions, printUploadCompleted, selectedCustomizations, textPersonalizationDone],
  );

  const handleSelectCustomizationOption = useCallback((groupId: string, valueId: string, groupIdx: number) => {
    setSelectedCustomizations((prev) => {
      const next = { ...prev, [groupId]: valueId };
      const groups = displayProduct.customizationOptions || [];
      // Clear selections for all groups after this one, so subsequent variations are unlocked and chosen step-by-step
      for (let i = groupIdx + 1; i < groups.length; i++) {
        delete next[groups[i].id];
      }
      return next;
    });
  }, [displayProduct.customizationOptions]);

  const requiresCustomizationCompletion = useMemo(() => {
    const groups = displayProduct.customizationOptions || [];
    if ((!displayProduct.isCustomizable && !(displayProduct.customizationOptions && displayProduct.customizationOptions.length > 0)) || groups.length === 0) return false;
    return !isGroupEnabled(groups.length);
  }, [displayProduct.customizationOptions, displayProduct.isCustomizable, isGroupEnabled]);

  const handlePincodeCheck = useCallback(async () => {
    if (!pincode || pincode.length !== 6) return;
    setIsCheckingPincode(true);
    try {
      if (displayProduct.isNationwideDelivery) {
        setIsPincodeAvailable(true);
        writeScopedPincode(pinUserId, pincode, 'available');
      } else {
        const allowed = displayProduct.deliveryPincodes || [];
        const isAvail = allowed.includes(pincode);
        setIsPincodeAvailable(isAvail);
        if (isAvail) writeScopedPincode(pinUserId, pincode, 'available');
      }
    } finally {
      setIsCheckingPincode(false);
    }
  }, [pincode, displayProduct, pinUserId]);

  const handleToggleFavorite = useCallback(() => {
    if (!user) {
      showToast('Please login to add favorites', 'error');
      return;
    }
    if (!displayProduct?.id) return;
    const favKey = `milko_favorites_u_${user.id}`;
    let favMap: Record<string, boolean> = {};
    try {
      const raw = localStorage.getItem(favKey);
      if (raw) favMap = JSON.parse(raw);
    } catch {
      favMap = {};
    }
    const nextVal = !favMap[displayProduct.id];
    if (nextVal) {
      favMap[displayProduct.id] = true;
    } else {
      delete favMap[displayProduct.id];
    }
    localStorage.setItem(favKey, JSON.stringify(favMap));
    setIsFavorite(nextVal);
    showToast(
      nextVal ? `Added ${displayProduct.name} to favorites` : `Removed ${displayProduct.name} from favorites`,
      'success'
    );
    window.dispatchEvent(new Event('favorites-updated'));
  }, [user, displayProduct?.id, displayProduct?.name, showToast]);

  const handleAddToCart = useCallback(() => {
    if (isProductOutOfStock) return false;
    if (requiresCustomizationCompletion) {
      showToast('Please complete all required options', 'error');
      return false;
    }
    if (remainingCartCapacity <= 0) {
      showToast(`Maximum order quantity is ${productMaxQuantity}`, 'error');
      return false;
    }

    const printUploadCustomization = isUploadsVariationActive(displayProduct)
      ? {
        uploadedPrintItems,
        uploadedPrintMode,
        printUploadCompleted,
      }
      : {};

    const variationIdToUse = (displayProduct.isCustomizable || (displayProduct.customizationOptions && displayProduct.customizationOptions.length > 0))
      ? (currentCombination?.id ?? undefined)
      : (selectedVariation?.id ?? undefined);

    const result = addItem({
      productId: displayProduct.id,
      variationId: variationIdToUse,
      quantity: safeQty,
      customizations: {
        selectedOptions: selectedCustomizations,
        textPersonalization: textPersonalizations,
        ...printUploadCustomization,
      },
    });

    if (result.ok) {
      showToast('Added to cart', 'success');
      const sourceBtn = addToCartButtonRef.current || (document.querySelector(`.${styles.addToCartButton}`) as HTMLElement) || (document.querySelector('button[class*="addToCartButton"]') as HTMLElement);
      if (sourceBtn) {
        const imageUrl = getPrimaryProductImageUrl(displayProduct) || (displayProduct as any).imageUrl || '';
        const target = cartIconRefStore.getAny();
        animateToCart({
          imageUrl,
          sourceElement: sourceBtn,
          targetElement: target,
        });
      }
      return true;
    } else {
      showToast('Could not add to cart', 'error');
      return false;
    }
  }, [
    isProductOutOfStock,
    requiresCustomizationCompletion,
    remainingCartCapacity,
    printUploadCompleted,
    uploadedPrintItems,
    uploadedPrintMode,
    addItem,
    displayProduct,
    currentCombination,
    selectedVariation,
    safeQty,
    selectedCustomizations,
    textPersonalizations,
    showToast,
    productMaxQuantity,
  ]);

  const handleBuyNow = useCallback(() => {
    const success = handleAddToCart();
    if (!success) return;

    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
    if (isDesktop) {
      window.dispatchEvent(new CustomEvent('open-desktop-cart'));
    } else {
      router.push('/checkout');
    }
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
        {showSkeleton ? (
          <div className={isFlatPage ? undefined : styles.modalBody} style={isFlatPage ? { display: 'contents' } : undefined}>
            {/* Left Side - Image Gallery Skeleton */}
            <div className={`${styles.imageSection} ${styles.imageSectionSkeleton}`}>
              <div className={`${styles.galleryNavBtn} ${styles.galleryNavPrev} ${styles.skeletonNavArrow}`} />
              <div className={`${styles.galleryNavBtn} ${styles.galleryNavNext} ${styles.skeletonNavArrow}`} />

              <div className={styles.imageGridWrapper}>
                <div className={styles.imageGridSkeleton}>
                  <div className={styles.skeletonImageCard}>
                    <div className={`${styles.skeletonBase} ${styles.skeletonImage}`} />
                  </div>
                  <div className={styles.skeletonImageCard}>
                    <div className={`${styles.skeletonBase} ${styles.skeletonImage}`} />
                  </div>
                  <div className={styles.skeletonImageCard}>
                    <div className={`${styles.skeletonBase} ${styles.skeletonImage}`} />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Details Card Skeleton */}
            <div className={`${styles.detailsSection} ${styles.detailsSectionSkeleton}`}>
              <div className={styles.skeletonTitleRow}>
                <div className={`${styles.skeletonBase} ${styles.skeletonTitle}`} />
                <div className={`${styles.skeletonBase} ${styles.skeletonShareBtn}`} />
              </div>

              <div className={`${styles.skeletonBase} ${styles.skeletonRating}`} />
              <div className={`${styles.skeletonBase} ${styles.skeletonPrice}`} />

              <div className={styles.skeletonGroup}>
                <div className={`${styles.skeletonBase} ${styles.skeletonGroupLabel}`} />
                <div className={styles.skeletonPillsRow}>
                  <div className={`${styles.skeletonBase} ${styles.skeletonPill}`} style={{ width: '42px' }} />
                  <div className={`${styles.skeletonBase} ${styles.skeletonPill}`} style={{ width: '38px' }} />
                  <div className={`${styles.skeletonBase} ${styles.skeletonPill}`} style={{ width: '40px' }} />
                  <div className={`${styles.skeletonBase} ${styles.skeletonPill}`} style={{ width: '38px' }} />
                  <div className={`${styles.skeletonBase} ${styles.skeletonPill}`} style={{ width: '42px' }} />
                  <div className={`${styles.skeletonBase} ${styles.skeletonPill}`} style={{ width: '48px' }} />
                </div>
              </div>

              <div className={styles.skeletonGroup}>
                <div className={`${styles.skeletonBase} ${styles.skeletonGroupLabel}`} style={{ width: '52px' }} />
                <div className={styles.skeletonPillsRow}>
                  <div className={`${styles.skeletonBase} ${styles.skeletonPill}`} style={{ width: '54px' }} />
                  <div className={`${styles.skeletonBase} ${styles.skeletonPill}`} style={{ width: '58px' }} />
                  <div className={`${styles.skeletonBase} ${styles.skeletonPill}`} style={{ width: '68px' }} />
                  <div className={`${styles.skeletonBase} ${styles.skeletonPill}`} style={{ width: '50px' }} />
                </div>
              </div>

              <div style={{ flex: 1, minHeight: '30px' }} />

              <div className={styles.skeletonActionRow}>
                <div className={`${styles.skeletonBase} ${styles.skeletonFavoriteBtn}`} />
                <div className={`${styles.skeletonBase} ${styles.skeletonAddToCartBtn}`} />
                <div className={`${styles.skeletonBase} ${styles.skeletonBuyNowBtn}`} />
              </div>

              <div className={`${styles.skeletonBase} ${styles.skeletonDeliveryNote}`} />
            </div>
          </div>
        ) : (
          <div className={isFlatPage ? undefined : styles.modalBody} style={isFlatPage ? { display: 'contents' } : undefined}>
            {/* Left Side - Images */}
            <div className={styles.imageSection} ref={imageSectionRef}>
              {displayGalleryItems.length > 0 ? (
                <>
                  {displayGalleryItems.length > 1 && (
                    <>
                      <button
                        type="button"
                        className={`${styles.galleryNavBtn} ${styles.galleryNavPrev}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (imageGridRef.current) {
                            const el = imageGridRef.current;
                            const itemWidth = isFlatPage ? el.clientWidth / 3 : el.clientWidth;
                            const singleSetWidth = el.scrollWidth / 3;
                            if (singleSetWidth > 0 && el.scrollLeft <= itemWidth) {
                              el.scrollLeft = el.scrollLeft + singleSetWidth;
                            }
                            el.scrollBy({ left: -itemWidth, behavior: 'smooth' });
                          }
                        }}
                        aria-label="Previous images"
                      >
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 12H20M4 12L8 8M4 12L8 16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`${styles.galleryNavBtn} ${styles.galleryNavNext}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (imageGridRef.current) {
                            const el = imageGridRef.current;
                            const itemWidth = isFlatPage ? el.clientWidth / 3 : el.clientWidth;
                            const singleSetWidth = el.scrollWidth / 3;
                            if (singleSetWidth > 0 && el.scrollLeft >= singleSetWidth * 2 - itemWidth) {
                              el.scrollLeft = el.scrollLeft - singleSetWidth;
                            }
                            el.scrollBy({ left: itemWidth, behavior: 'smooth' });
                          }
                        }}
                        aria-label="Next images"
                      >
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M20 12H4M20 12L16 8M20 12L16 16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </>
                  )}

                  <div ref={imageGridRef} className={styles.imageGridWrapper}>
                    <div className={styles.imageGrid}>
                      {infiniteGalleryItems.map((item, idx) => (
                        <div
                          key={idx}
                          className={styles.imageGridItem}
                          onClick={() => {
                            setSelectedImageIndex(idx % collageItems.length);
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
                </>
              ) : (
                <div className={styles.placeholderImage}>
                  <Logo />
                </div>
              )}
            </div>

            {/* Right Side - Details */}
            <div className={styles.detailsSection} ref={setDetailsSectionRef}>
              <div className={styles.productOverviewCard}>
                {/* Product Title & Share */}
                {/* Product Title */}
                <div className={styles.productHeader}>
                  <h1 className={styles.productTitle}>
                    <span>{displayProduct.name}</span>
                  </h1>
                </div>

                {/* Rating & Size Guide Row (Extreme Right) */}
                <div className={styles.ratingSizeGuideRow}>
                  {reviews.length > 0 ? (
                    <div
                      className={styles.productRating}
                      role="button"
                      tabIndex={0}
                      onClick={() => setShowRatingDetailsPopup(true)}
                      aria-label="View customer reviews"
                    >
                      <span className={styles.ratingScore}>{averageRating.toFixed(1)}</span>
                      <svg className={styles.ratingStarIcon} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                      </svg>
                      <span className={styles.ratingDivider} />
                      <span className={styles.ratingCount}>{reviews.length}</span>
                    </div>
                  ) : (
                    <div />
                  )}

                  {/* Size Guide Trigger on Extreme Right */}
                  <button
                    type="button"
                    className={styles.sizeGuideTrigger}
                    onClick={() => setShowSizeGuideModal(true)}
                    aria-label="Open size guide"
                  >
                    <svg
                      className={styles.sizeGuideIcon}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z" />
                      <path d="m14.5 12.5 2-2" />
                      <path d="m11.5 9.5 2-2" />
                      <path d="m8.5 6.5 2-2" />
                      <path d="m17.5 15.5 2-2" />
                    </svg>
                    <span>Size Guide</span>
                  </button>
                </div>

                {/* Stock status */}
                <div className={styles.stockStatusMobileOnly}>{renderStockStatus()}</div>

                {/* Price */}
                <div className={styles.priceSection}>
                  <div className={styles.priceContainer}>
                    <div className={styles.singlePriceContainer}>
                      <span className={styles.currentPrice}>
                        ₹
                        <span
                          key={priceAnimKey}
                          className={`${styles.tDigitGroup} ${styles.isAnimating}`}
                          style={{ '--digit-dir-y': priceDirY } as React.CSSProperties}
                        >
                          {(animatedPrice !== null ? Math.round(animatedPrice).toString() : Math.round(unitPrice).toString())
                            .split('')
                            .map((char, index) => (
                              <span
                                key={index}
                                className={styles.tDigit}
                                style={{ animationDelay: `${index * 12}ms` }}
                              >
                                {char}
                              </span>
                            ))}
                        </span>
                      </span>
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
                  {/* Variations / Customizable Options Selector */}
                  {(displayProduct.isCustomizable || (displayProduct.customizationOptions && displayProduct.customizationOptions.length > 0)) && displayProduct.customizationOptions && displayProduct.customizationOptions.length > 0 ? (
                    <div className={styles.customizationContainer}>
                      {displayProduct.customizationOptions.map((g, idx) => {
                        const enabled = isGroupEnabled(idx);
                        const groupTitle = g.title || (g as any).name || (g as any).groupTitle || (g as any).label || 'Option';
                        const selectedValueId = selectedCustomizations[g.id];
                        const selectedValueObj = (g.values || []).find((val) => val.id === selectedValueId);
                        const selectedValueName = selectedValueObj?.name || '';
                        const groupType = g.type;

                        if (groupType === 'uploads') {
                          if (!enabled) return null;
                          return (
                            <div key={g.id} className={`${styles.customizationGroup} ${!enabled ? styles.customizationGroupLocked : ''}`}>
                              <div className={styles.groupHeader}>
                                <span className={styles.groupTitle}>{groupTitle}</span>
                                <span className={styles.groupHeaderSeparator}>:</span>
                                {(() => {
                                  const uploadText = printUploadCompleted
                                    ? `${uploadedPrintItems.length} Images Uploaded`
                                    : 'Choose images to upload';
                                  return (
                                    <span
                                      key={uploadText}
                                      className={`${styles.selectedValueText} ${styles.tDigitGroup} ${styles.isAnimating}`}
                                      style={
                                        {
                                          '--digit-dir-y': 1,
                                          '--digit-distance': '5px',
                                          '--digit-blur': '2.5px',
                                          '--digit-dur': '160ms',
                                        } as React.CSSProperties
                                      }
                                    >
                                      {uploadText.split('').map((char, index) => (
                                        <span
                                          key={index}
                                          className={styles.tDigit}
                                          style={{ animationDelay: `${index * 12}ms` }}
                                        >
                                          {char}
                                        </span>
                                      ))}
                                    </span>
                                  );
                                })()}
                              </div>
                              <button
                                type="button"
                                className={`${styles.uploadImagesButton} ${printUploadCompleted ? styles.uploadImagesButtonEdit : ''} ${enabled ? styles.blurItemAnimate : ''}`}
                                onClick={() => setIsPrintUploadOpen(true)}
                              >
                                {printUploadCompleted ? (
                                  <EditUploadedImagesButtonIcon className={styles.uploadImagesButtonIcon} />
                                ) : (
                                  <UploadImagesButtonIcon className={styles.uploadImagesButtonIcon} />
                                )}
                                <span>{printUploadCompleted ? 'Edit uploaded Images' : 'Upload Images'}</span>
                              </button>
                            </div>
                          );
                        }

                        if (groupType === 'text_input') {
                          return (
                            <div key={g.id} className={`${styles.customizationGroup} ${!enabled ? styles.customizationGroupLocked : ''}`}>
                              <div className={styles.groupHeader}>
                                <span className={styles.groupTitle}>{groupTitle}</span>
                              </div>
                              <div className={styles.textInputGroup}>
                                {(g.values || []).map((v, vIdx) => {
                                  const key = `${g.id}_${v.id}`;
                                  const val = textPersonalizations[key] || '';
                                  return (
                                    <div
                                      key={`${v.id}_${enabled}`}
                                      className={enabled ? styles.blurItemAnimate : ''}
                                      style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px',
                                        width: '100%',
                                        animationDelay: `${vIdx * 50}ms`,
                                      }}
                                    >
                                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>{v.name}</label>
                                      <input
                                        type="text"
                                        className={styles.pincodeInput}
                                        placeholder={`Enter ${v.name.toLowerCase()}`}
                                        value={val}
                                        disabled={!enabled}
                                        onChange={(e) => {
                                          const newText = e.target.value;
                                          setTextPersonalizations((prev) => ({ ...prev, [key]: newText }));
                                          setTextPersonalizationDone((prev) => ({ ...prev, [key]: newText.trim().length > 0 }));
                                        }}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }

                        if (groupType === 'image_selector' || (groupType as any) === 'image') {
                          return (
                            <div key={g.id} className={`${styles.customizationGroup} ${!enabled ? styles.customizationGroupLocked : ''}`}>
                              <div className={styles.groupHeader}>
                                <span className={styles.groupTitle}>{groupTitle}</span>
                                {selectedValueName && (
                                  <>
                                    <span className={styles.groupHeaderSeparator}>:</span>
                                    <span className={styles.selectedValueText}>{selectedValueName}</span>
                                  </>
                                )}
                              </div>
                              <div className={styles.imageSelectorGrid}>
                                {(g.values || []).map((val, vIdx) => {
                                  const isSelected = selectedValueId === val.id;
                                  return (
                                    <button
                                      key={`${val.id}_${enabled}`}
                                      type="button"
                                      disabled={!enabled}
                                      className={`${styles.imageSelectorCard} ${isSelected ? styles.imageSelectorCardActive : ''} ${!enabled ? styles.disabled : styles.blurItemAnimate}`}
                                      style={{ animationDelay: `${vIdx * 50}ms` }}
                                      onClick={() => {
                                        handleSelectCustomizationOption(g.id, val.id, idx);
                                      }}
                                    >
                                      {(val as any).imageUrl && (
                                        <img src={(val as any).imageUrl} alt={val.name} className={styles.imageSelectorThumbnail} />
                                      )}
                                      <span className={styles.imageSelectorLabel}>{val.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }

                        if (groupType === 'colour_palette' || (groupType as any) === 'color') {
                          return (
                            <div key={g.id} className={`${styles.customizationGroup} ${!enabled ? styles.customizationGroupLocked : ''}`}>
                              <div className={styles.groupHeader}>
                                <span className={styles.groupTitle}>{groupTitle}</span>
                                {selectedValueName && (
                                  <>
                                    <span className={styles.groupHeaderSeparator}>:</span>
                                    <span className={styles.selectedValueText}>{selectedValueName}</span>
                                  </>
                                )}
                              </div>
                              <div className={styles.colorSelectorPalette}>
                                {(g.values || []).map((val, vIdx) => {
                                  const isSelected = selectedValueId === val.id;
                                  return (
                                    <button
                                      key={`${val.id}_${enabled}`}
                                      type="button"
                                      disabled={!enabled}
                                      style={{ backgroundColor: (val as any).colorHex || '#ccc', animationDelay: `${vIdx * 40}ms` }}
                                      className={`${styles.colorSwatch} ${isSelected ? styles.colorSwatchActive : ''} ${!enabled ? styles.disabled : styles.blurItemAnimate}`}
                                      title={val.name}
                                      onClick={() => {
                                        handleSelectCustomizationOption(g.id, val.id, idx);
                                      }}
                                    >
                                      <span className="sr-only">{val.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={g.id} className={`${styles.customizationGroup} ${!enabled ? styles.customizationGroupLocked : ''}`}>
                            <div className={styles.groupHeader}>
                              <span className={styles.groupTitle}>{groupTitle}</span>
                              {selectedValueName && (
                                <>
                                  <span className={styles.groupHeaderSeparator}>:</span>
                                  <span
                                    key={selectedValueName}
                                    className={`${styles.selectedValueText} ${styles.tDigitGroup} ${styles.isAnimating}`}
                                    style={
                                      {
                                        '--digit-dir-y': 1,
                                        '--digit-distance': '5px',
                                        '--digit-blur': '2.5px',
                                        '--digit-dur': '160ms',
                                      } as React.CSSProperties
                                    }
                                  >
                                    {removePriceFromName(selectedValueName).split('').map((char, index) => (
                                      <span
                                        key={index}
                                        className={styles.tDigit}
                                        style={{ animationDelay: `${index * 12}ms` }}
                                      >
                                        {char}
                                      </span>
                                    ))}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className={styles.variationsGrid}>
                              {(g.values || []).map((val, vIdx) => {
                                const isSelected = selectedValueId === val.id;
                                return (
                                  <button
                                    key={`${val.id}_${enabled}`}
                                    type="button"
                                    disabled={!enabled}
                                    className={`${styles.variationButton} ${isSelected ? styles.variationActive : ''} ${!enabled ? styles.variationDisabled : styles.blurItemAnimate}`}
                                    style={{ animationDelay: `${vIdx * 50}ms` }}
                                    onClick={() => {
                                      handleSelectCustomizationOption(g.id, val.id, idx);
                                    }}
                                  >
                                    {val.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    variations.length > 0 && (
                      <div className={styles.variationPicker}>
                        <div className={styles.variationRow}>
                          <div className={styles.variationLabel}>
                            <span>{(displayProduct as any).variationGroupTitle || (displayProduct as any).variationTitle || (displayProduct as any).variationLabel || 'Size / Style'}</span>
                            {selectedVariation && (
                              <>
                                <span className={styles.groupHeaderSeparator}>:</span>
                                <span
                                  key={selectedVariation.id}
                                  className={`${styles.selectedValueText} ${styles.tDigitGroup} ${styles.isAnimating}`}
                                  style={
                                    {
                                      '--digit-dir-y': 1,
                                      '--digit-distance': '5px',
                                      '--digit-blur': '2.5px',
                                      '--digit-dur': '160ms',
                                    } as React.CSSProperties
                                  }
                                >
                                  {removePriceFromName(selectedVariation.size).split('').map((char, index) => (
                                    <span
                                      key={index}
                                      className={styles.tDigit}
                                      style={{ animationDelay: `${index * 12}ms` }}
                                    >
                                      {char}
                                    </span>
                                  ))}
                                </span>
                              </>
                            )}
                          </div>
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
                    )
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
                    <button
                      type="button"
                      className={`${styles.actionFavoriteButton} ${isFavorite ? styles.actionFavoriteButtonActive : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isFavorite) triggerSparkleBurst(e.currentTarget);
                        handleToggleFavorite();
                      }}
                      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <svg
                        className={styles.actionFavoriteIcon}
                        viewBox="0 0 24 24"
                        fill={isFavorite ? '#af5d6a' : 'none'}
                        stroke="#af5d6a"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                    </button>
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

                  {/* Delivery availability hyperlink - shown below action buttons */}
                  {!isTrialMode && (
                    <>
                      <button
                        type="button"
                        className={`${styles.deliveryCheckLink} ${pincode.length === 6 && isPincodeAvailable === true
                          ? styles.deliveryCheckLinkSuccess
                          : pincode.length === 6 && isPincodeAvailable === false
                            ? styles.deliveryCheckLinkError
                            : ''
                          }`}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('milko:open-pincode-modal'));
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor" />
                        </svg>
                        {isCheckingPincode
                          ? `Checking delivery for ${pincode}...`
                          : isPincodeAvailable === true && pincode.length === 6
                            ? `Delivery available to ${deliveryDetails?.locationLabel || 'your location'} (${pincode})`
                            : isPincodeAvailable === false && pincode.length === 6
                              ? `Delivery unavailable to ${deliveryDetails?.locationLabel || 'your location'} (${pincode})`
                              : 'Check delivery availability & estimated arrival'}
                      </button>

                      {pincode.length === 6 && isPincodeAvailable === true && (
                        <div className={styles.deliveryEstimatedText}>
                          <span>Estimated delivery: <strong>{deliveryDetails?.deliveryTimeText || displayProduct.deliveryTimeText || '3-5 Days'}</strong></span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Description */}
                {Boolean(displayProduct.description && displayProduct.description.replace(/<[^>]*>/g, '').trim().length > 0) && (
                  <div className={styles.descriptionSection}>
                    <div className={styles.descriptionTitle}>About Product</div>
                    <div
                      className={styles.descriptionContent}
                      dangerouslySetInnerHTML={{ __html: toSafeHtml(displayProduct.description || '') }}
                    />
                  </div>
                )}

                {/* Accordions */}
                <div className={styles.accordionContainer}>
                  {effectiveAccordionItems.map((item, idx) => {
                    const isOpen = openAccordionIndex === idx;
                    return (
                      <div key={idx} className={styles.accordionItem}>
                        <button
                          type="button"
                          className={styles.accordionHeader}
                          onClick={() => setOpenAccordionIndex(isOpen ? null : idx)}
                        >
                          <span className={styles.accordionTitle}>{item.title}</span>
                          <svg
                            className={`${styles.accordionChevron} ${isOpen ? styles.accordionChevronOpen : ''}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <div className={`${styles.accordionContentWrapper} ${isOpen ? styles.accordionContentWrapperOpen : ''}`}>
                          <div
                            className={styles.accordionContent}
                            dangerouslySetInnerHTML={{ __html: toSafeHtml(item.content) }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Customer Reviews Container */}
              <div className={styles.reviewSummarySection} ref={reviewSummaryRef}>
                <h3 className={styles.reviewSummaryTitle}>
                  Customer Reviews
                </h3>

                <div className={styles.reviewSummaryContent}>
                  {/* Left Column: Rating score + star + subtitle + button */}
                  <div className={styles.reviewSummaryLeft}>
                    <div className={styles.ratingCardNumberRow}>
                      <span className={styles.ratingCardNumber}>{averageRating.toFixed(1)}</span>
                      <svg className={styles.ratingCardStar} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                      </svg>
                    </div>
                    <div className={styles.ratingCardCount}>
                      Based on {reviews.length || 1} {reviews.length === 1 ? 'review' : 'reviews'}
                    </div>
                    <button
                      type="button"
                      className={styles.showMoreButton}
                      onClick={() => setShowRatingDetailsPopup(true)}
                    >
                      Show more
                    </button>
                  </div>

                  {/* Right Column: 5-star distribution progress bars */}
                  <div className={styles.reviewSummaryRightTop}>
                    <div className={styles.ratingDistribution}>
                      {[5, 4, 3, 2, 1].map((stars) => {
                        const count = ratingCounts[stars as 1 | 2 | 3 | 4 | 5] || 0;
                        const total = Math.max(1, reviews.length || 1);
                        const percent = Math.round((count / total) * 100);

                        return (
                          <div key={stars} className={styles.ratingBarRow}>
                            <div className={styles.ratingBarLabel}>
                              {stars} ★
                            </div>
                            <div className={styles.ratingBarContainer}>
                              <div
                                className={styles.ratingBar}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <div className={styles.ratingBarCount}>{count}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detail Banner Images - Full width above Related Products */}
      {(displayProduct.detailBanners || (displayProduct as any).detail_banners) && (
        <div className={isFlatPage ? styles.flatPageExtras : undefined} style={{ marginTop: '2rem' }}>
          <ProductDetailBanners banners={displayProduct.detailBanners || (displayProduct as any).detail_banners} />
        </div>
      )}

      {/* Related Products - Rendered in its own container at the bottom of the page */}
      {!loadingDetails && relatedProducts.length > 0 && (
        <div className={isFlatPage ? styles.flatPageExtras : undefined} style={{ marginTop: '2.5rem' }}>
          <div className={styles.relatedSection}>
            <h3 className={styles.relatedHeading}>More Good Stuff</h3>
            <div className={`${cardStyles.productsGrid} ${styles.relatedGrid}`}>
              {relatedProducts.map((rel) => {
                const categoryLabel = (rel.categoryId ? categoryMap.get(String(rel.categoryId)) : undefined) || 'Collection';
                const isOutOfStock = (rel.quantity ?? 0) <= 0;
                const displayPrice = getCardPriceDisplay(rel);
                const ratingVal = getAverageProductRating(rel);
                const hasRating = getProductReviewCount(rel) > 0;
                const imageUrl = getPrimaryProductImageUrl(rel) || '';

                return (
                  <Link
                    key={rel.id}
                    href={`/product/${rel.id}`}
                    className={`${cardStyles.productCard} ${isOutOfStock ? cardStyles.productCardOutOfStock : ''}`}
                    onClick={() => onRelatedProductClick?.(rel)}
                  >
                    <div className={cardStyles.productImage} style={imageUrl ? { aspectRatio: 'auto' } : undefined}>
                      {isOutOfStock && (
                        <div className={cardStyles.outOfStockBadge}>Out of stock</div>
                      )}
                      <ProductCardImage
                        src={imageUrl}
                        alt={rel.name}
                        hoverSrc={rel.hoverNextImage ? getOrderedProductImageUrls(rel)[1] : undefined}
                      />
                    </div>

                    <div className={cardStyles.productInfo}>
                      <div className={cardStyles.productTitleRow}>
                        <h4 className={cardStyles.productName}>{rel.name}</h4>
                        <span className={cardStyles.productPrice}>{displayPrice}</span>
                      </div>

                      <div className={cardStyles.productCategoryRow}>
                        <div className={cardStyles.productCategory}>
                          {categoryLabel}
                        </div>
                        <div className={cardStyles.productRatingCompact}>
                          <svg className={cardStyles.starIconSmall} style={{ color: hasRating ? '#ffc107' : '#cbd5e1' }} viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                          </svg>
                          <span style={{ color: hasRating ? 'inherit' : '#94a3b8' }}>
                            {hasRating ? ratingVal.toFixed(1) : '0.0'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

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

      {/* Fullscreen Image Zoom Lightbox Overlay */}
      {isImageZoomOpen && collageItems.length > 0 && typeof document !== 'undefined' && createPortal(
        <div
          className={styles.zoomOverlay}
          onClick={() => setIsImageZoomOpen(false)}
          onWheel={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className={styles.zoomCounter}>
            {selectedImageIndex + 1} / {collageItems.length}
          </div>

          <button
            type="button"
            className={styles.zoomClose}
            onClick={() => setIsImageZoomOpen(false)}
            aria-label="Close zoomed image"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {collageItems.length > 1 && (
            <>
              <button
                type="button"
                className={`${styles.zoomNav} ${styles.zoomNavLeft}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : collageItems.length - 1));
                  setZoomScale(1);
                  setZoomPan({ x: 0, y: 0 });
                }}
                aria-label="Previous image"
              >
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 12H20M4 12L8 8M4 12L8 16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                className={`${styles.zoomNav} ${styles.zoomNavRight}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImageIndex((prev) => (prev < collageItems.length - 1 ? prev + 1 : 0));
                  setZoomScale(1);
                  setZoomPan({ x: 0, y: 0 });
                }}
                aria-label="Next image"
              >
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 12H4M20 12L16 8M20 12L16 16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}

          <div
            className={styles.zoomImageWrap}
            onClick={(e) => {
              e.stopPropagation();
              if (hasZoomMovedRef.current) {
                hasZoomMovedRef.current = false;
                return;
              }
              if (zoomScale === 1) {
                setZoomScale(2.2);
              } else {
                setZoomScale(1);
                setZoomPan({ x: 0, y: 0 });
              }
            }}
            onMouseDown={(e) => {
              hasZoomMovedRef.current = false;
              if (zoomScale > 1) {
                e.preventDefault();
                setIsZoomDragging(true);
                zoomDragStartRef.current = {
                  x: e.clientX,
                  y: e.clientY,
                  panX: zoomPan.x,
                  panY: zoomPan.y,
                };
              }
            }}
            onMouseMove={(e) => {
              if (isZoomDragging && zoomScale > 1) {
                const dx = e.clientX - zoomDragStartRef.current.x;
                const dy = e.clientY - zoomDragStartRef.current.y;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                  hasZoomMovedRef.current = true;
                }
                setZoomPan({
                  x: zoomDragStartRef.current.panX + dx,
                  y: zoomDragStartRef.current.panY + dy,
                });
              }
            }}
            onMouseUp={() => setIsZoomDragging(false)}
            onMouseLeave={() => setIsZoomDragging(false)}
            onTouchStart={(e) => {
              hasZoomMovedRef.current = false;
              if (zoomScale > 1 && e.touches.length === 1) {
                setIsZoomDragging(true);
                zoomDragStartRef.current = {
                  x: e.touches[0].clientX,
                  y: e.touches[0].clientY,
                  panX: zoomPan.x,
                  panY: zoomPan.y,
                };
              }
            }}
            onTouchMove={(e) => {
              if (isZoomDragging && zoomScale > 1 && e.touches.length === 1) {
                const dx = e.touches[0].clientX - zoomDragStartRef.current.x;
                const dy = e.touches[0].clientY - zoomDragStartRef.current.y;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                  hasZoomMovedRef.current = true;
                }
                setZoomPan({
                  x: zoomDragStartRef.current.panX + dx,
                  y: zoomDragStartRef.current.panY + dy,
                });
              }
            }}
            onTouchEnd={() => setIsZoomDragging(false)}
            style={{
              position: 'relative',
              width: '85vw',
              height: '85vh',
              cursor: zoomScale > 1 ? (isZoomDragging ? 'grabbing' : 'grab') : 'zoom-in',
              userSelect: 'none',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                transform: `translate(${zoomPan.x}px, ${zoomPan.y}px) scale(${zoomScale})`,
                transition: isZoomDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                transformOrigin: 'center center',
                willChange: 'transform',
              }}
            >
              <Image
                src={collageItems[selectedImageIndex]}
                alt={`${displayProduct.name} zoomed`}
                fill
                style={{ objectFit: 'contain', pointerEvents: 'none' }}
                sizes="100vw"
                priority
                draggable={false}
              />
            </div>
          </div>

          <div className={styles.zoomControls}>
            <button
              type="button"
              className={styles.zoomControlBtn}
              onClick={(e) => {
                e.stopPropagation();
                setZoomScale((s) => {
                  const next = Math.max(1, +(s - 0.5).toFixed(2));
                  if (next === 1) setZoomPan({ x: 0, y: 0 });
                  return next;
                });
              }}
              disabled={zoomScale <= 1}
              aria-label="Zoom out"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>
            <span className={styles.zoomScaleText}>{Math.round(zoomScale * 100)}%</span>
            <button
              type="button"
              className={styles.zoomControlBtn}
              onClick={(e) => {
                e.stopPropagation();
                setZoomScale((s) => Math.min(4, +(s + 0.5).toFixed(2)));
              }}
              disabled={zoomScale >= 4}
              aria-label="Zoom in"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>
          </div>
        </div>,
        document.body
      )}
      {/* Customer Reviews & Rating Popup Modal */}
      {showRatingDetailsPopup && typeof document !== 'undefined' && createPortal(
        <div
          className={styles.reviewsPopupOverlay}
          onClick={() => setShowRatingDetailsPopup(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Customer reviews"
        >
          <div
            className={styles.reviewsPopupPanel}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <div className={styles.reviewsPopupHeader}>
              <h3 className={styles.reviewsPopupTitle}>Customer Reviews ({reviews.length})</h3>
              <button
                type="button"
                className={styles.reviewsPopupClose}
                onClick={() => setShowRatingDetailsPopup(false)}
                aria-label="Close reviews"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className={styles.reviewsPopupScroll}>
              <div className={styles.ratingDetailsMeter}>
                <div className={styles.ratingMetersRow}>
                  {renderSingleRatingMeter(feedback?.qualityStars, 'quality', 'Quality of the product', ratingMeterAnimateIn)}
                  {renderSingleRatingMeter(feedback?.onTimeStars, 'on-time', 'On time delivery', ratingMeterAnimateIn)}
                  {renderSingleRatingMeter(feedback?.valueForMoneyStars, 'value', 'Value for money', ratingMeterAnimateIn)}
                </div>
              </div>

              {reviews.length > 0 ? (
                <div className={styles.reviewsList}>
                  {reviews.map((review) => {
                    const reviewerInitial = (review.reviewerName || 'C').charAt(0).toUpperCase();
                    return (
                      <article key={review.id} className={styles.reviewItem}>
                        <div className={styles.reviewHeader}>
                          <div className={styles.reviewerInfo}>
                            <div className={styles.reviewerAvatarWrap}>
                              <div className={styles.reviewerAvatar} aria-hidden="true">
                                {reviewerInitial}
                              </div>
                              <span className={styles.reviewerVerifiedBadge} tabIndex={0} aria-label="Verified customer">
                                <span className={styles.reviewerVerifiedTooltip} role="tooltip">
                                  Verified customer
                                </span>
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                  <path
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                    d="M9.5924 3.20027C9.34888 3.4078 9.22711 3.51158 9.09706 3.59874C8.79896 3.79854 8.46417 3.93721 8.1121 4.00672C7.95851 4.03705 7.79903 4.04977 7.48008 4.07522C6.6787 4.13918 6.278 4.17115 5.94371 4.28923C5.17051 4.56233 4.56233 5.17051 4.28923 5.94371C4.17115 6.278 4.13918 6.6787 4.07522 7.48008C4.04977 7.79903 4.03705 7.95851 4.00672 8.1121C3.93721 8.46417 3.79854 8.79896 3.59874 9.09706C3.51158 9.22711 3.40781 9.34887 3.20027 9.5924C2.67883 10.2043 2.4181 10.5102 2.26522 10.8301C1.91159 11.57 1.91159 12.43 2.26522 13.1699C2.41811 13.4898 2.67883 13.7957 3.20027 14.4076C3.40778 14.6511 3.51158 14.7729 3.59874 14.9029C3.79854 15.201 3.93721 15.5358 4.00672 15.8879C4.03705 16.0415 4.04977 16.201 4.07522 16.5199C4.13918 17.3213 4.17115 17.722 4.28923 18.0563C4.56233 18.8295 5.17051 19.4377 5.94371 19.7108C6.278 19.8288 6.6787 19.8608 7.48008 19.9248C7.79903 19.9502 7.95851 19.963 8.1121 19.9933C8.46417 20.0628 8.79896 20.2015 9.09706 20.4013C9.22711 20.4884 9.34887 20.5922 9.5924 20.7997C10.2043 21.3212 10.5102 21.5819 10.8301 21.7348C11.57 22.0884 12.43 22.0884 13.1699 21.7348C13.4898 21.5819 13.7957 21.3212 14.4076 20.7997C14.6511 20.5922 14.7729 20.4884 14.9029 20.4013C15.201 20.2015 15.5358 20.0628 15.8879 19.9933C16.0415 19.963 16.201 19.9502 16.5199 19.9248C17.3213 19.8608 17.722 19.8288 18.0563 19.7108C18.8295 19.4377 19.4377 18.8295 19.7108 18.0563C19.8288 17.722 19.8608 17.3213 19.9248 16.5199C19.9502 16.201 19.963 16.0415 19.9933 15.8879C20.0628 15.5358 20.2015 15.201 20.4013 14.9029C20.4884 14.7729 20.5922 14.6511 20.7997 14.4076C21.3212 13.7957 21.5819 13.4898 21.7348 13.1699C22.0884 12.43 22.0884 11.57 21.7348 10.8301C21.5819 10.5102 21.3212 10.2043 20.7997 9.5924C20.5922 9.34887 20.4884 9.22711 20.4013 9.09706C20.2015 8.79896 20.0628 8.46417 19.9933 8.1121C19.963 7.95851 19.9502 7.79903 19.9248 7.48008C19.8608 6.6787 19.8288 6.278 19.7108 5.94371C19.4377 5.17051 18.8295 4.56233 18.0563 4.28923C17.722 4.17115 17.3213 4.13918 16.5199 4.07522C16.201 4.04977 16.0415 4.03705 15.8879 4.00672C15.5358 3.93721 15.201 3.79854 14.9029 3.59874C14.7729 3.51158 14.6511 3.40781 14.4076 3.20027C13.7957 2.67883 13.4898 2.41811 13.1699 2.26522C12.43 1.91159 11.57 1.91159 10.8301 2.26522C10.5102 2.4181 10.2043 2.67883 9.5924 3.20027ZM16.3735 9.86314C16.6913 9.5453 16.6913 9.03 16.3735 8.71216C16.0557 8.39433 15.5403 8.39433 15.2225 8.71216L10.3723 13.5624L8.77746 11.9676C8.45963 11.6498 7.94432 11.6498 7.62649 11.9676C7.30866 12.2854 7.30866 12.8007 7.62649 13.1186L9.79678 15.2889C10.1146 15.6067 10.6299 15.6067 10.9478 15.2889L16.3735 9.86314Z"
                                    fill="#0071e9"
                                  />
                                </svg>
                              </span>
                            </div>
                            <div className={styles.reviewerName}>{review.reviewerName}</div>
                          </div>
                          {renderReviewStars(review.rating)}
                        </div>
                        {review.comment ? (
                          <p className={styles.reviewText}>{review.comment}</p>
                        ) : null}
                        <time className={styles.reviewDate} dateTime={review.createdAt}>
                          {formatReviewRelativeDate(review.createdAt)}
                        </time>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.reviewsPopupEmptyState}>
                  <p className={styles.reviewsPopupEmpty}>No customer reviews yet. Be the first to share your experience after delivery.</p>
                </div>
              )}
            </div>

            {(trustpilotUrl || googleReviewUrl) && (
              <div className={styles.reviewsPopupStickyFooter}>
                {trustpilotUrl && (
                  <a
                    href={trustpilotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.trustpilotBtn}
                  >
                    <svg fill="#00b67a" viewBox="0 0 24 24" width="17" height="17" role="img" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                      <title>Trustpilot icon</title>
                      <path d="M12,17.964l5.214-1.321l2.179,6.714L12,17.964z M24,9.286h-9.179L12,0.643L9.179,9.286 H0l7.429,5.357l-2.821,8.643l7.429-5.357l4.571-3.286L24,9.286L24,9.286L24,9.286L24,9.286z" />
                    </svg>
                    <span>Review on Trustpilot</span>
                  </a>
                )}
                {googleReviewUrl && (
                  <a
                    href={googleReviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.googleBtn}
                  >
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                      <title>Google icon</title>
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                    </svg>
                    <span>Review on Google</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Size Guide Modal Popup */}
      {showSizeGuideModal && typeof document !== 'undefined' && createPortal(
        <div
          className={styles.reviewsPopupOverlay}
          onClick={() => setShowSizeGuideModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Size guide"
        >
          <div
            className={styles.sizeGuideModalPanel}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <div className={styles.reviewsPopupHeader}>
              <div className={styles.sizeGuideHeaderLeft}>
                <h3 className={styles.sizeGuideModalTitle}>Size Guide</h3>
                <p className={styles.sizeGuideModalSubtitle}>All measurements are in inches</p>
              </div>
              <button
                type="button"
                className={styles.reviewsPopupClose}
                onClick={() => setShowSizeGuideModal(false)}
                aria-label="Close size guide"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {displayProduct?.sizeGuide?.type === 'image' && displayProduct?.sizeGuide?.imageUrl ? (
              <div className={styles.sizeGuideImageWrap}>
                <img
                  src={displayProduct.sizeGuide.imageUrl}
                  alt={`${displayProduct.name} Size Guide`}
                  className={styles.sizeGuideImg}
                />
              </div>
            ) : (
              <div className={styles.sizeGuideTableWrap}>
                <table className={styles.sizeGuideTable}>
                  <thead>
                    <tr>
                      <th>Size</th>
                      <th>Bust</th>
                      <th>Waist</th>
                      <th>Hip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(displayProduct?.sizeGuide?.tableRows && displayProduct.sizeGuide.tableRows.length > 0
                      ? displayProduct.sizeGuide.tableRows
                      : [
                        { size: 'XS', bust: '32"', waist: '25"', hip: '35"' },
                        { size: 'S', bust: '34"', waist: '27"', hip: '37"' },
                        { size: 'M', bust: '36"', waist: '29"', hip: '39"' },
                        { size: 'L', bust: '38"', waist: '31"', hip: '41"' },
                        { size: 'XL', bust: '40"', waist: '33"', hip: '43"' },
                        { size: 'XXL', bust: '42"', waist: '35"', hip: '45"' },
                      ]
                    ).map((row, idx) => (
                      <tr key={idx}>
                        <td className={styles.sizeBadge}>{row.size}</td>
                        <td>{row.bust}</td>
                        <td>{row.waist}</td>
                        <td>{row.hip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className={styles.sizeGuideMeasureGuide}>
              <h4 className={styles.measureGuideTitle}>How to Measure</h4>
              <div className={styles.measureGuideItems}>
                <div className={styles.measureGuideItem}>
                  <strong>Bust:</strong> Measure around the fullest part of your bust, keeping the tape level.
                </div>
                <div className={styles.measureGuideItem}>
                  <strong>Waist:</strong> Measure around the narrowest point of your natural waistline.
                </div>
                <div className={styles.measureGuideItem}>
                  <strong>Hip:</strong> Stand with feet together and measure around the fullest part of your hips.
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
