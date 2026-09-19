'use client';

import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { adminContentApi, adminSubscriptionsApi, apiClient } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import { DeliverySchedule, type Address } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import DeliveryRoutePlanner from '@/components/admin/DeliveryRoutePlanner';
import AdminOrderMapLocationModal from '@/components/admin/AdminOrderMapLocationModal';
import adminStyles from '../admin-styles.module.css';
import styles from './page.module.css';
import { useToast } from '@/contexts/ToastContext';
import {
  formatDateDDMMYYYYIST,
  formatDateTimeDDMMYYYYIST,
  formatDateTimeIST,
} from '@/lib/utils/datetime';
import { normalizeAdminListSearchQuery } from '@/lib/utils/searchQuery';
import { deliveryScheduleProductDisplayLabel } from '@/lib/utils/productVariationDisplay';
import {
  formatSubscriptionSlotLine,
  parseDeliverySlotWindowsFromMetadata,
  type DeliverySlotWindow,
} from '@/lib/utils/deliverySlotDisplay';
import {
  aggregateTodaysSubscriptionNeed,
  formatLitresAmount,
  formatTodaysNeedLineLabel,
  type TodaysNeedLine,
} from '@/lib/utils/todaysSubscriptionNeed';

type OrderDeliveryRow = {
  orderId: string;
  orderNumber: string;
  status: 'package_prepared' | 'out_for_delivery' | 'delivered' | string;
  orderedAt: string | null;
  paymentMethod: 'cod' | 'online' | string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | 'cod' | string;
  amount: number | null;
  currency: string;
  itemsCount: number;
  packagePreparedAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  fulfilledAt: string | null;
  customerName: string | null;
  customerEmail: string | null;
};

type OrderItem = {
  productName: string;
  variationSize: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  productId: number | null;
  imageUrl: string | null;
};

type AdminOrderDetails = {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  currency: string;
  subtotal: number;
  discount: number;
  platformFee?: number;
  deliveryCharges: number;
  total: number;
  deliveryAddress: Address | null;
  createdAt: string | null;
  deliveryDate: string | null;
  packagePreparedAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  fulfilledAt: string | null;
  customer: { name: string; email: string };
  items: OrderItem[];
};

function hasValidLocation(address: Address | null | undefined): address is Address {
  return Boolean(
    address &&
      typeof address.latitude === 'number' &&
      Number.isFinite(address.latitude) &&
      typeof address.longitude === 'number' &&
      Number.isFinite(address.longitude),
  );
}

type DeliveriesConfirmAction =
  | { kind: 'out' | 'deliver' | 'fulfill' }
  | { kind: 'subscriptionDeliver'; scheduleId: string };

const SUBSCRIPTION_STATUS_OPTIONS = [
  { value: 'all' as const, label: 'All Status' },
  { value: 'pending' as const, label: 'Pending' },
  { value: 'delivered' as const, label: 'Delivered' },
  { value: 'skipped' as const, label: 'Skipped' },
  { value: 'cancelled' as const, label: 'Cancelled' },
];

const ORDER_STATUS_OPTIONS = [
  { value: 'all' as const, label: 'All Status' },
  { value: 'package_prepared' as const, label: 'Package Prepared' },
  { value: 'out_for_delivery' as const, label: 'Out for Delivery' },
  { value: 'delivered' as const, label: 'Delivered' },
];

const SUBSCRIPTION_SORT_OPTIONS = [
  { value: 'dateDesc' as const, label: 'Newest First' },
  { value: 'dateAsc' as const, label: 'Oldest First' },
  { value: 'statusAsc' as const, label: 'Status (A-Z)' },
];

function getTodayLocalYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayDateKeyInIST(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function normalizeDateKeyToIST(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = String(raw).trim();
  // Already a calendar date (DATE column or plain YYYY-MM-DD) — IST-safe as-is.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // Postgres DATE → "YYYY-MM-DDT00:00:00.000Z" — same calendar date, do NOT shift.
  if (/^\d{4}-\d{2}-\d{2}T00:00:00(?:\.\d+)?Z$/.test(value)) return value.slice(0, 10);
  // Real timestamps: convert through IST.
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const fallback = value.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(fallback) ? fallback : null;
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsed);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

function CopyOrderNumberButton({
  orderNumber,
  showToast,
}: {
  orderNumber: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const text = `#${orderNumber}`;
  const onCopy = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(text);
      showToast('Order number copied', 'success');
    } catch {
      showToast('Could not copy', 'error');
    }
  };
  return (
    <button
      type="button"
      className={styles.copyOrderBtn}
      aria-label={`Copy order number ${text}`}
      title="Copy order number"
      onClick={onCopy}
    >
      <svg
        className={styles.copyOrderIcon}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.242a2 2 0 0 0-.602-1.43L16.083 2.598A2 2 0 0 0 14.685 2H10a2 2 0 0 0-2 2z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 18v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function subscriptionDeliveryQtyLabel(d: DeliverySchedule): string | null {
  const n = d.litresPerDay;
  if (n == null || !Number.isFinite(Number(n))) return null;
  return formatLitresAmount(Number(n));
}

/** COD pill: hide once a full (non-trial) subscription is active — cart COD is resolved after delivery/activation. */
function subscriptionDeliveryIsCod(d: DeliverySchedule): boolean {
  if (String(d.paymentMethod || '').toLowerCase() !== 'cod') return false;
  const subStatus = String(d.subscriptionStatus || '').toLowerCase();
  if (subStatus === 'active' && !d.isTrial) return false;
  return true;
}

/**
 * Admin Deliveries Page
 * View and manage daily delivery schedules
 */
export default function AdminDeliveriesPage() {
  const [tab, setTab] = useState<'subscriptions' | 'orders'>('orders');
  const [deliveries, setDeliveries] = useState<DeliverySchedule[]>([]);
  const [orderDeliveries, setOrderDeliveries] = useState<OrderDeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'delivered' | 'skipped' | 'cancelled'>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'package_prepared' | 'out_for_delivery' | 'delivered'>('all');
  const [sort, setSort] = useState<'dateDesc' | 'dateAsc' | 'statusAsc'>('dateDesc');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [filterSheetView, setFilterSheetView] = useState<'menu' | 'status' | 'sort'>('menu');
  const [filterSheetMounted, setFilterSheetMounted] = useState(false);
  const filterSheetMenuTitleId = useId();
  const { showToast } = useToast();
  const [deliverySlotWindows, setDeliverySlotWindows] = useState<DeliverySlotWindow[]>([]);
  const [todaysNeedOpen, setTodaysNeedOpen] = useState(false);
  const [todaysNeedIncludeDelivered, setTodaysNeedIncludeDelivered] = useState(false);
  const [routeCheckPopupOpen, setRouteCheckPopupOpen] = useState(false);
  const [routePlannerSlot, setRoutePlannerSlot] = useState<'morning' | 'evening'>('morning');
  /** delivery_schedules.id values we hid from today's list because the customer cancelled them.
   *  Forwarded to the route planner so its map/queue also excludes them. */
  const [excludedSubscriptionStopIds, setExcludedSubscriptionStopIds] = useState<Set<string>>(
    () => new Set(),
  );
  const todaysNeedTitleId = useId();
  // Orders "Today's Need" state
  const [ordersNeedOpen, setOrdersNeedOpen] = useState(false);
  const [ordersRoutePopupOpen, setOrdersRoutePopupOpen] = useState(false);
  const [ordersRouteNonce, setOrdersRouteNonce] = useState(0);  // increments each open → forces remount
  const [ordersRefreshing, setOrdersRefreshing] = useState(false);
  const [ordersStopsCount, setOrdersStopsCount] = useState<number | null>(null); // count from route-planner endpoint
  const ordersNeedTitleId = useId();

  useEffect(() => setFilterSheetMounted(true), []);

  useEffect(() => {
    adminContentApi
      .getByType('subscription_delivery')
      .then((c) => setDeliverySlotWindows(parseDeliverySlotWindowsFromMetadata(c?.metadata)))
      .catch(() => setDeliverySlotWindows(parseDeliverySlotWindowsFromMetadata({})));
  }, []);

  useEffect(() => {
    if (!filterSheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (filterSheetView !== 'menu') setFilterSheetView('menu');
      else setFilterSheetOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [filterSheetOpen, filterSheetView]);

  useEffect(() => {
    if (tab === 'subscriptions') fetchDeliveries();
  }, [tab]);

  useEffect(() => {
    if (tab === 'orders') {
      fetchOrderDeliveries();
      // Pre-load the routable stops count so it's ready when Today's Need is opened
      apiClient
        .get<{ id: string | number }[]>(API_ENDPOINTS.ADMIN.ORDER_DELIVERIES.ORDER_DELIVERY_STOPS)
        .then((stops) => setOrdersStopsCount(Array.isArray(stops) ? stops.length : 0))
        .catch(() => { /* silent */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Every time the Orders Today's Need modal opens: fetch from ORDER_DELIVERY_STOPS
  // (the same source the route planner uses) so the count is always identical.
  useEffect(() => {
    if (!ordersNeedOpen) return;
    setOrdersRefreshing(true);
    setOrdersStopsCount(null);
    apiClient
      .get<{ id: string | number }[]>(API_ENDPOINTS.ADMIN.ORDER_DELIVERIES.ORDER_DELIVERY_STOPS)
      .then((stops) => setOrdersStopsCount(Array.isArray(stops) ? stops.length : 0))
      .catch(() => setOrdersStopsCount(0))
      .finally(() => setOrdersRefreshing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordersNeedOpen]);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      // Must match backend / subscription `delivery_date` (Asia/Kolkata calendar), not browser local midnight.
      const todayIstKey = getTodayDateKeyInIST();
      const data = await apiClient.get<DeliverySchedule[]>(
        `${API_ENDPOINTS.ADMIN.DELIVERIES.LIST}?date=${todayIstKey}`
      );
      // Root-only frontend safeguard:
      // when the customer cancels today's delivery the backend may be slow to flip the
      // delivery_schedules row to 'cancelled' (or only update paused_dates). Detect both
      // signals and treat the subscription as cancelled-for-today so the admin doesn't
      // accidentally fulfill it.
      const subs = await adminSubscriptionsApi.getAll();
      const subscriptionById = new Map((subs || []).map((sub) => [String(sub.id), sub]));

      const pendingSubscriptionIds = Array.from(
        new Set(
          (data || [])
            .filter((delivery) => delivery.status === 'pending')
            .map((delivery) => String(delivery.subscriptionId))
            .filter(Boolean)
        )
      );

      // Some admin list responses omit pausedDates / deliverySchedules. Fetch per-subscription
      // detail for today's pending rows so customer "cancel today" persists into admin list,
      // Today's Need, and route-map filtering.
      const detailedSubscriptions = await Promise.all(
        pendingSubscriptionIds.map(async (subscriptionId) => {
          try {
            return await adminSubscriptionsApi.getById(subscriptionId);
          } catch {
            return null;
          }
        })
      );
      detailedSubscriptions.forEach((sub) => {
        if (sub) subscriptionById.set(String(sub.id), sub);
      });

      const cancelledTodaySubscriptionIds = new Set<string>();
      Array.from(subscriptionById.values()).forEach((sub) => {
        const pausedToday = (sub.pausedDates || []).some(
          (pausedDate) => normalizeDateKeyToIST(pausedDate) === todayIstKey
        );
        const scheduleCancelledToday = (sub.deliverySchedules || []).some((row) => {
          const key = normalizeDateKeyToIST(row.deliveryDate);
          return key === todayIstKey && (row.status === 'cancelled' || row.status === 'skipped');
        });
        if (pausedToday || scheduleCancelledToday) {
          cancelledTodaySubscriptionIds.add(String(sub.id));
        }
      });
      const excludedIds = new Set<string>();
      const sanitized = (data || []).filter((delivery) => {
        if (delivery.status !== 'pending') return true;
        if (cancelledTodaySubscriptionIds.has(String(delivery.subscriptionId))) {
          excludedIds.add(String(delivery.id));
          return false;
        }
        return true;
      });
      setDeliveries(sanitized);
      setExcludedSubscriptionStopIds(excludedIds);
    } catch (error) {
      console.error('Failed to fetch deliveries:', error);
      showToast('Failed to load deliveries', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDeliveries = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<OrderDeliveryRow[]>(API_ENDPOINTS.ADMIN.ORDER_DELIVERIES.LIST);
      setOrderDeliveries(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch order deliveries:', error);
      showToast('Failed to load order deliveries', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = [...deliveries];

    // Search filter (#123 matches subscription id 123)
    const qSub = normalizeAdminListSearchQuery(query);
    if (qSub) {
      result = result.filter(
        (delivery) =>
          delivery.subscriptionId.toString().includes(qSub) ||
          deliveryScheduleProductDisplayLabel(delivery).toLowerCase().includes(qSub) ||
          (delivery.userName || '').toLowerCase().includes(qSub) ||
          (delivery.userEmail || '').toLowerCase().includes(qSub) ||
          (delivery.trialShifted ? 'trial shifted' : '').includes(qSub)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((delivery) => {
        if (statusFilter === 'pending') return delivery.status === 'pending';
        if (statusFilter === 'delivered') return delivery.status === 'delivered';
        if (statusFilter === 'skipped') return delivery.status === 'skipped';
        if (statusFilter === 'cancelled') return delivery.status === 'cancelled';
        return true;
      });
    }

    // Sort
    result.sort((a, b) => {
      if (sort === 'dateAsc') {
        return new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime();
      }
      if (sort === 'statusAsc') {
        return a.status.localeCompare(b.status);
      }
      // dateDesc
      return new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime();
    });

    return result;
  }, [deliveries, query, statusFilter, sort]);

  const todaysNeedReport = useMemo(
    () =>
      aggregateTodaysSubscriptionNeed(deliveries, deliverySlotWindows, {
        onlyPending: !todaysNeedIncludeDelivered,
      }),
    [deliveries, deliverySlotWindows, todaysNeedIncludeDelivered]
  );

  const filteredOrders = useMemo(() => {
    let result = [...orderDeliveries];

    const qOrd = normalizeAdminListSearchQuery(query);
    if (qOrd) {
      result = result.filter(
        (o) =>
          (o.orderNumber || '').toLowerCase().includes(qOrd) ||
          (o.orderId || '').toLowerCase().includes(qOrd) ||
          (o.customerName || '').toLowerCase().includes(qOrd) ||
          (o.customerEmail || '').toLowerCase().includes(qOrd) ||
          (o.status || '').toLowerCase().includes(qOrd)
      );
    }

    if (orderStatusFilter !== 'all') {
      result = result.filter((o) => o.status === orderStatusFilter);
    }

    result.sort((a, b) => {
      const ta = a.orderedAt ? new Date(a.orderedAt).getTime() : 0;
      const tb = b.orderedAt ? new Date(b.orderedAt).getTime() : 0;
      return tb - ta;
    });

    return result;
  }, [orderDeliveries, query, orderStatusFilter]);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderDetails | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<DeliveriesConfirmAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => {
    if (!filterSheetOpen && !selectedOrderId && !confirmAction && !todaysNeedOpen && !routeCheckPopupOpen && !ordersNeedOpen && !ordersRoutePopupOpen && !locationModalOpen)
      return;

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverscrollY = html.style.overscrollBehaviorY;
    const prevBodyOverscrollY = body.style.overscrollBehaviorY;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehaviorY = 'none';
    body.style.overscrollBehaviorY = 'none';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.overscrollBehaviorY = prevHtmlOverscrollY;
      body.style.overscrollBehaviorY = prevBodyOverscrollY;
    };
  }, [filterSheetOpen, selectedOrderId, confirmAction, todaysNeedOpen, routeCheckPopupOpen, ordersNeedOpen, ordersRoutePopupOpen, locationModalOpen]);

  const closeFilterSheet = () => {
    setFilterSheetOpen(false);
    setFilterSheetView('menu');
  };

  const statusFilterLabel = useMemo(() => {
    if (tab === 'subscriptions') {
      return SUBSCRIPTION_STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? '';
    }
    return ORDER_STATUS_OPTIONS.find((o) => o.value === orderStatusFilter)?.label ?? '';
  }, [tab, statusFilter, orderStatusFilter]);
  const sortFilterLabel = SUBSCRIPTION_SORT_OPTIONS.find((o) => o.value === sort)?.label ?? '';

  const openOrderDetails = async (orderId: string) => {
    setSelectedOrderId(orderId);
    setDetailsLoading(true);
    try {
      const data = await apiClient.get<AdminOrderDetails>(API_ENDPOINTS.ADMIN.ORDER_DELIVERIES.DETAIL(orderId));
      setSelectedOrder(data);
    } catch (error) {
      console.error('Failed to load order details:', error);
      showToast('Failed to load order details', 'error');
      setSelectedOrderId(null);
      setSelectedOrder(null);
      setLocationModalOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  /** Re-fetches the count of routable stops from the authoritative endpoint. */
  const refreshOrdersStopsCount = () => {
    apiClient
      .get<{ id: string | number }[]>(API_ENDPOINTS.ADMIN.ORDER_DELIVERIES.ORDER_DELIVERY_STOPS)
      .then((stops) => setOrdersStopsCount(Array.isArray(stops) ? stops.length : 0))
      .catch(() => { /* silent */ });
  };

  const executeConfirm = async () => {
    if (!confirmAction) return;
    if (confirmAction.kind === 'subscriptionDeliver') {
      setConfirmBusy(true);
      try {
        await apiClient.put(API_ENDPOINTS.ADMIN.DELIVERIES.UPDATE_STATUS(confirmAction.scheduleId), {
          status: 'delivered',
        });
        showToast('Delivery marked as delivered', 'success');
        setConfirmAction(null);
        await fetchDeliveries();
      } catch (error) {
        console.error('Failed to mark delivery as delivered:', error);
        showToast('Failed to update delivery status', 'error');
      } finally {
        setConfirmBusy(false);
      }
      return;
    }

    if (!selectedOrder) return;
    const orderKind = confirmAction.kind;
    setConfirmBusy(true);
    try {
      if (orderKind === 'out') {
        await apiClient.post(API_ENDPOINTS.ADMIN.ORDER_DELIVERIES.MARK_OUT_FOR_DELIVERY(selectedOrder.id));
      } else if (orderKind === 'deliver') {
        await apiClient.post(API_ENDPOINTS.ADMIN.ORDER_DELIVERIES.MARK_DELIVERED(selectedOrder.id));
      } else if (orderKind === 'fulfill') {
        await apiClient.post(API_ENDPOINTS.ADMIN.ORDER_DELIVERIES.MARK_FULFILLED(selectedOrder.id));
      }

      showToast('Updated successfully', 'success');
      setConfirmAction(null);

      await fetchOrderDeliveries();
      const refreshed = await apiClient.get<AdminOrderDetails>(API_ENDPOINTS.ADMIN.ORDER_DELIVERIES.DETAIL(selectedOrder.id));
      setSelectedOrder(refreshed);

      if (orderKind === 'out') {
        refreshOrdersStopsCount();
      }
    } catch (error) {
      console.error('Failed to update order:', error);
      showToast('Failed to update order', 'error');
    } finally {
      setConfirmBusy(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'delivered':
        return styles.badgeDelivered;
      case 'pending':
        return styles.badgePending;
      case 'skipped':
        return styles.badgeSkipped;
      case 'cancelled':
        return styles.badgeCancelled;
      default:
        return styles.badgePending;
    }
  };

  const getOrderStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'package_prepared':
        return styles.badgePrepared;
      case 'out_for_delivery':
        return styles.badgeOutForDelivery;
      case 'delivered':
        return styles.badgeDelivered;
      default:
        return styles.badgeInfo;
    }
  };

  const renderNeedLines = (lines: TodaysNeedLine[]) =>
    lines.length === 0 ? (
      <p className={styles.todaysNeedMeta}>None</p>
    ) : (
      <ul className={styles.todaysNeedList}>
        {lines.map((line) => (
          <li key={line.key}>
            <span className={styles.todaysNeedLineTitle}>{formatTodaysNeedLineLabel(line)}</span>
            <span className={styles.todaysNeedLineDetail}>
              {formatLitresAmount(line.totalLitres)} L total · {line.deliveryCount} stop
              {line.deliveryCount === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ul>
    );

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '50vh',
        padding: '2rem'
      }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerBlock}>
        <div className={styles.headerRow}>
          <h1 className={adminStyles.adminPageTitle}>Deliveries</h1>
          <p className={styles.subtitle}>Manage subscription deliveries and checkout order deliveries</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchSlot}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                tab === 'subscriptions'
                  ? 'Search subscription, product, size, customer…'
                  : 'Search order #, customer…'
              }
              aria-label={tab === 'subscriptions' ? 'Search subscription deliveries' : 'Search order deliveries'}
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.toolbarDesktopFilters}>
          {tab === 'subscriptions' ? (
            <>
              <CustomSelect
                value={statusFilter}
                onChange={setStatusFilter}
                modalTitle="Status"
                options={SUBSCRIPTION_STATUS_OPTIONS}
              />
              <CustomSelect
                value={sort}
                onChange={setSort}
                modalTitle="Sort"
                options={SUBSCRIPTION_SORT_OPTIONS}
              />
            </>
          ) : (
            <CustomSelect
              value={orderStatusFilter}
              onChange={setOrderStatusFilter}
              modalTitle="Order status"
              options={ORDER_STATUS_OPTIONS}
            />
          )}
        </div>

        <button
          type="button"
          className={styles.toolbarMobileFilterBtn}
          aria-label="Filters"
          aria-haspopup="dialog"
          aria-expanded={filterSheetOpen}
          onClick={() => {
            setFilterSheetView('menu');
            setFilterSheetOpen(true);
          }}
        >
          <svg className={styles.toolbarMobileFilterIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 6h16M8 12h8M10 18h4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="18" cy="6" r="1.75" fill="currentColor" />
            <circle cx="6" cy="12" r="1.75" fill="currentColor" />
            <circle cx="16" cy="18" r="1.75" fill="currentColor" />
          </svg>
        </button>
      </div>

      <div className={styles.listModeSwitch}>
        <div className={styles.listModeSwitchTrack} role="tablist" aria-label="Delivery list type">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'subscriptions'}
            className={`${styles.listModeSwitchBtn} ${tab === 'subscriptions' ? styles.listModeSwitchBtnActive : ''}`}
            onClick={() => setTab('subscriptions')}
          >
            Subscriptions
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'orders'}
            className={`${styles.listModeSwitchBtn} ${tab === 'orders' ? styles.listModeSwitchBtnActive : ''}`}
            onClick={() => setTab('orders')}
          >
            Orders
          </button>
        </div>
      </div>

      {tab === 'subscriptions' ? (
        <div className={styles.todaysNeedBar}>
          <button
            type="button"
            className={styles.todaysNeedBtn}
            onClick={() => setTodaysNeedOpen(true)}
          >
            Today&apos;s need
            <span className={styles.todaysNeedBtnIconWrap} aria-hidden="true">
              <svg
                className={styles.todaysNeedBtnIcon}
                viewBox="0 0 512 512"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
              >
                <path d="M511.746,252.725c-0.061-0.427-0.11-0.852-0.194-1.275c-0.076-0.382-0.18-0.749-0.275-1.125 c-0.092-0.362-0.171-0.726-0.279-1.085c-0.112-0.369-0.251-0.726-0.38-1.089c-0.127-0.354-0.244-0.711-0.388-1.06 c-0.143-0.34-0.307-0.666-0.464-0.998c-0.168-0.355-0.327-0.715-0.514-1.064c-0.171-0.321-0.366-0.624-0.552-0.936 c-0.203-0.34-0.394-0.684-0.616-1.015c-0.234-0.351-0.493-0.68-0.745-1.015c-0.205-0.272-0.393-0.549-0.608-0.815 c-0.489-0.594-1.002-1.167-1.548-1.71l-116.36-116.363c-9.086-9.089-23.822-9.089-32.912,0c-9.089,9.089-9.089,23.824,0,32.912 l76.634,76.639H23.273C10.42,232.729,0,243.149,0,256.002c0,12.853,10.42,23.273,23.273,23.273h409.272l-76.636,76.634 c-9.089,9.089-9.089,23.824,0,32.913c4.544,4.544,10.501,6.817,16.457,6.817c5.956,0,11.913-2.271,16.455-6.817l116.36-116.36 c0.546-0.543,1.06-1.116,1.548-1.711c0.216-0.264,0.403-0.543,0.608-0.813c0.251-0.335,0.51-0.664,0.745-1.015 c0.223-0.33,0.414-0.675,0.616-1.015c0.186-0.312,0.382-0.614,0.552-0.936c0.186-0.351,0.346-0.709,0.514-1.066 c0.157-0.332,0.321-0.658,0.464-0.998c0.144-0.349,0.261-0.706,0.388-1.06c0.129-0.362,0.268-0.718,0.38-1.089 c0.107-0.358,0.188-0.721,0.279-1.085c0.095-0.374,0.199-0.743,0.275-1.125c0.084-0.422,0.133-0.849,0.194-1.275 c0.047-0.326,0.109-0.647,0.143-0.976c0.15-1.53,0.15-3.07,0-4.6C511.854,253.372,511.792,253.051,511.746,252.725z" />
              </svg>
            </span>
          </button>
          <span className={styles.todaysNeedHint}>Total litres, products, morning vs evening slots</span>
          <span className={styles.todaysNeedCornerIcon} aria-hidden="true">
            <svg
              className={styles.todaysNeedCornerIconSvg}
              viewBox="-1 02 19 19"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
            >
              <path d="M16.417 9.583A7.917 7.917 0 1 1 8.5 1.666a7.917 7.917 0 0 1 7.917 7.917zM5.85 3.309a6.833 6.833 0 1 0 2.65-.534 6.79 6.79 0 0 0-2.65.534zm5.958 4.678c-.105.113-.22.22-.33.33l-.756.757-1.59 1.59a1.532 1.532 0 0 1-.404.35.56.56 0 0 1-.778-.515c-.004-.431 0-.862 0-1.293V4.28a.554.554 0 0 1 .987-.36.86.86 0 0 1 .122.586V9.17q.155-.157.312-.313l1.223-1.223.387-.387a.647.647 0 0 1 .218-.153.554.554 0 0 1 .61.893z" />
            </svg>
          </span>
        </div>
      ) : null}

      {tab === 'orders' ? (
        <div className={styles.todaysNeedBar}>
          <button
            type="button"
            className={styles.todaysNeedBtn}
            onClick={() => setOrdersNeedOpen(true)}
          >
            Today&apos;s need
            <span className={styles.todaysNeedBtnIconWrap} aria-hidden="true">
              <svg
                className={styles.todaysNeedBtnIcon}
                viewBox="0 0 512 512"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
              >
                <path d="M511.746,252.725c-0.061-0.427-0.11-0.852-0.194-1.275c-0.076-0.382-0.18-0.749-0.275-1.125 c-0.092-0.362-0.171-0.726-0.279-1.085c-0.112-0.369-0.251-0.726-0.38-1.089c-0.127-0.354-0.244-0.711-0.388-1.06 c-0.143-0.34-0.307-0.666-0.464-0.998c-0.168-0.355-0.327-0.715-0.514-1.064c-0.171-0.321-0.366-0.624-0.552-0.936 c-0.203-0.34-0.394-0.684-0.616-1.015c-0.234-0.351-0.493-0.68-0.745-1.015c-0.205-0.272-0.393-0.549-0.608-0.815 c-0.489-0.594-1.002-1.167-1.548-1.71l-116.36-116.363c-9.086-9.089-23.822-9.089-32.912,0c-9.089,9.089-9.089,23.824,0,32.912 l76.634,76.639H23.273C10.42,232.729,0,243.149,0,256.002c0,12.853,10.42,23.273,23.273,23.273h409.272l-76.636,76.634 c-9.089,9.089-9.089,23.824,0,32.913c4.544,4.544,10.501,6.817,16.457,6.817c5.956,0,11.913-2.271,16.455-6.817l116.36-116.36 c0.546-0.543,1.06-1.116,1.548-1.711c0.216-0.264,0.403-0.543,0.608-0.813c0.251-0.335,0.51-0.664,0.745-1.015 c0.223-0.33,0.414-0.675,0.616-1.015c0.186-0.312,0.382-0.614,0.552-0.936c0.186-0.351,0.346-0.709,0.514-1.066 c0.157-0.332,0.321-0.658,0.464-0.998c0.144-0.349,0.261-0.706,0.388-1.06c0.129-0.362,0.268-0.718,0.38-1.089 c0.107-0.358,0.188-0.721,0.279-1.085c0.095-0.374,0.199-0.743,0.275-1.125c0.084-0.422,0.133-0.849,0.194-1.275 c0.047-0.326,0.109-0.647,0.143-0.976c0.15-1.53,0.15-3.07,0-4.6C511.854,253.372,511.792,253.051,511.746,252.725z" />
              </svg>
            </span>
          </button>
          <span className={styles.todaysNeedHint}>
            {ordersStopsCount !== null
              ? `${ordersStopsCount} order${ordersStopsCount !== 1 ? 's' : ''} ready to route`
              : 'Out for delivery orders · plan your route'}
          </span>
          <span className={styles.todaysNeedCornerIcon} aria-hidden="true">
            <svg
              className={styles.todaysNeedCornerIconSvg}
              viewBox="-1 02 19 19"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
            >
              <path d="M16.417 9.583A7.917 7.917 0 1 1 8.5 1.666a7.917 7.917 0 0 1 7.917 7.917zM5.85 3.309a6.833 6.833 0 1 0 2.65-.534 6.79 6.79 0 0 0-2.65.534zm5.958 4.678c-.105.113-.22.22-.33.33l-.756.757-1.59 1.59a1.532 1.532 0 0 1-.404.35.56.56 0 0 1-.778-.515c-.004-.431 0-.862 0-1.293V4.28a.554.554 0 0 1 .987-.36.86.86 0 0 1 .122.586V9.17q.155-.157.312-.313l1.223-1.223.387-.387a.647.647 0 0 1 .218-.153.554.554 0 0 1 .61.893z" />
            </svg>
          </span>
        </div>
      ) : null}

      {filterSheetMounted && filterSheetOpen
        ? createPortal(
            <div
              className={styles.filterSheetBackdrop}
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeFilterSheet();
              }}
              data-lenis-prevent
            >
              <div
                className={styles.filterSheetPanel}
                role="dialog"
                aria-modal="true"
                aria-labelledby={filterSheetMenuTitleId}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className={styles.filterSheetGrab} aria-hidden />
                {filterSheetView === 'menu' ? (
                  <>
                    <div className={styles.filterSheetHeader}>
                      <h2 id={filterSheetMenuTitleId} className={styles.filterSheetTitle}>
                        Filters
                      </h2>
                      <button type="button" className={styles.filterSheetClose} aria-label="Close filters" onClick={closeFilterSheet}>
                        ×
                      </button>
                    </div>
                    <div className={styles.filterSheetMenu}>
                      <button type="button" className={styles.filterSheetMenuRow} onClick={() => setFilterSheetView('status')}>
                        <span className={styles.filterSheetMenuLabel}>Status</span>
                        <span className={styles.filterSheetMenuValue}>{statusFilterLabel}</span>
                        <span className={styles.filterSheetMenuChevron} aria-hidden>
                          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M7.5 5L12.5 10L7.5 15" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </button>
                      {tab === 'subscriptions' ? (
                        <button type="button" className={styles.filterSheetMenuRow} onClick={() => setFilterSheetView('sort')}>
                          <span className={styles.filterSheetMenuLabel}>Sort</span>
                          <span className={styles.filterSheetMenuValue}>{sortFilterLabel}</span>
                          <span className={styles.filterSheetMenuChevron} aria-hidden>
                            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M7.5 5L12.5 10L7.5 15" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : null}

                {filterSheetView === 'status' ? (
                  <div className={styles.filterSheetSub}>
                    <div className={styles.filterSheetSubHeader}>
                      <button
                        type="button"
                        className={styles.filterSheetBack}
                        aria-label="Back"
                        onClick={() => setFilterSheetView('menu')}
                      >
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <h2 className={styles.filterSheetSubTitle}>Status</h2>
                    </div>
                    <div className={styles.filterSheetOptions} role="listbox" aria-label="Status">
                      {(tab === 'subscriptions' ? SUBSCRIPTION_STATUS_OPTIONS : ORDER_STATUS_OPTIONS).map((opt) => {
                        const active =
                          tab === 'subscriptions' ? statusFilter === opt.value : orderStatusFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="option"
                            aria-selected={active}
                            className={`${styles.filterSheetOption} ${active ? styles.filterSheetOptionActive : ''}`}
                            onClick={() => {
                              if (tab === 'subscriptions') {
                                setStatusFilter(opt.value as typeof statusFilter);
                              } else {
                                setOrderStatusFilter(opt.value as typeof orderStatusFilter);
                              }
                              setFilterSheetView('menu');
                            }}
                          >
                            <span>{opt.label}</span>
                            {active ? <span className={styles.filterSheetOptionBadge}>Selected</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {filterSheetView === 'sort' ? (
                  <div className={styles.filterSheetSub}>
                    <div className={styles.filterSheetSubHeader}>
                      <button
                        type="button"
                        className={styles.filterSheetBack}
                        aria-label="Back"
                        onClick={() => setFilterSheetView('menu')}
                      >
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <h2 className={styles.filterSheetSubTitle}>Sort</h2>
                    </div>
                    <div className={styles.filterSheetOptions} role="listbox" aria-label="Sort">
                      {SUBSCRIPTION_SORT_OPTIONS.map((opt) => {
                        const active = sort === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="option"
                            aria-selected={active}
                            className={`${styles.filterSheetOption} ${active ? styles.filterSheetOptionActive : ''}`}
                            onClick={() => {
                              setSort(opt.value);
                              setFilterSheetView('menu');
                            }}
                          >
                            <span>{opt.label}</span>
                            {active ? <span className={styles.filterSheetOptionBadge}>Selected</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}

      {tab === 'subscriptions' && filtered.length === 0 ? (
        <div className={styles.panel}>
          <div className={styles.emptyState}>
            <p>No deliveries found for today</p>
            {query && <p className={styles.emptyStateSubtext}>Try adjusting your search</p>}
          </div>
        </div>
      ) : tab === 'subscriptions' ? (
          <>
            <div className={`${styles.panel} ${styles.tableDesktop}`}>
              <div className={styles.table}>
                <table>
                  <thead>
                    <tr>
                      <th>Subscription</th>
                      <th>Product</th>
                      <th>Slot</th>
                      <th>Customer</th>
                      <th>Delivery Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((delivery) => {
                      const qtyLabel = subscriptionDeliveryQtyLabel(delivery);
                      return (
                      <tr
                        key={delivery.id}
                        className={delivery.status === 'delivered' ? styles.rowFulfilled : ''}
                      >
                        <td>
                          <div className={styles.subscriptionCell}>
                            <span>#{delivery.subscriptionId}</span>
                            {delivery.isTrial ? <span className={styles.trialTypeBadge}>Trial</span> : null}
                            {subscriptionDeliveryIsCod(delivery) ? (
                              <span className={styles.codSubscriptionBadge}>COD</span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <div className={styles.productCell}>
                            <div className={styles.cardProductRow}>
                              <span className={styles.cardProductName}>
                                {deliveryScheduleProductDisplayLabel(delivery)}
                              </span>
                              {qtyLabel != null ? (
                                <span className={styles.cardProductQty}>· {qtyLabel} Qty</span>
                              ) : null}
                              {delivery.trialShifted && (
                                <span className={styles.trialShiftedBadge}>Trial shifted</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className={styles.slotCell}>
                            {formatSubscriptionSlotLine(delivery.deliveryTime, deliverySlotWindows) || '—'}
                          </div>
                        </td>
                        <td>
                          <div className={styles.customerCell}>
                            <div className={styles.customerName}>
                              {delivery.userName || delivery.userEmail || 'N/A'}
                            </div>
                            {delivery.userEmail && delivery.userName && (
                              <div className={styles.customerEmail}>{delivery.userEmail}</div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className={styles.dateCell}>
                            {formatDateDDMMYYYYIST(delivery.deliveryDate)}
                          </div>
                        </td>
                        <td>
                          <span className={`${styles.badge} ${getStatusBadgeClass(delivery.status)}`}>
                            {delivery.status}
                          </span>
                        </td>
                        <td>
                          <div className={styles.actions}>
                            {delivery.status === 'pending' && (
                              <button
                                onClick={() => setConfirmAction({ kind: 'subscriptionDeliver', scheduleId: delivery.id })}
                                className={styles.actionButton}
                                title="Mark as Delivered"
                              >
                                Mark Delivered
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className={styles.cards}>
              {filtered.map((delivery) => {
                const slotLabel = formatSubscriptionSlotLine(delivery.deliveryTime, deliverySlotWindows);
                const qtyLabel = subscriptionDeliveryQtyLabel(delivery);
                return (
                  <div
                    key={`m-${delivery.id}`}
                    className={`${styles.card} ${delivery.status === 'delivered' ? styles.cardFulfilled : ''}`}
                  >
                    <div className={styles.cardTop}>
                      <div>
                        <div className={styles.cardTitleRow}>
                          <span className={styles.cardTitle}>#{delivery.subscriptionId}</span>
                          {delivery.isTrial ? <span className={styles.trialTypeBadge}>Trial</span> : null}
                          {subscriptionDeliveryIsCod(delivery) ? (
                            <span className={styles.codSubscriptionBadge}>COD</span>
                          ) : null}
                          <span className={`${styles.badge} ${getStatusBadgeClass(delivery.status)}`}>{delivery.status}</span>
                        </div>
                        <div className={styles.cardProductRow}>
                          <span className={styles.cardProductName}>
                            {deliveryScheduleProductDisplayLabel(delivery)}
                          </span>
                          {qtyLabel != null ? (
                            <span className={styles.cardProductQty}>· {qtyLabel} Qty</span>
                          ) : null}
                          {delivery.trialShifted && (
                            <span className={styles.trialShiftedBadge}>Trial shifted</span>
                          )}
                        </div>
                        {slotLabel ? <div className={styles.cardSlotLine}>{slotLabel}</div> : null}
                      </div>
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.customerCell}>
                        <div className={styles.customerName}>{delivery.userName || delivery.userEmail || 'N/A'}</div>
                        {delivery.userEmail && delivery.userName ? (
                          <div className={styles.customerEmail}>{delivery.userEmail}</div>
                        ) : null}
                      </div>
                      <div className={styles.cardMeta}>
                        <span className={styles.cardMetaLabel}>Delivery</span>
                        <span className={styles.dateCell}>{formatDateDDMMYYYYIST(delivery.deliveryDate)}</span>
                      </div>
                      {delivery.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => setConfirmAction({ kind: 'subscriptionDeliver', scheduleId: delivery.id })}
                          className={styles.actionButton}
                          title="Mark as Delivered"
                        >
                          Mark Delivered
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
      ) : filteredOrders.length === 0 ? (
        <div className={styles.panel}>
          <div className={styles.emptyState}>
            <p>No order deliveries found</p>
            {query && <p className={styles.emptyStateSubtext}>Try adjusting your search</p>}
          </div>
        </div>
      ) : (
          <>
            <div className={`${styles.panel} ${styles.tableDesktop}`}>
              <div className={styles.table}>
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Ordered At</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th>Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((o) => {
                      const isCod = (o.paymentMethod || '').toLowerCase() === 'cod';
                      const codPaid = isCod && (o.paymentStatus || '').toLowerCase() === 'paid';
                      const isDelivered = o.status === 'delivered';
                      return (
                        <tr
                          key={o.orderId}
                          onClick={() => openOrderDetails(o.orderId)}
                          className={isDelivered ? styles.rowFulfilled : ''}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <span className={styles.orderNumRow}>
                              <span className={styles.orderNum}>#{o.orderNumber}</span>
                              <CopyOrderNumberButton orderNumber={o.orderNumber} showToast={showToast} />
                            </span>
                          </td>
                          <td>
                            <div className={styles.customerCell}>
                              <div className={styles.customerName}>{o.customerName || o.customerEmail || '—'}</div>
                              {o.customerEmail && o.customerName && <div className={styles.customerEmail}>{o.customerEmail}</div>}
                            </div>
                          </td>
                          <td>
                            <div className={styles.dateCell}>{formatDateTimeDDMMYYYYIST(o.orderedAt)}</div>
                          </td>
                          <td>
                            <span className={`${styles.badge} ${getOrderStatusBadgeClass(o.status)}`}>{o.status}</span>
                          </td>
                          <td>
                            {isCod ? (
                              <div className={styles.paymentBadge}>
                                <span className={`${styles.paymentBadgePill} ${codPaid ? styles.paymentBadgeGreen : styles.paymentBadgeAmber}`}>
                                  COD
                                </span>
                              </div>
                            ) : (
                              <div className={styles.paymentBadge}>
                                <span className={`${styles.paymentBadgePill} ${styles.paymentBadgeGreen}`}>ONLINE</span>
                              </div>
                            )}
                          </td>
                          <td>{o.itemsCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className={styles.cards}>
              {filteredOrders.map((o) => {
                const isCod = (o.paymentMethod || '').toLowerCase() === 'cod';
                const codPaid = isCod && (o.paymentStatus || '').toLowerCase() === 'paid';
                const isDelivered = o.status === 'delivered';
                return (
                  <div
                    key={`m-${o.orderId}`}
                    role="button"
                    tabIndex={0}
                    className={`${styles.card} ${styles.cardClickable} ${isDelivered ? styles.cardFulfilled : ''}`}
                    onClick={() => openOrderDetails(o.orderId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openOrderDetails(o.orderId);
                      }
                    }}
                    aria-label={`Open order ${o.orderNumber}`}
                  >
                    <div className={styles.cardTop}>
                      <div>
                        <div className={styles.cardTitleRow}>
                          <span className={styles.cardTitle}>#{o.orderNumber}</span>
                          <CopyOrderNumberButton orderNumber={o.orderNumber} showToast={showToast} />
                        </div>
                        <div className={styles.cardDate}>{formatDateTimeDDMMYYYYIST(o.orderedAt)}</div>
                      </div>
                      <span className={`${styles.badge} ${getOrderStatusBadgeClass(o.status)}`}>{o.status}</span>
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.customerCell}>
                        <div className={styles.customerName}>{o.customerName || o.customerEmail || '—'}</div>
                        {o.customerEmail && o.customerName ? <div className={styles.customerEmail}>{o.customerEmail}</div> : null}
                      </div>
                      <div className={styles.cardRowMeta}>
                        {isCod ? (
                          <div className={styles.paymentBadge}>
                            <span className={`${styles.paymentBadgePill} ${codPaid ? styles.paymentBadgeGreen : styles.paymentBadgeAmber}`}>
                              COD
                            </span>
                          </div>
                        ) : (
                          <div className={styles.paymentBadge}>
                            <span className={`${styles.paymentBadgePill} ${styles.paymentBadgeGreen}`}>ONLINE</span>
                          </div>
                        )}
                        <span className={styles.cardItems}>{o.itemsCount} items</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
      )}

      {todaysNeedOpen
        ? createPortal(
            <div
              className={styles.todaysNeedBackdrop}
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setTodaysNeedOpen(false);
              }}
              data-lenis-prevent
            >
              <div
                className={styles.todaysNeedPanel}
                role="dialog"
                aria-modal="true"
                aria-labelledby={todaysNeedTitleId}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className={styles.todaysNeedClose}
                  aria-label="Close"
                  onClick={() => setTodaysNeedOpen(false)}
                >
                  ×
                </button>
                <div className={styles.todaysNeedInner}>
                  <h2 id={todaysNeedTitleId} className={styles.todaysNeedTitle}>
                    Today&apos;s need
                  </h2>
                  <p className={styles.todaysNeedMeta}>
                    {formatDateDDMMYYYYIST(getTodayLocalYmd())} · full list for this day (ignores search / filters)
                  </p>
                  <label className={styles.todaysNeedToggle}>
                    <input
                      type="checkbox"
                      checked={todaysNeedIncludeDelivered}
                      onChange={(e) => setTodaysNeedIncludeDelivered(e.target.checked)}
                    />
                    <span>Include delivered stops</span>
                  </label>
                  <p className={styles.todaysNeedFootnote}>
                    {todaysNeedIncludeDelivered
                      ? 'Counts pending and delivered; skips skipped and cancelled.'
                      : 'Pending stops only — what still needs to go out.'}
                  </p>

                  <div className={styles.todaysNeedSummaryCard}>
                    <div className={styles.todaysNeedTotalRow}>
                      <span className={styles.todaysNeedTotalLabel}>Total qty</span>
                      <span className={styles.todaysNeedTotalValue}>{formatLitresAmount(todaysNeedReport.totalLitres)}</span>
                      <span className={styles.todaysNeedTotalUnit}>L</span>
                    </div>
                    <p className={styles.todaysNeedMeta}>
                      Sum of per-day litres across {todaysNeedReport.rowCount} delivery row
                      {todaysNeedReport.rowCount === 1 ? '' : 's'}
                    </p>
                  </div>

                  <div className={styles.todaysNeedSectionTitle}>Products</div>
                  {renderNeedLines(todaysNeedReport.lines)}

                  <div className={styles.todaysNeedSectionTitle}>By delivery slot</div>
                  <div className={styles.todaysNeedSlotGrid}>
                    <div className={styles.todaysNeedSlotCard}>
                      <h3 className={styles.todaysNeedSlotHeading}>Morning</h3>
                      <div className={styles.todaysNeedSlotTotal}>
                        {formatLitresAmount(todaysNeedReport.morning.totalLitres)} L
                      </div>
                      {renderNeedLines(todaysNeedReport.morning.lines)}
                      <button
                        type="button"
                        className={styles.todaysNeedRouteActionBtn}
                        onClick={() => {
                          setRoutePlannerSlot('morning');
                          setRouteCheckPopupOpen(true);
                        }}
                      >
                        Check route and start delivering
                      </button>
                    </div>
                    <div className={`${styles.todaysNeedSlotCard} ${styles.todaysNeedSlotCardEvening}`}>
                      <h3 className={styles.todaysNeedSlotHeading}>Evening</h3>
                      <div className={styles.todaysNeedSlotTotal}>
                        {formatLitresAmount(todaysNeedReport.evening.totalLitres)} L
                      </div>
                      {renderNeedLines(todaysNeedReport.evening.lines)}
                      <button
                        type="button"
                        className={styles.todaysNeedRouteActionBtn}
                        onClick={() => {
                          setRoutePlannerSlot('evening');
                          setRouteCheckPopupOpen(true);
                        }}
                      >
                        Check route and start delivering
                      </button>
                    </div>
                  </div>

                  {todaysNeedReport.unknown.lines.length > 0 ? (
                    <div className={styles.todaysNeedUnknown}>
                      <h4 className={styles.todaysNeedUnknownTitle}>Unknown slot</h4>
                      <p className={styles.todaysNeedMeta}>
                        {formatLitresAmount(todaysNeedReport.unknown.totalLitres)} L — assign a delivery time on the
                        subscription
                      </p>
                      {renderNeedLines(todaysNeedReport.unknown.lines)}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {routeCheckPopupOpen
        ? createPortal(
            <div
              className={styles.routePopupBackdrop}
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setRouteCheckPopupOpen(false);
              }}
              data-lenis-prevent
            >
              <div
                className={`${styles.routePopupPanel} ${styles.routePopupPanelWide}`}
                role="dialog"
                aria-modal="true"
                aria-label="Delivery route"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <DeliveryRoutePlanner
                  slot={routePlannerSlot}
                  date={getTodayDateKeyInIST()}
                  excludeStopIds={excludedSubscriptionStopIds}
                  onClose={() => setRouteCheckPopupOpen(false)}
                />
              </div>
            </div>,
            document.body
          )
        : null}

      {/* Orders Today's Need modal */}
      {ordersNeedOpen
        ? createPortal(
            <div
              className={styles.todaysNeedBackdrop}
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOrdersNeedOpen(false);
              }}
              data-lenis-prevent
            >
              <div
                className={styles.todaysNeedPanel}
                role="dialog"
                aria-modal="true"
                aria-labelledby={ordersNeedTitleId}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className={styles.todaysNeedClose}
                  aria-label="Close"
                  onClick={() => setOrdersNeedOpen(false)}
                >
                  ×
                </button>
                <div className={styles.todaysNeedInner}>
                  <h2 id={ordersNeedTitleId} className={styles.todaysNeedTitle}>
                    Today&apos;s need
                  </h2>
                  <p className={styles.todaysNeedMeta}>
                    {formatDateDDMMYYYYIST(getTodayLocalYmd())} · out-for-delivery orders ready to route
                  </p>

                  <div className={styles.ordersNeedIconWrap} aria-hidden="true">
                    <svg
                      viewBox="0 0 1024 1024"
                      className={styles.ordersNeedIcon}
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M786 279l-48-13 48-13 13-48 13 48 49 13-49 13-13 49-13-49zM834 332l-19-4 19-5 4-19 5 19 19 5-19 4-5 19-4-19z" fill="#c2ffce" />
                      <path d="M159 715l-21-5 21-5 5-21 5 21 21 5-21 5-5 21-5-21z" fill="#c2ffce" />
                      <path d="M244 247m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0Z" fill="#000000" />
                      <path d="M288 821l-27-6 27-7 6-27 7 27 27 7-27 6-7 27-6-27z" fill="#c2ffce" />
                      <path d="M832 828a25 25 0 1 1 25-25 25 25 0 0 1-25 25z m0-36a10 10 0 1 0 10 10 10 10 0 0 0-10-10z" fill="#000000" />
                      <path d="M627 502l-10-17 11-7V287l-22 14a95 95 0 0 1 3 24c0 28-19 64-58 108 21 7 34 19 34 34s-31 40-71 40-71-17-71-40 13-27 34-34l-25-30-40 26v180h2l11-7 11 17-17 10h-7v112l216-102V501z m-135 83l-16 10-8 5-8 5h-1l-5-9-5-8 9-5 24-15 10 17z m56-35l-33 20-10-17 33-20 10 17z m56-35l-33 20-10-17 17-10 16-10 10 17zM188 640l204 99V427L188 296z m162-74l32 22-11 16-32-22z m-57-31l4-5 8 6 23 16-11 16-15-11-8-6-8-6z m-42-45a29 29 0 1 1-29 29 29 29 0 0 1 30-29zM648 477l12 6-9 18-3-2v141l217 95V428L648 285z m176 68a29 29 0 1 1-29 29 29 29 0 0 1 29-29z m-72-15l36 19-9 18-36-18z m-69-23l5-10 9 4 9 4 18 9-9 18-27-14-9-4z" fill="#c2ffce" />
                      <path d="M640 256l-41 27a95 95 0 0 0-181 43c0 17 7 38 22 61l-37 24-235-151v392l236 115 233-110 248 108V417z m-202 69a75 75 0 0 1 151 0c0 33-40 81-75 118-62-63-76-99-76-118z m97 124c18 4 29 12 29 18s-20 20-51 20-51-12-51-20 11-14 29-18l15 15 7 7 7-7zM392 739l-204-99V296l204 131z m20 2V630h7l17-10-11-17-11 7h-2V429l40-26 25 30c-21 7-34 19-34 34s31 40 71 40 71-17 71-40-13-27-34-34c39-44 58-80 58-108a95 95 0 0 0-3-24l22-14v190l-11 7 10 17h1v138z m453-6l-217-95V499l3 2 9-18-12-6V285l217 143z" fill="#000000" />
                      <path d="M286 546l8 5 8 6 15 11 12-17-24-16-8-6-4 5-7 12zM371 604l11-16-32-22-11 16 32 22zM481 568l-24 15-9 5 1 1h-1l5 8 5 9v-1l1 1 8-5 9-5h-1l17-11-11-17zM537 534l-33 20 11 17 33-20-10-17h-1zM594 499l-16 10-17 10 10 17 33-20-10-17zM679 515l9 4 27 14 9-17v-1l-18-9-9-4-9-5-5 10-4 8zM779 566l9-18-36-18-9 17v1l36 18z" fill="#000000" />
                      <path d="M824 585a11 11 0 1 0-11-11 11 11 0 0 0 11 11z" fill="#009e20" />
                      <path d="M824 603a29 29 0 1 0-29-29 29 29 0 0 0 29 29z m0-40a11 11 0 1 1-11 11 11 11 0 0 1 11-11z" fill="#000000" />
                      <path d="M252 530a11 11 0 1 0-11-11 11 11 0 0 0 11 11z" fill="#FFFFFF" />
                      <path d="M252 548a29 29 0 1 0-29-29 29 29 0 0 0 29 29z m0-40a11 11 0 1 1-11 11 11 11 0 0 1 11-11z" fill="#000000" />
                      <path d="M507 465l-15-15c-18 4-29 12-29 18s20 20 51 20 51-12 51-20-11-14-29-18l-15 15-7 7z" fill="#AFBCF3" />
                      <path d="M514 444c36-37 75-85 75-118a75 75 0 0 0-151 0c0 18 14 54 76 118z m-35-117a35 35 0 1 1 35 35 35 35 0 0 1-35-35z" fill="#009e20" />
                      <path d="M514 327m-35 0a35 35 0 1 0 70 0 35 35 0 1 0-70 0Z" fill="#FFFFFF" />
                    </svg>
                  </div>

                  <div className={styles.todaysNeedSummaryCard}>
                    <div className={styles.todaysNeedTotalRow}>
                      <span className={styles.todaysNeedTotalLabel}>Routable orders</span>
                      <span className={styles.todaysNeedTotalValue}>
                        {ordersRefreshing || ordersStopsCount === null ? '…' : ordersStopsCount}
                      </span>
                      <span className={styles.todaysNeedTotalUnit}>orders</span>
                    </div>
                    <p className={styles.todaysNeedMeta}>
                      Out for delivery orders with a saved delivery location (orders without coordinates are skipped)
                    </p>
                  </div>

                  <button
                    type="button"
                    className={styles.todaysNeedRouteActionBtn}
                    disabled={ordersRefreshing}
                    onClick={() => {
                      setOrdersNeedOpen(false);
                      setOrdersRouteNonce((n) => n + 1);  // force fresh remount of route planner
                      setOrdersRoutePopupOpen(true);
                    }}
                  >
                    Check route and start delivering
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {/* Orders route planner popup */}
      {ordersRoutePopupOpen
        ? createPortal(
            <div
              className={styles.routePopupBackdrop}
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOrdersRoutePopupOpen(false);
              }}
              data-lenis-prevent
            >
              <div
                className={`${styles.routePopupPanel} ${styles.routePopupPanelWide}`}
                role="dialog"
                aria-modal="true"
                aria-label="Order delivery route"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <DeliveryRoutePlanner
                  key={ordersRouteNonce}
                  slot="morning"
                  date={getTodayLocalYmd()}
                  mode="orders"
                  onClose={() => {
                    setOrdersRoutePopupOpen(false);
                    // Refresh order list after deliveries may have been marked
                    void fetchOrderDeliveries();
                  }}
                />
              </div>
            </div>,
            document.body
          )
        : null}

      {/* Order details modal */}
      {selectedOrderId && (
        <div
          className={styles.orderModalBackdrop}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedOrderId(null);
              setSelectedOrder(null);
              setConfirmAction(null);
              setLocationModalOpen(false);
            }
          }}
          data-lenis-prevent
        >
          <div
            className={styles.orderModalPanel}
            role="dialog"
            aria-modal="true"
            aria-label="Order details"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.orderModalClose}
              onClick={() => {
                setSelectedOrderId(null);
                setSelectedOrder(null);
                setConfirmAction(null);
                setLocationModalOpen(false);
              }}
              aria-label="Close"
            >
              ×
            </button>

            {detailsLoading ? (
              <div className={styles.orderModalLoading}>
                <LoadingSpinner />
              </div>
            ) : selectedOrder ? (
              <div className={styles.orderModalInner}>
                <h2 className={styles.orderModalTitle}>
                  <span className={styles.orderModalTitleText}>Order #{selectedOrder.orderNumber}</span>
                  <CopyOrderNumberButton orderNumber={selectedOrder.orderNumber} showToast={showToast} />
                </h2>
                <div className={styles.orderModalSubtitle}>{formatDateTimeIST(selectedOrder.createdAt)}</div>

                <div className={styles.orderModalGrid}>
                  <div className={styles.orderModalInfoCard}>
                    <div className={styles.orderModalInfoHeading}>Customer</div>
                    <div className={styles.orderModalInfoStrong}>{selectedOrder.customer.name || '—'}</div>
                    <div className={styles.orderModalInfoMuted}>{selectedOrder.customer.email || ''}</div>
                  </div>
                  <div className={styles.orderModalInfoCard}>
                    <div className={styles.orderModalInfoHeading}>Delivery Address</div>
                    {selectedOrder.deliveryAddress ? (
                      <div className={styles.orderModalAddress}>
                        <div>{selectedOrder.deliveryAddress.name || ''}</div>
                        <div>{selectedOrder.deliveryAddress.street || ''}</div>
                        <div>
                          {[selectedOrder.deliveryAddress.city, selectedOrder.deliveryAddress.state, selectedOrder.deliveryAddress.postalCode]
                            .filter(Boolean)
                            .join(', ')}
                        </div>
                        {selectedOrder.deliveryAddress.phone ? <div>Phone: {selectedOrder.deliveryAddress.phone}</div> : null}
                        {hasValidLocation(selectedOrder.deliveryAddress) ? (
                          <button
                            type="button"
                            className={styles.locationLinkButton}
                            onClick={() => setLocationModalOpen(true)}
                          >
                            See customer&apos;s location
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <div className={styles.orderModalInfoMuted}>—</div>
                    )}
                  </div>
                </div>

                <div className={styles.orderModalItemsSection}>
                  <div className={styles.orderModalItemsHeading}>Items ({selectedOrder.items.length})</div>
                  {selectedOrder.items.map((it, idx) => (
                    <div key={idx} className={styles.orderModalItemRow}>
                      <div className={styles.orderModalItemThumb}>
                        {it.imageUrl ? <img src={it.imageUrl} alt="" className={styles.orderModalItemImg} /> : null}
                      </div>
                      <div className={styles.orderModalItemMain}>
                        <div className={styles.orderModalItemName}>{it.productName}</div>
                        <div className={styles.orderModalItemMeta}>
                          Qty: {it.quantity}
                          {it.variationSize ? ` • ${it.variationSize}` : ''}
                        </div>
                      </div>
                      <div className={styles.orderModalItemPrice}>₹{it.lineTotal.toFixed(2)}</div>
                    </div>
                  ))}
                </div>

                <div className={styles.orderModalSummary}>
                  <div className={styles.orderModalSummaryRow}>
                    <span>Subtotal</span>
                    <span>₹{(selectedOrder.subtotal ?? 0).toFixed(2)}</span>
                  </div>
                  {(selectedOrder.discount ?? 0) > 0 ? (
                    <div className={`${styles.orderModalSummaryRow} ${styles.orderModalSummaryDiscount}`}>
                      <span>Discount</span>
                      <span>-₹{selectedOrder.discount.toFixed(2)}</span>
                    </div>
                  ) : null}
                  <div className={styles.orderModalSummaryRow}>
                    <span>Platform fee</span>
                    <span>₹{(selectedOrder.platformFee ?? 0).toFixed(2)}</span>
                  </div>
                  <div className={styles.orderModalSummaryRow}>
                    <span>Delivery charges</span>
                    <span>
                      {(selectedOrder.deliveryCharges ?? 0) === 0
                        ? 'FREE'
                        : `₹${selectedOrder.deliveryCharges.toFixed(2)}`}
                    </span>
                  </div>
                  <div className={styles.orderModalSummaryTotal}>
                    <span>Order total</span>
                    <span>₹{(selectedOrder.total ?? 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className={styles.orderModalActions}>
                  {selectedOrder.status === 'package_prepared' && (
                    <button type="button" onClick={() => setConfirmAction({ kind: 'out' })} className={styles.orderModalBtnPrimary}>
                      Out for delivery
                    </button>
                  )}

                  {selectedOrder.status === 'out_for_delivery' && (
                    <button type="button" onClick={() => setConfirmAction({ kind: 'deliver' })} className={styles.orderModalBtnSuccess}>
                      Mark as delivered
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <AdminOrderMapLocationModal
        open={locationModalOpen && hasValidLocation(selectedOrder?.deliveryAddress)}
        onClose={() => setLocationModalOpen(false)}
        initialLatitude={selectedOrder?.deliveryAddress?.latitude}
        initialLongitude={selectedOrder?.deliveryAddress?.longitude}
        onConfirm={() => {}}
        mode="view"
        title="Customer's live location"
        hint="This map uses the latitude and longitude saved with this delivery order."
        confirmLabel="Close"
      />

      {confirmAction && (
        <div
          className={styles.confirmModalBackdrop}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !confirmBusy) setConfirmAction(null);
          }}
          data-lenis-prevent
        >
          <div className={styles.confirmModalPanel} role="alertdialog" onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.confirmModalTitle}>Confirm</div>
            <div className={styles.confirmModalText}>
              {confirmAction.kind === 'subscriptionDeliver' && 'Mark this subscription delivery as delivered?'}
              {confirmAction.kind === 'out' && 'Mark this order as out for delivery?'}
              {confirmAction.kind === 'deliver' && 'Mark this order as delivered?'}
              {confirmAction.kind === 'fulfill' && 'Mark this order as fulfilled? (COD will be set to Paid)'}
            </div>
            <div className={styles.confirmModalActions}>
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className={styles.confirmModalBtnCancel}
                disabled={confirmBusy}
              >
                {confirmAction.kind === 'subscriptionDeliver' ? 'No' : 'Cancel'}
              </button>
              <button type="button" onClick={executeConfirm} className={styles.confirmModalBtnOk} disabled={confirmBusy}>
                {confirmBusy ? 'Please wait…' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomSelect<T extends string>({
  value,
  onChange,
  options,
  modalTitle,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string }>;
  modalTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const modalTitleId = useId();

  const selected = options.find((o) => o.value === value) || options[0];
  const useModal = isNarrow;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open || useModal) return;
    const onDocClick = (e: Event) => {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, useModal]);

  useEffect(() => {
    if (!open || !useModal) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverscrollY = html.style.overscrollBehaviorY;
    const prevBodyOverscrollY = body.style.overscrollBehaviorY;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehaviorY = 'none';
    body.style.overscrollBehaviorY = 'none';
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.overscrollBehaviorY = prevHtmlOverscrollY;
      body.style.overscrollBehaviorY = prevBodyOverscrollY;
    };
  }, [open, useModal]);

  const optionList = options.map((opt) => {
    const isActive = opt.value === value;
    return (
      <button
        key={opt.value}
        type="button"
        role="option"
        aria-selected={isActive}
        className={`${styles.dropdownItem} ${isActive ? styles.dropdownItemActive : ''}`}
        onClick={() => {
          onChange(opt.value);
          setOpen(false);
        }}
      >
        <span>{opt.label}</span>
        {isActive ? <span className={styles.dropdownHint}>Selected</span> : null}
      </button>
    );
  });

  return (
    <div className={styles.selectWrap} ref={ref}>
      <button type="button" className={styles.selectButton} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className={styles.selectValue}>{selected?.label}</span>
        <span className={styles.selectChevron} aria-hidden="true">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5.5 7.5L10 12l4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && !useModal && (
        <div className={styles.dropdown} role="listbox" aria-label={modalTitle}>
          {optionList}
        </div>
      )}

      {mounted && open && useModal
        ? createPortal(
            <div
              className={styles.selectModalBackdrop}
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
              data-lenis-prevent
            >
              <div
                className={styles.selectModalPanel}
                role="dialog"
                aria-modal="true"
                aria-labelledby={modalTitleId}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className={styles.selectModalHeader}>
                  <h2 id={modalTitleId} className={styles.selectModalTitle}>
                    {modalTitle}
                  </h2>
                  <button type="button" className={styles.selectModalClose} aria-label="Close" onClick={() => setOpen(false)}>
                    ×
                  </button>
                </div>
                <div className={styles.selectModalBody} role="listbox" aria-label={modalTitle}>
                  {optionList}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
