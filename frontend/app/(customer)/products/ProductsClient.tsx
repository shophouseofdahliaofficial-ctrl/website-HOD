'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { productsApi } from '@/lib/api';
import { Product } from '@/types';
import Image from 'next/image';
import { openProductPage } from '@/lib/utils/productNavigation';
import RatingBadge from '@/components/ui/RatingBadge';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { getFirstVariationForCard, getCardDiscountOff, getCardPriceDisplay, getProductDisplayUnitLabel } from '@/lib/utils/productCardPricing';
import { getPrimaryProductImageUrl, getOrderedProductImageUrls } from '@/lib/utils/productImages';
import { getAverageProductRating, getProductReviewCount } from '@/lib/utils/productReviewStats';
import { useCategoryMap } from '@/hooks/useCategoryMap';
import { triggerSparkleBurst } from '@/lib/utils/sparkleBurst';
import { animateToCart } from '@/lib/utils/cartAnimation';
import { cartIconRefStore } from '@/lib/utils/cartIconRef';
import QuickAddModal from '@/components/QuickAddModal';
import ProductCardImage from '@/components/ui/ProductCardImage';
import styles from './products.module.css';
import cardStyles from '@/components/ProductsSection.module.css';

/**
 * Products Page - Customer View (client component)
 * Displays all active products
 */
