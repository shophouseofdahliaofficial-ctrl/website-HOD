'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import styles from './HowWasItModal.module.css';

type OrderForRating = { id: string; items?: { productId?: number | null }[] };

interface HowWasItModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderForRating | null;
  /** Required when the order has multiple products; sent to the API as productId */
  productId?: number | null;
  onSubmitSuccess?: () => void;
}

const WO_OPTIONS = ['Yes', 'Maybe', 'No'] as const;

export default function HowWasItModal({ isOpen, onClose, order, productId: productIdProp, onSubmitSuccess }: HowWasItModalProps) {
  const { showToast } = useToast();
  const [qualityStars, setQualityStars] = useState(0);
  const [deliveryAgentStars, setDeliveryAgentStars] = useState(0);
  const [onTimeStars, setOnTimeStars] = useState(0);
  const [valueForMoneyStars, setValueForMoneyStars] = useState(0);
  const [wouldOrderAgain, setWouldOrderAgain] = useState<'Yes' | 'Maybe' | 'No' | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setQualityStars(0);
    setDeliveryAgentStars(0);
    setOnTimeStars(0);
    setValueForMoneyStars(0);
    setWouldOrderAgain(null);
    setReviewComment('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!order?.id) return;
    const distinctProductIds = new Set(
      (order.items || []).map((i) => i.productId).filter((id): id is number => id != null && Number.isFinite(id))
    );
    const pid =
      productIdProp != null && Number.isFinite(productIdProp)
        ? productIdProp
        : distinctProductIds.size === 1
          ? [...distinctProductIds][0]
          : null;
    if (distinctProductIds.size > 1 && pid == null) {
      showToast('Missing product for this rating', 'error');
      return;
    }
    if (qualityStars < 1 || qualityStars > 5 || deliveryAgentStars < 1 || deliveryAgentStars > 5 ||
        onTimeStars < 1 || onTimeStars > 5 || valueForMoneyStars < 1 || valueForMoneyStars > 5 ||
        !wouldOrderAgain) {
      showToast('Please rate all sections and choose Would you order again', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post<{ qualityStars: number; productId?: number }>(
        `/api/orders/${order.id}/detailed-feedback`,
        {
          qualityStars,
          deliveryAgentStars,
          onTimeStars,
          valueForMoneyStars,
          wouldOrderAgain,
          ...(pid != null ? { productId: pid } : {}),
          ...(reviewComment.trim() ? { comment: reviewComment.trim() } : {}),
        }
      );
      showToast('Thank you for your feedback!', 'success');
      onSubmitSuccess?.();
      handleClose();
    } catch (e: unknown) {
      const msg = (e && typeof e === 'object' && 'message' in e) ? String((e as { message?: string }).message) : 'Failed to submit';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const StarRow = (
    { value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }
  ) => (
    <div className={styles.starRow}>
      <div className={styles.subTitle}>{label}</div>
      <div
        className={styles.stars}
        data-level={value >= 1 && value <= 5 ? value : undefined}
        role="group"
        aria-label={`${label}, ${value} of 5 stars`}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`${styles.star} ${value >= n ? styles.starActive : ''}`}
            onClick={() => onChange(n)}
            aria-pressed={value >= n}
            aria-label={`${n} star`}
          >
            <svg className={styles.starIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557L3.04 10.385a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.111z" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={handleClose} aria-label="Close">×</button>
        <h2 className={styles.title}>How was it?</h2>

        {StarRow({ value: qualityStars, onChange: setQualityStars, label: 'Quality of the product' })}
        {StarRow({ value: deliveryAgentStars, onChange: setDeliveryAgentStars, label: 'Delivery agent behaviour' })}
        {StarRow({ value: onTimeStars, onChange: setOnTimeStars, label: 'On time delivery' })}
        {StarRow({ value: valueForMoneyStars, onChange: setValueForMoneyStars, label: 'Value for money' })}

        <div className={styles.starRow}>
          <div className={styles.subTitle}>Would you order again</div>
          <div className={styles.woRow} role="group" aria-label="Would you order again">
            {WO_OPTIONS.map((o) => (
              <button
                key={o}
                type="button"
                className={`${styles.woBtn} ${wouldOrderAgain === o ? styles.woBtnActive : ''}`}
                onClick={() => setWouldOrderAgain(o)}
                aria-pressed={wouldOrderAgain === o}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.starRow}>
          <div className={styles.subTitle}>Write a review (optional)</div>
          <textarea
            className={styles.reviewTextarea}
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value.slice(0, 500))}
            placeholder="Share your experience with this product..."
            rows={4}
            maxLength={500}
            aria-label="Review message"
          />
          <div className={styles.reviewTextareaMeta}>{reviewComment.length}/500</div>
        </div>

        <button
          type="button"
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
