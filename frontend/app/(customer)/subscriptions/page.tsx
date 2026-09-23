'use client';

import { useEffect, useState } from 'react';
import { subscriptionsApi } from '@/lib/api';
import { Subscription } from '@/types';
import Link from 'next/link';
import styles from './page.module.css';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { parseLocalDateFromYmd } from '@/lib/utils/datetime';
import { formatNextDeliveryCustomerLine } from '@/lib/utils/subscriptionNextDelivery';

function getStatusMeta(status: string): { label: string; className: string } {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'active') return { label: 'Active', className: styles.statusActive };
  if (normalized === 'paused') return { label: 'Paused', className: styles.statusPaused };
  if (normalized === 'pending') return { label: 'Pending', className: styles.statusPending };
  if (normalized === 'cancelled') return { label: 'Cancelled', className: styles.statusCancelled };
  if (normalized === 'failed') return { label: 'Failed', className: styles.statusFailed };
  return { label: 'Expired', className: styles.statusExpired };
}

function getSubscriptionLabel(subscription: Subscription): { label: string; className: string } {
  if (subscription.isTrial) {
    if (subscription.status === 'expired') {
      return { label: 'Trial expired', className: styles.statusExpired };
    }
    return { label: 'Trial', className: styles.statusPending };
  }
  return getStatusMeta(subscription.status);
}

function removeRedundantPendingSubscriptions(subscriptions: Subscription[]): Subscription[] {
  const activeProductIds = new Set(
    subscriptions
      .filter((s) => s.status === 'active' && Boolean(s.productId))
      .map((s) => s.productId),
  );

  return subscriptions.filter((s) => {
    if (s.status !== 'pending') return true;
    // Cart/checkout COD (or any checkout-linked pending) must stay visible even if same product is active elsewhere
    if (s.checkoutOrderId || s.trialCheckoutOrderId) return true;
    if (!s.productId) return true;
    return !activeProductIds.has(s.productId);
  });
}

/**
 * My Plans Page
 * Lists all subscriptions for the current user
 */
