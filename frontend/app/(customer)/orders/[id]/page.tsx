'use client';

export const runtime = 'edge';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient, productsApi, contentApi } from '@/lib/api';
import { Product } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { useCart } from '@/contexts/CartContext';
import ProductDetailsModal from '@/components/ProductDetailsModal';
import HowWasItModal from '@/components/HowWasItModal';
import styles from './page.module.css';
import Link from 'next/link';
import { formatDdMmYyIST, formatFullDateIST, formatTimelineStepIST } from '@/lib/utils/datetime';
import { getCardPriceDisplay } from '@/lib/utils/productCardPricing';
import { getPrimaryProductImageUrl } from '@/lib/utils/productImages';
import {
  normalizeOrderDeliveryAddress,
  formatOrderDeliveryCityLine,
  type OrderDeliveryAddress,
} from '@/lib/utils/orderDeliveryAddress';

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
  variationName?: string | null;
  variationId?: number | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  productId: number | null;
  imageUrl: string | null;
  photobookProjectId?: string | null;
  photobookImageCheckUrl?: string | null;
  buyAgainEnabled?: boolean;
  detailedFeedback?: DetailedFeedback | null;
  customizations?: any;
};

const PHOTOBOOK_IMAGE_CLEANUP_DAYS = 7;

function isPhotobookOrderItem(item: OrderItem): boolean {
  return Boolean(item.photobookProjectId);
}

function photobookImagesDeletedAfterDelivery(deliveredAt: string | null | undefined): boolean {
  if (!deliveredAt) return false;
  const deleteAfter = new Date(deliveredAt);
  deleteAfter.setDate(deleteAfter.getDate() + PHOTOBOOK_IMAGE_CLEANUP_DAYS);
  return Date.now() >= deleteAfter.getTime();
}

type OrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  currency: string;
  subtotal: number;
  discount: number;
  deliveryCharges: number;
  platformFee: number;
  total: number;
  deliveryAddress: OrderDeliveryAddress | Record<string, unknown> | null;
  createdAt: string;
  deliveryDate: string | null;
  packagePreparedAt?: string | null;
  outForDeliveryAt?: string | null;
  deliveredAt?: string | null;
  customer: {
    name: string;
    email: string;
  };
  items: OrderItem[];
  feedbackSubmitted?: boolean;
  feedbackRating?: string | null;
  vatPercent?: number | null;
  vatAmount?: number | null;
  cardLast4?: string | null;
  cardNetwork?: string | null;
  isNationwideDelivery?: boolean;
  shippedAt?: string | null;
  inTransitAt?: string | null;
  reachedDestinationHubAt?: string | null;
  shiprocketAwb?: string | null;
  shiprocketCourier?: string | null;
  shiprocketOrderId?: string | null;
  delhiveryWaybill?: string | null;
  delhiveryTrackingUrl?: string | null;
  delhiveryStatus?: string | null;
};

function isSubscriptionOrderItem(item: OrderItem): boolean {
  return (item.productName || '').trim().toLowerCase().startsWith('subscription for ');
}

// Tick SVG for completed steps
const TickIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={styles.timelineSvg} aria-hidden>
    <path fillRule="evenodd" clipRule="evenodd" d="M16.0303 8.96967C16.3232 9.26256 16.3232 9.73744 16.0303 10.0303L11.0303 15.0303C10.7374 15.3232 10.2626 15.3232 9.96967 15.0303L7.96967 13.0303C7.67678 12.7374 7.67678 12.2626 7.96967 11.9697C8.26256 11.6768 8.73744 11.6768 9.03033 11.9697L10.5 13.4393L12.7348 11.2045L14.9697 8.96967C15.2626 8.67678 15.7374 8.67678 16.0303 8.96967Z" fill="currentColor" />
  </svg>
);

// Icons for incomplete steps: order (clipboard), package (box), truck, delivery (home)
const OrderIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.timelineSvg} aria-hidden>
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);
const PackageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.timelineSvg} aria-hidden>
    <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);
const TruckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.timelineSvg} aria-hidden>
    <path d="M1 3h15v13H1z" />
    <path d="M16 8h4l3 3v5h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);
const DeliveryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.timelineSvg} aria-hidden>
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const HubIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.timelineSvg} aria-hidden>
    <path d="M15 21V15.6C15 15.0399 15 14.7599 14.891 14.546C14.7951 14.3578 14.6422 14.2049 14.454 14.109C14.2401 14 13.9601 14 13.4 14H10.6C10.0399 14 9.75992 14 9.54601 14.109C9.35785 14.2049 9.20487 14.3578 9.10899 14.546C9 14.7599 9 15.0399 9 15.6V21M19 21V6.2C19 5.0799 19 4.51984 18.782 4.09202C18.5903 3.71569 18.2843 3.40973 17.908 3.21799C17.4802 3 16.9201 3 15.8 3H8.2C7.07989 3 6.51984 3 6.09202 3.21799C5.71569 3.40973 5.40973 3.71569 5.21799 4.09202C5 4.51984 5 5.0799 5 6.2V21M21 21H3M9.5 8H9.51M14.5 8H14.51M10 8C10 8.27614 9.77614 8.5 9.5 8.5C9.22386 8.5 9 8.27614 9 8C9 7.72386 9.22386 7.5 9.5 7.5C9.77614 7.5 10 7.72386 10 8ZM15 8C15 8.27614 14.7761 8.5 14.5 8.5C14.2239 8.5 14 8.27614 14 8C14 7.72386 14.2239 7.5 14.5 7.5C14.7761 7.5 15 7.72386 15 8Z" />
  </svg>
);

function getTimelineSteps(order: OrderDetail) {
  const steps: { title: string; description: string; date: string; iconType: 'tick' | 'order' | 'package' | 'truck' | 'delivery' | 'hub'; completed: boolean }[] = [];

  steps.push({
    title: 'Order confirmed',
    description: 'Order placed and confirmed',
    date: order.createdAt ? formatTimelineStepIST(order.createdAt) : '',
    iconType: 'tick',
    completed: true
  });

  if (order.isNationwideDelivery || order.delhiveryWaybill || order.shiprocketAwb) {
    const status = order.status;
    const isDelivered = status === 'delivered';
    const isOut = isDelivered || status === 'out_for_delivery';
    const isHub = isOut || status === 'reached_destination_hub';
    const isInTransit = isHub || status === 'in_transit';
    const isShipped = isInTransit || status === 'shipped';
    const isPrepared = isShipped || status === 'package_prepared';

    steps.push({
      title: 'Package prepared',
      description: 'Packed and handed to delivery partner',
      date: order.packagePreparedAt ? formatTimelineStepIST(order.packagePreparedAt) : '',
      iconType: isPrepared ? 'tick' : 'package',
      completed: isPrepared
    });

    steps.push({
      title: 'Shipped',
      description: 'Dispatched from origin hub',
      date: order.shippedAt ? formatTimelineStepIST(order.shippedAt) : '',
      iconType: isShipped ? 'tick' : 'package',
      completed: isShipped
    });

    steps.push({
      title: 'In transit',
      description: 'On the way to destination',
      date: order.inTransitAt ? formatTimelineStepIST(order.inTransitAt) : '',
      iconType: isInTransit ? 'tick' : 'truck',
      completed: isInTransit
    });

    steps.push({
      title: 'Reached Destination Hub',
      description: 'Arrived at your local hub',
      date: order.reachedDestinationHubAt ? formatTimelineStepIST(order.reachedDestinationHubAt) : '',
      iconType: isHub ? 'tick' : 'hub',
      completed: isHub
    });

    steps.push({
      title: 'Out for delivery',
      description: 'Will be delivered today',
      date: order.outForDeliveryAt ? formatTimelineStepIST(order.outForDeliveryAt) : '',
      iconType: isOut ? 'tick' : 'truck',
      completed: isOut
    });

    steps.push({
      title: 'Delivered',
      description: 'Package delivered successfully',
      date: order.deliveredAt ? formatTimelineStepIST(order.deliveredAt) : '',
      iconType: isDelivered ? 'tick' : 'delivery',
      completed: isDelivered
    });

  } else {
    const status = order.status;
    const isDelivered = status === 'delivered';
    const isOut = isDelivered || status === 'out_for_delivery';
    // Fallback if status accidentally becomes one of the new ones, consider it prepared
    const isPrepared = isOut || status === 'package_prepared' || status === 'shipped' || status === 'in_transit' || status === 'reached_destination_hub';

    steps.push({
      title: 'Package prepared',
      description: 'Packed and handed to our team',
      date: order.packagePreparedAt ? formatTimelineStepIST(order.packagePreparedAt) : '',
      iconType: isPrepared ? 'tick' : 'package',
      completed: isPrepared
    });

    steps.push({
      title: 'Out for delivery',
      description: 'Will be delivered today',
      date: order.outForDeliveryAt ? formatTimelineStepIST(order.outForDeliveryAt) : '',
      iconType: isOut ? 'tick' : 'truck',
      completed: isOut
    });

    steps.push({
      title: 'Delivered',
      description: 'Package delivered successfully',
      date: order.deliveredAt ? formatTimelineStepIST(order.deliveredAt) : '',
      iconType: isDelivered ? 'tick' : 'delivery',
      completed: isDelivered
    });
  }

  return steps;
}

