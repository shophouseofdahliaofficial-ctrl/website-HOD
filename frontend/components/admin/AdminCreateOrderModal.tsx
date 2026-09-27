'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { adminProductsApi, apiClient } from '@/lib/api';
import { contentApi, type SiteContent } from '@/lib/api/content';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import type { Product } from '@/types';
import styles from '@/app/admin/products/page.module.css';

type Line = { productId: string; variationId: string; quantity: number };

type VariationOption = {
  id: string;
  size: string;
  price: number;
};

function productIdKey(id: string | number | null | undefined): string {
  return id != null && id !== '' ? String(id) : '';
}

function emptyLine(): Line {
  return { productId: '', variationId: '', quantity: 1 };
}

function getProductVariations(detail: Product | undefined): VariationOption[] {
  if (!detail) return [];
  const basePrice =
    detail.sellingPrice !== null && detail.sellingPrice !== undefined
      ? Number(detail.sellingPrice)
      : Number(detail.pricePerLitre || 0);

  const results: VariationOption[] = [];
  const seenKeys = new Set<string>();

  // 1. Check customization options & combinations
  const rawCustomizationOptions = Array.isArray(detail.customizationOptions)
    ? detail.customizationOptions
    : typeof detail.customizationOptions === 'string'
      ? (() => {
          try {
            const p = JSON.parse(detail.customizationOptions);
            return Array.isArray(p) ? p : [];
          } catch {
            return [];
          }
        })()
      : [];

  const eligibleGroups = rawCustomizationOptions.filter((g: any) => {
    if (!g || g.type === 'text_input' || g.type === 'uploads') return false;
    return Array.isArray(g.values) && g.values.length > 0;
  });

  const rawCombinations = Array.isArray(detail.customizationCombinations)
    ? detail.customizationCombinations
    : typeof detail.customizationCombinations === 'string'
      ? (() => {
          try {
            const p = JSON.parse(detail.customizationCombinations);
            return Array.isArray(p) ? p : [];
          } catch {
            return [];
          }
        })()
      : [];

  const findValueName = (groupId: string, valId: string): string => {
    const grp = eligibleGroups.find((g: any) => String(g.id) === String(groupId));
    if (!grp) return String(valId);
    const val = grp.values.find((v: any) => String(v.id) === String(valId));
    return val?.name || val?.title || val?.label || String(valId);
  };

  const findValueAddon = (groupId: string, valId: string): number => {
    const grp = eligibleGroups.find((g: any) => String(g.id) === String(groupId));
    if (!grp) return 0;
    const val = grp.values.find((v: any) => String(v.id) === String(valId));
    return typeof val?.price === 'number' && Number.isFinite(val.price) ? Number(val.price) : 0;
  };

  // If explicit combinations exist
  const activeCombinations = rawCombinations.filter((c: any) => c.isActive !== false);
  if (activeCombinations.length > 0) {
    for (const combo of activeCombinations) {
      const keys = combo.combinationKeys || {};
      const parts: string[] = [];
      let calculatedAddon = 0;

      for (const [gId, vId] of Object.entries(keys)) {
        const vName = findValueName(gId, String(vId));
        parts.push(vName);
        calculatedAddon += findValueAddon(gId, String(vId));
      }

      const comboPrice =
        combo.price !== null && combo.price !== undefined && Number.isFinite(Number(combo.price))
          ? Number(combo.price)
          : basePrice + calculatedAddon;

      const comboLabel = parts.length > 0 ? parts.join(' / ') : combo.name || `Option #${combo.id}`;
      const key = `combo_${combo.id || parts.join('_')}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        results.push({
          id: String(combo.id || key),
          size: comboLabel,
          price: Math.round(comboPrice * 100) / 100,
        });
      }
    }
  }

  // If no explicit combinations or we have eligible groups:
  if (results.length === 0 && eligibleGroups.length > 0) {
    if (eligibleGroups.length === 1) {
      // Single group (e.g. Size: XS, S, M, L, XL)
      const grp = eligibleGroups[0];
      const vals = grp.values.filter((v: any) => v.isActive !== false);
      for (const val of vals) {
        const valName = val.name || val.title || val.label || 'Option';
        const addon = typeof val.price === 'number' && Number.isFinite(val.price) ? Number(val.price) : 0;
        const key = `val_${val.id || valName}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          results.push({
            id: String(val.id),
            size: valName,
            price: Math.round((basePrice + addon) * 100) / 100,
          });
        }
      }
    } else {
      // Multiple groups (e.g. Size + Color): generate Cartesian combinations
      const activeValuesPerGroup = eligibleGroups
        .map((grp: any) => ({
          groupId: grp.id,
          groupTitle: grp.title || 'Option',
          values: (grp.values || []).filter((v: any) => v.isActive !== false),
        }))
        .filter((g: any) => g.values.length > 0);

      if (activeValuesPerGroup.length > 0) {
        let combinations: Array<{ ids: string[]; names: string[]; addonSum: number }> = [
          { ids: [], names: [], addonSum: 0 },
        ];
        for (const grp of activeValuesPerGroup) {
          const nextCombos: Array<{ ids: string[]; names: string[]; addonSum: number }> = [];
          for (const existing of combinations) {
            for (const val of grp.values) {
              const valName = val.name || val.title || val.label || 'Option';
              const addon = typeof val.price === 'number' && Number.isFinite(val.price) ? Number(val.price) : 0;
              nextCombos.push({
                ids: [...existing.ids, String(val.id)],
                names: [...existing.names, valName],
                addonSum: existing.addonSum + addon,
              });
            }
          }
          combinations = nextCombos;
          if (combinations.length > 100) break;
        }

        if (combinations.length > 0 && combinations.length <= 100) {
          for (const c of combinations) {
            const label = c.names.join(' / ');
            const id = c.ids.join('__');
            if (!seenKeys.has(id)) {
              seenKeys.add(id);
              results.push({
                id,
                size: label,
                price: Math.round((basePrice + c.addonSum) * 100) / 100,
              });
            }
          }
        } else {
          // If combinations are too large, list all group values with group title prefix
          for (const grp of activeValuesPerGroup) {
            for (const val of grp.values) {
              const valName = val.name || val.title || val.label || 'Option';
              const addon = typeof val.price === 'number' && Number.isFinite(val.price) ? Number(val.price) : 0;
              const label = `${grp.groupTitle}: ${valName}`;
              const key = `val_${val.id}`;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                results.push({
                  id: String(val.id),
                  size: label,
                  price: Math.round((basePrice + addon) * 100) / 100,
                });
              }
            }
          }
        }
      }
    }
  }

  // 2. Check detail.variations (from product_variations table)
  const realVariations = (detail.variations || []).filter((v) => v.isAvailable !== false);
  const meaningfulVariations = realVariations.filter((v) => {
    const s = String(v.size || '').trim().toLowerCase();
    if (results.length > 0 && (!s || s === 'size')) return false;
    return true;
  });

  if (meaningfulVariations.length > 0) {
    for (const v of meaningfulVariations) {
      const mult = v.priceMultiplier !== null && v.priceMultiplier !== undefined ? Number(v.priceMultiplier) : 1;
      const price = v.price !== null && v.price !== undefined ? Number(v.price) : basePrice * mult;
      const key = `pv_${v.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        results.push({
          id: String(v.id),
          size: v.size || `Size #${v.id}`,
          price: Math.round(price * 100) / 100,
        });
      }
    }
  }

  return results;
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
      : Number(product.pricePerLitre || 0);
  const vars = getProductVariations(product);
  if (vars.length > 0 && variationId) {
    const match = vars.find((v) => v.id === String(variationId));
    if (match) return match.price;
  }
  return basePrice;
}

