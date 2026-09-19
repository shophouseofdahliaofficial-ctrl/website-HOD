'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { productsApi, subscriptionsApi, contentApi, walletApi, addressesApi, apiClient } from '@/lib/api';
import { SITE_NAME } from '@/lib/seo';
import { useAuth } from '@/contexts/AuthContext';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import {
  readScopedPincode,
  scopedPincodeKey,
  scopedPincodeStatusKey,
  writeSubscriptionCartJson,
} from '@/lib/utils/userScopedStorage';
import { Product, Address, ProductVariation } from '@/types';
import styles from './SubscribePage.module.css';
import Link from 'next/link';
import { useDeliveryTimeOffConfig } from '@/hooks/useDeliveryTimeOffConfig';
import DeliveryTimeOffModal from '@/components/DeliveryTimeOffModal';

const AddressLocationPicker = dynamic(() => import('@/components/AddressLocationPicker'), { ssr: false });
const DEFAULT_DELIVERY_TIME_OPTIONS = [
  { label: '06:00 AM - 09:00 AM', value: '06:00' },
  { label: '05:00 PM - 08:00 PM', value: '17:00' },
];

function isAddressLockedByAnyExistingSubscription(subscriptions: { addressId?: string; status?: string }[], addressId: string): boolean {
  return subscriptions.some((sub) => {
    if (String(sub.addressId || '') !== String(addressId)) return false;
    const status = String(sub.status || '').toLowerCase();
    return status !== 'cancelled' && status !== 'expired';
  });
}

function getDeliveryCount(freq: string, days: number): number {
  if (freq === 'alternate') return Math.floor((days - 1) / 2) + 1;
  if (freq === 'weekly') return Math.floor((days - 1) / 7) + 1;
  if (freq === 'monthly') return Math.floor((days - 1) / 30) + 1;
  return days;
}


/**
 * Subscribe Page
 * Allows customer to create a new subscription
 */
