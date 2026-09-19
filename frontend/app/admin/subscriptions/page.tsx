'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { adminSubscriptionsApi } from '@/lib/api';
import { Subscription } from '@/types';
import AdminOrderMapLocationModal from '@/components/admin/AdminOrderMapLocationModal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import styles from './page.module.css';
import { useToast } from '@/contexts/ToastContext';
import { formatDateDDMMYYYYIST, formatDateTimeIST, IST_TIMEZONE } from '@/lib/utils/datetime';
import { normalizeAdminListSearchQuery } from '@/lib/utils/searchQuery';
import { subscriptionProductDisplayLabel } from '@/lib/utils/productVariationDisplay';

const STATUS_OPTIONS = [
  { value: 'all' as const, label: 'All Status' },
  { value: 'active' as const, label: 'Active' },
  { value: 'paused' as const, label: 'Paused' },
  { value: 'cancelled' as const, label: 'Cancelled' },
  { value: 'expired' as const, label: 'Expired' },
];

const SORT_OPTIONS = [
  { value: 'createdDesc' as const, label: 'Newest First' },
  { value: 'productAsc' as const, label: 'Product (A-Z)' },
  { value: 'customerAsc' as const, label: 'Customer (A-Z)' },
];

function todayYmdIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function nextPendingDeliveryYmd(
  schedules: Array<{ deliveryDate: string; status: string }> | undefined,
): string | null {
  if (!schedules?.length) return null;
  const today = todayYmdIST();
  const pending = schedules
    .filter((s) => s.status === 'pending' && s.deliveryDate >= today)
    .map((s) => s.deliveryDate)
    .sort();
  return pending[0] ?? null;
}

