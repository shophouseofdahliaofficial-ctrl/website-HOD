'use client';

import { useEffect, useState } from 'react';
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
  photobookEditor?: {
    total: number;
    avgRating: number | null;
    byIssueType: Record<string, number>;
    issueLabels?: Record<string, string>;
    recent: Array<{
      id: string;
      issueType: string;
      issueLabel: string;
      rating: number;
      message: string | null;
      userEmail: string | null;
      userName: string | null;
      productName: string | null;
      createdAt: string;
    }>;
  };
  general?: Array<{
    id: string;
    userId: string | null;
    email: string;
    message: string;
    createdAt: string;
    userName: string | null;
  }>;
};

/**
 * Admin Feedback Page
 * Shows emoji feedback counts and percentages (Least likely, Neutral, Most likely)
 */
export default function AdminFeedbackPage() {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
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

  const pb = s.photobookEditor || {
    total: 0,
    avgRating: null,
    byIssueType: {},
    recent: [],
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

  const issueEntries = Object.entries(pb.byIssueType || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1 className={adminStyles.adminPageTitle}>Feedback</h1>
      <p style={{ color: '#64748b', marginTop: '0.5rem', marginBottom: '2rem' }}>
        How likely are customers to recommend you? (From delivered order feedback)
      </p>

      <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>
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

      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Photobook editor feedback</h2>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: '1.25rem', fontSize: '0.9rem' }}>
        Submitted from the photobook editor help menu.
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <div style={{ background: '#fdf2f8', border: '1px solid #fbcfe8', borderRadius: '12px', padding: '1rem 1.25rem', minWidth: '140px' }}>
          <div style={{ fontSize: '0.85rem', color: '#9d174d', marginBottom: '0.25rem' }}>Total submissions</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#be185d' }}>{pb.total}</div>
        </div>
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '1rem 1.25rem', minWidth: '140px' }}>
          <div style={{ fontSize: '0.85rem', color: '#92400e', marginBottom: '0.25rem' }}>Average rating</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#b45309' }}>
            {pb.avgRating != null ? `${pb.avgRating} ★` : '—'}
          </div>
        </div>
      </div>

      {issueEntries.length > 0 ? (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Issues reported</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {issueEntries.map(([key, count]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.9rem', padding: '0.45rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span>{pb.issueLabels?.[key] || key}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {pb.recent.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '2.5rem' }}>
          <div style={{ fontWeight: 600 }}>Recent submissions</div>
          {pb.recent.map((entry) => (
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
                <strong style={{ fontSize: '0.95rem' }}>{entry.issueLabel}</strong>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{formatDate(entry.createdAt)}</span>
              </div>
              <div style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '0.35rem' }}>
                Rating: {'★'.repeat(entry.rating)}{'☆'.repeat(5 - entry.rating)}
              </div>
              {entry.message ? (
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.875rem', lineHeight: 1.45, color: '#334155' }}>
                  {entry.message}
                </p>
              ) : null}
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                {[entry.userEmail || entry.userName, entry.productName].filter(Boolean).join(' · ') || 'Anonymous'}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2.5rem' }}>No photobook editor feedback yet.</p>
      )}

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

      <div style={{ marginTop: '1.5rem' }}>
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
    </div>
  );
}
