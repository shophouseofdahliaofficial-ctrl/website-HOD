'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import ProductDetailsModal from '@/components/ProductDetailsModal';
import productStyles from '@/components/ProductsSection.module.css';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useCategoryMap } from '@/hooks/useCategoryMap';
import { addressesApi, contentApi, productsApi, subscriptionsApi } from '@/lib/api';
import { SITE_NAME } from '@/lib/seo';
import { getCardPriceDisplay, getProductDisplayUnitLabel } from '@/lib/utils/productCardPricing';
import { getPrimaryProductImageUrl, getOrderedProductImageUrls } from '@/lib/utils/productImages';
import { Address, Product, ProductVariation, TrialPackCheckoutBreakdown } from '@/types';
import styles from './page.module.css';
import { useDeliveryTimeOffConfig } from '@/hooks/useDeliveryTimeOffConfig';
import DeliveryTimeOffModal from '@/components/DeliveryTimeOffModal';

const AddressLocationPicker = dynamic(() => import('@/components/AddressLocationPicker'), { ssr: false });

const DEFAULT_DELIVERY_TIME_OPTIONS = [
  { label: 'Morning', value: '06:00' },
  { label: 'Evening', value: '17:00' },
];

function isAddressLockedByAnyExistingSubscription(subscriptions: { addressId?: string; status?: string }[], addressId: string): boolean {
  return subscriptions.some((sub) => {
    if (String(sub.addressId || '') !== String(addressId)) return false;
    const status = String(sub.status || '').toLowerCase();
    return status !== 'cancelled' && status !== 'expired';
  });
}

const BENEFITS = [
  {
    title: '1. 100% Pure Milk',
    text: 'Premium quality products with no compromise.',
    art: '🥛',
  },
  {
    title: '2. Zero Adulteration Promise',
    text: 'Every batch is quality checked before it reaches your doorstep.',
    art: '🙌',
  },
  {
    title: '3. Priority Delivery',
    text: 'Members get assured supply and timely doorstep delivery.',
    art: '🚲',
  },
  {
    title: '4. Purity Guarantee',
    text: 'Proof of adulteration? We will pay you back as our trust promise.',
    art: '🎁',
  },
  {
    title: '5. Flexible Anytime',
    text: 'Pause or cancel anytime, unused balance moves to your wallet.',
    art: '👋',
  },
  {
    title: '6. Test Before Full Plan',
    text: 'Start small with a trial pack and experience the quality before committing.',
    art: '📈',
  },
];

const FAQS = [
  {
    question: '1. What is the Trial Pack?',
    answer: 'The Trial Pack lets you experience our products in a smaller commitment before choosing a full plan.',
  },
  {
    question: '2. Is the Trial Pack the same quality as regular members receive?',
    answer: 'Yes. The product quality, sourcing, and handling are the same. Only the plan duration is different.',
  },
  {
    question: '3. Is there any lock-in after taking a Trial Pack?',
    answer: 'No. The trial ends after one day and does not enable autopay.',
  },
  {
    question: '4. How does the purity guarantee work?',
    answer: 'If a quality issue is confirmed, the support team handles it using our quality policy.',
  },
  {
    question: '5. Can I pause or cancel anytime?',
    answer: 'The trial is a one-day plan, so it is meant for a single scheduled order only.',
  },
  {
    question: '6. What happens to unused balance if I cancel?',
    answer: 'The trial does not run as a long cycle, so there is no rolling balance for that one-day plan.',
  },
  {
    question: '7. Do Trial Pack users get doorstep delivery?',
    answer: 'Yes, trial orders are delivered to the selected serviceable address.',
  },
  {
    question: '8. Can I upgrade to a full plan later?',
    answer: 'Yes. At any time, even while the trial is active or after it expires, you can start the full plan for the same product with trial credit applied.',
  },
  {
    question: '9. How often is product quality checked?',
    answer: 'Quality checks happen as part of our regular handling and dispatch process.',
  },
  {
    question: '10. Why should I start with a Trial Pack?',
    answer: 'It is the easiest way to test quality and service before committing to a longer plan.',
  },
  {
    question: '11. Are products handled with care?',
    answer: 'That is our standard quality promise and applies to eligible trial products too.',
  },
  {
    question: '12. Is there a refund if I am not satisfied?',
    answer: 'Support reviews those cases based on the order and quality context shared by the customer.',
  },
];

type TrialItem = {
  key: string;
  product: Product;
  variation: ProductVariation | null;
  unitPrice: number;
};

type TrialPackPageClientProps = {
  stepsOnly?: boolean;
};

