'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, contentApi } from '@/lib/api';
import { Product } from '@/types';
import HowWasItModal from '@/components/HowWasItModal';
import { useToast } from '@/contexts/ToastContext';
import { useCart } from '@/contexts/CartContext';
import CustomerSidebarLayout from '@/components/customer/CustomerSidebarLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import styles from './page.module.css';
import { formatDdMmYyIST, formatFullDateIST } from '@/lib/utils/datetime';
import { getPrimaryProductImageUrl } from '@/lib/utils/productImages';

function fmtDdMmYy(iso: string | null | undefined): string {
  const s = formatDdMmYyIST(iso);
  return s || '—';
}

function fmtDeliveryDate(iso: string | null | undefined): string {
  if (!iso) return 'Delivered';
  return formatFullDateIST(iso) || 'Delivered';
}

function getEstimatedDeliveryText(createdAt: string | null | undefined): string {
  if (!createdAt) return '7 days of delivery when ordered';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '7 days of delivery when ordered';

  const estDate = new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000);
  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
  }).format(estDate);

  return `Estimated delivery on ${formattedDate}`;
}

type DetailedFeedback = {
  qualityStars: number;
  deliveryAgentStars: number | null;
  onTimeStars: number | null;
  valueForMoneyStars: number | null;
  wouldOrderAgain: string | null;
};

type OrderItem = {
  productName: string;
  variationSize: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  productId: number | null;
  imageUrl: string | null;
  variationId?: number | null;
  buyAgainEnabled?: boolean;
  detailedFeedback?: DetailedFeedback | null;
};

type MyOrder = {
  id: string;
  orderNumber: string;
  createdAt: string | null;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  itemsCount: number;
  deliveryDate: string | null;
  items: OrderItem[];
};

type OrderLine = { item: OrderItem; orderItemIndex: number };

type OrderGroup = {
  order: MyOrder;
  lines: OrderLine[];
};

function isSubscriptionOrderItem(item: OrderItem): boolean {
  return (item.productName || '').trim().toLowerCase().startsWith('subscription for ');
}

/** Line items the customer can rate (excludes subscription rows). */
function countRatableOrderItems(order: MyOrder): number {
  return order.items.filter((i) => !isSubscriptionOrderItem(i) && i.productId != null).length;
}

function getDeliveryDisplay(order: MyOrder): string {
  if (order.status === 'cancelled' || order.status === 'refunded') return '—';
  // On its way: placed, confirmed, package_prepared, shipped, in_transit, reached_destination_hub, out_for_delivery
  if (['placed', 'confirmed', 'package_prepared', 'shipped', 'in_transit', 'reached_destination_hub', 'out_for_delivery'].includes(order.status)) return 'On its way';
  if (order.status === 'delivered') {
    if (order.deliveryDate) return fmtDeliveryDate(order.deliveryDate);
    return 'Delivered';
  }
  return '—';
}

function isOnTheWay(order: MyOrder): boolean {
  return ['placed', 'confirmed', 'package_prepared', 'shipped', 'in_transit', 'reached_destination_hub', 'out_for_delivery'].includes(order.status);
}

/**
 * My Orders — one compact row per order (first product preview). More lines: +x on image; full list on order details.
 */
