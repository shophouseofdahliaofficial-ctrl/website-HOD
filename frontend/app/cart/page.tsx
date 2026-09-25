'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((m) => m.DotLottieReact),
  { ssr: false }
);
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  readSubscriptionCartJson,
  clearSubscriptionCart,
  scopedSubscriptionCartKey,
  scopedCartKey,
} from '@/lib/utils/userScopedStorage';
import { productsApi, couponsApi, contentApi } from '@/lib/api';
import type { Coupon } from '@/lib/api';
import { Product } from '@/types';
import { CartItem } from '@/lib/utils/cart';
import {
  getCartItemCheckoutLineLabel,
  getCartItemOrderSubtotalContribution,
  getCartItemPriceDetails,
  getCartItemPriceLineAmount,
  getPhotoboothCartProject,
  getPhotoboothPrintsLabel,
  shouldShowCartPriceLine,
} from '@/lib/utils/cartPricing';
import ProductDetailsModal from '@/components/ProductDetailsModal';
import { saveCheckoutCouponCode } from '@/lib/utils/checkoutCoupon';
import { useToast } from '@/contexts/ToastContext';
import { getPrimaryProductImageUrl } from '@/lib/utils/productImages';
import CouponModal from '@/components/CouponModal';
import styles from './cart.module.css';
import productCardStyles from '@/components/ProductsSection.module.css';

type SubscriptionCartItem = {
  type: 'subscription';
  productId: string;
  variationId?: string;
  productName: string;
  litresPerDay: number;
  durationMonths: number;
  durationDays?: number;
  deliveryTime: string;
  totalAmount: number;
  updatedAt: string;
};

const getPhotobookCartProject = (it: CartItem) => {
  if (!it?.customizations) return null;
  return (
    it.customizations.photobookProject ||
    it.customizations.photobook ||
    (it.customizations.photobookProjectId ? { id: it.customizations.photobookProjectId } : null)
  );
};

