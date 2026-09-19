'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { adminCouponsApi, Coupon, CreateCouponInput } from '@/lib/api';
import LoadingSpinner, { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import styles from './page.module.css';
import { useToast } from '@/contexts/ToastContext';

/**
 * Admin Coupons Page
 * Manage discount coupon codes
 */
export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState<CreateCouponInput>({
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: 0,
    minPurchaseAmount: 0,
    maxDiscountAmount: null,
    usageLimit: null,
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: null,
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sort, setSort] = useState<'codeAsc' | 'codeDesc' | 'createdDesc' | 'expiryAsc'>('createdDesc');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchExpandRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetchCoupons();
  }, []);

  useEffect(() => {
    if (!searchExpanded) return;
    const onDown = (e: MouseEvent) => {
      const el = searchExpandRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      setSearchExpanded(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [searchExpanded]);

  const fetchCoupons = async () => {
    try {
      const data = await adminCouponsApi.getAll();
      setCoupons(data);
    } catch (error) {
      console.error('Failed to fetch coupons:', error);
      showToast('Failed to load coupons', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const dataToSend = {
        ...formData,
        code: formData.code.toUpperCase().trim(),
        discountValue: parseFloat(formData.discountValue.toString()),
        minPurchaseAmount: formData.minPurchaseAmount ? parseFloat(formData.minPurchaseAmount.toString()) : 0,
        maxDiscountAmount: formData.maxDiscountAmount ? parseFloat(formData.maxDiscountAmount.toString()) : null,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit.toString(), 10) : null,
        validFrom: formData.validFrom || new Date().toISOString(),
        validUntil: formData.validUntil || null,
      };

      if (editingCoupon) {
        await adminCouponsApi.update(editingCoupon.id, dataToSend);
        showToast('Coupon updated successfully', 'success');
      } else {
        await adminCouponsApi.create(dataToSend);
        showToast('Coupon created successfully', 'success');
      }

      handleCancel();
      fetchCoupons();
    } catch (error: unknown) {
      console.error('Failed to save coupon:', error);
      showToast(error instanceof Error ? error.message : 'Failed to save coupon', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minPurchaseAmount: coupon.minPurchaseAmount || 0,
      maxDiscountAmount: coupon.maxDiscountAmount || null,
      usageLimit: coupon.usageLimit || null,
      validFrom: coupon.validFrom.split('T')[0],
      validUntil: coupon.validUntil ? coupon.validUntil.split('T')[0] : null,
      isActive: coupon.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) {
      return;
    }

    try {
      await adminCouponsApi.delete(id);
      showToast('Coupon deleted successfully', 'success');
      fetchCoupons();
    } catch (error) {
      console.error('Failed to delete coupon:', error);
      showToast('Failed to delete coupon', 'error');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingCoupon(null);
    setFormData({
      code: '',
      description: '',
      discountType: 'percentage',
      discountValue: 0,
      minPurchaseAmount: 0,
      maxDiscountAmount: null,
      usageLimit: null,
      validFrom: new Date().toISOString().split('T')[0],
      validUntil: null,
      isActive: true,
    });
  };

  const filtered = useMemo(() => {
    return coupons
      .filter((c) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return c.code.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q);
      })
      .filter((c) => {
        if (statusFilter === 'all') return true;
        return statusFilter === 'active' ? c.isActive : !c.isActive;
      })
      .sort((a, b) => {
        if (sort === 'codeAsc') return a.code.localeCompare(b.code);
        if (sort === 'codeDesc') return b.code.localeCompare(a.code);
        if (sort === 'expiryAsc') {
          const aDate = a.validUntil ? new Date(a.validUntil).getTime() : Infinity;
          const bDate = b.validUntil ? new Date(b.validUntil).getTime() : Infinity;
          return aDate - bDate;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [coupons, query, statusFilter, sort]);

  const isExpired = (coupon: Coupon) => {
    if (!coupon.validUntil) return false;
    return new Date(coupon.validUntil) < new Date();
  };

  const isUsageLimitReached = (coupon: Coupon) => {
    if (!coupon.usageLimit) return false;
    return coupon.usedCount >= coupon.usageLimit;
  };

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
        <LoadingSpinnerWithText text="Loading coupons..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {!showForm && (
        <>
          <div className={styles.headerRow}>
            <div>
              <h1 className={adminStyles.adminPageTitle}>Coupons</h1>
              <div className={styles.subtitle}>
                {filtered.length} coupon{filtered.length !== 1 ? 's' : ''} shown
                {coupons.length !== filtered.length ? ` (filtered from ${coupons.length})` : ''}
              </div>
            </div>
            <button type="button" onClick={() => setShowForm(true)} className={`${adminStyles.adminButton} ${styles.addCouponDesktop}`}>
              Add Coupon
            </button>
            <button type="button" onClick={() => setShowForm(true)} className={styles.addCouponIconLink} aria-label="Add new coupon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className={`${styles.toolbar} ${searchExpanded ? styles.toolbarSearchExpanded : ''}`}>
            <div className={styles.searchSlot} ref={searchExpandRef}>
              <div className={styles.searchWrap}>
                <span className={styles.searchIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.5-3.5" />
                  </svg>
                </span>
                <input
                  className={styles.searchInput}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setSearchExpanded(true)}
                  placeholder="Search by code or description…"
                  aria-label="Search coupons"
                />
              </div>
            </div>

            <div className={styles.filterSlot}>
              <CustomSelect<'all' | 'active' | 'inactive'>
                value={statusFilter}
                onChange={setStatusFilter}
                modalTitle="Status"
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
              />

              <CustomSelect<'codeAsc' | 'codeDesc' | 'createdDesc' | 'expiryAsc'>
                value={sort}
                onChange={setSort}
                modalTitle="Sort"
                options={[
                  { value: 'createdDesc', label: 'Sort: Recently created' },
                  { value: 'codeAsc', label: 'Sort: Code (A → Z)' },
                  { value: 'codeDesc', label: 'Sort: Code (Z → A)' },
                  { value: 'expiryAsc', label: 'Sort: Expiry (soonest)' },
                ]}
              />
            </div>
          </div>

          <div className={styles.panel}>
            {filtered.length === 0 ? (
              <div className={styles.emptyState}>No coupons found. Try clearing filters or create a new coupon.</div>
            ) : (
              <table className={styles.table}>
                <thead className={styles.thead}>
                  <tr>
                    <th className={styles.th}>Code</th>
                    <th className={styles.th}>Discount</th>
                    <th className={styles.th}>Usage</th>
                    <th className={styles.th}>Validity</th>
                    <th className={styles.th}>Status</th>
                    <th className={styles.th} style={{ textAlign: 'right' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((coupon) => {
                    const expired = isExpired(coupon);
                    const limitReached = isUsageLimitReached(coupon);
                    const discountText =
                      coupon.discountType === 'percentage' ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} OFF`;

                    return (
                      <tr key={coupon.id} className={styles.row}>
                        <td className={styles.td}>
                          <div className={styles.couponCell}>
                            <div className={styles.couponCode}>{coupon.code}</div>
                            {coupon.description && <div className={styles.couponMeta}>{coupon.description}</div>}
                          </div>
                        </td>
                        <td className={styles.td}>
                          <div className={styles.discountBlock}>
                            <div className={styles.discountMain}>{discountText}</div>
                            {coupon.minPurchaseAmount != null && coupon.minPurchaseAmount > 0 && (
                              <div className={styles.discountSub}>Min: ₹{coupon.minPurchaseAmount}</div>
                            )}
                            {coupon.maxDiscountAmount != null && (
                              <div className={styles.discountSub}>Max: ₹{coupon.maxDiscountAmount}</div>
                            )}
                          </div>
                        </td>
                        <td className={styles.td}>
                          <div className={styles.usageBlock}>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>
                              {coupon.usedCount}
                              {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ''}
                            </span>
                            {limitReached && <span className={`${styles.badge} ${styles.badgeWarning}`}>Limit Reached</span>}
                          </div>
                        </td>
                        <td className={styles.td}>
                          <div className={styles.validityBlock}>
                            <div>From: {new Date(coupon.validFrom).toLocaleDateString()}</div>
                            {coupon.validUntil ? (
                              <div className={expired ? styles.expiredText : ''}>
                                Until: {new Date(coupon.validUntil).toLocaleDateString()}
                              </div>
                            ) : (
                              <div className={styles.noExpiry}>No expiry</div>
                            )}
                            {expired && <span className={`${styles.badge} ${styles.badgeExpired}`}>Expired</span>}
                          </div>
                        </td>
                        <td className={styles.td}>
                          <span className={`${styles.badge} ${coupon.isActive ? styles.badgeActive : styles.badgeInactive}`}>
                            {coupon.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className={styles.td}>
                          <div className={styles.actions}>
                            <button type="button" onClick={() => handleEdit(coupon)} className={styles.linkButton}>
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(coupon.id)}
                              className={`${styles.linkButton} ${styles.deleteButton}`}
                              aria-label="Delete coupon"
                              title="Delete coupon"
                            >
                              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className={styles.cards}>
            {filtered.length === 0 ? (
              <div className={styles.card}>
                <div className={styles.emptyState} style={{ padding: '1rem' }}>
                  No coupons found. Try clearing filters or create a new coupon.
                </div>
              </div>
            ) : (
              filtered.map((coupon) => {
                const expired = isExpired(coupon);
                const limitReached = isUsageLimitReached(coupon);
                const discountText =
                  coupon.discountType === 'percentage' ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} OFF`;

                return (
                  <div className={styles.card} key={coupon.id}>
                    <div className={styles.cardTop}>
                      <div className={styles.cardTitleBlock}>
                        <div className={styles.couponCode}>{coupon.code}</div>
                        {coupon.description ? <div className={styles.couponMeta}>{coupon.description}</div> : null}
                      </div>
                      <div className={styles.cardBadges}>
                        <span className={`${styles.badge} ${coupon.isActive ? styles.badgeActive : styles.badgeInactive}`}>
                          {coupon.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {expired ? <span className={`${styles.badge} ${styles.badgeExpired}`}>Expired</span> : null}
                        {limitReached ? <span className={`${styles.badge} ${styles.badgeWarning}`}>Limit</span> : null}
                      </div>
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.kv}>
                        <div className={styles.kvLabel}>DISCOUNT</div>
                        <div className={styles.kvValue}>{discountText}</div>
                        {coupon.minPurchaseAmount != null && coupon.minPurchaseAmount > 0 ? (
                          <div className={styles.kvSub}>Min cart: ₹{coupon.minPurchaseAmount}</div>
                        ) : null}
                        {coupon.maxDiscountAmount != null ? (
                          <div className={styles.kvSub}>Max off: ₹{coupon.maxDiscountAmount}</div>
                        ) : null}
                      </div>
                      <div className={styles.kv}>
                        <div className={styles.kvLabel}>USAGE</div>
                        <div className={styles.kvValue}>
                          {coupon.usedCount}
                          {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ' (unlimited)'}
                        </div>
                      </div>
                      <div className={`${styles.kv} ${styles.kvWide}`}>
                        <div className={styles.kvLabel}>VALIDITY</div>
                        <div className={styles.kvValue}>
                          From {new Date(coupon.validFrom).toLocaleDateString()}
                          {coupon.validUntil ? (
                            <span className={expired ? styles.expiredText : ''}>
                              {' '}
                              → {new Date(coupon.validUntil).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className={styles.noExpiry}> · No expiry</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={styles.cardActions}>
                      <button type="button" onClick={() => handleEdit(coupon)} className={styles.linkButton}>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(coupon.id)}
                        className={`${styles.linkButton} ${styles.deleteButton}`}
                        aria-label="Delete coupon"
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {showForm && (
        <div className={styles.formPanel}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>{editingCoupon ? 'Edit Coupon' : 'Add New Coupon'}</h2>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handleCancel();
              }}
              className={styles.backLink}
            >
              ← Back to Coupons
            </a>
          </div>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Coupon Code *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className={styles.input}
                placeholder="SAVE20"
                required
                maxLength={50}
              />
              <div className={styles.helpText}>Code will be automatically converted to uppercase</div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Description (optional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className={styles.textarea}
                placeholder="Coupon description"
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label className={styles.label}>Discount Type *</label>
                <select
                  value={formData.discountType}
                  onChange={(e) => setFormData({ ...formData, discountType: e.target.value as 'percentage' | 'fixed' })}
                  className={styles.select}
                  required
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (₹)</option>
                </select>
              </div>

              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label className={styles.label}>Discount Value *</label>
                <input
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })}
                  className={styles.input}
                  placeholder={formData.discountType === 'percentage' ? '20' : '100'}
                  required
                  min="0"
                  step={formData.discountType === 'percentage' ? '1' : '0.01'}
                  max={formData.discountType === 'percentage' ? '100' : undefined}
                />
                <div className={styles.helpText}>{formData.discountType === 'percentage' ? 'Maximum 100%' : 'Amount in ₹'}</div>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label className={styles.label}>Minimum Purchase Amount (₹)</label>
                <input
                  type="number"
                  value={formData.minPurchaseAmount || 0}
                  onChange={(e) => setFormData({ ...formData, minPurchaseAmount: parseFloat(e.target.value) || 0 })}
                  className={styles.input}
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
                <div className={styles.helpText}>Minimum cart value required (0 = no minimum)</div>
              </div>

              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label className={styles.label}>Maximum Discount Amount (₹)</label>
                <input
                  type="number"
                  value={formData.maxDiscountAmount || ''}
                  onChange={(e) => setFormData({ ...formData, maxDiscountAmount: e.target.value ? parseFloat(e.target.value) : null })}
                  className={styles.input}
                  placeholder="Optional"
                  min="0"
                  step="0.01"
                />
                <div className={styles.helpText}>Maximum discount cap (only for percentage discounts)</div>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label className={styles.label}>Usage Limit</label>
                <input
                  type="number"
                  value={formData.usageLimit || ''}
                  onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value ? parseInt(e.target.value, 10) : null })}
                  className={styles.input}
                  placeholder="Unlimited"
                  min="1"
                />
                <div className={styles.helpText}>Maximum uses (leave empty for unlimited)</div>
              </div>

              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label className={styles.label}>Valid From *</label>
                <input
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  className={styles.input}
                  required
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Valid Until</label>
              <input
                type="date"
                value={formData.validUntil || ''}
                onChange={(e) => setFormData({ ...formData, validUntil: e.target.value || null })}
                className={styles.input}
                min={formData.validFrom}
              />
              <div className={styles.helpText}>Leave empty for no expiry date</div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className={styles.checkbox}
                />
                Active
              </label>
            </div>

            <div className={styles.formActions}>
              <button type="submit" disabled={submitting} className={styles.saveButton}>
                {submitting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <LoadingSpinner size="small" />
                    Saving...
                  </span>
                ) : editingCoupon ? (
                  'Update Coupon'
                ) : (
                  'Create Coupon'
                )}
              </button>
              <button type="button" onClick={handleCancel} className={styles.cancelButton}>
                Cancel
              </button>
            </div>
          </form>
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
    const mq = window.matchMedia('(max-width: 720px)');
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
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, useModal]);

  useEffect(() => {
    if (open && useModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
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
      <button
        type="button"
        className={styles.selectButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
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