export default function OrdersPage() {
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingModal, setRatingModal] = useState<{ order: MyOrder; productId: number } | null>(null);
  const { showToast } = useToast();
  const { addItem } = useCart();
  const router = useRouter();

  const [photoboothSettings, setPhotoboothSettings] = useState<any>(null);
  const [coverProducts, setCoverProducts] = useState<Record<string, Product>>({});

  const getFallbackImageUrl = (item: OrderItem) => {
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

    const nameLower = (item.productName || '').toLowerCase();
    const isPolaroid = (polaroidProdId && String(item.productId) === String(polaroidProdId)) || nameLower.includes('polaroid');
    const isPhotostrip = (photostripProdId && String(item.productId) === String(photostripProdId)) || nameLower.includes('strip');

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
                  const p = await apiClient.get<Product>(`/api/products/${id}`);
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

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await apiClient.get<MyOrder[]>('/api/orders');
        setOrders(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const orderGroups: OrderGroup[] = [];
  for (const order of orders) {
    const lines: OrderLine[] = [];
    for (let orderItemIndex = 0; orderItemIndex < (order.items || []).length; orderItemIndex++) {
      const item = order.items[orderItemIndex];
      if (isSubscriptionOrderItem(item)) continue;
      lines.push({ item, orderItemIndex });
    }
    if (lines.length === 0) continue;
    orderGroups.push({ order, lines });
  }

  orderGroups.sort((a, b) => {
    const ta = a.order.createdAt ? new Date(a.order.createdAt).getTime() : 0;
    const tb = b.order.createdAt ? new Date(b.order.createdAt).getTime() : 0;
    return tb - ta;
  });

  // Group by month: each month lists whole orders (not split per line item)
  const monthGroups: { key: string; label: string; orderGroups: OrderGroup[]; itemCount: number }[] = (() => {
    const map = new Map<string, { label: string; orderGroups: OrderGroup[] }>();
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();

    for (const og of orderGroups) {
      const d = og.order.createdAt ? new Date(og.order.createdAt) : new Date();
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      if (!map.has(key)) {
        const monthName = d.toLocaleString('en-US', { month: 'long' });
        const label = y === thisYear && m === thisMonth ? `This month (${monthName})` : `${monthName} ${y}`;
        map.set(key, { label, orderGroups: [] });
      }
      map.get(key)!.orderGroups.push(og);
    }

    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, { label, orderGroups: ogs }]) => ({
        key,
        label,
        orderGroups: ogs,
        itemCount: ogs.reduce((sum, g) => sum + g.lines.length, 0),
      }));
  })();

  if (loading) {
    return (
      <CustomerSidebarLayout>
        <LoadingSpinner fullHeight />
      </CustomerSidebarLayout>
    );
  }

  return (
    <CustomerSidebarLayout>
      <h1 className={styles.pageTitle}>My Orders</h1>

      <div className={styles.ordersList}>
        {monthGroups.map(({ key, label, orderGroups: monthOrderGroups, itemCount }) => (
          <div key={key} className={styles.monthGroup}>
            <div className={styles.monthGroupHeader}>
              <span className={styles.monthGroupLabel}>{label}</span>
              <span className={styles.monthGroupCount}>
                {itemCount} item{itemCount !== 1 ? 's' : ''} ordered
              </span>
            </div>
            <div className={styles.monthGroupRows}>
              {monthOrderGroups.map(({ order, lines }) => {
                const preview = lines[0];
                const item = preview.item;
                const extraProductCount = lines.length - 1;
                const deliveryDisplay = getDeliveryDisplay(order);
                const onTheWay = isOnTheWay(order);
                const orderDate = fmtDdMmYy(order.createdAt);
                const itemLabel = `Qty ${item.quantity}`;
                const variation = item.variationSize ? item.variationSize : null;
                const ratableLineCount = countRatableOrderItems(order);
                const ratableItems = order.items.filter(
                  (i) => !isSubscriptionOrderItem(i) && i.productId != null,
                );
                const allRatableLinesRated =
                  ratableLineCount > 1 &&
                  ratableItems.every(
                    (i) => i.detailedFeedback != null && i.detailedFeedback.qualityStars >= 1,
                  );
                const hasBuyAgainItems = order.items.some(
                  (i) => !isSubscriptionOrderItem(i) && i.productId != null && i.buyAgainEnabled !== false,
                );
                const scrollToFirstUnratedItemIndex = (): number => {
                  for (let i = 0; i < order.items.length; i++) {
                    const it = order.items[i];
                    if (isSubscriptionOrderItem(it) || it.productId == null) continue;
                    if (it.detailedFeedback == null || it.detailedFeedback.qualityStars < 1) return i;
                  }
                  return preview.orderItemIndex;
                };
                const openRateOrDetails = () => {
                  if (item.productId == null) return;
                  if (ratableLineCount <= 1) {
                    setRatingModal({ order, productId: item.productId });
                  } else {
                    router.push(
                      `/orders/${order.id}#order-item-${scrollToFirstUnratedItemIndex()}`,
                    );
                  }
                };

                const isDelivered = order.status === 'delivered';
                const isCancelledOrRefunded = ['cancelled', 'refunded'].includes(order.status);
                const statusText = isDelivered 
                  ? 'Delivered' 
                  : isCancelledOrRefunded 
                    ? (order.status === 'cancelled' ? 'Cancelled' : 'Refunded')
                    : 'On its way';

                const getDeliveredDateShort = (iso: string | null | undefined): string => {
                  if (!iso) return '';
                  const d = new Date(iso);
                  if (Number.isNaN(d.getTime())) return '';
                  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
                };

                const statusSubtext = isDelivered 
                  ? (getDeliveredDateShort(order.deliveryDate) || getDeliveredDateShort(order.createdAt) || 'Delivered')
                  : isCancelledOrRefunded 
                    ? '' 
                    : getEstimatedDeliveryText(order.createdAt);

                return (
                  <div key={order.id} className={styles.orderRow}>
                      {/* 1. Status Banner Header */}
                      <div className={styles.orderStatusBanner}>
                        {isDelivered ? (
                          <svg className={styles.statusPinIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg className={styles.statusPinIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
                            <circle cx="12" cy="10" r="3"/>
                          </svg>
                        )}
                        <div className={styles.statusBannerTextCol}>
                          <span className={styles.statusText}>{statusText}</span>
                          {statusSubtext ? <span className={styles.statusSubtext}>{statusSubtext}</span> : null}
                        </div>
                      </div>

                      {/* 2. Large Cover Image */}
                      <div className={styles.orderCoverImageContainer}>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.productName} className={styles.orderCoverImage} />
                        ) : getFallbackImageUrl(item) ? (
                          <img src={getFallbackImageUrl(item)!} alt={item.productName} className={styles.orderCoverImage} />
                        ) : (
                          <div className={styles.orderCoverPlaceholder}>📦</div>
                        )}
                        {extraProductCount > 0 ? (
                          <div className={styles.coverExtraBadge} aria-hidden>
                            +{extraProductCount}
                          </div>
                        ) : null}
                      </div>

                      {/* 3. Title & Info Block */}
                      <div className={styles.orderInfoBlock}>
                        <div className={styles.orderInfoLeft}>
                          <h3 
                            className={styles.orderTitleText}
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              navigator.clipboard
                                .writeText(order.orderNumber)
                                .then(() => showToast('Copied order number!', 'success'))
                                .catch(() => {});
                            }}
                            title="Click to copy order number"
                          >
                            Order #{order.orderNumber}
                          </h3>
                          <p className={styles.orderItemCountText}>
                            {order.itemsCount} item{order.itemsCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className={styles.orderInfoRight}>
                          <span className={styles.orderPriceText}>₹{order.total.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* 4. Rating Block (above buttons) */}
                      {order.status === 'delivered' && (
                        <div className={styles.ratingSectionWrap}>
                          {ratableLineCount <= 1 &&
                          item.detailedFeedback != null &&
                          item.detailedFeedback.qualityStars >= 1 ? (
                            <div className={styles.orderRowRated}>
                              <span className={styles.orderRowRateIcon} aria-hidden>
                                ★
                              </span>
                              <span>
                                You rated {item.detailedFeedback.qualityStars} star
                                {item.detailedFeedback.qualityStars !== 1 ? 's' : ''}
                              </span>
                            </div>
                          ) : null}
                          {ratableLineCount <= 1 &&
                          (item.detailedFeedback == null || item.detailedFeedback.qualityStars < 1) &&
                          item.productId != null ? (
                            <div
                              className={styles.orderRowRate}
                              role="button"
                              tabIndex={0}
                              onClick={openRateOrDetails}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  openRateOrDetails();
                                }
                              }}
                            >
                              <span className={styles.orderRowRateIcon} aria-hidden>
                                ★
                              </span>
                              <span>Rate this product</span>
                              <svg
                                className={styles.orderRowRateArrow}
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden
                              >
                                <path
                                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                          ) : null}
                          {ratableLineCount > 1 && allRatableLinesRated ? (
                            <div className={styles.orderRowRated}>
                              <span className={styles.orderRowRateIcon} aria-hidden>
                                ★
                              </span>
                              <span>You rated all products in this order</span>
                            </div>
                          ) : null}
                          {ratableLineCount > 1 && !allRatableLinesRated ? (
                            <div
                              className={styles.orderRowRate}
                              role="button"
                              tabIndex={0}
                              onClick={openRateOrDetails}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  openRateOrDetails();
                                }
                              }}
                            >
                              <span className={styles.orderRowRateIcon} aria-hidden>
                                ★
                              </span>
                              <span>Rate products</span>
                              <svg
                                className={styles.orderRowRateArrow}
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden
                              >
                                <path
                                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* 5. Buttons Actions Block */}
                      <div className={styles.orderRowActions}>
                        {order.status === 'delivered' ? (
                          <>
                            {hasBuyAgainItems && (
                              <button
                                type="button"
                                className={styles.orderRowBtn}
                                onClick={() => {
                                  order.items.forEach((it) => {
                                    if (it.productId != null && !isSubscriptionOrderItem(it) && it.buyAgainEnabled !== false) {
                                      addItem({
                                        productId: String(it.productId),
                                        quantity: it.quantity,
                                        variationId: it.variationId != null ? String(it.variationId) : undefined,
                                      });
                                    }
                                  });
                                  router.push('/cart');
                                }}
                              >
                                Buy again
                              </button>
                            )}
                            <Link href={`/orders/${order.id}`} className={styles.orderRowBtn}>
                              Manage
                              <svg
                                className={styles.manageBtnArrow}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </Link>
                          </>
                        ) : (
                          <Link href={`/orders/${order.id}`} className={styles.orderRowBtn}>
                            Manage
                            <svg
                              className={styles.manageBtnArrow}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </Link>
                        )}
                      </div>
                    </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!loading && monthGroups.length === 0 && (
        <div className={styles.emptyWrap}>
          <svg
            className={styles.emptyIcon}
            viewBox="0 0 400 400"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M165.422 118C143.491 123.058 126.618 136.955 111.006 152.01" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M253.848 119.7C272.72 119.749 287.787 143.995 292.959 150.309" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M146.715 192.716C166.576 207.398 186.752 202.825 199.43 182.619" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M247.044 186.02C259.746 201.095 271.399 201.577 284.455 189.018" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M179.026 261.873C206.732 247.414 225.946 248.579 245.345 271.044" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M117.967 216.629C158.934 302.598 57.9977 313.358 108.496 224.768" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className={styles.emptyText}>
            {orders.length === 0
              ? "You don't have any orders yet."
              : 'No product orders to show here yet.'}
          </p>
          <Link href="/products" className={styles.browseLink}>
            Browse Products
          </Link>
        </div>
      )}

      <HowWasItModal
        isOpen={!!ratingModal}
        onClose={() => setRatingModal(null)}
        order={
          ratingModal
            ? {
                id: ratingModal.order.id,
                // Filter to the rated product so the modal can infer it without productId prop.
                items: ratingModal.order.items
                  .filter((i) => i.productId === ratingModal.productId)
                  .map((i) => ({ productId: i.productId })),
              }
            : null
        }
        onSubmitSuccess={async () => {
          setRatingModal(null);
          try {
            const data = await apiClient.get<MyOrder[]>('/api/orders');
            setOrders(Array.isArray(data) ? data : []);
          } catch {
            /* keep list */
          }
        }}
      />
    </CustomerSidebarLayout>
  );
}