export default function CartPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();
  const subCartUserId = user?.id ?? null;
  const { items, setItemQuantity, removeItem, refreshCart } = useCart();
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [appliedCouponData, setAppliedCouponData] = useState<Coupon | null>(null);
  const [couponValidationStatus, setCouponValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [subscriptionCartItem, setSubscriptionCartItem] = useState<SubscriptionCartItem | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [platformFee, setPlatformFee] = useState(0);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [photoboothSettings, setPhotoboothSettings] = useState<any>(null);
  const [coverProducts, setCoverProducts] = useState<Record<string, Product>>({});

  useEffect(() => {
    contentApi.getByType('photobooth_links')
      .then((data) => {
        if (data && data.metadata) {
          setPhotoboothSettings(data.metadata);
          
          const fetchCovers = async () => {
            const productMap: Record<string, Product> = {};
            const coverIds = [
              data.metadata.polaroidsCoverProductId,
              data.metadata.photostripsCoverProductId
            ].filter(Boolean);
            
            await Promise.all(
              coverIds.map(async (id) => {
                try {
                  const p = await productsApi.getById(String(id), true);
                  productMap[String(id)] = p;
                } catch (err) {
                  console.error(`Failed to fetch cover product ${id}:`, err);
                }
              })
            );
            setCoverProducts(productMap);
          };
          fetchCovers();
        }
      })
      .catch((err) => console.error('Failed to load photobooth settings:', err));
  }, []);

  // Gift wrap states
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [isGiftModalClosing, setIsGiftModalClosing] = useState(false);
  const [giftSelectedProductKey, setGiftSelectedProductKey] = useState('');
  const [giftComment, setGiftComment] = useState('');
  const [tempWrappedItems, setTempWrappedItems] = useState<{ itemKey: string; comment: string }[]>([]);

  const modalContentRef = useRef<HTMLDivElement>(null);
  const [modalHeight, setModalHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!isGiftModalOpen || !modalContentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
        if (h > 0) {
          setModalHeight(Math.round(h));
        }
      }
    });
    observer.observe(modalContentRef.current);
    return () => observer.disconnect();
  }, [isGiftModalOpen, tempWrappedItems, giftSelectedProductKey]);

  const handleCloseGiftModal = () => {
    if (isGiftModalClosing) return;
    setIsGiftModalClosing(true);
    setTimeout(() => {
      setIsGiftModalOpen(false);
      setIsGiftModalClosing(false);
    }, 260);
  };
  useEffect(() => {
    const load = async () => {
      const ids = new Set(items.map((i) => i.productId));
      if (subscriptionCartItem?.productId) ids.add(subscriptionCartItem.productId);
      const unique = Array.from(ids);
      const entries = await Promise.all(
        unique.map(async (id) => {
          try {
            const p = await productsApi.getById(id, true);
            return [id, p] as const;
          } catch {
            return [id, null] as const;
          }
        })
      );
      const map: Record<string, Product> = {};
      for (const [id, p] of entries) {
        if (p) map[id] = p;
      }
      setProducts(map);
    };
    if (items.length || subscriptionCartItem) void load();
  }, [items, subscriptionCartItem]);

  const [giftingConfig, setGiftingConfig] = useState<{ enabled: boolean; price: number }>({ enabled: true, price: 25 });
  const [codConfig, setCodConfig] = useState<{ enabled: boolean }>({ enabled: true });

  useEffect(() => {
    const loadPlatformFee = async () => {
      try {
        const data = await contentApi.getByType('platform_fee');
        const metadataAmount = Number(data.metadata?.amount);
        const titleAmount = Number(data.title);
        const amount = Number.isFinite(metadataAmount) ? metadataAmount : titleAmount;
        setPlatformFee(Number.isFinite(amount) && amount > 0 ? amount : 0);
      } catch {
        setPlatformFee(0);
      }
    };

    const loadGiftingConfig = async () => {
      try {
        const data = await contentApi.getByType('gifting');
        if (data) {
          const price = Number(data.metadata?.price ?? (Number.isFinite(Number(data.title)) ? Number(data.title) : 25));
          const enabled = (data.metadata?.enabled !== undefined ? data.metadata.enabled === true : data.isActive) ?? true;
          const isActuallyActive = enabled && data.isActive !== false;
          setGiftingConfig({
            enabled: isActuallyActive,
            price: Number.isFinite(price) && price >= 0 ? price : 25,
          });
        }
      } catch {
        setGiftingConfig({ enabled: true, price: 25 });
      }
    };

    const loadCodConfig = async () => {
      try {
        const data = await contentApi.getByType('cod');
        if (data) {
          const enabled = (data.metadata?.enabled !== undefined ? data.metadata.enabled === true : data.isActive) ?? true;
          const isActuallyActive = enabled && data.isActive !== false;
          setCodConfig({ enabled: isActuallyActive });
        }
      } catch {
        setCodConfig({ enabled: true });
      }
    };

    loadPlatformFee();
    loadGiftingConfig();
    loadCodConfig();
  }, []);

  useEffect(() => {
    const loadSubscriptionItem = () => {
      try {
        const raw = readSubscriptionCartJson(subCartUserId);
        if (!raw) {
          setSubscriptionCartItem(null);
          return;
        }
        const parsed = JSON.parse(raw) as Partial<SubscriptionCartItem>;
        const hasDuration =
          (typeof parsed.durationDays === 'number' && parsed.durationDays >= 1) ||
          (typeof parsed.durationMonths === 'number' && parsed.durationMonths >= 1);
        if (
          parsed
          && parsed.type === 'subscription'
          && typeof parsed.productId === 'string'
          && typeof parsed.productName === 'string'
          && typeof parsed.litresPerDay === 'number'
          && hasDuration
          && typeof parsed.deliveryTime === 'string'
          && typeof parsed.totalAmount === 'number'
        ) {
          setSubscriptionCartItem(parsed as SubscriptionCartItem);
        } else {
          setSubscriptionCartItem(null);
        }
      } catch {
        setSubscriptionCartItem(null);
      }
    };
    loadSubscriptionItem();
    const onStorage = (e: StorageEvent) => {
      if (e.key === scopedSubscriptionCartKey(subCartUserId) || e.key === 'milko_subscription_cart_item_v1') {
        loadSubscriptionItem();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [subCartUserId]);

  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getCustomizationDescriptionParts = (it: CartItem, p?: Product | null) => {
    const descParts: string[] = [];

    // 1. Customizable product combinations
    if (p && p.isCustomizable && it.variationId) {
      const combo = (p.customizationCombinations || []).find((c) => String(c.id) === String(it.variationId));
      if (combo && combo.combinationKeys) {
        Object.keys(combo.combinationKeys).forEach((groupId) => {
          const valId = combo.combinationKeys[groupId];
          const group = (p.customizationOptions || []).find((g) => String(g.id) === String(groupId));
          const val = group ? (group.values || []).find((v) => String(v.id) === String(valId)) : null;
          if (group && val) {
            descParts.push(`${group.title}: ${val.name}`);
          }
        });
      }
    }

    // 2. Direct selectedOptions in customizations
    if (p && descParts.length === 0 && it.customizations?.selectedOptions && typeof it.customizations.selectedOptions === 'object') {
      const selectedOpts = it.customizations.selectedOptions;
      Object.keys(selectedOpts).forEach((groupId) => {
        const valId = selectedOpts[groupId];
        const group = (p.customizationOptions || []).find((g) => String(g.id) === String(groupId));
        const val = group ? (group.values || []).find((v) => String(v.id) === String(valId)) : null;
        if (group && val) {
          descParts.push(`${group.title}: ${val.name}`);
        }
      });
    }

    // 3. Standard variations in product.variations
    if (p && descParts.length === 0 && it.variationId) {
      const v = (p.variations || []).find((x) => String(x.id) === String(it.variationId));
      if (v?.size) {
        const trimmed = String(v.size).trim();
        const formatted = /^size\s*:/i.test(trimmed) || trimmed.includes(':') ? trimmed : `Size: ${trimmed}`;
        descParts.push(formatted);
      }
    }

    // 4. Fallback if variation size is stored directly in item or customizations
    if (descParts.length === 0) {
      const fallbackSize =
        (it as any).variationSize ||
        (it as any).size ||
        it.customizations?.size ||
        (it.customizations?.variation as any)?.size ||
        (it as any).variation?.size ||
        (it as any).variantName;
      if (fallbackSize) {
        const trimmed = String(fallbackSize).trim();
        const formatted = /^size\s*:/i.test(trimmed) || trimmed.includes(':') ? trimmed : `Size: ${trimmed}`;
        descParts.push(formatted);
      }
    }

    // 5. Text personalization
    if (p && it.customizations && it.customizations.textPersonalization) {
      const textPers = it.customizations.textPersonalization;
      (p.customizationOptions || []).forEach((group) => {
        if (group.type === 'text_input') {
          (group.values || []).forEach((val) => {
            const inputKey = `${group.id}_${val.id}`;
            const textVal = textPers[inputKey] || '';
            if (textVal.trim()) {
              descParts.push(`${val.label}: "${textVal.trim()}"`);
            }
          });
        }
      });
    }

    return descParts;
  };

  const getItemKey = (productId: string, variationId?: string, customizations?: any) => {
    return `${productId}:${variationId || ''}:${customizations ? JSON.stringify(customizations) : ''}`;
  };


  const handleQuantityChange = (productId: string, variationId: string | undefined, delta: number, customizations?: any) => {
    const item = items.find(it => it.productId === productId &&
      it.variationId === variationId &&
      JSON.stringify(it.customizations || {}) === JSON.stringify(customizations || {}));
    const product = products[productId];
    if (item) {
      const newQuantity = Math.max(1, item.quantity + delta);
      const result = setItemQuantity(productId, newQuantity, variationId, product?.maxQuantity, customizations);
      if (!result.ok && delta > 0 && product?.maxQuantity) {
        showToast(`Maximum order quantity is ${product.maxQuantity}`, 'error');
      }
    }
  };

  /** Same basis as checkout `itemsSubtotal` + subscription — coupons and totals match checkout. */
  const subtotalAlignedWithCheckout = useMemo(() => {
    const itemsPart = items.reduce((sum, it) => {
      const p = products[it.productId];
      if (!shouldShowCartPriceLine(it, p)) return sum;
      return sum + getCartItemOrderSubtotalContribution(it, p);
    }, 0);
    return itemsPart + (subscriptionCartItem?.totalAmount ?? 0);
  }, [items, products, subscriptionCartItem]);

  // Your total savings = sum of (compareAtPrice - sellingPrice) * mult * qty per item
  const savings = useMemo(() => {
    return items.reduce((sum, it) => {
      const p = products[it.productId];
      const { unitOff } = getCartItemPriceDetails(it, p);
      return sum + unitOff * it.quantity;
    }, 0);
  }, [items, products]);

  // Coupon discount from applied coupon
  const couponDiscount = useMemo(() => {
    if (!appliedCouponData) return 0;
    const c = appliedCouponData;
    let d = 0;
    if (c.discountType === 'percentage') {
      d = (subtotalAlignedWithCheckout * c.discountValue) / 100;
      if (c.maxDiscountAmount != null && d > c.maxDiscountAmount) d = c.maxDiscountAmount;
    } else {
      d = c.discountValue;
    }
    return Math.min(d, subtotalAlignedWithCheckout);
  }, [appliedCouponData, subtotalAlignedWithCheckout]);

  const displayedDeliveryCharges = 0;
  const total = subtotalAlignedWithCheckout - couponDiscount + platformFee;
  const totalItemCount = items.filter((it) => shouldShowCartPriceLine(it, products[it.productId])).length
    + (subscriptionCartItem ? 1 : 0);
  const hasAnyGiftWrap = items.some((it) => it.customizations?.giftWrap);
  const totalGiftWrapFee = items.reduce((sum, it) => {
    return sum + (it.customizations?.giftWrap ? it.customizations.giftWrap.price : 0);
  }, 0);

  const subscriptionCartLineTitle = useMemo(() => {
    if (!subscriptionCartItem) return '';
    const subProduct = products[subscriptionCartItem.productId];
    const subVariation = subscriptionCartItem.variationId && subProduct
      ? (subProduct.variations || []).find((x) => String(x.id) === String(subscriptionCartItem.variationId))
      : null;
    const base = `Plan for ${subscriptionCartItem.productName}`;
    return subVariation?.size ? `${base} [${subVariation.size}]` : base;
  }, [subscriptionCartItem, products]);

  const handleRemoveSubscriptionCartItem = () => {
    clearSubscriptionCart(subCartUserId);
    setSubscriptionCartItem(null);
  };

  const handleApplyCoupon = async (passedCode?: string) => {
    const code = (passedCode || couponCode).trim().toUpperCase();
    if (!code) return;
    setCouponCode(code);
    setValidatingCoupon(true);
    setCouponValidationStatus('idle');
    try {
      const coupon = await couponsApi.validate(code, subtotalAlignedWithCheckout);
      setAppliedCoupon(code);
      setAppliedCouponData(coupon);
      setCouponValidationStatus('valid');
      saveCheckoutCouponCode(code);
    } catch {
      setCouponValidationStatus('invalid');
      setAppliedCoupon(null);
      setAppliedCouponData(null);
      saveCheckoutCouponCode(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setAppliedCouponData(null);
    setCouponCode('');
    setCouponValidationStatus('idle');
    saveCheckoutCouponCode(null);
  };

  const handleOpenGiftModal = () => {
    const cartItemOptions = items.filter((it) => shouldShowCartPriceLine(it, products[it.productId]));
    if (cartItemOptions.length === 0) {
      showToast('Your cart is empty. Please add items to your cart before adding a gift wrap.', 'error');
      return;
    }

    const initialWrapped = items
      .filter(it => it.customizations?.giftWrap)
      .map(it => ({
        itemKey: getItemKey(it.productId, it.variationId, it.customizations),
        comment: it.customizations?.giftWrap?.comment || ''
      }));
    setTempWrappedItems(initialWrapped);

    const availableOptions = cartItemOptions.filter(opt => {
      const key = getItemKey(opt.productId, opt.variationId, opt.customizations);
      return !initialWrapped.some(w => w.itemKey === key);
    });

    if (availableOptions.length > 0) {
      const firstKey = getItemKey(availableOptions[0].productId, availableOptions[0].variationId, availableOptions[0].customizations);
      setGiftSelectedProductKey(firstKey);
    } else {
      setGiftSelectedProductKey('');
    }

    setGiftComment('');
    setIsGiftModalClosing(false);
    setIsGiftModalOpen(true);
  };

  const handleGiftProductChange = (key: string) => {
    setGiftSelectedProductKey(key);
  };

  const handleAddTempGiftWrap = () => {
    if (!giftSelectedProductKey) return;
    
    const newWrappedItem = {
      itemKey: giftSelectedProductKey,
      comment: giftComment.trim()
    };
    
    const nextWrapped = [...tempWrappedItems, newWrappedItem];
    setTempWrappedItems(nextWrapped);
    setGiftComment('');

    const cartItemOptions = items.filter((it) => shouldShowCartPriceLine(it, products[it.productId]));
    const nextAvailable = cartItemOptions.filter(opt => {
      const key = getItemKey(opt.productId, opt.variationId, opt.customizations);
      return !nextWrapped.some(w => w.itemKey === key);
    });

    if (nextAvailable.length > 0) {
      const nextKey = getItemKey(nextAvailable[0].productId, nextAvailable[0].variationId, nextAvailable[0].customizations);
      setGiftSelectedProductKey(nextKey);
    } else {
      setGiftSelectedProductKey('');
    }
  };

  const handleRemoveTempGiftWrap = (targetKey: string) => {
    const nextWrapped = tempWrappedItems.filter(x => x.itemKey !== targetKey);
    setTempWrappedItems(nextWrapped);

    if (!giftSelectedProductKey || giftSelectedProductKey === targetKey) {
      setGiftSelectedProductKey(targetKey);
    }

    const key = scopedCartKey(user?.id ?? null);
    let updatedAny = false;
    const updated = items.map(x => {
      const xKey = getItemKey(x.productId, x.variationId, x.customizations);
      if (xKey === targetKey && x.customizations?.giftWrap) {
        updatedAny = true;
        const nextCustomizations = { ...x.customizations };
        delete nextCustomizations.giftWrap;
        return {
          ...x,
          customizations: Object.keys(nextCustomizations).length > 0 ? nextCustomizations : undefined
        };
      }
      return x;
    });

    if (updatedAny) {
      localStorage.setItem(key, JSON.stringify(updated));
      refreshCart();
      showToast('Gift wrap removed', 'info');
    }
  };

  const handleEditTempGiftWrap = (targetKey: string) => {
    const targetItem = tempWrappedItems.find(x => x.itemKey === targetKey);
    if (!targetItem) return;

    const nextWrapped = tempWrappedItems.filter(x => x.itemKey !== targetKey);
    setTempWrappedItems(nextWrapped);

    setGiftSelectedProductKey(targetKey);
    setGiftComment(targetItem.comment);

    const key = scopedCartKey(user?.id ?? null);
    let updatedAny = false;
    const updated = items.map(x => {
      const xKey = getItemKey(x.productId, x.variationId, x.customizations);
      if (xKey === targetKey && x.customizations?.giftWrap) {
        updatedAny = true;
        const nextCustomizations = { ...x.customizations };
        delete nextCustomizations.giftWrap;
        return {
          ...x,
          customizations: Object.keys(nextCustomizations).length > 0 ? nextCustomizations : undefined
        };
      }
      return x;
    });

    if (updatedAny) {
      localStorage.setItem(key, JSON.stringify(updated));
      refreshCart();
    }
  };

  const handleClearAllWraps = () => {
    setTempWrappedItems([]);
    const cartItemOptions = items.filter((it) => shouldShowCartPriceLine(it, products[it.productId]));
    if (cartItemOptions.length > 0) {
      setGiftSelectedProductKey(getItemKey(cartItemOptions[0].productId, cartItemOptions[0].variationId, cartItemOptions[0].customizations));
    } else {
      setGiftSelectedProductKey('');
    }
    setGiftComment('');

    const key = scopedCartKey(user?.id ?? null);
    let updatedAny = false;
    const updated = items.map(x => {
      if (x.customizations?.giftWrap) {
        updatedAny = true;
        const nextCustomizations = { ...x.customizations };
        delete nextCustomizations.giftWrap;
        return {
          ...x,
          customizations: Object.keys(nextCustomizations).length > 0 ? nextCustomizations : undefined
        };
      }
      return x;
    });

    if (updatedAny) {
      localStorage.setItem(key, JSON.stringify(updated));
      refreshCart();
      showToast('All gift wraps removed', 'info');
    }
  };

  const handleAddGiftWrap = () => {
    const key = scopedCartKey(user?.id ?? null);
    const updated = items.map(x => {
      const xKey = getItemKey(x.productId, x.variationId, x.customizations);
      const foundWrap = tempWrappedItems.find(w => w.itemKey === xKey);
      
      if (foundWrap) {
        return {
          ...x,
          customizations: {
            ...x.customizations,
            giftWrap: {
              comment: foundWrap.comment,
              price: giftingConfig.price
            }
          }
        };
      } else {
        const nextCustomizations = { ...x.customizations };
        delete nextCustomizations.giftWrap;
        return {
          ...x,
          customizations: Object.keys(nextCustomizations).length > 0 ? nextCustomizations : undefined
        };
      }
    });

    localStorage.setItem(key, JSON.stringify(updated));
    refreshCart();
    handleCloseGiftModal();
    showToast('Gift wrap configuration saved!', 'success');
  };

  useEffect(() => {
    if (!couponCode.trim()) setCouponValidationStatus('idle');
  }, [couponCode]);

  const hasPendingPhotoboothPrint = items.some(
    (it) => it.customizations?.photoboothProject?.pendingFinalize,
  );

  const handleCheckout = () => {
    if (items.length === 0) {
      alert('Please add at least one item to checkout');
      return;
    }
    router.push('/checkout');
  };

  if (items.length === 0 && !subscriptionCartItem) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyCart}>
          <svg
            viewBox="0 0 400 400"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={styles.emptyCartIcon}
          >
            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
            <g id="SVGRepo_iconCarrier">
              <path d="M269.824 261.753C246.209 228.062 203.138 282.309 233.404 304.514C256.923 321.77 284.534 294.874 273.492 271.471" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
              <path d="M252.318 221.946C248.159 130.522 192.256 79 101.382 79" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
              <path d="M221.698 142.794C214.564 147.712 206.557 151.319 200.029 157.146C125.176 223.994 110.888 147.382 86.2657 206.588" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
              <path d="M252.318 221.946C349.522 252.45 296.046 294.219 314.735 320" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
              <path d="M248.785 221.978C106.971 219.909 227.399 321.76 174.591 319.978" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
            </g>
          </svg>
          <h1 className={styles.emptyCartText}>Your cart is empty</h1>
          <p className={styles.emptyCartTagline}>This cart deserves better.</p>
          <Link href="/products" className={styles.continueShoppingButton} style={{ cursor: 'pointer', position: 'relative', zIndex: 10 }}>
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Progress Bar */}
      <div className={styles.progressBar}>
        <div className={`${styles.progressStep} ${styles.progressStepActive}`}>
          <span className={styles.stepNumber}>1</span>
          <span className={styles.stepLabel}>Cart</span>
        </div>
        <div className={styles.progressStep}>
          <span className={styles.stepNumber}>2</span>
          <span className={styles.stepLabel}>Address</span>
        </div>
        <div className={styles.progressStep}>
          <span className={styles.stepNumber}>3</span>
          <span className={styles.stepLabel}>Payment</span>
        </div>
      </div>

      <div className={styles.cartLayout}>
        {/* Left Column - Cart Items */}
        <div className={styles.cartItemsColumn}>
          {/* Item Count */}
          <div className={styles.selectionSummary}>
            <span className={styles.itemCount}>{totalItemCount} item{totalItemCount !== 1 ? 's' : ''} in cart</span>
          </div>

          {/* Items List */}
          <div className={styles.itemsList}>
            {items.map((it) => {
              const p = products[it.productId];
              if (!shouldShowCartPriceLine(it, p)) return null;
              const v = it.variationId ? (p?.variations || []).find((x) => x.id === it.variationId) : null;
              const itemKey = getItemKey(it.productId, it.variationId, it.customizations);
              const photobooth = getPhotoboothCartProject(it);
              const photobook = getPhotobookCartProject(it);
              const itemTotal = getCartItemOrderSubtotalContribution(it, p);

              const getCartFallbackImageUrl = (productId: string, productName: string, projectType?: string) => {
                if (!photoboothSettings) return null;

                const getProductIdFromUrl = (url: string) => {
                  if (!url) return null;
                  const trimmed = url.trim();
                  if (/^\d+$/.test(trimmed)) {
                    return trimmed;
                  }
                  const match = trimmed.match(/\/product\/(\d+)/);
                  return match ? match[1] : null;
                };

                const polaroidProdId = getProductIdFromUrl(photoboothSettings.polaroidsUrl);
                const photostripProdId = getProductIdFromUrl(photoboothSettings.photostripsUrl);

                const nameLower = (productName || '').toLowerCase();
                const isPolaroid = (polaroidProdId && String(productId) === String(polaroidProdId)) 
                  || nameLower.includes('polaroid')
                  || projectType === 'polaroid';
                const isPhotostrip = (photostripProdId && String(productId) === String(photostripProdId)) 
                  || nameLower.includes('strip')
                  || projectType === 'strip';

                if (isPolaroid) {
                  const coverId = photoboothSettings.polaroidsCoverProductId;
                  if (coverId) {
                    const prod = coverProducts[String(coverId)];
                    return prod ? getPrimaryProductImageUrl(prod) : null;
                  }
                }

                if (isPhotostrip) {
                  const coverId = photoboothSettings.photostripsCoverProductId;
                  if (coverId) {
                    const prod = coverProducts[String(coverId)];
                    return prod ? getPrimaryProductImageUrl(prod) : null;
                  }
                }

                return null;
              };

              const fallbackImage = p ? getCartFallbackImageUrl(p.id, p.name, photobooth?.projectType) : null;
              const productImage = photobooth
                ? (fallbackImage
                  || photobooth?.previewUrl
                  || (p ? getPrimaryProductImageUrl(p) : null)
                  || '/placeholder-product.png')
                : photobook
                  ? ((p ? getPrimaryProductImageUrl(p) : null) || '/placeholder-product.png')
                  : (fallbackImage
                    || (p ? getPrimaryProductImageUrl(p) : null)
                    || '/placeholder-product.png');

              const handleProductClick = () => {
                if (photobooth || photobook) return;
                if (p) {
                  router.push(`/product/${p.id}`);
                }
              };

              return (
                <div key={itemKey} className={styles.cartItem}>
                  <div
                    className={styles.itemImage}
                    onClick={handleProductClick}
                    style={{ cursor: 'pointer' }}
                  >
                    {productImage && productImage !== '/placeholder-product.png' ? (
                      photobooth ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={productImage}
                          alt="Photobooth print preview"
                          width={100}
                          height={100}
                          style={{ objectFit: 'cover', borderRadius: '8px', width: 100, height: 100 }}
                        />
                      ) : photobook && p ? (
                        <Image
                          src={productImage}
                          alt={p.name}
                          width={100}
                          height={100}
                          style={{ objectFit: 'cover', borderRadius: '8px' }}
                        />
                      ) : p ? (
                        <Image
                          src={productImage}
                          alt={p.name}
                          width={100}
                          height={100}
                          style={{ objectFit: 'cover', borderRadius: '8px' }}
                        />
                      ) : null
                    ) : (
                      <div className={styles.itemImagePlaceholder}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 16L8.586 11.414C9.367 10.633 10.633 10.633 11.414 11.414L16 16M14 14L15.586 12.414C16.367 11.633 17.633 11.633 18.414 12.414L20 14M14 8H14.01M6 20H18C19.105 20 20 19.105 20 18V6C20 4.895 19.105 4 18 4H6C4.895 4 4 4.895 4 6V18C4 19.105 4.895 20 6 20Z" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div
                    className={styles.itemDetails}
                    onClick={handleProductClick}
                    style={{ cursor: 'pointer' }}
                  >
                    <h3 className={styles.itemTitle}>
                      {photobooth
                        ? 'Photobooth Print'
                        : photobook
                          ? `${p?.name || 'Photobook'} (${photobook.projectName || 'My Project'})`
                          : (p ? p.name : 'Loading...')}
                    </h3>
                    {photobook ? (
                      <div className={styles.itemInfo}>
                        <span>{photobook.pageCount} pages</span>
                        <Link href={`/product/${photobook.productId}?pbProject=${photobook.projectId}`} className={styles.editDesignLink}>
                          Edit design
                        </Link>
                      </div>
                    ) : null}
                    {photobooth ? (
                      <div className={styles.itemInfo}>
                        <span>{photobooth.label}</span>
                        <span>{getPhotoboothPrintsLabel(it)}</span>
                      </div>
                    ) : null}
                    {p && p.isCustomizable ? (
                      (() => {
                        const descParts = getCustomizationDescriptionParts(it, p);
                        return descParts.length > 0 ? (
                          <div className={styles.itemVariationList}>
                            {descParts.map((desc) => (
                              <span key={desc}>{desc}</span>
                            ))}
                          </div>
                        ) : null;
                      })()
                    ) : null}
                    {!p?.isCustomizable && v ? (
                      <div className={styles.itemVariationList}>
                        <span>{/^size\s*:/i.test(v.size.trim()) || v.size.includes(':') ? v.size.trim() : `Size: ${v.size.trim()}`}</span>
                      </div>
                    ) : null}
                    {it.customizations?.giftWrap && (
                      <div className={styles.itemGiftWrapInfo}>
                        <span>Premium Gift Wrap (+₹{it.customizations.giftWrap.price})</span>
                        {it.customizations.giftWrap.comment && (
                          <span className={styles.itemGiftWrapComment}>&ldquo;{it.customizations.giftWrap.comment}&rdquo;</span>
                        )}
                      </div>
                    )}
                    <div className={styles.itemPrice}>₹{formatINR(itemTotal)}</div>
                  </div>

                  <div className={styles.itemActions}>
                    {photobooth || photobook ? (
                      <div className={styles.itemInfo}>
                        <span>Qty: {photobook ? it.quantity : 1}</span>
                      </div>
                    ) : (
                      <div className={styles.quantitySelector}>
                        <button
                          onClick={() => handleQuantityChange(it.productId, it.variationId, -1, it.customizations)}
                          className={styles.quantityButton}
                          disabled={it.quantity <= 1}
                        >
                          −
                        </button>
                        <span className={styles.quantityValue}>{it.quantity}</span>
                        <button
                          onClick={() => handleQuantityChange(it.productId, it.variationId, 1, it.customizations)}
                          className={styles.quantityButton}
                          disabled={(() => {
                            const product = products[it.productId];
                            const maxQty = product?.maxQuantity;
                            return Number.isFinite(maxQty) && Number(maxQty) > 0 && it.quantity >= Number(maxQty);
                          })()}
                        >
                          +
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => removeItem(it.productId, it.variationId, it.customizations)}
                      className={styles.removeButton}
                      aria-label="Remove item"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
            {subscriptionCartItem && (
              <div className={styles.cartItem}>
                <div className={styles.itemImage}>
                  <div className={styles.itemImagePlaceholder}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 16L3 5L8.5 10L12 8L15.5 10L21 5L19 16H5Z" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M3 16H21" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className={styles.itemDetails}>
                  <h3 className={styles.itemTitle}>{subscriptionCartLineTitle}</h3>
                  <p className={styles.subscriptionTransferNote}>
                    Plans are managed in My Account &gt;{' '}
                    <Link href="/subscriptions" className={styles.subscriptionTransferLink}>
                      Plans
                    </Link>
                  </p>
                  <div className={styles.itemInfo}>
                    <span>Qty: {subscriptionCartItem.litresPerDay} L/day</span>
                    <span>
                      Period:{' '}
                      {subscriptionCartItem.durationDays != null && subscriptionCartItem.durationDays >= 1
                        ? `${subscriptionCartItem.durationDays} day(s)`
                        : `${subscriptionCartItem.durationMonths} month(s)`}
                    </span>
                    <span>Delivery: {subscriptionCartItem.deliveryTime}</span>
                  </div>
                  <div className={styles.itemPrice}>₹{formatINR(subscriptionCartItem.totalAmount)}</div>
                </div>
                <div className={styles.itemActions}>
                  <button
                    onClick={handleRemoveSubscriptionCartItem}
                    className={styles.removeButton}
                    aria-label="Remove plan"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Summary */}
        <div className={styles.summaryColumn}>
          {/* Coupons */}
          <div className={styles.summarySection}>
            <h3 className={styles.sectionTitle}>Coupons</h3>
            {appliedCoupon ? (
              <div className={styles.appliedCoupon}>
                <span className={styles.couponCode}>{appliedCoupon}</span>
                <button onClick={handleRemoveCoupon} className={styles.removeCouponButton}>×</button>
              </div>
            ) : (
              <>
                <div className={styles.couponInputContainer}>
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code"
                    className={`${styles.couponInput} ${couponValidationStatus === 'valid' ? styles.couponInputValid : ''} ${couponValidationStatus === 'invalid' ? styles.couponInputInvalid : ''} ${couponValidationStatus === 'invalid' ? styles.couponInputShake : ''}`}
                    onKeyPress={(e) => e.key === 'Enter' && handleApplyCoupon()}
                    disabled={validatingCoupon}
                  />
                  <button
                    onClick={() => handleApplyCoupon()}
                    className={styles.applyCouponButton}
                    disabled={!couponCode.trim() || validatingCoupon}
                  >
                    {validatingCoupon ? '...' : 'Apply'}
                  </button>
                </div>
                <p
                  className={styles.availableCouponsHint}
                  onClick={() => setIsCouponModalOpen(true)}
                >
                  Click here for available coupons
                  <svg className={styles.couponHintIcon} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                    <path d="M0 0h48v48H0z" fill="none" />
                    <g id="Shopicon">
                      <rect x="2.201" y="22" transform="matrix(0.7071 -0.7071 0.7071 0.7071 -9.9411 23.9997)" width="43.598" height="4" />
                      <path d="M14,22c4.418,0,8-3.582,8-8s-3.582-8-8-8s-8,3.582-8,8S9.582,22,14,22z M14,10c2.206,0,4,1.794,4,4c0,2.206-1.794,4-4,4 s-4-1.794-4-4C10,11.794,11.794,10,14,10z" />
                      <path d="M34,42c4.418,0,8-3.582,8-8s-3.582-8-8-8s-8,3.582-8,8S29.582,42,34,42z M34,30c2.206,0,4,1.794,4,4c0,2.206-1.794,4-4,4 s-4-1.794-4-4C30,31.794,31.794,30,34,30z" />
                    </g>
                  </svg>
                </p>
              </>
            )}
          </div>

          {/* Gifting Section */}
          {giftingConfig.enabled && (
            <div className={`${styles.summarySection} ${styles.giftingSection}`}>
              <h3 className={styles.sectionTitle}>Gifting</h3>
              <div className={styles.giftingBox}>
                <div className={styles.giftingContent}>
                  <h4 className={styles.giftingTitle}>Buying for a loved one?</h4>
                  <p className={styles.giftingDescription}>
                    Add premium gift wrapping to your order for just ₹{giftingConfig.price}
                  </p>
                  <button
                    type="button"
                    className={styles.giftingButton}
                    onClick={handleOpenGiftModal}
                  >
                    {hasAnyGiftWrap ? 'Edit gift wrap' : 'Add gift wrap'}
                  </button>
                </div>
                <div className={styles.giftingIconWrapper}>
                  <DotLottieReact
                    src="/animations/gift.json"
                    autoplay
                    loop
                  />
                </div>
              </div>
            </div>
          )}

          {/* Price Details */}
          <div className={styles.summarySection}>
            <h3 className={styles.sectionTitle}>Price Details</h3>
            <div className={styles.priceDetailsBox}>
              <div className={styles.priceRow}>
                <span>{totalItemCount} item{totalItemCount !== 1 ? 's' : ''}</span>
              </div>
              {items.map((it) => {
                const p = products[it.productId];
                if (!shouldShowCartPriceLine(it, p)) return null;
                const itemTotal = getCartItemPriceLineAmount(it, p);
                return (
                  <div key={getItemKey(it.productId, it.variationId, it.customizations)} className={styles.priceRow}>
                    <span>{getCartItemCheckoutLineLabel(it, p)}</span>
                    <span>₹{formatINR(itemTotal)}</span>
                  </div>
                );
              })}
              {subscriptionCartItem && (
                <div className={styles.priceRow}>
                  <span>1 X plan for {subscriptionCartItem.productName}</span>
                  <span>₹{formatINR(subscriptionCartItem.totalAmount)}</span>
                </div>
              )}
              {couponDiscount > 0 && (
                <div className={styles.priceRow}>
                  <span>Coupon discount</span>
                  <span className={styles.discount}>-₹{formatINR(couponDiscount)}</span>
                </div>
              )}
              {platformFee > 0 && (
                <div className={styles.priceRow}>
                  <span>Platform fee</span>
                  <span>₹{formatINR(platformFee)}</span>
                </div>
              )}
              {totalGiftWrapFee > 0 && (
                <div className={styles.priceRow}>
                  <span>Gift wrap</span>
                  <span>₹{formatINR(totalGiftWrapFee)}</span>
                </div>
              )}
              <div className={styles.priceRow}>
                <span>Delivery Charges</span>
                <span className={displayedDeliveryCharges > 0 ? '' : styles.freeDelivery}>
                  {displayedDeliveryCharges > 0 ? `₹${formatINR(displayedDeliveryCharges)}` : 'Proceed Further'}
                </span>
              </div>
              <div className={`${styles.priceRow} ${styles.priceRowTotal}`}>
                <span>Total Amount</span>
                <span>₹{formatINR(total)}</span>
              </div>
            </div>
            <div className={styles.totalSavingsBox}>
              <span className={styles.totalSavingsLabel}>Your total savings</span>
              <span className={styles.savings}>₹{formatINR(savings)}</span>
            </div>
            {codConfig.enabled && (
              <div className={styles.paymentMethods}>
                <div className={styles.paymentMethodItem}>
                  <span className={styles.paymentMethodLabel}>COD</span>
                  <span className={styles.paymentMethodAvailable}>Available</span>
                </div>
                <div className={styles.paymentMethodItem}>
                  <span className={styles.paymentMethodLabel}>Online Payment</span>
                  <span className={styles.paymentMethodAvailable}>Available</span>
                </div>
              </div>
            )}
          </div>

          {/* Place Order Button */}
          <div className={styles.placeOrderContainer}>
            {!user && hasPendingPhotoboothPrint ? (
              <p className={styles.photoboothLoginHint}>
                Your polaroids are saved in cart. Sign in at checkout to complete your print order.
              </p>
            ) : null}
            <div className={styles.totalAmountMobile}>
              <span className={styles.totalAmountLabel}>Total Amount</span>
              <span className={styles.totalAmountValue}>₹{formatINR(total)}</span>
            </div>
            <button
              onClick={handleCheckout}
              className={styles.placeOrderButton}
              disabled={items.length === 0}
            >
              Checkout
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <CouponModal
        isOpen={isCouponModalOpen}
        onClose={() => setIsCouponModalOpen(false)}
        subtotal={subtotalAlignedWithCheckout}
        platformFee={platformFee}
        onApply={(code) => handleApplyCoupon(code)}
      />

      {isGiftModalOpen && (
        <div className={`${styles.modalOverlay} ${isGiftModalClosing ? styles.modalOverlayClosing : styles.modalOverlayOpening}`} onClick={handleCloseGiftModal}>
          <div
            className={`${styles.giftModal} ${isGiftModalClosing ? styles.giftModalClosing : styles.giftModalOpening}`}
            style={{
              height: modalHeight ? `${modalHeight}px` : 'auto',
              transition: 'height 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div ref={modalContentRef}>
              <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Premium Gift Wrap</h2>
              <button
                type="button"
                className={styles.giftCloseButton}
                onClick={handleCloseGiftModal}
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className={styles.giftModalBody}>
              {(() => {
                const cartItemOptions = items.filter((it) => shouldShowCartPriceLine(it, products[it.productId]));
                const availableOptions = cartItemOptions.filter(opt => {
                  const key = getItemKey(opt.productId, opt.variationId, opt.customizations);
                  return !tempWrappedItems.some(w => w.itemKey === key);
                });

                return (
                  <>
                    {availableOptions.length > 0 ? (
                      <div>
                        <div>
                          <label className={styles.giftLabel}>For which product?</label>
                          <div className={styles.giftSelectWrapper}>
                            <select
                              className={styles.giftSelect}
                              value={giftSelectedProductKey}
                              onChange={(e) => handleGiftProductChange(e.target.value)}
                            >
                              {availableOptions.map((it) => {
                                const p = products[it.productId];
                                const v = it.variationId && p ? (p.variations || []).find(x => x.id === it.variationId) : null;
                                const key = getItemKey(it.productId, it.variationId, it.customizations);
                                return (
                                  <option key={key} value={key}>
                                    {p?.name || 'Product'} {v ? `(${v.size})` : ''}
                                  </option>
                                );
                              })}
                            </select>
                            <svg className={styles.giftSelectArrow} viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                              <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>

                        <div style={{ marginTop: '1rem' }}>
                          <label className={styles.giftLabel}>Add your comment about what more you want us to add</label>
                          <textarea
                            className={styles.giftTextArea}
                            placeholder="e.g. Please write 'Happy Birthday Dad!' on a card and pack it in a nice wrapping paper."
                            value={giftComment}
                            onChange={(e) => setGiftComment(e.target.value)}
                          />
                        </div>

                        <button
                          type="button"
                          className={styles.giftAddToListButton}
                          onClick={handleAddTempGiftWrap}
                          disabled={!giftSelectedProductKey}
                        >
                          + Add to gift wrap list
                        </button>
                      </div>
                    ) : (
                      <div className={styles.giftSelectionAreaEmpty}>
                        ✨ All products in your cart have been added to the gift wrap list.
                      </div>
                    )}

                    {tempWrappedItems.length > 0 && (
                      <div className={styles.tempWrappedSection}>
                        <h3 className={styles.tempWrappedHeader}>
                          Gift wrapped products ({tempWrappedItems.length} item{tempWrappedItems.length > 1 ? 's' : ''})
                        </h3>
                        <div className={styles.tempWrappedList}>
                          {tempWrappedItems.map((item) => {
                            const cartItem = items.find(it => getItemKey(it.productId, it.variationId, it.customizations) === item.itemKey);
                            if (!cartItem) return null;
                            const p = products[cartItem.productId];
                            const v = cartItem.variationId && p ? (p.variations || []).find(x => x.id === cartItem.variationId) : null;
                            return (
                              <div key={item.itemKey} className={styles.tempWrappedRow}>
                                <div className={styles.tempWrappedText}>
                                  <span className={styles.tempWrappedName}>
                                    🎁 {p?.name || 'Product'} {v ? `(${v.size})` : ''}
                                  </span>
                                  {item.comment && (
                                    <span className={styles.tempWrappedComment}>
                                      &ldquo;{item.comment}&rdquo;
                                    </span>
                                  )}
                                </div>
                                <div className={styles.tempWrappedRowActions}>
                                  <button
                                    type="button"
                                    className={styles.tempWrappedEditButton}
                                    onClick={() => handleEditTempGiftWrap(item.itemKey)}
                                    aria-label="Edit item comment"
                                  >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M12 20h9"></path>
                                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.tempWrappedRemoveButton}
                                    onClick={() => handleRemoveTempGiftWrap(item.itemKey)}
                                    aria-label="Remove item"
                                  >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="18" y1="6" x2="6" y2="18"></line>
                                      <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className={styles.giftModalActions}>
                      {tempWrappedItems.length > 0 && (
                        <button
                          type="button"
                          className={styles.giftRemoveButton}
                          onClick={handleClearAllWraps}
                        >
                          Remove all wraps
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.giftPrimaryButton}
                        onClick={() => {
                          if (tempWrappedItems.length > 0 || hasAnyGiftWrap) {
                            handleAddGiftWrap();
                          } else {
                            handleCloseGiftModal();
                          }
                        }}
                      >
                        {tempWrappedItems.length > 0
                          ? `Save & Apply (₹${tempWrappedItems.length * giftingConfig.price})`
                          : hasAnyGiftWrap
                          ? 'Remove All & Save'
                          : 'Done'}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
