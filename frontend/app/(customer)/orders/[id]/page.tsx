'use client';

export const runtime = 'edge';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient, productsApi, contentApi, exchangesApi, walletApi, OrderExchange } from '@/lib/api';
import { SITE_NAME } from '@/lib/seo';
import { Product } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { useCart } from '@/contexts/CartContext';
import dynamicImport from 'next/dynamic';
import styles from './page.module.css';
import Link from 'next/link';

const HowWasItModal = dynamicImport(() => import('@/components/HowWasItModal'), {
  ssr: false,
});
import { formatDdMmYyIST, formatFullDateIST, formatTimelineStepIST } from '@/lib/utils/datetime';
import { getPrimaryProductImageUrl } from '@/lib/utils/productImages';
import { getCartItemPriceDetails } from '@/lib/utils/cartPricing';
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
  id?: number | string | null;
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
  isSelfCreated?: boolean;
  walletUsed?: number;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  exchange?: OrderExchange | null;
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

const CancelIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.timelineSvg} aria-hidden>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
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
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`${styles.timelineSvg} ${styles.timelineSvgTruck}`} aria-hidden>
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

function getTimelineSteps(order: OrderDetail, exchange?: OrderExchange | null) {
  if (order.status === 'cancelled') {
    return [
      {
        title: 'Order confirmed',
        description: 'Order placed and confirmed',
        date: order.createdAt ? formatTimelineStepIST(order.createdAt) : '',
        iconType: 'tick' as const,
        completed: true,
      },
      {
        title: 'Cancelled by customer',
        description: order.cancellationReason ? `Reason: ${order.cancellationReason}` : 'Order was cancelled by customer',
        date: order.cancelledAt ? formatTimelineStepIST(order.cancelledAt) : '',
        iconType: 'cancel' as const,
        completed: true,
        isCancelled: true,
      },
    ];
  }

  const steps: { title: string; description: string; date: string; iconType: 'tick' | 'order' | 'package' | 'truck' | 'delivery' | 'hub' | 'cancel'; completed: boolean; isCancelled?: boolean; isExchange?: boolean }[] = [];

  steps.push({
    title: 'Order confirmed',
    description: 'Order placed and confirmed',
    date: order.createdAt ? formatTimelineStepIST(order.createdAt) : '',
    iconType: 'tick',
    completed: true
  });

  if (order.isNationwideDelivery || order.isSelfCreated || order.delhiveryWaybill || order.shiprocketAwb) {
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

  // If exchange request exists, append Exchange timeline steps after Delivered
  if (exchange) {
    // 1. Exchange Requested step
    steps.push({
      title: 'Exchange Requested',
      description: exchange.reason ? `Reason: ${exchange.reason}` : 'Exchange request submitted',
      date: exchange.requestedAt ? formatTimelineStepIST(exchange.requestedAt) : '',
      iconType: 'tick',
      completed: true,
      isExchange: true,
    });

    // 2. Approved / Rejected step
    if (exchange.status === 'rejected') {
      steps.push({
        title: 'Exchange Rejected',
        description: exchange.rejectionReason ? `Reason: ${exchange.rejectionReason}` : 'Exchange request was rejected',
        date: exchange.rejectedAt ? formatTimelineStepIST(exchange.rejectedAt) : '',
        iconType: 'cancel',
        completed: true,
        isCancelled: true,
        isExchange: true,
      });
    } else if (exchange.status === 'approved' || exchange.status === 'completed') {
      // 2. Exchange Approved Step
      steps.push({
        title: 'Exchange Approved',
        description: exchange.approvalMessage || (exchange.requestedVariation ? `Approved for ${exchange.requestedVariation}` : 'Approved by our team'),
        date: exchange.approvedAt ? formatTimelineStepIST(exchange.approvedAt) : '',
        iconType: 'tick',
        completed: true,
        isExchange: true,
      });

      // 3. Payment / Settlement step (Comes FIRST before reverse pickup)
      const isSettled = exchange.status === 'completed' || exchange.paymentStatus === 'paid' || exchange.paymentStatus === 'refunded' || exchange.paymentStatus === 'not_required';

      if (isSettled) {
        let payDesc = 'Settlement completed';
        if (exchange.paymentMethod === 'wallet') {
          payDesc = `Paid ₹${exchange.priceDifference.toFixed(2)} via Wallet`;
        } else if (exchange.paymentMethod === 'online') {
          payDesc = `Paid ₹${exchange.priceDifference.toFixed(2)} online`;
        } else if (exchange.paymentMethod === 'wallet_refund') {
          payDesc = `₹${Math.abs(exchange.priceDifference).toFixed(2)} refunded to Wallet`;
        } else if (exchange.paymentMethod === 'free' || exchange.paymentStatus === 'not_required' || exchange.priceDifference === 0) {
          payDesc = 'No price difference - Completed';
        }
        steps.push({
          title: 'Payment & Settlement',
          description: payDesc,
          date: exchange.paidAt ? formatTimelineStepIST(exchange.paidAt) : (exchange.approvedAt ? formatTimelineStepIST(exchange.approvedAt) : ''),
          iconType: 'tick',
          completed: true,
          isExchange: true,
        });
      } else {
        const payDesc =
          exchange.priceDifference > 0
            ? `Awaiting payment of ₹${exchange.priceDifference.toFixed(2)}`
            : exchange.priceDifference < 0
              ? `₹${Math.abs(exchange.priceDifference).toFixed(2)} refund pending to Wallet`
              : 'Awaiting settlement confirmation';
        steps.push({
          title: 'Payment & Settlement',
          description: payDesc,
          date: '',
          iconType: 'order',
          completed: false,
          isExchange: true,
        });
      }

      // 4. Reverse Pickup Scheduled Step (Comes AFTER payment & settlement)
      if (exchange.reverseWaybill) {
        steps.push({
          title: 'Reverse Pickup Scheduled',
          description: `Delhivery reverse pickup manifested (AWB #${exchange.reverseWaybill}). Please keep the package ready as the courier executive can arrive anytime for pickup.`,
          date: exchange.reversePickupScheduledAt ? formatTimelineStepIST(exchange.reversePickupScheduledAt) : (exchange.paidAt ? formatTimelineStepIST(exchange.paidAt) : ''),
          iconType: 'tick',
          completed: true,
          isExchange: true,
        });
      } else {
        steps.push({
          title: 'Reverse Pickup Scheduled',
          description: isSettled
            ? 'Scheduling Delhivery reverse pickup with courier... Please keep the item ready as the courier person can come anytime.'
            : 'Delhivery reverse pickup will be scheduled after payment & settlement. Please keep the item ready as the courier person can come anytime.',
          date: '',
          iconType: 'truck',
          completed: false,
          isExchange: true,
        });
      }

      // 5. Return Arrival at Warehouse Origin
      if (exchange.returnReceivedAt) {
        steps.push({
          title: 'Return Received at Warehouse',
          description: 'Your return package has arrived at our origin warehouse.',
          date: formatTimelineStepIST(exchange.returnReceivedAt),
          iconType: 'tick',
          completed: true,
          isExchange: true,
        });
      } else {
        steps.push({
          title: 'Return Received at Warehouse',
          description: 'Package in transit back to our origin warehouse.',
          date: '',
          iconType: 'hub',
          completed: false,
          isExchange: true,
        });
      }

      // 6. Quality Verification Step
      if (exchange.returnVerifiedAt) {
        steps.push({
          title: 'Quality Verification',
          description: 'Quality check passed. Return item has been inspected and verified.',
          date: formatTimelineStepIST(exchange.returnVerifiedAt),
          iconType: 'tick',
          completed: true,
          isExchange: true,
        });
      } else {
        steps.push({
          title: 'Quality Verification',
          description: exchange.returnReceivedAt
            ? 'Return item is currently undergoing quality inspection and verification at warehouse.'
            : 'Quality check and verification will be conducted once return package reaches warehouse.',
          date: '',
          iconType: 'package',
          completed: false,
          isExchange: true,
        });
      }

      // 7. Forward Replacement Dispatched Step
      if (exchange.replacementWaybill) {
        steps.push({
          title: 'Replacement Dispatched',
          description: `Your replacement product has been dispatched from our warehouse (AWB #${exchange.replacementWaybill}).`,
          date: exchange.replacementDispatchedAt ? formatTimelineStepIST(exchange.replacementDispatchedAt) : '',
          iconType: 'tick',
          completed: true,
          isExchange: true,
        });
      } else {
        steps.push({
          title: 'Replacement Dispatched',
          description: exchange.returnVerifiedAt
            ? 'Quality check passed. Preparing your replacement shipment for dispatch from warehouse.'
            : 'Replacement will be dispatched after quality verification is completed.',
          date: '',
          iconType: 'delivery',
          completed: false,
          isExchange: true,
        });
      }

      // 8. Replacement Delivered Step (Automatic)
      const isReplacementDelivered = Boolean(exchange.replacementDeliveredAt || exchange.replacementStatus === 'Delivered');
      if (isReplacementDelivered) {
        steps.push({
          title: 'Delivered',
          description: 'Replacement item delivered successfully.',
          date: exchange.replacementDeliveredAt ? formatTimelineStepIST(exchange.replacementDeliveredAt) : '',
          iconType: 'tick',
          completed: true,
          isExchange: true,
        });
      } else {
        steps.push({
          title: 'Delivered',
          description: exchange.replacementWaybill
            ? 'Out for delivery / on the way to your delivery address.'
            : 'Will be delivered after replacement is dispatched.',
          date: '',
          iconType: 'delivery',
          completed: false,
          isExchange: true,
        });
      }
    } else {
      // Pending review
      steps.push({
        title: 'Under Review',
        description: 'Admin is reviewing your exchange request',
        date: '',
        iconType: 'order',
        completed: false,
        isExchange: true,
      });
    }
  }

  return steps;
}

function TimelineIcon({ iconType }: { iconType: 'tick' | 'order' | 'package' | 'truck' | 'delivery' | 'hub' | 'cancel' }) {
  switch (iconType) {
    case 'tick': return <TickIcon />;
    case 'cancel': return <CancelIcon />;
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
  const [cancelling, setCancelling] = useState(false);
  const [cancelStep, setCancelStep] = useState<null | 'reason' | 'confirm'>(null);
  const [selectedCancelReason, setSelectedCancelReason] = useState<string>('');
  const [customCancelReason, setCustomCancelReason] = useState<string>('');

  // Exchange states
  const [exchange, setExchange] = useState<OrderExchange | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);
  const [selectedExchangeItemIndices, setSelectedExchangeItemIndices] = useState<number[]>([0]);
  const [exchangeItemConfigs, setExchangeItemConfigs] = useState<
    Record<number, { selectedOptions: Record<string, string>; variationId: string; customText: string }>
  >({});
  const [exchangeReason, setExchangeReason] = useState<string>('Want different size / fit issue');
  const [exchangeCustomMessage, setExchangeCustomMessage] = useState<string>('');
  const [submittingExchange, setSubmittingExchange] = useState<boolean>(false);
  const [submittingExchangePayment, setSubmittingExchangePayment] = useState<boolean>(false);

  const EXCHANGE_REASONS = [
    'Want different size / fit issue',
    'Want different color / variant',
    'Item is defective / damaged',
    'Received wrong item',
    'Quality or design not as expected',
    'Other reason',
  ];

  const CANCELLATION_REASONS = [
    'Ordered by mistake / duplicate order',
    'Expected delivery date is too long',
    'Want to change size, color, or variant',
    'Need to change shipping address or phone number',
    'Found a better price / alternative elsewhere',
    'Product details or design not as expected',
    'Other reason',
  ];

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
    // Fetch user wallet balance for exchange payments
    walletApi.getSummary()
      .then((res) => {
        if (res && typeof res.balance === 'number') {
          setWalletBalance(res.balance);
        }
      })
      .catch(() => { });
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

  // Lock background page scroll when any modal is active
  useEffect(() => {
    if (isExchangeModalOpen || cancelStep || isProductModalOpen || howWasItProductId !== null) {
      const prevBody = document.body.style.overflow;
      const prevDoc = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevBody;
        document.documentElement.style.overflow = prevDoc;
      };
    }
  }, [isExchangeModalOpen, cancelStep, isProductModalOpen, howWasItProductId]);

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
      const data = await apiClient.get<OrderDetail & { exchange?: OrderExchange | null }>(`/api/orders/${orderId}`);
      setOrder(data);
      if (data.exchange) {
        setExchange(data.exchange);
      } else {
        exchangesApi.getForOrder(orderId).then((ex) => {
          if (ex) setExchange(ex);
        }).catch(() => { });
      }
    } catch (err: any) {
      console.error('Failed to fetch order:', err);
      setError(err.message || 'Failed to load order');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [orderId]);

  const canCancelOrder =
    Boolean(order) &&
    ['placed', 'confirmed', 'pending'].includes((order?.status || '').toLowerCase()) &&
    !order?.packagePreparedAt &&
    !['package_prepared', 'shipped', 'in_transit', 'reached_destination_hub', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'].includes((order?.status || '').toLowerCase());

  const handleCancelOrder = async () => {
    if (!order || cancelling) return;
    setCancelling(true);
    try {
      const res = await apiClient.post<{ success: boolean; message?: string; data?: any }>(
        `/api/orders/${order.id}/cancel`,
        {
          reason: selectedCancelReason,
          details: customCancelReason,
        }
      );
      showToast(res.message || 'Order cancelled successfully', 'success');
      setCancelStep(null);
      await fetchOrder(true);
    } catch (err: any) {
      showToast(err?.message || 'Failed to cancel order', 'error');
    } finally {
      setCancelling(false);
    }
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

  const computeItemReplacementPrice = (
    item: OrderItem,
    prod: Product | null,
    config?: { selectedOptions: Record<string, string>; variationId: string; customText: string }
  ) => {
    const curUnitPrice =
      item.unitPrice ||
      (item.lineTotal && item.quantity ? item.lineTotal / item.quantity : 0);
    if (!prod) return curUnitPrice;
    const selectedOpts = config?.selectedOptions || {};
    const varId = config?.variationId || '';

    const basePrice =
      prod.sellingPrice !== null && prod.sellingPrice !== undefined && Number.isFinite(Number(prod.sellingPrice))
        ? Number(prod.sellingPrice)
        : Number(prod.pricePerLitre || (prod as any).price || 0);

    if (prod.customizationCombinations && prod.customizationCombinations.length > 0) {
      const combo = prod.customizationCombinations.find((c: any) => {
        return Object.keys(selectedOpts).every(
          (gid) => String(c.combinationKeys?.[gid]) === String(selectedOpts[gid])
        );
      });
      if (combo && combo.price != null && Number.isFinite(Number(combo.price))) {
        return Number(combo.price);
      }
    }

    if (prod.customizationOptions && prod.customizationOptions.length > 0) {
      let sum = basePrice;
      Object.keys(selectedOpts).forEach((groupId) => {
        const valId = selectedOpts[groupId];
        const group = (prod.customizationOptions || []).find((g: any) => String(g.id) === String(groupId));
        const val = group ? (group.values || []).find((v: any) => String(v.id) === String(valId)) : null;
        if (val && typeof val.price === 'number' && Number.isFinite(val.price)) {
          sum += val.price;
        }
      });
      return sum;
    }

    if (prod.variations && varId) {
      const v = prod.variations.find((x: any) => String(x.id) === String(varId));
      if (v && v.price != null && Number.isFinite(Number(v.price))) {
        return Number(v.price);
      }
    }

    return curUnitPrice;
  };

  const getItemOriginalVariationText = (item: OrderItem, currentProduct: Product | null) => {
    let originalVarText = '';
    if (currentProduct && currentProduct.isCustomizable && item.variationId) {
      const combo = (currentProduct.customizationCombinations || []).find((c) => String(c.id) === String(item.variationId));
      if (combo && combo.combinationKeys) {
        const parts: string[] = [];
        Object.keys(combo.combinationKeys).forEach((groupId) => {
          const valId = combo.combinationKeys[groupId];
          const group = (currentProduct.customizationOptions || []).find((g) => String(g.id) === String(groupId));
          const val = group ? (group.values || []).find((v) => String(v.id) === String(valId)) : null;
          if (group && val) parts.push(`${group.title}: ${val.name}`);
        });
        originalVarText = parts.join(', ');
      }
    }
    if (!originalVarText && item.customizations?.selectedOptions && typeof item.customizations.selectedOptions === 'object') {
      const parts: string[] = [];
      const selectedOpts = item.customizations.selectedOptions;
      Object.keys(selectedOpts).forEach((groupId) => {
        const valId = selectedOpts[groupId];
        const group = (currentProduct?.customizationOptions || []).find((g) => String(g.id) === String(groupId));
        const val = group ? (group.values || []).find((v) => String(v.id) === String(valId)) : null;
        if (group && val) parts.push(`${group.title}: ${val.name}`);
        else if (typeof valId === 'string' || typeof valId === 'number') parts.push(String(valId));
      });
      originalVarText = parts.join(', ');
    }
    if (!originalVarText && currentProduct && item.variationId) {
      const v = (currentProduct.variations || []).find((x) => String(x.id) === String(item.variationId));
      if (v?.size) originalVarText = v.size;
    }
    if (!originalVarText) {
      originalVarText =
        item.variationSize ||
        item.variationName ||
        (item as any).size ||
        item.customizations?.size ||
        (item.customizations?.variation as any)?.size ||
        (item.customizations as any)?.variationName ||
        '';
    }
    return originalVarText.trim();
  };

  const getItemReplacementVariationText = (
    item: OrderItem,
    p: Product | null,
    config?: { selectedOptions: Record<string, string>; variationId: string; customText: string }
  ) => {
    if (!config) return '';
    if (config.customText && config.customText.trim()) return config.customText.trim();
    if (p?.customizationOptions && p.customizationOptions.length > 0) {
      const parts: string[] = [];
      p.customizationOptions.forEach((g) => {
        if (g.type === 'uploads') return;
        const valId = config.selectedOptions[g.id];
        const val = (g.values || []).find((v) => String(v.id) === String(valId));
        if (val) parts.push(`${g.title}: ${val.name}`);
      });
      if (parts.length > 0) return parts.join(', ');
    }
    if (p?.variations && p.variations.length > 0 && config.variationId) {
      const v = p.variations.find((x) => String(x.id) === String(config.variationId));
      if (v) {
        const vSize = v.size || (v as any).name || '';
        return /^size\s*:/i.test(vSize) || vSize.includes(':') ? vSize : (vSize ? `Size: ${vSize}` : '');
      }
    }
    return '';
  };

  const openExchangeModal = (initialIdx: number = 0) => {
    if (!order) return;
    setExchangeReason(EXCHANGE_REASONS[0]);
    setExchangeCustomMessage('');

    // Pre-select the clicked item (or first item)
    setSelectedExchangeItemIndices([initialIdx >= 0 && initialIdx < order.items.length ? initialIdx : 0]);

    // Build initial config for all items in order
    const configs: Record<
      number,
      { selectedOptions: Record<string, string>; variationId: string; customText: string }
    > = {};

    order.items.forEach((item, idx) => {
      const pid = item.productId ? String(item.productId) : null;
      const p = pid ? loadedProducts[pid] : null;

      if (pid && !loadedProducts[pid]) {
        productsApi.getById(pid, true).then((prod) => {
          if (prod) {
            setLoadedProducts((prev) => ({ ...prev, [pid]: prod }));
          }
        }).catch(() => {});
      }

      const initialOpts: Record<string, string> = {};
      if (p?.customizationOptions) {
        p.customizationOptions.forEach((g) => {
          if (g.type === 'uploads') return;
          const curValId = item.customizations?.selectedOptions?.[g.id];
          if (curValId && (g.values || []).some((v) => String(v.id) === String(curValId))) {
            initialOpts[g.id] = String(curValId);
          } else {
            const matched = (g.values || []).find((v) =>
              item.variationSize && String(item.variationSize).toLowerCase().includes(v.name.toLowerCase())
            );
            if (matched) {
              initialOpts[g.id] = String(matched.id);
            } else if (g.values && g.values.length > 0) {
              initialOpts[g.id] = String(g.values[0].id);
            }
          }
        });
      }

      let varId = '';
      if (item.variationId) {
        varId = String(item.variationId);
      } else if (p?.variations && p.variations.length > 0) {
        varId = String(p.variations[0].id);
      }

      let initialText = '';
      if (p?.customizationOptions && p.customizationOptions.length > 0) {
        const parts: string[] = [];
        p.customizationOptions.forEach((g) => {
          if (g.type === 'uploads') return;
          const valId = initialOpts[g.id];
          const val = (g.values || []).find((v) => String(v.id) === String(valId));
          if (val) parts.push(`${g.title}: ${val.name}`);
        });
        initialText = parts.join(', ');
      } else if (item.variationSize) {
        initialText = item.variationSize;
      }

      configs[idx] = {
        selectedOptions: initialOpts,
        variationId: varId,
        customText: initialText,
      };
    });

    setExchangeItemConfigs(configs);
    setIsExchangeModalOpen(true);
  };

  const toggleExchangeItemSelection = (idx: number) => {
    setSelectedExchangeItemIndices((prev) => {
      if (prev.includes(idx)) {
        if (prev.length === 1) {
          showToast('At least one item must be selected for exchange', 'error');
          return prev;
        }
        return prev.filter((i) => i !== idx);
      } else {
        return [...prev, idx];
      }
    });
  };

  const selectAllExchangeItems = () => {
    if (!order) return;
    setSelectedExchangeItemIndices(order.items.map((_, idx) => idx));
  };

  const updateExchangeItemOption = (itemIdx: number, groupId: string, valId: string) => {
    setExchangeItemConfigs((prev) => {
      const cur = prev[itemIdx] || { selectedOptions: {}, variationId: '', customText: '' };
      const nextOpts = { ...cur.selectedOptions, [groupId]: valId };

      const item = order?.items[itemIdx];
      const p = item?.productId ? loadedProducts[String(item.productId)] : null;
      let nextText = '';
      if (p?.customizationOptions && p.customizationOptions.length > 0) {
        const parts: string[] = [];
        p.customizationOptions.forEach((g) => {
          if (g.type === 'uploads') return;
          const vId = nextOpts[g.id];
          const val = (g.values || []).find((v) => String(v.id) === String(vId));
          if (val) parts.push(`${g.title}: ${val.name}`);
        });
        nextText = parts.join(', ');
      }

      return {
        ...prev,
        [itemIdx]: {
          ...cur,
          selectedOptions: nextOpts,
          customText: nextText || cur.customText,
        },
      };
    });
  };

  const updateExchangeItemVariation = (itemIdx: number, varId: string) => {
    setExchangeItemConfigs((prev) => {
      const cur = prev[itemIdx] || { selectedOptions: {}, variationId: '', customText: '' };
      const item = order?.items[itemIdx];
      const p = item?.productId ? loadedProducts[String(item.productId)] : null;
      let nextText = '';
      if (p?.variations && p.variations.length > 0) {
        const v = p.variations.find((x) => String(x.id) === String(varId));
        if (v) {
          const vSize = v.size || (v as any).name || '';
          nextText = /^size\s*:/i.test(vSize) || vSize.includes(':') ? vSize : (vSize ? `Size: ${vSize}` : '');
        }
      }

      return {
        ...prev,
        [itemIdx]: {
          ...cur,
          variationId: varId,
          customText: nextText || cur.customText,
        },
      };
    });
  };

  const updateExchangeItemCustomText = (itemIdx: number, text: string) => {
    setExchangeItemConfigs((prev) => {
      const cur = prev[itemIdx] || { selectedOptions: {}, variationId: '', customText: '' };
      return {
        ...prev,
        [itemIdx]: {
          ...cur,
          customText: text,
        },
      };
    });
  };

  const handleSubmitExchangeRequest = async () => {
    if (!order) return;
    if (selectedExchangeItemIndices.length === 0) {
      showToast('Please select at least one item to exchange', 'error');
      return;
    }
    if (!exchangeReason || !exchangeReason.trim()) {
      showToast('Please select a reason for exchange', 'error');
      return;
    }

    try {
      setSubmittingExchange(true);

      const itemsToSubmit = selectedExchangeItemIndices.map((idx) => {
        const item = order.items[idx];
        const pid = item.productId ? String(item.productId) : null;
        const p = pid ? loadedProducts[pid] : null;
        const config = exchangeItemConfigs[idx];

        const unitPrice =
          item.unitPrice ||
          (item.lineTotal && item.quantity ? item.lineTotal / item.quantity : 0);

        const reqUnitPrice = computeItemReplacementPrice(item, p, config);
        const origVarText = getItemOriginalVariationText(item, p);
        const reqVarText = getItemReplacementVariationText(item, p, config);
        const qty = item.quantity || 1;
        const lineDiff = Math.round((reqUnitPrice - unitPrice) * qty * 100) / 100;

        return {
          itemId: item.id ? String(item.id) : undefined,
          productId: item.productId || undefined,
          productName: item.productName,
          originalVariation: origVarText || undefined,
          originalUnitPrice: unitPrice,
          quantity: qty,
          requestedItemName: item.productName,
          requestedVariation: reqVarText || undefined,
          requestedUnitPrice: reqUnitPrice,
          priceDifference: lineDiff,
          reason: exchangeReason.trim(),
        };
      });

      const created = await exchangesApi.request({
        orderId: order.id,
        items: itemsToSubmit,
        reason: exchangeReason.trim(),
        customerMessage: exchangeCustomMessage.trim() || undefined,
      });

      setExchange(created);
      setIsExchangeModalOpen(false);
      showToast('Exchange request submitted successfully!', 'success');
      fetchOrder(true);
    } catch (err: any) {
      console.error('Exchange submit error:', err);
      showToast(err.message || 'Failed to submit exchange request', 'error');
    } finally {
      setSubmittingExchange(false);
    }
  };

  const handleSettleOrPayExchange = async (method: 'wallet' | 'online' | 'free') => {
    if (!exchange) return;
    try {
      setSubmittingExchangePayment(true);

      if (method === 'free' || exchange.priceDifference === 0 || exchange.priceDifference < 0) {
        const res = await exchangesApi.settleOrPay({
          exchangeId: exchange.id,
          paymentMethod: exchange.priceDifference < 0 ? 'wallet' : 'free',
        });
        setExchange(res.exchange);
        if (res.walletBalance !== undefined) setWalletBalance(res.walletBalance);
        showToast(res.message || 'Exchange completed successfully', 'success');
        fetchOrder(true);
        return;
      }

      if (method === 'wallet') {
        if (walletBalance < exchange.priceDifference) {
          showToast(`Insufficient wallet balance (₹${walletBalance.toFixed(2)}). Needed: ₹${exchange.priceDifference.toFixed(2)}`, 'error');
          return;
        }
        const res = await exchangesApi.settleOrPay({
          exchangeId: exchange.id,
          paymentMethod: 'wallet',
        });
        setExchange(res.exchange);
        if (res.walletBalance !== undefined) setWalletBalance(res.walletBalance);
        showToast(res.message || `₹${exchange.priceDifference.toFixed(2)} paid from wallet`, 'success');
        fetchOrder(true);
        return;
      }

      if (method === 'online') {
        const paymentOrder = await exchangesApi.createPaymentOrder(exchange.id);

        if (!('razorpayOrderId' in paymentOrder) || !paymentOrder.razorpayOrderId) {
          throw new Error('Online payment gateway is not configured (Razorpay keys missing). Please use wallet payment or configure Razorpay keys.');
        }

        await loadRazorpayScript();
        const Razorpay = (window as unknown as { Razorpay: new (o: unknown) => { open: () => void } }).Razorpay;
        if (!Razorpay) {
          throw new Error('Failed to load Razorpay payment SDK. Please check your internet connection.');
        }

        const rzp = new Razorpay({
          key: paymentOrder.key,
          order_id: paymentOrder.razorpayOrderId,
          currency: paymentOrder.currency || 'INR',
          name: SITE_NAME,
          description: `Exchange #${order?.orderNumber} difference payment`,
          handler: async function (resp: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) {
            try {
              const res = await exchangesApi.settleOrPay({
                exchangeId: exchange.id,
                paymentMethod: 'online',
                razorpayPaymentId: resp.razorpay_payment_id,
                razorpayOrderId: resp.razorpay_order_id,
                razorpaySignature: resp.razorpay_signature,
              });
              setExchange(res.exchange);
              showToast('Payment successful! Exchange completed.', 'success');
              fetchOrder(true);
            } catch (e: any) {
              showToast(e.message || 'Payment verification failed', 'error');
            }
          },
          theme: {
            color: '#00835d',
          },
        });
        rzp.open();
      }
    } catch (err: any) {
      console.error('Exchange settlement error:', err);
      showToast(err.message || 'Failed to process exchange settlement', 'error');
    } finally {
      setSubmittingExchangePayment(false);
    }
  };

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
  const timelineSteps = getTimelineSteps(order, exchange);

  // 7-day post-delivery exchange window check
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const deliveredDate = order.deliveredAt || order.deliveryDate;
  const isDelivered = order.status === 'delivered' || Boolean(order.deliveredAt);
  const isWithin7Days = deliveredDate
    ? (Date.now() - new Date(deliveredDate).getTime()) <= SEVEN_DAYS_MS
    : true;
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
            {order.status === 'cancelled'
              ? (order.cancelledAt ? `Cancelled on ${formatFullDateIST(order.cancelledAt)}` : 'This order has been cancelled')
              : (order.deliveredAt || order.deliveryDate)
                ? `Delivered on ${formatFullDateIST(order.deliveredAt || order.deliveryDate)}`
                : `Ordered on ${formatFullDateIST(order.createdAt)}`}
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
                  className={`${styles.timelineStep} ${!step.completed ? styles.timelineStepIncomplete : ''} ${step.isExchange ? styles.timelineStepExchange : ''}`}
                >
                  <div
                    className={`${styles.timelineIcon} ${step.completed
                        ? (step.isCancelled
                          ? styles.timelineIconCancelled
                          : (step.isExchange ? styles.timelineIconExchangeCompleted : styles.timelineIconCompleted))
                        : ''
                      } ${isTargetIncomplete
                        ? (step.isExchange ? styles.timelineIconExchangeActiveIncomplete : styles.timelineIconActiveIncomplete)
                        : ''
                      }`}
                  >
                    <TimelineIcon iconType={step.iconType} />
                  </div>
                  <div className={styles.timelineContent}>
                    <h3 className={`${styles.timelineTitle} ${step.isCancelled ? styles.timelineTitleCancelled : ''} ${step.isExchange ? styles.timelineTitleExchange : ''}`}>{step.title}</h3>
                    <p className={styles.timelineDescription}>{step.description}</p>
                    {step.date && <p className={styles.timelineDate}>{step.date}</p>}
                  </div>
                  {idx < timelineSteps.length - 1 && (
                    <div
                      className={`${styles.timelineLine} ${step.completed
                          ? (step.isCancelled
                            ? styles.timelineLineCancelled
                            : (step.isExchange ? styles.timelineLineExchangeCompleted : styles.timelineLineCompleted))
                          : ''
                        }`}
                    ></div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* EXCHANGE PAYMENT / SETTLEMENT CONTAINER (When Approved & Payment Pending) */}
        {exchange && exchange.status === 'approved' && exchange.paymentStatus !== 'paid' && exchange.paymentStatus !== 'refunded' && exchange.paymentStatus !== 'not_required' && !exchange.paidAt && (
          <section className={styles.section}>
            <div className={styles.exchangePaymentContainer}>
              <div className={styles.exchangePaymentHeader}>
                <h2 className={styles.exchangePaymentTitle}>Exchange Settlement & Payment</h2>
                <span className={`${styles.exchangeStatusBadge} ${styles.exchangeStatusBadgeApproved}`}>
                  Approved
                </span>
              </div>

              <div className={styles.exchangePaymentItemsOverview}>
                {exchange.exchangeItems && exchange.exchangeItems.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    <div style={{ fontWeight: 700, color: '#1e293b' }}>
                      Exchange Items ({exchange.exchangeItems.length}):
                    </div>
                    {exchange.exchangeItems.map((it, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.4rem 0',
                          borderBottom: idx < exchange.exchangeItems!.length - 1 ? '1px dashed #cbd5e1' : 'none',
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
                          {it.productName} (Qty: {it.quantity})
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '0.15rem' }}>
                          <span style={{ color: '#b45309' }}>Old: {it.originalVariation || 'Standard'} (₹{(it.originalUnitPrice * it.quantity).toFixed(2)})</span>
                          {' ➔ '}
                          <span style={{ color: '#059669', fontWeight: 600 }}>New: {it.requestedVariation || 'Standard'} (₹{(it.requestedUnitPrice * it.quantity).toFixed(2)})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div><strong>Original Item:</strong> {exchange.productName} {exchange.originalVariation ? `(${exchange.originalVariation})` : ''} - ₹{exchange.originalUnitPrice.toFixed(2)}</div>
                    <div><strong>Replacement:</strong> {exchange.requestedItemName || exchange.productName} {exchange.requestedVariation ? `(${exchange.requestedVariation})` : ''}</div>
                  </>
                )}
                <div style={{ marginTop: '0.35rem', paddingTop: '0.4rem', borderTop: '1px dashed #cbd5e1' }}>
                  <strong>Total Price Adjustment: </strong>
                  <span className={styles.exchangeDiffHighlight}>
                    {exchange.priceDifference > 0
                      ? `+₹${exchange.priceDifference.toFixed(2)} (Payable)`
                      : exchange.priceDifference < 0
                        ? `-₹${Math.abs(exchange.priceDifference).toFixed(2)} (Wallet Refund)`
                        : 'Same price (₹0 difference)'}
                  </span>
                </div>
              </div>

              {exchange.approvalMessage && (
                <div className={styles.exchangeApprovalAlert} style={{ marginBottom: '1rem' }}>
                  <strong>Message from House of Dahlia Team:</strong> {exchange.approvalMessage}
                </div>
              )}

              {/* Case 1: Same Price (0 Difference) */}
              {(exchange.priceDifference === 0 || Math.abs(exchange.priceDifference) < 0.01) && (
                <div>
                  <p style={{ margin: '0 0 0.85rem', color: '#475569', fontSize: '0.9rem' }}>
                    There is no price difference for this replacement. Click below to complete your exchange.
                  </p>
                  <button
                    type="button"
                    className={styles.exchangePaymentPrimaryBtn}
                    onClick={() => handleSettleOrPayExchange('free')}
                    disabled={submittingExchangePayment}
                  >
                    {submittingExchangePayment ? 'Settling...' : 'Confirm & Complete Exchange'}
                  </button>
                </div>
              )}

              {/* Case 2: Negative Difference (Refund to Wallet) */}
              {exchange.priceDifference < 0 && (
                <div>
                  <p style={{ margin: '0 0 0.85rem', color: '#475569', fontSize: '0.9rem' }}>
                    The replacement item costs less. You are eligible for a refund of <strong>₹{Math.abs(exchange.priceDifference).toFixed(2)}</strong> which will be credited directly to your Wallet.
                  </p>
                  <button
                    type="button"
                    className={styles.exchangePaymentPrimaryBtn}
                    onClick={() => handleSettleOrPayExchange('wallet')}
                    disabled={submittingExchangePayment}
                  >
                    {submittingExchangePayment ? 'Crediting Wallet...' : `Receive ₹${Math.abs(exchange.priceDifference).toFixed(2)} in Wallet & Complete`}
                  </button>
                </div>
              )}

              {/* Case 3: Positive Difference (Customer must pay) */}
              {exchange.priceDifference > 0 && (
                <div className={styles.exchangePaymentOptions}>
                  <p style={{ margin: '0 0 0.5rem', color: '#475569', fontSize: '0.9rem' }}>
                    Please choose how you would like to pay the price difference of <strong>₹{exchange.priceDifference.toFixed(2)}</strong>:
                  </p>

                  {/* Option 1: Wallet */}
                  <button
                    type="button"
                    className={styles.exchangePaymentMethodBtn}
                    onClick={() => handleSettleOrPayExchange('wallet')}
                    disabled={submittingExchangePayment || walletBalance < exchange.priceDifference}
                  >
                    <span>
                      👛 Pay with Wallet{' '}
                      <small style={{ color: walletBalance >= exchange.priceDifference ? '#00835d' : '#dc2626' }}>
                        (Balance: ₹{walletBalance.toFixed(2)})
                      </small>
                    </span>
                    <span style={{ fontWeight: 700, color: '#00835d' }}>
                      {walletBalance >= exchange.priceDifference ? `Pay ₹${exchange.priceDifference.toFixed(2)}` : 'Insufficient Balance'}
                    </span>
                  </button>

                  {/* Option 2: Online */}
                  <button
                    type="button"
                    className={styles.exchangePaymentMethodBtn}
                    onClick={() => handleSettleOrPayExchange('online')}
                    disabled={submittingExchangePayment}
                  >
                    <span>💳 Pay Online (UPI / Card / Netbanking)</span>
                    <span style={{ fontWeight: 700, color: '#00835d' }}>Pay ₹{exchange.priceDifference.toFixed(2)}</span>
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* TRACK ORDER SECTION (Courier Details & AWB) */}
        {(order.isNationwideDelivery || order.isSelfCreated || order.delhiveryWaybill || order.shiprocketAwb) && (
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
                          let unitPrice =
                            item.unitPrice != null && Number.isFinite(Number(item.unitPrice)) && Number(item.unitPrice) > 0
                              ? Number(item.unitPrice)
                              : item.lineTotal != null && Number.isFinite(Number(item.lineTotal)) && item.quantity
                                ? Number(item.lineTotal) / Number(item.quantity)
                                : Number(item.lineTotal || 0);

                          const p = item.productId ? loadedProducts[String(item.productId)] : null;
                          if (p && item.productId) {
                            const details = getCartItemPriceDetails(
                              {
                                productId: String(item.productId),
                                variationId: item.variationId ? String(item.variationId) : undefined,
                                quantity: item.quantity,
                                customizations: item.customizations || undefined,
                              },
                              p
                            );
                            if (details.unitPrice > 0 && (unitPrice === 0 || Math.abs(details.unitPrice - unitPrice) > 0.01)) {
                              unitPrice = details.unitPrice;
                            }
                          }
                          return `₹${unitPrice.toFixed(2)}`;
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
          {canCancelOrder && (
            <div className={styles.cancelOrderWrapper}>
              <button
                type="button"
                className={styles.cancelOrderBtn}
                onClick={() => {
                  setSelectedCancelReason('');
                  setCustomCancelReason('');
                  setCancelStep('reason');
                }}
                disabled={cancelling}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                Cancel your order
              </button>
            </div>
          )}
          {/* Exchange Section */}
          {isDelivered && (
            <div className={styles.exchangeWrapper}>
              {!exchange ? (
                isWithin7Days ? (
                  <button
                    type="button"
                    className={styles.exchangeRequestBtn}
                    onClick={() => openExchangeModal(0)}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" />
                    </svg>
                    Request an Exchange
                  </button>
                ) : (
                  <div className={styles.exchangeNoticeExpired}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>Exchange window has expired (available within 7 days of delivery only).</span>
                  </div>
                )
              ) : (
                <div className={styles.exchangeStatusCard}>
                  <div className={styles.exchangeStatusHeader}>
                    <span className={styles.exchangeStatusTitle}>Exchange Request</span>
                    <span className={`${styles.exchangeStatusBadge} ${styles[`exchangeStatusBadge${exchange.status.charAt(0).toUpperCase()}${exchange.status.slice(1)}`]}`}>
                      {exchange.status}
                    </span>
                  </div>
                  <div className={styles.exchangeStatusBody}>
                    {exchange.exchangeItems && exchange.exchangeItems.length > 0 ? (
                      <div className={styles.exchangeItemsListSummary}>
                        <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: '#1e293b' }}>
                          Exchanged Items ({exchange.exchangeItems.length}):
                        </div>
                        {exchange.exchangeItems.map((exIt, i) => (
                          <div key={i} className={styles.exchangeItemSummaryRow}>
                            <div className={styles.exchangeItemSummaryName}>
                              <strong>{exIt.productName}</strong> (Qty: {exIt.quantity})
                            </div>
                            <div className={styles.exchangeItemSummaryVars}>
                              <span className={styles.exchangeItemOldVar}>Old: {exIt.originalVariation || 'Standard'}</span>
                              <span className={styles.exchangeItemArrow}>➔</span>
                              <span className={styles.exchangeItemNewVar}>New: {exIt.requestedVariation || 'Standard'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <div><strong>Item:</strong> {exchange.productName} {exchange.originalVariation ? `(${exchange.originalVariation})` : ''}</div>
                        {exchange.requestedVariation && (
                          <div><strong>Replacement:</strong> {exchange.requestedVariation}</div>
                        )}
                      </>
                    )}
                    <div><strong>Reason:</strong> {exchange.reason}</div>
                    {exchange.status === 'rejected' && exchange.rejectionReason && (
                      <div className={styles.exchangeRejectionAlert}>
                        <strong>Rejection Reason:</strong> {exchange.rejectionReason}
                      </div>
                    )}
                    {exchange.status === 'approved' && exchange.approvalMessage && (
                      <div className={styles.exchangeApprovalAlert}>
                        <strong>Message from House of Dahlia Team:</strong> {exchange.approvalMessage}
                      </div>
                    )}
                    {exchange.reverseWaybill && (
                      <div className={styles.exchangeReversePickupCard}>
                        <div className={styles.reversePickupHeader}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" />
                          </svg>
                          <strong>Delhivery Reverse Pickup Scheduled</strong>
                        </div>
                        <div className={styles.reversePickupSub}>
                          Our logistics partner Delhivery will pick up the return item from your address and safely transport it back to our warehouse. Please keep the package packed and ready as the courier person can come anytime.
                        </div>
                        <div className={styles.reversePickupMetaRow}>
                          <span className={styles.reversePickupAwb}>Pickup AWB: #{exchange.reverseWaybill}</span>
                          <a
                            href={exchange.reverseTrackingUrl || `https://www.delhivery.com/track/package/${exchange.reverseWaybill}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.reversePickupTrackLink}
                          >
                            Track Reverse Pickup on Delhivery ↗
                          </a>
                        </div>
                      </div>
                    )}

                    {exchange.returnReceivedAt && !exchange.returnVerifiedAt && (
                      <div className={styles.exchangeWarehouseReceivedCard}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <div>
                          <strong>Return Package Received at Warehouse:</strong> Your returned item has arrived at our origin facility and is undergoing quality verification.
                        </div>
                      </div>
                    )}

                    {exchange.returnVerifiedAt && (
                      <div className={styles.exchangeWarehouseReceivedCard}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <div>
                          <strong>Quality Check Passed:</strong> Your returned item has been verified and approved.
                        </div>
                      </div>
                    )}

                    {exchange.replacementWaybill && (
                      <div className={styles.exchangeReplacementCard}>
                        <div className={styles.replacementHeader}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <rect x="1" y="3" width="15" height="13" />
                            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                            <circle cx="5.5" cy="18.5" r="2.5" />
                            <circle cx="18.5" cy="18.5" r="2.5" />
                          </svg>
                          <strong>{(exchange.replacementDeliveredAt || exchange.replacementStatus === 'Delivered') ? 'Replacement Order Delivered' : 'Replacement Order Dispatched'}</strong>
                        </div>
                        <div className={styles.replacementSub}>
                          {(exchange.replacementDeliveredAt || exchange.replacementStatus === 'Delivered')
                            ? `Your replacement product (${exchange.requestedVariation || exchange.productName}) has been successfully delivered.`
                            : `Great news! Your replacement product (${exchange.requestedVariation || exchange.productName}) has been dispatched from our warehouse to your address via Delhivery.`}
                        </div>
                        <div className={styles.replacementMetaRow}>
                          <span className={styles.replacementAwb}>Delhivery AWB: #{exchange.replacementWaybill}</span>
                          <a
                            href={exchange.replacementTrackingUrl || `https://www.delhivery.com/track/package/${exchange.replacementWaybill}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.replacementTrackLink}
                          >
                            Track Replacement on Delhivery ↗
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

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
                  const activeExchange = exchange || (order as any).exchange;
                  const isExchanged = activeExchange && !['rejected', 'cancelled'].includes(activeExchange.status);

                  order.items.forEach((it, itIdx) => {
                    if (it.productId == null || isSubscriptionOrderItem(it) || it.buyAgainEnabled === false) {
                      return;
                    }

                    const p = loadedProducts[String(it.productId)];

                    // Check if this item was exchanged
                    let matchedExItem: any = null;
                    if (isExchanged) {
                      if (Array.isArray(activeExchange.exchangeItems) && activeExchange.exchangeItems.length > 0) {
                        matchedExItem = activeExchange.exchangeItems.find(
                          (ex: any) =>
                            (ex.itemId != null && it.id != null && String(ex.itemId) === String(it.id)) ||
                            (ex.productId != null && Number(ex.productId) === Number(it.productId))
                        );
                        if (!matchedExItem && activeExchange.exchangeItems[itIdx]) {
                          matchedExItem = activeExchange.exchangeItems[itIdx];
                        }
                      } else if (
                        (activeExchange.itemId != null && it.id != null && String(activeExchange.itemId) === String(it.id)) ||
                        (activeExchange.productId != null && Number(activeExchange.productId) === Number(it.productId))
                      ) {
                        matchedExItem = activeExchange;
                      }
                    }

                    const finalCustomizations: Record<string, any> = { ...((it as any).customizations || {}) };
                    let resolvedVariationId: string | undefined = undefined;

                    const rawTargetStr = String(matchedExItem?.requestedVariation || matchedExItem?.requested_variation || '').trim();

                    if (rawTargetStr) {
                      // 1. Remove wrapping annotations like (Replacement), (Confirmed)
                      let cleanStr = rawTargetStr.replace(/\s*\((?:replacement|confirmed)\)/ig, '').trim();

                      // 2. If it contains product name prefix (e.g. "Product No. X215555: Size: XXL..."), strip it
                      if (p && cleanStr.toLowerCase().startsWith(p.name.toLowerCase())) {
                        cleanStr = cleanStr.slice(p.name.length).replace(/^[:\s\-]+/, '').trim();
                      }

                      // 3. Split key-value pairs (e.g. "Size: XXL, Color: Black, XYZZ: 4242" or "Size: XXL | Color: Black")
                      const rawParts = cleanStr.split(/[,|;]+/).map((s) => s.trim()).filter(Boolean);
                      const parsedMap: Record<string, string> = {};
                      let standaloneSizeVal = '';

                      rawParts.forEach((part) => {
                        const colonIdx = part.indexOf(':');
                        if (colonIdx !== -1) {
                          const k = part.slice(0, colonIdx).trim().toLowerCase();
                          const v = part.slice(colonIdx + 1).trim();
                          parsedMap[k] = v;
                          if (k === 'size' || k.includes('size')) {
                            standaloneSizeVal = v;
                          }
                        } else {
                          const lower = part.toLowerCase();
                          if (lower.startsWith('size ')) {
                            const val = part.slice(5).trim();
                            parsedMap['size'] = val;
                            standaloneSizeVal = val;
                          } else {
                            if (!standaloneSizeVal) {
                              standaloneSizeVal = part;
                            }
                          }
                        }
                      });

                      if (!standaloneSizeVal && parsedMap['size']) {
                        standaloneSizeVal = parsedMap['size'];
                      }

                      if (standaloneSizeVal) {
                        const cleanSize = standaloneSizeVal.replace(/^size\s*:\s*/i, '').trim();
                        if (cleanSize) {
                          finalCustomizations.size = cleanSize;
                          finalCustomizations.variationSize = cleanSize;
                          finalCustomizations.variationName = cleanSize;
                          finalCustomizations.variation = cleanSize;
                        }
                      }

                      if (p) {
                        // 4. Update customizationOptions / selectedOptions
                        if (Array.isArray(p.customizationOptions) && p.customizationOptions.length > 0) {
                          finalCustomizations.selectedOptions = { ...(finalCustomizations.selectedOptions || {}) };
                          p.customizationOptions.forEach((g) => {
                            const gTitle = String(g.title || '').trim().toLowerCase();
                            const targetVal = parsedMap[gTitle] || (gTitle.includes('size') ? standaloneSizeVal : '');
                            if (targetVal) {
                              const normTarget = targetVal.toLowerCase().replace(/^size\s*:\s*/i, '').trim();
                              const matchedVal = (g.values || []).find((v) => {
                                const vName = String(v.name || '').trim().toLowerCase();
                                return vName === normTarget;
                              });
                              if (matchedVal) {
                                finalCustomizations.selectedOptions[String(g.id)] = String(matchedVal.id);
                              }
                            }
                          });
                        }

                        // 5. Update standard variations if present
                        if (Array.isArray(p.variations) && p.variations.length > 0) {
                          const targetSize = standaloneSizeVal.toLowerCase().replace(/^size\s*:\s*/i, '').trim();
                          if (targetSize) {
                            const matchedVar = p.variations.find((v) => {
                              if (!v?.size) return false;
                              const vSize = String(v.size).replace(/^size\s*:\s*/i, '').trim().toLowerCase();
                              return vSize === targetSize;
                            });
                            if (matchedVar) {
                              resolvedVariationId = String(matchedVar.id);
                            }
                          }
                        }

                        // 6. Match customizationCombinations if present
                        if (!resolvedVariationId && Array.isArray(p.customizationCombinations) && p.customizationCombinations.length > 0) {
                          const targetKeys = finalCustomizations.selectedOptions || {};
                          const matchedCombo = p.customizationCombinations.find((c) => {
                            if (!c.combinationKeys) return false;
                            const cKeys = c.combinationKeys;
                            const gIds = Object.keys(cKeys);
                            if (gIds.length === 0) return false;
                            return gIds.every((gId) => targetKeys[gId] === cKeys[gId]);
                          });
                          if (matchedCombo) {
                            resolvedVariationId = String(matchedCombo.id);
                          }
                        }
                      }
                    } else {
                      // NOT exchanged - maintain exact customizations and valid variationId
                      if (p && it.variationId != null) {
                        const varExists = (p.variations || []).some((v) => String(v.id) === String(it.variationId));
                        const comboExists = (p.customizationCombinations || []).some((c) => String(c.id) === String(it.variationId));
                        if (varExists || comboExists) {
                          resolvedVariationId = String(it.variationId);
                        }
                      } else if (!p && it.variationId != null) {
                        resolvedVariationId = String(it.variationId);
                      }
                    }

                    addItem({
                      productId: String(it.productId),
                      quantity: it.quantity,
                      variationId: resolvedVariationId,
                      customizations: Object.keys(finalCustomizations).length > 0 ? finalCustomizations : undefined,
                    });
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

      {/* EXCHANGE REQUEST MODAL */}
      {isExchangeModalOpen && order && (
        <div
          className={styles.exchangeModalBackdrop}
          onClick={() => !submittingExchange && setIsExchangeModalOpen(false)}
        >
          <div className={styles.exchangeModalCard} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.exchangeModalCloseBtn}
              onClick={() => !submittingExchange && setIsExchangeModalOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            <div className={styles.exchangeModalHeader}>
              <h2 className={styles.exchangeModalTitle}>Request an Exchange</h2>
              <p className={styles.exchangeModalSubtitle}>
                Select the product(s) you would like to exchange and choose your desired replacement size or variation.
              </p>
            </div>

            <div
              className={styles.exchangeModalBody}
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              {/* 1. Multi-Item Select Bar (if multiple items in order) */}
              {order.items.length > 1 && (
                <div className={styles.exchangeMultiSelectBar}>
                  <div className={styles.exchangeMultiSelectCount}>
                    <span>Items to Exchange:</span>
                    <span className={styles.exchangeCountBadge}>
                      {selectedExchangeItemIndices.length} of {order.items.length} selected
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.exchangeSelectAllBtn}
                    onClick={() => {
                      if (selectedExchangeItemIndices.length === order.items.length) {
                        setSelectedExchangeItemIndices([0]);
                      } else {
                        selectAllExchangeItems();
                      }
                    }}
                  >
                    {selectedExchangeItemIndices.length === order.items.length
                      ? 'Deselect Others'
                      : 'Select All Items'}
                  </button>
                </div>
              )}

              {/* 2. Items List */}
              <div className={styles.exchangeItemsListWrap}>
                {order.items.map((item, idx) => {
                  const isSelected = selectedExchangeItemIndices.includes(idx);
                  const pid = item.productId ? String(item.productId) : null;
                  const p = pid ? loadedProducts[pid] : null;
                  const config = exchangeItemConfigs[idx] || {
                    selectedOptions: {},
                    variationId: '',
                    customText: '',
                  };

                  const custGroups = (p?.customizationOptions || []).filter(
                    (g) => g.type !== 'uploads' && g.values && g.values.length > 0
                  );
                  const hasCustGroups = custGroups.length > 0;
                  const stdVariations = (p?.variations || []).filter(
                    (v) => (v as any).is_available !== false && (v as any).isAvailable !== false
                  );
                  const hasStdVariations = stdVariations.length > 0;

                  const unitPrice =
                    item.unitPrice ||
                    (item.lineTotal && item.quantity ? item.lineTotal / item.quantity : 0);
                  const reqUnitPrice = computeItemReplacementPrice(item, p, config);
                  const qty = item.quantity || 1;
                  const itemLineDiff = Math.round((reqUnitPrice - unitPrice) * qty * 100) / 100;

                  const origVarText = getItemOriginalVariationText(item, p);
                  const reqVarText = getItemReplacementVariationText(item, p, config);

                  return (
                    <div
                      key={idx}
                      className={`${styles.exchangeItemCard} ${
                        isSelected ? styles.exchangeItemCardSelected : styles.exchangeItemCardUnselected
                      }`}
                    >
                      {/* Card Top / Header */}
                      <div
                        className={styles.exchangeItemCardHeader}
                        onClick={() => {
                          if (order.items.length > 1) {
                            toggleExchangeItemSelection(idx);
                          }
                        }}
                        role={order.items.length > 1 ? 'button' : undefined}
                        tabIndex={order.items.length > 1 ? 0 : undefined}
                      >
                        {order.items.length > 1 ? (
                          <div className={styles.exchangeCheckboxWrap}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleExchangeItemSelection(idx)}
                              className={styles.exchangeCheckbox}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        ) : (
                          <div className={styles.exchangeSingleBadge}>✓</div>
                        )}

                        <div className={styles.exchangeItemThumbWrap}>
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.productName}
                              className={styles.exchangeItemThumb}
                            />
                          ) : getFallbackImageUrl(item) ? (
                            <img
                              src={getFallbackImageUrl(item)!}
                              alt={item.productName}
                              className={styles.exchangeItemThumb}
                            />
                          ) : (
                            <div className={styles.exchangeItemThumbPlaceholder}>📦</div>
                          )}
                        </div>

                        <div className={styles.exchangeItemMetaWrap}>
                          <div className={styles.exchangeItemNameRow}>
                            <span className={styles.exchangeItemName}>{item.productName}</span>
                            <span className={styles.exchangeItemQty}>Qty: {qty}</span>
                          </div>
                          <div className={styles.exchangeItemSubRow}>
                            {origVarText ? (
                              <span className={styles.exchangeItemPurchasedVar}>
                                Original: {origVarText}
                              </span>
                            ) : null}
                            <span className={styles.exchangeItemOriginalPrice}>
                              ₹{(unitPrice * qty).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Body: Interactive Replacement Options */}
                      {isSelected && (
                        <div className={styles.exchangeItemCardBody}>
                          <div className={styles.exchangeOptionsSectionTitle}>
                            Choose Replacement Variation / Size:
                          </div>

                          {hasCustGroups ? (
                            <div className={styles.exchangeVariationGroups}>
                              {custGroups.map((group) => {
                                const curValId = item.customizations?.selectedOptions?.[group.id];
                                const selectedValId = config.selectedOptions[group.id];

                                return (
                                  <div key={group.id} className={styles.exchangeGroupBlock}>
                                    <div className={styles.exchangeGroupHeader}>
                                      <span className={styles.exchangeGroupTitle}>{group.title}</span>
                                      {selectedValId && (
                                        <span className={styles.exchangeGroupSelectedName}>
                                          {group.values.find((v) => String(v.id) === String(selectedValId))?.name}
                                        </span>
                                      )}
                                    </div>
                                    <div className={styles.exchangePillsList}>
                                      {group.values
                                        .filter((v) => v.isActive !== false)
                                        .map((val) => {
                                          const isPillSelected = String(selectedValId) === String(val.id);
                                          const isCurrent =
                                            String(curValId) === String(val.id) ||
                                            (item.variationSize &&
                                              String(item.variationSize)
                                                .toLowerCase()
                                                .includes(val.name.toLowerCase()));

                                          return (
                                            <button
                                              key={val.id}
                                              type="button"
                                              className={`${styles.exchangePillBtn} ${
                                                isPillSelected ? styles.exchangePillBtnActive : ''
                                              } ${isCurrent ? styles.exchangePillBtnCurrent : ''}`}
                                              onClick={() =>
                                                updateExchangeItemOption(idx, group.id, String(val.id))
                                              }
                                            >
                                              <span>{val.name}</span>
                                              {isCurrent && (
                                                <span className={styles.exchangePillCurrentBadge}>
                                                  Current
                                                </span>
                                              )}
                                            </button>
                                          );
                                        })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : hasStdVariations ? (
                            <div className={styles.exchangeVariationGroups}>
                              <div className={styles.exchangeGroupBlock}>
                                <div className={styles.exchangeGroupHeader}>
                                  <span className={styles.exchangeGroupTitle}>Available Options</span>
                                </div>
                                <div className={styles.exchangePillsList}>
                                  {stdVariations.map((v) => {
                                    const isPillSelected = String(config.variationId) === String(v.id);
                                    const isCurrent = String(item.variationId) === String(v.id);

                                    return (
                                      <button
                                        key={v.id}
                                        type="button"
                                        className={`${styles.exchangePillBtn} ${
                                          isPillSelected ? styles.exchangePillBtnActive : ''
                                        } ${isCurrent ? styles.exchangePillBtnCurrent : ''}`}
                                        onClick={() =>
                                          updateExchangeItemVariation(idx, String(v.id))
                                        }
                                      >
                                        <span>{v.size || (v as any).name || 'Default'}</span>
                                        {isCurrent && (
                                          <span className={styles.exchangePillCurrentBadge}>
                                            Current
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <input
                              type="text"
                              placeholder="e.g. Size L instead of XL, or Color Black"
                              value={config.customText || ''}
                              onChange={(e) => updateExchangeItemCustomText(idx, e.target.value)}
                              className={styles.exchangeInput}
                            />
                          )}

                          {/* Requested Replacement Live Preview */}
                          {reqVarText && (
                            <div className={styles.exchangeSelectionPreview}>
                              <span className={styles.exchangePreviewLabel}>Requested:</span>
                              <span className={styles.exchangePreviewValue}>{reqVarText}</span>
                            </div>
                          )}

                          {/* Item Line Price Box */}
                          <div className={styles.exchangePricePreviewBox}>
                            <div className={styles.exchangePricePreviewRow}>
                              <span>Original Price:</span>
                              <strong>₹{(unitPrice * qty).toFixed(2)}</strong>
                            </div>
                            <div className={styles.exchangePricePreviewRow}>
                              <span>Replacement Price:</span>
                              <strong>₹{(reqUnitPrice * qty).toFixed(2)}</strong>
                            </div>
                            <div
                              className={`${styles.exchangePriceDiffRow} ${
                                itemLineDiff > 0
                                  ? styles.exchangePriceDiffPay
                                  : itemLineDiff < 0
                                  ? styles.exchangePriceDiffRefund
                                  : styles.exchangePriceDiffNeutral
                              }`}
                            >
                              <span>Price Difference:</span>
                              <strong>
                                {itemLineDiff > 0
                                  ? `+₹${itemLineDiff.toFixed(2)} (Customer to pay)`
                                  : itemLineDiff < 0
                                  ? `-₹${Math.abs(itemLineDiff).toFixed(2)} (Refund to wallet)`
                                  : '₹0.00 (Same price)'}
                              </strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Overall Total Summary Box */}
              {(() => {
                let totalOrig = 0;
                let totalReq = 0;
                let totalDiff = 0;

                selectedExchangeItemIndices.forEach((idx) => {
                  const item = order.items[idx];
                  if (!item) return;
                  const pid = item.productId ? String(item.productId) : null;
                  const p = pid ? loadedProducts[pid] : null;
                  const config = exchangeItemConfigs[idx];

                  const unitPrice =
                    item.unitPrice ||
                    (item.lineTotal && item.quantity ? item.lineTotal / item.quantity : 0);
                  const reqUnitPrice = computeItemReplacementPrice(item, p, config);
                  const qty = item.quantity || 1;

                  totalOrig += unitPrice * qty;
                  totalReq += reqUnitPrice * qty;
                  totalDiff += (reqUnitPrice - unitPrice) * qty;
                });

                totalDiff = Math.round(totalDiff * 100) / 100;

                return (
                  <div className={styles.exchangeTotalSummaryBox}>
                    <div className={styles.exchangeTotalSummaryHeader}>
                      <span>
                        Exchange Total ({selectedExchangeItemIndices.length} item
                        {selectedExchangeItemIndices.length > 1 ? 's' : ''} selected)
                      </span>
                    </div>
                    <div className={styles.exchangePricePreviewRow}>
                      <span>Total Original Value:</span>
                      <strong>₹{totalOrig.toFixed(2)}</strong>
                    </div>
                    <div className={styles.exchangePricePreviewRow}>
                      <span>Total Replacement Value:</span>
                      <strong>₹{totalReq.toFixed(2)}</strong>
                    </div>
                    <div
                      className={`${styles.exchangePriceDiffRow} ${
                        totalDiff > 0
                          ? styles.exchangePriceDiffPay
                          : totalDiff < 0
                          ? styles.exchangePriceDiffRefund
                          : styles.exchangePriceDiffNeutral
                      }`}
                      style={{ fontSize: '0.94rem', paddingTop: '0.5rem', marginTop: '0.2rem' }}
                    >
                      <span>Net Price Difference:</span>
                      <strong>
                        {totalDiff > 0
                          ? `+₹${totalDiff.toFixed(2)} (Customer to pay)`
                          : totalDiff < 0
                          ? `-₹${Math.abs(totalDiff).toFixed(2)} (Refund to wallet)`
                          : '₹0.00 (Same price)'}
                      </strong>
                    </div>
                  </div>
                );
              })()}

              {/* 3. Reason Dropdown */}
              <div className={styles.exchangeFieldGroup}>
                <label className={styles.exchangeFieldLabel}>Reason for Exchange</label>
                <select
                  value={exchangeReason}
                  onChange={(e) => setExchangeReason(e.target.value)}
                  className={styles.exchangeSelect}
                >
                  {EXCHANGE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Message Input */}
              <div className={styles.exchangeFieldGroup}>
                <label className={styles.exchangeFieldLabel}>Additional Message / Notes (Optional)</label>
                <textarea
                  placeholder="Tell us more about the fit issue or details for our team..."
                  value={exchangeCustomMessage}
                  onChange={(e) => setExchangeCustomMessage(e.target.value)}
                  className={styles.exchangeTextarea}
                />
              </div>

              {/* 5. Policy Link */}
              <div className={styles.exchangePolicyBox}>
                <span>By requesting, you agree to our </span>
                <Link href="/refunds" target="_blank" className={styles.exchangePolicyLink}>
                  Returns & Exchanges Policy
                </Link>
                <span> (7-day post-delivery exchange window).</span>
              </div>
            </div>

            <div className={styles.exchangeModalActions}>
              <button
                type="button"
                className={styles.exchangeCancelBtn}
                onClick={() => setIsExchangeModalOpen(false)}
                disabled={submittingExchange}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.exchangeSubmitBtn}
                onClick={handleSubmitExchangeRequest}
                disabled={submittingExchange || selectedExchangeItemIndices.length === 0}
              >
                {submittingExchange
                  ? 'Submitting...'
                  : selectedExchangeItemIndices.length > 1
                  ? `Request Exchange (${selectedExchangeItemIndices.length} Items)`
                  : 'Request Exchange'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Cancellation Reason / Feedback Modal */}
      {cancelStep === 'reason' && order && (
        <div
          className={styles.cancelModalBackdrop}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !cancelling) setCancelStep(null);
          }}
        >
          <div className={styles.cancelReasonCard} role="dialog" aria-modal="true" aria-labelledby="cancel-reason-title">
            <div className={styles.cancelReasonHeader}>
              <h3 id="cancel-reason-title" className={styles.cancelModalTitle}>Reason for cancellation</h3>
              <p className={styles.cancelReasonSubtitle}>
                Please let us know why you are cancelling this order. Your feedback helps us improve.
              </p>
            </div>

            <div className={styles.cancelReasonBody}>
              <div className={styles.cancelReasonList} role="radiogroup" aria-label="Cancellation reasons">
                {CANCELLATION_REASONS.map((r) => {
                  const isSelected = selectedCancelReason === r;
                  return (
                    <div
                      key={r}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={0}
                      className={`${styles.cancelReasonOption} ${isSelected ? styles.cancelReasonOptionActive : ''}`}
                      onClick={() => setSelectedCancelReason(r)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          setSelectedCancelReason(r);
                        }
                      }}
                    >
                      <div className={styles.cancelReasonRadio}>
                        {isSelected && <div className={styles.cancelReasonRadioInner} />}
                      </div>
                      <span className={styles.cancelReasonLabel}>{r}</span>
                    </div>
                  );
                })}
              </div>

              {selectedCancelReason && (
                <textarea
                  className={styles.cancelReasonTextarea}
                  placeholder={
                    selectedCancelReason === 'Other reason'
                      ? 'Please describe why you would like to cancel (required)...'
                      : 'Additional comments or feedback (optional)...'
                  }
                  value={customCancelReason}
                  onChange={(e) => setCustomCancelReason(e.target.value)}
                  rows={3}
                />
              )}
            </div>

            <div className={styles.cancelModalActions}>
              <button
                type="button"
                className={styles.cancelModalCancelBtn}
                onClick={() => setCancelStep(null)}
                disabled={cancelling}
              >
                Don&apos;t cancel
              </button>
              <button
                type="button"
                className={styles.cancelModalNextBtn}
                onClick={() => setCancelStep('confirm')}
                disabled={
                  !selectedCancelReason ||
                  (selectedCancelReason === 'Other reason' && !customCancelReason.trim()) ||
                  cancelling
                }
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Confirmation Modal */}
      {cancelStep === 'confirm' && order && (
        <div
          className={styles.cancelModalBackdrop}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !cancelling) setCancelStep(null);
          }}
        >
          <div className={styles.cancelModalCard} role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
            <div className={styles.cancelModalIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 id="cancel-modal-title" className={styles.cancelModalTitle}>Cancel Order #{order.orderNumber}?</h3>
            <p className={styles.cancelModalMessage}>
              {order.paymentStatus === 'paid' || (order.paymentMethod || '').toLowerCase() === 'online' || (order.paymentMethod || '').toLowerCase() === 'wallet' ? (
                <>
                  Are you sure you want to cancel? The full amount of{' '}
                  <span className={styles.cancelModalHighlight}>₹{order.total.toFixed(2)}</span> (including platform fee and delivery charges) will be immediately refunded to your{' '}
                  <span className={styles.cancelModalHighlight}>House of Dahlia Wallet</span>.
                </>
              ) : (Number(order.walletUsed || 0) > 0) ? (
                <>
                  Are you sure you want to cancel? The{' '}
                  <span className={styles.cancelModalHighlight}>₹{Number(order.walletUsed).toFixed(2)}</span> paid from your wallet will be refunded to your{' '}
                  <span className={styles.cancelModalHighlight}>House of Dahlia Wallet</span>. The remaining COD amount will not be charged.
                </>
              ) : (
                <>
                  Are you sure you want to cancel this Cash on Delivery order? Since no payment was deducted, no refund will be issued.
                </>
              )}
            </p>
            <div className={styles.cancelModalActions}>
              <button
                type="button"
                className={styles.cancelModalCancelBtn}
                onClick={() => setCancelStep('reason')}
                disabled={cancelling}
              >
                Back
              </button>
              <button
                type="button"
                className={styles.cancelModalConfirmBtn}
                onClick={handleCancelOrder}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling...' : 'Yes, cancel order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