function lineIsComplete(line: Line, detail: Product | undefined): boolean {
  if (!line.productId || !detail) return false;
  const vars = getProductVariations(detail);
  if (vars.length > 0) {
    if (!line.variationId) return false;
    if (!vars.some((v) => v.id === String(line.variationId))) return false;
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

  // Pre-seed cache with activeProducts
  useEffect(() => {
    if (activeProducts.length > 0) {
      setDetailsByProductId((prev) => {
        const next = { ...prev };
        for (const p of activeProducts) {
          const k = productIdKey(p.id);
          if (k && !next[k]) {
            next[k] = p;
          }
        }
        return next;
      });
    }
  }, [activeProducts]);

  useEffect(() => {
    if (!open) return;
    setLines([emptyLine()]);
    setCustomerName('');
    setPhone('');
    setStreet('');
    setCity('');
    setStateVal('');
    setPostalCode('');
    setCustomerEmail('');
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
    if (cached && (cached.variations !== undefined || cached.customizationOptions !== undefined)) {
      return cached;
    }

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
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim());
    if (!filledAddr) return false;
    if (!Number.isFinite(deliveryChargesNum)) return false;
    if (completedLines.length < 1) return false;
    return true;
  }, [
    customerName,
    phone,
    street,
    city,
    stateVal,
    postalCode,
    customerEmail,
    deliveryChargesNum,
    completedLines.length,
  ]);

  const submitBlockReason = useMemo(() => {
    if (submitting) return null;
    if (completedLines.length < 1) {
      const pending = lines.find((line) => line.productId);
      if (!pending) return 'Add at least one product.';
      const det = resolveProductDetail(pending.productId, detailsByProductId);
      if (!det) return 'Loading product details…';
      const available = getProductVariations(det);
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) return 'Enter a valid customer email.';
    if (!Number.isFinite(deliveryChargesNum)) return 'Enter valid delivery charges (0 or more).';
    return null;
  }, [
    submitting,
    completedLines.length,
    lines,
    detailsByProductId,
    customerName,
    phone,
    street,
    city,
    stateVal,
    postalCode,
    customerEmail,
    deliveryChargesNum,
  ]);

  const onProductChange = async (index: number, productId: string) => {
    const key = productIdKey(productId);
    const initialDetail = activeProducts.find((p) => String(p.id) === key);
    if (initialDetail) {
      setDetailsByProductId((prev) => ({ ...prev, [key]: initialDetail }));
    }

    const available = getProductVariations(initialDetail);
    const autoVariationId = available.length === 1 ? available[0].id : '';

    setLines((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        productId: key,
        variationId: autoVariationId,
        quantity: Math.max(1, next[index].quantity),
      };
      return next;
    });

    if (!key) return;
    const fullDetail = await loadProductDetail(key);
    if (fullDetail) {
      const updatedVars = getProductVariations(fullDetail);
      if (updatedVars.length === 1) {
        setLines((prev) => {
          const line = prev[index];
          if (!line || line.variationId === updatedVars[0].id) return prev;
          const next = [...prev];
          next[index] = { ...line, variationId: updatedVars[0].id };
          return next;
        });
      }
    }
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
      const items = completedLines.map((l) => {
        const isNumericVar = l.variationId && /^\d+$/.test(l.variationId);
        const detail = resolveProductDetail(l.productId, detailsByProductId);
        const vars = getProductVariations(detail);
        const selectedVar = vars.find((v) => v.id === l.variationId);
        const unitPrice = detail ? lineUnitPrice(detail, l.variationId || null) : 0;
        return {
          productId: Number.parseInt(l.productId, 10),
          variationId: isNumericVar ? Number.parseInt(l.variationId, 10) : null,
          variationSize: selectedVar ? selectedVar.size : null,
          unitPrice,
          quantity: Number.parseInt(String(l.quantity), 10),
        };
      });

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
      });

      onCreated?.();
      onClose();
    } catch (e: unknown) {
      setSubmitError(
        typeof e === 'object' && e && 'message' in e
          ? String((e as { message: string }).message)
          : 'Failed to create order',
      );
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
          Order is placed directly for the customer. Address is stored on this order.
        </p>

        <section className={styles.createOrderSection}>
          <h3 className={styles.createOrderSectionTitle}>Products</h3>
          {lines.map((line, index) => {
            const detail = resolveProductDetail(line.productId, detailsByProductId);
            const variations = getProductVariations(detail);
            const lineKey = productIdKey(line.productId);
            const isLoadingLine = lineKey ? loadingProductIds.has(lineKey) : false;
            const lineLoadError = lineKey ? productLoadErrors[lineKey] : undefined;

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
                  {line.productId && isLoadingLine && variations.length === 0 ? (
                    <p className={styles.createOrderEmailMeta}>Loading product…</p>
                  ) : null}
                  {lineLoadError ? <p className={styles.createOrderEmailBad}>{lineLoadError}</p> : null}
                  {line.productId && variations.length > 0 ? (
                    <label className={styles.createOrderLabel}>
                      Variation
                      <select
                        className={styles.createOrderInput}
                        value={line.variationId}
                        onChange={(e) => onVariationChange(index, e.target.value)}
                      >
                        <option value="">— Size / Option —</option>
                        {variations.map((v) => (
                          <option key={v.id} value={String(v.id)}>
                            {v.size} {v.price ? `(₹${v.price})` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
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
          <h3 className={styles.createOrderSectionTitle}>Delivery Address</h3>
          <div className={styles.createOrderGrid}>
            <label className={styles.createOrderLabel}>
              Customer name
              <input
                className={styles.createOrderInput}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Full Name"
              />
            </label>
            <label className={styles.createOrderLabel}>
              Phone
              <input
                className={styles.createOrderInput}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
              />
            </label>
            <label className={`${styles.createOrderLabel} ${styles.createOrderFull}`}>
              Street
              <input
                className={styles.createOrderInput}
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Street address, house no."
              />
            </label>
            <label className={styles.createOrderLabel}>
              City
              <input
                className={styles.createOrderInput}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
              />
            </label>
            <label className={styles.createOrderLabel}>
              State
              <input
                className={styles.createOrderInput}
                value={stateVal}
                onChange={(e) => setStateVal(e.target.value)}
                placeholder="State"
              />
            </label>
            <label className={styles.createOrderLabel}>
              Postal code
              <input
                className={styles.createOrderInput}
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="6-digit PIN"
                inputMode="numeric"
                maxLength={6}
              />
            </label>
          </div>
        </section>

        <section className={styles.createOrderSection}>
          <label className={styles.createOrderLabel}>
            Customer email
            <input
              type="email"
              className={`${styles.createOrderInput} ${
                emailLookup === 'registered'
                  ? styles.createOrderInputOk
                  : ''
              }`}
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="customer@example.com"
              autoComplete="off"
            />
          </label>
          {emailLookup === 'loading' ? <p className={styles.createOrderEmailMeta}>Checking customer email…</p> : null}
          {emailLookup === 'registered' ? <p className={styles.createOrderEmailOk}>✓ Registered account found (will link to customer account)</p> : null}
          {emailLookup === 'unregistered' ? (
            <p className={styles.createOrderEmailMeta} style={{ color: '#0369a1' }}>
              ℹ Guest order (no existing account required, order will be created)
            </p>
          ) : null}
        </section>

        <section className={styles.createOrderSection}>
          <h3 className={styles.createOrderSectionTitle}>Payment</h3>
          <div className={styles.createOrderPayRow}>
            <label className={styles.createOrderRadio}>
              <input
                type="radio"
                name="pay"
                checked={paymentKind === 'prepaid'}
                onChange={() => setPaymentKind('prepaid')}
              />
              Prepaid
            </label>
            <label className={styles.createOrderRadio}>
              <input
                type="radio"
                name="pay"
                checked={paymentKind === 'cod'}
                onChange={() => setPaymentKind('cod')}
              />
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
              placeholder="0"
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

  return createPortal(portal, document.body);
}
