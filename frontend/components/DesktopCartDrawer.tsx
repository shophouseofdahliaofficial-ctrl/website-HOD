'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((m) => m.DotLottieReact),
  { ssr: false }
);

const AddressLocationPicker = dynamic(
  () => import('@/components/AddressLocationPicker'),
  { ssr: false }
);

import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  readSubscriptionCartJson,
  clearSubscriptionCart,
  scopedCartKey,
} from '@/lib/utils/userScopedStorage';
import {
  apiClient,
  productsApi,
  couponsApi,
  addressesApi,
  walletApi,
  contentApi,
} from '@/lib/api';
import type { Coupon } from '@/lib/api';
import { Product, Address } from '@/types';
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
import { saveCheckoutCouponCode } from '@/lib/utils/checkoutCoupon';
import { useToast } from '@/contexts/ToastContext';
import { getPrimaryProductImageUrl } from '@/lib/utils/productImages';
import { SITE_NAME } from '@/lib/seo';
import { normalizeDeliveryRatesConfig, resolveDeliveryRate } from '@/lib/utils/deliveryRates';
import { useDeliveryTimeOffConfig } from '@/hooks/useDeliveryTimeOffConfig';
import DeliveryTimeOffModal from '@/components/DeliveryTimeOffModal';
import FloatingLabelInput from '@/components/ui/FloatingLabelInput';
import CouponModal from '@/components/CouponModal';
import styles from '@/app/cart/cart.module.css';
import checkoutStyles from '@/app/checkout/checkout.module.css';
import productCardStyles from '@/components/ProductsSection.module.css';
import orderSuccessStyles from '@/app/order-success/order-success.module.css';

type CheckoutStep = 'cart' | 'address' | 'review';

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
  frequency?: string;
};

const getPhotobookCartProject = (it: CartItem) => {
  if (!it?.customizations) return null;
  return (
    it.customizations.photobookProject ||
    it.customizations.photobook ||
    it.customizations.photobookOrder ||
    (it.customizations.photobookProjectId ? { id: it.customizations.photobookProjectId } : null)
  );
};

