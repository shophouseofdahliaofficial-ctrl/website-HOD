'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import HowWasItModal from '@/components/HowWasItModal';
import { useToast } from '@/contexts/ToastContext';
import CustomerSidebarLayout from '@/components/customer/CustomerSidebarLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import styles from './page.module.css';

type DetailedFeedback = {
  qualityStars: number;
  deliveryAgentStars: number | null;
  onTimeStars: number | null;
  valueForMoneyStars: number | null;
  wouldOrderAgain: string | null;
};

type DeliveredLine = {
  orderItemId: string;
  orderId: string;
  orderNumber: string;
  productId: number;
  productName: string;
  variationSize: string | null;
  quantity: number;
  lineTotal: number;
  imageUrl: string | null;
  deliveredAt: string | null;
  orderedAt: string | null;
  detailedFeedback: DetailedFeedback | null;
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${month}, ${year}`;
}

function FeedbackSummary({ df }: { df: DetailedFeedback }) {
  const row = (label: string, stars: number | null) => (
    <div className={styles.detailedFeedbackRow}>
      <span>{label}</span>
      <span className={styles.detailedFeedbackStars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= (stars ?? 0) ? styles.starFilled : styles.starEmpty}>
            ★
          </span>
        ))}
      </span>
    </div>
  );
  return (
    <div className={styles.detailedFeedbackReadOnly}>
      {row('Quality of the product', df.qualityStars)}
      {row('On time delivery', df.onTimeStars)}
      {row('Value for money', df.valueForMoneyStars)}
      <div className={styles.detailedFeedbackRow}>
        <span>Would you order again</span>
        <span>{df.wouldOrderAgain || '—'}</span>
      </div>
    </div>
  );
}

/**
 * My Account → Reviews: delivered order lines; rate via How was it? or show submitted data.
 */
export default function ReviewsPage() {
  const [lines, setLines] = useState<DeliveredLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [modalLine, setModalLine] = useState<DeliveredLine | null>(null);
  const { showToast } = useToast();

  const fetchLines = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await apiClient.get<DeliveredLine[]>('/api/orders/review-deliverables');
      setLines(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : 'Could not load reviews';
      setLines([]);
      setFetchError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchLines();
  }, [fetchLines]);

  if (loading) {
    return (
      <CustomerSidebarLayout>
        <LoadingSpinner fullHeight />
      </CustomerSidebarLayout>
    );
  }

  return (
    <CustomerSidebarLayout>
      <div className={styles.page}>
        <h1 className={styles.title}>My Reviews</h1>

        {fetchError ? (
          <div className={styles.empty}>
            <p className={styles.errorText}>Couldn&apos;t load your reviews.</p>
            <p className={styles.errorHint}>{fetchError}</p>
            <button type="button" className={styles.retryBtn} onClick={() => fetchLines()}>
              Try again
            </button>
          </div>
        ) : lines.length === 0 ? (
          <div className={styles.empty}>
            <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path
                d="M168.958 155.927C176.737 130.329 183.098 111.177 188.041 98.4702C195.455 79.4104 212.356 53.1502 212.356 60.1603C212.356 67.1705 239.365 153.837 243.921 155.927C248.477 158.016 327.888 156.593 326.992 160.124C326.097 163.655 327.188 164.541 317.314 170.331C310.732 174.19 287.62 191.086 247.979 221.017C245.644 221.991 245.882 224.949 248.692 229.891C252.907 237.304 265.034 277.871 269.41 290.528C273.786 303.186 282.717 337.149 278.251 340.628C273.786 344.108 252.431 322.129 247.979 317.222C243.527 312.314 212.356 253.79 204.271 253.79C196.186 253.79 178.108 279.57 174.148 284.216C170.187 288.862 128.921 336.672 114.124 338.65C99.3259 340.628 104.105 328.539 114.124 309.534C120.803 296.863 134.107 267.309 154.037 220.87C144.027 216.395 135.15 212.906 127.406 210.401C115.791 206.644 79.1085 194.473 73.9807 192.933C68.8528 191.392 84.9287 184.462 96.8396 177.396C108.751 170.331 135.032 160.124 149.953 160.124"
                stroke="#000000"
                strokeOpacity="0.35"
                strokeWidth="16"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p>No delivered products to review yet.</p>
            <p style={{ marginTop: '0.75rem', color: '#666' }}>When an order is delivered, it will show up here.</p>
            <Link href="/products" className={styles.browseLink}>
              Browse products
            </Link>
          </div>
        ) : (
          <div className={styles.list}>
            {lines.map((line) => {
              const df = line.detailedFeedback;
              const done = df != null && df.qualityStars >= 1;
              return (
                <article key={line.orderItemId} className={styles.card}>
                  <div className={styles.imageWrap}>
                    {line.imageUrl ? (
                      <img src={line.imageUrl} alt="" />
                    ) : (
                      <div className={styles.placeholder} aria-hidden>
                        📦
                      </div>
                    )}
                  </div>
                  <div className={styles.body}>
                    <h2 className={styles.productName}>{line.productName}</h2>
                    <div className={styles.meta}>
                      <span>
                        Order{' '}
                        <Link href={`/orders/${line.orderId}`}>#{line.orderNumber}</Link>
                      </span>
                      {line.variationSize && <span>{line.variationSize}</span>}
                      <span>Qty: {line.quantity}</span>
                      <span>Delivered: {fmtDate(line.deliveredAt || line.orderedAt)}</span>
                      <span>Line total: ₹{line.lineTotal.toFixed(2)}</span>
                    </div>
                    <div className={styles.actions}>
                      {done ? (
                        <button type="button" className={styles.doneBtn} disabled>
                          Review done
                        </button>
                      ) : (
                        <button type="button" className={styles.rateBtn} onClick={() => setModalLine(line)}>
                          Rate this product
                        </button>
                      )}
                    </div>
                    {done && df ? <FeedbackSummary df={df} /> : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <HowWasItModal
          isOpen={modalLine !== null}
          onClose={() => setModalLine(null)}
          order={
            modalLine
              ? { id: modalLine.orderId, items: [{ productId: modalLine.productId }] }
              : null
          }
          onSubmitSuccess={() => {
            setModalLine(null);
            fetchLines();
          }}
        />
      </div>
    </CustomerSidebarLayout>
  );
}
