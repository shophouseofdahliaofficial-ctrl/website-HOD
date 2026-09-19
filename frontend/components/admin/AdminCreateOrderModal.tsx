'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { adminProductsApi } from '@/lib/api';
import { apiClient } from '@/lib/api';
import { contentApi, type SiteContent } from '@/lib/api/content';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import type { Product, ProductVariation } from '@/types';
import AdminOrderMapLocationModal from '@/components/admin/AdminOrderMapLocationModal';
import styles from '@/app/admin/products/page.module.css';

type LiveLocationChoice = '' | 'yes' | 'no';

type Line = { productId: string; variationId: string; quantity: number };

function productIdKey(id: string | number | null | undefined): string {
  return id != null && id !== '' ? String(id) : '';
}

function emptyLine(): Line {
  return { productId: '', variationId: '', quantity: 1 };
}

function getAvailableVariations(detail: Product | undefined): ProductVariation[] {
  if (!detail?.variations?.length) return [];
  return detail.variations.filter((v) => v.isAvailable !== false);
}

function resolveProductDetail(
  productId: string,
  detailsByProductId: Record<string, Product>,
): Product | undefined {
  const key = productIdKey(productId);
  if (!key) return undefined;
  return detailsByProductId[key];
}

function parsePlatformFeeAmount(c: SiteContent | null): number {
  if (!c) return 0;
  const meta = Number(c.metadata?.amount);
  if (Number.isFinite(meta) && meta > 0) return Math.round(meta * 100) / 100;
  const title = Number(c.title);
  if (Number.isFinite(title) && title > 0) return Math.round(title * 100) / 100;
  return 0;
}

function lineUnitPrice(product: Product, variationId: string | null): number {
  const basePrice =
    product.sellingPrice !== null && product.sellingPrice !== undefined
      ? Number(product.sellingPrice)
      : Number(product.pricePerLitre);
  const variations = (product.variations || []).filter((v) => v.isAvailable !== false);
  const variation = variationId ? variations.find((v) => String(v.id) === String(variationId)) : null;
  const mult =
    variation?.priceMultiplier !== null && variation?.priceMultiplier !== undefined
      ? Number(variation.priceMultiplier)
      : 1;
  if (variation?.price !== null && variation?.price !== undefined) {
    return Number(variation.price);
  }
  return basePrice * mult;
}

function lineIsComplete(line: Line, detail: Product | undefined): boolean {
  if (!line.productId || !detail) return false;
  const allVariations = detail.variations || [];
  const availableVariations = getAvailableVariations(detail);
  if (allVariations.length > 0) {
    if (availableVariations.length === 0) return false;
    if (!line.variationId) return false;
    if (!availableVariations.some((v) => String(v.id) === String(line.variationId))) return false;
  }
  const q = Number(line.quantity);
  return Number.isFinite(q) && q >= 1;
}

function getCompletedLines(lines: Line[], detailsByProductId: Record<string, Product>): Line[] {
  return lines.filter((line) => {
    const detail = resolveProductDetail(line.productId, detailsByProductId);
    return lineIsComplete(line, detail);
  });
}

type EmailLookup = 'idle' | 'loading' | 'registered' | 'unregistered';

type Props = {
  open: boolean;
  onClose: () => void;
  activeProducts: Product[];
  onCreated?: () => void;
};

