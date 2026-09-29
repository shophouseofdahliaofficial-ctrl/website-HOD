'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { adminExchangesApi, OrderExchange } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import { formatDateTimeIST } from '@/lib/utils/datetime';
import { normalizeAdminListSearchQuery } from '@/lib/utils/searchQuery';
import styles from './page.module.css';

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected' | 'completed';

export default function AdminExchangesPage() {
  const { showToast } = useToast();
  const [exchanges, setExchanges] = useState<OrderExchange[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [approvingExchange, setApprovingExchange] = useState<OrderExchange | null>(null);
  const [rejectingExchange, setRejectingExchange] = useState<OrderExchange | null>(null);
  const [detailsExchange, setDetailsExchange] = useState<OrderExchange | null>(null);

  // Form states for approval
  const [approvalDiff, setApprovalDiff] = useState<number>(0);
  const [approvalVariation, setApprovalVariation] = useState('');
  const [approvalMessage, setApprovalMessage] = useState('');
  const [approvalAdminNote, setApprovalAdminNote] = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);

  // Form states for rejection
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionAdminNote, setRejectionAdminNote] = useState('');
  const [submittingRejection, setSubmittingRejection] = useState(false);

  const fetchExchanges = useCallback(async (customSearch?: string) => {
    try {
      setLoading(true);
      const queryToUse = customSearch !== undefined ? customSearch : searchQuery;
      const normalizedSearch = normalizeAdminListSearchQuery(queryToUse);
      const res: any = await adminExchangesApi.getAll({
        status: activeTab !== 'all' ? activeTab : undefined,
        search: normalizedSearch || undefined,
      });
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.exchanges)
        ? res.exchanges
        : [];
      setExchanges(list);
    } catch (error: any) {
      console.error('Failed to fetch exchanges:', error);
      showToast(error.message || 'Failed to load exchange requests', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, showToast]);

  // Fast debounced search as user types
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchExchanges(searchQuery);
    }, 200);

    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery, activeTab]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchExchanges(searchQuery);
  };

  // Open Approve Modal
  const openApproveModal = (exchange: OrderExchange) => {
    setApprovingExchange(exchange);
    setApprovalDiff(exchange.priceDifference || 0);
    setApprovalVariation(exchange.requestedVariation || '');
    setApprovalMessage(exchange.approvalMessage || '');
    setApprovalAdminNote(exchange.adminNote || '');
  };

  // Handle Approve Confirm
  const handleConfirmApprove = async () => {
    if (!approvingExchange) return;
    try {
      setSubmittingApproval(true);
      await adminExchangesApi.approve(approvingExchange.id, {
        priceDifference: Number(approvalDiff),
        requestedVariation: approvalVariation.trim() || undefined,
        approvalMessage: approvalMessage.trim() || undefined,
        adminNote: approvalAdminNote.trim() || undefined,
      });
      showToast(`Exchange #${approvingExchange.orderNumber} approved`, 'success');
      setApprovingExchange(null);
      fetchExchanges();
    } catch (error: any) {
      showToast(error.message || 'Failed to approve exchange', 'error');
    } finally {
      setSubmittingApproval(false);
    }
  };

  // Open Reject Modal
  const openRejectModal = (exchange: OrderExchange) => {
    setRejectingExchange(exchange);
    setRejectionReason('');
    setRejectionAdminNote('');
  };

  // Handle Reject Confirm
  const handleConfirmReject = async () => {
    if (!rejectingExchange) return;
    if (!rejectionReason.trim()) {
      showToast('Please enter a rejection reason for the customer', 'error');
      return;
    }
    try {
      setSubmittingRejection(true);
      await adminExchangesApi.reject(rejectingExchange.id, {
        rejectionReason: rejectionReason.trim(),
        adminNote: rejectionAdminNote.trim() || undefined,
      });
      showToast(`Exchange #${rejectingExchange.orderNumber} rejected`, 'success');
      setRejectingExchange(null);
      fetchExchanges();
    } catch (error: any) {
      showToast(error.message || 'Failed to reject exchange', 'error');
    } finally {
      setSubmittingRejection(false);
    }
  };

  const [processingId, setProcessingId] = useState<string | null>(null);

  // Handle Mark Return Received at Origin Warehouse
  const handleMarkReturnReceived = async (exchange: OrderExchange) => {
    if (!window.confirm(`Confirm that the returned item for order #${exchange.orderNumber} has arrived at the origin warehouse?`)) {
      return;
    }
    try {
      setProcessingId(exchange.id);
      const updated = await adminExchangesApi.markReturnReceived(exchange.id);
      showToast(`Return for #${exchange.orderNumber} marked as received at origin warehouse`, 'success');
      if (detailsExchange && detailsExchange.id === exchange.id) {
        setDetailsExchange(updated);
      }
      fetchExchanges();
    } catch (error: any) {
      showToast(error.message || 'Failed to mark return received', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Mark Quality Verified (Verification Step)
  const handleMarkReturnVerified = async (exchange: OrderExchange) => {
    if (!window.confirm(`Confirm that the returned item for order #${exchange.orderNumber} has passed quality inspection and verification?`)) {
      return;
    }
    try {
      setProcessingId(exchange.id);
      const updated = await adminExchangesApi.markReturnVerified(exchange.id);
      showToast(`Return for #${exchange.orderNumber} quality verified and approved!`, 'success');
      if (detailsExchange && detailsExchange.id === exchange.id) {
        setDetailsExchange(updated);
      }
      fetchExchanges();
    } catch (error: any) {
      showToast(error.message || 'Failed to mark return verified', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Manual Dispatch Replacement (Warehouse -> Customer)
  const handleDispatchReplacement = async (exchange: OrderExchange) => {
    if (!window.confirm(`Generate forward Delhivery shipment to dispatch replacement (${exchange.requestedVariation || exchange.productName}) to customer for order #${exchange.orderNumber}?`)) {
      return;
    }
    try {
      setProcessingId(exchange.id);
      const updated = await adminExchangesApi.dispatchReplacement(exchange.id);
      showToast(`Replacement order dispatched! Waybill: ${updated.replacementWaybill}`, 'success');
      if (detailsExchange && detailsExchange.id === exchange.id) {
        setDetailsExchange(updated);
      }
      fetchExchanges();
    } catch (error: any) {
      showToast(error.message || 'Failed to dispatch replacement', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Mark Replacement Delivered
  const handleMarkReplacementDelivered = async (exchange: OrderExchange) => {
    if (!window.confirm(`Mark replacement shipment for order #${exchange.orderNumber} as delivered to customer?`)) {
      return;
    }
    try {
      setProcessingId(exchange.id);
      const updated = await adminExchangesApi.markReplacementDelivered(exchange.id);
      showToast(`Replacement for #${exchange.orderNumber} marked as delivered!`, 'success');
      if (detailsExchange && detailsExchange.id === exchange.id) {
        setDetailsExchange(updated);
      }
      fetchExchanges();
    } catch (error: any) {
      showToast(error.message || 'Failed to mark replacement delivered', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Counts for Stats Row
  const stats = useMemo(() => {
    const isDelivered = (e: OrderExchange) =>
      e.status === 'completed' ||
      e.replacementStatus?.toLowerCase() === 'delivered' ||
      Boolean(e.replacementDeliveredAt);

    return {
      total: exchanges.length,
      pending: exchanges.filter((e) => !isDelivered(e) && e.status !== 'rejected' && e.status !== 'cancelled').length,
      approved: exchanges.filter((e) => e.status === 'approved' && !isDelivered(e)).length,
      rejected: exchanges.filter((e) => e.status === 'rejected' || e.status === 'cancelled').length,
      completed: exchanges.filter((e) => isDelivered(e)).length,
    };
  }, [exchanges]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.headerBlock}>
        <div className={styles.headerBlockMain}>
          <h1 className={styles.title}>Exchange Requests</h1>
          <p className={styles.subtitle}>
            Manage item exchange requests submitted by customers within the 7-day post-delivery window.
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Requests</span>
          <span className={styles.statValue}>{stats.total}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Pending / In-Progress</span>
          <span className={`${styles.statValue} ${styles.statValuePending}`}>{stats.pending}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Approved</span>
          <span className={`${styles.statValue} ${styles.statValueApproved}`}>{stats.approved}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Rejected</span>
          <span className={`${styles.statValue} ${styles.statValueRejected}`}>{stats.rejected}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Delivered / Completed</span>
          <span className={styles.statValue}>{stats.completed}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <form onSubmit={handleSearchSubmit} className={styles.searchWrap}>
          <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by Order #, Customer, Product, or Waybill..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          {searchQuery.trim() && (
            <button
              type="button"
              className={styles.searchClearBtn}
              onClick={() => {
                setSearchQuery('');
                fetchExchanges('');
              }}
              aria-label="Clear search"
              title="Clear search"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </form>

        <div className={styles.filterTabs}>
          {(['all', 'pending', 'approved', 'rejected', 'completed'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`${styles.filterTab} ${activeTab === tab ? styles.filterTabActive : ''}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table Card */}
      <div className={styles.tableCard}>
        {loading ? (
          <div style={{ padding: '4rem', display: 'flex', justifyContent: 'center' }}>
            <LoadingSpinnerWithText text="Loading exchange requests..." />
          </div>
        ) : exchanges.length === 0 ? (
          <div className={styles.emptyState}>
            <svg className={styles.emptyStateIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" />
            </svg>
            <h3 className={styles.emptyStateTitle}>No exchange requests found</h3>
            <p style={{ margin: 0 }}>There are currently no exchange requests matching this filter.</p>
          </div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Order / Customer</th>
                    <th>Item to Exchange</th>
                    <th>Requested Replacement</th>
                    <th>Reason & Details</th>
                    <th>Status & Payment</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {exchanges.map((ex) => {
                    const isPositive = ex.priceDifference > 0;
                    const isNegative = ex.priceDifference < 0;
                    const isDelivered =
                      ex.status === 'completed' ||
                      ex.replacementStatus?.toLowerCase() === 'delivered' ||
                      Boolean(ex.replacementDeliveredAt);
                    const isRejected = ex.status === 'rejected' || ex.status === 'cancelled';

                    const rowClass = isDelivered
                      ? styles.rowCompleted
                      : isRejected
                        ? styles.rowRejected
                        : '';

                    return (
                      <tr key={ex.id} className={rowClass}>
                        {/* Order & Customer */}
                        <td>
                          <Link href={`/admin/orders?search=${ex.orderNumber}`} className={styles.orderNumLink}>
                            #{ex.orderNumber}
                          </Link>
                          <div className={styles.customerMeta} style={{ marginTop: '0.35rem' }}>
                            <span className={styles.customerName}>{ex.customerName || 'Customer'}</span>
                            <span className={styles.customerEmail}>{ex.customerEmail || ''}</span>
                          </div>
                        </td>

                        {/* Original Item */}
                        <td>
                          <div className={styles.itemSummary}>
                            {ex.exchangeItems && ex.exchangeItems.length > 1 ? (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                                  <span className={styles.multiCountBadge}>{ex.exchangeItems.length} Items</span>
                                </div>
                                {ex.exchangeItems.map((it, i) => (
                                  <div key={i} style={{ fontSize: '0.82rem', color: '#1e293b', marginBottom: '0.2rem' }}>
                                    <strong>{it.productName}</strong> (Qty: {it.quantity})
                                    {it.originalVariation && (
                                      <span className={`${styles.variationTag} ${styles.variationTagOld}`} style={{ marginLeft: '0.3rem' }}>
                                        {it.originalVariation}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </>
                            ) : (
                              <>
                                <span className={styles.originalItem}>{ex.productName}</span>
                                {ex.originalVariation && (
                                  <div>
                                    <span className={`${styles.variationTag} ${styles.variationTagOld}`}>Old: {ex.originalVariation}</span>
                                  </div>
                                )}
                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>₹{ex.originalUnitPrice.toFixed(2)} (Qty: {ex.quantity})</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Requested Replacement */}
                        <td>
                          <div className={styles.itemSummary}>
                            {ex.exchangeItems && ex.exchangeItems.length > 1 ? (
                              <>
                                {ex.exchangeItems.map((it, i) => (
                                  <div key={i} style={{ fontSize: '0.82rem', marginBottom: '0.2rem' }}>
                                    <span className={styles.replacementItem}>{it.requestedItemName || it.productName}</span>
                                    {it.requestedVariation && (
                                      <span className={`${styles.variationTag} ${styles.variationTagNew}`} style={{ marginLeft: '0.3rem' }}>
                                        {it.requestedVariation}
                                      </span>
                                    )}
                                  </div>
                                ))}
                                <div className={`${styles.priceDiffTag} ${isPositive ? styles.priceDiffPositive : isNegative ? styles.priceDiffNegative : styles.priceDiffNeutral}`} style={{ marginTop: '0.25rem' }}>
                                  {isPositive
                                    ? `Total +₹${ex.priceDifference.toFixed(2)} (Customer pays)`
                                    : isNegative
                                      ? `Total -₹${Math.abs(ex.priceDifference).toFixed(2)} (Refund)`
                                      : 'Same price (₹0 diff)'}
                                </div>
                              </>
                            ) : (
                              <>
                                <span className={styles.replacementItem}>
                                  {ex.requestedItemName || ex.productName}
                                </span>
                                {ex.requestedVariation && (
                                  <div>
                                    <span className={`${styles.variationTag} ${styles.variationTagNew}`}>
                                      New: {ex.requestedVariation}
                                    </span>
                                  </div>
                                )}
                                <div className={`${styles.priceDiffTag} ${isPositive ? styles.priceDiffPositive : isNegative ? styles.priceDiffNegative : styles.priceDiffNeutral}`}>
                                  {isPositive
                                    ? `+₹${ex.priceDifference.toFixed(2)} (Customer to pay)`
                                    : isNegative
                                      ? `-₹${Math.abs(ex.priceDifference).toFixed(2)} (Refund to wallet)`
                                      : 'Same price (₹0 diff)'}
                                </div>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Reason & Notes */}
                        <td>
                          <div className={styles.reasonBox}>
                            <div className={styles.reasonTitle}>{ex.reason}</div>
                            {ex.customerMessage && (
                              <div style={{ fontStyle: 'italic', marginTop: '0.15rem' }}>
                                &ldquo;{ex.customerMessage}&rdquo;
                              </div>
                            )}
                            {ex.rejectionReason && (
                              <div className={styles.rejectionNote}>
                                <strong>Rejection Reason:</strong> {ex.rejectionReason}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td>
                          <div>
                            <span
                              className={`${styles.statusBadge} ${
                                ex.status === 'pending'
                                  ? styles.statusPending
                                  : ex.status === 'approved'
                                    ? styles.statusApproved
                                    : ex.status === 'rejected'
                                      ? styles.statusRejected
                                      : styles.statusCompleted
                              }`}
                            >
                              {ex.status}
                            </span>
                          </div>
                          {ex.status === 'approved' && (
                            <div className={styles.paymentBadge}>
                              {ex.paymentStatus === 'not_required'
                                ? 'No payment needed'
                                : ex.paymentStatus === 'paid'
                                  ? 'Paid'
                                  : ex.paymentStatus === 'refunded'
                                    ? 'Refunded to Wallet'
                                    : 'Awaiting Settlement'}
                            </div>
                          )}
                          {ex.status === 'completed' && ex.paymentMethod && (
                            <div className={styles.paymentBadge}>
                              Settled via {ex.paymentMethod.replace('_', ' ')}
                            </div>
                          )}
                          {ex.reverseWaybill && (
                            <div style={{ marginTop: '0.35rem' }}>
                              <a
                                href={ex.reverseTrackingUrl || `https://www.delhivery.com/track/package/${ex.reverseWaybill}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: '#0369a1',
                                  background: '#e0f2fe',
                                  padding: '0.2rem 0.45rem',
                                  borderRadius: '4px',
                                  textDecoration: 'none',
                                  border: '1px solid #bae6fd',
                                }}
                              >
                                🚚 RVP #{ex.reverseWaybill} ↗
                              </a>
                            </div>
                          )}
                          {ex.returnReceivedAt && !ex.returnVerifiedAt && (
                            <div style={{ marginTop: '0.25rem' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  color: '#166534',
                                  background: '#dcfce7',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '4px',
                                  border: '1px solid #bbf7d0',
                                }}
                              >
                                ✓ Return at Origin
                              </span>
                            </div>
                          )}
                          {ex.returnVerifiedAt && (
                            <div style={{ marginTop: '0.25rem' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  color: '#92400e',
                                  background: '#fef3c7',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '4px',
                                  border: '1px solid #fde68a',
                                }}
                              >
                                ✓ Quality Verified
                              </span>
                            </div>
                          )}
                          {ex.replacementWaybill && (
                            <div style={{ marginTop: '0.25rem' }}>
                              <a
                                href={ex.replacementTrackingUrl || `https://www.delhivery.com/track/package/${ex.replacementWaybill}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: '#065f46',
                                  background: '#d1fae5',
                                  padding: '0.2rem 0.45rem',
                                  borderRadius: '4px',
                                  textDecoration: 'none',
                                  border: '1px solid #a7f3d0',
                                }}
                              >
                                📦 Replacement #{ex.replacementWaybill} ↗
                              </a>
                            </div>
                          )}
                          {ex.replacementDeliveredAt && (
                            <div style={{ marginTop: '0.25rem' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  color: '#15803d',
                                  background: '#dcfce7',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '4px',
                                  border: '1px solid #86efac',
                                }}
                              >
                                ✓ Replacement Delivered
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Date */}
                        <td>
                          <span style={{ fontSize: '0.82rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                            {formatDateTimeIST(ex.requestedAt || ex.createdAt)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td>
                          <div className={styles.actionBtns}>
                            {ex.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openApproveModal(ex)}
                                  className={styles.approveBtn}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openRejectModal(ex)}
                                  className={styles.rejectBtn}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {ex.returnReceivedAt && !ex.returnVerifiedAt && (
                              <button
                                type="button"
                                onClick={() => handleMarkReturnVerified(ex)}
                                disabled={processingId === ex.id}
                                className={styles.verifyBtn}
                                title="Confirm quality inspection and verification passed"
                              >
                                {processingId === ex.id ? 'Verifying...' : '🔍 Mark Verified'}
                              </button>
                            )}
                            {ex.returnVerifiedAt && !ex.replacementWaybill && (
                              <button
                                type="button"
                                onClick={() => handleDispatchReplacement(ex)}
                                disabled={processingId === ex.id}
                                className={styles.dispatchBtn}
                                title="Generate forward Delhivery shipment to customer"
                              >
                                {processingId === ex.id ? 'Dispatching...' : '🚚 Dispatch Replacement'}
                              </button>
                            )}
                            {ex.replacementWaybill && !ex.replacementDeliveredAt && (
                              <button
                                type="button"
                                onClick={() => handleMarkReplacementDelivered(ex)}
                                disabled={processingId === ex.id}
                                className={styles.deliveredBtn}
                                title="Mark replacement as delivered to customer"
                              >
                                {processingId === ex.id ? 'Saving...' : '✓ Mark Delivered'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDetailsExchange(ex)}
                              className={styles.viewBtn}
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className={styles.mobileCardsContainer}>
              {exchanges.map((ex) => {
                const isPositive = ex.priceDifference > 0;
                const isNegative = ex.priceDifference < 0;
                const isDelivered =
                  ex.status === 'completed' ||
                  ex.replacementStatus?.toLowerCase() === 'delivered' ||
                  Boolean(ex.replacementDeliveredAt);
                const isRejected = ex.status === 'rejected' || ex.status === 'cancelled';

                const cardClass = isDelivered
                  ? styles.mobileCardCompleted
                  : isRejected
                    ? styles.mobileCardRejected
                    : '';

                return (
                  <div key={ex.id} className={`${styles.mobileExchangeCard} ${cardClass}`}>
                    {/* Header */}
                    <div className={styles.mobileCardHeader}>
                      <div className={styles.mobileOrderGroup}>
                        <Link href={`/admin/orders?search=${ex.orderNumber}`} className={styles.orderNumLink}>
                          #{ex.orderNumber}
                        </Link>
                        <span className={styles.mobileDate}>
                          {formatDateTimeIST(ex.requestedAt || ex.createdAt)}
                        </span>
                      </div>
                      <span
                        className={`${styles.statusBadge} ${
                          ex.status === 'pending'
                            ? styles.statusPending
                            : ex.status === 'approved'
                              ? styles.statusApproved
                              : ex.status === 'rejected'
                                ? styles.statusRejected
                                : styles.statusCompleted
                        }`}
                      >
                        {ex.status}
                      </span>
                    </div>

                    {/* Customer */}
                    <div className={styles.mobileCustomerRow}>
                      <span className={styles.mobileCustomerName}>{ex.customerName || 'Customer'}</span>
                      {ex.customerEmail && <span className={styles.mobileCustomerEmail}>{ex.customerEmail}</span>}
                    </div>

                    {/* Comparison Item Block */}
                    <div className={styles.mobileComparisonSection}>
                      {ex.exchangeItems && ex.exchangeItems.length > 1 ? (
                        <div className={styles.mobileMultiItems}>
                          <div style={{ marginBottom: '0.4rem' }}>
                            <span className={styles.multiCountBadge}>{ex.exchangeItems.length} Items</span>
                          </div>
                          {ex.exchangeItems.map((it, i) => (
                            <div key={i} className={styles.mobileItemRow}>
                              <div className={styles.mobileOriginalItem}>
                                <span className={styles.mobileItemLabel}>From:</span> <strong>{it.productName}</strong> (Qty: {it.quantity})
                                {it.originalVariation && (
                                  <span className={`${styles.variationTag} ${styles.variationTagOld}`} style={{ marginLeft: '0.35rem' }}>
                                    {it.originalVariation}
                                  </span>
                                )}
                              </div>
                              <div className={styles.mobileReplacementItem}>
                                <span className={styles.mobileItemLabel}>To:</span> <strong>{it.requestedItemName || it.productName}</strong>
                                {it.requestedVariation && (
                                  <span className={`${styles.variationTag} ${styles.variationTagNew}`} style={{ marginLeft: '0.35rem' }}>
                                    {it.requestedVariation}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                          <div className={`${styles.priceDiffTag} ${isPositive ? styles.priceDiffPositive : isNegative ? styles.priceDiffNegative : styles.priceDiffNeutral}`}>
                            {isPositive
                              ? `Total +₹${ex.priceDifference.toFixed(2)} (Customer pays)`
                              : isNegative
                                ? `Total -₹${Math.abs(ex.priceDifference).toFixed(2)} (Refund)`
                                : 'Same price (₹0 diff)'}
                          </div>
                        </div>
                      ) : (
                        <div className={styles.mobileSingleItemComparison}>
                          <div className={styles.mobileOriginalItem}>
                            <span className={styles.mobileItemLabel}>Original Item:</span>
                            <div style={{ fontWeight: 600, color: '#1e293b', marginTop: '0.15rem' }}>{ex.productName}</div>
                            {ex.originalVariation && (
                              <div style={{ marginTop: '0.2rem' }}>
                                <span className={`${styles.variationTag} ${styles.variationTagOld}`}>Old: {ex.originalVariation}</span>
                              </div>
                            )}
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                              ₹{ex.originalUnitPrice.toFixed(2)} (Qty: {ex.quantity})
                            </div>
                          </div>

                          <div className={styles.mobileArrowDivider}>↓ Requested Exchange ↓</div>

                          <div className={styles.mobileReplacementItem}>
                            <span className={styles.mobileItemLabel}>New Replacement:</span>
                            <div style={{ fontWeight: 700, color: '#00835d', marginTop: '0.15rem' }}>{ex.requestedItemName || ex.productName}</div>
                            {ex.requestedVariation && (
                              <div style={{ marginTop: '0.2rem' }}>
                                <span className={`${styles.variationTag} ${styles.variationTagNew}`}>New: {ex.requestedVariation}</span>
                              </div>
                            )}
                            <div className={`${styles.priceDiffTag} ${isPositive ? styles.priceDiffPositive : isNegative ? styles.priceDiffNegative : styles.priceDiffNeutral}`}>
                              {isPositive
                                ? `+₹${ex.priceDifference.toFixed(2)} (Customer to pay)`
                                : isNegative
                                  ? `-₹${Math.abs(ex.priceDifference).toFixed(2)} (Refund to wallet)`
                                  : 'Same price (₹0 diff)'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Reason */}
                    {ex.reason && (
                      <div className={styles.mobileReasonBox}>
                        <div><strong style={{ color: '#0f172a' }}>Reason:</strong> {ex.reason}</div>
                        {ex.customerMessage && (
                          <div style={{ fontStyle: 'italic', color: '#64748b', marginTop: '0.2rem' }}>
                            &ldquo;{ex.customerMessage}&rdquo;
                          </div>
                        )}
                        {ex.rejectionReason && (
                          <div className={styles.rejectionNote} style={{ marginTop: '0.35rem' }}>
                            <strong>Rejection:</strong> {ex.rejectionReason}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Badges & Logistics */}
                    <div className={styles.mobileBadgesRow}>
                      {ex.status === 'approved' && (
                        <span className={styles.paymentBadge}>
                          {ex.paymentStatus === 'not_required'
                            ? 'No payment needed'
                            : ex.paymentStatus === 'paid'
                              ? 'Paid'
                              : ex.paymentStatus === 'refunded'
                                ? 'Refunded to Wallet'
                                : 'Awaiting Settlement'}
                        </span>
                      )}
                      {ex.reverseWaybill && (
                        <a
                          href={ex.reverseTrackingUrl || `https://www.delhivery.com/track/package/${ex.reverseWaybill}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.mobileTrackLink}
                        >
                          🚚 RVP #{ex.reverseWaybill} ↗
                        </a>
                      )}
                      {ex.returnReceivedAt && !ex.returnVerifiedAt && (
                        <span className={styles.mobileOriginBadge}>✓ Return at Origin</span>
                      )}
                      {ex.returnVerifiedAt && (
                        <span className={styles.mobileVerifiedBadge}>✓ Quality Verified</span>
                      )}
                      {ex.replacementWaybill && (
                        <a
                          href={ex.replacementTrackingUrl || `https://www.delhivery.com/track/package/${ex.replacementWaybill}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.mobileReplacementTrackLink}
                        >
                          📦 Repl. #{ex.replacementWaybill} ↗
                        </a>
                      )}
                      {ex.replacementDeliveredAt && (
                        <span className={styles.mobileOriginBadge}>✓ Replacement Delivered</span>
                      )}
                    </div>

                    {/* Mobile Action Buttons */}
                    <div className={styles.mobileActionBtns}>
                      {ex.status === 'pending' && (
                        <div className={styles.mobileActionPair}>
                          <button
                            type="button"
                            onClick={() => openApproveModal(ex)}
                            className={styles.approveBtn}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => openRejectModal(ex)}
                            className={styles.rejectBtn}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {ex.returnReceivedAt && !ex.returnVerifiedAt && (
                        <button
                          type="button"
                          onClick={() => handleMarkReturnVerified(ex)}
                          disabled={processingId === ex.id}
                          className={styles.verifyBtn}
                        >
                          {processingId === ex.id ? 'Verifying...' : '🔍 Mark Verified'}
                        </button>
                      )}
                      {ex.returnVerifiedAt && !ex.replacementWaybill && (
                        <button
                          type="button"
                          onClick={() => handleDispatchReplacement(ex)}
                          disabled={processingId === ex.id}
                          className={styles.dispatchBtn}
                        >
                          {processingId === ex.id ? 'Dispatching...' : '🚚 Dispatch Replacement'}
                        </button>
                      )}
                      {ex.replacementWaybill && !ex.replacementDeliveredAt && (
                        <button
                          type="button"
                          onClick={() => handleMarkReplacementDelivered(ex)}
                          disabled={processingId === ex.id}
                          className={styles.deliveredBtn}
                        >
                          {processingId === ex.id ? 'Saving...' : '✓ Mark Delivered'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDetailsExchange(ex)}
                        className={styles.viewBtn}
                      >
                        View Full Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* APPROVE MODAL */}
      {approvingExchange && (
        <div className={styles.modalOverlay} onClick={() => setApprovingExchange(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Approve Exchange (#{approvingExchange.orderNumber})</h2>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setApprovingExchange(null)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalItemOverview}>
                {approvingExchange.exchangeItems && approvingExchange.exchangeItems.length > 1 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ fontWeight: 700, color: '#1e293b' }}>
                      Exchange Products ({approvingExchange.exchangeItems.length}):
                    </div>
                    {approvingExchange.exchangeItems.map((it, i) => (
                      <div key={i} className={styles.multiItemBreakdownCard}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
                          {it.productName} (Qty: {it.quantity})
                        </div>
                        <div className={styles.variationComparisonGrid} style={{ marginTop: '0.35rem' }}>
                          <div className={styles.variationComparisonCard}>
                            <span className={styles.comparisonLabel}>Old Variation</span>
                            <span className={styles.comparisonValueOld}>{it.originalVariation || 'None / Standard'}</span>
                            <span className={styles.comparisonPrice}>₹{(it.originalUnitPrice * it.quantity).toFixed(2)}</span>
                          </div>
                          <div className={styles.variationComparisonArrow}>➔</div>
                          <div className={styles.variationComparisonCard}>
                            <span className={styles.comparisonLabel}>New Variation</span>
                            <span className={styles.comparisonValueNew}>{it.requestedVariation || 'None / Standard'}</span>
                            <span className={styles.comparisonPrice}>₹{(it.requestedUnitPrice * it.quantity).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div><strong>Product:</strong> {approvingExchange.productName} (Qty: {approvingExchange.quantity})</div>
                    
                    {/* Variation Comparison */}
                    <div className={styles.variationComparisonGrid}>
                      <div className={styles.variationComparisonCard}>
                        <span className={styles.comparisonLabel}>Old Variation (Purchased)</span>
                        <span className={styles.comparisonValueOld}>{approvingExchange.originalVariation || 'None / Standard'}</span>
                        <span className={styles.comparisonPrice}>₹{approvingExchange.originalUnitPrice.toFixed(2)}</span>
                      </div>
                      <div className={styles.variationComparisonArrow}>➔</div>
                      <div className={styles.variationComparisonCard}>
                        <span className={styles.comparisonLabel}>New Variation (Requested)</span>
                        <span className={styles.comparisonValueNew}>{approvingExchange.requestedVariation || 'None / Standard'}</span>
                        <span className={styles.comparisonPrice}>
                          {approvingExchange.priceDifference > 0
                            ? `+₹${approvingExchange.priceDifference.toFixed(2)} (Pay)`
                            : approvingExchange.priceDifference < 0
                              ? `-₹${Math.abs(approvingExchange.priceDifference).toFixed(2)} (Refund)`
                              : '₹0.00 diff'}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                <div className={styles.modalOverviewNote}>
                  <div><strong>Customer Reason:</strong> {approvingExchange.reason}</div>
                  {approvingExchange.customerMessage && (
                    <div><strong>Customer Note:</strong> {approvingExchange.customerMessage}</div>
                  )}
                </div>
              </div>

              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Replacement Variation / Size Summary (Confirmed)</label>
                <input
                  type="text"
                  value={approvalVariation}
                  readOnly
                  disabled
                  placeholder="e.g. Size L, Color Blue"
                  className={`${styles.modalInput} ${styles.modalInputMuted}`}
                />
              </div>

              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Price Difference (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={approvalDiff}
                  readOnly
                  disabled
                  placeholder="0 (Positive = Customer Pays, Negative = Refund to Wallet)"
                  className={`${styles.modalInput} ${styles.modalInputMuted}`}
                />
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  {approvalDiff > 0
                    ? `Customer will need to pay ₹${approvalDiff.toFixed(2)} online or via wallet.`
                    : approvalDiff < 0
                      ? `Customer will be credited ₹${Math.abs(approvalDiff).toFixed(2)} in their wallet.`
                      : 'No price difference. Exchange will be settled free of charge.'}
                </span>
              </div>

              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Message to Customer (Visible on Customer Order Page)</label>
                <textarea
                  value={approvalMessage}
                  onChange={(e) => setApprovalMessage(e.target.value)}
                  placeholder="e.g. Approved! Your exchange item has been confirmed and will be dispatched once pickup is done..."
                  className={styles.modalTextarea}
                  style={{ minHeight: '65px' }}
                />
              </div>

              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Admin Internal Note (Optional - Internal Only)</label>
                <textarea
                  value={approvalAdminNote}
                  onChange={(e) => setApprovalAdminNote(e.target.value)}
                  placeholder="Internal notes for operations team..."
                  className={styles.modalTextarea}
                  style={{ minHeight: '55px' }}
                />
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1e40af',
                fontSize: '0.82rem',
                lineHeight: 1.45,
                marginTop: '0.25rem'
              }}>
                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🚚</span>
                <div>
                  <strong>Reverse Logistics Automation:</strong> Approving this request will automatically manifest a <strong>Delhivery Reverse Pickup (RVP)</strong> to pick up the original item from the customer's delivery address and ship it back to our warehouse origin.
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setApprovingExchange(null)}
                disabled={submittingApproval}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalConfirmApproveBtn}
                onClick={handleConfirmApprove}
                disabled={submittingApproval}
              >
                {submittingApproval ? 'Approving...' : 'Confirm & Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectingExchange && (
        <div className={styles.modalOverlay} onClick={() => setRejectingExchange(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Reject Exchange (#{rejectingExchange.orderNumber})</h2>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setRejectingExchange(null)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalItemOverview}>
                <div><strong>Product:</strong> {rejectingExchange.productName}</div>
                
                {/* Variation Comparison */}
                <div className={styles.variationComparisonGrid}>
                  <div className={styles.variationComparisonCard}>
                    <span className={styles.comparisonLabel}>Old Variation (Purchased)</span>
                    <span className={styles.comparisonValueOld}>{rejectingExchange.originalVariation || 'None / Standard'}</span>
                  </div>
                  <div className={styles.variationComparisonArrow}>➔</div>
                  <div className={styles.variationComparisonCard}>
                    <span className={styles.comparisonLabel}>New Variation (Requested)</span>
                    <span className={styles.comparisonValueNew}>{rejectingExchange.requestedVariation || 'None / Standard'}</span>
                  </div>
                </div>

                <div className={styles.modalOverviewNote}>
                  <div><strong>Customer Reason:</strong> {rejectingExchange.reason}</div>
                </div>
              </div>

              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Rejection Reason (Visible on Customer Order Page) *</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this exchange request cannot be accepted (e.g. Item tags removed, outside policy guidelines)..."
                  className={styles.modalTextarea}
                  required
                />
              </div>

              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Admin Internal Note (Optional - Internal Only)</label>
                <input
                  type="text"
                  value={rejectionAdminNote}
                  onChange={(e) => setRejectionAdminNote(e.target.value)}
                  placeholder="Internal notes for operations team..."
                  className={styles.modalInput}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setRejectingExchange(null)}
                disabled={submittingRejection}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalConfirmRejectBtn}
                onClick={handleConfirmReject}
                disabled={submittingRejection}
              >
                {submittingRejection ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      {detailsExchange && (
        <div className={styles.modalOverlay} onClick={() => setDetailsExchange(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Exchange Details (#{detailsExchange.orderNumber})</h2>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setDetailsExchange(null)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalItemOverview}>
                <div><strong>Customer:</strong> {detailsExchange.customerName || 'N/A'} {detailsExchange.customerEmail ? `(${detailsExchange.customerEmail})` : ''}</div>
                {detailsExchange.customerPhone && <div><strong>Phone:</strong> {detailsExchange.customerPhone}</div>}
                
                {detailsExchange.exchangeItems && detailsExchange.exchangeItems.length > 1 ? (
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1' }}>
                    <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '0.45rem' }}>
                      Exchange Products ({detailsExchange.exchangeItems.length}):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {detailsExchange.exchangeItems.map((it, i) => (
                        <div key={i} className={styles.multiItemBreakdownCard}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>
                            {it.productName} (Qty: {it.quantity})
                          </div>
                          <div className={styles.variationComparisonGrid} style={{ marginTop: '0.35rem' }}>
                            <div className={styles.variationComparisonCard}>
                              <span className={styles.comparisonLabel}>Old Variation</span>
                              <span className={styles.comparisonValueOld}>{it.originalVariation || 'None / Standard'}</span>
                              <span className={styles.comparisonPrice}>₹{(it.originalUnitPrice * it.quantity).toFixed(2)}</span>
                            </div>
                            <div className={styles.variationComparisonArrow}>➔</div>
                            <div className={styles.variationComparisonCard}>
                              <span className={styles.comparisonLabel}>New Variation</span>
                              <span className={styles.comparisonValueNew}>{it.requestedVariation || 'None / Standard'}</span>
                              <span className={styles.comparisonPrice}>₹{(it.requestedUnitPrice * it.quantity).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1' }}>
                      <strong>Product:</strong> {detailsExchange.productName} (Qty: {detailsExchange.quantity})
                    </div>

                    {/* Variation Comparison */}
                    <div className={styles.variationComparisonGrid}>
                      <div className={styles.variationComparisonCard}>
                        <span className={styles.comparisonLabel}>Old Variation (Purchased)</span>
                        <span className={styles.comparisonValueOld}>{detailsExchange.originalVariation || 'None / Standard'}</span>
                        <span className={styles.comparisonPrice}>₹{detailsExchange.originalUnitPrice.toFixed(2)}</span>
                      </div>
                      <div className={styles.variationComparisonArrow}>➔</div>
                      <div className={styles.variationComparisonCard}>
                        <span className={styles.comparisonLabel}>New Variation (Requested)</span>
                        <span className={styles.comparisonValueNew}>{detailsExchange.requestedVariation || 'None / Standard'}</span>
                        <span className={styles.comparisonPrice}>
                          {detailsExchange.priceDifference > 0
                            ? `+₹${detailsExchange.priceDifference.toFixed(2)}`
                            : detailsExchange.priceDifference < 0
                              ? `-₹${Math.abs(detailsExchange.priceDifference).toFixed(2)}`
                              : '₹0.00 diff'}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1' }}>
                  <strong>Customer Reason:</strong> {detailsExchange.reason}
                </div>
                {detailsExchange.customerMessage && (
                  <div><strong>Customer Message:</strong> &ldquo;{detailsExchange.customerMessage}&rdquo;</div>
                )}
                {detailsExchange.approvalMessage && (
                  <div style={{ color: '#065f46', background: '#ecfdf5', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                    <strong>Approval Message to Customer:</strong> {detailsExchange.approvalMessage}
                  </div>
                )}
                {detailsExchange.rejectionReason && (
                  <div style={{ color: '#991b1b', background: '#fef2f2', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #fecaca' }}>
                    <strong>Rejection Reason to Customer:</strong> {detailsExchange.rejectionReason}
                  </div>
                )}
                {detailsExchange.adminNote && (
                  <div style={{ fontSize: '0.84rem', color: '#475569' }}>
                    <strong>Admin Internal Note (Internal Only):</strong> {detailsExchange.adminNote}
                  </div>
                )}

                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1' }}>
                  <strong>Status:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{detailsExchange.status}</span>
                </div>
                {detailsExchange.paymentStatus && (
                  <div><strong>Payment Status:</strong> {detailsExchange.paymentStatus}</div>
                )}
                {detailsExchange.paymentMethod && (
                  <div><strong>Payment Method:</strong> {detailsExchange.paymentMethod}</div>
                )}

                {/* Step-by-Step Fulfillment Timeline (Clean 2-Color UI) */}
                <div className={styles.stepTimelineContainer}>
                  {/* Step 1: Delhivery Reverse Pickup */}
                  {detailsExchange.reverseWaybill && (
                    <div className={styles.stepCard}>
                      <div className={styles.stepHeader}>
                        <div className={styles.stepTitleGroup}>
                          <span className={`${styles.stepNumber} ${styles.stepNumberCompleted}`}>1</span>
                          <span>Reverse Pickup (Customer ➔ Origin)</span>
                        </div>
                        <span className={`${styles.stepBadge} ${styles.stepBadgeCompleted}`}>
                          {detailsExchange.reverseStatus || 'Pickup Scheduled'}
                        </span>
                      </div>
                      <div className={styles.stepBody}>
                        <div><strong>Waybill / AWB:</strong> #{detailsExchange.reverseWaybill}</div>
                        {detailsExchange.reversePickupScheduledAt && (
                          <div className={styles.stepRowDate}>
                            <strong>Pickup Manifested:</strong> {formatDateTimeIST(detailsExchange.reversePickupScheduledAt)}
                          </div>
                        )}
                        <div>
                          <a
                            href={detailsExchange.reverseTrackingUrl || `https://www.delhivery.com/track/package/${detailsExchange.reverseWaybill}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.stepTrackingLink}
                          >
                            Track Reverse Pickup on Delhivery ↗
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Return Arrival at Warehouse */}
                  {detailsExchange.reverseWaybill && (
                    <div className={styles.stepCard}>
                      <div className={styles.stepHeader}>
                        <div className={styles.stepTitleGroup}>
                          <span className={`${styles.stepNumber} ${detailsExchange.returnReceivedAt ? styles.stepNumberCompleted : styles.stepNumberPending}`}>2</span>
                          <span>Return Arrival at Warehouse (Automatic)</span>
                        </div>
                        <span className={`${styles.stepBadge} ${detailsExchange.returnReceivedAt ? styles.stepBadgeCompleted : styles.stepBadgePending}`}>
                          {detailsExchange.returnReceivedAt ? 'Received at Warehouse' : 'In Transit to Warehouse'}
                        </span>
                      </div>
                      <div className={styles.stepBody}>
                        {detailsExchange.returnReceivedAt ? (
                          <div className={styles.stepRowDate}>
                            <strong>Received at Origin:</strong> {formatDateTimeIST(detailsExchange.returnReceivedAt)}
                          </div>
                        ) : (
                          <div className={styles.stepActionText} style={{ fontStyle: 'italic', color: '#475569' }}>
                            Package is in transit with courier. Automatically updates once delivered to origin warehouse.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 3: Return Quality Verification */}
                  {detailsExchange.returnReceivedAt && (
                    <div className={styles.stepCard}>
                      <div className={styles.stepHeader}>
                        <div className={styles.stepTitleGroup}>
                          <span className={`${styles.stepNumber} ${detailsExchange.returnVerifiedAt ? styles.stepNumberCompleted : styles.stepNumberPending}`}>3</span>
                          <span>Return Quality Verification</span>
                        </div>
                        <span className={`${styles.stepBadge} ${detailsExchange.returnVerifiedAt ? styles.stepBadgeCompleted : styles.stepBadgePending}`}>
                          {detailsExchange.returnVerifiedAt ? 'Quality Verified' : 'Pending Verification'}
                        </span>
                      </div>
                      <div className={styles.stepBody}>
                        {detailsExchange.returnVerifiedAt ? (
                          <div className={styles.stepRowDate}>
                            <strong>Verified On:</strong> {formatDateTimeIST(detailsExchange.returnVerifiedAt)}
                          </div>
                        ) : (
                          <div className={styles.stepActionRow}>
                            <span className={styles.stepActionText}>
                              Inspect returned item to approve replacement dispatch.
                            </span>
                            <button
                              type="button"
                              onClick={() => handleMarkReturnVerified(detailsExchange)}
                              disabled={processingId === detailsExchange.id}
                              className={styles.stepActionBtn}
                            >
                              {processingId === detailsExchange.id ? 'Verifying...' : '✓ Pass Verification'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 4: Forward Replacement Dispatch */}
                  {(detailsExchange.status === 'approved' || detailsExchange.status === 'completed') && (
                    <div className={styles.stepCard}>
                      <div className={styles.stepHeader}>
                        <div className={styles.stepTitleGroup}>
                          <span className={`${styles.stepNumber} ${detailsExchange.replacementWaybill ? styles.stepNumberCompleted : styles.stepNumberPending}`}>4</span>
                          <span>Replacement Dispatch (Warehouse ➔ Customer)</span>
                        </div>
                        <span className={`${styles.stepBadge} ${detailsExchange.replacementWaybill ? styles.stepBadgeCompleted : styles.stepBadgePending}`}>
                          {detailsExchange.replacementWaybill ? 'Dispatched' : 'Ready for Dispatch'}
                        </span>
                      </div>
                      <div className={styles.stepBody}>
                        {detailsExchange.replacementWaybill ? (
                          <>
                            <div><strong>Delhivery AWB:</strong> #{detailsExchange.replacementWaybill}</div>
                            {detailsExchange.replacementDispatchedAt && (
                              <div className={styles.stepRowDate}>
                                <strong>Dispatched:</strong> {formatDateTimeIST(detailsExchange.replacementDispatchedAt)}
                              </div>
                            )}
                            <div>
                              <a
                                href={detailsExchange.replacementTrackingUrl || `https://www.delhivery.com/track/package/${detailsExchange.replacementWaybill}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.stepTrackingLink}
                              >
                                Track Replacement Shipment on Delhivery ↗
                              </a>
                            </div>
                          </>
                        ) : detailsExchange.returnVerifiedAt ? (
                          <div className={styles.stepActionRow}>
                            <span className={styles.stepActionText}>
                              Quality verification passed. Ready for dispatch.
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDispatchReplacement(detailsExchange)}
                              disabled={processingId === detailsExchange.id}
                              className={styles.stepActionBtn}
                            >
                              {processingId === detailsExchange.id ? 'Dispatching...' : '🚚 Dispatch Replacement'}
                            </button>
                          </div>
                        ) : (
                          <div className={styles.stepActionText} style={{ fontStyle: 'italic' }}>
                            Awaiting warehouse return receipt and quality verification.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 5: Replacement Delivery */}
                  {detailsExchange.replacementWaybill && (
                    <div className={styles.stepCard}>
                      <div className={styles.stepHeader}>
                        <div className={styles.stepTitleGroup}>
                          <span className={`${styles.stepNumber} ${(detailsExchange.replacementDeliveredAt || detailsExchange.replacementStatus === 'Delivered') ? styles.stepNumberCompleted : styles.stepNumberPending}`}>5</span>
                          <span>Replacement Delivery (Automatic)</span>
                        </div>
                        <span className={`${styles.stepBadge} ${(detailsExchange.replacementDeliveredAt || detailsExchange.replacementStatus === 'Delivered') ? styles.stepBadgeCompleted : styles.stepBadgePending}`}>
                          {(detailsExchange.replacementDeliveredAt || detailsExchange.replacementStatus === 'Delivered') ? 'Delivered' : 'In Transit'}
                        </span>
                      </div>
                      <div className={styles.stepBody}>
                        {(detailsExchange.replacementDeliveredAt || detailsExchange.replacementStatus === 'Delivered') ? (
                          <div className={styles.stepRowDate}>
                            <strong>Delivered On:</strong> {formatDateTimeIST(detailsExchange.replacementDeliveredAt || detailsExchange.updatedAt)}
                          </div>
                        ) : (
                          <div className={styles.stepActionRow}>
                            <span className={styles.stepActionText}>
                              In transit with courier. Updates automatically.
                            </span>
                            <button
                              type="button"
                              onClick={() => handleMarkReplacementDelivered(detailsExchange)}
                              disabled={processingId === detailsExchange.id}
                              className={styles.stepActionBtn}
                            >
                              {processingId === detailsExchange.id ? 'Saving...' : '✓ Mark Delivered'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1' }}>
                  <div><strong>Requested At:</strong> {formatDateTimeIST(detailsExchange.requestedAt)}</div>
                  {detailsExchange.approvedAt && <div><strong>Approved At:</strong> {formatDateTimeIST(detailsExchange.approvedAt)}</div>}
                  {detailsExchange.rejectedAt && <div><strong>Rejected At:</strong> {formatDateTimeIST(detailsExchange.rejectedAt)}</div>}
                  {detailsExchange.paidAt && <div><strong>Paid / Settled At:</strong> {formatDateTimeIST(detailsExchange.paidAt)}</div>}
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setDetailsExchange(null)}
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
