'use client';

import { useEffect, useMemo, useState } from 'react';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

type FeedbackStats = {
  least: number;
  neutral: number;
  most: number;
  total: number;
  leastPct: number;
  neutralPct: number;
  mostPct: number;
  deliveryAgentStars?: { 1: number; 2: number; 3: number; 4: number; 5: number };
  onTimeStars?: { 1: number; 2: number; 3: number; 4: number; 5: number };
  valueForMoneyStars?: { 1: number; 2: number; 3: number; 4: number; 5: number };
  wouldOrderAgain?: { Yes: number; Maybe: number; No: number };
  general?: Array<{
    id: string;
    userId: string | null;
    email: string;
    message: string;
    createdAt: string;
    userName: string | null;
  }>;
  cancellations?: Array<{
    id: string;
    orderNumber: string;
    cancellationReason: string;
    cancelledAt: string;
    orderedAt: string | null;
    amount: number;
    currency: string;
    paymentMethod: string;
    paymentStatus: string;
    userName: string | null;
    userEmail: string | null;
  }>;
};

/**
 * Admin Feedback Page
 * Shows emoji feedback counts, percentages, delivery ratings, general feedback,
 * order cancellation breakdown analysis, and cancellation feedback list with delete support.
 */
export default function AdminFeedbackPage() {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiClient.get<FeedbackStats>('/api/admin/feedback');
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch feedback:', error);
        showToast((error as { message?: string })?.message || 'Failed to fetch feedback', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [showToast]);

  const handleDeleteCancellation = async (orderId: string, orderNumber: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete the cancellation feedback for order #${orderNumber}?`);
    if (!confirmed) return;

    setDeletingId(orderId);
    try {
      await apiClient.delete(`/api/admin/feedback/cancellations/${orderId}`);
      setStats((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          cancellations: (prev.cancellations || []).filter((c) => c.id !== orderId),
        };
      });
      showToast('Cancellation feedback deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete cancellation feedback:', error);
      showToast((error as { message?: string })?.message || 'Failed to delete cancellation feedback', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const cancellationList = stats?.cancellations || [];

  // Short analysis for cancellation reasons breakdown and percentage
  const cancellationAnalysis = useMemo(() => {
    if (cancellationList.length === 0) return null;
    const counts: Record<string, number> = {};

    cancellationList.forEach((item) => {
      const raw = item.cancellationReason?.trim() || 'Unspecified';
      let key = raw;
      if (raw.includes(' - ')) {
        key = raw.split(' - ')[0].trim();
      } else if (raw.toLowerCase().startsWith('other reasons:') || raw.toLowerCase().startsWith('other:')) {
        key = 'Other reasons';
      }
      counts[key] = (counts[key] || 0) + 1;
    });

    const total = cancellationList.length;
    const breakdown = Object.entries(counts)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    return { total, breakdown };
  }, [cancellationList]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        padding: '2rem',
      }}>
        <LoadingSpinnerWithText text="Loading feedback..." />
      </div>
    );
  }

  const s = stats || {
    least: 0, neutral: 0, most: 0, total: 0,
    leastPct: 0, neutralPct: 0, mostPct: 0,
  };

  const generalList = s.general || [];

  const renderStarSection = (label: string, dist?: { 1: number; 2: number; 3: number; 4: number; 5: number }) => {
    const d = dist || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const total = d[1] + d[2] + d[3] + d[4] + d[5];
    const avg = total > 0 ? ((d[1] * 1 + d[2] * 2 + d[3] * 3 + d[4] * 4 + d[5] * 5) / total).toFixed(1) : '—';
    return (
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Avg: {avg} ★</span>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            (1★:{d[1]} 2★:{d[2]} 3★:{d[3]} 4★:{d[4]} 5★:{d[5]})
          </span>
        </div>
      </div>
    );
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1 className={adminStyles.adminPageTitle}>Feedback</h1>
      <p style={{ color: '#64748b', marginTop: '0.5rem', marginBottom: '2rem' }}>
        How likely are customers to recommend you? (From delivered order feedback)
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.75rem' }}>😔</span>
            <strong>Least likely</strong>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#b91c1c' }}>{s.least}</div>
          <div style={{ fontSize: '0.9rem', color: '#64748b' }}>{s.leastPct}%</div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.75rem' }}>😐</span>
            <strong>Neutral</strong>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#475569' }}>{s.neutral}</div>
          <div style={{ fontSize: '0.9rem', color: '#64748b' }}>{s.neutralPct}%</div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.75rem' }}>😊</span>
            <strong>Most likely</strong>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#15803d' }}>{s.most}</div>
          <div style={{ fontSize: '0.9rem', color: '#64748b' }}>{s.mostPct}%</div>
        </div>
      </div>

      <div style={{ padding: '1rem', background: '#f1f5f9', borderRadius: '8px', fontSize: '0.9rem', color: '#475569', marginBottom: '2rem' }}>
        <strong>Total responses:</strong> {s.total}
      </div>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', marginTop: '2.5rem' }}>General website feedback</h2>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: '1.25rem', fontSize: '0.9rem' }}>
        Submitted from the floating Help menu popup.
      </p>

      {generalList.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '2.5rem' }}>
          {generalList.map((entry) => (
            <div
              key={entry.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1rem 1.1rem',
                background: '#fff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                <strong style={{ fontSize: '0.95rem' }}>{entry.email}</strong>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{formatDate(entry.createdAt)}</span>
              </div>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.875rem', lineHeight: 1.45, color: '#334155' }}>
                {entry.message}
              </p>
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                User: {entry.userName || 'Anonymous'}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2.5rem' }}>No general website feedback yet.</p>
      )}

      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Detailed feedback (How was it?)</h2>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        From delivered orders — Quality of the product goes to product reviews; the rest are shown here.
      </p>

      {renderStarSection('Delivery agent behaviour', s.deliveryAgentStars)}
      {renderStarSection('On time delivery', s.onTimeStars)}
      {renderStarSection('Value for money', s.valueForMoneyStars)}

      <div style={{ marginTop: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Would you order again</div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '1rem 1.25rem', minWidth: '120px' }}>
            <div style={{ fontSize: '0.85rem', color: '#166534', marginBottom: '0.25rem' }}>Yes</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#15803d' }}>{(s.wouldOrderAgain?.Yes ?? 0)}</div>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem 1.25rem', minWidth: '120px' }}>
            <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.25rem' }}>Maybe</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#64748b' }}>{(s.wouldOrderAgain?.Maybe ?? 0)}</div>
          </div>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '1rem 1.25rem', minWidth: '120px' }}>
            <div style={{ fontSize: '0.85rem', color: '#b91c1c', marginBottom: '0.25rem' }}>No</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>{(s.wouldOrderAgain?.No ?? 0)}</div>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', marginTop: '2.5rem' }}>Order cancellation feedback &amp; reasons</h2>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: '1.25rem', fontSize: '0.9rem' }}>
        Submitted by customers when cancelling their orders before package preparation.
      </p>

      {/* Cancellation Reasons Analysis Breakdown */}
      {cancellationAnalysis && (
        <div style={{
          background: '#fff',
          border: '1px solid #fecaca',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '1.75rem',
          boxShadow: '0 2px 6px rgba(220, 38, 38, 0.05)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #fee2e2', paddingBottom: '0.75rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📊</span>
              <span>Cancellation Reason Analysis</span>
            </div>
            <span style={{ fontSize: '0.82rem', background: '#fee2e2', color: '#991b1b', fontWeight: 600, padding: '3px 10px', borderRadius: '9999px' }}>
              Total: {cancellationAnalysis.total} {cancellationAnalysis.total === 1 ? 'cancellation' : 'cancellations'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {cancellationAnalysis.breakdown.map((item) => (
              <div key={item.reason} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{item.reason}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>({item.count} {item.count === 1 ? 'order' : 'orders'})</span>
                    <span style={{ fontWeight: 700, color: '#b91c1c', minWidth: '40px', textAlign: 'right' }}>{item.percentage}%</span>
                  </div>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${item.percentage}%`,
                      background: 'linear-gradient(90deg, #f87171, #dc2626)',
                      borderRadius: '9999px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancellation Submissions List */}
      {cancellationList.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '2.5rem' }}>
          {cancellationList.map((entry) => {
            const isDeleting = deletingId === entry.id;
            return (
              <div
                key={entry.id}
                style={{
                  border: '1px solid #fee2e2',
                  borderRadius: '12px',
                  padding: '1.1rem 1.25rem',
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  transition: 'opacity 0.2s ease',
                  opacity: isDeleting ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>
                      #{entry.orderNumber}
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      background: entry.paymentMethod === 'cod' ? '#fef3c7' : '#dcfce7',
                      color: entry.paymentMethod === 'cod' ? '#92400e' : '#166534',
                      textTransform: 'uppercase',
                    }}>
                      {entry.paymentMethod}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                      ₹{entry.amount.toFixed(2)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                      {formatDate(entry.cancelledAt)}
                    </span>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleDeleteCancellation(entry.id, entry.orderNumber)}
                      aria-label={`Delete feedback for order #${entry.orderNumber}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: '#dc2626',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isDeleting) {
                          e.currentTarget.style.background = '#dc2626';
                          e.currentTarget.style.color = '#fff';
                          e.currentTarget.style.borderColor = '#dc2626';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isDeleting) {
                          e.currentTarget.style.background = '#fef2f2';
                          e.currentTarget.style.color = '#dc2626';
                          e.currentTarget.style.borderColor = '#fecaca';
                        }
                      }}
                    >
                      {isDeleting ? (
                        <span>Deleting...</span>
                      ) : (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                          <span>Delete</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '0.65rem 0.9rem',
                  fontSize: '0.9rem',
                  color: '#991b1b',
                  fontWeight: 500,
                  lineHeight: 1.45,
                  margin: '0.5rem 0',
                }}>
                  <span style={{ fontWeight: 700, marginRight: '0.4rem' }}>Reason:</span>
                  {entry.cancellationReason}
                </div>

                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                  Customer: <strong>{entry.userName || 'Customer'}</strong> {entry.userEmail ? `(${entry.userEmail})` : ''}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2.5rem' }}>No order cancellation feedback yet.</p>
      )}
    </div>
  );
}
