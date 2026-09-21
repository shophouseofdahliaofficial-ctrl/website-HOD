'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { Product, ProductVariation } from '@/types';
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
  const [quantity, setQuantity] = useState<number>(1);
  const cardRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  // Active product source
  const currentProduct = productDetails || product;

  // Load detailed product if necessary (to get full variations or options)
  useEffect(() => {
    let isMounted = true;
    if (isOpen && product?.id) {
      setSelectedVariationId(null);
      setQuantity(1);
      
      // If product already has variations loaded
      if (product.variations && product.variations.length > 0) {
        const firstAvail = product.variations.find((v) => v.isAvailable) || product.variations[0];
        if (firstAvail) setSelectedVariationId(firstAvail.id);
      }

      // Fetch full details if needed
      productsApi
        .getById(product.id, true)
        .then((data) => {
          if (isMounted && data) {
            setProductDetails(data);
            if (data.variations && data.variations.length > 0) {
              const firstAvail = data.variations.find((v) => v.isAvailable) || data.variations[0];
              if (firstAvail) {
                setSelectedVariationId((prev) => prev || firstAvail.id);
              }
            }
          }
        })
        .catch(() => {});
    } else {
      setProductDetails(null);
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

  const variations = useMemo(() => {
    if (!currentProduct?.variations) return [];
    return [...currentProduct.variations].sort(
      (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
    );
  }, [currentProduct?.variations]);

  const selectedVariation: ProductVariation | null = useMemo(() => {
    if (!variations.length) return null;
    return variations.find((v) => v.id === selectedVariationId) || variations[0] || null;
  }, [variations, selectedVariationId]);

  // Price calculations
  const basePrice = useMemo(() => {
    if (!currentProduct) return 0;
    if (currentProduct.sellingPrice !== null && currentProduct.sellingPrice !== undefined && Number.isFinite(Number(currentProduct.sellingPrice))) {
      return Number(currentProduct.sellingPrice);
    }
    return Number(currentProduct.pricePerLitre || 0);
  }, [currentProduct]);

  const baseCompareAtPrice = useMemo(() => {
    if (!currentProduct) return null;
    if (currentProduct.compareAtPrice !== null && currentProduct.compareAtPrice !== undefined && Number.isFinite(Number(currentProduct.compareAtPrice))) {
      return Number(currentProduct.compareAtPrice);
    }
    return null;
  }, [currentProduct]);

  const unitPrice = useMemo(() => {
    if (!currentProduct) return 0;
    if (selectedVariation) {
      if (selectedVariation.price != null && Number.isFinite(Number(selectedVariation.price))) {
        return Number(selectedVariation.price);
      }
      const mult = Number(selectedVariation.priceMultiplier) || 1;
      return basePrice * mult;
    }
    return basePrice;
  }, [currentProduct, selectedVariation, basePrice]);

  const unitComparePrice = useMemo(() => {
    if (!currentProduct) return null;
    if (selectedVariation?.compareAtPrice != null && Number.isFinite(Number(selectedVariation.compareAtPrice))) {
      return Number(selectedVariation.compareAtPrice);
    }
    if (baseCompareAtPrice) {
      const mult = selectedVariation ? (Number(selectedVariation.priceMultiplier) || 1) : 1;
      return baseCompareAtPrice * mult;
    }
    return null;
  }, [currentProduct, selectedVariation, baseCompareAtPrice]);

  const totalPrice = unitPrice * quantity;
  const totalComparePrice = unitComparePrice ? unitComparePrice * quantity : null;

  if (!isOpen || !currentProduct) return null;

  const imageUrl = getPrimaryProductImageUrl(currentProduct) || (currentProduct as any).imageUrl || '';
  const isOutOfStock = currentProduct.isOutOfStock || (selectedVariation ? !selectedVariation.isAvailable : false);
  const maxQty = currentProduct.maxQuantity ?? 99;

  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (isOutOfStock) {
      showToast('Out of stock', 'error');
      return;
    }

    if (addBtnRef.current) {
      triggerSparkleBurst(addBtnRef.current);
    }

    const result = addItem(
      {
        productId: currentProduct.id,
        quantity,
        variationId: selectedVariation?.id,
      },
      currentProduct.maxQuantity
    );

    if (result.appliedQuantity <= 0) {
      showToast(`Maximum order quantity is ${maxQty}`, 'error');
      return;
    }

    showToast(
      result.ok ? `Added ${currentProduct.name} to cart` : `Maximum order quantity is ${maxQty}`,
      result.ok ? 'success' : 'error'
    );

    if (addBtnRef.current && imageUrl) {
      animateToCart({
        imageUrl,
        sourceElement: addBtnRef.current,
        targetElement: cartIconRefStore.getAny(),
      });
    }

    // Open desktop cart drawer if desktop
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      window.dispatchEvent(new CustomEvent('open-desktop-cart'));
    }

    onClose();
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        // Click outside the card closes modal
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
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={currentProduct.name}
                width={52}
                height={52}
                className={styles.productImg}
              />
            ) : (
              <div className={styles.productImg} style={{ background: '#e2e8f0' }} />
            )}
          </div>
          <div className={styles.headerInfo}>
            <h3 className={styles.productName} title={currentProduct.name}>
              {currentProduct.name}
            </h3>
            <span className={styles.categoryBadge}>
              {categoryName || currentProduct.variationLabel || currentProduct.variationTitle || 'Select option'}
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
          {variations.length > 0 && (
            <div className={styles.variationPicker}>
              <div className={styles.variationLabel}>
                <span>
                  {(currentProduct as any).variationGroupTitle ||
                    (currentProduct as any).variationTitle ||
                    (currentProduct as any).variationLabel ||
                    'Size / Style'}
                  :
                </span>
                {selectedVariation && (
                  <span className={styles.selectedValueText}>
                    {selectedVariation.size}
                  </span>
                )}
              </div>
              <div className={styles.variationsGrid}>
                {variations.map((v) => {
                  const isActive = v.id === selectedVariationId;
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
                      <span>{v.size}</span>
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
