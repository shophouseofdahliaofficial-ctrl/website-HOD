'use client';

import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { adminProductsApi, apiClient } from '@/lib/api';
import AdminCreateOrderModal from '@/components/admin/AdminCreateOrderModal';
import type { Product } from '@/types';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import styles from './page.module.css';
import { useToast } from '@/contexts/ToastContext';
import { formatDateTimeIST } from '@/lib/utils/datetime';
import { normalizeAdminListSearchQuery } from '@/lib/utils/searchQuery';

type OrderItem = {
  productName: string;
  variationSize: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  productId: number | null;
  imageUrl: string | null;
  generatedPdfUrl?: string | null;
  customizations?: Record<string, any> | null;
  giftWrap?: {
    comment?: string;
    price?: number;
  } | null;
};

type AdminOrder = {
  orderId: string;
  orderNumber: string;
  orderedAt: string | null;
  customerName: string | null;
  customerEmail: string | null;
  amount: number | null;
  currency: string;
  paymentMethod?: string;
  paymentStatus: 'captured' | 'pending' | 'failed' | 'refunded' | string;
  itemsCount: number;
  deliveryStatus: 'pending' | 'package_prepared' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'refunded' | string;
  fulfilledAt?: string | null;
  isNationwideDelivery?: boolean;
};

type OrderDetails = {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  currency: string;
  subtotal: number;
  discount: number;
  deliveryCharges: number;
  total: number;
  deliveryAddress: {
    name?: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    phone?: string;
    latitude?: number;
    longitude?: number;
  } | null;
  createdAt: string;
  deliveryDate: string | null;
  customer: {
    name: string;
    email: string;
  };
  items: OrderItem[];
  isNationwideDelivery?: boolean;
};

const DELIVERY_FILTER_VALUES = [
  'all',
  'pending',
  'package_prepared',
  'shipped',
  'in_transit',
  'reached_destination_hub',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'refunded',
] as const;

type DeliveryFilter = (typeof DELIVERY_FILTER_VALUES)[number];

const DELIVERY_OPTIONS: Array<{ value: DeliveryFilter; label: string }> = [
  { value: 'all', label: 'All delivery statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'package_prepared', label: 'Package prepared' },
  { value: 'shipped', label: 'Shipped (Nationwide)' },
  { value: 'in_transit', label: 'In Transit (Nationwide)' },
  { value: 'reached_destination_hub', label: 'Destination Hub (Nationwide)' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];

type SortKey = 'orderedDesc' | 'orderedAsc' | 'amountDesc' | 'amountAsc' | 'orderNumAsc';

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'orderedDesc', label: 'Sort: Newest first' },
  { value: 'orderedAsc', label: 'Sort: Oldest first' },
  { value: 'amountDesc', label: 'Sort: Amount (high → low)' },
  { value: 'amountAsc', label: 'Sort: Amount (low → high)' },
  { value: 'orderNumAsc', label: 'Sort: Order # (A → Z)' },
];

function formatDeliveryLabel(status: string) {
  if (!status) return 'pending';
  return status.replace(/_/g, ' ');
}