function daysLeftUntilEndYmd(endYmd: string | null | undefined): number | null {
  if (!endYmd || !/^\d{4}-\d{2}-\d{2}$/.test(endYmd)) return null;
  const today = todayYmdIST();
  const start = new Date(today + 'T12:00:00');
  const end = new Date(endYmd + 'T12:00:00');
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function durationLabel(sub: Subscription): string {
  if (sub.durationDays != null && sub.durationDays > 0) {
    return `${sub.durationDays} day${sub.durationDays !== 1 ? 's' : ''}`;
  }
  const m = sub.durationMonths;
  return `${m} month${m !== 1 ? 's' : ''}`;
}

function getFixedSubscriptionRate(sub: Subscription): number | null {
  if (sub.perUnitPrice != null) {
    return Number(sub.perUnitPrice);
  }
  if (sub.totalAmount != null && sub.totalQty != null && sub.totalQty > 0) {
    return Number(sub.totalAmount) / Number(sub.totalQty);
  }
  return null;
}

function hasValidLocation(address: Subscription['deliveryAddress'] | null | undefined): address is NonNullable<Subscription['deliveryAddress']> {
  return Boolean(
    address &&
      typeof address.latitude === 'number' &&
      Number.isFinite(address.latitude) &&
      typeof address.longitude === 'number' &&
      Number.isFinite(address.longitude),
  );
}

/**
 * Admin Subscriptions Page
 * View and manage all subscriptions
 */
export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'cancelled' | 'expired'>('all');
  const [sort, setSort] = useState<'createdDesc' | 'productAsc' | 'customerAsc'>('createdDesc');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSub, setDetailSub] = useState<Subscription | null>(null);
  const [confirmAction, setConfirmAction] = useState<null | { kind: 'pause' | 'resume'; id: string }>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [filterSheetView, setFilterSheetView] = useState<'menu' | 'status' | 'sort'>('menu');
  const [filterSheetMounted, setFilterSheetMounted] = useState(false);
  const filterSheetMenuTitleId = useId();
  const { showToast } = useToast();

  useEffect(() => {
    fetchSubscriptions();
  }, []);

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

  useEffect(() => {
    if (!detailOpen && !confirmAction && !filterSheetOpen && !locationModalOpen) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const prevHtmlOy = html.style.overscrollBehaviorY;
    const prevBodyOy = body.style.overscrollBehaviorY;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehaviorY = 'none';
    body.style.overscrollBehaviorY = 'none';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      html.style.overscrollBehaviorY = prevHtmlOy;
      body.style.overscrollBehaviorY = prevBodyOy;
    };
  }, [detailOpen, confirmAction, filterSheetOpen, locationModalOpen]);

  const closeFilterSheet = () => {
    setFilterSheetOpen(false);
    setFilterSheetView('menu');
  };

  const statusFilterLabel = STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? '';
  const sortFilterLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? '';

  const removeRedundantPendingSubscriptions = (items: Subscription[]): Subscription[] => {
    const activeKeys = new Set(
      items
        .filter((s) => s.status === 'active')
        .map((s) => `${s.userId}::${s.productId}`),
    );
    return items.filter((s) => {
      if (s.status !== 'pending') return true;
      return !activeKeys.has(`${s.userId}::${s.productId}`);
    });
  };

  const fetchSubscriptions = async () => {
    try {
      const data = await adminSubscriptionsApi.getAll();
      setSubscriptions(removeRedundantPendingSubscriptions(data));
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
      showToast('Failed to load subscriptions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openDetailModal = async (id: string) => {
    const fromList = subscriptions.find((s) => String(s.id) === String(id)) ?? null;
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailSub(null);
    try {
      const s = await adminSubscriptionsApi.getById(id);
      setDetailSub(s);
    } catch (error) {
      console.error('Failed to load subscription:', error);
      if (fromList) {
        setDetailSub(fromList);
      } else {
        showToast('Failed to load subscription details', 'error');
        setDetailOpen(false);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetailModal = () => {
    setDetailOpen(false);
    setDetailSub(null);
    setLocationModalOpen(false);
  };

  const executePauseResume = async () => {
    if (!confirmAction) return;
    const { kind, id } = confirmAction;
    setConfirmBusy(true);
    try {
      if (kind === 'pause') {
        await adminSubscriptionsApi.pause(id);
        showToast('Subscription paused successfully', 'success');
      } else {
        await adminSubscriptionsApi.resume(id);
        showToast('Subscription resumed successfully', 'success');
      }
      setConfirmAction(null);
      await fetchSubscriptions();
      if (detailSub?.id === id) {
        try {
          const s = await adminSubscriptionsApi.getById(id);
          setDetailSub(s);
        } catch {
          /* ignore */
        }
      }
    } catch (error) {
      console.error('Failed to update subscription:', error);
      showToast(kind === 'pause' ? 'Failed to pause subscription' : 'Failed to resume subscription', 'error');
    } finally {
      setConfirmBusy(false);
    }
  };

  const filtered = useMemo(() => {
    let result = [...subscriptions];

    if (query.trim()) {
      const qNorm = normalizeAdminListSearchQuery(query);
      const qLower = query.trim().toLowerCase();
      result = result.filter(
        (sub) =>
          subscriptionProductDisplayLabel(sub).toLowerCase().includes(qLower) ||
          sub.userId.toString().includes(qNorm) ||
          String(sub.id).includes(qNorm) ||
          (sub.userName || '').toLowerCase().includes(qLower) ||
          (sub.userEmail || '').toLowerCase().includes(qLower),
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((sub) => sub.status === statusFilter);
    }

    result.sort((a, b) => {
      if (sort === 'productAsc') {
        const aName = subscriptionProductDisplayLabel(a).toLowerCase();
        const bName = subscriptionProductDisplayLabel(b).toLowerCase();
        return aName.localeCompare(bName);
      }
      if (sort === 'customerAsc') {
        const aName = (a.userName || a.userEmail || '').toLowerCase();
        const bName = (b.userName || b.userEmail || '').toLowerCase();
        return aName.localeCompare(bName);
      }
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    return result;
  }, [subscriptions, query, statusFilter, sort]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return styles.badgeActive;
      case 'paused':
        return styles.badgePaused;
      case 'cancelled':
        return styles.badgeCancelled;
      case 'expired':
        return styles.badgeExpired;
      default:
        return styles.badgePending;
    }
  };

  const detailNextYmd = detailSub ? nextPendingDeliveryYmd(detailSub.deliverySchedules) : null;
  const detailDaysLeft = detailSub ? daysLeftUntilEndYmd(detailSub.endDate) : null;

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          padding: '2rem',
        }}
      >
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={adminStyles.adminPageTitle}>Subscriptions</h1>
          <p className={styles.subtitle}>Manage customer subscriptions and delivery schedules</p>
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
              placeholder="Search product, size, customer, or subscription ID…"
              aria-label="Search subscriptions"
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.toolbarDesktopFilters}>
          <CustomSelect
            value={statusFilter}
            onChange={setStatusFilter}
            modalTitle="Status"
            options={STATUS_OPTIONS}
          />
          <CustomSelect value={sort} onChange={setSort} modalTitle="Sort" options={SORT_OPTIONS} />
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
                      <button type="button" className={styles.filterSheetMenuRow} onClick={() => setFilterSheetView('status')}>
                        <span className={styles.filterSheetMenuLabel}>Status</span>
                        <span className={styles.filterSheetMenuValue}>{statusFilterLabel}</span>
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
                      {STATUS_OPTIONS.map((opt) => {
                        const active = statusFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="option"
                            aria-selected={active}
                            className={`${styles.filterSheetOption} ${active ? styles.filterSheetOptionActive : ''}`}
                            onClick={() => {
                              setStatusFilter(opt.value);
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
            document.body,
          )
        : null}

      {filtered.length === 0 ? (
        <div className={styles.panel}>
          <div className={styles.emptyState}>
            <p>No subscriptions found</p>
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
                    <th>Product</th>
                    <th>Customer</th>
                    <th>Quantity</th>
                    <th>Duration</th>
                    <th>Rate</th>
                    <th>Total Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((subscription) => (
                    <tr
                      key={subscription.id}
                      className={styles.clickableRow}
                      onClick={() => openDetailModal(subscription.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openDetailModal(subscription.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`View subscription ${subscriptionProductDisplayLabel(subscription)}`}
                    >
                      <td>
                        <div className={styles.productCell}>{subscriptionProductDisplayLabel(subscription)}</div>
                      </td>
                      <td>
                        <div className={styles.customerCell}>
                          <div className={styles.customerName}>
                            {subscription.userName || subscription.userEmail || `User ID: ${subscription.userId}`}
                          </div>
                          {subscription.userEmail && subscription.userName && (
                            <div className={styles.customerEmail}>{subscription.userEmail}</div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className={styles.quantityCell}>{subscription.litresPerDay}L/day</div>
                      </td>
                      <td>
                        <div className={styles.durationCell}>{durationLabel(subscription)}</div>
                      </td>
                      <td>
                        <div className={styles.rateCell}>
                          {getFixedSubscriptionRate(subscription) !== null ? `₹${Number(getFixedSubscriptionRate(subscription)).toFixed(2)}/L` : '—'}
                        </div>
                      </td>
                      <td>
                        <div className={styles.totalCell}>
                          {subscription.totalAmount != null ? `₹${Number(subscription.totalAmount).toFixed(2)}` : '—'}
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${getStatusBadgeClass(subscription.status)}`}>{subscription.status}</span>
                      </td>
                      <td className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.actions}>
                          {subscription.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => setConfirmAction({ kind: 'pause', id: subscription.id })}
                              className={styles.actionButton}
                              title="Pause Subscription"
                            >
                              Pause
                            </button>
                          )}
                          {subscription.status === 'paused' && (
                            <button
                              type="button"
                              onClick={() => setConfirmAction({ kind: 'resume', id: subscription.id })}
                              className={`${styles.actionButton} ${styles.resumeButton}`}
                              title="Resume Subscription"
                            >
                              Resume
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.cards}>
            {filtered.map((subscription) => (
              <div
                key={`m-${subscription.id}`}
                role="button"
                tabIndex={0}
                className={`${styles.card} ${styles.cardClickable}`}
                onClick={() => openDetailModal(subscription.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDetailModal(subscription.id);
                  }
                }}
                aria-label={`View subscription ${subscriptionProductDisplayLabel(subscription)}`}
              >
                <div className={styles.cardTop}>
                  <div>
                    <div className={styles.cardTitleRow}>
                      <span className={styles.cardTitle}>#{subscription.id}</span>
                      <span className={`${styles.badge} ${getStatusBadgeClass(subscription.status)}`}>{subscription.status}</span>
                    </div>
                    <div className={styles.cardProduct}>{subscriptionProductDisplayLabel(subscription)}</div>
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.customerCell}>
                    <div className={styles.customerName}>
                      {subscription.userName || subscription.userEmail || `User ID: ${subscription.userId}`}
                    </div>
                    {subscription.userEmail && subscription.userName ? (
                      <div className={styles.customerEmail}>{subscription.userEmail}</div>
                    ) : null}
                  </div>
                  <div className={styles.cardMeta}>
                    <span className={styles.cardMetaLabel}>Qty</span>
                    <span>{subscription.litresPerDay} L/day</span>
                  </div>
                  <div className={styles.cardMeta}>
                    <span className={styles.cardMetaLabel}>Duration</span>
                    <span>{durationLabel(subscription)}</span>
                  </div>
                   {getFixedSubscriptionRate(subscription) !== null && (
                    <div className={styles.cardMeta}>
                      <span className={styles.cardMetaLabel}>Rate</span>
                      <span>₹{Number(getFixedSubscriptionRate(subscription)).toFixed(2)}/L</span>
                    </div>
                  )}
                  {subscription.totalAmount != null && (
                    <div className={styles.cardMeta}>
                      <span className={styles.cardMetaLabel}>Total Price</span>
                      <span>₹{Number(subscription.totalAmount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                    {subscription.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ kind: 'pause', id: subscription.id })}
                        className={styles.actionButton}
                        title="Pause Subscription"
                      >
                        Pause
                      </button>
                    )}
                    {subscription.status === 'paused' && (
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ kind: 'resume', id: subscription.id })}
                        className={`${styles.actionButton} ${styles.resumeButton}`}
                        title="Resume Subscription"
                      >
                        Resume
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {detailOpen && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDetailModal();
          }}
          data-lenis-prevent
        >
          <div className={styles.modalPanel} role="dialog" aria-modal="true" aria-labelledby="sub-detail-title" onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" className={styles.modalClose} onClick={closeDetailModal} aria-label="Close">
              ×
            </button>

            {detailLoading ? (
              <div className={styles.modalLoading}>
                <LoadingSpinner />
              </div>
            ) : detailSub ? (
              <div className={styles.modalBody}>
                <h2 id="sub-detail-title" className={styles.modalTitle}>
                  {subscriptionProductDisplayLabel(detailSub)}
                </h2>
                <p className={styles.modalMeta}>
                  {detailSub.userName || detailSub.userEmail || `User ${detailSub.userId}`}
                  {detailSub.userEmail && detailSub.userName ? ` · ${detailSub.userEmail}` : ''}
                  {detailSub.deliveryAddress?.phone ? ` · ${detailSub.deliveryAddress.phone}` : ''}
                </p>

                <span className={`${styles.badge} ${getStatusBadgeClass(detailSub.status)}`}>{detailSub.status}</span>

                <dl className={styles.detailGrid}>
                  <dt>Purchased</dt>
                  <dd>{formatDateTimeIST(detailSub.purchasedAt || detailSub.createdAt)}</dd>

                  <dt>Delivery started</dt>
                  <dd>{formatDateDDMMYYYYIST(detailSub.initialStartDate || detailSub.startDate)}</dd>

                  <dt>Product</dt>
                  <dd>{subscriptionProductDisplayLabel(detailSub)}</dd>

                  <dt>Quantity</dt>
                  <dd>
                    {detailSub.litresPerDay} L/day
                    {detailSub.totalQty != null ? ` · Plan total: ${detailSub.totalQty}` : ''}
                    {detailSub.deliveredQty != null ? ` · Delivered: ${detailSub.deliveredQty}` : ''}
                    {detailSub.remainingQty != null ? ` · Remaining: ${detailSub.remainingQty}` : ''}
                  </dd>

                  {getFixedSubscriptionRate(detailSub) !== null && (
                    <>
                      <dt>Rate purchased</dt>
                      <dd>₹{Number(getFixedSubscriptionRate(detailSub)).toFixed(2)} / L</dd>
                    </>
                  )}

                  {detailSub.totalAmount != null && (
                    <>
                      <dt>Total Amount</dt>
                      <dd>₹{Number(detailSub.totalAmount).toFixed(2)}</dd>
                    </>
                  )}

                  {detailSub.discountAmount != null && Number(detailSub.discountAmount) > 0 && (
                    <>
                      <dt>Discount</dt>
                      <dd>₹{Number(detailSub.discountAmount).toFixed(2)}</dd>
                    </>
                  )}

                  {detailSub.walletUsed != null && Number(detailSub.walletUsed) > 0 && (
                    <>
                      <dt>Wallet Used</dt>
                      <dd>₹{Number(detailSub.walletUsed).toFixed(2)}</dd>
                    </>
                  )}

                  {detailSub.totalAmountPaid != null && (
                    <>
                      <dt>Amount Paid</dt>
                      <dd>₹{Number(detailSub.totalAmountPaid).toFixed(2)}</dd>
                    </>
                  )}

                  <dt>Duration</dt>
                  <dd>{durationLabel(detailSub)}</dd>

                  <dt>Plan ends</dt>
                  <dd>{formatDateDDMMYYYYIST(detailSub.endDate)}</dd>

                  <dt>Days left (plan)</dt>
                  <dd>
                    {detailDaysLeft === null
                      ? '—'
                      : detailDaysLeft < 0
                        ? `Ended ${Math.abs(detailDaysLeft)} day${Math.abs(detailDaysLeft) !== 1 ? 's' : ''} ago`
                        : `${detailDaysLeft} day${detailDaysLeft !== 1 ? 's' : ''}`}
                  </dd>

                  <dt>Next delivery</dt>
                  <dd>{detailNextYmd ? formatDateDDMMYYYYIST(detailNextYmd) : '—'}</dd>

                  <dt>Delivery window</dt>
                  <dd>{detailSub.deliveryTime || '—'}</dd>

                  <dt>Phone Number</dt>
                  <dd>{detailSub.deliveryAddress?.phone || '—'}</dd>

                  <dt>Live location</dt>
                  <dd>
                    {hasValidLocation(detailSub.deliveryAddress) ? (
                      <button
                        type="button"
                        className={styles.locationLinkButton}
                        onClick={() => setLocationModalOpen(true)}
                      >
                        See customer&apos;s location
                      </button>
                    ) : (
                      '—'
                    )}
                  </dd>
                </dl>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <AdminOrderMapLocationModal
        open={locationModalOpen && hasValidLocation(detailSub?.deliveryAddress)}
        onClose={() => setLocationModalOpen(false)}
        initialLatitude={detailSub?.deliveryAddress?.latitude}
        initialLongitude={detailSub?.deliveryAddress?.longitude}
        onConfirm={() => {}}
        mode="view"
        title="Customer's live location"
        hint="This map uses the latitude and longitude saved for the subscription order."
        confirmLabel="Close"
      />

      {confirmAction && (
        <div
          className={styles.confirmBackdrop}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !confirmBusy) setConfirmAction(null);
          }}
          data-lenis-prevent
        >
          <div className={styles.confirmPanel} role="alertdialog" aria-labelledby="confirm-sub-title" onMouseDown={(e) => e.stopPropagation()}>
            <h3 id="confirm-sub-title" className={styles.confirmTitle}>
              {confirmAction.kind === 'pause' ? 'Pause subscription?' : 'Resume subscription?'}
            </h3>
            <p className={styles.confirmText}>
              {confirmAction.kind === 'pause'
                ? 'Pausing hides this subscription’s upcoming deliveries on Admin → Deliveries (subscription tab) until you resume. Existing history is unchanged.'
                : 'Resuming sets the subscription back to active and shows its deliveries again on Admin → Deliveries for scheduled dates.'}
            </p>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.confirmBtnSecondary} disabled={confirmBusy} onClick={() => setConfirmAction(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={confirmAction.kind === 'pause' ? styles.confirmBtnWarning : styles.confirmBtnPrimary}
                disabled={confirmBusy}
                onClick={executePauseResume}
              >
                {confirmBusy ? 'Please wait…' : confirmAction.kind === 'pause' ? 'Pause' : 'Resume'}
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
            document.body,
          )
        : null}
    </div>
  );
}