export default function SubscribePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const pinUserId = user?.id ?? null;
  
  const queryProductId = searchParams.get('productId');
  const queryVariationId = searchParams.get('variationId');
  const isCartFlow = searchParams.get('from') === 'cart';
  const isRenewFlow = searchParams.get('renew') === '1';
  const trialSubscriptionId = searchParams.get('trialSubscriptionId');
  const isTrialUpgradeFlow = searchParams.get('trial') === '1' && Boolean(trialSubscriptionId);
  const isProductLocked = searchParams.get('lockProduct') === '1';

  const [product, setProduct] = useState<Product | null>(null);
  const [variationId, setVariationId] = useState<string | null>(queryVariationId);
  const [resolvedProductId, setResolvedProductId] = useState(queryProductId || '');
  
  const [eligibleProducts, setEligibleProducts] = useState<Product[]>([]);
  const [quantityPerDay, setQuantityPerDay] = useState(1);
  const [frequency, setFrequency] = useState<'daily' | 'alternate' | 'weekly' | 'monthly'>('daily');
  const [durationDays, setDurationDays] = useState(30);
  const [deliveryTime, setDeliveryTime] = useState(DEFAULT_DELIVERY_TIME_OPTIONS[0].value);
  const [deliveryTimeOptions, setDeliveryTimeOptions] = useState<Array<{ label: string; value: string }>>(DEFAULT_DELIVERY_TIME_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'wallet'>('online');
  const subscribeFormRef = useRef<HTMLFormElement>(null);
  const skipDeliveryTimeOffModalRef = useRef(false);
  const { evaluate: evaluateDeliveryTimeOff } = useDeliveryTimeOffConfig();
  const [deliveryTimeOffModal, setDeliveryTimeOffModal] = useState<{ title: string; description: string } | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [platformFee, setPlatformFee] = useState(0);
  const [pincodeStatus, setPincodeStatus] = useState<'checking' | 'missing' | 'available' | 'unavailable'>('checking');
  const [savedPincode, setSavedPincode] = useState('');
  const [subscriptionServiceablePincodes, setSubscriptionServiceablePincodes] = useState<string[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [mapModalAddress, setMapModalAddress] = useState<Address | null>(null);
  const [mapModalDraft, setMapModalDraft] = useState<{
    name: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    latitude?: number;
    longitude?: number;
  } | null>(null);
  const [mapSaving, setMapSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [showPincodesModal, setShowPincodesModal] = useState(false);
  const [creatingAddress, setCreatingAddress] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState({
    name: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });

  const isDeliverable = (pin: string) => {
    const cleaned = (pin || '').trim();
    if (cleaned.length !== 6) return false;
    const list = product?.deliveryPincodes || [];
    if (list.length === 0) return true;
    return list.includes(cleaned);
  };

  const isSubscriptionPincodeServiceable = (pin: string) => {
    const cleaned = (pin || '').trim();
    if (cleaned.length !== 6) return false;
    if (!subscriptionServiceablePincodes || subscriptionServiceablePincodes.length === 0) return true;
    return subscriptionServiceablePincodes.includes(cleaned);
  };

  // Load all eligible products for the dropdown
  useEffect(() => {
    const fetchEligible = async () => {
      try {
        const all = await productsApi.getAll();
        const filtered = all.filter((p) => p.isActive !== false && p.isMembershipEligible);
        setEligibleProducts(filtered);

        // Initial setup from query params
        if (queryProductId) {
          const found = filtered.find(p => p.id === queryProductId);
          if (found) {
            setProduct(found);
            setResolvedProductId(found.id);
            setVariationId(queryVariationId);
          } else if (filtered.length > 0) {
            setProduct(filtered[0]);
            setResolvedProductId(filtered[0].id);
          }
        } else if (filtered.length > 0) {
          setProduct(filtered[0]);
          setResolvedProductId(filtered[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch eligible products:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEligible();
  }, [queryProductId, queryVariationId]);

  // Sync state from query params once
  useEffect(() => {
    const litersParam = searchParams.get('liters');
    const daysParam = searchParams.get('days');
    const monthsParam = searchParams.get('months');
    const frequencyParam = searchParams.get('frequency');
    
    if (litersParam) setQuantityPerDay(Math.max(1, Math.floor(parseFloat(litersParam) || 1)));
    if (monthsParam) {
      setDurationDays(parseInt(monthsParam, 10) * 30);
    } else if (daysParam) {
      setDurationDays(parseInt(daysParam, 10));
    }
    if (frequencyParam === 'daily' || frequencyParam === 'alternate' || frequencyParam === 'weekly' || frequencyParam === 'monthly') {
      setFrequency(frequencyParam as any);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadWallet = async () => {
      try {
        const w = await walletApi.getSummary();
        setWalletBalance(w.balance || 0);
      } catch {
        setWalletBalance(0);
      }
    };
    loadWallet();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadPlatformFee = async () => {
      try {
        const data = await contentApi.getByType('platform_fee');
        const metadataAmount = Number(data.metadata?.amount);
        const titleAmount = Number(data.title);
        const amount = Number.isFinite(metadataAmount) ? metadataAmount : titleAmount;
        if (!cancelled) setPlatformFee(Number.isFinite(amount) && amount > 0 ? amount : 0);
      } catch {
        if (!cancelled) setPlatformFee(0);
      }
    };
    loadPlatformFee();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const loadAddresses = async () => {
      try {
        setLoadingAddresses(true);
        const addresses = await addressesApi.getAll();
        setSavedAddresses(addresses);
        if (addresses.length > 0) {
          const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0];
          setSelectedAddressId(defaultAddress?.id || null);
        }
      } catch {
        setSavedAddresses([]);
        setSelectedAddressId(null);
      } finally {
        setLoadingAddresses(false);
      }
    };
    loadAddresses();
  }, []);

  useEffect(() => {
    const syncPincodeState = async () => {
      try {
        const cfg = await contentApi.getByType('subscription_delivery');
        const meta = (cfg?.metadata || {}) as any;
        const parsedServiceablePincodes = Array.isArray(meta.serviceablePincodes)
          ? meta.serviceablePincodes
              .map((entry: any) => (typeof entry === 'string' ? entry : entry?.pincode))
              .map((pin: any) => String(pin || '').trim())
              .filter((pin: string) => /^\d{6}$/.test(pin))
          : [];
        setSubscriptionServiceablePincodes(Array.from(new Set(parsedServiceablePincodes)));
        if (Array.isArray(meta.deliveryTimeSlots) && meta.deliveryTimeSlots.length > 0) {
          const parsedSlots = meta.deliveryTimeSlots
            .map((slot: any) => ({
              label: (slot?.label || '').toString().trim(),
              value: (slot?.value || '').toString().trim(),
            }))
            .filter((slot: { label: string; value: string }) => slot.label && slot.value);
          setDeliveryTimeOptions(parsedSlots.length > 0 ? parsedSlots : DEFAULT_DELIVERY_TIME_OPTIONS);
        } else {
          setDeliveryTimeOptions(DEFAULT_DELIVERY_TIME_OPTIONS);
        }
      } catch {
        // Keep defaults when delivery slot content isn't configured yet.
        setSubscriptionServiceablePincodes([]);
      }

      const selectedAddress = savedAddresses.find((a) => a.id === selectedAddressId);
      const pin = (selectedAddress?.postalCode || readScopedPincode(pinUserId) || '').trim();
      setSavedPincode(pin);
      if (pin.length !== 6) {
        setPincodeStatus('missing');
        return;
      }
      if (isDeliverable(pin) && isSubscriptionPincodeServiceable(pin)) {
        setPincodeStatus('available');
      } else {
        setPincodeStatus('unavailable');
      }
    };
    syncPincodeState();
    const onStorage = (e: StorageEvent) => {
      if (e.key === scopedPincodeKey(pinUserId) || e.key === scopedPincodeStatusKey(pinUserId)) syncPincodeState();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [savedAddresses, selectedAddressId, pinUserId, product?.id]);

  const selectedVariation = useMemo(() => {
    if (!product || !variationId) return null;
    return (product.variations || []).find(v => v.id === variationId) || null;
  }, [product, variationId]);

  const maxSubscriptionQuantity = useMemo(() => {
    const rawLimit = Number(product?.maxQuantity);
    return Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.max(1, Math.floor(rawLimit)) : 10;
  }, [product?.maxQuantity]);

  useEffect(() => {
    setQuantityPerDay((prev) => Math.min(Math.max(1, Math.floor(prev || 1)), maxSubscriptionQuantity));
  }, [maxSubscriptionQuantity]);

  const quantityOptions = useMemo(
    () => Array.from({ length: maxSubscriptionQuantity }, (_, index) => index + 1),
    [maxSubscriptionQuantity],
  );

  const basePricePerLitre = useMemo(() => {
    if (!product) return 0;
    if (selectedVariation) {
      const vPrice = selectedVariation.price ?? (product.pricePerLitre * (selectedVariation.priceMultiplier || 1));
      return vPrice / (selectedVariation.priceMultiplier || 1);
    }
    return product.pricePerLitre;
  }, [product, selectedVariation]);

  const priceUnitLabel = useMemo(() => {
    const variationUnit = (selectedVariation?.size || '').trim();
    if (variationUnit) return variationUnit;
    return 'litre';
  }, [selectedVariation]);

  const subscriptionTotal = useMemo(() => {
    const multiplier = selectedVariation?.priceMultiplier || 1;
    const deliveryCount = Math.max(1, getDeliveryCount(frequency, durationDays));
    return basePricePerLitre * (quantityPerDay * multiplier) * deliveryCount;
  }, [basePricePerLitre, quantityPerDay, durationDays, selectedVariation, frequency]);
  const trialCreditAmount = useMemo(() => {
    if (!isTrialUpgradeFlow) return 0;
    const raw = Number(searchParams.get('trialCredit') || 0);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }, [isTrialUpgradeFlow, searchParams]);
  const initialPaymentPlatformFee = platformFee;
  const payableBeforeTrialCredit = useMemo(() => {
    return Math.max(0, Math.round((subscriptionTotal + initialPaymentPlatformFee) * 100) / 100);
  }, [subscriptionTotal, initialPaymentPlatformFee]);

  const effectiveTrialCredit = useMemo(() => {
    return Math.max(0, Math.min(trialCreditAmount, payableBeforeTrialCredit));
  }, [trialCreditAmount, payableBeforeTrialCredit]);

  const payableTodayTotal = useMemo(() => {
    return Math.max(0, Math.round((payableBeforeTrialCredit - effectiveTrialCredit) * 100) / 100);
  }, [payableBeforeTrialCredit, effectiveTrialCredit]);

  const walletUsedPreview = useMemo(() => {
    return Math.max(0, Math.min(walletBalance, payableTodayTotal));
  }, [walletBalance, payableTodayTotal]);

  const onlineDuePreview = useMemo(() => {
    return Math.max(0, Math.round((payableTodayTotal - walletUsedPreview) * 100) / 100);
  }, [payableTodayTotal, walletUsedPreview]);

  const handleProductChange = (val: string) => {
    const [pid, vid] = val.split('::');
    setResolvedProductId(pid);
    setVariationId(vid || null);
    const found = eligibleProducts.find(p => p.id === pid);
    if (found) setProduct(found);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedProductId || !product) return;

    if (isCartFlow && !isRenewFlow) {
      if (!isAuthenticated || !user?.id) {
        const returnPath = `/subscribe?${searchParams.toString()}`;
        localStorage.setItem('milko_return_after_auth', returnPath);
        router.replace(`/auth/login?redirect=${encodeURIComponent(returnPath)}`);
        return;
      }
      if (!selectedAddressId) {
        alert('Please select a delivery address to add this plan to your cart.');
        return;
      }
      if (pincodeStatus !== 'available') {
        alert('Delivery is not available for this address pincode. Please choose a serviceable address.');
        return;
      }
      const durationMonths = Math.max(1, Math.round(durationDays / 30));
      const subscriptionCartItem = {
        type: 'subscription',
        productId: resolvedProductId,
        variationId: variationId || undefined,
        productName: product.name,
        litresPerDay: quantityPerDay,
        durationDays,
        durationMonths,
        deliveryTime,
        paymentMethod,
        frequency,
        totalAmount: Number(subscriptionTotal.toFixed(2)),
        updatedAt: new Date().toISOString(),
      };
      writeSubscriptionCartJson(user.id, JSON.stringify(subscriptionCartItem));
      router.push('/cart');
      return;
    }

    if (!isAuthenticated) {
      const returnPath = `/subscribe${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      localStorage.setItem('milko_return_after_auth', returnPath);
      router.replace(`/auth/login?redirect=${encodeURIComponent(returnPath)}`);
      return;
    }
    if (!selectedAddressId) {
      alert('Please select a delivery address to continue.');
      return;
    }
    if (pincodeStatus !== 'available') return;

    const dto = evaluateDeliveryTimeOff();
    if (dto.intercept && !skipDeliveryTimeOffModalRef.current) {
      setDeliveryTimeOffModal({ title: dto.title, description: dto.description });
      return;
    }
    skipDeliveryTimeOffModalRef.current = false;

    setSubmitting(true);
    let openedRazorpay = false;
    try {
      const durationMonths = Math.max(1, Math.round(durationDays / 30));
      const result = await subscriptionsApi.create({
        productId: resolvedProductId,
        variationId: variationId || undefined,
        variation_id: variationId || undefined,
        productVariationId: variationId || undefined,
        product_variation_id: variationId || undefined,
        litresPerDay: quantityPerDay,
        frequency: frequency as any,
        durationDays,
        durationMonths,
        deliveryTime,
        paymentMethod,
        addressId: selectedAddressId || undefined,
        totalAmount: payableTodayTotal,
        total_amount: payableTodayTotal,
        amount: payableTodayTotal,
        trialSubscriptionId: trialSubscriptionId || undefined,
      });

      if (!result.razorpayOrder || !result.razorpayOrder.id) {
        setShowSuccessModal(true);
        return;
      }

      const loadRazorpayScript = (): Promise<void> => {
        if (typeof window !== 'undefined' && (window as any).Razorpay) return Promise.resolve();
        return new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Failed to load Razorpay'));
          document.head.appendChild(s);
        });
      };

      await loadRazorpayScript();
      const Razorpay = (window as any).Razorpay;
      const rzp = new Razorpay({
        key: result.razorpayOrder.key,
        order_id: result.razorpayOrder.id,
        currency: result.razorpayOrder.currency || 'INR',
        name: SITE_NAME,
        description: 'Plan payment',
        handler: async function (resp: { razorpay_payment_id: string; razorpay_order_id: string }) {
          try {
            await subscriptionsApi.verifyPayment({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              trialSubscriptionId: trialSubscriptionId || undefined,
            });
            setShowSuccessModal(true);
          } catch (err) {
            console.error(err);
            alert('Payment verification failed. Please contact support.');
          } finally {
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: async () => {
            setSubmitting(false);
            if (result?.subscription?.id) {
              try {
                await subscriptionsApi.cancel(String(result.subscription.id));
              } catch (err) {
                console.error('Failed to clean up pending subscription:', err);
              }
            }
          }
        },
      });
      openedRazorpay = true;
      rzp.open();
    } catch (error) {
      console.error('Failed to create subscription:', error);
      const err = error as { message?: string; data?: { error?: string } };
      const msg =
        (typeof err?.message === 'string' && err.message.trim() && err.message) ||
        (typeof err?.data?.error === 'string' && err.data.error.trim() && err.data.error) ||
        'Failed to create plan.';
      alert(msg);
    } finally {
      if (!openedRazorpay) setSubmitting(false);
    }
  };

  const openMapModal = (address: Address) => {
    setMapModalAddress(address);
    setMapModalDraft({
      name: address.name,
      phone: address.phone || '',
      street: address.street,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country || 'India',
      latitude: address.latitude,
      longitude: address.longitude,
    });
  };

  const closeMapModal = () => {
    if (mapSaving) return;
    setMapModalAddress(null);
    setMapModalDraft(null);
  };

  const openAddLocationModal = () => {
    setNewAddressForm({
      name: '',
      phone: '',
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
      latitude: undefined,
      longitude: undefined,
    });
    setShowAddLocationModal(true);
  };

  const closeAddLocationModal = () => {
    if (creatingAddress) return;
    setShowAddLocationModal(false);
  };

  const createAddressFromModal = async () => {
    if (!newAddressForm.name.trim() || !newAddressForm.phone.trim() || !newAddressForm.street.trim() || !newAddressForm.city.trim() || !newAddressForm.state.trim() || !newAddressForm.postalCode.trim()) {
      alert('Please fill all fields.'); return;
    }
    setCreatingAddress(true);
    try {
      const created = await addressesApi.create({ ...newAddressForm, isDefault: savedAddresses.length === 0 });
      const addresses = await addressesApi.getAll();
      setSavedAddresses(addresses);
      setSelectedAddressId(created.id);
      setShowAddLocationModal(false);
    } catch (e) {
      alert((e as any)?.message || 'Failed to add location');
    } finally {
      setCreatingAddress(false);
    }
  };

  const saveAddressFromMapModal = async () => {
    if (!mapModalAddress || !mapModalDraft) return;
    const d = mapModalDraft;
    if (!d.name.trim() || !d.phone.trim() || !d.street.trim() || !d.city.trim() || !d.state.trim() || !d.postalCode.trim()) {
      alert('Please fill all fields.'); return;
    }
    setMapSaving(true);
    try {
      const subscriptions = await subscriptionsApi.getAll().catch(() => []);
      if (isAddressLockedByAnyExistingSubscription(subscriptions, String(mapModalAddress.id))) {
        alert('This address is already used in an existing plan. Please add a new address for future plans.');
        return;
      }
      const updated = await addressesApi.update(mapModalAddress.id, { ...d });
      setSavedAddresses((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
      setMapModalAddress(null);
      setMapModalDraft(null);
    } catch (e) {
      alert((e as any)?.message || 'Could not save address.');
    } finally {
      setMapSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70vh',
          fontFamily: 'var(--font-inter), sans-serif',
          color: '#666',
          fontSize: '1.05rem',
          fontWeight: 500,
        }}
      >
        <style>{`
          @keyframes loaderSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <svg
          style={{
            animation: 'loaderSpin 0.8s linear infinite',
            width: '26px',
            height: '26px',
            color: '#ff0040',
            marginBottom: '12px'
          }}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            style={{ opacity: 0.15 }}
          />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span>Loading...</span>
      </div>
    );
  }
  if (!product) return <div style={{ padding: '2rem', textAlign: 'center' }}>Product not found</div>;

  const perLitreDiscount = Math.max(0, (product.compareAtPrice ?? product.sellingPrice ?? 0) - basePricePerLitre);
  const visibleAddresses = savedAddresses;
  const hiddenAddressCount = 0;
  const selectedAddress = savedAddresses.find((a) => a.id === selectedAddressId);
  const selectedAddressPincode = (selectedAddress?.postalCode || '').trim();
  const isSelectedAddressBlockedBySubscriptionPincodes =
    selectedAddressPincode.length === 6 && !isSubscriptionPincodeServiceable(selectedAddressPincode);

  const dropdownValue = `${resolvedProductId}${variationId ? `::${variationId}` : ''}`;

  return (
    <div className={styles.pageWrap}>
      <DeliveryTimeOffModal
        open={deliveryTimeOffModal !== null}
        title={deliveryTimeOffModal?.title ?? ''}
        description={deliveryTimeOffModal?.description ?? ''}
        onProceed={() => {
          setDeliveryTimeOffModal(null);
          skipDeliveryTimeOffModalRef.current = true;
          subscribeFormRef.current?.requestSubmit();
        }}
        onClose={() => setDeliveryTimeOffModal(null)}
      />
      <div className={styles.card}>
        <form ref={subscribeFormRef} onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.leftPanel}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>
              {isTrialUpgradeFlow ? 'Start full plan for ' : 'Get '}
              {product.name} {selectedVariation ? `[${selectedVariation.size}]` : ''}
            </h1>
            <div className={styles.priceInfoBlock}>
              <div className={styles.pricePill}>₹{basePricePerLitre} per {priceUnitLabel}</div>
              {perLitreDiscount > 0 ? (
                <p className={styles.priceSaveText}>Save ₹{perLitreDiscount.toFixed(2)}</p>
              ) : null}
            </div>
          </div>
          <div className={`${styles.field} ${styles.fieldWithIcon}`}>
            <div className={styles.fieldIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M3 7.5 12 3l9 4.5-9 4.5L3 7.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M3 7.5V16.5L12 21l9-4.5V7.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M12 12v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div className={styles.controlWrap}>
              <label className={styles.labelInBorder} htmlFor="productSelect">Select Product</label>
              <select
                id="productSelect"
                className={styles.select}
                value={dropdownValue}
                onChange={(e) => handleProductChange(e.target.value)}
                disabled={isProductLocked}
                required
              >
                {eligibleProducts.flatMap((p) => {
                  if (p.variations && p.variations.length > 0) {
                    return p.variations.map((v) => {
                      const vPrice = v.price ?? (p.pricePerLitre * (v.priceMultiplier || 1));
                      return (
                        <option key={`${p.id}::${v.id}`} value={`${p.id}::${v.id}`}>
                          {p.name} [{v.size} - ₹{vPrice}]
                        </option>
                      );
                    });
                  }
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} [1L - ₹{p.pricePerLitre}]
                    </option>
                  );
                })}
              </select>
              <svg className={styles.selectArrow} viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={`${styles.field} ${styles.fieldWithIcon}`}>
            <div className={styles.fieldIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M7.5 3.5v4M16.5 3.5v4M3.5 9.5h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div className={styles.controlWrap}>
              <label className={styles.labelInBorder} htmlFor="frequency">Frequency</label>
              <select
                id="frequency"
                className={styles.select}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                required
              >
                <option value="daily">Daily</option>
                <option value="alternate">Alternate Days</option>
                <option value="weekly">Once a Week</option>
                <option value="monthly">Once a Month</option>
              </select>
              <svg className={styles.selectArrow} viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={`${styles.field} ${styles.fieldWithIcon}`}>
            <div className={styles.fieldIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 10h16l-1.2 8.4A2 2 0 0 1 16.8 20H7.2a2 2 0 0 1-2-1.6L4 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M8 10 11 5h2l3 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className={styles.controlWrap}>
              <label className={styles.labelInBorder} htmlFor="quantityPerDay">Quantity</label>
              <select
                id="quantityPerDay"
                className={styles.select}
                value={quantityPerDay}
                onChange={(e) => setQuantityPerDay(Number(e.target.value))}
                required
              >
                {quantityOptions.map((qty) => (
                  <option key={qty} value={qty}>
                    {qty}
                  </option>
                ))}
              </select>
              <svg className={styles.selectArrow} viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={`${styles.field} ${styles.fieldWithIcon}`}>
            <div className={styles.fieldIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M12 7.5v5l3 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className={styles.controlWrap}>
              <label className={styles.labelInBorder} htmlFor="durationDays">Duration</label>
              <select id="durationDays" className={styles.select} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} required>
                <option value={7}>7 days</option>
                <option value={15}>15 days</option>
                <option value={30}>1 month</option>
                <option value={60}>2 months</option>
                <option value={90}>3 months</option>
                <option value={180}>6 months</option>
                <option value={365}>1 year</option>
              </select>
              <svg className={styles.selectArrow} viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={`${styles.field} ${styles.fieldWithIcon}`}>
            <div className={styles.fieldIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="13" r="7" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M12 13V9.5M12 13l2.5 1.5M7 4.5 4.8 6.7M17 4.5l2.2 2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className={styles.controlWrap}>
              <label className={styles.labelInBorder} htmlFor="deliveryTime">Delivery Time</label>
              <select id="deliveryTime" className={styles.select} value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} required>
                {deliveryTimeOptions.map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}
              </select>
              <svg className={styles.selectArrow} viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={`${styles.field} ${styles.deliveryAddressField} ${styles.fieldWithIcon}`}>
            <div className={styles.fieldIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 21s6-5.7 6-10a6 6 0 1 0-12 0c0 4.3 6 10 6 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <circle cx="12" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.8"/>
              </svg>
            </div>
            <div>
            <label className={styles.label}>Delivery address</label>
            {loadingAddresses ? (
              <div className={styles.totalsBox}><p className={styles.totalLine}>Loading saved addresses...</p></div>
            ) : savedAddresses.length === 0 ? (
              <>
                <div className={styles.totalsBox}><p className={styles.totalLine}>No saved addresses found. Please add a new location.</p></div>
                <button type="button" className={styles.addNewLocationBtn} onClick={openAddLocationModal}><span className={styles.addNewLocationIcon}>+</span>Add new location</button>
              </>
            ) : (
              <>
                <div className={styles.savedAddressesList}>
                  {visibleAddresses.map((address) => {
                    const hasPin = typeof address.latitude === 'number' && typeof address.longitude === 'number';
                    return (
                      <div key={address.id} className={`${styles.savedAddressCardOuter} ${selectedAddressId === address.id ? styles.savedAddressCardOuterSelected : ''}`}>
                        <label className={`${styles.savedAddressCard} ${selectedAddressId === address.id ? styles.savedAddressCardSelected : ''}`}>
                          <input type="radio" name="subscriptionAddress" checked={selectedAddressId === address.id} onChange={() => setSelectedAddressId(address.id)} className={styles.addressRadio} />
                          <div className={styles.savedAddressContent}>
                            <div className={styles.savedAddressHeader}>
                              <span className={styles.savedAddressName}>{address.name}</span>
                              {address.isDefault && <span className={styles.defaultBadge}>Default</span>}
                              {hasPin && <span className={styles.locationSavedBadge}>Map set</span>}
                            </div>
                            <div className={styles.savedAddressDetails}><p>{address.street}</p><p>{address.city}, {address.state} {address.postalCode}</p></div>
                          </div>
                        </label>
                        <button type="button" className={styles.setExactLocationBtn} onClick={() => openMapModal(address)}>{hasPin ? 'Change Address' : 'Set address & map'}</button>
                      </div>
                    );
                  })}
                </div>
                {hiddenAddressCount > 0 && <p className={styles.hiddenAddressNote}>Non-delieverable address are hidden</p>}
                <button type="button" className={styles.addNewLocationBtn} onClick={openAddLocationModal}><span className={styles.addNewLocationIcon}>+</span>Add new location</button>
              </>
            )}
            {isSelectedAddressBlockedBySubscriptionPincodes && (
              <div className={styles.nonDeliverableSubscriptionNote}>
                <div>
                  <p style={{ margin: 0 }}>
                    This address is non deliverable for plans because its pincode is not in Serviceable Pincodes.
                  </p>
                  <p style={{ margin: '4px 0 0 0' }}>
                    <button
                      type="button"
                      className={styles.seePincodesLinkBtn}
                      onClick={() => setShowPincodesModal(true)}
                    >
                      Click
                    </button>{' '}
                    to see available pincodes.
                  </p>
                </div>
              </div>
            )}
            <p className={styles.deliveryAddressFixedNote}>Delivery Address can&apos;t be changed once subscribed</p>
            </div>
          </div>
          </div>

          <div className={styles.rightColumn}>
          <div className={styles.rightPanel}>
            <h3 className={styles.rightPanelTitle}>Order Summary</h3>
            <div className={`${styles.totalsBox} ${styles.pricingTotalsAbovePayment}`}>
              <p className={styles.totalLine}>Total per day: <strong>₹{(basePricePerLitre * quantityPerDay).toFixed(2)}</strong></p>
              <p className={styles.totalLine} style={{ marginTop: 8 }}>Total for {durationDays} day(s) ({getDeliveryCount(frequency, durationDays)} deliveries): <strong>₹{subscriptionTotal.toFixed(2)}</strong></p>
              {initialPaymentPlatformFee > 0 && <p className={styles.totalLine} style={{ marginTop: 8 }}>Platform fee: <strong>₹{initialPaymentPlatformFee.toFixed(2)}</strong></p>}
              {isTrialUpgradeFlow && effectiveTrialCredit > 0 && (
                <p className={styles.totalLine} style={{ marginTop: 8, color: '#008037' }}>
                  Trial credit: <strong>-₹{effectiveTrialCredit.toFixed(2)}</strong>
                </p>
              )}
              <p className={styles.totalLine} style={{ marginTop: 8 }}>Payable today: <strong>₹{payableTodayTotal.toFixed(2)}</strong></p>
              <p className={styles.amountBreakdown}>
                Breakdown: {quantityPerDay} qty/day × {selectedVariation?.priceMultiplier || 1} (multiplier) × ₹{basePricePerLitre.toFixed(2)} × {getDeliveryCount(frequency, durationDays)} deliveries
                {initialPaymentPlatformFee > 0 ? ` + ₹${initialPaymentPlatformFee.toFixed(2)} (Platform Fee)` : ''} 
                {isTrialUpgradeFlow && effectiveTrialCredit > 0 ? ` - ₹${effectiveTrialCredit.toFixed(2)} (Trial Credit)` : ''}
                = ₹{payableTodayTotal.toFixed(2)}
              </p>
            </div>

            {(!isCartFlow || isRenewFlow) && (
              <div className={`${styles.field} ${styles.paymentMethodField}`}>
                <label className={styles.label}>Payment method</label>
                <div className={styles.controlWrap}>
                  <label className={styles.paymentMethodOption}>
                    <input type="radio" name="subscriptionPaymentMethod" value="online" checked={paymentMethod === 'online'} onChange={() => setPaymentMethod('online')} />
                    <span className={styles.paymentMethodLabelWithIcon}>Pay full amount online (₹{payableTodayTotal.toFixed(2)})</span>
                  </label>
                  {walletBalance > 0 && (
                    <label className={styles.paymentMethodOption}>
                      <input type="radio" name="subscriptionPaymentMethod" value="wallet" checked={paymentMethod === 'wallet'} onChange={() => setPaymentMethod('wallet')} />
                      <span className={styles.paymentMethodLabelWithIcon}>
                        {onlineDuePreview > 0 ? `Use wallet ₹${walletUsedPreview.toFixed(2)} + ₹${onlineDuePreview.toFixed(2)} online` : `Use wallet ₹${walletUsedPreview.toFixed(2)}`}
                      </span>
                    </label>
                  )}
                </div>
              </div>
            )}

            <button type="submit" disabled={submitting || ((!isCartFlow || isRenewFlow) && pincodeStatus !== 'available')} className={`${styles.button} ${styles.submitBottomBtn}`}>
              {submitting ? 'Processing...' : isCartFlow ? (isRenewFlow ? 'Proceed to Payment' : 'Add to cart') : 'Proceed to Payment'}
            </button>

            <p className={styles.checkoutSafeNote}>
              <svg className={styles.checkoutSafeIcon} viewBox="0 0 910.288 910.287" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <g>
                  <g>
                    <path d="M873.206,202.06l-1.212-28.51l-28.386-2.915c-109.036-11.198-202.773-51.887-262.21-84.049c-65.099-35.226-104.56-68.274-104.922-68.579L455.165,0L433.84,17.981c-0.392,0.33-39.853,33.379-104.951,68.604c-59.437,32.162-153.173,72.851-262.209,84.049l-28.387,2.915l-1.212,28.51c-0.217,5.104-4.777,126.698,42.059,273.937c27.637,86.887,67.549,164.736,118.627,231.396c64.139,83.701,145.948,149.68,243.155,196.102l14.221,6.793l14.221-6.793c97.207-46.422,179.017-112.398,243.155-196.102c51.079-66.658,90.991-144.51,118.628-231.395C877.982,328.759,873.423,207.165,873.206,202.06z M455.143,836.93c-81.095-41.209-149.731-97.887-204.194-168.646c-46.393-60.275-82.812-130.998-108.248-210.201c-31.088-96.808-38.06-183.144-39.471-225.538c43.735-6.494,87.949-17.421,131.833-32.597c42.9-14.836,85.598-33.752,126.907-56.221c41.915-22.798,73.81-44.573,93.172-58.812c19.362,14.238,51.258,36.014,93.173,58.812c41.309,22.47,84.007,41.385,126.907,56.221c43.896,15.181,88.123,26.108,131.87,32.602c-1.359,41.978-8.194,127.098-38.842,223.443c-25.317,79.594-61.694,150.672-108.12,211.258C605.537,738.494,536.632,795.52,455.143,836.93z" fill="currentColor"></path>
                    <polygon points="635.013,305.016 588.969,351.06 417.368,522.662 330.399,435.693 318.573,423.867 295.239,447.201 295.239,447.202 271.904,470.537 417.368,616 681.682,351.686" fill="currentColor"></polygon>
                  </g>
                </g>
              </svg>
              <span>Secure Payment • Cancel Anytime</span>
            </p>

          </div>
          <div className={styles.trialCard}>
            <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.trialCardIcon}>
              <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
              <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
              <g id="SVGRepo_iconCarrier">
                <path d="M188.238 150.351C187.902 139.999 187.322 129.445 186.537 119.742" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                <path d="M257.109 150.174C259.044 139.34 255.208 121.895 257.959 111.239" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                <path d="M180.222 203.544C205.959 201.513 230.999 205.656 251.643 221.772" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                <path d="M151.414 94.3317C159.018 93.0218 170.14 79.1169 179.734 81.2152C190.277 83.5213 201.918 93.332 205.241 94.3317" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                <path d="M257.958 111.24C270.277 105.447 283.635 103.832 297.07 102.737" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                <path d="M102 266.977C102 237.192 104.574 206.959 120.64 214.927C127.688 218.425 143.844 249.321 146.784 248.487C168.261 242.401 215.933 226.987 221.534 248.487C226.75 268.511 187.6 265.542 187.6 266.977C187.6 268.368 198.161 273.321 197.261 281.36C196.396 289.087 171.478 296.427 179.314 296.427C220.65 296.427 165.143 313.809 146.784 317.549C128.425 321.289 115.772 316.382 102 312.177" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
              </g>
            </svg>
            <h2 className={styles.trialCardTitle}>Not ready for a full plan?</h2>
            <p className={styles.trialCardText}>
              Start with our Trial Pack and experience the quality before committing to a full plan.
            </p>
            <Link href="/get-trial-pack" className={styles.trialCardButton}>
              Grab Trial Pack
              <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="white" className={styles.trialButtonIcon} stroke="white">
                <path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641l2.5-8.5z"></path>
              </svg>
            </Link>
          </div>
          </div>
        </form>

        {mapModalAddress && mapModalDraft && (
          <div className={styles.mapModalOverlay} onClick={closeMapModal}>
            <div className={styles.mapModal} onClick={(e) => e.stopPropagation()}>
              <button type="button" className={styles.mapModalClose} onClick={closeMapModal}>×</button>
              <h3 className={styles.mapModalTitle}>Delivery address</h3>
              <div className={styles.addLocationForm}>
                <div className={styles.addLocationRow}>
                  <input className={styles.input} placeholder="Name" value={mapModalDraft.name} onChange={(e) => setMapModalDraft(p => p ? { ...p, name: e.target.value } : p)} />
                  <input className={styles.input} placeholder="Phone" value={mapModalDraft.phone} onChange={(e) => setMapModalDraft(p => p ? { ...p, phone: e.target.value } : p)} />
                </div>
                <input className={styles.input} placeholder="Street" value={mapModalDraft.street} onChange={(e) => setMapModalDraft(p => p ? { ...p, street: e.target.value } : p)} />
                <div className={styles.addLocationRow}>
                  <input className={styles.input} placeholder="City" value={mapModalDraft.city} onChange={(e) => setMapModalDraft(p => p ? { ...p, city: e.target.value } : p)} />
                  <input className={styles.input} placeholder="State" value={mapModalDraft.state} onChange={(e) => setMapModalDraft(p => p ? { ...p, state: e.target.value } : p)} />
                </div>
                <input className={styles.input} placeholder="Postal code" value={mapModalDraft.postalCode} onChange={(e) => setMapModalDraft(p => p ? { ...p, postalCode: e.target.value } : p)} />
                <AddressLocationPicker latitude={mapModalDraft.latitude} longitude={mapModalDraft.longitude} onChange={({ latitude, longitude }) => setMapModalDraft(p => p ? { ...p, latitude, longitude } : p)} />
              </div>
              <div className={styles.mapModalActions}>
                <button type="button" className={styles.mapModalCancel} onClick={closeMapModal}>Cancel</button>
                <button type="button" className={styles.mapModalSave} disabled={mapSaving} onClick={saveAddressFromMapModal}>{mapSaving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}

        {showAddLocationModal && (
          <div className={styles.mapModalOverlay} onClick={closeAddLocationModal}>
            <div className={styles.mapModal} onClick={(e) => e.stopPropagation()}>
              <button type="button" className={styles.mapModalClose} onClick={closeAddLocationModal}>×</button>
              <h3 className={styles.mapModalTitle}>Add location</h3>
              <div className={styles.addLocationForm}>
                <div className={styles.addLocationRow}>
                  <input className={styles.input} placeholder="Name" value={newAddressForm.name} onChange={(e) => setNewAddressForm(p => ({ ...p, name: e.target.value }))} />
                  <input className={styles.input} placeholder="Phone" value={newAddressForm.phone} onChange={(e) => setNewAddressForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <input className={styles.input} placeholder="Street" value={newAddressForm.street} onChange={(e) => setNewAddressForm(p => ({ ...p, street: e.target.value }))} />
                <div className={styles.addLocationRow}>
                  <input className={styles.input} placeholder="City" value={newAddressForm.city} onChange={(e) => setNewAddressForm(p => ({ ...p, city: e.target.value }))} />
                  <input className={styles.input} placeholder="State" value={newAddressForm.state} onChange={(e) => setNewAddressForm(p => ({ ...p, state: e.target.value }))} />
                </div>
                <input className={styles.input} placeholder="Postal code" value={newAddressForm.postalCode} onChange={(e) => setNewAddressForm(p => ({ ...p, postalCode: e.target.value }))} />
                <AddressLocationPicker latitude={newAddressForm.latitude} longitude={newAddressForm.longitude} onChange={({ latitude, longitude }) => setNewAddressForm(p => ({ ...p, latitude, longitude }))} />
              </div>
              <div className={styles.mapModalActions}>
                <button type="button" className={styles.mapModalCancel} onClick={closeAddLocationModal}>Cancel</button>
                <button type="button" className={styles.mapModalSave} disabled={creatingAddress} onClick={createAddressFromModal}>{creatingAddress ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}

        {showSuccessModal && product && (
          <div className={styles.mapModalOverlay}>
            <div className={styles.lottieWrapper}>
              <DotLottieReact
                src="/animations/Congratulation.lottie"
                autoplay
                loop={false}
              />
            </div>
            <div className={styles.successModal}>
              <div className={styles.successIconWrapper}>
                <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" className={styles.upgradeIcon}>
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier"> 
                     <path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641l2.5-8.5z"></path> 
                  </g>
                </svg>
              </div>
              <h3 className={styles.successTitle}>Plan Active!</h3>
              <p className={styles.successText}>Your {product.name} {selectedVariation ? `[${selectedVariation.size}]` : ''} plan is active.</p>
              <button type="button" className={styles.successBtn} onClick={() => router.push('/subscriptions')}>View Plans</button>
            </div>
          </div>
        )}

        {showPincodesModal && (
          <div className={styles.mapModalOverlay} onClick={() => setShowPincodesModal(false)}>
            <div className={styles.mapModal} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={styles.mapModalClose}
                onClick={() => setShowPincodesModal(false)}
              >
                ×
              </button>
              <h3 className={styles.mapModalTitle} style={{ fontSize: '1.25rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#0b5cff' }}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                Serviceable Pincodes
              </h3>
              <p className={styles.mapModalSubtitle}>
                We currently support plan deliveries in the following areas:
              </p>
              
              {subscriptionServiceablePincodes.length > 0 ? (
                <div className={styles.pincodeListGrid}>
                  {subscriptionServiceablePincodes.map((pin) => (
                    <div key={pin} className={styles.pincodeBadge}>
                      {pin}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.pincodeEmptyText}>
                  No plan delivery pincodes have been configured yet.
                </p>
              )}

              <div className={styles.nonServiceableAreaSection}>
                <h4 className={styles.nonServiceableTitle}>Living in an Non-serviceable area?</h4>
                <p className={styles.nonServiceableDesc}>
                  Request pincode access by addressing your{' '}
                  <Link href="/contact" className={styles.needLink}>
                    need
                  </Link>{' '}
                  here.
                </p>
              </div>

              <div className={styles.mapModalActions} style={{ marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className={styles.mapModalSave}
                  style={{ minWidth: '100px' }}
                  onClick={() => setShowPincodesModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
