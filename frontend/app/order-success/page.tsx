'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { productsApi, trackCartEvent } from '@/lib/api';
import { Product } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import ProductDetailsModal from '@/components/ProductDetailsModal';
import { getPrimaryProductImageUrl } from '@/lib/utils/productImages';
import styles from './order-success.module.css';

export default function OrderSuccessPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [orderItems, setOrderItems] = useState<Array<{
    productId: string;
    variationId?: string;
    quantity: number;
    product: Product | null;
    variation?: { size?: string } | null;
    price: number;
    productName?: string;
    variationSize?: string;
    imageUrl?: string | null;
    taxPercent?: number;
  }>>([]);
  const [deliveryAddress, setDeliveryAddress] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [savings, setSavings] = useState<number>(0);
  const [orderSummary, setOrderSummary] = useState<{
    subtotal: number;
    discount: number;
    deliveryCharges: number;
    platformFee: number;
    total: number;
    paymentMethod: 'cod' | 'online' | 'wallet' | string;
    couponCode: string | null;
  } | null>(null);

  useEffect(() => {
    // Get order items from localStorage (saved before cart was cleared)
    const loadOrderData = async () => {
      try {
        // Get items from localStorage (saved before cart clear)
        const storedOrderItems = localStorage.getItem('milko_order_items');
        const storedItems = storedOrderItems ? JSON.parse(storedOrderItems) : [];
        
        if (storedItems.length === 0) {
          // If no items, redirect to home
          router.push('/');
          return;
        }

        // Load product details
        const unique: string[] = Array.from(new Set(storedItems.map((i: { productId: string }) => i.productId)));
        const entries = await Promise.all(
          unique.map(async (id: string) => {
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

        // Build order items: use product from fetch when available, else fallback to stored productName/imageUrl/unitPrice so items always show
        const items = storedItems.map((stored: {
          productId: string;
          variationId?: string;
          quantity: number;
          productName?: string;
          variationSize?: string;
          imageUrl?: string | null;
          unitPrice?: number;
          taxPercent?: number;
        }) => {
          const product = map[stored.productId] ?? null;
          const variation = product && stored.variationId
            ? (product.variations || []).find((v) => String(v.id) === String(stored.variationId))
            : null;
          const multiplier = variation?.priceMultiplier ?? 1;
          const base = product && (product.sellingPrice != null && product.sellingPrice !== undefined) ? product.sellingPrice : (product?.pricePerLitre ?? 0);
          const hasStoredUnitPrice = stored.unitPrice !== null && stored.unitPrice !== undefined;
          const isSubscriptionItem = (stored.productName || '').startsWith('Plan for ');
          const price = hasStoredUnitPrice
            ? Number(stored.unitPrice)
            : (product ? (variation?.price ?? base * multiplier) : 0);
          const taxPercent = stored.taxPercent ?? product?.taxPercent ?? 0;

          return {
            productId: stored.productId,
            variationId: stored.variationId,
            quantity: stored.quantity,
            product,
            variation,
            price,
            productName: stored.productName,
            variationSize: stored.variationSize,
            imageUrl: stored.imageUrl,
            taxPercent: isSubscriptionItem ? Number(taxPercent) : Number(taxPercent),
          };
        });

        setOrderItems(items);

        // Get delivery address from localStorage if available
        const savedAddress = localStorage.getItem('milko_delivery_address');
        if (savedAddress) {
          try {
            setDeliveryAddress(JSON.parse(savedAddress));
          } catch (e) {
            console.error('Failed to parse saved address:', e);
          }
        }

        const savedSavings = localStorage.getItem('milko_order_savings');
        if (savedSavings) {
          setSavings(parseFloat(savedSavings) || 0);
        }

        const savedSummary = localStorage.getItem('milko_order_summary');
        if (savedSummary) {
          try {
            setOrderSummary(JSON.parse(savedSummary));
          } catch (e) {
            console.error('Failed to parse order summary:', e);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Failed to load order data:', error);
        router.push('/');
      }
    };

    loadOrderData();
  }, [router]);

  useEffect(() => {
    // Marks the cart session as converted to an order, so it won't count as abandoned.
    void trackCartEvent({ eventType: 'order_placed', cartItemCount: 0 });
  }, []);

  // Calculate totals
  const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discount = Number(orderSummary?.discount || 0);
  const deliveryCharges = Number(orderSummary?.deliveryCharges || 0);
  const platformFee = Number(orderSummary?.platformFee || 0);
  const total = Number(orderSummary?.total ?? (subtotal - discount + deliveryCharges + platformFee));
  const savingsDisplay = Math.abs(Number(savings || 0));

  const formatPaymentMode = (method?: string) => {
    switch ((method || '').toLowerCase()) {
      case 'cod':
        return 'CASH';
      case 'online':
        return 'ONLINE';
      case 'wallet':
        return 'WALLET';
      default:
        return method ? method.toUpperCase() : 'CASH';
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Success Icon and Message */}
        <div className={styles.successSection}>
          <div className={styles.successIcon}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
              <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
              <g id="SVGRepo_iconCarrier">
                <path fillRule="evenodd" clipRule="evenodd" d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM16.0303 8.96967C16.3232 9.26256 16.3232 9.73744 16.0303 10.0303L11.0303 15.0303C10.7374 15.3232 10.2626 15.3232 9.96967 15.0303L7.96967 13.0303C7.67678 12.7374 7.67678 12.2626 7.96967 11.9697C8.26256 11.6768 8.73744 11.6768 9.03033 11.9697L10.5 13.4393L12.7348 11.2045L14.9697 8.96967C15.2626 8.67678 15.7374 8.67678 16.0303 8.96967Z" fill="#00a365"></path>
              </g>
            </svg>
          </div>
          <h1 className={styles.successTitle}>Thank you for your order!</h1>
          <p className={styles.successMessage}>Your order has been received and is being processed</p>
        </div>

        {/* Order Summary */}
        <div className={styles.orderSummarySection}>
          <div className={styles.sectionHeader}>
            <svg className={styles.sectionTitleIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2 className={styles.sectionTitle}>Order Summary</h2>
          </div>
          
          <div className={styles.itemsList}>
            {orderItems.map((item, index) => {
              const productImage =
                (item.product ? getPrimaryProductImageUrl(item.product) : null) || item.imageUrl || null;
              const isPlanItem =
                (item.productName || '').trim().toLowerCase().startsWith('plan for ')
                || (item.productName || '').trim().toLowerCase().startsWith('subscription for ');
              const packVariantLabel = item.variation?.size ?? '';
              const variationText = isPlanItem
                ? [packVariantLabel, item.variationSize].filter((s) => s && String(s).trim()).join(' · ')
                : (item.variation?.size ?? item.variationSize ?? '');
              const productName = (item.productName && item.productName.startsWith('Plan for '))
                ? item.productName
                : (item.product?.name ?? item.productName ?? 'Product');

              const handleItemClick = () => {
                if (item.productId) {
                  router.push(`/product/${item.productId}`);
                }
              };

              return (
                <div
                  key={index}
                  className={styles.orderItem}
                  onClick={handleItemClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleItemClick();
                    }
                  }}
                >
                  <div className={styles.itemImage}>
                    {productImage ? (
                      <Image
                        src={productImage}
                        alt={productName}
                        width={60}
                        height={60}
                        style={{ objectFit: 'cover', borderRadius: '8px' }}
                      />
                    ) : (
                      <div className={styles.itemImagePlaceholder}>
                        <span>🥛</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.itemDetails}>
                    <h3 className={styles.itemName}>{productName}</h3>
                    {((item.productName || '').trim().toLowerCase().startsWith('plan for ')
                      || (item.productName || '').trim().toLowerCase().startsWith('subscription for ')) && (
                      <p
                        className={styles.subscriptionTransferNote}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Plans are managed in My Account &gt;{' '}
                        <Link
                          href="/subscriptions"
                          className={styles.subscriptionTransferLink}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Plans
                        </Link>
                      </p>
                    )}
                    {variationText && <p className={styles.itemVariant}>{variationText}</p>}
                    <p className={styles.itemQuantity}>Qty: {item.quantity}</p>
                  </div>
                  <div className={styles.itemPrice}>
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.priceBreakdown}>
            <div className={styles.priceRow}>
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className={styles.priceRow}>
                <span>{orderSummary?.couponCode ? `Discount (${orderSummary.couponCode})` : 'Discount'}</span>
                <span className={styles.savingsAmount}>-₹{discount.toFixed(2)}</span>
              </div>
            )}
            <div className={styles.priceRow}>
              <span>Delivery Charges</span>
              <span className={deliveryCharges > 0 ? '' : styles.freeShipping}>
                {deliveryCharges > 0 ? `₹${deliveryCharges.toFixed(2)}` : 'Free'}
              </span>
            </div>
            <div className={styles.priceRow}>
              <span>Platform Fee</span>
              <span>{platformFee > 0 ? `₹${platformFee.toFixed(2)}` : '₹0.00'}</span>
            </div>
            <div className={styles.priceRow}>
              <span>Mode of Payment</span>
              <span>{formatPaymentMode(orderSummary?.paymentMethod)}</span>
            </div>
            <div className={styles.priceRowTotal}>
              <span>Total</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
            {savingsDisplay > 0 && (
              <div className={`${styles.priceRow} ${styles.savingsRow}`}>
                <span>Your Savings</span>
                <span className={styles.savingsAmount}>+₹{savingsDisplay.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Delivery Details */}
        {deliveryAddress && (
          <div className={styles.deliverySection}>
            <div className={styles.sectionHeader}>
              <svg className={styles.sectionTitleIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2 className={styles.sectionTitle}>Delivery Details</h2>
            </div>
            <div className={styles.deliveryContent}>
              <p className={styles.deliveryLabel}>Shipping to</p>
              <div className={styles.deliveryAddress}>
                <p>{deliveryAddress.name}</p>
                <p>{deliveryAddress.street}</p>
                <p>{deliveryAddress.city}, {deliveryAddress.state} {deliveryAddress.postalCode}</p>
                <p>{deliveryAddress.country}</p>
              </div>
              <div className={styles.shippingMethod}>
                <svg className={styles.truckIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 3H15V13H1V3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M15 7H19L22 10V13H15V7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="5" cy="17" r="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="19" cy="17" r="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Shipping method</span>
                <span className={styles.shippingMethodValue}>Standard Delivery</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className={styles.actionButtons}>
          <Link href="/orders" className={styles.viewOrdersButton}>
            View Orders
          </Link>
          <Link href="/" className={styles.continueShoppingButton}>
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