export default function ProductsClient({
  categoryFilter,
  title = 'Explore our Collection',
  allowedProductIds,
}: {
  categoryFilter?: string;
  title?: string;
  allowedProductIds?: string[];
} = {}) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();
  const categoryMap = useCategoryMap();
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);

  const filteredProducts = products.filter((product) => {
    if (allowedProductIds && !allowedProductIds.includes(product.id)) {
      return false;
    }
    if (categoryFilter) {
      const categoryLabel = product.categoryId
        ? categoryMap.get(product.categoryId)
        : null;
      return categoryLabel?.toLowerCase() === categoryFilter.toLowerCase();
    }
    return true;
  });

  // Sync favorites persistently from localStorage scoped to logged-in user
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user) {
      setFavorites({});
      return;
    }
    const favKey = `milko_favorites_u_${user.id}`;
    const loadFavs = () => {
      const favsRaw = localStorage.getItem(favKey);
      if (favsRaw) {
        try {
          setFavorites(JSON.parse(favsRaw));
        } catch (e) {
          console.error(e);
        }
      } else {
        setFavorites({});
      }
    };
    loadFavs();
    window.addEventListener('favorites-updated', loadFavs);
    return () => {
      window.removeEventListener('favorites-updated', loadFavs);
    };
  }, [user?.id]);

  const toggleFavorite = (productId: string, name: string) => {
    if (!user) {
      showToast('Please login to add favorites', 'error');
      return;
    }
    const favKey = `milko_favorites_u_${user.id}`;
    const nextVal = !favorites[productId];
    const nextFavorites = { ...favorites };
    if (nextVal) {
      nextFavorites[productId] = true;
    } else {
      delete nextFavorites[productId];
    }
    localStorage.setItem(favKey, JSON.stringify(nextFavorites));
    setFavorites(nextFavorites);
    showToast(
      nextVal ? `Added ${name} to favorites` : `Removed ${name} from favorites`,
      'success'
    );
    window.dispatchEvent(new Event('favorites-updated'));
  };

  const getDisplayPrice = (p: Product) => getCardPriceDisplay(p, '₹');
  const getDiscountOff = (p: Product) => getCardDiscountOff(p);

  useEffect(() => {
    let cancelled = false;
    const fetchProducts = async () => {
      try {
        const data = await productsApi.getAll();
        if (!cancelled) {
          setProducts(data && data.length > 0 ? data : []);
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch products:', error);
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <style>{`
          @keyframes loaderSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <svg
          style={{
            animation: 'loaderSpin 0.8s linear infinite',
            width: '22px',
            height: '22px',
            color: '#AB6468',
            marginBottom: '0px',
            flexShrink: 0
          }}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2.5"
            style={{ opacity: 0.15 }}
          />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
        <span className={styles.loadingText}>Loading products...</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{title}</h1>
      <div className={cardStyles.productsGrid}>
        {filteredProducts.map((product) => {
          const categoryLabel = product.categoryId ? (categoryMap.get(product.categoryId) || 'Dairy') : 'Dairy';
          const unitLabel = getProductDisplayUnitLabel(product);
          const productImage = getPrimaryProductImageUrl(product);
          const isOutOfStock = product.isActive === false || (typeof product.quantity === 'number' && product.quantity <= 0);

          return (
            <div
              key={product.id}
              className={`${cardStyles.productCard} ${isOutOfStock ? cardStyles.productCardOutOfStock : ''}`}
              onClick={() => openProductPage(router, product.id)}
            >
              <div className={cardStyles.productImage} style={productImage ? { aspectRatio: 'auto' } : undefined}>
                {isOutOfStock ? (
                  <div className={cardStyles.outOfStockBadge}>Out of stock</div>
                ) : null}
                <ProductCardImage
                  src={productImage}
                  alt={product.name}
                  hoverSrc={product.hoverNextImage ? getOrderedProductImageUrls(product)[1] : undefined}
                />
                {/* Add to Favorite Button */}
                <button
                  className={`${cardStyles.favoriteButton} ${favorites[product.id] ? cardStyles.favoriteButtonActive : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!favorites[product.id]) {
                      triggerSparkleBurst(e.currentTarget);
                    }
                    toggleFavorite(product.id, product.name);
                  }}
                  aria-label="Add to favorites"
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill={favorites[product.id] ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
              </div>

              <div className={cardStyles.productInfo}>
                {/* Row 1: Product Name and Quick Add */}
                <div className={cardStyles.productTitleRow}>
                  <h3 className={cardStyles.productName}>{product.name}</h3>
                  <button
                    type="button"
                    className={cardStyles.quickAddButton}
                    disabled={isOutOfStock}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isOutOfStock) {
                        showToast('Out of stock', 'error');
                        return;
                      }
                      setQuickAddProduct(product);
                    }}
                    aria-label={isOutOfStock ? 'Out of stock' : 'Quick add to cart'}
                  >
                    <span>Quick Add +</span>
                  </button>
                </div>

                {/* Row 2: Price and rating */}
                <div className={cardStyles.productCategoryRow}>
                  <div className={cardStyles.productPrice}>
                    {getCardPriceDisplay(product, '₹')}
                  </div>
                  <div className={cardStyles.productRatingCompact}>
                    {(getProductReviewCount(product)) > 0 ? (
                      <>
                        <svg className={cardStyles.starIconSmall} viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                        <span>{getAverageProductRating(product).toFixed(1)}</span>
                      </>
                    ) : (
                      <>
                        <svg className={cardStyles.starIconSmall} style={{ color: '#cbd5e1' }} viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                        <span style={{ color: '#94a3b8' }}>0.0</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Row 3: Discount and Action (Temporarily Removed)
                <div className={cardStyles.productFooterRow}>
                  {(() => {
                    const off = getDiscountOff(product);
                    return off ? (
                      <div className={cardStyles.discountOff}>₹ {off.toFixed(0)} OFF</div>
                    ) : (
                      <div className={cardStyles.discountPlaceholder} />
                    );
                  })()}
                  <button
                    className={cardStyles.startCreatingButton}
                    disabled={product.isActive === false || (typeof product.quantity === 'number' && product.quantity <= 0)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (product.isActive === false || (typeof product.quantity === 'number' && product.quantity <= 0)) {
                        showToast('Out of stock', 'error');
                        return;
                      }
                      const variation = getFirstVariationForCard(product);
                      const result = addItem({ productId: product.id, quantity: 1, variationId: variation?.id }, product.maxQuantity);
                      showToast(result.appliedQuantity > 0 ? 'Added to cart' : `Maximum order quantity is ${product.maxQuantity ?? 99}`, result.appliedQuantity > 0 ? 'success' : 'error');
                    }}
                    aria-label={product.isActive === false || (typeof product.quantity === 'number' && product.quantity <= 0) ? 'Out of stock' : 'Add to cart'}
                    type="button"
                  >
                    <span>Add to Cart</span>
                  </button>
                </div>
                */}
              </div>
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className={styles.emptyState}>
          <svg
            className={styles.emptyStateIcon}
            viewBox="0 0 400 400"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M55.7074 113.596C74.8042 76.0483 122.914 109.046 111.209 145.004C104.278 166.295 77.7431 171.791 62.523 153.978C55.4348 145.683 53.5021 130.46 51.8125 120.077"
              stroke="currentColor"
              strokeOpacity="0.9"
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M42.1477 151.765C68.1357 153.378 72.7893 181.756 66.4731 201.161"
              stroke="currentColor"
              strokeOpacity="0.9"
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M40 157.134C59.2604 191.736 77.2382 228.274 99.0604 261.295"
              stroke="currentColor"
              strokeOpacity="0.9"
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M70 184C96 192 123.125 234.218 125.5 234.5C131.793 235.25 174.45 206.243 179.5 203"
              stroke="currentColor"
              strokeOpacity="0.9"
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M180.179 181.433C177.573 190.79 174.456 201.984 171 208.379"
              stroke="currentColor"
              strokeOpacity="0.9"
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M203 245C215.904 240.091 293.902 226.749 300.797 224.407C305.596 222.776 308 209.244 308 208"
              stroke="currentColor"
              strokeOpacity="0.9"
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M152 272C150.06 275.709 151.54 309.089 151.54 302.021"
              stroke="currentColor"
              strokeOpacity="0.9"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M95.8389 301.027C112.317 295.939 135.474 281.698 152.078 281.698C162.247 281.698 189.086 293.725 201.074 297.666"
              stroke="currentColor"
              strokeOpacity="0.9"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M236 257.86C238.116 255.768 238.191 256.924 239.429 254.046C250.142 229.133 308.479 232.463 331.568 242.607C339.046 245.894 351.7 255.471 344.425 265.062C344.302 265.224 286.01 261.672 282.713 261.672C268.8 261.672 253.929 263.822 240.285 260.825"
              stroke="currentColor"
              strokeOpacity="0.9"
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M99 257.86C101.116 255.768 101.191 256.924 102.429 254.046C113.142 229.133 171.479 232.463 194.568 242.607C202.046 245.894 214.7 255.471 207.425 265.062C207.302 265.224 149.01 261.672 145.713 261.672C131.8 261.672 116.929 263.822 103.285 260.825"
              stroke="currentColor"
              strokeOpacity="0.9"
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M291 260C291 273.05 291 301.1 291 306"
              stroke="currentColor"
              strokeOpacity="0.9"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M236 305.559C246 300.523 289.676 281.936 289.774 282C303.704 291.155 321.255 295.656 335.866 304.297"
              stroke="currentColor"
              strokeOpacity="0.9"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className={styles.emptyStateText}>No products available at the moment.</p>
          <a
            href="https://instagram.com/myscribble.in"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.requestProductBtn}
          >
            <span className={styles.requestProductBtnContent}>Request a product</span>
          </a>
        </div>
      )}

      <QuickAddModal
        key={quickAddProduct?.id || 'none'}
        product={quickAddProduct}
        isOpen={Boolean(quickAddProduct)}
        onClose={() => setQuickAddProduct(null)}
        categoryName={quickAddProduct?.categoryId ? categoryMap.get(quickAddProduct.categoryId) : undefined}
      />
    </div>
  );
}