export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();
  const { showToast } = useToast();

  const refresh = async () => {
    const data = await subscriptionsApi.getAll();
    const detailed = await Promise.all(
      data.map(async (sub) => {
        try {
          return await subscriptionsApi.getById(sub.id);
        } catch {
          return sub;
        }
      }),
    );
    setSubscriptions(removeRedundantPendingSubscriptions(detailed));
  };

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        await refresh();
      } catch (error) {
        console.error('Failed to fetch subscriptions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptions();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70vh',
          fontFamily: 'var(--font-inter), sans-serif',
          color: '#666',
          fontSize: 'calc(1.05rem - 3px)',
          fontWeight: 500,
          letterSpacing: '-0.5px',
          gap: '10px',
        }}
      >
        <style>{`
          @keyframes loaderSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <svg
          style={{
            animation: 'loaderSpin 0.8s linear infinite',
            width: '22px',
            height: '22px',
            color: '#AB6468',
            marginBottom: '0px',
            flexShrink: 0
          }}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            style={{ opacity: 0.15 }}
          />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>My Plans</h1>
        </div>
        
        {subscriptions.length === 0 ? (
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <svg 
              viewBox="0 0 400 400" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: '120px', height: '120px', margin: '0 auto 2rem', display: 'block' }}
            >
              <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
              <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
              <g id="SVGRepo_iconCarrier"> 
                <path d="M177.818 76.0347C193.128 62.879 219.565 56.3475 239.677 64.7699C304.609 91.9587 269.1 183.452 204.028 174.369C160.167 168.248 162.583 84.1728 196.691 69.8894" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path> 
                <path d="M142.592 149C111.564 182.552 91.4488 286.487 107.863 329.195C109.631 333.784 114.081 334.831 117.45 331.31C155.592 308 201.533 267.999 236.81 234.342C238.48 232.748 240.596 232.585 242.747 232.858C243.34 233.617 243.261 234.425 243.183 235.222C241.916 248 241.311 272.377 240.996 285.219C240.708 296.882 239.477 308.533 239.564 320.225C239.585 323.115 239.284 329.44 239.564 332.31C239.78 334.509 244.215 335.724 243.183 338.048" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path> 
                <path d="M142.71 148.845C142.007 152.51 148.963 167.717 151.144 170.81C169.028 196.155 189.4 232.596 223.701 236.643C226.813 237.01 229.933 235.319 232.977 236.992C233.683 237.382 234.488 236.478 235.107 235.976C237.021 234.424 238.895 232.819 240.285 230.783C241.588 228.877 242.709 226.899 245.782 227.905C248.761 228.883 250.756 230.562 250.968 233.665C251.089 235.434 251.085 237.181 251.929 238.814C267.165 268.244 280.722 296.267 291.172 327.626C292.39 331.283 294.472 333.263 298.883 332.765" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path> 
              </g>
            </svg>
            <p>You don&apos;t have any plans yet.</p>
            <Link
              href="/#membership"
              style={{
                display: 'inline-block',
                marginTop: '1.5rem',
                padding: '0.875rem 1.75rem',
                background: '#000',
                color: '#fff',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '0.95rem',
                fontWeight: '600',
                transition: 'background-color 0.2s',
                letterSpacing: '-0.2px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#333';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#000';
              }}
            >
              Browse Plans
            </Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {subscriptions.map((s) => {
              const endDateOnly = parseLocalDateFromYmd(s.endDate);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const statusMeta = getSubscriptionLabel(s);
              const statusClass = `${styles.statusPill} ${statusMeta.className}`;
              const displayStatus = statusMeta.label;
              const formattedEndDate =
                endDateOnly?.toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }) ?? '—';
              const msPerDay = 24 * 60 * 60 * 1000;
              // Calendar fallback: endDate inclusive through today.
              const daysLeftCalendarRaw =
                endDateOnly != null
                  ? Math.floor((endDateOnly.getTime() - today.getTime()) / msPerDay) + 1
                  : 0;
              const daysLeftCalendar = Math.max(0, daysLeftCalendarRaw);
              const planDayCount =
                s.durationDays != null && s.durationDays >= 1 ? s.durationDays : null;
              const deliveredSlotCount =
                s.deliverySchedules?.filter((d) => d.status === 'delivered').length ?? 0;
              // Count down by completed deliveries only — scheduled/pending days still count as “left”.
              const daysLeft =
                planDayCount != null &&
                (s.status === 'active' || s.status === 'paused' || s.status === 'pending')
                  ? Math.max(0, planDayCount - deliveredSlotCount)
                  : daysLeftCalendar;
              const isCancelled = s.status === 'cancelled';
              const isExpired = s.status === 'expired';
  
              const nextDeliveryLine = isCancelled
                ? 'Next Delivery: —'
                : isExpired
                  ? 'Next Delivery: Period ended'
                  : formatNextDeliveryCustomerLine(s);
  
              const endsText = isCancelled
                ? 'Plan Cancelled'
                : isExpired
                  ? 'Plan Expired'
                  : `Ends: ${formattedEndDate}`;
  
              const remainingLine = isCancelled
                ? 'Remaining: 0 days left'
                : isExpired
                  ? 'Remaining: No days remaining'
                  : `Remaining: ${daysLeft} days left`;
              let planTotal: number | null = null;
              if (s.totalAmount != null) {
                const t = Number(s.totalAmount);
                if (Number.isFinite(t)) planTotal = t;
              }
              if (planTotal == null) {
                const unit = s.perUnitPrice != null ? Number(s.perUnitPrice) : NaN;
                const qty = s.totalQty != null ? Number(s.totalQty) : NaN;
                if (Number.isFinite(unit) && Number.isFinite(qty) && qty > 0) {
                  planTotal = unit * qty;
                }
              }
              return (
                <div key={s.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div className={styles.imageCol}>
                      {s.product?.imageUrl ? (
                        <img
                          src={s.product.imageUrl}
                          alt={s.product?.name || 'Product'}
                          className={styles.imageTag}
                        />
                      ) : (
                        <div className={styles.imagePlaceholder} />
                      )}
                      <div className={styles.imagePrice}>
                        {planTotal != null ? `₹${planTotal.toFixed(2)}` : '—'}
                      </div>
                    </div>
                    <div className={styles.meta}>
                      <div className={styles.metaHeader}>
                        <h3 className={styles.productName}>{s.product?.name || 'Product'}</h3>
                        <span className={statusClass}>{displayStatus}</span>
                      </div>
                      <p className={styles.subText}>
                        {s.isTrial 
                          ? 'One-time trial delivery' 
                          : `Quantity: ${s.litresPerDay} x ${s.variationSize || '1L'}/day`}
                      </p>
                      <p className={styles.subText}>{nextDeliveryLine}</p>
                      <p className={styles.subText}>{endsText}</p>
                      <p className={styles.subText}>{remainingLine}</p>
                    </div>
                  </div>
                  <div className={styles.actions}>
                    <Link href={`/subscriptions/${s.id}`} className={styles.viewDetailsButton}>
                      View Details
                    </Link>
                    <button
                      className={styles.buyThisButton}
                      onClick={() => {
                        addItem({
                          productId: s.productId,
                          quantity: 1,
                          variationId: s.variationId ? String(s.variationId) : undefined,
                        });
                        showToast('Added to cart', 'success');
                      }}
                    >
                      <span className={styles.buyThisIcon} aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="#000000" xmlns="http://www.w3.org/2000/svg">
                          <path d="M18,11.74a1,1,0,0,0-.52-.63L14.09,9.43,15,3.14a1,1,0,0,0-1.78-.75l-7,9a1,1,0,0,0-.18.87,1.05,1.05,0,0,0,.6.67l4.27,1.71L10,20.86a1,1,0,0,0,.63,1.07A.92.92,0,0,0,11,22a1,1,0,0,0,.83-.45l6-9A1,1,0,0,0,18,11.74Z" />
                        </svg>
                      </span>
                      <span>Buy This</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