export default function TrialPackPageClient({ stepsOnly = false }: TrialPackPageClientProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const categoryMap = useCategoryMap();

  const [subscriptionServiceablePincodes, setSubscriptionServiceablePincodes] = useState<string[]>([]);
  const [showPincodesModal, setShowPincodesModal] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [trialItems, setTrialItems] = useState<TrialItem[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasStartedFlow, setHasStartedFlow] = useState(stepsOnly);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [deliveryTimeOptions, setDeliveryTimeOptions] = useState<Array<{ label: string; value: string }>>(DEFAULT_DELIVERY_TIME_OPTIONS);
  const [deliveryTime, setDeliveryTime] = useState(DEFAULT_DELIVERY_TIME_OPTIONS[0].value);
  const [trialPaymentMethod, setTrialPaymentMethod] = useState<'online' | 'cod'>('online');
  const [checkoutBreakdown, setCheckoutBreakdown] = useState<TrialPackCheckoutBreakdown | null>(null);
  const [checkoutBreakdownLoading, setCheckoutBreakdownLoading] = useState(false);
  const [checkoutBreakdownError, setCheckoutBreakdownError] = useState<string | null>(null);
  const [stickyBarDismissed, setStickyBarDismissed] = useState(false);
  const prevTrialStepRef = useRef<1 | 2 | 3>(1);
  const skipDeliveryTimeOffModalRef = useRef(false);
  const { evaluate: evaluateDeliveryTimeOff } = useDeliveryTimeOffConfig();
  const [deliveryTimeOffModal, setDeliveryTimeOffModal] = useState<{ title: string; description: string } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
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

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const all = await productsApi.getAll();
        const eligible = all.filter((product) => product.isActive !== false && product.isMembershipEligible);
        setProducts(eligible);
      } catch (error) {
        console.error('Failed to load trial products', error);
        showToast('Unable to load trial products right now.', 'error');
      } finally {
        setLoadingProducts(false);
      }
    };

    const loadDeliveryConfig = async () => {
      try {
        const cfg = await contentApi.getByType('subscription_delivery');
        const meta = (cfg?.metadata || {}) as Record<string, unknown>;
        if (Array.isArray(meta.deliveryTimeSlots)) {
          const parsed = meta.deliveryTimeSlots
            .map((slot) => {
              const data = slot as { label?: string; value?: string };
              return {
                label: (data.label || '').toString().trim(),
                value: (data.value || '').toString().trim(),
              };
            })
            .filter((slot) => slot.label && slot.value);
          if (parsed.length > 0) {
            setDeliveryTimeOptions(parsed);
            setDeliveryTime(parsed[0].value);
          }
        }

        const parsedServiceablePincodes = Array.isArray(meta.serviceablePincodes)
          ? meta.serviceablePincodes
              .map((entry: any) => (typeof entry === 'string' ? entry : entry?.pincode))
              .map((pin: any) => String(pin || '').trim())
              .filter((pin: string) => /^\d{6}$/.test(pin))
          : [];
        setSubscriptionServiceablePincodes(Array.from(new Set(parsedServiceablePincodes)));
      } catch {
        // Keep defaults if content is not configured yet.
        setSubscriptionServiceablePincodes([]);
      }
    };

    loadProducts();
    loadDeliveryConfig();
  }, [showToast]);

  useEffect(() => {
    const prev = prevTrialStepRef.current;
    if (currentStep === 1 && (prev === 2 || prev === 3)) {
      setStickyBarDismissed(false);
    }
    prevTrialStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    if (trialItems.length === 0) {
      setStickyBarDismissed(false);
    }
  }, [trialItems.length]);

  useEffect(() => {
    if (!isAuthenticated) {
      setSavedAddresses([]);
      setSelectedAddressId(null);
      return;
    }

    const loadAddresses = async () => {
      try {
        setLoadingAddresses(true);
        const data = await addressesApi.getAll();
        setSavedAddresses(data);
        const defaultAddress = data.find((address) => address.isDefault) || data[0] || null;
        setSelectedAddressId(defaultAddress?.id || null);
      } catch {
        setSavedAddresses([]);
        setSelectedAddressId(null);
      } finally {
        setLoadingAddresses(false);
      }
    };

    loadAddresses();
  }, [isAuthenticated]);

  const isDeliverable = (pin: string) => {
    const cleaned = (pin || '').trim();
    if (cleaned.length !== 6) return false;
    if (trialItems.length === 0) return true;
    return trialItems.every((item) => {
      const list = item.product.deliveryPincodes || [];
      if (list.length === 0) return true;
      return list.includes(cleaned);
    });
  };

  const isSubscriptionPincodeServiceable = (pin: string) => {
    const cleaned = (pin || '').trim();
    if (cleaned.length !== 6) return false;
    if (!subscriptionServiceablePincodes || subscriptionServiceablePincodes.length === 0) return true;
    return subscriptionServiceablePincodes.includes(cleaned);
  };

  const selectedAddress = useMemo(
    () => savedAddresses.find((address) => address.id === selectedAddressId) || null,
    [savedAddresses, selectedAddressId],
  );

  const isSelectedAddressBlockedBySubscriptionPincodes = useMemo(() => {
    if (!selectedAddress) return false;
    const pin = (selectedAddress.postalCode || '').trim();
    return pin.length === 6 && !isSubscriptionPincodeServiceable(pin);
  }, [selectedAddress, subscriptionServiceablePincodes]);

  const isAddressDeliverable = selectedAddress
    ? isDeliverable(selectedAddress.postalCode) && isSubscriptionPincodeServiceable(selectedAddress.postalCode)
    : false;
  const canProceedFromStepOne = trialItems.length > 0;
  const canProceedFromStepTwo = Boolean(selectedAddressId) && isAddressDeliverable && Boolean(deliveryTime);
  const canProceedToPayment = canProceedFromStepOne && canProceedFromStepTwo;
  const subtotal = useMemo(() => trialItems.reduce((sum, item) => sum + item.unitPrice, 0), [trialItems]);

  const trialItemsSignature = useMemo(
    () => trialItems.map((i) => `${i.key}:${i.product.id}:${i.variation?.id ?? ''}:${i.unitPrice}`).join('|'),
    [trialItems],
  );

  /** Human-readable slot for step 3 order summary (matches step 2 chip label when possible). */
  const trialDeliverySlotLabel = useMemo(() => {
    const v = (deliveryTime || '').trim();
    if (!v) return '—';
    const opt = deliveryTimeOptions.find((o) => o.value === v);
    if (opt?.label?.trim()) return opt.label.trim();
    return v;
  }, [deliveryTime, deliveryTimeOptions]);

  useEffect(() => {
    if (currentStep !== 3 || !isAuthenticated || !selectedAddressId || trialItems.length === 0) {
      setCheckoutBreakdown(null);
      setCheckoutBreakdownError(null);
      setCheckoutBreakdownLoading(false);
      return;
    }

    let cancelled = false;
    setCheckoutBreakdownLoading(true);
    setCheckoutBreakdownError(null);

    subscriptionsApi
      .estimateTrialPack({
        addressId: selectedAddressId,
        deliveryTime: deliveryTime || undefined,
        items: trialItems.map((item) => ({
          productId: item.product.id,
          variationId: item.variation?.id,
        })),
      })
      .then((data) => {
        if (!cancelled) {
          setCheckoutBreakdown(data);
          setCheckoutBreakdownLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCheckoutBreakdown(null);
          setCheckoutBreakdownError((err as { message?: string })?.message || 'Could not load delivery and fee totals.');
          setCheckoutBreakdownLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentStep, isAuthenticated, selectedAddressId, deliveryTime, trialItemsSignature, trialItems.length]);

  const trialCheckoutReady =
    currentStep !== 3 || (!!checkoutBreakdown && !checkoutBreakdownLoading && !checkoutBreakdownError);

  const addTrialItem = (payload: { product: Product; variation: ProductVariation | null }) => {
    const key = `${payload.product.id}::${payload.variation?.id || 'base'}`;
    const unitPrice = payload.variation?.price
      ? Number(payload.variation.price)
      : Number(payload.product.sellingPrice ?? payload.product.pricePerLitre);

    setTrialItems((current) => {
      if (current.some((item) => item.key === key)) {
        showToast('This product is already added to the trial pack.', 'success');
        return current;
      }
      showToast(`${current.length + 1} item${current.length === 0 ? '' : 's'} added as trial`, 'success');
      return [...current, { key, product: payload.product, variation: payload.variation, unitPrice }];
    });
  };

  const removeTrialItem = (key: string) => {
    setTrialItems((current) => current.filter((item) => item.key !== key));
  };

  const startAuthFlow = () => {
    const returnPath = stepsOnly ? '/trial-steps' : '/get-trial-pack';
    localStorage.setItem('milko_return_after_auth', returnPath);
    window.location.href = `/auth/login?redirect=${encodeURIComponent(returnPath)}`;
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
      showToast('Please fill all address fields.', 'error');
      return;
    }
    if (!isDeliverable(newAddressForm.postalCode.trim()) || !isSubscriptionPincodeServiceable(newAddressForm.postalCode.trim())) {
      showToast('This pincode is not deliverable for trial packs.', 'error');
      return;
    }

    setCreatingAddress(true);
    try {
      const created = await addressesApi.create({
        ...newAddressForm,
        isDefault: savedAddresses.length === 0,
      });
      const data = await addressesApi.getAll();
      setSavedAddresses(data);
      setSelectedAddressId(created.id);
      setShowAddLocationModal(false);
      showToast('Address added successfully.', 'success');
    } catch (error) {
      showToast((error as { message?: string })?.message || 'Failed to add address.', 'error');
    } finally {
      setCreatingAddress(false);
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

  const saveAddressFromMapModal = async () => {
    if (!mapModalAddress || !mapModalDraft) return;
    const d = mapModalDraft;
    if (!d.name.trim() || !d.phone.trim() || !d.street.trim() || !d.city.trim() || !d.state.trim() || !d.postalCode.trim()) {
      showToast('Please fill all address fields.', 'error');
      return;
    }
    if (!isDeliverable(d.postalCode.trim()) || !isSubscriptionPincodeServiceable(d.postalCode.trim())) {
      showToast('This pincode is not deliverable for trial packs.', 'error');
      return;
    }
    setMapSaving(true);
    try {
      const subscriptions = await subscriptionsApi.getAll().catch(() => []);
      if (isAddressLockedByAnyExistingSubscription(subscriptions, String(mapModalAddress.id))) {
        showToast('This address is already used in an existing plan. Add a new address for future plans.', 'error');
        return;
      }
      const updated = await addressesApi.update(mapModalAddress.id, { ...d });
      setSavedAddresses((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
      setMapModalAddress(null);
      setMapModalDraft(null);
      showToast('Address updated successfully.', 'success');
    } catch (error) {
      showToast((error as { message?: string })?.message || 'Could not update address.', 'error');
    } finally {
      setMapSaving(false);
    }
  };

  const handlePayment = async () => {
    if (!isAuthenticated || !user?.id) {
      startAuthFlow();
      return;
    }
    if (!selectedAddressId || !isAddressDeliverable || !deliveryTime || trialItems.length === 0) return;

    const dto = evaluateDeliveryTimeOff();
    if (dto.intercept && !skipDeliveryTimeOffModalRef.current) {
      setDeliveryTimeOffModal({ title: dto.title, description: dto.description });
      return;
    }
    skipDeliveryTimeOffModalRef.current = false;

    setSubmitting(true);
    let openedRazorpay = false;

    try {
      const result = await subscriptionsApi.createTrialPack({
        items: trialItems.map((item) => ({
          productId: item.product.id,
          variationId: item.variation?.id,
        })),
        addressId: selectedAddressId,
        deliveryTime,
        paymentMethod: trialPaymentMethod,
      });

      if (trialPaymentMethod === 'cod') {
        setShowSuccessModal(true);
        return;
      }

      if (!result.razorpayOrder?.id) {
        setShowSuccessModal(true);
        return;
      }

      const loadRazorpayScript = (): Promise<void> => {
        if (typeof window !== 'undefined' && (window as { Razorpay?: unknown }).Razorpay) {
          return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Razorpay'));
          document.head.appendChild(script);
        });
      };

      await loadRazorpayScript();
      const Razorpay = (window as unknown as { Razorpay: new (options: unknown) => { open: () => void } }).Razorpay;
      const rzp = new Razorpay({
        key: result.razorpayOrder.key,
        order_id: result.razorpayOrder.id,
        currency: result.razorpayOrder.currency || 'INR',
        name: SITE_NAME,
        description: 'Trial pack payment',
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string }) => {
          try {
            await subscriptionsApi.verifyTrialPackPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
            });
            setShowSuccessModal(true);
          } catch (error) {
            showToast((error as { message?: string })?.message || 'Payment verification failed.', 'error');
          } finally {
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => setSubmitting(false),
        },
      });
      openedRazorpay = true;
      rzp.open();
    } catch (error) {
      showToast((error as { message?: string })?.message || 'Failed to create the trial pack.', 'error');
    } finally {
      if (!openedRazorpay) setSubmitting(false);
    }
  };

  const startFlow = () => {
    setStickyBarDismissed(false);
    setHasStartedFlow(true);
    setCurrentStep(1);
    window.setTimeout(() => {
      document.getElementById('trial-pack-steps')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const openRelevantStepFromSticky = () => {
    if (currentStep === 1 && canProceedFromStepOne) {
      setCurrentStep(2);
      return;
    }
    if (currentStep === 2 && canProceedFromStepTwo) {
      setCurrentStep(3);
      return;
    }
    if (canProceedToPayment) setCurrentStep(3);
  };

  return (
    <div className={styles.page}>
      <DeliveryTimeOffModal
        open={deliveryTimeOffModal !== null}
        title={deliveryTimeOffModal?.title ?? ''}
        description={deliveryTimeOffModal?.description ?? ''}
        onProceed={() => {
          setDeliveryTimeOffModal(null);
          skipDeliveryTimeOffModalRef.current = true;
          void handlePayment();
        }}
        onClose={() => setDeliveryTimeOffModal(null)}
      />
      {!stepsOnly ? (
        <>
          <section className={styles.heroSection}>
            <div className={styles.sparkles} aria-hidden>
              <span className={styles.sparkle}>✦</span>
              <span className={styles.sparkle}>✦</span>
              <span className={styles.sparkle}>✦</span>
              <span className={styles.sparkle}>✦</span>
              <span className={styles.sparkle}>✦</span>
              <span className={styles.sparkle}>✦</span>
              <span className={styles.sparkle}>✦</span>
            </div>
            <div className={styles.heroIcon}>🐮</div>
            <h1 className={styles.heroTitle}>Taste the Full Experience, In Mini</h1>
            <p className={styles.heroText}>
              Experience a smaller pack before choosing the full plan. Get a taste of what we offer, at a lighter commitment.
              <br />
              Get a taste of what we offer, at a lighter commitment.
            </p>
            <button type="button" className={styles.pageButton} onClick={startFlow}>
              Claim My Trial Pack
              <span className={styles.pageButtonArrow}>→</span>
            </button>
          </section>

          <section className={styles.whySection}>
            <h2 className={styles.sectionHeading}>Why Members Start Here?</h2>
            <div className={styles.benefitGrid}>
              {BENEFITS.map((benefit) => (
                <article key={benefit.title} className={styles.benefitCard}>
                  <h3>{benefit.title}</h3>
                  <p>{benefit.text}</p>
                  <div className={styles.benefitArt} aria-hidden>{benefit.art}</div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.faqSection}>
            <h2 className={styles.sectionHeading}>We&apos;re here to answer all your questions.</h2>
            <div className={styles.faqList}>
              {FAQS.map((faq, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div key={faq.question} className={styles.faqItem}>
                    <button
                      type="button"
                      className={styles.faqTrigger}
                      onClick={() => setOpenFaqIndex(isOpen ? -1 : index)}
                    >
                      <span>{faq.question}</span>
                      <span className={`${styles.faqIcon} ${isOpen ? styles.faqIconOpen : ''}`}>
                        {isOpen ? '×' : '+'}
                      </span>
                    </button>
                    {isOpen ? <div className={styles.faqAnswer}>{faq.answer}</div> : null}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : null}

      {hasStartedFlow ? (
        <section id="trial-pack-steps" className={styles.stepSection}>
          <div className={styles.progressSteps}>
            <div className={`${styles.stepItem} ${currentStep >= 1 ? styles.stepItemActive : ''}`}>
              <span className={styles.stepCircle}>1</span>
              <span className={styles.stepLabel}>Products</span>
            </div>
            <div className={`${styles.stepLine} ${currentStep >= 2 ? styles.stepLineActive : ''}`} />
            <div className={`${styles.stepItem} ${currentStep >= 2 ? styles.stepItemActive : ''}`}>
              <span className={styles.stepCircle}>2</span>
              <span className={styles.stepLabel}>Address</span>
            </div>
            <div className={`${styles.stepLine} ${currentStep >= 3 ? styles.stepLineActive : ''}`} />
            <div className={`${styles.stepItem} ${currentStep >= 3 ? styles.stepItemActive : ''}`}>
              <span className={styles.stepCircle}>3</span>
              <span className={styles.stepLabel}>Payment</span>
            </div>
          </div>

          <div className={styles.stepHeader}>
            <h2 className={styles.stepTitle}>
              {currentStep === 1 ? 'Select products' : currentStep === 2 ? 'Confirm address and slot' : 'Review and pay'}
            </h2>
            <p className={styles.stepText}>
              {currentStep === 1
                ? 'Tap a product card to open the detail modal and add it to this trial pack.'
                : currentStep === 2
                  ? 'A deliverable pincode unlocks the delivery slot and the payment step.'
                  : 'Choose online or COD. Trial plans are valid for 1 day—each selected product is fulfilled once.'}
            </p>
          </div>

          {currentStep === 1 ? (
            <>
              {loadingProducts ? (
                <div className={styles.loadingBox}>Loading trial products...</div>
              ) : (
                <div className={styles.trialProductGrid}>
                  {products.map((product) => {
                    const productImage = getPrimaryProductImageUrl(product);
                    const categoryLabel = product.categoryId ? (categoryMap.get(product.categoryId) || 'Dairy') : 'Dairy';
                    const isOutOfStock = product.isActive === false || (typeof product.quantity === 'number' && product.quantity <= 0);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        className={`${productStyles.productCard} ${styles.productCardButton}`}
                        onClick={() => router.push(`/product/${product.id}`)}
                      >
                        <div className={productStyles.productImage}>
                          {isOutOfStock ? <div className={productStyles.outOfStockBadge}>Out of stock</div> : null}
                          <div className={productStyles.assuredBadge}>
                            <span>Trial ready</span>
                          </div>
                          {productImage ? (
                            <div className={`${styles.productImageWrapper} product-card-image-wrapper`}>
                              <Image
                                src={productImage}
                                alt={product.name}
                                fill
                                className={styles.productImageTag}
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                              />
                              {product.hoverNextImage && getOrderedProductImageUrls(product)[1] && (
                                <div className="product-card-hover-image-container">
                                  <Image
                                    src={getOrderedProductImageUrls(product)[1]}
                                    alt={product.name}
                                    fill
                                    style={{ objectFit: 'cover' }}
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className={productStyles.placeholderImage}>
                              <img src="/scribble-logo-bw.png" alt="Scribble Logo" className={productStyles.placeholderLogo} />
                            </div>
                          )}
                        </div>
                        <div className={productStyles.productInfo}>
                          <div className={productStyles.productCategory}>{categoryLabel}</div>
                          <div className={productStyles.productTitleRow}>
                            <h3 className={productStyles.productName}>{product.name}</h3>
                          </div>
                          <div className={productStyles.addToCartRow}>
                            <div className={productStyles.priceDisplay}>
                              <span className={productStyles.priceAmount}>{getCardPriceDisplay(product, 'Rs. ')}</span>
                              <span className={productStyles.priceUnit}>/{getProductDisplayUnitLabel(product)}</span>
                            </div>
                            <span className={styles.openHint}>Open</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className={styles.stepActions}>
                <button type="button" className={styles.primaryButton} disabled={!canProceedFromStepOne} onClick={() => setCurrentStep(2)}>
                  Proceed
                  <svg className={styles.buttonIcon} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" fill="none">
                    <path d="M26.8,11.5l-12,19C14.7,30.8,14.3,31,14,31c-0.1,0-0.2,0-0.3-0.1c-0.4-0.2-0.7-0.6-0.6-1.1L14.8,17H6 c-0.4,0-0.7-0.2-0.9-0.5c-0.2-0.3-0.1-0.7,0.1-1l10-14c0.3-0.4,0.7-0.5,1.1-0.4C16.7,1.2,17,1.6,17,2v8h9c0.4,0,0.7,0.2,0.9,0.5 C27,10.8,27,11.2,26.8,11.5z" fill="#ffffff"></path>
                  </svg>
                </button>
              </div>
            </>
          ) : null}

          {currentStep === 2 ? (
            <>
              {!isAuthenticated ? (
                <div className={`${styles.addressPrompt} ${styles.addressPromptSignIn}`}>
                  <div className={styles.addressPromptIcon} aria-hidden>
                    <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M205.735 290.665C155.409 242.963 94.9593 90.7124 198.78 64.9814C256.847 50.5932 289.256 117.652 275.878 166.285C264.567 207.397 234.224 242.805 215.301 280.323"
                        stroke="#000000"
                        strokeOpacity="0.9"
                        strokeWidth="16"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M189.108 132.102C246.901 97.3222 240.303 180.36 200.747 170.01C189.108 166.965 186.672 160.822 186.672 150.044"
                        stroke="#000000"
                        strokeOpacity="0.9"
                        strokeWidth="16"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M154.93 274.873C6.29812 328.742 232.117 357.483 281.256 319.162C318.054 290.46 277.824 274.873 249.19 274.873"
                        stroke="#000000"
                        strokeOpacity="0.9"
                        strokeWidth="16"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <p>Sign in to use your saved addresses for the trial pack.</p>
                  <button
                    type="button"
                    className={`${styles.primaryButton} ${styles.addressPromptSignInButton}`}
                    onClick={startAuthFlow}
                  >
                    Sign in
                  </button>
                </div>
              ) : loadingAddresses ? (
                <div className={styles.loadingBox}>Loading saved addresses...</div>
              ) : savedAddresses.length === 0 ? (
                <div className={styles.addressPrompt}>
                  <p>No saved address found yet.</p>
                  <button type="button" className={styles.secondaryButton} onClick={() => setShowAddLocationModal(true)}>Add new address</button>
                </div>
              ) : (
                <>
                  <div className={styles.addressGrid}>
                    {savedAddresses.map((address) => {
                      const isSelected = selectedAddressId === address.id;
                      const deliverable = isDeliverable(address.postalCode) && isSubscriptionPincodeServiceable(address.postalCode);
                      const hasPin = typeof address.latitude === 'number' && typeof address.longitude === 'number';
                      return (
                        <div key={address.id} className={`${styles.savedAddressCardOuter} ${isSelected ? styles.savedAddressCardOuterSelected : ''} ${!deliverable ? styles.savedAddressCardDisabled : ''}`}>
                          <label className={`${styles.savedAddressCard} ${isSelected ? styles.savedAddressCardSelected : ''}`}>
                            <input
                              type="radio"
                              name="trialAddress"
                              className={styles.addressRadio}
                              checked={isSelected}
                              onChange={() => setSelectedAddressId(address.id)}
                              disabled={!deliverable}
                            />
                            <div className={styles.savedAddressContent}>
                              <div className={styles.savedAddressHeader}>
                                <span className={styles.savedAddressName}>{address.name}</span>
                                {address.isDefault && <span className={styles.defaultBadge}>Default</span>}
                                {!deliverable && <span className={styles.unavailableBadge}>Not deliverable</span>}
                                {hasPin && <span className={styles.locationSavedBadge}>Map set</span>}
                              </div>
                              <div className={styles.savedAddressDetails}>
                                <p>{address.street}</p>
                                <p>{address.city}, {address.state} {address.postalCode}</p>
                              </div>
                            </div>
                          </label>
                          <button
                            type="button"
                            className={styles.setExactLocationBtn}
                            onClick={() => openMapModal(address)}
                          >
                            {hasPin ? 'Change Address' : 'Set address & map'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <button type="button" className={styles.addNewLocationBtn} onClick={openAddLocationModal}>
                    <span className={styles.addNewLocationIcon}>+</span>
                    Add new location
                  </button>

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

                  <div className={styles.slotBox}>
                    <h3 className={styles.slotTitle}>Available delivery slot</h3>
                    <p className={styles.slotText}>
                      {selectedAddress
                        ? isAddressDeliverable
                          ? 'This pincode is serviceable. Choose a slot for the one-time trial delivery.'
                          : 'This pincode is currently not serviceable for trial delivery.'
                        : 'Select an address to continue.'}
                    </p>
                    <div className={styles.slotChips}>
                      {deliveryTimeOptions.map((slot) => (
                        <button
                          key={slot.value}
                          type="button"
                          className={`${styles.slotChip} ${deliveryTime === slot.value ? styles.slotChipActive : ''}`}
                          disabled={!isAddressDeliverable}
                          onClick={() => setDeliveryTime(slot.value)}
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className={styles.stepActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setCurrentStep(1)}>Back</button>
                <button type="button" className={styles.primaryButton} disabled={!canProceedFromStepTwo} onClick={() => setCurrentStep(3)}>
                  Proceed
                  <svg className={styles.buttonIcon} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" fill="none">
                    <path d="M26.8,11.5l-12,19C14.7,30.8,14.3,31,14,31c-0.1,0-0.2,0-0.3-0.1c-0.4-0.2-0.7-0.6-0.6-1.1L14.8,17H6 c-0.4,0-0.7-0.2-0.9-0.5c-0.2-0.3-0.1-0.7,0.1-1l10-14c0.3-0.4,0.7-0.5,1.1-0.4C16.7,1.2,17,1.6,17,2v8h9c0.4,0,0.7,0.2,0.9,0.5 C27,10.8,27,11.2,26.8,11.5z" fill="#ffffff"></path>
                  </svg>
                </button>
              </div>
            </>
          ) : null}

          {currentStep === 3 ? (
            <>
              <div className={styles.summaryCard}>
                {trialItems.length === 0 ? (
                  <p className={styles.emptyState}>No trial items selected yet.</p>
                ) : (
                  <>
                    <div className={styles.summaryList}>
                      {trialItems.map((item) => (
                        <div key={item.key} className={styles.summaryRow}>
                          <div>
                            <strong>{item.product.name}</strong>
                            <p>
                              {item.variation?.size || 'Base pack'} •{' '}
                              {checkoutBreakdown?.trialCalendar?.durationDays != null &&
                              checkoutBreakdown.trialCalendar.durationDays > 1
                                ? `${checkoutBreakdown.trialCalendar.durationDays} calendar days trial (shifted schedule)`
                                : '1 day trial'}
                            </p>
                          </div>
                          <div className={styles.summaryRowRight}>
                            <strong>Rs. {item.unitPrice.toFixed(2)}</strong>
                            <button type="button" className={styles.removeButton} onClick={() => removeTrialItem(item.key)}>Remove</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {checkoutBreakdownLoading ? (
                      <p className={styles.checkoutEstimateHint}>Calculating delivery and platform fees…</p>
                    ) : null}
                    {checkoutBreakdownError ? (
                      <p className={styles.checkoutEstimateError}>{checkoutBreakdownError}</p>
                    ) : null}

                    <div className={styles.feeBreakdown}>
                      <div className={styles.feeBreakdownTitle}>Order summary</div>
                      <div className={styles.feeRow}>
                        <span>Delivery slot</span>
                        <span>{trialDeliverySlotLabel}</span>
                      </div>
                      {checkoutBreakdown ? (
                        <>
                          <div className={styles.feeRow}>
                            <span>Trial items (subtotal)</span>
                            <span>Rs. {checkoutBreakdown.subtotal.toFixed(2)}</span>
                          </div>
                          <div className={styles.feeRow}>
                            <span>
                              Delivery charges
                              {checkoutBreakdown.isFirstProductOrder && checkoutBreakdown.deliveryCharges === 0 ? (
                                <span className={styles.feeRowHint}> — waived on your first product order</span>
                              ) : null}
                            </span>
                            <span>Rs. {checkoutBreakdown.deliveryCharges.toFixed(2)}</span>
                          </div>
                          <div className={styles.feeRow}>
                            <span>Platform fee</span>
                            <span>Rs. {checkoutBreakdown.platformFee.toFixed(2)}</span>
                          </div>
                        </>
                      ) : null}
                    </div>

                    <div className={styles.paymentMethodBlock}>
                      <div className={styles.paymentMethodLabel}>Payment method</div>
                      <div className={styles.paymentMethodOptions} role="radiogroup" aria-label="Payment method">
                        <label
                          className={`${styles.paymentMethodOption} ${trialPaymentMethod === 'online' ? styles.paymentMethodOptionActive : ''}`}
                        >
                          <input
                            type="radio"
                            name="trialPayment"
                            checked={trialPaymentMethod === 'online'}
                            onChange={() => setTrialPaymentMethod('online')}
                          />
                          <span>
                            <span className={styles.paymentMethodOptionTitle}>Pay online </span>
                            <span className={styles.paymentMethodOptionHint}>Pay now with card/UPI. Your trial activates after payment is confirmed.</span>
                          </span>
                        </label>
                        <label
                          className={`${styles.paymentMethodOption} ${trialPaymentMethod === 'cod' ? styles.paymentMethodOptionActive : ''}`}
                        >
                          <input
                            type="radio"
                            name="trialPayment"
                            checked={trialPaymentMethod === 'cod'}
                            onChange={() => setTrialPaymentMethod('cod')}
                          />
                          <span>
                            <span className={styles.paymentMethodOptionTitle}>Cash on delivery (COD)</span>
                            <span className={styles.paymentMethodOptionHint}>
                              Pay the agent when your trial order is delivered.
                            </span>
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className={styles.totalRow}>
                      <span>Total payable</span>
                      <strong>Rs. {(checkoutBreakdown?.total ?? subtotal).toFixed(2)}</strong>
                    </div>
                  </>
                )}
              </div>

              <div className={styles.stepActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setCurrentStep(2)}>Back</button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={!canProceedToPayment || submitting || !trialCheckoutReady}
                  onClick={handlePayment}
                >
                  {submitting
                    ? trialPaymentMethod === 'cod'
                      ? 'Placing order...'
                      : 'Opening payment...'
                    : trialPaymentMethod === 'cod'
                      ? 'Place trial order (COD)'
                      : 'Proceed for payment'}
                  {!submitting && (
                    <svg className={styles.buttonIcon} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" fill="none">
                      <path d="M26.8,11.5l-12,19C14.7,30.8,14.3,31,14,31c-0.1,0-0.2,0-0.3-0.1c-0.4-0.2-0.7-0.6-0.6-1.1L14.8,17H6 c-0.4,0-0.7-0.2-0.9-0.5c-0.2-0.3-0.1-0.7,0.1-1l10-14c0.3-0.4,0.7-0.5,1.1-0.4C16.7,1.2,17,1.6,17,2v8h9c0.4,0,0.7,0.2,0.9,0.5 C27,10.8,27,11.2,26.8,11.5z" fill="#ffffff"></path>
                    </svg>
                  )}
                </button>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {hasStartedFlow && trialItems.length > 0 && !stickyBarDismissed ? (
        <div className={styles.stickyBar}>
          <div
            className={styles.stickyIcon}
            role="button"
            tabIndex={0}
            onClick={openRelevantStepFromSticky}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openRelevantStepFromSticky();
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
              <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
              <g id="SVGRepo_iconCarrier">
                <path fillRule="evenodd" clipRule="evenodd" d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM16.0303 8.96967C16.3232 9.26256 16.3232 9.73744 16.0303 10.0303L11.0303 15.0303C10.7374 15.3232 10.2626 15.3232 9.96967 15.0303L7.96967 13.0303C7.67678 12.7374 7.67678 12.2626 7.96967 11.9697C8.26256 11.6768 8.73744 11.6768 9.03033 11.9697L10.5 13.4393L12.7348 11.2045L14.9697 8.96967C15.2626 8.67678 15.7374 8.67678 16.0303 8.96967Z" fill="#00b377"></path>
              </g>
            </svg>
          </div>
          <div className={styles.stickyBarText}>
            <strong>{trialItems.length} item{trialItems.length === 1 ? '' : 's'} added as trial</strong>
            <p>
              Rs.{' '}
              {(currentStep === 3 && checkoutBreakdown ? checkoutBreakdown.total : subtotal).toFixed(2)}
              {' '}
              total
            </p>
          </div>
          <button
            type="button"
            className={styles.stickyClose}
            aria-label="Close trial summary bar"
            onClick={(e) => {
              e.stopPropagation();
              setStickyBarDismissed(true);
            }}
          >
            <span aria-hidden>×</span>
          </button>
        </div>
      ) : null}


      {showAddLocationModal && (
        <div className={styles.mapModalOverlay} onClick={closeAddLocationModal}>
          <div className={styles.mapModal} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.mapModalClose} onClick={closeAddLocationModal}>×</button>
            <h3 className={styles.mapModalTitle}>Add new location</h3>
            <p className={styles.mapModalSubtitle}>Enter your details and select the location on the map.</p>
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
              <AddressLocationPicker
                latitude={newAddressForm.latitude}
                longitude={newAddressForm.longitude}
                onChange={({ latitude, longitude }) => setNewAddressForm(p => ({ ...p, latitude, longitude }))}
                bottomCenterBadge={trialPaymentMethod === 'cod' ? 'COD' : undefined}
              />
            </div>
            <div className={styles.mapModalActions}>
              <button type="button" className={styles.mapModalCancel} onClick={closeAddLocationModal}>Cancel</button>
              <button type="button" className={styles.mapModalSave} disabled={creatingAddress} onClick={createAddressFromModal}>{creatingAddress ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {mapModalAddress && mapModalDraft && (
        <div className={styles.mapModalOverlay} onClick={closeMapModal}>
          <div className={styles.mapModal} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.mapModalClose} onClick={closeMapModal}>×</button>
            <h3 className={styles.mapModalTitle}>Edit delivery address</h3>
            <p className={styles.mapModalSubtitle}>Update your address details and map location.</p>
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
              <AddressLocationPicker
                latitude={mapModalDraft.latitude}
                longitude={mapModalDraft.longitude}
                onChange={({ latitude, longitude }) => setMapModalDraft(p => p ? { ...p, latitude, longitude } : p)}
                bottomCenterBadge={trialPaymentMethod === 'cod' ? 'COD' : undefined}
              />
            </div>
            <div className={styles.mapModalActions}>
              <button type="button" className={styles.mapModalCancel} onClick={closeMapModal}>Cancel</button>
              <button type="button" className={styles.mapModalSave} disabled={mapSaving} onClick={saveAddressFromMapModal}>{mapSaving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal ? (
        <div className={styles.modalOverlay}>
          <div className={styles.successCard}>
            <div className={styles.successIcon}>
              <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" fill="none">
                <g id="Energy01">
                  <path d="M26.87,12.49l-10,18C16.69,30.81,16.36,31,16,31c-0.08,0-0.17-0.01-0.25-0.03C15.31,30.85,15,30.46,15,30 V19H6c-0.34,0-0.65-0.17-0.84-0.45c-0.18-0.28-0.21-0.64-0.08-0.95l7-16C12.24,1.24,12.6,1,13,1h6c0.33,0,0.64,0.16,0.83,0.44 c0.18,0.27,0.22,0.62,0.1,0.93L16.48,11H26c0.35,0,0.68,0.19,0.86,0.49C27.04,11.8,27.05,12.18,26.87,12.49z" fill="#ff0040"></path>
                </g>
              </svg>
            </div>
            <h3>Trial pack confirmed</h3>
            <p>
              Congratulation! Your trial susbcription is now active for 1 Day. In case you find any errors, contact us.
            </p>
            <button type="button" className={styles.primaryButton} onClick={() => { window.location.href = '/subscriptions'; }}>
              View plans
              <svg className={styles.buttonIcon} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" fill="none">
                <path d="M26.8,11.5l-12,19C14.7,30.8,14.3,31,14,31c-0.1,0-0.2,0-0.3-0.1c-0.4-0.2-0.7-0.6-0.6-1.1L14.8,17H6 c-0.4,0-0.7-0.2-0.9-0.5c-0.2-0.3-0.1-0.7,0.1-1l10-14c0.3-0.4,0.7-0.5,1.1-0.4C16.7,1.2,17,1.6,17,2v8h9c0.4,0,0.7,0.2,0.9,0.5 C27,10.8,27,11.2,26.8,11.5z" fill="#ffffff"></path>
              </svg>
            </button>
          </div>
        </div>
      ) : null}

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
  );
}
