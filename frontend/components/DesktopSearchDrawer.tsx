'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Product } from '@/types';
import { getPrimaryProductImageUrl, getOrderedProductImageUrls } from '@/lib/utils/productImages';
import { getCardPriceDisplay } from '@/lib/utils/productCardPricing';
import ProductCardImage from '@/components/ui/ProductCardImage';
import cardStyles from '@/components/ProductsSection.module.css';
import headerStyles from '@/components/Header.module.css';
import styles from './DesktopSearchDrawer.module.css';

interface DesktopSearchDrawerProps {
  onClose: () => void;
  allProducts: Product[] | null;
  isSearchProductsLoading?: boolean;
  categoryMap: Map<string, string>;
}

export default function DesktopSearchDrawer({
  onClose,
  allProducts,
  isSearchProductsLoading = false,
  categoryMap,
}: DesktopSearchDrawerProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input on drawer open
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const filteredProducts = useMemo(() => {
    if (!allProducts || allProducts.length === 0) return [];

    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      return allProducts.slice(0, 16);
    }

    return allProducts.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const categoryName = p.categoryId ? (categoryMap.get(String(p.categoryId)) || '').toLowerCase() : '';
      const tags = Array.isArray(p.tags) ? p.tags.join(' ').toLowerCase() : '';

      return (
        name.includes(q) ||
        desc.includes(q) ||
        categoryName.includes(q) ||
        tags.includes(q)
      );
    });
  }, [allProducts, searchQuery, categoryMap]);

  const handleProductClick = (productId: string | number) => {
    onClose();
    router.push(`/product/${productId}`);
  };

  return (
    <div className={styles.searchDrawerContainer}>
      {/* Header Bar */}
      <div className={styles.searchHeader}>
        <h3 className={styles.searchHeaderTitle}>Search Products</h3>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close search"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Search Input Bar */}
      <div className={styles.searchBarWrapper}>
        <form onSubmit={(e) => e.preventDefault()} className={headerStyles.desktopSearchForm}>
          <div className={headerStyles.desktopSearchIcon}>
            <svg className={headerStyles.desktopSearchIconSvg} viewBox="0 -0.5 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M5.5 11.1455C5.49956 8.21437 7.56975 5.69108 10.4445 5.11883C13.3193 4.54659 16.198 6.08477 17.32 8.79267C18.4421 11.5006 17.495 14.624 15.058 16.2528C12.621 17.8815 9.37287 17.562 7.3 15.4895C6.14763 14.3376 5.50014 12.775 5.5 11.1455Z" stroke="#7d7d7d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
              <path d="M15.989 15.4905L19.5 19.0015" stroke="#7d7d7d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search Anything"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={headerStyles.desktopSearchInput}
          />
        </form>
      </div>

      {/* Results Area (2 Products Per Row with ProductsSection_productCard design) */}
      <div className={styles.resultsScrollArea} data-lenis-prevent>
        <div className={styles.resultsHeader}>
          <span className={styles.resultsCount}>
            {searchQuery.trim()
              ? `${filteredProducts.length} ${filteredProducts.length === 1 ? 'Product' : 'Products'} Found`
              : 'Trending Products'}
          </span>
        </div>

        {isSearchProductsLoading ? (
          <div className={styles.loadingSpinner}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'spin 1s linear infinite' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
              <path d="M12 2C6.477 2 2 6.477 2 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span>Loading products...</span>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className={styles.productsGrid}>
            {filteredProducts.map((product) => {
              const imageUrl = getPrimaryProductImageUrl(product) || '';
              const isOutOfStock = product.isActive === false || (typeof product.quantity === 'number' && product.quantity <= 0);
              const categoryLabel = product.categoryId
                ? categoryMap.get(String(product.categoryId)) || 'Collection'
                : 'Collection';
              const priceDisplay = getCardPriceDisplay(product, '₹');

              return (
                <div
                  key={product.id}
                  className={`${cardStyles.productCard} ${isOutOfStock ? cardStyles.productCardOutOfStock : ''}`}
                  onClick={() => handleProductClick(product.id)}
                >
                  <div className={`${cardStyles.productImage} ${styles.productImage}`} style={imageUrl ? { aspectRatio: 'auto' } : undefined}>
                    {isOutOfStock && (
                      <div className={cardStyles.outOfStockBadge}>Out of stock</div>
                    )}
                    <ProductCardImage
                      src={imageUrl}
                      alt={product.name}
                      hoverSrc={product.hoverNextImage ? getOrderedProductImageUrls(product)[1] : undefined}
                    />
                  </div>

                  <div className={cardStyles.productInfo}>
                    <div className={`${cardStyles.productTitleRow} ${styles.productTitleRow}`}>
                      <h3 className={`${cardStyles.productName} ${styles.productName}`}>{product.name}</h3>
                      <span className={`${cardStyles.productPrice} ${styles.productPrice}`}>{priceDisplay}</span>
                    </div>

                    <div className={`${cardStyles.productCategoryRow} ${styles.productCategoryRow}`}>
                      <div className={`${cardStyles.productCategory} ${styles.productCategory}`}>
                        {categoryLabel}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            <h4 className={styles.emptyTitle}>No matching products</h4>
            <p className={styles.emptyDesc}>
              We couldn&apos;t find any products matching &quot;{searchQuery}&quot;. Try searching for another term.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
