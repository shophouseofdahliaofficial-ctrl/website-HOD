'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { Product, ProductVariation, VariationGroup, VariantValue } from '@/types';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { productsApi } from '@/lib/api';
import { getPrimaryProductImageUrl } from '@/lib/utils/productImages';
import { triggerSparkleBurst } from '@/lib/utils/sparkleBurst';
import { animateToCart } from '@/lib/utils/cartAnimation';
import { cartIconRefStore } from '@/lib/utils/cartIconRef';
import styles from './QuickAddModal.module.css';

interface QuickAddModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  categoryName?: string;
}

const removePriceFromName = (name: string): string => {
  if (!name) return '';
  return name.replace(/\s*(?:\(\s*[+-]?\s*(?:₹|Rs\.?)\s*\d+(?:\.\d+)?\s*\)|[+-]?\s*(?:₹|Rs\.?)\s*\d+(?:\.\d+)?)/gi, '').trim();
};

export default function QuickAddModal({
  product,
  isOpen,
  onClose,
  categoryName,
}: QuickAddModalProps) {
  const { addItem } = useCart();
  const { showToast } = useToast();
  const [productDetails, setProductDetails] = useState<Product | null>(null);
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);
  const [selectedCustomizations, setSelectedCustomizations] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState<number>(1);
  const cardRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  // Active product source (prefer detailed product once fetched, fallback to product prop)
  const displayProduct: Product | null = productDetails || product;

  // Load detailed product if necessary
  useEffect(() => {
    let isMounted = true;
    if (isOpen && product?.id) {
      setQuantity(1);
      setSelectedVariationId(null);
      setSelectedCustomizations({});

      // Fetch full details
      productsApi
        .getById(product.id, true)
        .then((data) => {
          if (isMounted && data) {
            setProductDetails(data);
          }
        })
        .catch(() => {});
    } else {
      setProductDetails(null);
      setSelectedVariationId(null);
      setSelectedCustomizations({});
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, product?.id]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Standard variations
  const variations: ProductVariation[] = useMemo(() => {
    if (!displayProduct?.variations) return [];
    return [...displayProduct.variations].sort(
      (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
    );
  }, [displayProduct?.variations]);

  // Active selected variation (always resolves to a valid variation if variations exist)
  const activeVariation: ProductVariation | null = useMemo(() => {
    if (!variations.length) return null;
    if (selectedVariationId) {
      const match = variations.find((v) => v.id === selectedVariationId);
      if (match) return match;
    }
    return variations.find((v) => v.isAvailable) || variations[0] || null;
  }, [variations, selectedVariationId]);

  // Customizable options
  const isCustomizable = Boolean(
    displayProduct?.isCustomizable &&
    displayProduct?.customizationOptions &&
    displayProduct.customizationOptions.length > 0
  );

  const customizationOptions: VariationGroup[] = useMemo(() => {
    if (!isCustomizable || !displayProduct?.customizationOptions) return [];
    return displayProduct.customizationOptions.filter(
      (g) => g.type !== 'text_input' && g.type !== 'uploads'
    );
  }, [isCustomizable, displayProduct?.customizationOptions]);

  // Effective customizations map (always resolves every group to an active value from frame 1)
  const effectiveCustomizations = useMemo(() => {
    const map: Record<string, string> = {};
    if (!customizationOptions.length) return map;

    customizationOptions.forEach((g) => {
      if (selectedCustomizations[g.id]) {
        map[g.id] = selectedCustomizations[g.id];
      } else if (g.values && g.values.length > 0) {
        const firstAvail = g.values.find((val) => (val as any).isActive !== false) || g.values[0];
        if (firstAvail) {
          map[g.id] = firstAvail.id;
        }
      }
    });
    return map;
  }, [customizationOptions, selectedCustomizations]);

  // Matching customization combination
  const currentCombination = useMemo(() => {
    if (!displayProduct?.customizationCombinations || displayProduct.customizationCombinations.length === 0) {
      return null;
    }
    const entries = Object.entries(effectiveCustomizations);
    if (entries.length === 0) return null;

    return displayProduct.customizationCombinations.find((combo) => {
      if (combo.isActive === false) return false;
      const keys = combo.combinationKeys || {};
      return Object.entries(keys).every(
        ([groupId, valueId]) => String(effectiveCustomizations[groupId]) === String(valueId)
      );
    });
  }, [displayProduct?.customizationCombinations, effectiveCustomizations]);

  // Base pricing
  const basePrice = useMemo(() => {
    if (!displayProduct) return 0;
    if (displayProduct.sellingPrice !== null && displayProduct.sellingPrice !== undefined && Number.isFinite(Number(displayProduct.sellingPrice))) {
      return Number(displayProduct.sellingPrice);
    }
    return Number(displayProduct.pricePerLitre || 0);
  }, [displayProduct]);

  const baseCompareAtPrice = useMemo(() => {
    if (!displayProduct) return null;
    if (displayProduct.compareAtPrice !== null && displayProduct.compareAtPrice !== undefined && Number.isFinite(Number(displayProduct.compareAtPrice))) {
      return Number(displayProduct.compareAtPrice);
    }
    return null;
  }, [displayProduct]);

  // Unit Price Calculation
  const unitPrice = useMemo(() => {
    if (!displayProduct) return 0;

    if (isCustomizable) {
      if (currentCombination?.price != null && Number.isFinite(Number(currentCombination.price))) {
        return Number(currentCombination.price);
      }
      let sum = basePrice;
      Object.entries(effectiveCustomizations).forEach(([groupId, valId]) => {
        const group = customizationOptions.find((g) => g.id === groupId);
        const val = group?.values?.find((v) => String(v.id) === String(valId));
        if (val && typeof val.price === 'number' && Number.isFinite(val.price)) {
          sum += val.price;
        }
      });
      return sum;
    }

    if (activeVariation) {
      if (activeVariation.price != null && Number.isFinite(Number(activeVariation.price))) {
        return Number(activeVariation.price);
      }
      const mult = Number(activeVariation.priceMultiplier) || 1;
      return basePrice * mult;
    }

    return basePrice;
  }, [displayProduct, isCustomizable, currentCombination, customizationOptions, effectiveCustomizations, activeVariation, basePrice]);

  // Unit Compare At Price Calculation
  const unitComparePrice = useMemo(() => {
    if (!displayProduct) return null;

    if (isCustomizable) {
      if (currentCombination?.compareAtPrice != null && Number.isFinite(Number(currentCombination.compareAtPrice))) {
        return Number(currentCombination.compareAtPrice);
      }
      if (baseCompareAtPrice != null) {
        let cmpSum = baseCompareAtPrice;
        Object.entries(effectiveCustomizations).forEach(([groupId, valId]) => {
          const group = customizationOptions.find((g) => g.id === groupId);
          const val = group?.values?.find((v) => String(v.id) === String(valId));
          if (val && typeof (val as any).compareAtPrice === 'number' && Number.isFinite((val as any).compareAtPrice)) {
            cmpSum += (val as any).compareAtPrice;
          }
        });
        return cmpSum;
      }
      return null;
    }

    if (activeVariation?.compareAtPrice != null && Number.isFinite(Number(activeVariation.compareAtPrice))) {
      return Number(activeVariation.compareAtPrice);
    }

    if (baseCompareAtPrice) {
      const mult = activeVariation ? (Number(activeVariation.priceMultiplier) || 1) : 1;
      return baseCompareAtPrice * mult;
    }

    return null;
  }, [displayProduct, isCustomizable, currentCombination, customizationOptions, effectiveCustomizations, activeVariation, baseCompareAtPrice]);

  const totalPrice = unitPrice * quantity;
  const totalComparePrice = unitComparePrice ? unitComparePrice * quantity : null;

  if (!isOpen || !displayProduct) return null;

  // Selected thumbnail image
  let activeImageUrl = getPrimaryProductImageUrl(displayProduct) || (displayProduct as any).imageUrl || '';
  if (isCustomizable) {
    for (const [groupId, valId] of Object.entries(effectiveCustomizations)) {
      const group = customizationOptions.find((g) => g.id === groupId);
      const val = group?.values?.find((v) => String(v.id) === String(valId));
      if ((val as any)?.imageUrl) {
        activeImageUrl = (val as any).imageUrl;
        break;
      }
    }
  }

  const isOutOfStock = displayProduct.isOutOfStock || (activeVariation ? !activeVariation.isAvailable : false);
  const maxQty = displayProduct.maxQuantity ?? 99;

  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (isOutOfStock) {
      showToast('Out of stock', 'error');
      return;
    }

    if (addBtnRef.current) {
      triggerSparkleBurst(addBtnRef.current);
    }

    const variationIdToUse = isCustomizable
      ? (currentCombination?.id ?? undefined)
      : (activeVariation?.id ?? undefined);

    const customizationsToPass = isCustomizable
      ? { selectedOptions: effectiveCustomizations }
      : undefined;

    const result = addItem(
      {
        productId: displayProduct.id,
        quantity,
        variationId: variationIdToUse,
        customizations: customizationsToPass,
      },
      displayProduct.maxQuantity
    );

    if (result.appliedQuantity <= 0) {
      showToast(`Maximum order quantity is ${maxQty}`, 'error');
      return;
    }

    showToast(
      result.ok ? `Added ${displayProduct.name} to cart` : `Maximum order quantity is ${maxQty}`,
      result.ok ? 'success' : 'error'
    );

    if (addBtnRef.current && activeImageUrl) {
      animateToCart({
        imageUrl: activeImageUrl,
        sourceElement: addBtnRef.current,
        targetElement: cartIconRefStore.getAny(),
      });
    }

    // Open desktop cart drawer if on desktop
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      window.dispatchEvent(new CustomEvent('open-desktop-cart'));
    }

    onClose();
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={cardRef}
        className={styles.card}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Product Preview & Close */}
        <div className={styles.header}>
          <div className={styles.imageWrapper}>
            {activeImageUrl ? (
              <Image
                src={activeImageUrl}
                alt={displayProduct.name}
                width={52}
                height={52}
                className={styles.productImg}
              />
            ) : (
              <div className={styles.productImg} style={{ background: '#e2e8f0' }} />
            )}
          </div>
          <div className={styles.headerInfo}>
            <h3 className={styles.productName} title={displayProduct.name}>
              {displayProduct.name}
            </h3>
            <span className={styles.categoryBadge}>
              {categoryName || displayProduct.variationLabel || displayProduct.variationTitle || 'Select option'}
            </span>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Body / Variations Section */}
        <div className={styles.body}>
          {/* Customization Options (if product is customizable) */}
          {isCustomizable && customizationOptions.map((g) => {
            const selectedValId = effectiveCustomizations[g.id];
            const selectedVal = (g.values || []).find((v) => String(v.id) === String(selectedValId));

            return (
              <div key={g.id} className={styles.variationPicker}>
                <div className={styles.variationLabel}>
                  <span>{g.title || 'Option'}:</span>
                  {selectedVal && (
                    <span className={styles.selectedValueText}>
                      {removePriceFromName(selectedVal.name)}
                    </span>
                  )}
                </div>

                {/* Color swatch palette */}
                {g.type === 'colour_palette' ? (
                  <div className={styles.colorSelectorPalette}>
                    {(g.values || []).map((val) => {
                      const isSelected = String(selectedValId) === String(val.id);
                      return (
                        <button
                          key={val.id}
                          type="button"
                          className={`${styles.colorSwatchWrapper} ${isSelected ? styles.colorSwatchActive : ''}`}
                          onClick={() => {
                            setSelectedCustomizations((prev) => ({ ...prev, [g.id]: val.id }));
                          }}
                          title={val.name}
                        >
                          <span
                            className={styles.colorSwatch}
                            style={{ backgroundColor: (val as any).hexCode || (val as any).colorHex || '#ccc' }}
                          />
                        </button>
                      );
                    })}
                  </div>
                ) : g.type === 'image_selector' ? (
                  /* Image selector cards */
                  <div className={styles.imageSelectorGrid}>
                    {(g.values || []).map((val) => {
                      const isSelected = String(selectedValId) === String(val.id);
                      return (
                        <button
                          key={val.id}
                          type="button"
                          className={`${styles.imageSelectorCard} ${isSelected ? styles.imageSelectorCardActive : ''}`}
                          onClick={() => {
                            setSelectedCustomizations((prev) => ({ ...prev, [g.id]: val.id }));
                          }}
                        >
                          {(val as any).imageUrl && (
                            <img src={(val as any).imageUrl} alt={val.name} className={styles.imageSelectorThumbnail} />
                          )}
                          <span>{removePriceFromName(val.name)}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* Standard button option chips */
                  <div className={styles.variationsGrid}>
                    {(g.values || []).map((val) => {
                      const isSelected = String(selectedValId) === String(val.id);
                      return (
                        <button
                          key={val.id}
                          type="button"
                          className={`${styles.variationButton} ${isSelected ? styles.variationActive : ''}`}
                          onClick={() => {
                            setSelectedCustomizations((prev) => ({ ...prev, [g.id]: val.id }));
                          }}
                        >
                          <span>{removePriceFromName(val.name)}</span>
                          {typeof val.price === 'number' && Number.isFinite(val.price) && val.price > 0 && (
                            <span className={styles.variationPriceTag}>
                              +₹{val.price.toFixed(0)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Standard Variations (if not customizable) */}
          {!isCustomizable && variations.length > 0 && (
            <div className={styles.variationPicker}>
              <div className={styles.variationLabel}>
                <span>
                  {(displayProduct as any).variationGroupTitle ||
                    (displayProduct as any).variationTitle ||
                    (displayProduct as any).variationLabel ||
                    'Size / Style'}
                  :
                </span>
                {activeVariation && (
                  <span className={styles.selectedValueText}>
                    {removePriceFromName(activeVariation.size)}
                  </span>
                )}
              </div>
              <div className={styles.variationsGrid}>
                {variations.map((v) => {
                  const isActive = v.id === activeVariation?.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={!v.isAvailable}
                      className={`${styles.variationButton} ${isActive ? styles.variationActive : ''} ${
                        !v.isAvailable ? styles.variationDisabled : ''
                      }`}
                      onClick={() => setSelectedVariationId(v.id)}
                    >
                      <span>{removePriceFromName(v.size)}</span>
                      {v.price != null && Number.isFinite(Number(v.price)) && (
                        <span className={styles.variationPriceTag}>
                          • ₹{Number(v.price).toFixed(0)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity Controls */}
          <div className={styles.quantityRow}>
            <span className={styles.quantityLabel}>Quantity</span>
            <div className={styles.quantityControls}>
              <button
                type="button"
                className={styles.qtyBtn}
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
              >
                -
              </button>
              <span className={styles.qtyNum}>{quantity}</span>
              <button
                type="button"
                className={styles.qtyBtn}
                disabled={quantity >= maxQty}
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Footer: Left = Total Price, Right = Add */}
        <div className={styles.footer}>
          <div className={styles.priceCol}>
            <span className={styles.priceLabel}>Total Price</span>
            <div className={styles.priceValues}>
              <span className={styles.totalPrice}>
                ₹ {totalPrice.toFixed(0)}
              </span>
              {totalComparePrice && totalComparePrice > totalPrice && (
                <span className={styles.comparePrice}>
                  ₹ {totalComparePrice.toFixed(0)}
                </span>
              )}
            </div>
          </div>

          <button
            ref={addBtnRef}
            type="button"
            className={styles.addButton}
            disabled={isOutOfStock}
            onClick={handleAddToCart}
          >
            {isOutOfStock ? 'Out of Stock' : '+ Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
