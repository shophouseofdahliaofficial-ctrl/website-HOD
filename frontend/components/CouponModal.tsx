'use strict';

import React, { useEffect, useState } from 'react';
import styles from './CouponModal.module.css';
import { Coupon, couponsApi } from '@/lib/api/coupons';

interface CouponModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  platformFee: number;
  onApply: (code: string) => void;
}

const CouponModal: React.FC<CouponModalProps> = ({ isOpen, onClose, subtotal, platformFee, onApply }) => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);

  const cartTotal = subtotal + platformFee;

  useEffect(() => {
    if (isOpen) {
      fetchCoupons();
    }
  }, [isOpen]);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const activeCoupons = await couponsApi.listActive();
      setCoupons(activeCoupons);
    } catch (error) {
      console.error('Failed to fetch coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Categorize coupons based on product subtotal (matching checkout logic)
  const bestCoupons = coupons.filter(c => subtotal >= (c.minPurchaseAmount || 0));
  const moreOffers = coupons.filter(c => subtotal < (c.minPurchaseAmount || 0));

  const calculateSavings = (coupon: Coupon): number => {
    let savings = 0;
    if (coupon.discountType === 'percentage') {
      savings = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount && savings > coupon.maxDiscountAmount) {
        savings = coupon.maxDiscountAmount;
      }
    } else {
      savings = coupon.discountValue;
    }
    return Math.min(savings, subtotal);
  };

  const CouponCard = ({ coupon, isLocked = false }: { coupon: Coupon, isLocked?: boolean }) => {
    const savings = calculateSavings(coupon);
    
    return (
      <div 
        className={`${styles.couponCard} ${isLocked ? styles.lockedCard : ''}`}
        onClick={() => {
          if (!isLocked) {
            onApply(coupon.code);
            onClose();
          }
        }}
      >
        <div className={`${styles.couponLeft} ${!isLocked ? styles.bestCouponLeft : ''}`}>
          <div className={styles.discountText}>
            {coupon.discountType === 'percentage' ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} OFF`}
          </div>
        </div>
        <div className={styles.couponRight}>
          <div className={styles.cardHeader}>
            <span className={styles.couponCode}>{coupon.code}</span>
            <span className={styles.applyText}>{isLocked ? 'LOCKED' : 'APPLY'}</span>
          </div>
          
          {!isLocked ? (
            <p className={styles.savingsText}>Save ₹{savings.toFixed(0)} on this order!</p>
          ) : (
            <p className={styles.unlockText}>Add ₹{((coupon.minPurchaseAmount || 0) - subtotal).toFixed(0)} more to unlock</p>
          )}

          <hr className={styles.divider} />
          
          <p className={styles.couponDetails}>
            Use code {coupon.code} & get {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`} off on orders above ₹{coupon.minPurchaseAmount || 0}. 
            {coupon.maxDiscountAmount ? ` Maximum discount: ₹${coupon.maxDiscountAmount}.` : ''}
          </p>
          
          <div className={styles.moreText}>+ MORE</div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <h2 className={styles.modalTitle}>Available Coupons</h2>
            <p className={styles.cartTotalText}>Your cart: ₹{cartTotal.toFixed(2)}</p>
          </div>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody}>
          {loading ? (
            <div className={styles.emptyState}>Loading coupons...</div>
          ) : coupons.length === 0 ? (
            <div className={styles.emptyState}>No coupons available at the moment.</div>
          ) : (
            <>
              {bestCoupons.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Best coupons</h3>
                  {bestCoupons.map(coupon => (
                    <CouponCard key={coupon.id} coupon={coupon} />
                  ))}
                </div>
              )}

              {moreOffers.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>More offers</h3>
                  {moreOffers.map(coupon => (
                    <CouponCard key={coupon.id} coupon={coupon} isLocked={true} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CouponModal;