const formatINR = (amount: number) => {
  return (Number(amount) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

interface DesktopCartDrawerProps {
  onClose: () => void;
}

export default function DesktopCartDrawer({ onClose }: DesktopCartDrawerProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, isAuthenticated, login, loginWithGoogle } = useAuth();
  const subCartUserId = user?.id ?? null;
  const { items, setItemQuantity, removeItem, clearCart, refreshCart } = useCart();

  // Step state: 'cart' (1) -> 'address' (2) -> 'review' (3)
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('cart');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const addressFormRef = useRef<HTMLDivElement>(null);

  const scrollToAddressForm = () => {
    setTimeout(() => {
      if (addressFormRef.current) {
        addressFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const firstInput = addressFormRef.current.querySelector<HTMLInputElement>('input:not([type="hidden"])');
        if (firstInput) {
          firstInput.focus({ preventScroll: true });
        }
      }
    }, 100);
  };

  // Cart & Products State
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [appliedCouponData, setAppliedCouponData] = useState<Coupon | null>(null);
  const [couponValidationStatus, setCouponValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [subscriptionCartItem, setSubscriptionCartItem] = useState<SubscriptionCartItem | null>(null);
  const [platformFee, setPlatformFee] = useState(0);
  const [giftingConfig, setGiftingConfig] = useState<{ enabled: boolean; price: number }>({ enabled: true, price: 25 });
  const [codConfig, setCodConfig] = useState<{ enabled: boolean }>({ enabled: true });
  const [isOrderPlacedSuccess, setIsOrderPlacedSuccess] = useState(false);
  const [placedOrderNumber, setPlacedOrderNumber] = useState<string>('');
  const [copiedOrderNumber, setCopiedOrderNumber] = useState(false);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [photoboothSettings, setPhotoboothSettings] = useState<any>(null);
  const [coverProducts, setCoverProducts] = useState<Record<string, Product>>({});

  // Login form state (if guest on address step)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Address State
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showCreateNewAddress, setShowCreateNewAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [addressForm, setAddressForm] = useState({
    name: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    phone: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online' | 'wallet'>('online');
  const [walletBalance, setWalletBalance] = useState(0);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [deliveryRatesConfig, setDeliveryRatesConfig] = useState<{ ranges: Array<{ startMeters: number; endMeters: number; rate: number }> }>({ ranges: [] });
  const [backendDeliveryCharges, setBackendDeliveryCharges] = useState<number | null>(null);
  const [isFirstProductOrder, setIsFirstProductOrder] = useState(false);

  // Delivery Time Off Modal
  const skipDeliveryTimeOffModalRef = useRef(false);
  const { evaluate: evaluateDeliveryTimeOff } = useDeliveryTimeOffConfig();
  const [deliveryTimeOffModal, setDeliveryTimeOffModal] = useState<{ title: string; description: string } | null>(null);

  // Gift Wrap Modal State
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [isGiftModalClosing, setIsGiftModalClosing] = useState(false);
  const [giftSelectedProductKey, setGiftSelectedProductKey] = useState('');
  const [giftComment, setGiftComment] = useState('');
  const [tempWrappedItems, setTempWrappedItems] = useState<{ itemKey: string; comment: string }[]>([]);

  const giftModalContentRef = useRef<HTMLDivElement>(null);
  const [giftModalHeight, setGiftModalHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!isGiftModalOpen || !giftModalContentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
        if (h > 0) {
          setGiftModalHeight(Math.round(h));
        }
      }
    });
    observer.observe(giftModalContentRef.current);
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

  // Smooth scroll to top when step changes
  const goToStep = (nextStep: CheckoutStep) => {
    setCurrentStep(nextStep);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Fetch photobooth link settings & cover products
  useEffect(() => {
    contentApi
      .getByType('photobooth_links')
      .then((data) => {
        if (data && data.metadata) {
          setPhotoboothSettings(data.metadata);

          const fetchCovers = async () => {
            const productMap: Record<string, Product> = {};
            const coverIds = [
              data.metadata.polaroidsCoverProductId,
              data.metadata.photostripsCoverProductId,
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

  // Fetch all cart products
  useEffect(() => {
    const loadProducts = async () => {
      const productIds = new Set(items.map((i) => i.productId));
      if (subscriptionCartItem?.productId) productIds.add(subscriptionCartItem.productId);
      const unique = Array.from(productIds);
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

    if (items.length > 0 || subscriptionCartItem) {
      loadProducts();
    }
  }, [items, subscriptionCartItem]);

  // Load subscription cart item
  useEffect(() => {
    const loadSubscriptionItem = () => {
      try {
        const raw = readSubscriptionCartJson(subCartUserId);
        if (!raw) {
          setSubscriptionCartItem(null);
          return;
        }
        const parsed = JSON.parse(raw) as Partial<SubscriptionCartItem>;
        if (
          parsed &&
          parsed.type === 'subscription' &&
          parsed.productId &&
          parsed.productName &&
          typeof parsed.litresPerDay === 'number' &&
          typeof parsed.totalAmount === 'number'
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
    const handleSubscriptionCartUpdated = () => loadSubscriptionItem();
    window.addEventListener('milko:subscription-cart-updated', handleSubscriptionCartUpdated);
    window.addEventListener('storage', handleSubscriptionCartUpdated);
    return () => {
      window.removeEventListener('milko:subscription-cart-updated', handleSubscriptionCartUpdated);
      window.removeEventListener('storage', handleSubscriptionCartUpdated);
    };
  }, [subCartUserId]);

  // Load platform fee & delivery rates
  useEffect(() => {
    let cancelled = false;
    contentApi.getByType('platform_fee')
      .then((data) => {
        if (!cancelled && data && data.metadata) {
          const amount = (data.metadata as any).amount;
          setPlatformFee(Number.isFinite(amount) && amount > 0 ? amount : 0);
        }
      })
      .catch(() => {});

    contentApi.getByType('delivery_rates')
      .then((data) => {
        if (!cancelled && data) {
          setDeliveryRatesConfig(normalizeDeliveryRatesConfig(data.metadata || {}));
        }
      })
      .catch(() => {});

    contentApi.getByType('gifting')
      .then((data) => {
        if (!cancelled && data) {
          const price = Number(data.metadata?.price ?? (Number.isFinite(Number(data.title)) ? Number(data.title) : 25));
          const enabled = (data.metadata?.enabled !== undefined ? data.metadata.enabled === true : data.isActive) ?? true;
          const isActuallyActive = enabled && data.isActive !== false;
          setGiftingConfig({
            enabled: isActuallyActive,
            price: Number.isFinite(price) && price >= 0 ? price : 25,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setGiftingConfig({ enabled: true, price: 25 });
      });

    contentApi.getByType('cod')
      .then((data) => {
        if (!cancelled && data) {
          const enabled = (data.metadata?.enabled !== undefined ? data.metadata.enabled === true : data.isActive) ?? true;
          const isActuallyActive = enabled && data.isActive !== false;
          setCodConfig({ enabled: isActuallyActive });
          if (!isActuallyActive) {
            setPaymentMethod((prev) => (prev === 'cod' ? 'online' : prev));
          }
        }
      })
      .catch(() => {
        if (!cancelled) setCodConfig({ enabled: true });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Load saved addresses when authenticated
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let cancelled = false;
    addressesApi.getAll()
      .then((list) => {
        if (cancelled) return;
        setSavedAddresses(list);
        if (list.length > 0 && !selectedAddressId) {
          const defaultAddr = list.find((a) => a.isDefault) || list[0];
          setSelectedAddressId(defaultAddr.id);
          fillAddressForm(defaultAddr);
        } else if (list.length === 0) {
          setShowCreateNewAddress(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  // Load wallet balance
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let cancelled = false;
    walletApi.getSummary()
      .then((s) => {
        if (!cancelled) setWalletBalance(s.balance || 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  const fillAddressForm = (addr: Address) => {
    setAddressForm({
      name: addr.name || '',
      street: addr.street || '',
      city: addr.city || '',
      state: addr.state || '',
      postalCode: addr.postalCode || '',
      country: addr.country || 'India',
      phone: addr.phone || '',
      latitude: addr.latitude,
      longitude: addr.longitude,
    });
  };

  const getItemKey = (productId: string, variationId?: string, customizations?: any) => {
    const customKey = customizations ? JSON.stringify(customizations) : '';
    return `${productId}_${variationId || 'default'}_${customKey}`;
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

    // 2. Direct selectedOptions in customizations (e.g. from ProductDetailsModal)
    if (descParts.length === 0 && it.customizations?.selectedOptions && typeof it.customizations.selectedOptions === 'object') {
      const selectedOpts = it.customizations.selectedOptions;
      Object.keys(selectedOpts).forEach((groupId) => {
        const valId = selectedOpts[groupId];
        const group = (p?.customizationOptions || []).find((g) => String(g.id) === String(groupId));
        const val = group ? (group.values || []).find((v) => String(v.id) === String(valId)) : null;
        if (group && val) {
          descParts.push(`${group.title}: ${val.name}`);
        } else if (typeof valId === 'string' || typeof valId === 'number') {
          descParts.push(`${valId}`);
        }
      });
    }

    // 3. Standard variations in product.variations
    if (descParts.length === 0 && it.variationId) {
      const v = (p?.variations || []).find((x) => String(x.id) === String(it.variationId));
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
        (it as any).variantName ||
        (it as any).variationName ||
        (it.customizations as any)?.variationName;
      if (fallbackSize) {
        const trimmed = String(fallbackSize).trim();
        const formatted = /^size\s*:/i.test(trimmed) || trimmed.includes(':') ? trimmed : `Size: ${trimmed}`;
        descParts.push(formatted);
      }
    }

    // 5. Text personalization
    if (it.customizations && it.customizations.textPersonalization) {
      const textPers = it.customizations.textPersonalization;
      if (p?.customizationOptions) {
        (p.customizationOptions || []).forEach((group) => {
          if (group.type === 'text_input') {
            (group.values || []).forEach((val) => {
              const inputKey = `${group.id}_${val.id}`;
              const textVal = textPers[inputKey] || '';
              if (textVal.trim()) {
                descParts.push(`${group.title}: "${textVal.trim()}"`);
              }
            });
          }
        });
      } else {
        Object.keys(textPers).forEach((key) => {
          if (textPers[key]) {
            descParts.push(`Personalization: "${textPers[key]}"`);
          }
        });
      }
    }

    return descParts;
  };

  const handleOpenGiftModal = () => {
    const cartItemOptions = items.filter((it) => shouldShowCartPriceLine(it, products[it.productId]));
    if (cartItemOptions.length === 0) {
      showToast('Your cart is empty. Please add items to your cart before adding a gift wrap.', 'error');
      return;
    }

    const initialWrapped = items
      .filter((it) => it.customizations?.giftWrap)
      .map((it) => ({
        itemKey: getItemKey(it.productId, it.variationId, it.customizations),
        comment: it.customizations?.giftWrap?.comment || '',
      }));
    setTempWrappedItems(initialWrapped);

    const availableOptions = cartItemOptions.filter((opt) => {
      const key = getItemKey(opt.productId, opt.variationId, opt.customizations);
      return !initialWrapped.some((w) => w.itemKey === key);
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
      comment: giftComment.trim(),
    };

    const nextWrapped = [...tempWrappedItems, newWrappedItem];
    setTempWrappedItems(nextWrapped);
    setGiftComment('');

    const cartItemOptions = items.filter((it) => shouldShowCartPriceLine(it, products[it.productId]));
    const nextAvailable = cartItemOptions.filter((opt) => {
      const key = getItemKey(opt.productId, opt.variationId, opt.customizations);
      return !nextWrapped.some((w) => w.itemKey === key);
    });

    if (nextAvailable.length > 0) {
      const nextKey = getItemKey(nextAvailable[0].productId, nextAvailable[0].variationId, nextAvailable[0].customizations);
      setGiftSelectedProductKey(nextKey);
    } else {
      setGiftSelectedProductKey('');
    }
  };

  const handleRemoveTempGiftWrap = (targetKey: string) => {
    const nextWrapped = tempWrappedItems.filter((x) => x.itemKey !== targetKey);
    setTempWrappedItems(nextWrapped);

    if (!giftSelectedProductKey || giftSelectedProductKey === targetKey) {
      setGiftSelectedProductKey(targetKey);
    }

    const key = scopedCartKey(user?.id ?? null);
    let updatedAny = false;
    const updated = items.map((x) => {
      const xKey = getItemKey(x.productId, x.variationId, x.customizations);
      if (xKey === targetKey && x.customizations?.giftWrap) {
        updatedAny = true;
        const nextCustomizations = { ...x.customizations };
        delete nextCustomizations.giftWrap;
        return {
          ...x,
          customizations: Object.keys(nextCustomizations).length > 0 ? nextCustomizations : undefined,
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
    const targetItem = tempWrappedItems.find((x) => x.itemKey === targetKey);
    if (!targetItem) return;

    const nextWrapped = tempWrappedItems.filter((x) => x.itemKey !== targetKey);
    setTempWrappedItems(nextWrapped);

    setGiftSelectedProductKey(targetKey);
    setGiftComment(targetItem.comment);

    const key = scopedCartKey(user?.id ?? null);
    let updatedAny = false;
    const updated = items.map((x) => {
      const xKey = getItemKey(x.productId, x.variationId, x.customizations);
      if (xKey === targetKey && x.customizations?.giftWrap) {
        updatedAny = true;
        const nextCustomizations = { ...x.customizations };
        delete nextCustomizations.giftWrap;
        return {
          ...x,
          customizations: Object.keys(nextCustomizations).length > 0 ? nextCustomizations : undefined,
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
    const updated = items.map((x) => {
      if (x.customizations?.giftWrap) {
        updatedAny = true;
        const nextCustomizations = { ...x.customizations };
        delete nextCustomizations.giftWrap;
        return {
          ...x,
          customizations: Object.keys(nextCustomizations).length > 0 ? nextCustomizations : undefined,
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
    const updated = items.map((x) => {
      const xKey = getItemKey(x.productId, x.variationId, x.customizations);
      const foundWrap = tempWrappedItems.find((w) => w.itemKey === xKey);

      if (foundWrap) {
        return {
          ...x,
          customizations: {
            ...x.customizations,
            giftWrap: {
              comment: foundWrap.comment,
              price: giftingConfig.price,
            },
          },
        };
      } else {
        const nextCustomizations = { ...x.customizations };
        delete nextCustomizations.giftWrap;
        return {
          ...x,
          customizations: Object.keys(nextCustomizations).length > 0 ? nextCustomizations : undefined,
        };
      }
    });

    localStorage.setItem(key, JSON.stringify(updated));
    refreshCart();
    handleCloseGiftModal();
    showToast('Gift wrap configuration saved!', 'success');
  };

  const hasAnyGiftWrap = useMemo(() => {
    return items.some((it) => !!it.customizations?.giftWrap);
  }, [items]);

  const totalGiftWrapFee = useMemo(() => {
    return items.reduce((sum, it) => {
      return sum + (it.customizations?.giftWrap ? it.customizations.giftWrap.price : 0);
    }, 0);
  }, [items]);

  const totalItemCount = useMemo(() => {
    const standardCount = items.filter((it) => shouldShowCartPriceLine(it, products[it.productId])).length;
    const subscriptionCount = subscriptionCartItem ? 1 : 0;
    return standardCount + subscriptionCount;
  }, [items, products, subscriptionCartItem]);

  const itemsSubtotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const p = products[it.productId];
      if (!shouldShowCartPriceLine(it, p)) return sum;
      return sum + getCartItemOrderSubtotalContribution(it, p);
    }, 0);
  }, [items, products]);

  const subscriptionSubtotal = subscriptionCartItem?.totalAmount || 0;
  const subtotal = itemsSubtotal + subscriptionSubtotal;

  const calculateCouponDiscount = (): number => {
    if (couponValidationStatus !== 'valid' || !appliedCouponData) return 0;
    const coupon = appliedCouponData;
    let disc = 0;
    if (coupon.discountType === 'percentage') {
      disc = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount && disc > coupon.maxDiscountAmount) {
        disc = coupon.maxDiscountAmount;
      }
    } else {
      disc = coupon.discountValue;
    }
    return Math.min(disc, subtotal);
  };

  const couponDiscount = calculateCouponDiscount();
  const deliveryRateResult = resolveDeliveryRate(deliveryRatesConfig, addressForm.latitude, addressForm.longitude);
  const displayedDeliveryCharges = isFirstProductOrder && items.length > 0 ? 0 : (backendDeliveryCharges !== null ? backendDeliveryCharges : deliveryRateResult.charge);
  const total = Math.max(0, subtotal - couponDiscount + displayedDeliveryCharges + platformFee + totalGiftWrapFee);

  const savings = useMemo(() => {
    return items.reduce((sum, it) => {
      const p = products[it.productId];
      if (!p || !shouldShowCartPriceLine(it, p)) return sum;
      const details = getCartItemPriceDetails(it, p);
      if (details.mrp != null && details.mrp > details.price) {
        return sum + (details.mrp - details.price) * details.quantity;
      }
      return sum;
    }, 0);
  }, [items, products]);

  const handleApplyCoupon = async (codeToApply?: string) => {
    const code = (codeToApply || couponCode).trim().toUpperCase();
    if (!code) return;
    setValidatingCoupon(true);
    try {
      const coupon = await couponsApi.validate(code, subtotal);
      setAppliedCoupon(code);
      setAppliedCouponData(coupon);
      setCouponValidationStatus('valid');
      saveCheckoutCouponCode(code);
      showToast(`Coupon ${code} applied successfully!`, 'success');
      setIsCouponModalOpen(false);
    } catch (err: any) {
      setCouponValidationStatus('invalid');
      showToast(err.message || 'Invalid coupon code', 'error');
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
    showToast('Coupon removed', 'info');
  };

  const handleQuantityChange = (
    productId: string,
    variationId: string | undefined,
    delta: number,
    customizations?: any
  ) => {
    const item = items.find(
      (it) =>
        it.productId === productId &&
        (it.variationId || '') === (variationId || '') &&
        JSON.stringify(it.customizations || {}) === JSON.stringify(customizations || {})
    );
    const product = products[productId];
    if (item) {
      const newQuantity = Math.max(1, item.quantity + delta);
      const result = setItemQuantity(productId, newQuantity, variationId, product?.maxQuantity, customizations);
      if (!result.ok && delta > 0 && product?.maxQuantity) {
        showToast(`Maximum order quantity is ${product.maxQuantity}`, 'error');
      }
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail || !loginPassword) {
      setLoginError('Please enter email and password');
      return;
    }
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
      showToast('Signed in successfully!', 'success');
    } catch (err: any) {
      setLoginError(err.message || 'Failed to sign in');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAddressProceed = async () => {
    setAddressError('');
    if (!isAuthenticated || !user) {
      showToast('Please login to proceed with your address', 'error');
      return;
    }

    if (
      !addressForm.name?.trim() ||
      !addressForm.street?.trim() ||
      !addressForm.city?.trim() ||
      !addressForm.state?.trim() ||
      !addressForm.postalCode?.trim() ||
      !addressForm.phone?.trim()
    ) {
      setAddressError('Please fill in all required address fields');
      return;
    }

    if (showCreateNewAddress || editingAddressId) {
      setSavingAddress(true);
      try {
        if (editingAddressId) {
          await addressesApi.update(editingAddressId, {
            name: addressForm.name.trim(),
            street: addressForm.street.trim(),
            city: addressForm.city.trim(),
            state: addressForm.state.trim(),
            postalCode: addressForm.postalCode.trim(),
            country: addressForm.country.trim() || 'India',
            phone: addressForm.phone.trim(),
            latitude: addressForm.latitude,
            longitude: addressForm.longitude,
          });
          showToast('Address updated!', 'success');
        } else {
          const created = await addressesApi.create({
            name: addressForm.name.trim(),
            street: addressForm.street.trim(),
            city: addressForm.city.trim(),
            state: addressForm.state.trim(),
            postalCode: addressForm.postalCode.trim(),
            country: addressForm.country.trim() || 'India',
            phone: addressForm.phone.trim(),
            latitude: addressForm.latitude,
            longitude: addressForm.longitude,
            isDefault: savedAddresses.length === 0,
          });
          setSelectedAddressId(created.id);
          showToast('New address saved!', 'success');
        }
        const refreshed = await addressesApi.getAll();
        setSavedAddresses(refreshed);
        setShowCreateNewAddress(false);
        setEditingAddressId(null);
      } catch (err: any) {
        setAddressError(err.message || 'Failed to save address');
        setSavingAddress(false);
        return;
      } finally {
        setSavingAddress(false);
      }
    }

    goToStep('review');
  };

  const loadRazorpayScript = (): Promise<void> => {
    if (typeof window !== 'undefined' && (window as unknown as { Razorpay?: unknown }).Razorpay) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load Razorpay'));
      document.head.appendChild(s);
    });
  };

  const persistOrderSuccessData = () => {
    if (typeof window === 'undefined') return;
    const storedItems = [
      ...items.filter((it) => shouldShowCartPriceLine(it, products[it.productId] ?? products[String(it.productId)])).map((it) => {
        const p = products[it.productId] ?? products[String(it.productId)];
        const photobooth = getPhotoboothCartProject(it);
        const v = p && it.variationId ? (p.variations || []).find((x) => String(x.id) === String(it.variationId)) : null;
        const unitPrice = getCartItemOrderSubtotalContribution(it, p) / Math.max(1, it.quantity);
        return {
          productId: String(it.productId),
          variationId: it.variationId ?? undefined,
          quantity: it.quantity,
          customizations: it.customizations ?? null,
          productName: photobooth ? (getPhotoboothPrintsLabel(it) ?? 'Photobooth print') : (p?.name ?? 'Product'),
          variationSize: photobooth
            ? undefined
            : v?.size,
          imageUrl: photobooth?.previewUrl || p?.images?.[0]?.imageUrl || p?.imageUrl,
          unitPrice,
          taxPercent: p?.taxPercent ?? 0,
        };
      }),
      ...(subscriptionCartItem
        ? (() => {
          const subP = products[subscriptionCartItem.productId];
          return [
            {
              productId: String(subscriptionCartItem.productId),
              variationId: subscriptionCartItem.variationId || undefined,
              quantity: 1,
              productName: `Plan for ${subscriptionCartItem.productName}`,
              variationSize: `${subscriptionCartItem.litresPerDay}L/day · ${subscriptionCartItem.deliveryTime}`,
              imageUrl: subP?.images?.[0]?.imageUrl || subP?.imageUrl,
              unitPrice: subscriptionCartItem.totalAmount,
              taxPercent: subP?.taxPercent ?? 0,
            },
          ];
        })()
        : []),
    ];
    localStorage.setItem('milko_order_items', JSON.stringify(storedItems));
    localStorage.setItem('milko_delivery_address', JSON.stringify({ ...addressForm, id: selectedAddressId || undefined }));
    localStorage.setItem('milko_order_savings', (savings + couponDiscount).toFixed(2));
    localStorage.setItem('milko_order_summary', JSON.stringify({
      subtotal: Number(subtotal.toFixed(2)),
      discount: Number(couponDiscount.toFixed(2)),
      deliveryCharges: Number(displayedDeliveryCharges.toFixed(2)),
      platformFee: Number(platformFee.toFixed(2)),
      total: Number(total.toFixed(2)),
      paymentMethod,
      couponCode: appliedCoupon || null,
      savings: Number((savings + couponDiscount).toFixed(2)),
    }));
  };

  const handlePlaceOrder = async () => {
    if (
      !addressForm.name?.trim() ||
      !addressForm.street?.trim() ||
      !addressForm.city?.trim() ||
      !addressForm.state?.trim() ||
      !addressForm.postalCode?.trim() ||
      !addressForm.phone?.trim()
    ) {
      showToast('Please complete delivery address details', 'error');
      goToStep('address');
      return;
    }

    const dto = evaluateDeliveryTimeOff();
    if (dto.intercept && !skipDeliveryTimeOffModalRef.current) {
      setDeliveryTimeOffModal({ title: dto.title, description: dto.description });
      return;
    }
    skipDeliveryTimeOffModalRef.current = false;

    setPlacingOrder(true);
    let openedRazorpay = false;

    try {
      const activeAddress = { ...addressForm, id: selectedAddressId || undefined };
      const data = await apiClient.post<{
        orderId?: string;
        orderNumber?: string;
        razorpayOrderId?: string;
        key?: string;
        currency?: string;
        amount?: number;
      }>('/api/orders', {
        paymentMethod,
        creatorSlug: typeof window !== 'undefined' ? localStorage.getItem('referred_by_creator_slug') : null,
        couponCode: appliedCoupon || null,
        deliveryAddress: activeAddress,
        items: items.map((it) => ({
          productId: it.productId,
          variationId: it.variationId || null,
          quantity: it.quantity,
          customizations: it.customizations || null,
        })),
        subscriptionItem: subscriptionCartItem
          ? {
              productId: subscriptionCartItem.productId,
              variationId: subscriptionCartItem.variationId || null,
              litresPerDay: subscriptionCartItem.litresPerDay,
              durationDays: subscriptionCartItem.durationDays,
              durationMonths: subscriptionCartItem.durationMonths,
              deliveryTime: subscriptionCartItem.deliveryTime,
            }
          : null,
      });

      if (data.orderNumber || data.orderId) {
        setPlacedOrderNumber(String(data.orderNumber || data.orderId || ''));
      }

      if (data.razorpayOrderId && data.key) {
        openedRazorpay = true;
        await loadRazorpayScript();
        const Razorpay = (window as unknown as { Razorpay: new (o: unknown) => { open: () => void } }).Razorpay;
        const rzp = new Razorpay({
          key: data.key,
          order_id: data.razorpayOrderId,
          currency: data.currency || 'INR',
          name: SITE_NAME,
          description: `Order #${data.orderNumber || ''}`,
          handler: async function (resp: { razorpay_payment_id: string; razorpay_order_id: string }) {
            try {
              await apiClient.post('/api/orders/verify-payment', {
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
              });
              if (data.orderNumber || data.orderId) {
                setPlacedOrderNumber(String(data.orderNumber || data.orderId || ''));
              }
              persistOrderSuccessData();
              clearCart();
              clearSubscriptionCart(subCartUserId);
              saveCheckoutCouponCode(null);
              setIsOrderPlacedSuccess(true);
            } catch {
              alert('Payment verification failed. Please contact support.');
            } finally {
              setPlacingOrder(false);
            }
          },
          modal: {
            ondismiss: () => setPlacingOrder(false),
          },
        });
        rzp.open();
        return;
      }

      if (data.orderNumber || data.orderId) {
        setPlacedOrderNumber(String(data.orderNumber || data.orderId || ''));
      }
      persistOrderSuccessData();
      clearCart();
      clearSubscriptionCart(subCartUserId);
      saveCheckoutCouponCode(null);
      setIsOrderPlacedSuccess(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to place order. Please try again.', 'error');
    } finally {
      if (!openedRazorpay) setPlacingOrder(false);
    }
  };

  // Reusable Price Details Card (Pure CSS module styles from cart.module.css: .priceDetailsBox & .totalSavingsBox)
  const renderPriceDetailsCard = () => (
    <div className={styles.summarySection}>
      <h3 className={styles.sectionTitle}>
        Price Details
      </h3>
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
        {totalGiftWrapFee > 0 && (
          <div className={styles.priceRow}>
            <span>Gift wrap</span>
            <span>₹{formatINR(totalGiftWrapFee)}</span>
          </div>
        )}
        <div className={styles.priceRow}>
          <span>Delivery</span>
          <span className={displayedDeliveryCharges > 0 ? '' : styles.freeDelivery}>
            {displayedDeliveryCharges > 0 ? `₹${formatINR(displayedDeliveryCharges)}` : 'Free'}
          </span>
        </div>
        <div className={`${styles.priceRow} ${styles.priceRowTotal}`}>
          <span>Total</span>
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
  );

  const isCartEmpty = currentStep === 'cart' && items.length === 0 && !subscriptionCartItem;

  return (
    <div
      ref={scrollContainerRef}
      className={styles.drawerRootScroll}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: isOrderPlacedSuccess ? 'center' : isCartEmpty ? 'center' : 'flex-start',
        alignItems: isOrderPlacedSuccess ? 'center' : isCartEmpty ? 'center' : 'stretch',
        width: '100%',
        height: '100%',
        background: isOrderPlacedSuccess ? '#ffffff' : isCartEmpty ? '#ffffff' : '#f6f6f9',
        overflowY: isOrderPlacedSuccess || isCartEmpty ? 'hidden' : 'auto',
        overflowX: 'hidden',
        position: 'relative',
        borderRadius: 'inherit',
        boxSizing: 'border-box',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
      data-lenis-prevent
    >
      <DeliveryTimeOffModal
        open={deliveryTimeOffModal !== null}
        title={deliveryTimeOffModal?.title ?? ''}
        description={deliveryTimeOffModal?.description ?? ''}
        onProceed={() => {
          setDeliveryTimeOffModal(null);
          skipDeliveryTimeOffModalRef.current = true;
          void handlePlaceOrder();
        }}
        onClose={() => setDeliveryTimeOffModal(null)}
      />

      {/* Close Button when cart is empty and not in success view */}
      {!isOrderPlacedSuccess && (isCartEmpty ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close cart"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1.25rem',
            zIndex: 60,
            background: 'rgb(237 237 237)',
            border: 'none',
            borderRadius: '50%',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#000000',
            transition: 'background 0.2s',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      ) : (
        /* Top Header Bar with Close Button when not empty */
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: currentStep === 'cart' ? '0.9rem 0.9rem 0.9rem 1.2rem' : '0.9rem 0.9rem 0.9rem 0.9rem',
            width: '100%',
            boxSizing: 'border-box',
            position: 'sticky',
            top: 0,
            background: 'rgb(255 255 255 / 75%)',
            backdropFilter: 'blur(12px) saturate(3.5)',
            WebkitBackdropFilter: 'blur(12px) saturate(3.5)',
            zIndex: 50,
            borderBottom: '1px solid rgba(241, 245, 249, 0.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {currentStep !== 'cart' && (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 'address') goToStep('cart');
                  else if (currentStep === 'review') goToStep('address');
                }}
                style={{
                  background: 'rgb(237 237 237)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#000000',
                  transition: 'background 0.2s',
                }}
                aria-label="Go back"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827', letterSpacing: '-0.3px' }}>
              {currentStep === 'cart' && 'Cart'}
              {currentStep === 'address' && 'Delivery Address'}
              {currentStep === 'review' && 'Pay'}
            </h2>

            {currentStep === 'cart' && (
              <span
                style={{
                  background: 'rgb(237 237 237)',
                  color: 'rgb(0 0 0)',
                  borderRadius: '999px',
                  padding: '0.1rem 0.35rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {totalItemCount}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            style={{
              background: 'rgb(237 237 237)',
              border: 'none',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#000000',
              transition: 'background 0.2s',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {/* Progress Bar (Matching 1:1 with attached image) */}
      {!isOrderPlacedSuccess && !isCartEmpty && (
        <div className={checkoutStyles.progressBar} style={{ margin: '1.25rem 0 1rem 0', padding: '0 1rem' }}>
          <div
            className={`${checkoutStyles.progressStep} ${currentStep === 'cart' ? checkoutStyles.progressStepActive : checkoutStyles.progressStepCompleted} ${checkoutStyles.progressStepClickable}`}
            onClick={() => goToStep('cart')}
          >
            <span className={checkoutStyles.stepNumber} style={currentStep !== 'cart' ? { background: '#00835d', color: '#fff', borderColor: '#00835d' } : { background: 'rgb(171 100 104)', color: 'rgb(255, 255, 255)', borderColor: 'rgb(171 100 104)' }}>1</span>
            <span className={checkoutStyles.stepLabel}>Cart</span>
          </div>
          <div
            className={`${checkoutStyles.progressStep} ${currentStep === 'address' ? checkoutStyles.progressStepActive : currentStep === 'review' ? checkoutStyles.progressStepCompleted : ''} ${checkoutStyles.progressStepClickable}`}
            onClick={() => { if (currentStep === 'review') goToStep('address'); }}
          >
            <span className={checkoutStyles.stepNumber} style={currentStep === 'review' ? { background: '#00835d', color: '#fff', borderColor: '#00835d' } : currentStep === 'address' ? { background: 'rgb(171 100 104)', color: 'rgb(255, 255, 255)', borderColor: 'rgb(171 100 104)' } : {}}>2</span>
            <span className={checkoutStyles.stepLabel}>Address</span>
          </div>
          <div
            className={`${checkoutStyles.progressStep} ${currentStep === 'review' ? checkoutStyles.progressStepActive : ''}`}
          >
            <span className={checkoutStyles.stepNumber} style={currentStep === 'review' ? { background: 'rgb(171 100 104)', color: 'rgb(255, 255, 255)', borderColor: 'rgb(171 100 104)' } : {}}>3</span>
            <span className={checkoutStyles.stepLabel}>Pay</span>
          </div>
        </div>
      )}

      {/* ================= ORDER SUCCESS VIEW IN EXPANDED CART ================= */}
      {isOrderPlacedSuccess && (
        <div className={styles.drawerSuccessContainer}>
          {/* Rounded Order# badge with copy button at the top centre */}
          {placedOrderNumber && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(placedOrderNumber);
                setCopiedOrderNumber(true);
                setTimeout(() => setCopiedOrderNumber(false), 2000);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.45rem 0.8rem',
                background: 'rgb(237 237 237)',
                border: '1px solid rgb(237 237 237)',
                borderRadius: '999px',
                color: 'rgb(72 72 72)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: '-1.25rem',
                marginBottom: '1.85rem',
                transition: 'all 0.2s ease',
              }}
              title="Click to copy order number"
            >
              <span>Order #{placedOrderNumber}</span>
              {copiedOrderNumber ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00a365" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
              {copiedOrderNumber && <span style={{ fontSize: '0.72rem', color: '#00a365', marginLeft: '2px' }}>Copied!</span>}
            </button>
          )}

          <div className={orderSuccessStyles.successSection} style={{ marginBottom: '0.5rem', paddingBottom: 0 }}>
            <div className={orderSuccessStyles.successIcon} style={{ width: '62px', height: '62px', margin: '0 auto 0.85rem' }}>
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '62px', height: '62px' }}>
                <path fillRule="evenodd" clipRule="evenodd" d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM16.0303 8.96967C16.3232 9.26256 16.3232 9.73744 16.0303 10.0303L11.0303 15.0303C10.7374 15.3232 10.2626 15.3232 9.96967 15.0303L7.96967 13.0303C7.67678 12.7374 7.67678 12.2626 7.96967 11.9697C8.26256 11.6768 8.73744 11.6768 9.03033 11.9697L10.5 13.4393L12.7348 11.2045L14.9697 8.96967C15.2626 8.67678 15.7374 8.67678 16.0303 8.96967Z" fill="#00a365" />
              </svg>
            </div>
            <h1 className={orderSuccessStyles.successTitle} style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.35rem 0', color: '#000000', letterSpacing: '-0.5px' }}>
              Thank you for your order!
            </h1>
            <p className={orderSuccessStyles.successMessage} style={{ fontSize: '0.85rem', color: '#000000', maxWidth: '280px', margin: '0 auto', lineHeight: 1.45, fontWeight: 500 }}>
              Your order has been received and is being processed
            </p>
          </div>

          <div className={orderSuccessStyles.actionButtons} style={{ borderTop: 'none', width: 'auto', display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
            <Link
              href="/orders"
              className={orderSuccessStyles.viewOrdersButton}
              onClick={() => {
                setIsOrderPlacedSuccess(false);
                onClose();
              }}
              style={{
                width: 'auto',
                padding: '0.55rem 0.9rem',
                fontSize: '0.85rem',
                borderRadius: '80px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#ab6468',
                boxShadow: 'inset 0px 0px 3px 0px #f9f9f9',
                border: '1px solid #8d464b',
                color: '#ffffff',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              View Orders
            </Link>
          </div>
        </div>
      )}

      {/* ================= STEP 1: CART ================= */}
      {!isOrderPlacedSuccess && currentStep === 'cart' && (
        <div key="step-cart" className={styles.stepContentTransition}>
          {items.length === 0 && !subscriptionCartItem ? (
            <div
              className={styles.emptyCart}
              style={{
                padding: '2rem 1.5rem',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                margin: 'auto 0',
                minHeight: 'auto',
              }}
            >
              <svg viewBox="0 0 400 400" fill="none" className={styles.emptyCartIcon}>
                <path d="M269.824 261.753C246.209 228.062 203.138 282.309 233.404 304.514C256.923 321.77 284.534 294.874 273.492 271.471" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                <path d="M252.318 221.946C248.159 130.522 192.256 79 101.382 79" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                <path d="M221.698 142.794C214.564 147.712 206.557 151.319 200.029 157.146C125.176 223.994 110.888 147.382 86.2657 206.588" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                <path d="M252.318 221.946C349.522 252.45 296.046 294.219 314.735 320" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                <path d="M248.785 221.978C106.971 219.909 227.399 321.76 174.591 319.978" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              <h1 className={styles.emptyCartText}>Your cart is empty</h1>
              <p className={styles.emptyCartTagline}>This cart deserves better.</p>
              <button type="button" onClick={onClose} className={styles.continueShoppingButton} style={{ border: 'none', cursor: 'pointer' }}>
                Continue shopping
              </button>
            </div>
          ) : (
            <>
              <div style={{ padding: '0.5rem 1rem 1rem 1rem', width: '100%', boxSizing: 'border-box' }}>
                <div className={styles.cartLayout} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: 0 }}>
                  {/* Cart Items */}
                  <div className={styles.cartItemsColumn} style={{ width: '100%' }}>
                    <div className={styles.itemsList}>
                      {items.map((it) => {
                        const p = products[it.productId];
                        if (!shouldShowCartPriceLine(it, p)) return null;
                        const v = it.variationId ? (p?.variations || []).find((x) => x.id === it.variationId) : null;
                        const itemKey = getItemKey(it.productId, it.variationId, it.customizations);
                        const photobooth = getPhotoboothCartProject(it);
                        const photobook = getPhotobookCartProject(it);
                        const itemTotal = getCartItemOrderSubtotalContribution(it, p);

                        const productImage = photobooth
                          ? photobooth?.previewUrl || (p ? getPrimaryProductImageUrl(p) : null) || '/placeholder-product.png'
                          : photobook
                          ? (p ? getPrimaryProductImageUrl(p) : null) || '/placeholder-product.png'
                          : (p ? getPrimaryProductImageUrl(p) : null) || '/placeholder-product.png';

                        return (
                          <div key={itemKey} className={`${styles.cartItem} ${styles.drawerCartItem}`}>
                            <div className={styles.itemImage}>
                              {productImage && productImage !== '/placeholder-product.png' ? (
                                <Image src={productImage} alt={p?.name || 'Product'} width={80} height={80} style={{ objectFit: 'cover', borderRadius: '8px' }} />
                              ) : (
                                <div className={styles.itemImagePlaceholder}>🎁</div>
                              )}
                            </div>
                            <div className={styles.itemDetails}>
                              <h3 className={styles.itemTitle}>{photobooth ? 'Photobooth Print' : photobook ? `${p?.name || 'Photobook'} (${photobook.projectName || 'My Project'})` : p ? p.name : 'Loading...'}</h3>
                              {photobook && (
                                <div className={styles.itemInfo}>
                                  <span>{photobook.pageCount} pages</span>
                                </div>
                              )}
                              {photobooth && (
                                <div className={styles.itemInfo}>
                                  <span>{photobooth.label}</span>
                                  <span>{getPhotoboothPrintsLabel(it)}</span>
                                </div>
                              )}
                              {(() => {
                                const descParts = getCustomizationDescriptionParts(it, p);
                                const variationLabel = v?.size
                                  ? (/^size\s*:/i.test(v.size.trim()) || v.size.includes(':') ? v.size.trim() : `Size: ${v.size.trim()}`)
                                  : (v as any)?.name
                                  ? `Variation: ${(v as any).name}`
                                  : null;

                                return (
                                  <>
                                    {descParts.length > 0 && (
                                      <div className={styles.itemVariationList}>
                                        {descParts.map((desc) => (
                                          <span key={desc}>{desc}</span>
                                        ))}
                                      </div>
                                    )}
                                    {variationLabel && !descParts.some((d) => d.toLowerCase().includes(variationLabel.toLowerCase())) && (
                                      <div className={styles.itemVariationList}>
                                        <span>{variationLabel}</span>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                              {it.customizations?.giftWrap && (
                                <div className={styles.itemGiftWrapInfo}>
                                  <span>🎁 Premium Gift Wrap (+₹{it.customizations.giftWrap.price})</span>
                                  {it.customizations.giftWrap.comment && (
                                    <span className={styles.itemGiftWrapComment}>&ldquo;{it.customizations.giftWrap.comment}&rdquo;</span>
                                  )}
                                </div>
                              )}
                              <div className={styles.itemPrice}>₹{formatINR(itemTotal)}</div>
                            </div>
                            <div className={styles.itemActions}>
                              <div className={styles.quantitySelector}>
                                <button type="button" onClick={() => handleQuantityChange(it.productId, it.variationId, -1, it.customizations)} className={styles.quantityButton} disabled={it.quantity <= 1}>−</button>
                                <span className={styles.quantityValue}>{it.quantity}</span>
                                <button type="button" onClick={() => handleQuantityChange(it.productId, it.variationId, 1, it.customizations)} className={styles.quantityButton}>+</button>
                              </div>
                              <button type="button" onClick={() => removeItem(it.productId, it.variationId, it.customizations)} className={styles.removeButton} aria-label="Remove item">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary Column */}
                  <div className={styles.summaryColumn} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                              className={styles.couponInput}
                              onKeyPress={(e) => e.key === 'Enter' && handleApplyCoupon()}
                            />
                            <button onClick={() => handleApplyCoupon()} className={styles.applyCouponButton} disabled={!couponCode.trim() || validatingCoupon}>
                              {validatingCoupon ? '...' : 'Apply'}
                            </button>
                          </div>
                          <p className={styles.availableCouponsHint} onClick={() => setIsCouponModalOpen(true)}>
                            Click here for available coupons %
                          </p>
                        </>
                      )}
                    </div>

                    {giftingConfig.enabled && (
                      <div className={`${styles.summarySection} ${styles.giftingSection}`}>
                        <h3 className={styles.sectionTitle}>Gifting</h3>
                        <div className={styles.giftingBox}>
                          <div className={styles.giftingContent}>
                            <h4 className={styles.giftingTitle}>Buying for a loved one?</h4>
                            <p className={styles.giftingDescription}>Add premium gift wrapping to your order for just ₹{giftingConfig.price}</p>
                            <button type="button" className={styles.giftingButton} onClick={handleOpenGiftModal}>
                              {hasAnyGiftWrap ? 'Edit gift wrap' : 'Add gift wrap'}
                            </button>
                          </div>
                          <div className={styles.giftingIconWrapper}>
                            <DotLottieReact src="/animations/gift.json" autoplay loop />
                          </div>
                        </div>
                      </div>
                    )}

                    {renderPriceDetailsCard()}
                  </div>
                </div>
              </div>

              {/* Sticky Checkout Bar */}
              <div
                style={{
                  position: 'sticky',
                  bottom: '6px',
                  width: 'calc(100% - 12px)',
                  margin: 'auto 6px 6px 6px',
                  boxSizing: 'border-box',
                  background: 'rgb(255 255 255 / 56%)',
                  borderRadius: '24px',
                  backdropFilter: 'blur(9px) saturate(2.5)',
                  WebkitBackdropFilter: 'blur(9px) saturate(2.5)',
                  padding: '0.85rem 1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.4)',
                  zIndex: 40,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Total amount</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#000000' }}>₹{formatINR(total)}</span>
                </div>
                <button
                  onClick={() => goToStep('address')}
                  className={styles.placeOrderButton}
                  style={{ width: 'auto', padding: '0.85rem 2rem', borderRadius: '80px', margin: 0, minWidth: '140px', background: '#ff0054' }}
                >
                  <span>Checkout</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================= STEP 2: ADDRESS (MATCHING SCREENSHOT) ================= */}
      {!isOrderPlacedSuccess && currentStep === 'address' && (
        <div key="step-address" className={styles.stepContentTransition}>
          <div style={{ padding: '0 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
            {/* Delivery Address Card */}
            <div className={checkoutStyles.stepCard} style={{ background: '#ffffff', borderRadius: '24px', padding: '1.25rem' }}>
              {/* If user not logged in: show login form */}
              {!isAuthenticated || !user ? (
                <div className={checkoutStyles.loginSection}>
                  {loginError && <div className={checkoutStyles.errorMessage}>{loginError}</div>}
                  <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <FloatingLabelInput id="addrLoginEmail" label="Email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required noMarginBottom={true} />
                    <FloatingLabelInput id="addrLoginPass" label="Password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required noMarginBottom={true} />
                    <button type="submit" disabled={loginLoading} className={checkoutStyles.primaryButton} style={{ background: '#ff0054' }}>
                      {loginLoading ? 'Logging in...' : 'Login & Continue'}
                    </button>
                    <div className={checkoutStyles.orDivider}><span>or</span></div>
                    <button type="button" onClick={() => loginWithGoogle()} className={checkoutStyles.googleButton}>
                      Continue with Google
                    </button>
                  </form>
                </div>
              ) : (
                <div className={checkoutStyles.addressSection}>
                  {addressError && <div className={checkoutStyles.errorMessage}>{addressError}</div>}

                  {/* Saved addresses list */}
                  {savedAddresses.length > 0 && (
                    <div className={checkoutStyles.savedAddressesSection}>
                      <h3 className={checkoutStyles.savedAddressesTitle} style={{ fontSize: '0.95rem', fontWeight: 600, color: '#111827', margin: '0 0 0.75rem 0' }}>
                        Select a saved address
                      </h3>
                      <div className={checkoutStyles.savedAddressesList} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {savedAddresses.map((addr) => {
                          const isSelected = selectedAddressId === addr.id && !showCreateNewAddress;
                          return (
                            <div
                              key={addr.id}
                              className={`${checkoutStyles.savedAddressCard} ${isSelected ? checkoutStyles.savedAddressCardSelected : ''}`}
                              onClick={() => {
                                setSelectedAddressId(addr.id);
                                setShowCreateNewAddress(false);
                                setEditingAddressId(null);
                                fillAddressForm(addr);
                              }}
                              style={{
                                background: '#f5f5f5',
                                borderRadius: '20px',
                                padding: '1rem',
                                border: isSelected ? '1px solid #111827' : '1px solid transparent',
                                cursor: 'pointer',
                              }}
                            >
                              <input
                                type="radio"
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedAddressId(addr.id);
                                  setShowCreateNewAddress(false);
                                  setEditingAddressId(null);
                                  fillAddressForm(addr);
                                }}
                                className={checkoutStyles.addressRadio}
                                style={{ accentColor: '#000000', marginTop: '0.2rem', width: '21px', height: '21px', flexShrink: 0, cursor: 'pointer' }}
                              />
                              <div className={checkoutStyles.savedAddressContent}>
                                <div className={checkoutStyles.savedAddressHeader}>
                                  <span className={checkoutStyles.savedAddressName} style={{ fontWeight: 700, color: '#000000' }}>{addr.name}</span>
                                  {addr.isDefault && <span className={checkoutStyles.defaultBadge} style={{ background: '#e5e5e5', color: '#666', fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>Default</span>}
                                </div>
                                <div className={checkoutStyles.savedAddressDetails} style={{ fontSize: '0.85rem', color: '#555555', lineHeight: 1.45 }}>
                                  <p>{addr.street}</p>
                                  <p>{addr.city}, {addr.state} {addr.postalCode}</p>
                                  <p>{addr.country}</p>
                                  {addr.phone && <p>Phone: {addr.phone}</p>}
                                </div>
                              </div>
                                <button
                                type="button"
                                className={checkoutStyles.editAddressIconBtn}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingAddressId(addr.id);
                                  setShowCreateNewAddress(true);
                                  setSelectedAddressId(null);
                                  fillAddressForm(addr);
                                  scrollToAddressForm();
                                }}
                                style={{ background: '#ffffff', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {!showCreateNewAddress && (
                        <button
                          type="button"
                          className={checkoutStyles.createNewAddressButton}
                          onClick={() => {
                            setShowCreateNewAddress(true);
                            setSelectedAddressId(null);
                            setEditingAddressId(null);
                            setAddressForm({ name: user?.name || '', street: '', city: '', state: '', postalCode: '', country: 'India', phone: user?.phone || '', latitude: undefined, longitude: undefined });
                            scrollToAddressForm();
                          }}
                          style={{
                            width: '100%',
                            padding: '0.9rem',
                            background: '#f1f3f5',
                            color: '#000000',
                            border: 'none',
                            borderRadius: '80px',
                            fontWeight: 500,
                            fontSize: '0.95rem',
                            marginTop: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Create a new address
                        </button>
                      )}
                    </div>
                  )}

                  {/* Add / Edit address form */}
                  {(showCreateNewAddress || savedAddresses.length === 0) && (
                    <div ref={addressFormRef} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', scrollMarginTop: '1rem' }}>
                      <AddressLocationPicker
                        onLocationSelected={(loc) => {
                          setAddressForm((prev) => ({
                            ...prev,
                            street: loc.formattedAddress || prev.street,
                            city: loc.city || prev.city,
                            state: loc.state || prev.state,
                            postalCode: loc.postalCode || prev.postalCode,
                            latitude: loc.latitude,
                            longitude: loc.longitude,
                          }));
                        }}
                        initialAddress={addressForm.street}
                      />
                      <FloatingLabelInput id="addrNameInput" label="Full Name" value={addressForm.name} onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })} required noMarginBottom={true} />
                      <FloatingLabelInput id="addrPhoneInput" label="Phone" type="tel" value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} required noMarginBottom={true} />
                      <FloatingLabelInput id="addrStreetInput" label="Flat, House no., Street address" value={addressForm.street} onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })} required noMarginBottom={true} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <FloatingLabelInput id="addrCityInput" label="City" value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} required noMarginBottom={true} />
                        <FloatingLabelInput id="addrStateInput" label="State" value={addressForm.state} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} required noMarginBottom={true} />
                      </div>
                      <FloatingLabelInput id="addrPinInput" label="Pincode (6 digits)" value={addressForm.postalCode} onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })} maxLength={6} required noMarginBottom={true} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sticky Checkout Bar */}
          <div
            style={{
              position: 'sticky',
              bottom: '6px',
              width: 'calc(100% - 12px)',
              margin: 'auto 6px 6px 6px',
              boxSizing: 'border-box',
              background: 'rgb(255 255 255 / 56%)',
              borderRadius: '24px',
              backdropFilter: 'blur(9px) saturate(2.5)',
              WebkitBackdropFilter: 'blur(9px) saturate(2.5)',
              padding: '0.85rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.4)',
              zIndex: 40,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Total amount</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#000000' }}>₹{formatINR(total)}</span>
            </div>
            <button
              type="button"
              onClick={handleAddressProceed}
              disabled={savingAddress}
              className={styles.placeOrderButton}
              style={{ width: 'auto', padding: '0.85rem 2rem', borderRadius: '80px', margin: 0, minWidth: '140px', background: '#ff0054' }}
            >
              <span>{savingAddress ? 'Saving...' : 'Checkout'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 3: PLACE ORDER / PAYMENT ================= */}
      {!isOrderPlacedSuccess && currentStep === 'review' && (
        <div key="step-review" className={styles.stepContentTransition}>
          <div style={{ padding: '0 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
            {/* Delivery Address Summary Card */}
            <div className={checkoutStyles.stepCard} style={{ background: '#ffffff', borderRadius: '24px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Delivery Address</span>
                <button
                  type="button"
                  onClick={() => goToStep('address')}
                  style={{ background: 'none', border: 'none', color: '#ff0054', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Change
                </button>
              </div>
              <p style={{ margin: '0 0 0.2rem 0', fontWeight: 700, color: '#000000', fontSize: '0.95rem' }}>{addressForm.name}</p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#555555', lineHeight: 1.4 }}>{addressForm.street}, {addressForm.city}, {addressForm.state} {addressForm.postalCode}</p>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>Phone: {addressForm.phone}</p>
            </div>

            {/* Payment Method Card */}
            <div className={checkoutStyles.stepCard} style={{ background: '#ffffff', borderRadius: '24px', padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 0.85rem 0', fontSize: '1rem', fontWeight: 800, color: '#000000' }}>Select Payment Method</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '16px',
                    border: paymentMethod === 'online' ? '2px solid #ff0054' : '1px solid #e2e8f0',
                    background: paymentMethod === 'online' ? '#fff5f7' : '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="checkoutPayMethod"
                    checked={paymentMethod === 'online'}
                    onChange={() => setPaymentMethod('online')}
                    style={{ width: '21px', height: '21px', accentColor: '#ff0054', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <div>
                    <span style={{ fontWeight: 700, color: '#111827', fontSize: '0.92rem' }}>Online Payment</span>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>UPI, Cards, NetBanking, Wallets</p>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '16px',
                    border: !codConfig.enabled ? '1px solid #e2e8f0' : paymentMethod === 'cod' ? '2px solid #ff0054' : '1px solid #e2e8f0',
                    background: !codConfig.enabled ? '#f8fafc' : paymentMethod === 'cod' ? '#fff5f7' : '#ffffff',
                    cursor: !codConfig.enabled ? 'not-allowed' : 'pointer',
                    opacity: !codConfig.enabled ? 0.45 : 1,
                  }}
                >
                  <input
                    type="radio"
                    name="checkoutPayMethod"
                    disabled={!codConfig.enabled}
                    checked={codConfig.enabled && paymentMethod === 'cod'}
                    onChange={() => {
                      if (codConfig.enabled) setPaymentMethod('cod');
                    }}
                    style={{ width: '21px', height: '21px', accentColor: '#ff0054', cursor: !codConfig.enabled ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                  />
                  <div>
                    <span style={{ fontWeight: 700, color: !codConfig.enabled ? '#94a3b8' : '#111827', fontSize: '0.92rem' }}>
                      Cash on Delivery (COD) {!codConfig.enabled && '(Unavailable)'}
                    </span>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                      {!codConfig.enabled ? 'COD is currently disabled' : 'Pay cash or UPI on delivery'}
                    </p>
                  </div>
                </label>

                {walletBalance > 0 && (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.85rem 1rem',
                      borderRadius: '16px',
                      border: paymentMethod === 'wallet' ? '2px solid #ff0054' : '1px solid #e2e8f0',
                      background: paymentMethod === 'wallet' ? '#fff5f7' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="checkoutPayMethod"
                      checked={paymentMethod === 'wallet'}
                      onChange={() => setPaymentMethod('wallet')}
                      style={{ width: '21px', height: '21px', accentColor: '#ff0054', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <div>
                      <span style={{ fontWeight: 700, color: '#111827', fontSize: '0.92rem' }}>House of Dahlia Wallet</span>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#047857' }}>Balance: ₹{formatINR(walletBalance)}</p>
                    </div>
                  </label>
                )}
              </div>
            </div>

            {/* Price Details & Payment Badges */}
            {renderPriceDetailsCard()}
          </div>

          {/* Sticky Place Order Bar */}
          <div
            style={{
              position: 'sticky',
              bottom: '6px',
              width: 'calc(100% - 12px)',
              margin: 'auto 6px 6px 6px',
              boxSizing: 'border-box',
              background: 'rgb(255 255 255 / 56%)',
              borderRadius: '24px',
              backdropFilter: 'blur(9px) saturate(2.5)',
              WebkitBackdropFilter: 'blur(9px) saturate(2.5)',
              padding: '0.85rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.4)',
              zIndex: 40,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Total amount</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#000000' }}>₹{formatINR(total)}</span>
            </div>
            <button
              type="button"
              onClick={handlePlaceOrder}
              disabled={placingOrder}
              className={styles.placeOrderButton}
              style={{ width: 'auto', padding: '0.85rem 2rem', borderRadius: '80px', margin: 0, minWidth: '140px', background: '#ff0054' }}
            >
              <span>{placingOrder ? 'Processing...' : 'Place Order'}</span>
            </button>
          </div>
        </div>
      )}

      <CouponModal
        isOpen={isCouponModalOpen}
        onClose={() => setIsCouponModalOpen(false)}
        subtotal={subtotal}
        platformFee={platformFee}
        onApply={(code) => handleApplyCoupon(code)}
      />

      {isGiftModalOpen && (
        <div className={`${styles.modalOverlay} ${isGiftModalClosing ? styles.modalOverlayClosing : styles.modalOverlayOpening}`} onClick={handleCloseGiftModal}>
          <div
            className={`${styles.giftModal} ${isGiftModalClosing ? styles.giftModalClosing : styles.giftModalOpening}`}
            style={{
              height: giftModalHeight ? `${giftModalHeight}px` : 'auto',
              transition: 'height 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div ref={giftModalContentRef}>
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
                  const availableOptions = cartItemOptions.filter((opt) => {
                    const key = getItemKey(opt.productId, opt.variationId, opt.customizations);
                    return !tempWrappedItems.some((w) => w.itemKey === key);
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
                                  const v = it.variationId && p ? (p.variations || []).find((x) => x.id === it.variationId) : null;
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
                              const cartItem = items.find((it) => getItemKey(it.productId, it.variationId, it.customizations) === item.itemKey);
                              if (!cartItem) return null;
                              const p = products[cartItem.productId];
                              const v = cartItem.variationId && p ? (p.variations || []).find((x) => x.id === cartItem.variationId) : null;
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