export default function AdminCreateOrderModal({ open, onClose, activeProducts, onCreated }: Props) {
  const [mounted, setMounted] = useState(false);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [detailsByProductId, setDetailsByProductId] = useState<Record<string, Product>>({});
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [liveLocationChoice, setLiveLocationChoice] = useState<LiveLocationChoice>('');
  const [liveLocation, setLiveLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapLocationOpen, setMapLocationOpen] = useState(false);
  const [emailLookup, setEmailLookup] = useState<EmailLookup>('idle');
  const [paymentKind, setPaymentKind] = useState<'prepaid' | 'cod'>('cod');
  const [deliveryChargesStr, setDeliveryChargesStr] = useState('0');
  const [platformFee, setPlatformFee] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [productLoadErrors, setProductLoadErrors] = useState<Record<string, string>>({});
  const [loadingProductIds, setLoadingProductIds] = useState<Set<string>>(() => new Set());
  const loadingProductIdsRef = useRef(new Set<string>());
  const detailsByProductIdRef = useRef(detailsByProductId);
  detailsByProductIdRef.current = detailsByProductId;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const c = await contentApi.getByType('platform_fee');
        if (!cancelled) setPlatformFee(parsePlatformFeeAmount(c));
      } catch {
        if (!cancelled) setPlatformFee(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLines([emptyLine()]);
    setDetailsByProductId({});
    setCustomerName('');
    setPhone('');
    setStreet('');
    setCity('');
    setStateVal('');
    setPostalCode('');
    setCustomerEmail('');
    setLiveLocationChoice('');
    setLiveLocation(null);
    setMapLocationOpen(false);
    setEmailLookup('idle');
    setPaymentKind('cod');
    setDeliveryChargesStr('0');
    setSubmitError('');
    setSubmitting(false);
    setProductLoadErrors({});
    setLoadingProductIds(new Set());
    loadingProductIdsRef.current.clear();
  }, [open]);

  const loadProductDetail = async (productId: string): Promise<Product | null> => {
    const key = productIdKey(productId);
    if (!key) return null;
    if (loadingProductIdsRef.current.has(key)) return null;

    const cached = detailsByProductIdRef.current[key];
    if (cached) return cached;

    loadingProductIdsRef.current.add(key);
    setLoadingProductIds((prev) => new Set(prev).add(key));
    setProductLoadErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

    try {
      const p = await adminProductsApi.getById(key);
      const normalizedKey = productIdKey(p.id) || key;
      setDetailsByProductId((prev) => ({ ...prev, [normalizedKey]: p }));
      return p;
    } catch (e: unknown) {
      const message =
        typeof e === 'object' && e && 'message' in e
          ? String((e as { message: string }).message)
          : 'Could not load product details';
      setProductLoadErrors((prev) => ({ ...prev, [key]: message }));
      return null;
    } finally {
      loadingProductIdsRef.current.delete(key);
      setLoadingProductIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const maybeAppendEmptyLine = (prev: Line[], details: Record<string, Product>): Line[] => {
    if (prev.length === 0) return [emptyLine()];
    const last = prev[prev.length - 1];
    if (!last.productId) return prev;
    const det = resolveProductDetail(last.productId, details);
    if (!det || !lineIsComplete(last, det)) return prev;
    if (prev.length >= 25) return prev;
    return [...prev, emptyLine()];
  };

  useEffect(() => {
    if (!open) return;
    const email = customerEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailLookup('idle');
      return;
    }
    const t = window.setTimeout(() => {
      setEmailLookup('loading');
      void (async () => {
        try {
          const res = await apiClient.get<{ registered: boolean }>(
            `${API_ENDPOINTS.ADMIN.CUSTOMERS.LOOKUP_EMAIL}?email=${encodeURIComponent(email)}`,
          );
          setEmailLookup(res.registered ? 'registered' : 'unregistered');
        } catch {
          setEmailLookup('idle');
        }
      })();
    }, 450);
    return () => window.clearTimeout(t);
  }, [customerEmail, open]);

  useEffect(() => {
    if (!open) return;
    setLines((prev) => maybeAppendEmptyLine(prev, detailsByProductId));
  }, [open, lines, detailsByProductId]);

  const deliveryChargesNum = useMemo(() => {
    const n = Number.parseFloat(deliveryChargesStr);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
  }, [deliveryChargesStr]);

  const completedLines = useMemo(
    () => getCompletedLines(lines, detailsByProductId),
    [lines, detailsByProductId],
  );

  const subtotalPreview = useMemo(() => {
    let sum = 0;
    for (const line of completedLines) {
      const det = resolveProductDetail(line.productId, detailsByProductId);
      if (!det) continue;
      const unit = lineUnitPrice(det, line.variationId || null);
      sum += unit * Number(line.quantity);
    }
    return Math.round(sum * 100) / 100;
  }, [completedLines, detailsByProductId]);

  const totalPreview = useMemo(() => {
    if (!Number.isFinite(deliveryChargesNum)) return NaN;
    return Math.round((subtotalPreview + platformFee + deliveryChargesNum) * 100) / 100;
  }, [subtotalPreview, platformFee, deliveryChargesNum]);

  const canSubmit = useMemo(() => {
    const filledAddr =
      customerName.trim() &&
      phone.trim() &&
      street.trim() &&
      city.trim() &&
      stateVal.trim() &&
      /^\d{6}$/.test(postalCode.replace(/\D/g, '')) &&
      customerEmail.trim();
    if (!filledAddr) return false;
    if (emailLookup !== 'registered') return false;
    if (!Number.isFinite(deliveryChargesNum)) return false;
    if (completedLines.length < 1) return false;
    if (loadingProductIds.size > 0) return false;
    if (liveLocationChoice === 'yes' && !liveLocation) return false;
    return true;
  }, [
    customerName,
    phone,
    street,
    city,
    stateVal,
    postalCode,
    customerEmail,
    emailLookup,
    deliveryChargesNum,
    completedLines.length,
    loadingProductIds.size,
    liveLocationChoice,
    liveLocation,
  ]);

  const submitBlockReason = useMemo(() => {
    if (submitting) return null;
    if (loadingProductIds.size > 0) return 'Loading product details…';
    if (completedLines.length < 1) {
      const pending = lines.find((line) => line.productId);
      if (!pending) return 'Add at least one product.';
      const key = productIdKey(pending.productId);
      if (key && productLoadErrors[key]) return productLoadErrors[key];
      const det = resolveProductDetail(pending.productId, detailsByProductId);
      if (!det) return 'Loading product details…';
      const available = getAvailableVariations(det);
      const allCount = det.variations?.length ?? 0;
      if (allCount > 0 && available.length === 0) return 'No available sizes for the selected product.';
      if (available.length > 0 && !pending.variationId) return 'Select a size/variation for the product.';
      return 'Complete product quantity (at least 1).';
    }
    if (
      !customerName.trim() ||
      !phone.trim() ||
      !street.trim() ||
      !city.trim() ||
      !stateVal.trim() ||
      !/^\d{6}$/.test(postalCode.replace(/\D/g, ''))
    ) {
      return 'Fill in all delivery address fields (6-digit postal code).';
    }
    if (!customerEmail.trim()) return 'Enter the customer email.';
    if (emailLookup === 'loading') return 'Checking customer email…';
    if (emailLookup === 'unregistered') return 'Customer must have a registered account for this email.';
    if (emailLookup !== 'registered') return 'Enter a valid registered customer email.';
    if (!Number.isFinite(deliveryChargesNum)) return 'Enter valid delivery charges (0 or more).';
    if (liveLocationChoice === 'yes' && !liveLocation) return 'Set delivery location on the map.';
    return null;
  }, [
    submitting,
    loadingProductIds.size,
    completedLines.length,
    lines,
    productLoadErrors,
    detailsByProductId,
    customerName,
    phone,
    street,
    city,
    stateVal,
    postalCode,
    customerEmail,
    emailLookup,
    deliveryChargesNum,
    liveLocationChoice,
    liveLocation,
  ]);

  const onProductChange = async (index: number, productId: string) => {
    const key = productIdKey(productId);
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], productId: key, variationId: '', quantity: Math.max(1, next[index].quantity) };
      return next;
    });
    if (!key) return;
    const detail = await loadProductDetail(key);
    if (!detail) return;
    const available = getAvailableVariations(detail);
    if (available.length !== 1) return;
    const onlyId = String(available[0].id);
    setLines((prev) => {
      const line = prev[index];
      if (!line || String(line.variationId) === onlyId) return prev;
      const next = [...prev];
      next[index] = { ...line, variationId: onlyId };
      return next;
    });
  };

  const onVariationChange = (index: number, variationId: string) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], variationId };
      return maybeAppendEmptyLine(next, detailsByProductId);
    });
  };

  const onQtyChange = (index: number, qty: number) => {
    const q = Number.isFinite(qty) && qty >= 1 ? Math.floor(qty) : 1;
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: q };
      return maybeAppendEmptyLine(next, detailsByProductId);
    });
  };

  const removeLine = (index: number) => {
    setLines((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [emptyLine()];
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const postal = postalCode.replace(/\D/g, '').slice(0, 6);
      const items = completedLines.map((l) => ({
          productId: Number.parseInt(l.productId, 10),
          variationId: l.variationId ? Number.parseInt(l.variationId, 10) : null,
          quantity: Number.parseInt(String(l.quantity), 10),
        }));
      await apiClient.post(API_ENDPOINTS.ADMIN.ORDERS.MANUAL_CREATE, {
        customerName: customerName.trim(),
        phone: phone.trim(),
        street: street.trim(),
        city: city.trim(),
        state: stateVal.trim(),
        postalCode: postal,
        customerEmail: customerEmail.trim().toLowerCase(),
        paymentKind,
        deliveryCharges: deliveryChargesNum,
        items,
        ...(liveLocationChoice === 'yes' && liveLocation
          ? { latitude: liveLocation.latitude, longitude: liveLocation.longitude }
          : {}),
      });
      onCreated?.();
      onClose();
    } catch (e: unknown) {
      setSubmitError(typeof e === 'object' && e && 'message' in e ? String((e as { message: string }).message) : 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted || !open) return null;

  const portal = (
    <div
      className={styles.createOrderBackdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-lenis-prevent
    >
      <div className={styles.createOrderPanel} role="dialog" aria-modal="true" aria-labelledby="create-order-title">
        <button type="button" className={styles.createOrderClose} aria-label="Close" onClick={onClose}>
          ×
        </button>
        <h2 id="create-order-title" className={styles.createOrderTitle}>
          Create order
        </h2>
        <p className={styles.createOrderHint}>
          Order is placed for the customer account matching email. Address is stored on this order only (not saved to
          their address book).
        </p>

        <section className={styles.createOrderSection}>
          <h3 className={styles.createOrderSectionTitle}>Products</h3>
          {lines.map((line, index) => {
            const detail = resolveProductDetail(line.productId, detailsByProductId);
            const variations = getAvailableVariations(detail);
            const lineKey = productIdKey(line.productId);
            const isLoadingLine = lineKey ? loadingProductIds.has(lineKey) : false;
            const lineLoadError = lineKey ? productLoadErrors[lineKey] : undefined;
            const hasVariationsInCatalog = (detail?.variations?.length ?? 0) > 0;
            return (
              <div key={index} className={styles.createOrderLine}>
                <div className={styles.createOrderLineFields}>
                  <label className={styles.createOrderLabel}>
                    Select product
                    <select
                      className={styles.createOrderInput}
                      value={line.productId}
                      onChange={(e) => void onProductChange(index, e.target.value)}
                    >
                      <option value="">— Choose —</option>
                      {activeProducts.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {line.productId && isLoadingLine ? (
                    <p className={styles.createOrderEmailMeta}>Loading product…</p>
                  ) : null}
                  {lineLoadError ? <p className={styles.createOrderEmailBad}>{lineLoadError}</p> : null}
                  {line.productId && !isLoadingLine && variations.length > 0 ? (
                    <label className={styles.createOrderLabel}>
                      Variation
                      <select
                        className={styles.createOrderInput}
                        value={line.variationId}
                        onChange={(e) => onVariationChange(index, e.target.value)}
                      >
                        <option value="">— Size —</option>
                        {variations.map((v) => (
                          <option key={v.id} value={String(v.id)}>
                            {v.size}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {line.productId && !isLoadingLine && hasVariationsInCatalog && variations.length === 0 ? (
                    <p className={styles.createOrderEmailBad}>No available sizes for this product.</p>
                  ) : null}
                  <label className={styles.createOrderLabel}>
                    Qty
                    <input
                      type="number"
                      min={1}
                      className={styles.createOrderQty}
                      value={line.quantity}
                      onChange={(e) => onQtyChange(index, Number.parseInt(e.target.value, 10))}
                    />
                  </label>
                </div>
                {lines.length > 1 ? (
                  <button type="button" className={styles.createOrderRemoveLine} onClick={() => removeLine(index)}>
                    Remove
                  </button>
                ) : null}
              </div>
            );
          })}
        </section>

        <section className={styles.createOrderSection}>
          <h3 className={styles.createOrderSectionTitle}>Delivery (order only)</h3>
          <div className={styles.createOrderGrid}>
            <label className={styles.createOrderLabel}>
              Customer name
              <input className={styles.createOrderInput} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </label>
            <label className={styles.createOrderLabel}>
              Phone
              <input className={styles.createOrderInput} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className={`${styles.createOrderLabel} ${styles.createOrderFull}`}>
              Street
              <input className={styles.createOrderInput} value={street} onChange={(e) => setStreet(e.target.value)} />
            </label>
            <label className={styles.createOrderLabel}>
              City
              <input className={styles.createOrderInput} value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
            <label className={styles.createOrderLabel}>
              State
              <input className={styles.createOrderInput} value={stateVal} onChange={(e) => setStateVal(e.target.value)} />
            </label>
            <label className={styles.createOrderLabel}>
              Postal code
              <input
                className={styles.createOrderInput}
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                inputMode="numeric"
                maxLength={8}
              />
            </label>
          </div>
        </section>

        <section className={styles.createOrderSection}>
          <label className={styles.createOrderLabel}>
            Add Live location
            <select
              className={styles.createOrderInput}
              value={liveLocationChoice}
              onChange={(e) => {
                const v = e.target.value as LiveLocationChoice;
                setLiveLocationChoice(v);
                if (v !== 'yes') {
                  setLiveLocation(null);
                  setMapLocationOpen(false);
                }
              }}
            >
              <option value="">— Select —</option>
              <option value="yes">Yes (Inside Gwalior)</option>
              <option value="no">No (Outside Gwalior)</option>
            </select>
          </label>
          {liveLocationChoice === 'yes' ? (
            <div className={styles.createOrderLocationRow}>
              {liveLocation ? (
                <>
                  <span className={styles.createOrderLocationSet}>
                    Location set [{liveLocation.latitude.toFixed(6)}, {liveLocation.longitude.toFixed(6)}]
                  </span>
                  <button
                    type="button"
                    className={styles.createOrderLocationEdit}
                    aria-label="Change location"
                    onClick={() => setMapLocationOpen(true)}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
                      <path
                        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </>
              ) : (
                <button type="button" className={styles.createOrderSetLocationBtn} onClick={() => setMapLocationOpen(true)}>
                  Set location
                </button>
              )}
            </div>
          ) : null}
        </section>

        <section className={styles.createOrderSection}>
          <label className={styles.createOrderLabel}>
            Customer email (must be registered)
            <input
              type="email"
              className={`${styles.createOrderInput} ${
                emailLookup === 'registered'
                  ? styles.createOrderInputOk
                  : emailLookup === 'unregistered'
                    ? styles.createOrderInputBad
                    : ''
              }`}
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              autoComplete="off"
            />
          </label>
          {emailLookup === 'loading' ? <p className={styles.createOrderEmailMeta}>Checking…</p> : null}
          {emailLookup === 'registered' ? <p className={styles.createOrderEmailOk}>Account found</p> : null}
          {emailLookup === 'unregistered' ? <p className={styles.createOrderEmailBad}>No account for this email</p> : null}
        </section>

        <section className={styles.createOrderSection}>
          <h3 className={styles.createOrderSectionTitle}>Payment</h3>
          <div className={styles.createOrderPayRow}>
            <label className={styles.createOrderRadio}>
              <input type="radio" name="pay" checked={paymentKind === 'prepaid'} onChange={() => setPaymentKind('prepaid')} />
              Prepaid
            </label>
            <label className={styles.createOrderRadio}>
              <input type="radio" name="pay" checked={paymentKind === 'cod'} onChange={() => setPaymentKind('cod')} />
              COD
            </label>
          </div>
          <label className={styles.createOrderLabel}>
            Delivery charges (₹)
            <input
              className={styles.createOrderInput}
              value={deliveryChargesStr}
              onChange={(e) => setDeliveryChargesStr(e.target.value)}
              inputMode="decimal"
            />
          </label>
        </section>

        <section className={styles.createOrderSection}>
          <h3 className={styles.createOrderSectionTitle}>Breakdown</h3>
          <ul className={styles.createOrderBreakdown}>
            <li>
              <span>Subtotal</span>
              <span>₹{subtotalPreview.toFixed(2)}</span>
            </li>
            <li>
              <span>Platform fee</span>
              <span>₹{platformFee.toFixed(2)}</span>
            </li>
            <li>
              <span>Delivery charges</span>
              <span>{Number.isFinite(deliveryChargesNum) ? `₹${deliveryChargesNum.toFixed(2)}` : '—'}</span>
            </li>
            <li className={styles.createOrderBreakdownTotal}>
              <span>Total</span>
              <span>{Number.isFinite(totalPreview) ? `₹${totalPreview.toFixed(2)}` : '—'}</span>
            </li>
          </ul>
        </section>

        {submitError ? <p className={styles.createOrderError}>{submitError}</p> : null}
        {!canSubmit && submitBlockReason ? (
          <p className={styles.createOrderEmailMeta}>{submitBlockReason}</p>
        ) : null}

        <button
          type="button"
          className={styles.createOrderSubmit}
          disabled={!canSubmit || submitting}
          onClick={() => void handleSubmit()}
        >
          {submitting ? 'Creating…' : 'Create order'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(portal, document.body)}
      <AdminOrderMapLocationModal
        open={mapLocationOpen}
        onClose={() => setMapLocationOpen(false)}
        initialLatitude={liveLocation?.latitude}
        initialLongitude={liveLocation?.longitude}
        onConfirm={(coords) => setLiveLocation(coords)}
      />
    </>
  );
}
