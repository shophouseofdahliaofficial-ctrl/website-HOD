'use client';

import { useState, useEffect, useMemo } from 'react';
import { productsApi } from '@/lib/api';
import { Product, ProductVariation } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import styles from './MembershipSection.module.css';
import Select from '@/components/ui/Select';
import Link from 'next/link';

/**
 * Membership Section Component
 * Shows membership subscription form with dropdowns
 * - Product selection
 * - Quantity per day
 * - Duration (days)
 * - Calculated amount
 * - Buy button
 */
export default function MembershipSection() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [quantityPerDay, setQuantityPerDay] = useState<string>('1');
  const [durationDays, setDurationDays] = useState<string>('30');
  const [loading, setLoading] = useState(true);

  // Fallback demo products (dev-only). Never show these on production if backend is slow/unavailable.
  const showDemoFallback = process.env.NODE_ENV !== 'production';
  const fallbackProducts: Product[] = [
    {
      id: '1',
      name: 'Polaroid Prints',
      description: 'Classic instant-style prints for your favorite moments.',
      pricePerLitre: 60,
      imageUrl: undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Photo Strips',
      description: 'Fun booth-style strips perfect for gifts and keepsakes.',
      pricePerLitre: 70,
      imageUrl: undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '3',
      name: 'Memory Book',
      description: 'Handcrafted albums to preserve your cherished memories.',
      pricePerLitre: 55,
      imageUrl: undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '4',
      name: 'Custom Frame',
      description: 'Premium frames tailored to your photos and style.',
      pricePerLitre: 65,
      imageUrl: undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await productsApi.getAll();
        if (data && data.length > 0) {
          let finalProducts = data;
          const eligibleProducts = data.filter(p => p.isMembershipEligible === true);
          if (eligibleProducts.length > 0) {
            finalProducts = eligibleProducts;
          } else {
            const activeProducts = data.filter(p => p.isActive);
            if (activeProducts.length > 0) finalProducts = activeProducts;
          }
          
          setProducts(finalProducts);
          
          if (finalProducts.length > 0) {
            const firstProduct = finalProducts[0];
            if (firstProduct.variations && firstProduct.variations.length > 0) {
              setSelectedProduct(`${firstProduct.id}::${firstProduct.variations[0].id}`);
            } else {
              setSelectedProduct(firstProduct.id);
            }
          }
        } else {
          if (showDemoFallback) {
            setProducts(fallbackProducts);
            setSelectedProduct(fallbackProducts[0].id);
          } else {
            setProducts([]);
            setSelectedProduct('');
          }
        }
      } catch (error) {
        console.error('Failed to fetch products:', error);
        if (showDemoFallback) {
          // Use fallback products if API fails (dev only)
          setProducts(fallbackProducts);
          setSelectedProduct(fallbackProducts[0].id);
        } else {
          setProducts([]);
          setSelectedProduct('');
          showToast('Unable to load membership options right now.', 'error');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Calculate total amount
  let selectedProductData: Product | undefined;
  let currentVariation: ProductVariation | undefined;
  let basePrice = 0;

  if (selectedProduct) {
    const [pid, vid] = selectedProduct.split('::');
    selectedProductData = products.find(p => p.id === pid);
    if (selectedProductData) {
      if (vid && selectedProductData.variations) {
        currentVariation = selectedProductData.variations.find((v: any) => v.id === vid);
      }
      if (currentVariation) {
        const vPrice = currentVariation.price ?? (selectedProductData.pricePerLitre * (currentVariation.priceMultiplier || 1));
        basePrice = vPrice / (currentVariation.priceMultiplier || 1);
      } else {
        basePrice = selectedProductData.pricePerLitre;
      }
    }
  }

  const maxSubscriptionQuantity = useMemo(() => {
    const rawLimit = Number(selectedProductData?.maxQuantity);
    return Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.max(1, Math.floor(rawLimit)) : 10;
  }, [selectedProductData?.maxQuantity]);

  useEffect(() => {
    setQuantityPerDay((prev) => {
      const next = Math.min(Math.max(1, Math.floor(Number(prev) || 1)), maxSubscriptionQuantity);
      return String(next);
    });
  }, [maxSubscriptionQuantity]);

  const quantityOptions = useMemo(
    () => Array.from({ length: maxSubscriptionQuantity }, (_, index) => {
      const qty = index + 1;
      return { value: String(qty), label: String(qty) };
    }),
    [maxSubscriptionQuantity],
  );

  const totalAmount = selectedProductData
    ? parseFloat(quantityPerDay) * parseFloat(durationDays) * basePrice
    : 0;

  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleBuy = () => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!selectedProduct || !quantityPerDay || !durationDays) {
      alert('Please fill in all fields');
      return;
    }

    // Convert days to months (approximate - 30 days = 1 month)
    const days = parseInt(durationDays);
    const months = Math.max(1, Math.round(days / 30));

    // Navigate to subscribe page with pre-filled data
    const [productId, variationId] = selectedProduct.split('::');
    let url = `/subscribe?productId=${productId}&liters=${quantityPerDay}&days=${durationDays}&months=${months}`;
    if (variationId) {
      url += `&variationId=${variationId}`;
    }
    router.push(url);
  };

  if (loading) {
    return (
      <div id="membership" className={styles.membershipSection}>
        <div className={styles.container}>
          <span id="subscriptions" style={{ display: 'block', height: 0 }} aria-hidden="true" />
          <h2 className={styles.sectionTitle}>Become a Member</h2>
          <p className={styles.sectionSubtitle}>Unlock exclusive benefits and priority access</p>

          <div className={styles.twoColumnLayout}>
            {/* Left Column - Benefits (shimmer) */}
            <div className={styles.benefitsColumn}>
              <h3 className={styles.benefitsTitle}>Why Choose Membership?</h3>
              <ul className={styles.benefitsList}>
                <li className={styles.benefitItem}>
                  <span className={styles.benefitIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M20 6L9 17l-5-5"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className={`${styles.benefitText} ${styles.shimmerText}`}>
                    Premium quality products, handled with care.
                  </span>
                </li>
                <li className={styles.benefitItem}>
                  <span className={styles.benefitIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M20 6L9 17l-5-5"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className={`${styles.benefitText} ${styles.shimmerText}`}>
                    Cancel Anytime, unused amount transferred to wallet.
                  </span>
                </li>
              </ul>
            </div>

            {/* Right Column placeholder (shimmer) */}
            <div className={styles.membershipCard}>
              <div className={styles.loading}>Loading membership options...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="membership" className={styles.membershipSection}>
      <div className={styles.container}>
        <span id="subscriptions" style={{ display: 'block', height: 0 }} aria-hidden="true" />
        <h2 className={styles.sectionTitle}>Become a Member</h2>
        <p className={styles.sectionSubtitle}>Unlock exclusive benefits and priority access</p>
        
        <div className={styles.twoColumnLayout}>
          {/* Left Column - Benefits */}
          <div className={styles.benefitsColumn}>
            <h3 className={styles.benefitsTitle}>Why Choose Membership?</h3>
            <ul className={styles.benefitsList}>
              <li className={styles.benefitItem}>
                <span className={styles.benefitIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className={styles.benefitText}>Premium quality products, handled with care.</span>
              </li>
              <li className={styles.benefitItem}>
                <span className={styles.benefitIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className={styles.benefitText}>Quality-checked before every order.</span>
              </li>
              <li className={styles.benefitItem}>
                <span className={styles.benefitIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className={styles.benefitText}>Careful handling and dispatch for every order.</span>
              </li>
              <li className={styles.benefitItem}>
                <span className={styles.benefitIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className={styles.benefitText}>Priority support and assured supply for members.</span>
              </li>
              <li className={styles.benefitItem}>
                <span className={styles.benefitIcon}>💰</span>
                <span className={styles.benefitText}>Satisfaction guaranteed on eligible products.</span>
              </li>
              <li className={styles.benefitItem}>
                <span className={styles.benefitIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className={styles.benefitText}>Cancel Anytime, unused amount transferred to wallet.</span>
              </li>
            </ul>
          </div>

          {/* Right Column - Membership Card */}
          <div className={styles.membershipCard}>
          <div className={styles.formFields}>
            {/* Product Selection */}
            <div className={styles.formField}>
              <label className={styles.label}>Select Product</label>
              <Select
                className={styles.select}
                value={selectedProduct}
                onChange={setSelectedProduct}
                options={products.flatMap((product) => {
                  if (product.variations && product.variations.length > 0) {
                    return product.variations.map((v) => {
                      const price = v.price ?? (product.pricePerLitre * (v.priceMultiplier || 1));
                      return {
                        value: `${product.id}::${v.id}`,
                        label: `${product.name} [${v.size} - ₹${price}]`,
                      };
                    });
                  }
                  return [{
                    value: product.id,
                    label: `${product.name} [1L - ₹${product.pricePerLitre}]`,
                  }];
                })}
              />
            </div>

            {/* Quantity */}
            <div className={styles.formField}>
              <label className={styles.label}>Quantity</label>
              <Select
                className={styles.select}
                value={quantityPerDay}
                onChange={setQuantityPerDay}
                options={quantityOptions}
              />
            </div>

            {/* Duration (Days) */}
            <div className={styles.formField}>
              <label className={styles.label}>Duration</label>
              <Select
                className={styles.select}
                value={durationDays}
                onChange={setDurationDays}
                options={[
                  { value: '7', label: '7 Days (1 Week)' },
                  { value: '15', label: '15 Days' },
                  { value: '30', label: '30 Days (1 Month)' },
                  { value: '60', label: '60 Days (2 Months)' },
                  { value: '90', label: '90 Days (3 Months)' },
                  { value: '180', label: '180 Days (6 Months)' },
                  { value: '365', label: '365 Days (1 Year)' },
                ]}
              />
            </div>
          </div>

          {/* Amount Display */}
          <div className={styles.amountSection}>
            <div className={styles.amountLabel}>Total Amount</div>
            <div className={styles.amountValue}>
              ₹{formatINR(totalAmount)}
            </div>
            {selectedProductData && (
              <div className={styles.amountBreakdown}>
                {quantityPerDay} qty/day × {durationDays} days × ₹{formatINR(basePrice)}
              </div>
            )}
          </div>

          {/* Buy Button */}
          <button
            className={styles.buyButton}
            onClick={handleBuy}
            disabled={!selectedProduct || totalAmount === 0}
          >
            {isAuthenticated ? 'Join Now' : 'Login to Join'}
          </button>
          <div className={styles.trialLinkContainer}>
            <span>Not ready for a full plan? </span>
            <Link href="/get-trial-pack" className={styles.trialLink}>
              Grab Trial Pack
            </Link>
          </div>
          <div className={styles.termsConsent}>
            By clicking, you agree to{' '}
            <Link href="/terms" className={styles.termsLink}>
              Terms &amp; Condition
            </Link>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