function orderedAtMs(o: AdminOrder) {
  if (!o.orderedAt) return 0;
  const t = new Date(o.orderedAt).getTime();
  return Number.isNaN(t) ? 0 : t;
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

function PaymentCell({ o }: { o: AdminOrder }) {
  const isCod = String(o.paymentMethod || '').toLowerCase() === 'cod';
  const paid =
    o.paymentStatus === 'captured' || String(o.paymentStatus || '').toLowerCase() === 'paid';

  if (isCod) {
    const codPaid = String(o.paymentStatus || '').toLowerCase() === 'paid';
    return (
      <div className={styles.badgeStack}>
        <span className={`${styles.badge} ${codPaid ? styles.badgeSuccess : styles.badgeWarning}`}>COD</span>
        <span className={styles.badgeSub}>{codPaid ? 'Paid' : 'Pending'}</span>
      </div>
    );
  }

  return (
    <span className={`${styles.badge} ${paid ? styles.badgeSuccess : styles.badgeDanger}`}>
      {paid ? 'Paid' : o.paymentStatus}
    </span>
  );
}

/**
 * Admin Orders Page
 * Shows paid orders only (captured payments).
 */
export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [query, setQuery] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>('all');
  const [sort, setSort] = useState<SortKey>('orderedDesc');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [filterSheetView, setFilterSheetView] = useState<'menu' | 'delivery' | 'sort'>('menu');
  const [filterSheetMounted, setFilterSheetMounted] = useState(false);
  const filterSheetMenuTitleId = useId();
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [activeProducts, setActiveProducts] = useState<Product[]>([]);
  const { showToast } = useToast();

  const fetchOrders = async () => {
    try {
      const data = await apiClient.get<AdminOrder[]>('/api/admin/orders');
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setOrders([]);
      showToast((error as { message?: string })?.message || 'Failed to fetch orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast]);

  useEffect(() => {
    if (!createOrderOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await adminProductsApi.getAll();
        if (!cancelled) setActiveProducts(data.filter((p) => p.isActive));
      } catch {
        if (!cancelled) setActiveProducts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createOrderOpen]);

  useEffect(() => setFilterSheetMounted(true), []);

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

  // Block Android Chrome pull-to-refresh while modals are open, without body position:fixed (avoids overlay glitches).
  useEffect(() => {
    if (!showModal && !showConfirmation && !filterSheetOpen && !createOrderOpen) return;

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
  }, [showModal, showConfirmation, filterSheetOpen, createOrderOpen]);

  const filtered = useMemo(() => {
    const q = normalizeAdminListSearchQuery(query);
    let list = orders.filter((o) => {
      if (deliveryFilter !== 'all' && o.deliveryStatus !== deliveryFilter) return false;
      if (!q) return true;
      const hay = `${o.orderNumber} ${o.orderId} ${o.customerName || ''} ${o.customerEmail || ''}`.toLowerCase();
      return hay.includes(q);
    });

    list = [...list].sort((a, b) => {
      if (sort === 'orderedDesc') return orderedAtMs(b) - orderedAtMs(a);
      if (sort === 'orderedAsc') return orderedAtMs(a) - orderedAtMs(b);
      if (sort === 'amountDesc') {
        const av = a.amount ?? -Infinity;
        const bv = b.amount ?? -Infinity;
        return bv - av;
      }
      if (sort === 'amountAsc') {
        const av = a.amount ?? Infinity;
        const bv = b.amount ?? Infinity;
        return av - bv;
      }
      return String(a.orderNumber).localeCompare(String(b.orderNumber), undefined, { numeric: true });
    });

    return list;
  }, [orders, query, deliveryFilter, sort]);

  const handleOrderClick = async (orderId: string) => {
    setLoadingDetails(true);
    setShowModal(true);
    try {
      const data = await apiClient.get<OrderDetails>(`/api/admin/orders/${orderId}`);
      setSelectedOrder(data);
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      showToast('Failed to load order details', 'error');
      setShowModal(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedOrder(null);
  };

  const closeFilterSheet = () => {
    setFilterSheetOpen(false);
    setFilterSheetView('menu');
  };

  const deliveryFilterLabel = DELIVERY_OPTIONS.find((o) => o.value === deliveryFilter)?.label ?? '';
  const sortFilterLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? '';

  const handleMarkAsPackagePrepared = async () => {
    if (!selectedOrder) return;
    try {
      await apiClient.post(`/api/admin/orders/${selectedOrder.id}/mark-package-prepared`);
      showToast('Order marked as package prepared successfully', 'success');
      setShowConfirmation(false);
      setShowModal(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (error) {
      console.error('Failed to mark order:', error);
      showToast('Failed to update order status', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', padding: '2rem' }}>
        <LoadingSpinnerWithText text="Loading orders..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerBlock}>
        <div className={styles.headerBlockMain}>
          <h1 className={adminStyles.adminPageTitle}>Orders</h1>
          <p className={styles.subtitle}>
            Showing paid orders only
            {orders.length > 0 && (
              <>
                {' · '}
                {filtered.length} of {orders.length} shown
              </>
            )}
          </p>
        </div>
        <button type="button" className={styles.createOrderTrigger} onClick={() => setCreateOrderOpen(true)}>
          Create order
        </button>
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
              className={styles.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search order #, customer…"
              aria-label="Search orders"
            />
          </div>
        </div>

        <div className={styles.toolbarDesktopFilters}>
          <CustomSelect<DeliveryFilter>
            value={deliveryFilter}
            onChange={setDeliveryFilter}
            modalTitle="Delivery status"
            options={DELIVERY_OPTIONS}
          />
          <CustomSelect<SortKey> value={sort} onChange={setSort} modalTitle="Sort" options={SORT_OPTIONS} />
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
                    <button
                      type="button"
                      className={styles.filterSheetMenuRow}
                      onClick={() => setFilterSheetView('delivery')}
                    >
                      <span className={styles.filterSheetMenuLabel}>Delivery status</span>
                      <span className={styles.filterSheetMenuValue}>{deliveryFilterLabel}</span>
                      <span className={styles.filterSheetMenuChevron} aria-hidden>
                        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M7.5 5L12.5 10L7.5 15" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </button>
                    <button type="button" className={styles.filterSheetMenuRow} onClick={() => setFilterSheetView('sort')}>
                      <span className={styles.filterSheetMenuLabel}>Sort</span>
                      <span className={styles.filterSheetMenuValue}>{sortFilterLabel}</span>
                      <span className={styles.filterSheetMenuChevron} aria-hidden>
                        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M7.5 5L12.5 10L7.5 15" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </button>
                  </div>
                </>
              ) : null}

              {filterSheetView === 'delivery' ? (
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
                    <h2 className={styles.filterSheetSubTitle}>Delivery status</h2>
                  </div>
                  <div className={styles.filterSheetOptions} role="listbox" aria-label="Delivery status">
                    {DELIVERY_OPTIONS.map((opt) => {
                      const active = opt.value === deliveryFilter;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={`${styles.filterSheetOption} ${active ? styles.filterSheetOptionActive : ''}`}
                          onClick={() => {
                            setDeliveryFilter(opt.value);
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
                    {SORT_OPTIONS.map((opt) => {
                      const active = opt.value === sort;
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

      <div className={styles.panel}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th className={styles.th}>Order#</th>
              <th className={styles.th}>Date ordered</th>
              <th className={styles.th}>Customer</th>
              <th className={styles.th}>Amount</th>
              <th className={styles.th}>Payment status</th>
              <th className={styles.th}>Items</th>
              <th className={styles.th}>Delivery status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => {
              const isFulfilled = o.deliveryStatus === 'delivered' && o.fulfilledAt;
              return (
                <tr
                  key={o.orderId}
                  role="button"
                  tabIndex={0}
                  className={`${styles.row} ${isFulfilled ? styles.rowFulfilled : ''}`}
                  onClick={() => handleOrderClick(o.orderId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOrderClick(o.orderId);
                    }
                  }}
                >
                  <td className={styles.td}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                      <span className={styles.orderNumRow}>
                        <span className={styles.orderNum}>#{o.orderNumber}</span>
                        <CopyOrderNumberButton orderNumber={o.orderNumber} showToast={showToast} />
                      </span>
                      {o.isNationwideDelivery && (
                        <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.35rem', backgroundColor: 'rgb(67, 56, 202)', color: 'white', borderRadius: '4px', border: '1px solid rgb(67, 56, 202)', whiteSpace: 'nowrap' }}>
                          Nation-wide Delivery
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={styles.td}>{formatDateTimeIST(o.orderedAt)}</td>
                  <td className={styles.td}>
                    <div className={styles.customerName}>{o.customerName || '—'}</div>
                    {o.customerEmail ? <div className={styles.customerEmail}>{o.customerEmail}</div> : null}
                  </td>
                  <td className={styles.td}>
                    <span className={styles.amount}>{o.amount === null ? '—' : `₹${o.amount.toFixed(2)}`}</span>
                  </td>
                  <td className={styles.td}>
                    <PaymentCell o={o} />
                  </td>
                  <td className={styles.td}>
                    <span className={styles.itemsCount}>{o.itemsCount}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.deliveryStatus}>{formatDeliveryLabel(String(o.deliveryStatus || 'pending'))}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className={styles.emptyState}>
            {orders.length === 0 ? 'No paid orders found.' : 'No orders match your filters.'}
          </div>
        )}
      </div>

      <div className={styles.cards}>
        {filtered.length === 0 ? (
          <div className={styles.card} style={{ cursor: 'default' }}>
            <div className={styles.emptyState} style={{ padding: '1rem' }}>
              {orders.length === 0 ? 'No paid orders found.' : 'No orders match your filters.'}
            </div>
          </div>
        ) : (
          filtered.map((o) => {
            const isFulfilled = o.deliveryStatus === 'delivered' && o.fulfilledAt;
            return (
              <div
                key={o.orderId}
                role="button"
                tabIndex={0}
                className={`${styles.card} ${isFulfilled ? styles.cardFulfilled : ''}`}
                onClick={() => handleOrderClick(o.orderId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOrderClick(o.orderId);
                  }
                }}
                aria-label={`Open order ${o.orderNumber}`}
              >
                <div className={styles.cardTop}>
                  <div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                      <div className={styles.cardTitleRow}>
                        <span className={styles.cardTitle}>#{o.orderNumber}</span>
                        <CopyOrderNumberButton orderNumber={o.orderNumber} showToast={showToast} />
                      </div>
                      {o.isNationwideDelivery && (
                        <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.35rem', backgroundColor: 'rgb(67, 56, 202)', color: 'white', borderRadius: '4px', border: '1px solid rgb(67, 56, 202)', whiteSpace: 'nowrap' }}>
                          Nation-wide Delivery
                        </span>
                      )}
                    </div>
                    <div className={styles.cardDate}>{formatDateTimeIST(o.orderedAt)}</div>
                  </div>
                  <div className={styles.cardBadges}>
                    <PaymentCell o={o} />
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <div className={`${styles.kv} ${styles.kvWide}`}>
                    <div className={styles.kvLabel}>CUSTOMER</div>
                    <div className={styles.kvValue}>{o.customerName || '—'}</div>
                    {o.customerEmail ? <div className={styles.customerEmail}>{o.customerEmail}</div> : null}
                  </div>
                  <div className={styles.kv}>
                    <div className={styles.kvLabel}>AMOUNT</div>
                    <div className={styles.kvValue}>{o.amount === null ? '—' : `₹${o.amount.toFixed(2)}`}</div>
                  </div>
                  <div className={styles.kv}>
                    <div className={styles.kvLabel}>ITEMS</div>
                    <div className={styles.kvValue}>{o.itemsCount}</div>
                  </div>
                  <div className={`${styles.kv} ${styles.kvWide}`}>
                    <div className={styles.kvLabel}>DELIVERY</div>
                    <div className={styles.kvValue}>{formatDeliveryLabel(String(o.deliveryStatus || 'pending'))}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onWheel={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          data-lenis-prevent
        >
          <div className={styles.modalPanel} onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" className={styles.modalClose} onClick={closeModal} aria-label="Close">
              ×
            </button>

            {loadingDetails ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <LoadingSpinnerWithText text="Loading order details..." />
              </div>
            ) : selectedOrder ? (
              <div className={styles.modalBody}>
                <h2 className={styles.modalTitle}>
                  <span className={styles.modalTitleText}>Order #{selectedOrder.orderNumber}</span>
                  <CopyOrderNumberButton orderNumber={selectedOrder.orderNumber} showToast={showToast} />
                  {selectedOrder.isNationwideDelivery && (
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', backgroundColor: '#eef2ff', color: '#4338ca', borderRadius: '4px', border: '1px solid #c7d2fe', marginLeft: '0.75rem', verticalAlign: 'middle', fontWeight: 600 }}>
                      Nation-wide Delivery
                    </span>
                  )}
                </h2>
                <p className={styles.modalMeta}>{formatDateTimeIST(selectedOrder.createdAt)}</p>

                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Customer Information</h3>
                  <div className={styles.infoBox}>
                    <p style={{ fontWeight: 600 }}>{selectedOrder.customer.name}</p>
                    <p style={{ color: '#666' }}>{selectedOrder.customer.email}</p>
                  </div>
                </section>

                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Delivery Address</h3>
                  <div className={styles.infoBox}>
                    {selectedOrder.deliveryAddress ? (
                      <>
                        <p>{selectedOrder.deliveryAddress.name || ''}</p>
                        <p>{selectedOrder.deliveryAddress.street || ''}</p>
                        <p>
                          {[selectedOrder.deliveryAddress.city, selectedOrder.deliveryAddress.state, selectedOrder.deliveryAddress.postalCode]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                        {selectedOrder.deliveryAddress.phone ? <p>Phone: {selectedOrder.deliveryAddress.phone}</p> : null}
                        {typeof selectedOrder.deliveryAddress.latitude === 'number' &&
                          typeof selectedOrder.deliveryAddress.longitude === 'number' ? (
                          <p style={{ margin: '0.35rem 0 0' }}>
                            <a
                              href={`https://www.google.com/maps?q=${selectedOrder.deliveryAddress.latitude},${selectedOrder.deliveryAddress.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.mapLink}
                            >
                              Open exact location on map
                            </a>
                          </p>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </section>

                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Order Items ({selectedOrder.items.length})</h3>
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className={styles.orderItem}>
                      <div className={styles.orderItemThumb}>
                        {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
                      </div>
                      <div className={styles.orderItemMain}>
                        <p className={styles.orderItemName}>{item.productName}</p>
                        {item.variationSize ? <p className={styles.orderItemMeta}>{item.variationSize}</p> : null}
                        <p className={styles.orderItemQty}>
                          Qty: {item.quantity} × ₹{item.unitPrice.toFixed(2)}
                        </p>
                        {(() => {
                          const gw = item.giftWrap || item.customizations?.giftWrap;
                          if (!gw) return null;
                          return (
                            <div className={styles.giftWrapBadge}>
                              <div className={styles.giftWrapTag}>
                                <span className={styles.giftWrapIcon}>🎁</span>
                                <span>Premium Gift Wrap {gw.price ? `(+₹${gw.price})` : ''}</span>
                              </div>
                              {gw.comment ? (
                                <div className={styles.giftWrapCommentBox}>
                                  <span className={styles.giftWrapCommentLabel}>Gift Message / Note:</span>
                                  <p className={styles.giftWrapCommentText}>&ldquo;{gw.comment}&rdquo;</p>
                                </div>
                              ) : null}
                            </div>
                          );
                        })()}
                        {item.generatedPdfUrl && (
                          <div className={styles.downloadWrapper}>
                            <a
                              href={item.generatedPdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.pdfDownloadBtn}
                              title="Download high-resolution print PDF"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ marginRight: '6px' }}
                              >
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                              Download Print-ready PDF
                            </a>
                            <a
                              href={item.generatedPdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.pdfUrlLink}
                              title="Open Bunny CDN print PDF"
                            >
                              {item.generatedPdfUrl}
                            </a>
                          </div>
                        )}
                      </div>
                      <div className={styles.orderItemTotal}>₹{item.lineTotal.toFixed(2)}</div>
                    </div>
                  ))}
                </section>

                <section className={styles.section}>
                  <div className={styles.summary}>
                    <div className={styles.summaryRow}>
                      <span>Subtotal:</span>
                      <span>₹{selectedOrder.subtotal.toFixed(2)}</span>
                    </div>
                    {selectedOrder.discount > 0 ? (
                      <div className={`${styles.summaryRow} ${styles.summaryDiscount}`}>
                        <span>Discount:</span>
                        <span>-₹{selectedOrder.discount.toFixed(2)}</span>
                      </div>
                    ) : null}
                    <div className={styles.summaryRow}>
                      <span>Delivery Charges:</span>
                      <span>{selectedOrder.deliveryCharges === 0 ? 'FREE' : `₹${selectedOrder.deliveryCharges.toFixed(2)}`}</span>
                    </div>
                    <div className={styles.summaryTotal}>
                      <span>Total:</span>
                      <span>₹{selectedOrder.total.toFixed(2)}</span>
                    </div>
                  </div>
                </section>

                {selectedOrder.status === 'placed' ? (
                  <div className={styles.actionRow}>
                    <button type="button" className={styles.primaryBtn} onClick={() => setShowConfirmation(true)}>
                      Mark as Package Prepared
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {showConfirmation && (
        <div
          className={styles.confirmBackdrop}
          role="presentation"
          onWheel={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowConfirmation(false);
          }}
          data-lenis-prevent
        >
          <div className={styles.confirmPanel} onMouseDown={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>Confirm Action</h3>
            <p className={styles.confirmText}>
              Are you sure you want to mark this order as package prepared? This will create a delivery entry and update the customer&apos;s order
              timeline.
            </p>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setShowConfirmation(false)}>
                Cancel
              </button>
              <button type="button" className={styles.primaryBtn} onClick={handleMarkAsPackagePrepared}>
                Yes, Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {createOrderOpen ? (
        <AdminCreateOrderModal
          open={createOrderOpen}
          onClose={() => setCreateOrderOpen(false)}
          activeProducts={activeProducts}
          onCreated={() => {
            showToast('Order created for customer', 'success');
            void fetchOrders();
          }}
        />
      ) : null}
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