function TimelineIcon({ iconType }: { iconType: 'tick' | 'order' | 'package' | 'truck' | 'delivery' | 'hub' }) {
  switch (iconType) {
    case 'tick': return <TickIcon />;
    case 'order': return <OrderIcon />;
    case 'package': return <PackageIcon />;
    case 'truck': return <TruckIcon />;
    case 'delivery': return <DeliveryIcon />;
    case 'hub': return <HubIcon />;
    default: return <TickIcon />;
  }
}

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRating, setSelectedRating] = useState<string | null>(null);
  const [feedbackLocked, setFeedbackLocked] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [helpSupportNumber, setHelpSupportNumber] = useState<string>('');
  const [howWasItProductId, setHowWasItProductId] = useState<number | null>(null);
  const { showToast } = useToast();
  const { addItem } = useCart();
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [loadedProducts, setLoadedProducts] = useState<Record<string, Product>>({});
  const [photoboothSettings, setPhotoboothSettings] = useState<any>(null);

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
        const prod = loadedProducts[String(coverId)];
        return prod ? getPrimaryProductImageUrl(prod) : null;
      }
    }

    if (isPhotostrip) {
      const coverId = photoboothSettings.photostripsCoverProductId;
      if (coverId) {
        const prod = loadedProducts[String(coverId)];
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
        }
      })
      .catch((err) => console.error('Failed to load photobooth settings:', err));
  }, []);

  useEffect(() => {
    if (!order) return;
    const fetchAllProducts = async () => {
      const productMap: Record<string, Product> = {};
      const uniqueProductIds = Array.from(
        new Set(
          order.items
            .map((item) => item.productId)
            .filter((id): id is number => id !== null)
        )
      );

      if (photoboothSettings) {
        if (photoboothSettings.polaroidsCoverProductId) {
          uniqueProductIds.push(Number(photoboothSettings.polaroidsCoverProductId));
        }
        if (photoboothSettings.photostripsCoverProductId) {
          uniqueProductIds.push(Number(photoboothSettings.photostripsCoverProductId));
        }
      }

      const deduplicatedIds = Array.from(new Set(uniqueProductIds));

      await Promise.all(
        deduplicatedIds.map(async (id) => {
          try {
            const p = await productsApi.getById(String(id), true);
            productMap[String(id)] = p;
          } catch (err) {
            console.error(`Failed to fetch product ${id}:`, err);
          }
        })
      );
      setLoadedProducts(productMap);
    };

    fetchAllProducts();
  }, [order, photoboothSettings]);

  const handleDownloadInvoice = async () => {
    if (downloadingInvoice) return;
    setDownloadingInvoice(true);
    try {
      const res = await apiClient.get<{ isInvoiceCreated: boolean, invoiceUrl: string }>(`/api/orders/${orderId}/invoice`);
      if (res && res.invoiceUrl) {
        window.open(res.invoiceUrl, '_blank');
        showToast('Invoice generated successfully!', 'success');
      } else {
        showToast('Could not retrieve invoice URL.', 'error');
      }
    } catch (err: any) {
      console.error('Invoice download failed:', err);
      showToast(err.message || 'Failed to download invoice', 'error');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const fetchOrder = useCallback(async (silent = false) => {
    if (!orderId) return;
    if (!silent) setLoading(true);
    try {
      const data = await apiClient.get<OrderDetail>(`/api/orders/${orderId}`);
      setOrder(data);
    } catch (err: any) {
      console.error('Failed to fetch order:', err);
      setError(err.message || 'Failed to load order');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId) fetchOrder();
  }, [orderId, fetchOrder]);

  useEffect(() => {
    if (!orderId) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') fetchOrder(true);
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [orderId, fetchOrder]);

  useEffect(() => {
    if (order?.feedbackSubmitted && order.feedbackRating) {
      setSelectedRating(order.feedbackRating);
    }
  }, [order?.feedbackSubmitted, order?.feedbackRating]);

  useEffect(() => {
    if (loading || !order) return;
    const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
    if (!hash.startsWith('order-item-')) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(hash);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
    return () => window.clearTimeout(t);
  }, [order, loading]);

  useEffect(() => {
    contentApi.getByType('help_support').then((c) => {
      setHelpSupportNumber((c?.metadata as { helpSupportNumber?: string })?.helpSupportNumber || '');
    }).catch(() => setHelpSupportNumber(''));
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading order details...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error || 'Order not found'}</div>
        <Link href="/orders" className={styles.backLink}>← Back to orders</Link>
      </div>
    );
  }

  const deliveryAddress = normalizeOrderDeliveryAddress(order.deliveryAddress);
  const timelineSteps = getTimelineSteps(order);
  // Payment badge: Cancelled/Refunded from admin (order.status); Paid when money received; COD unpaid → Pending Payment
  const payMethod = (order.paymentMethod || '').toLowerCase();
  const paymentLabel =
    order.status === 'cancelled'
      ? 'Cancelled'
      : order.status === 'refunded'
        ? 'Refunded'
        : order.paymentStatus === 'paid'
          ? 'Paid'
          : payMethod === 'cod'
            ? 'Pending Payment'
            : 'Pending';
  const paymentVariant = order.status === 'cancelled' ? 'cancelled' : order.status === 'refunded' ? 'refunded' : order.paymentStatus === 'paid' ? 'paid' : 'pending';
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
  const hasBuyAgainItems = order.items.some(
    (it) => it.productId != null && !isSubscriptionOrderItem(it) && it.buyAgainEnabled !== false
  );

  const variationStr = (() => {
    const v = [...new Set(order.items.map((i) => i.variationSize).filter(Boolean))] as string[];
    return v.length ? ` • ${v.join(', ')}` : '';
  })();

  const openHelpSupport = () => {
    const raw = (helpSupportNumber || '').trim();
    if (!raw) {
      showToast('Help number not configured', 'error');
      return;
    }
    if (/^https?:\/\//i.test(raw)) {
      window.open(raw, '_blank');
      return;
    }
    const digits = raw.replace(/\D/g, '');
    window.open(`https://wa.me/${digits || '0'}`, '_blank');
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Left Sticky Desktop Back Button */}
        <div className={styles.desktopLeftSticky}>
          <Link href="/orders" className={styles.desktopBackButton}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Back to orders</span>
          </Link>
        </div>

        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.orderTitle}>Order #{order.orderNumber}</h1>
          <div className={`${styles.statusBadge} ${styles[`statusBadge${paymentVariant.charAt(0).toUpperCase()}${paymentVariant.slice(1)}`]}`}>
            {paymentVariant === 'paid' && (
              <svg className={styles.statusBadgeTick} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path fillRule="evenodd" clipRule="evenodd" d="M16.0303 8.96967C16.3232 9.26256 16.3232 9.73744 16.0303 10.0303L11.0303 15.0303C10.7374 15.3232 10.2626 15.3232 9.96967 15.0303L7.96967 13.0303C7.67678 12.7374 7.67678 12.2626 7.96967 11.9697C8.26256 11.6768 8.73744 11.6768 9.03033 11.9697L10.5 13.4393L12.7348 11.2045L14.9697 8.96967C15.2626 8.67678 15.7374 8.67678 16.0303 8.96967Z" fill="currentColor" />
              </svg>
            )}
            {paymentLabel}
          </div>
        </div>

        <div className={styles.orderDateRow}>
          <span className={styles.orderDate}>
            {formatDdMmYyIST(order.createdAt)}
          </span>
          <span className={styles.orderTotal}>
            {' • '}Qty: {totalQty}{variationStr} • ₹{order.total.toFixed(2)}
          </span>
        </div>

        {/* ORDER SUMMARY — simple delivered/ordered text */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>ORDER SUMMARY</h2>
          <p className={styles.orderSummaryText}>
            {(order.deliveredAt || order.deliveryDate) ? `Delivered on ${formatFullDateIST(order.deliveredAt || order.deliveryDate)}` : `Ordered on ${formatFullDateIST(order.createdAt)}`}
          </p>
        </section>

        {/* TIMELINE — above Customer; all steps shown; completed = tick + normal, not yet = little gray */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>TIMELINE</h2>
          <div className={styles.timeline}>
            {timelineSteps.map((step, idx) => {
              const isAboveCompleted = idx > 0 && timelineSteps[idx - 1].completed;
              const isTargetIncomplete = !step.completed && isAboveCompleted;

              return (
                <div
                  key={idx}
                  className={`${styles.timelineStep} ${!step.completed ? styles.timelineStepIncomplete : ''}`}
                >
                  <div className={`${styles.timelineIcon} ${step.completed ? styles.timelineIconCompleted : ''} ${isTargetIncomplete ? styles.timelineIconActiveIncomplete : ''}`}>
                    <TimelineIcon iconType={step.iconType} />
                  </div>
                  <div className={styles.timelineContent}>
                    <h3 className={styles.timelineTitle}>{step.title}</h3>
                    <p className={styles.timelineDescription}>{step.description}</p>
                    {step.date && <p className={styles.timelineDate}>{step.date}</p>}
                  </div>
                  {idx < timelineSteps.length - 1 && (
                    <div className={`${styles.timelineLine} ${step.completed ? styles.timelineLineCompleted : ''}`}></div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* TRACK ORDER SECTION (Courier Details & AWB) */}
        {order.isNationwideDelivery && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>TRACK ORDER</h2>

            {order.delhiveryWaybill || order.shiprocketAwb ? (
              <div className={styles.trackingCard}>
                <div className={styles.trackingHeader}>
                  <svg className={styles.trackingIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <div className={styles.trackingSummary}>
                    <p className={styles.trackingText}>
                      Your courier partner is <strong className={styles.courierNameHighlight}>{order.delhiveryWaybill ? 'Delhivery Express' : (order.shiprocketCourier || 'Shiprocket')}</strong> which will safely deliver the order.
                    </p>
                    <div className={styles.trackingMeta}>
                      <span className={styles.trackingLabel}>AWB Number / Tracking ID: </span>
                      <span className={styles.trackingValue}>{order.delhiveryWaybill || order.shiprocketAwb}</span>
                    </div>
                  </div>
                </div>
                <a
                  href={order.delhiveryWaybill ? (order.delhiveryTrackingUrl || `https://www.delhivery.com/track/package/${order.delhiveryWaybill}`) : `https://shiprocket.co/tracking/${order.shiprocketAwb}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.trackOrderLinkButton}
                >
                  {order.delhiveryWaybill ? 'Track on Delhivery' : 'Track on Shiprocket'}
                  <svg className={styles.linkArrowIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </a>
              </div>
            ) : (
              <div className={styles.trackingPlaceholder}>
                <svg className={styles.trackingPlaceholderIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <p className={styles.trackingPlaceholderText}>
                  AWB Number (or Tracking ID) will be generated once package preparation is confirmed.
                </p>
              </div>
            )}
          </section>
        )}

        {/* INVOICE SECTION (Nationwide Delivery Only) */}
        {order.isNationwideDelivery && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>INVOICE</h2>
            <div className={styles.invoiceCard} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p className={styles.invoiceDescription} style={{ color: '#475569', fontSize: '0.95rem', margin: 0 }}>
                Click the button below to download your invoice.
              </p>
              <div>
                <button
                  onClick={handleDownloadInvoice}
                  disabled={downloadingInvoice}
                  className={styles.downloadInvoiceButton}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {downloadingInvoice ? 'Generating Invoice...' : 'Download Invoice'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* DELIVERY ADDRESS */}
        {deliveryAddress ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>DELIVERY ADDRESS</h2>
            <div className={styles.deliveryAddressBlock}>
              {deliveryAddress.name ? (
                <p className={styles.deliveryAddressName}>{deliveryAddress.name}</p>
              ) : null}
              {deliveryAddress.street ? (
                <p className={styles.deliveryAddressLine}>{deliveryAddress.street}</p>
              ) : null}
              {formatOrderDeliveryCityLine(deliveryAddress) ? (
                <p className={styles.deliveryAddressLine}>{formatOrderDeliveryCityLine(deliveryAddress)}</p>
              ) : null}
              {deliveryAddress.country && deliveryAddress.country !== 'India' ? (
                <p className={styles.deliveryAddressLine}>{deliveryAddress.country}</p>
              ) : null}
              {deliveryAddress.phone ? (
                <p className={styles.deliveryAddressPhone}>Phone: {deliveryAddress.phone}</p>
              ) : null}
              {typeof deliveryAddress.latitude === 'number' &&
                typeof deliveryAddress.longitude === 'number' ? (
                <a
                  className={styles.deliveryAddressMapLink}
                  href={`https://www.google.com/maps?q=${deliveryAddress.latitude},${deliveryAddress.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open location on map
                </a>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* CUSTOMER */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>CUSTOMER</h2>
          <div className={styles.customerInfo}>
            <div className={styles.customerAvatar}>
              {order.customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className={styles.customerName}>{order.customer.name}</h3>
              <p className={styles.customerEmail}>{order.customer.email}</p>
            </div>
          </div>
        </section>

        {/* RECOMMENDATION SECTION - Only show if delivered. Locked after submit or if already submitted. */}
        {order.status === 'delivered' && (
          <section className={styles.section}>
            <h2 className={styles.recommendationTitle}>
              How likely are you to recommend House of Dahlia to friends and family?
            </h2>
            <div className={styles.ratingOptions}>
              <button
                className={`${styles.ratingOption} ${selectedRating === 'least' ? styles.ratingOptionSelected : ''}`}
                disabled={!!(order.feedbackSubmitted || feedbackLocked)}
                onClick={async () => {
                  if (order.feedbackSubmitted || feedbackLocked) return;
                  setSelectedRating('least');
                  try {
                    await apiClient.post(`/api/orders/${orderId}/feedback`, { rating: 'least' });
                    setFeedbackLocked(true);
                  } catch {
                    setSelectedRating(null);
                  }
                }}
              >
                <span className={styles.ratingEmoji}>😔</span>
                <span className={styles.ratingLabel}>Least likely</span>
              </button>
              <button
                className={`${styles.ratingOption} ${selectedRating === 'neutral' ? styles.ratingOptionSelected : ''}`}
                disabled={!!(order.feedbackSubmitted || feedbackLocked)}
                onClick={async () => {
                  if (order.feedbackSubmitted || feedbackLocked) return;
                  setSelectedRating('neutral');
                  try {
                    await apiClient.post(`/api/orders/${orderId}/feedback`, { rating: 'neutral' });
                    setFeedbackLocked(true);
                  } catch {
                    setSelectedRating(null);
                  }
                }}
              >
                <span className={styles.ratingEmoji}>😐</span>
                <span className={styles.ratingLabel}>Neutral</span>
              </button>
              <button
                className={`${styles.ratingOption} ${selectedRating === 'most' ? styles.ratingOptionSelected : ''}`}
                disabled={!!(order.feedbackSubmitted || feedbackLocked)}
                onClick={async () => {
                  if (order.feedbackSubmitted || feedbackLocked) return;
                  setSelectedRating('most');
                  try {
                    await apiClient.post(`/api/orders/${orderId}/feedback`, { rating: 'most' });
                    setFeedbackLocked(true);
                  } catch {
                    setSelectedRating(null);
                  }
                }}
              >
                <span className={styles.ratingEmoji}>😊</span>
                <span className={styles.ratingLabel}>Most Likely</span>
              </button>
            </div>
            {(order.feedbackSubmitted || feedbackLocked) && selectedRating && (
              <p className={styles.ratingThankYou}>Thank you for sharing your feedback!</p>
            )}
          </section>
        )}

        {/* ORDER DETAILS */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>ORDER DETAILS</h2>
          <div className={styles.detailsGrid}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Name</span>
              <span className={styles.detailValue}>{order.customer.name}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Order Number</span>
              <span className={styles.detailValue}>{order.orderNumber}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Order Date</span>
              <span className={styles.detailValue}>{formatDdMmYyIST(order.createdAt)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Product Total</span>
              <span className={styles.detailValue}>₹{order.subtotal.toFixed(2)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Discount</span>
              <span className={styles.detailValue}>{order.discount > 0 ? '-' : ''}{'\u20B9'}{order.discount.toFixed(2)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Delivery Fee</span>
              <span className={styles.detailValue}>₹{order.deliveryCharges.toFixed(2)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Platform fee</span>
              <span className={styles.detailValue}>₹{order.platformFee.toFixed(2)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Tax</span>
              <span className={styles.detailValue}>₹0</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Order Amount</span>
              <span className={styles.detailValue}>₹{order.total.toFixed(2)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Payment Mode</span>
              <span className={styles.detailValue}>
                {order.paymentMethod === 'online' && (order.cardLast4 || order.cardNetwork) ? (
                  <>ONLINE{order.cardLast4 ? ` •••• ${order.cardLast4}` : ''}{order.cardNetwork ? ` ${order.cardNetwork}` : ''}</>
                ) : order.paymentMethod === 'online' ? 'ONLINE' : 'COD'}
              </span>
            </div>
          </div>
        </section>

        {/* ORDER ITEMS WITH RATINGS */}
        <section className={styles.section}>
          <h2 className={styles.orderItemsTitle}>Order Items ({order.items.length})</h2>
          <div className={styles.orderItemsList}>
            {order.items.map((item, idx) => {
              const df = item.detailedFeedback;
              const hasReview = df != null && df.qualityStars >= 1;
              const photobookImagesDeleted = photobookImagesDeletedAfterDelivery(order.deliveredAt || order.deliveryDate);
              return (
                <div key={idx} id={`order-item-${idx}`} className={styles.productCard}>
                  <div
                    className={`${styles.productCardTop} ${item.productId ? styles.productCardTopClickable : ''}`}
                    role={item.productId ? 'button' : undefined}
                    tabIndex={item.productId ? 0 : undefined}
                    onClick={item.productId ? () => {
                      router.push(`/product/${item.productId}`);
                    } : undefined}
                    onKeyDown={item.productId ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget as HTMLDivElement).click(); } } : undefined}
                  >
                    <div className={styles.productImageWrapper}>
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.productName} className={styles.productCardImage} />
                      ) : getFallbackImageUrl(item) ? (
                        <img src={getFallbackImageUrl(item)!} alt={item.productName} className={styles.productCardImage} />
                      ) : (
                        <div className={styles.productImagePlaceholder}>📦</div>
                      )}
                    </div>
                    <div className={styles.productCardInfo}>
                      <h3 className={styles.productCardName}>{item.productName}</h3>
                      {(() => {
                        const p = item.productId ? loadedProducts[String(item.productId)] : null;
                        const descParts: string[] = [];

                        // 1. Customizable product combinations
                        if (p && p.isCustomizable && item.variationId) {
                          const combo = (p.customizationCombinations || []).find((c) => String(c.id) === String(item.variationId));
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
                        if (descParts.length === 0 && item.customizations?.selectedOptions && typeof item.customizations.selectedOptions === 'object') {
                          const selectedOpts = item.customizations.selectedOptions;
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
                        if (p && descParts.length === 0 && item.variationId) {
                          const v = (p.variations || []).find((x) => String(x.id) === String(item.variationId));
                          if (v?.size) {
                            const trimmed = String(v.size).trim();
                            const formatted = /^size\s*:/i.test(trimmed) || trimmed.includes(':') ? trimmed : `Size: ${trimmed}`;
                            descParts.push(formatted);
                          }
                        }

                        // 4. Fallback if variation size is stored directly in item or customizations
                        if (descParts.length === 0) {
                          const fallbackSize =
                            item.variationSize ||
                            item.variationName ||
                            (item as any).size ||
                            item.customizations?.size ||
                            (item.customizations?.variation as any)?.size ||
                            (item.customizations as any)?.variationName;
                          if (fallbackSize) {
                            const trimmed = String(fallbackSize).trim();
                            const formatted = /^size\s*:/i.test(trimmed) || trimmed.includes(':') ? trimmed : `Size: ${trimmed}`;
                            descParts.push(formatted);
                          }
                        }

                        // 5. Text personalizations
                        if (item.customizations?.textPersonalization) {
                          const tp = item.customizations.textPersonalization;
                          Object.keys(tp).forEach((key) => {
                            if (tp[key]) {
                              descParts.push(`Personalization: ${tp[key]}`);
                            }
                          });
                        }

                        if (descParts.length === 0) return null;

                        return (
                          <div className={styles.itemVariationList}>
                            {descParts.map((desc) => (
                              <span key={desc} className={styles.itemVariant}>{desc}</span>
                            ))}
                          </div>
                        );
                      })()}
                      {isSubscriptionOrderItem(item) && (
                        <p className={styles.subscriptionTransferNotePerItem}>
                          Plans are managed in My Account &gt;{' '}
                          <Link href="/subscriptions" className={styles.subscriptionTransferLink}>
                            Plans
                          </Link>
                        </p>
                      )}
                      <p className={styles.productCardPrice}>
                        {(() => {
                          if (item.productId) {
                            const p = loadedProducts[String(item.productId)];
                            if (p) {
                              const display = getCardPriceDisplay(p, '₹');
                              if (display.includes('-')) {
                                return display;
                              }
                            }
                          }
                          return `₹${item.lineTotal.toFixed(2)}`;
                        })()}
                      </p>
                      <p className={styles.productCardQuantity}>Qty: {item.quantity}</p>
                    </div>
                  </div>
                  {isPhotobookOrderItem(item) && (
                    <div className={styles.photobookPrivacyNotice} role="note">
                      <svg
                        className={styles.photobookPrivacyNoticeIcon}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="M9 12l2 2 4-4" />
                      </svg>
                      <div className={styles.photobookPrivacyNoticeBody}>
                        <p className={styles.photobookPrivacyNoticeText}>
                          {photobookImagesDeleted
                            ? 'Your images were protected, not shared, and have been successfully deleted.'
                            : `Your images are protected and not shared. They will be automatically deleted ${PHOTOBOOK_IMAGE_CLEANUP_DAYS} days after delivery.`}
                        </p>
                        {photobookImagesDeleted && (
                          <>
                            <p className={styles.photobookPrivacyCheckPrompt}>
                              Want to check if your images are deleted?{' '}
                              {item.photobookImageCheckUrl ? (
                                <a
                                  href={item.photobookImageCheckUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.photobookPrivacyCheckBtn}
                                >
                                  Click here
                                </a>
                              ) : (
                                <span className={styles.photobookPrivacyCheckUnavailable}>
                                  verification link unavailable for this order
                                </span>
                              )}
                            </p>
                            <p className={styles.photobookPrivacyCheckHelp}>
                              If the URL shows &quot;404 File not found&quot; or the link is not loading then your images are 100% deleted.
                              In case your images are still showing,{' '}
                              <button
                                type="button"
                                className={styles.photobookPrivacyContactBtn}
                                onClick={openHelpSupport}
                              >
                                kindly contact immediately
                              </button>
                              .
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {order.status === 'delivered' && !isSubscriptionOrderItem(item) && (
                    <div className={styles.orderRatingBlock}>
                      {hasReview && df ? (
                        <div className={styles.detailedFeedbackReadOnly}>
                          <div className={styles.detailedFeedbackRow}><span>Quality of the product</span><span className={styles.detailedFeedbackStars}>{[1, 2, 3, 4, 5].map(n => <span key={n} className={n <= df.qualityStars ? styles.starFilled : styles.starEmpty}>★</span>)}</span></div>
                          <div className={styles.detailedFeedbackRow}><span>On time delivery</span><span className={styles.detailedFeedbackStars}>{[1, 2, 3, 4, 5].map(n => <span key={n} className={n <= (df.onTimeStars ?? 0) ? styles.starFilled : styles.starEmpty}>★</span>)}</span></div>
                          <div className={styles.detailedFeedbackRow}><span>Value for money</span><span className={styles.detailedFeedbackStars}>{[1, 2, 3, 4, 5].map(n => <span key={n} className={n <= (df.valueForMoneyStars ?? 0) ? styles.starFilled : styles.starEmpty}>★</span>)}</span></div>
                          <div className={styles.detailedFeedbackRow}><span>Would you order again</span><span>{df.wouldOrderAgain || '—'}</span></div>
                        </div>
                      ) : item.productId != null ? (
                        <div
                          className={styles.orderRowRate}
                          role="button"
                          tabIndex={0}
                          onClick={() => setHowWasItProductId(item.productId!)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setHowWasItProductId(item.productId!); } }}
                        >
                          <span className={styles.orderRowRateIcon} aria-hidden>★</span>
                          <span>Rate this product</span>
                          <svg className={styles.orderRowRateArrow} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                            <path d="M14 5l7 7m0 0l-7 7m7-7H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className={styles.deliveredActions}>
            <button
              type="button"
              className={styles.deliveredActionBtn}
              onClick={openHelpSupport}
            >
              <svg className={styles.deliveredActionBtnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Need help
            </button>
            {hasBuyAgainItems && (
              <button
                type="button"
                className={styles.deliveredActionBtn}
                onClick={() => {
                  order.items.forEach((it) => {
                    if (it.productId != null && !isSubscriptionOrderItem(it) && it.buyAgainEnabled !== false) {
                      addItem({
                        productId: String(it.productId),
                        quantity: it.quantity,
                        variationId: it.variationId != null ? String(it.variationId) : undefined,
                        customizations: it.customizations || undefined,
                      });
                    }
                  });
                  if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                    window.dispatchEvent(new CustomEvent('open-desktop-cart'));
                  } else {
                    router.push('/cart');
                  }
                }}
              >
                <svg className={styles.deliveredActionBtnIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                Buy again
              </button>
            )}
          </div>
        </section>
      </div>


      <HowWasItModal
        isOpen={howWasItProductId !== null}
        onClose={() => setHowWasItProductId(null)}
        order={
          order
            ? {
              id: order.id,
              // Filter to a single product so modal can infer target productId.
              items: order.items
                .filter((i) => i.productId === howWasItProductId)
                .map((i) => ({ productId: i.productId })),
            }
            : null
        }
        onSubmitSuccess={() => fetchOrder(true)}
      />
    </div>
  );
}
