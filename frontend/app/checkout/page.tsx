'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient, productsApi, couponsApi, Coupon, addressesApi, walletApi, contentApi, subscriptionsApi } from '@/lib/api';
import { SITE_NAME } from '@/lib/seo';
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
  sumPhotoboothDeliveryFees,
} from '@/lib/utils/cartPricing';
import {
  collectPhotobookProjectIdsFromCart,
  finalizePhotobookProjectsAfterPayment,
} from '@/lib/photobook/postPurchase';
import { getPhotobookCartProject } from '@/lib/photobook/cartHelpers';
import Link from 'next/link';
import FloatingLabelInput from '@/components/ui/FloatingLabelInput';
import { readCheckoutCouponCode, saveCheckoutCouponCode } from '@/lib/utils/checkoutCoupon';
import {
  readSubscriptionCartJson,
  clearSubscriptionCart,
  scopedSubscriptionCartKey,
} from '@/lib/utils/userScopedStorage';
import { normalizeDeliveryRatesConfig, resolveDeliveryRate } from '@/lib/utils/deliveryRates';
import { useDeliveryTimeOffConfig } from '@/hooks/useDeliveryTimeOffConfig';
import DeliveryTimeOffModal from '@/components/DeliveryTimeOffModal';
import styles from './checkout.module.css';

const AddressLocationPicker = dynamic(() => import('@/components/AddressLocationPicker'), { ssr: false });

function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853" />
      <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.335z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 127.14 96.36" fill="#5865F2" xmlns="http://www.w3.org/2000/svg">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c1-.72,1.93-1.48,2.83-2.28a74.58,74.58,0,0,0,72.24,0c.9,0.8,1.83,1.56,2.83,2.28a68.43,68.43,0,0,1-10.5,5A77.7,77.7,0,0,0,95.14,85.51,105.73,105.73,0,0,0,126.14,77.53C130,54.65,123.36,31.58,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z"/>
    </svg>
  );
}





function XIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#1a1a1a" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

type CheckoutStep = 'login' | 'address' | 'review';
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

function subscriptionPlanSummaryLine(sub: SubscriptionCartItem): string {
  const period =
    sub.durationDays != null && sub.durationDays >= 1
      ? `${sub.durationDays} day(s)`
      : `${sub.durationMonths} month(s)`;
  const freq = sub.frequency || 'daily';
  return `Qty: ${sub.litresPerDay} L/day | Period: ${period} | Delivery: ${sub.deliveryTime} | Frequency: ${freq}`;
}

type StoredOrderSummary = {
  subtotal: number;
  discount: number;
  deliveryCharges: number;
  platformFee: number;
  total: number;
  paymentMethod: 'cod' | 'online' | 'wallet';
  couponCode: string | null;
  savings: number;
};
function isAddressLockedByAnyExistingSubscription(subscriptions: { addressId?: string; status?: string }[], addressId: string): boolean {
  return subscriptions.some((sub) => {
    if (String(sub.addressId || '') !== String(addressId)) return false;
    const status = String(sub.status || '').toLowerCase();
    return status !== 'cancelled' && status !== 'expired';
  });
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const { user, isAuthenticated, login, loginWithGoogle, loginWithFacebook, loginWithDiscord, loginWithTwitter, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const subCartUserId = user?.id ?? null;
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('address');
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [isFirstProductOrder, setIsFirstProductOrder] = useState(false);
  const [stepInitialized, setStepInitialized] = useState(false);
  const manualStepChange = useRef(false);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Address form state
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
  const [addressError, setAddressError] = useState('');

  // Saved addresses state
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showCreateNewAddress, setShowCreateNewAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [saveAddress, setSaveAddress] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [savingAddressForCheckout, setSavingAddressForCheckout] = useState(false);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponValidation, setCouponValidation] = useState<{
    status: 'idle' | 'valid' | 'invalid';
    message: string;
    coupon: Coupon | null;
  }>({ status: 'idle', message: '', coupon: null });
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online' | 'wallet'>('cod');
  const skipDeliveryTimeOffModalRef = useRef(false);
  const { evaluate: evaluateDeliveryTimeOff } = useDeliveryTimeOffConfig();
  const [deliveryTimeOffModal, setDeliveryTimeOffModal] = useState<{ title: string; description: string } | null>(null);

  // Wallet balance for showing "Use Wallet" option during checkout
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(false);
  const [subscriptionCartItem, setSubscriptionCartItem] = useState<SubscriptionCartItem | null>(null);
  const [platformFee, setPlatformFee] = useState(0);
  const [deliveryRatesConfig, setDeliveryRatesConfig] = useState<{ warehouseLatitude?: number; warehouseLongitude?: number; ranges: Array<{ startMeters: number; endMeters: number; rate: number }> }>({ ranges: [] });
  const [backendPlatformFee, setBackendPlatformFee] = useState<number | null>(null);
  const [backendDeliveryCharges, setBackendDeliveryCharges] = useState<number | null>(null);
  const [backendFeesLoading, setBackendFeesLoading] = useState(false);

  // Load products
  useEffect(() => {
    const loadProducts = async () => {
      // Wait a bit to ensure cart context has loaded from localStorage
      // Cart context loads items in useEffect, so we need to wait for it
      await new Promise(resolve => setTimeout(resolve, 200));

      // Double-check items after waiting
      if (items.length === 0 && !subscriptionCartItem) {
        // Only redirect if we're sure there are no items
        // This prevents redirect loop if items are still loading
        router.push('/cart');
        return;
      }

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
      setLoading(false);
    };

    // Only run if we have items or if loading is still true
    if (items.length > 0 || subscriptionCartItem || loading) {
      loadProducts();
    }
  }, [items, router, loading, subscriptionCartItem]);

  // Load subscription cart item (added from cart -> subscribe flow)
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
          parsed?.type === 'subscription'
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

  // Initialize step - always start at address step (which will show login if needed)
  useEffect(() => {
    if (stepInitialized) return; // Only run once

    // Always start at address step (step 2)
    // The address step will show login form if user is not authenticated
    setCurrentStep('address');
    setStepInitialized(true);
  }, [stepInitialized]);

  useEffect(() => {
    let cancelled = false;

    const loadPlatformFee = async () => {
      try {
        const data = await contentApi.getByType('platform_fee');
        const metadataAmount = Number(data.metadata?.amount);
        const titleAmount = Number(data.title);
        const amount = Number.isFinite(metadataAmount) ? metadataAmount : titleAmount;
        if (!cancelled) {
          setPlatformFee(Number.isFinite(amount) && amount > 0 ? amount : 0);
        }
      } catch {
        if (!cancelled) {
          setPlatformFee(0);
        }
      }
    };

    loadPlatformFee();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDeliveryRates = async () => {
      try {
        const data = await contentApi.getByType('delivery_rates');
        if (!cancelled) {
          setDeliveryRatesConfig(normalizeDeliveryRatesConfig(data.metadata || {}));
        }
      } catch {
        if (!cancelled) {
          setDeliveryRatesConfig({ ranges: [] });
        }
      }
    };

    loadDeliveryRates();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load wallet balance for the "Use Wallet" payment choice
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isAuthenticated || !user) {
        setWalletBalance(0);
        return;
      }

      setWalletLoading(true);
      try {
        const summary = await walletApi.getSummary();
        if (cancelled) return;
        setWalletBalance(summary.balance || 0);
      } catch {
        if (cancelled) return;
        setWalletBalance(0);
      } finally {
        if (!cancelled) setWalletLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  // Load dynamic checkout fees (delivery rate + platform fee) from the backend
  useEffect(() => {
    let cancelled = false;

    if (items.length === 0 && !subscriptionCartItem) return;

    // Get current address coordinates & details
    const activeAddress: any = { ...addressForm };
    if (!showCreateNewAddress && selectedAddressId) {
      activeAddress.id = selectedAddressId;
    } else if (showCreateNewAddress && editingAddressId) {
      activeAddress.id = editingAddressId;
    }

    const activePostalCode = activeAddress.postalCode || activeAddress.postal_code || addressForm.postalCode;
    if (!activePostalCode && !activeAddress.latitude) {
      return;
    }

    const fetchBackendFees = async () => {
      setBackendFeesLoading(true);
      try {
        const res = await apiClient.post<{
          platformFee: number;
          deliveryCharges: number;
          isFirstProductOrder: boolean;
          isNationwideDelivery: boolean;
          shiprocketResult: any;
        }>('/api/orders/checkout-fees', {
          items: items.map((it) => ({
            productId: it.productId,
            variationId: it.variationId || null,
            quantity: it.quantity,
          })),
          deliveryAddress: activeAddress,
          paymentMethod,
        });

        if (!cancelled && res) {
          setBackendPlatformFee(res.platformFee);
          setBackendDeliveryCharges(res.deliveryCharges);
        }
      } catch (err) {
        console.error('Failed to fetch backend checkout fees:', err);
      } finally {
        if (!cancelled) setBackendFeesLoading(false);
      }
    };

    // Debounce a little bit to avoid spamming the backend
    const timer = setTimeout(fetchBackendFees, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [items, subscriptionCartItem, selectedAddressId, showCreateNewAddress, editingAddressId, addressForm.postalCode, addressForm.latitude, addressForm.longitude, paymentMethod, isAuthenticated]);

  // When entering step 3 (review), scroll to the top of the page
  useEffect(() => {
    if (currentStep === 'review' && typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    }
  }, [currentStep]);

  // Helper function to set step with manual flag
  const setStep = (step: CheckoutStep) => {
    manualStepChange.current = true;
    setCurrentStep(step);
  };

  // Handle login (stays on address step, just hides login form)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!email || !password) {
      setLoginError('Please fill in all required fields');
      return;
    }

    setLoginLoading(true);
    try {
      await login(email, password);
      // Stay on address step, login form will hide automatically
      // Clear login form
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Fetch saved addresses when user is authenticated
  useEffect(() => {
    const fetchAddresses = async () => {
      if (!isAuthenticated || !user) {
        setSavedAddresses([]);
        return;
      }

      try {
        setLoadingAddresses(true);
        const addresses = await addressesApi.getAll();
        setSavedAddresses(addresses);

        // If user has addresses and no address is selected, select the default one
        if (addresses.length > 0 && !selectedAddressId) {
          const defaultAddress = addresses.find(addr => addr.isDefault) || addresses[0];
          if (defaultAddress) {
            setSelectedAddressId(defaultAddress.id);
            fillAddressForm(defaultAddress);
          }
        }
      } catch (error) {
        console.error('Failed to fetch addresses:', error);
      } finally {
        setLoadingAddresses(false);
      }
    };

    fetchAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  useEffect(() => {
    let cancelled = false;

    const loadFirstOrderStatus = async () => {
      if (!isAuthenticated || !user) {
        setIsFirstProductOrder(false);
        return;
      }

      try {
        const orders = await apiClient.get<Array<{ paymentStatus?: string }>>('/api/orders');
        if (cancelled) return;
        const eligiblePriorOrders = Array.isArray(orders)
          ? orders.filter((order) => order?.paymentStatus === 'paid' || order?.paymentStatus === 'cod')
          : [];
        setIsFirstProductOrder(eligiblePriorOrders.length === 0);
      } catch {
        if (!cancelled) {
          setIsFirstProductOrder(false);
        }
      }
    };

    loadFirstOrderStatus();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  // Fill address form with selected address
  const fillAddressForm = (address: Address) => {
    setAddressForm({
      name: address.name,
      street: address.street,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country || 'India',
      phone: address.phone || '',
      latitude: address.latitude,
      longitude: address.longitude,
    });
  };

  const isDeliverablePostalCode = (postalCode: string) => {
    const pin = (postalCode || '').trim();
    if (pin.length !== 6) return false;
    const pinSet = new Set<string>();
    const allProductIds = [
      ...items.map((item) => item.productId),
      ...(subscriptionCartItem?.productId ? [subscriptionCartItem.productId] : []),
    ];
    allProductIds.forEach((id) => {
      const p = products[id];
      (p?.deliveryPincodes || []).forEach((x) => pinSet.add(String(x)));
    });
    if (pinSet.size === 0) return true;
    return allProductIds.every((id) => {
      const p = products[id];
      if (p?.isNationwideDelivery) return true;
      const list = p?.deliveryPincodes || [];
      if (list.length === 0) return true;
      return list.includes(pin);
    });
  };

  // Handle address selection
  const handleAddressSelect = (addressId: string) => {
    setSelectedAddressId(addressId);
    setShowCreateNewAddress(false);
    setEditingAddressId(null);
    const address = savedAddresses.find(addr => addr.id === addressId);
    if (address) {
      fillAddressForm(address);
    }
  };

  // Handle create new address option
  const handleCreateNewAddress = () => {
    setShowCreateNewAddress(true);
    setSelectedAddressId(null);
    setEditingAddressId(null);
    setAddressForm({
      name: '',
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
      phone: '',
      latitude: undefined,
      longitude: undefined,
    });
  };

  // Save new address to account when "Save this address" is checked (used by form submit and summary Checkout button)
  const saveNewAddressIfRequested = async (): Promise<{ ok: boolean }> => {
    if (editingAddressId) {
      if (!addressForm.name?.trim() || !addressForm.street?.trim() || !addressForm.city?.trim() || !addressForm.state?.trim() || !addressForm.postalCode?.trim() || !addressForm.country?.trim() || !addressForm.phone?.trim()) {
        setAddressError('Please fill in all required fields');
        return { ok: false };
      }
      try {
        const subscriptions = await subscriptionsApi.getAll().catch(() => []);
        if (isAddressLockedByAnyExistingSubscription(subscriptions, editingAddressId)) {
          setAddressError('This address is already used in an existing plan. Add a new address for future plans.');
          return { ok: false };
        }
        await addressesApi.update(editingAddressId, {
          name: addressForm.name.trim(),
          street: addressForm.street.trim(),
          city: addressForm.city.trim(),
          state: addressForm.state.trim(),
          postalCode: addressForm.postalCode.trim(),
          country: addressForm.country.trim(),
          phone: addressForm.phone.trim(),
          latitude: addressForm.latitude,
          longitude: addressForm.longitude,
        });
        const addresses = await addressesApi.getAll();
        setSavedAddresses(addresses);
        setSelectedAddressId(editingAddressId);
        setShowCreateNewAddress(false);
        setEditingAddressId(null);
        return { ok: true };
      } catch (error: any) {
        setAddressError(error.message || 'Failed to update address');
        return { ok: false };
      }
    }

    if (!saveAddress || selectedAddressId) return { ok: true };
    if (!addressForm.name?.trim() || !addressForm.street?.trim() || !addressForm.city?.trim() || !addressForm.state?.trim() || !addressForm.postalCode?.trim() || !addressForm.country?.trim() || !addressForm.phone?.trim()) {
      setAddressError('Please fill in all required fields');
      return { ok: false };
    }
    try {
      await addressesApi.create({
        name: addressForm.name.trim(),
        street: addressForm.street.trim(),
        city: addressForm.city.trim(),
        state: addressForm.state.trim(),
        postalCode: addressForm.postalCode.trim(),
        country: addressForm.country.trim(),
        phone: addressForm.phone.trim(),
        latitude: addressForm.latitude,
        longitude: addressForm.longitude,
        isDefault: savedAddresses.length === 0,
      });
      const addresses = await addressesApi.getAll();
      setSavedAddresses(addresses);
      return { ok: true };
    } catch (error: any) {
      setAddressError(error.message || 'Failed to save address');
      return { ok: false };
    }
  };

  // Handle address form submission
  const handleAddressSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setAddressError('');

    if (!addressForm.name?.trim() || !addressForm.street?.trim() || !addressForm.city?.trim() || !addressForm.state?.trim() || !addressForm.postalCode?.trim() || !addressForm.country?.trim() || !addressForm.phone?.trim()) {
      setAddressError('Please fill in all required fields');
      return;
    }
    if (!isAuthenticated || !user) {
      setAddressError('Please login to proceed with your order');
      return;
    }

    const { ok } = await saveNewAddressIfRequested();
    if (!ok) return;

    setStep('review');
  };

  const getCustomizationDescription = (it: CartItem, p: Product) => {
    if (!p.isCustomizable || !it.variationId) return '';
    const combo = (p.customizationCombinations || []).find(c => c.id === it.variationId);

    const descParts: string[] = [];
    if (combo) {
      Object.keys(combo.combinationKeys || {}).forEach(groupId => {
        const valId = combo.combinationKeys[groupId];
        const group = (p.customizationOptions || []).find(g => g.id === groupId);
        const val = group ? (group.values || []).find(v => v.id === valId) : null;
        if (group && val) {
          descParts.push(`${group.title}: ${val.name}`);
        }
      });
    }

    // Add text personalization summaries
    if (it.customizations && it.customizations.textPersonalization) {
      const textPers = it.customizations.textPersonalization;
      (p.customizationOptions || []).forEach(group => {
        if (group.type === 'text_input') {
          (group.values || []).forEach(val => {
            const inputKey = `${group.id}_${val.id}`;
            const textVal = textPers[inputKey] || '';
            if (textVal.trim()) {
              descParts.push(`${val.label}: "${textVal.trim()}"`);
            }
          });
        }
      });
    }

    return descParts.join(' | ');
  };

  // Calculate totals
  const itemsSubtotal = items.reduce((sum, it) => {
    const p = products[it.productId];
    if (!shouldShowCartPriceLine(it, p)) return sum;
    return sum + getCartItemOrderSubtotalContribution(it, p);
  }, 0);
  const photoboothDeliveryTotal = sumPhotoboothDeliveryFees(items);
  const subscriptionSubtotal = subscriptionCartItem?.totalAmount || 0;
  const subtotal = itemsSubtotal + subscriptionSubtotal;
  const totalGiftWrapFee = items.reduce((sum, it) => {
    return sum + (it.customizations?.giftWrap ? it.customizations.giftWrap.price : 0);
  }, 0);

  // Calculate discount
  const calculateDiscount = (): number => {
    if (couponValidation.status !== 'valid' || !couponValidation.coupon) {
      return 0;
    }

    const coupon = couponValidation.coupon;
    let discount = 0;

    if (coupon.discountType === 'percentage') {
      discount = (subtotal * coupon.discountValue) / 100;
      // Apply max discount cap if set
      if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
        discount = coupon.maxDiscountAmount;
      }
    } else {
      // Fixed amount
      discount = coupon.discountValue;
    }

    // Ensure discount doesn't exceed subtotal
    return Math.min(discount, subtotal);
  };

  const discount = calculateDiscount();
  const deliveryRateResult = resolveDeliveryRate(
    deliveryRatesConfig,
    addressForm.latitude,
    addressForm.longitude,
  );
  const fallbackDeliveryCharges = items.length > 0 && isFirstProductOrder ? 0 : deliveryRateResult.charge;
  const activeDeliveryCharges = backendDeliveryCharges !== null ? backendDeliveryCharges : fallbackDeliveryCharges;
  const activePlatformFee = backendPlatformFee !== null ? backendPlatformFee : platformFee;

  const displayedDeliveryCharges = photoboothDeliveryTotal + activeDeliveryCharges;
  const total = subtotal - discount + activeDeliveryCharges + activePlatformFee;

  const walletExtraToPay =
    Math.max(0, Math.round((total - walletBalance) * 100) / 100);
  const walletRemainingAfterOrder =
    Math.max(0, Math.round((walletBalance - total) * 100) / 100);
  const canUseWallet = !walletLoading && walletBalance > 0;

  // Your total savings = sum of (compareAtPrice - sellingPrice) * mult * qty per item
  const savings = items.reduce((sum, it) => {
    const p = products[it.productId];
    const { unitOff } = getCartItemPriceDetails(it, p);
    return sum + unitOff * it.quantity;
  }, 0);

  const isAddressFulfilled = !!(isAuthenticated && user) && (
    (savedAddresses.length > 0 && selectedAddressId && !showCreateNewAddress) ||
    !!(addressForm.name?.trim() && addressForm.street?.trim() && addressForm.city?.trim() && addressForm.state?.trim() && addressForm.postalCode?.trim() && addressForm.country?.trim() && addressForm.phone?.trim())
  );

  // Validate coupon code
  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponValidation({ status: 'idle', message: '', coupon: null });
      saveCheckoutCouponCode(null);
      return;
    }

    setValidatingCoupon(true);
    setCouponValidation({ status: 'idle', message: '', coupon: null });

    try {
      const coupon = await couponsApi.validate(couponCode.trim().toUpperCase(), subtotal);
      setCouponValidation({
        status: 'valid',
        message: `${couponCode.trim().toUpperCase()} code is valid`,
        coupon,
      });
      saveCheckoutCouponCode(couponCode.trim().toUpperCase());
    } catch (error: any) {
      setCouponValidation({
        status: 'invalid',
        message: `${couponCode.trim().toUpperCase()} code is invalid`,
        coupon: null,
      });
      saveCheckoutCouponCode(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  // Cart applies coupon to sessionStorage; re-validate here so address + payment steps use the same discount
  useEffect(() => {
    if (loading) return;
    if (items.length === 0 && !subscriptionCartItem) return;
    const stored = readCheckoutCouponCode();
    if (!stored) {
      setCouponValidation({ status: 'idle', message: '', coupon: null });
      setCouponCode('');
      return;
    }
    setCouponCode(stored);
    let cancelled = false;
    setValidatingCoupon(true);
    couponsApi
      .validate(stored, subtotal)
      .then((coupon) => {
        if (cancelled) return;
        setCouponValidation({
          status: 'valid',
          message: `${stored} applied`,
          coupon,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setCouponValidation({
          status: 'invalid',
          message: 'Coupon could not be applied',
          coupon: null,
        });
      })
      .finally(() => {
        if (!cancelled) setValidatingCoupon(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, subtotal, items.length, subscriptionSubtotal, subscriptionCartItem]);

  // Build order items for localStorage (with productName, imageUrl, unitPrice) so order-success can show them even if fetch fails
  const buildStoredOrderItems = () =>
    [
      ...items.filter((it) => shouldShowCartPriceLine(it, products[it.productId] ?? products[String(it.productId)])).map((it) => {
        const p = products[it.productId] ?? products[String(it.productId)];
        const photobooth = getPhotoboothCartProject(it);
        const v = p && it.variationId ? (p.variations || []).find((x) => String(x.id) === String(it.variationId)) : null;
        const unitPrice = getCartItemOrderSubtotalContribution(it, p) / Math.max(1, it.quantity);
        const desc = p ? getCustomizationDescription(it, p) : '';
        return {
          productId: String(it.productId),
          variationId: it.variationId ?? undefined,
          quantity: it.quantity,
          productName: photobooth ? (getPhotoboothPrintsLabel(it) ?? 'Photobooth print') : (p?.name ?? 'Product'),
          variationSize: photobooth
            ? undefined
            : p && p.isCustomizable
              ? desc
              : v?.size,
          imageUrl: photobooth?.previewUrl || p?.images?.[0]?.imageUrl || p?.imageUrl,
          unitPrice,
          taxPercent: p?.taxPercent ?? 0,
        };
      }),
      ...(subscriptionCartItem
        ? (() => {
          const subP = products[subscriptionCartItem.productId];
          const planSummary = subscriptionPlanSummaryLine(subscriptionCartItem);
          return [
            {
              productId: String(subscriptionCartItem.productId),
              variationId: subscriptionCartItem.variationId || undefined,
              quantity: 1,
              productName: `Plan for ${subscriptionCartItem.productName}`,
              variationSize: planSummary,
              imageUrl: subP?.images?.[0]?.imageUrl || subP?.imageUrl,
              unitPrice: subscriptionCartItem.totalAmount,
              taxPercent: subP?.taxPercent ?? 0,
            },
          ];
        })()
        : []),
    ];

  const buildStoredOrderSummary = (): StoredOrderSummary => ({
    subtotal: Number(subtotal.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    deliveryCharges: Number(displayedDeliveryCharges.toFixed(2)),
    platformFee: Number(platformFee.toFixed(2)),
    total: Number(total.toFixed(2)),
    paymentMethod,
    couponCode: couponValidation.status === 'valid'
      ? (couponValidation.coupon?.code || couponCode.trim().toUpperCase())
      : null,
    savings: Number((savings + discount).toFixed(2)),
  });

  /** Include DB address id when checkout uses a saved or in-edit address so subscription/order logic can reuse the row. */
  const buildDeliveryAddressForOrder = () => {
    const base = { ...addressForm };
    if (!showCreateNewAddress && selectedAddressId) {
      return { ...base, id: selectedAddressId };
    }
    if (showCreateNewAddress && editingAddressId) {
      return { ...base, id: editingAddressId };
    }
    return base;
  };

  const persistOrderSuccessData = () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('milko_order_items', JSON.stringify(buildStoredOrderItems()));
    localStorage.setItem('milko_delivery_address', JSON.stringify(buildDeliveryAddressForOrder()));
    localStorage.setItem('milko_order_savings', (savings + discount).toFixed(2));
    localStorage.setItem('milko_order_summary', JSON.stringify(buildStoredOrderSummary()));
  };

  // Load Razorpay checkout script (once)
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

  // Handle place order
  const handlePlaceOrder = async () => {
    if (!addressForm.name?.trim() || !addressForm.street?.trim() || !addressForm.city?.trim() || !addressForm.state?.trim() || !addressForm.postalCode?.trim() || !addressForm.country?.trim() || !addressForm.phone?.trim()) {
      showToast('Please fill in all required address fields', 'error');
      return;
    }
    if (!isDeliverablePostalCode(addressForm.postalCode)) {
      showToast('Selected pincode is not deliverable for one or more products in this order', 'error');
      return;
    }
    const unavailableCartProduct = items
      .map((item) => products[item.productId])
      .find((product) => product && (product.isActive === false || (typeof product.quantity === 'number' && product.quantity <= 0)));
    if (unavailableCartProduct) {
      showToast(`${unavailableCartProduct.name} is out of stock`, 'error');
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
        couponCode: couponValidation.status === 'valid' ? (couponValidation.coupon?.code || couponCode.trim().toUpperCase()) : null,
        deliveryAddress: buildDeliveryAddressForOrder(),
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
              const photobookIds = collectPhotobookProjectIdsFromCart(items);
              if (photobookIds.length > 0) {
                await finalizePhotobookProjectsAfterPayment(photobookIds);
              }
              persistOrderSuccessData();
              if (typeof window !== 'undefined') {
                localStorage.removeItem('referred_by_creator_slug');
              }
              clearCart();
              clearSubscriptionCart(subCartUserId);
              saveCheckoutCouponCode(null);
              router.push('/order-success');
            } catch (e) {
              console.error(e);
              alert('Payment verification failed. Please contact support with your order details.');
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

      persistOrderSuccessData();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('referred_by_creator_slug');
      }
      const photobookIds = collectPhotobookProjectIdsFromCart(items);
      if (photobookIds.length > 0) {
        await finalizePhotobookProjectsAfterPayment(photobookIds);
      }
      clearCart();
      clearSubscriptionCart(subCartUserId);
      saveCheckoutCouponCode(null);
      router.push('/order-success');
    } catch (error) {
      console.error('Failed to place order:', error);
      showToast((error as { message?: string })?.message || 'Failed to place order. Please try again.', 'error');
    } finally {
      if (!openedRazorpay) setPlacingOrder(false);
    }
  };

  const totalItemCount = items.filter((it) => shouldShowCartPriceLine(it, products[it.productId])).length
    + (subscriptionCartItem ? 1 : 0);

  const subscriptionCheckoutVariation = useMemo(() => {
    if (!subscriptionCartItem) return null;
    const p = products[subscriptionCartItem.productId];
    if (!p || !subscriptionCartItem.variationId) return null;
    return (p.variations || []).find((x) => String(x.id) === String(subscriptionCartItem.variationId)) ?? null;
  }, [subscriptionCartItem, products]);

  if (loading || authLoading || (items.length === 0 && !subscriptionCartItem)) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
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
      {/* Progress Bar - clickable: 1→cart, 2 from review, 3 when address fulfilled */}
      <div className={styles.progressBar}>
        <div
          className={`${styles.progressStep} ${styles.progressStepCompleted} ${styles.progressStepClickable}`}
          onClick={() => router.push('/cart')}
        >
          <span className={styles.stepNumber}>1</span>
          <span className={styles.stepLabel}>Cart</span>
        </div>
        <div
          className={`${styles.progressStep} ${currentStep === 'address' ? styles.progressStepActive : currentStep === 'review' ? styles.progressStepCompleted : ''} ${currentStep === 'review' ? styles.progressStepClickable : styles.progressStepDisabled}`}
          onClick={() => { if (currentStep === 'review') setStep('address'); }}
        >
          <span className={styles.stepNumber}>2</span>
          <span className={styles.stepLabel}>Address</span>
        </div>
        <div
          className={`${styles.progressStep} ${currentStep === 'review' ? styles.progressStepActive : ''} ${isAddressFulfilled ? styles.progressStepClickable : styles.progressStepDisabled}`}
          onClick={() => { if (isAddressFulfilled && currentStep === 'address') setStep('review'); }}
        >
          <span className={styles.stepNumber}>3</span>
          <span className={styles.stepLabel}>Place Order</span>
        </div>
      </div>

      <div className={styles.checkoutContent}>
        {/* Step content first; price summary at the bottom */}
        <div className={styles.stepsColumn}>
          {/* Step 2: Address (with optional Login if not authenticated) */}
          {currentStep === 'address' && (
            <div className={styles.stepCard}>
              {/* Show Login Form if user is not authenticated */}
              {!isAuthenticated || !user ? (
                <div className={styles.loginSection}>
                  <h2 className={styles.stepTitle}>Login to Continue</h2>
                  <p className={styles.stepDescription}>Please login to proceed with your order</p>

                  <form onSubmit={handleLogin} className={styles.loginForm}>
                    {loginError && (
                      <div className={styles.errorMessage}>{loginError}</div>
                    )}

                    <FloatingLabelInput
                      type="email"
                      label="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />

                    <div className={styles.passwordInputWrapper}>
                      <FloatingLabelInput
                        type={showPassword ? 'text' : 'password'}
                        label="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className={styles.passwordToggle}
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>

                    <button
                      type="submit"
                      className={styles.primaryButton}
                      disabled={loginLoading}
                    >
                      {loginLoading ? 'Logging in...' : 'Login'}
                    </button>

                    <div className={styles.orDivider}>
                      <span>or</span>
                    </div>

                    <button
                      type="button"
                      className={styles.googleButton}
                      onClick={() => loginWithGoogle()}
                    >
                      <GoogleIcon />
                      Continue with Google
                    </button>

                    {/* Social Auth Buttons Row */}
                    <div className={styles.socialButtonsRow}>
                      {/* Facebook */}
                      <button
                        type="button"
                        className={`${styles.facebookButton} ${styles.socialButton} ${styles.mutedSocialButton}`}
                        onClick={(e) => e.preventDefault()}
                        title="Coming soon"
                      >
                        <span className={styles.iconWrapper}>
                          <FacebookIcon />
                        </span>
                        <span className={styles.comingSoonText}>Coming soon</span>
                      </button>

                      {/* Discord */}
                      <button
                        type="button"
                        className={`${styles.facebookButton} ${styles.socialButton}`}
                        onClick={() => loginWithDiscord()}
                        title="Continue with Discord"
                      >
                        <DiscordIcon />
                      </button>



                      {/* X (Twitter) */}
                      <button
                        type="button"
                        className={`${styles.facebookButton} ${styles.socialButton}`}
                        onClick={() => loginWithTwitter()}
                        title="Continue with X"
                      >
                        <XIcon />
                      </button>
                    </div>
                  </form>

                  <div className={styles.authLinks}>
                    <p>Don&apos;t have an account? <a href="/auth/signup">Sign up</a></p>
                  </div>
                </div>
              ) : null}

              {/* Address Section - only when logged in */}
              {(isAuthenticated && user) && (
                <div className={styles.addressSection}>
                  <h2 className={styles.stepTitle}>Delivery Address</h2>
                  <p className={styles.stepDescription}>Please provide your delivery address</p>

                  {/* Saved Addresses Selection (if user has saved addresses) */}
                  {isAuthenticated && user && savedAddresses.length > 0 && (
                    <div className={styles.savedAddressesSection}>
                      <h3 className={styles.savedAddressesTitle}>Select a saved address</h3>
                      <div className={styles.savedAddressesList}>
                        {savedAddresses.map((address) => (
                          <div
                            key={address.id}
                            className={`${styles.savedAddressCard} ${selectedAddressId === address.id ? styles.savedAddressCardSelected : ''}`}
                            onClick={() => handleAddressSelect(address.id)}
                          >
                            <input
                              type="radio"
                              name="selectedAddress"
                              checked={selectedAddressId === address.id}
                              onChange={() => handleAddressSelect(address.id)}
                              className={styles.addressRadio}
                            />
                            <div className={styles.savedAddressContent}>
                              <div className={styles.savedAddressHeader}>
                                <span className={styles.savedAddressName}>{address.name}</span>
                                {address.isDefault && (
                                  <span className={styles.defaultBadge}>Default</span>
                                )}
                                {typeof address.latitude === 'number' && typeof address.longitude === 'number' && (
                                  <span className={styles.liveLocationAdded}>Live location added</span>
                                )}
                              </div>
                              <div className={styles.savedAddressDetails}>
                                <p>{address.street}</p>
                                <p>{address.city}, {address.state} {address.postalCode}</p>
                                <p>{address.country}</p>
                                {address.phone && <p>Phone: {address.phone}</p>}
                              </div>
                            </div>
                            <button
                              type="button"
                              className={styles.editAddressIconBtn}
                              aria-label="Edit address"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingAddressId(address.id);
                                setShowCreateNewAddress(true);
                                setSelectedAddressId(null);
                                fillAddressForm(address);
                              }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                      {!showCreateNewAddress && (
                        <button
                          type="button"
                          className={styles.createNewAddressButton}
                          onClick={handleCreateNewAddress}
                        >
                          Create a new address
                        </button>
                      )}
                    </div>
                  )}

                  {/* Address Form - Show when creating new address or no saved addresses */}
                  {(showCreateNewAddress || savedAddresses.length === 0) && (
                    <form onSubmit={handleAddressSubmit} className={styles.addressForm} noValidate>
                      {addressError && (
                        <div className={styles.errorMessage}>{addressError}</div>
                      )}

                      <div className={styles.combinedFields}>
                        <div className={styles.addressRow}>
                          <FloatingLabelInput
                            type="text"
                            label="Full Name"
                            value={addressForm.name}
                            onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
                            required
                          />

                          <FloatingLabelInput
                            type="tel"
                            label="Phone Number"
                            value={addressForm.phone}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                              setAddressForm({ ...addressForm, phone: cleaned });
                            }}
                            maxLength={10}
                            inputMode="numeric"
                            required
                          />
                        </div>

                        <FloatingLabelInput
                          type="text"
                          label="Street Address"
                          value={addressForm.street}
                          onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                          required
                        />

                        <div className={styles.addressRow}>
                          <FloatingLabelInput
                            type="text"
                            label="City"
                            value={addressForm.city}
                            onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                            required
                          />
                          <FloatingLabelInput
                            type="text"
                            label="State"
                            value={addressForm.state}
                            onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                            required
                          />
                        </div>

                        <div className={styles.addressRow}>
                          <FloatingLabelInput
                            type="text"
                            label="Postal Code"
                            value={addressForm.postalCode}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6);
                              setAddressForm({ ...addressForm, postalCode: cleaned });
                            }}
                            maxLength={6}
                            inputMode="numeric"
                            required
                          />
                          <FloatingLabelInput
                            type="text"
                            label="Country"
                            value={addressForm.country}
                            onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <AddressLocationPicker
                        latitude={addressForm.latitude}
                        longitude={addressForm.longitude}
                        onChange={({ latitude, longitude }) =>
                          setAddressForm((prev) => ({ ...prev, latitude, longitude }))
                        }
                      />

                      {/* Save Address Checkbox - Only show for new addresses when user is authenticated */}
                      {isAuthenticated && user && (showCreateNewAddress || savedAddresses.length === 0) && (
                        <div
                          className={styles.saveAddressCheckbox}
                          role="checkbox"
                          aria-checked={saveAddress}
                          tabIndex={0}
                          onPointerDown={(e) => {
                            // Prevent focus-on-click (can trigger scroll-into-view jumps on some browsers)
                            e.preventDefault();
                          }}
                          onClick={() => setSaveAddress((prev) => !prev)}
                          onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                              e.preventDefault();
                              setSaveAddress((prev) => !prev);
                            }
                          }}
                        >
                          <span className={`${styles.checkboxIcon} ${saveAddress ? styles.checkboxIconChecked : ''}`}>
                            {saveAddress && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" />
                              </svg>
                            )}
                          </span>
                          <span className={styles.checkboxLabel}>Save this address for future orders</span>
                        </div>
                      )}

                      {/* Submit in step card: only when no saved addresses. When creating new (with saved), use summary's Continue. */}
                      {savedAddresses.length === 0 && (
                        <button
                          type="submit"
                          className={styles.primaryButton}
                        >
                          {saveAddress ? 'Save Address & Continue' : 'Continue to Checkout'}
                        </button>
                      )}
                    </form>
                  )}

                </div>
              )}
            </div>
          )}

          {/* Step 3: Review & Place Order */}
          {currentStep === 'review' && (
            <div className={styles.stepCard}>
              <h2 className={styles.stepTitle}>Review Your Order</h2>
              <p className={styles.stepDescription}>Please review your order details before placing</p>

              {/* Order Items */}
              <div className={styles.orderItems}>
                <h3 className={styles.sectionTitle}>Order Items</h3>
                {items.map((it) => {
                  const p = products[it.productId];
                  const photobooth = getPhotoboothCartProject(it);
                  const v = it.variationId ? (p?.variations || []).find((x) => x.id === it.variationId) : null;
                  if (!shouldShowCartPriceLine(it, p)) return null;

                  const itemTotal = getCartItemPriceLineAmount(it, p);

                  return (
                    <div key={`${it.productId}:${it.variationId || ''}:${it.customizations ? JSON.stringify(it.customizations) : ''}`} className={styles.orderItem}>
                      <div className={styles.orderItemInfo}>
                        <span className={styles.orderItemName}>
                          {photobooth ? (getPhotoboothPrintsLabel(it) ?? 'Photobooth print') : (p?.name || 'Product')}
                        </span>
                        {photobooth ? null : p && p.isCustomizable ? (
                          <>
                            {(() => {
                              const desc = getCustomizationDescription(it, p);
                              return desc ? <span className={styles.orderItemVariation}>{desc}</span> : null;
                            })()}
                          </>
                        ) : (
                          v && <span className={styles.orderItemVariation}>{v.size}</span>
                        )}
                        {it.customizations?.giftWrap && (
                          <span className={styles.orderItemVariation} style={{ color: '#f23730', fontWeight: 600 }}>
                            Premium Gift Wrap (+₹{it.customizations.giftWrap.price})
                            {it.customizations.giftWrap.comment && ` - "${it.customizations.giftWrap.comment}"`}
                          </span>
                        )}
                        <span className={styles.orderItemQuantity}>Qty: {it.quantity}</span>
                      </div>
                      <span className={styles.orderItemPrice}>₹{itemTotal.toFixed(2)}</span>
                    </div>
                  );
                })}
                {subscriptionCartItem && (
                  <div className={styles.orderItem}>
                    <div className={styles.orderItemInfo}>
                      <span className={styles.orderItemName}>Plan for {subscriptionCartItem.productName}</span>
                      {subscriptionCheckoutVariation?.size ? (
                        <span className={styles.orderItemVariation}>{subscriptionCheckoutVariation.size}</span>
                      ) : null}
                      <span className={styles.orderItemQuantity}>
                        {subscriptionPlanSummaryLine(subscriptionCartItem)}
                      </span>
                      <p className={styles.subscriptionTransferNote}>
                        Plans are managed in My Account &gt;{' '}
                        <Link href="/subscriptions" className={styles.subscriptionTransferLink}>
                          Plans
                        </Link>
                      </p>
                    </div>
                    <span className={styles.orderItemPrice}>₹{subscriptionCartItem.totalAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Delivery Address */}
              <div className={styles.deliveryAddress}>
                <h3 className={styles.sectionTitle}>Delivery Address</h3>
                <div className={styles.addressDisplay}>
                  <p><strong>{addressForm.name}</strong></p>
                  <p>{addressForm.street}</p>
                  <p>{addressForm.city}, {addressForm.state} {addressForm.postalCode}</p>
                  <p>{addressForm.country}</p>
                  {addressForm.phone && <p>Phone: {addressForm.phone}</p>}
                </div>
                <button
                  type="button"
                  className={styles.editButton}
                  onClick={() => setStep('address')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Price summary at bottom: after address section (step 2) or below step card (step 3) */}
        <div className={styles.summaryColumn}>
          <div className={styles.summarySticky}>
            <div className={styles.summaryCard}>
              <h3 className={styles.summaryTitle}>Price Details</h3>
              <div className={styles.priceDetailsBox}>
                <div className={styles.priceRow}>
                  <span>{totalItemCount} item{totalItemCount !== 1 ? 's' : ''}</span>
                </div>
                {items.map((it) => {
                  const p = products[it.productId];
                  if (!shouldShowCartPriceLine(it, p)) return null;
                  const itemTotal = getCartItemPriceLineAmount(it, p);
                  return (
                    <div key={`${it.productId}:${it.variationId || ''}:${it.customizations ? JSON.stringify(it.customizations) : ''}`} className={styles.priceRow}>
                      <span>{getCartItemCheckoutLineLabel(it, p)}</span>
                      <span>₹{itemTotal.toFixed(2)}</span>
                    </div>
                  );
                })}
                {subscriptionCartItem && (
                  <div className={styles.priceRow}>
                    <span>
                      1 × subscription for {subscriptionCartItem.productName}
                      {subscriptionCheckoutVariation?.size ? ` (${subscriptionCheckoutVariation.size})` : ''}
                    </span>
                    <span>₹{subscriptionCartItem.totalAmount.toFixed(2)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className={styles.priceRow}>
                    <span>Coupon ({couponValidation.coupon?.code})</span>
                    <span className={styles.discountAmount}>-₹{discount.toFixed(2)}</span>
                  </div>
                )}
                {platformFee > 0 && (
                  <div className={styles.priceRow}>
                    <span>Platform fee</span>
                    <span>₹{platformFee.toFixed(2)}</span>
                  </div>
                )}
                {totalGiftWrapFee > 0 && (
                  <div className={styles.priceRow}>
                    <span>Gift wrap</span>
                    <span>₹{totalGiftWrapFee.toFixed(2)}</span>
                  </div>
                )}
                <div className={styles.priceRow}>
                  <span>Delivery {backendFeesLoading && <span className={styles.calculatingFeesText}>(updating...)</span>}</span>
                  <span className={displayedDeliveryCharges > 0 ? '' : styles.freeDelivery}>
                    {displayedDeliveryCharges > 0 ? `₹${displayedDeliveryCharges.toFixed(2)}` : 'Free'}
                  </span>
                </div>
                <div className={`${styles.priceRow} ${styles.priceRowTotal}`}>
                  <span>Total</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
              </div>
              <div className={styles.totalSavingsBox}>
                <span className={styles.totalSavingsLabel}>Your total savings</span>
                <span className={styles.savings}>₹{savings.toFixed(2)}</span>
              </div>
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

              {/* Step 3 only: explicit payment method selection */}
              {currentStep === 'review' && (
                <div className={styles.paymentChoice}>
                  <div className={styles.paymentChoiceTitle}>Choose payment method:</div>
                  <label className={styles.paymentChoiceOption}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cod"
                      checked={paymentMethod === 'cod'}
                      onChange={() => setPaymentMethod('cod')}
                    />
                    <span className={styles.paymentChoiceLabelWithIcon}>
                      <span>Cash on delivery (COD)</span>
                      <span className={styles.paymentChoiceCashBadge} aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="6.5" width="18" height="11" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
                          <circle cx="12" cy="12" r="2.1" stroke="currentColor" strokeWidth="1.8" />
                          <path d="M6.5 12H7.5M16.5 12H17.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </span>
                    </span>
                  </label>
                  <label className={styles.paymentChoiceOption}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="online"
                      checked={paymentMethod === 'online'}
                      onChange={() => setPaymentMethod('online')}
                    />
                    <span className={styles.paymentChoiceLabelWithIcon}>
                      <span>Online Payment</span>
                      <span className={styles.paymentChoiceCards} aria-hidden="true">
                        <span className={styles.paymentCardVisa}>VISA</span>
                        <span className={styles.paymentCardMaster}>
                          <span className={styles.masterDotLeft} />
                          <span className={styles.masterDotRight} />
                        </span>
                        <span className={styles.paymentCardEtc}>etc</span>
                      </span>
                    </span>
                  </label>

                  {canUseWallet && (
                    <label className={styles.paymentChoiceOption}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="wallet"
                        checked={paymentMethod === 'wallet'}
                        onChange={() => setPaymentMethod('wallet')}
                      />
                      <span className={styles.paymentChoiceLabelWithIcon}>
                        <span>Use Wallet</span>
                        <span className={styles.paymentChoiceWalletBadge} aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect
                              x="3"
                              y="5.5"
                              width="18"
                              height="13"
                              rx="2.2"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            />
                            <path d="M3 10.25h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <rect
                              x="13.5"
                              y="11.25"
                              width="6.5"
                              height="4.5"
                              rx="0.65"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                            <circle cx="16.75" cy="13.5" r="0.85" fill="currentColor" />
                          </svg>
                        </span>
                      </span>
                    </label>
                  )}

                  {paymentMethod === 'wallet' && canUseWallet && (
                    <div className={styles.walletPaymentInfo}>
                      {walletExtraToPay > 0 ? (
                        <>You need to pay ₹{walletExtraToPay.toFixed(2)} more to complete this order.</>
                      ) : (
                        <>
                          You need to pay ₹0 to complete this order. Remaining Wallet amount = ₹{walletRemainingAfterOrder.toFixed(2)}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Continue to Checkout: when saved-address selected or creating new and form filled. Hidden when no saved addresses (use form submit). */}
            {currentStep === 'address' && isAddressFulfilled && ((savedAddresses.length > 0 && selectedAddressId && !showCreateNewAddress) || showCreateNewAddress) && (
              <div className={styles.summaryButtonWrapper}>
                <div className={styles.totalAmountSection}>
                  <div className={styles.totalAmountLabel}>Total amount</div>
                  <div className={styles.totalAmountValue}>₹{total.toFixed(2)}</div>
                </div>
                <button
                  type="button"
                  className={styles.summaryButtonBelow}
                  disabled={savingAddressForCheckout}
                  onClick={async () => {
                    setSavingAddressForCheckout(true);
                    const { ok } = await saveNewAddressIfRequested();
                    setSavingAddressForCheckout(false);
                    if (!ok) return;
                    setStep('review');
                  }}
                >
                  {savingAddressForCheckout ? 'Saving...' : 'Checkout'}
                </button>
              </div>
            )}

            {/* Place Order - below summary, only on review step */}
            {currentStep === 'review' && (
              <div className={styles.summaryButtonWrapper}>
                <div className={styles.totalAmountSection}>
                  <div className={styles.totalAmountLabel}>Total amount</div>
                  <div className={styles.totalAmountValue}>₹{total.toFixed(2)}</div>
                </div>
                <button type="button" onClick={handlePlaceOrder} className={styles.summaryButtonBelow} disabled={placingOrder}>
                  {placingOrder ? 'Placing Order...' : 'Place Order'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
