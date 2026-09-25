'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { productsApi } from '@/lib/api';
import { Product } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import { openProductPage } from '@/lib/utils/productNavigation';
import RatingBadge from '@/components/ui/RatingBadge';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { animateToCart } from '@/lib/utils/cartAnimation';
import { cartIconRefStore } from '@/lib/utils/cartIconRef';
import { contentApi } from '@/lib/api';
import { getFirstVariationForCard, getCardDiscountOff, getCardPriceDisplay, getProductDisplayUnitLabel } from '@/lib/utils/productCardPricing';
import { getPrimaryProductImageUrl, getOrderedProductImageUrls } from '@/lib/utils/productImages';
import { getAverageProductRating, getProductReviewCount } from '@/lib/utils/productReviewStats';
import { useCategoryMap } from '@/hooks/useCategoryMap';
import { triggerSparkleBurst } from '@/lib/utils/sparkleBurst';
import QuickAddModal from '@/components/QuickAddModal';
import ProductCardImage from '@/components/ui/ProductCardImage';
import styles from './ProductsSection.module.css';

/**
 * Products Section Component
 * Displays products in a grid (4 per row)
 */
export default function ProductsSection() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowsToShow, setRowsToShow] = useState(1);
  const [gridCols, setGridCols] = useState(4);
  const { addItem } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();
  const categoryMap = useCategoryMap();
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);

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

  // Fallback demo products (dev-only). Never show these on production if backend is slow/unavailable.
  const showDemoFallback = process.env.NODE_ENV !== 'production';
  const fallbackProducts: Product[] = [
    {
      id: '1',
      name: 'Polaroid Prints',
      description: 'Classic instant-style fine art prints for your favorite moments.',
      pricePerLitre: 60,
      imageUrl: 'https://res.cloudinary.com/hythbqu9/image/upload/v1789840141/houseofdahlia/products/polaroid_prints.jpg',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Photo Strips',
      description: 'Vintage booth-style strips perfect for keepsakes and gifting.',
      pricePerLitre: 70,
      imageUrl: 'https://res.cloudinary.com/hythbqu9/image/upload/v1789840143/houseofdahlia/products/photo_strips.jpg',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '3',
      name: 'Memory Book',
      description: 'Handcrafted linen albums to preserve your cherished memories.',
      pricePerLitre: 55,
      imageUrl: '/polaroid_clean.png',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '4',
      name: 'Custom Frame',
      description: 'Artisan frames tailored to your photos and style.',
      pricePerLitre: 65,
      imageUrl: '/strip_printer.png',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  useEffect(() => {
    // Determine columns (match ProductsSection.module.css breakpoints)
    const calcCols = () => {
      const w = typeof window !== 'undefined' ? window.innerWidth : 1400;
      if (w <= 968) return 2;
      if (w <= 1200) return 3;
      return 4;
    };

    setGridCols(calcCols());
    const onResize = () => setGridCols(calcCols());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    // Load admin-controlled row count (public content must be active)
    let cancelled = false;
    contentApi
      .getByType('homepage_products')
      .then((c) => {
        if (cancelled) return;
        const raw = Number((c as any)?.metadata?.rows);
        const rows = Number.isFinite(raw) ? Math.max(1, Math.min(10, Math.floor(raw))) : 1;
        setRowsToShow(rows);
      })
      .catch(() => {
        if (!cancelled) setRowsToShow(1);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchProducts = async () => {
      try {
        const limit = Math.max(1, rowsToShow) * Math.max(2, gridCols);
        const data = await productsApi.getAll();
        // Show only first N products for homepage, or fallback if empty
        if (data && data.length > 0) {
          if (!cancelled) {
            setProducts(data.slice(0, limit));
            setLoading(false);
          }
        } else {
          if (!cancelled) {
            setProducts(showDemoFallback ? fallbackProducts : []);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Failed to fetch products:', error);
        if (!cancelled) {
          if (showDemoFallback) {
            setProducts(fallbackProducts);
          } else {
            setProducts([]);
            showToast('Unable to load products right now.', 'error');
          }
          setLoading(false);
        }
      }
    };

    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [rowsToShow, gridCols]);


  const getDisplayPrice = (p: Product) => getCardPriceDisplay(p, '₹');
  const getDiscountOff = (p: Product) => getCardDiscountOff(p);

  // Render shimmer skeletons while loading
  if (loading) {
    return (
      <div className={styles.productsSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Our Products</h2>
          <div className={styles.productsGrid}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={styles.productCardShimmer}>
                <div className={styles.productImageShimmer}>
                  <div className={`${styles.assuredBadgeShimmer} ${styles.shimmer}`} aria-hidden />
                  <div className={`${styles.imageShimmerFill} ${styles.shimmer}`} aria-hidden />
                </div>
                <div className={styles.productInfoShimmer}>
                  <div className={`${styles.categoryShimmer} ${styles.shimmer}`} aria-hidden />
                  <div className={styles.titleRowShimmer}>
                    <div className={`${styles.nameShimmer} ${styles.shimmer}`} aria-hidden />
                    <div className={`${styles.ratingShimmer} ${styles.shimmer}`} aria-hidden />
                  </div>
                  <div className={`${styles.discountOffShimmer} ${styles.shimmer}`} aria-hidden />
                  <div className={styles.addToCartRowShimmer}>
                    <div className={styles.priceShimmerGroup}>
                      <div className={`${styles.priceAmountShimmer} ${styles.shimmer}`} aria-hidden />
                      <div className={`${styles.priceUnitShimmer} ${styles.shimmer}`} aria-hidden />
                    </div>
                    <div className={`${styles.addButtonShimmer} ${styles.shimmer}`} aria-hidden />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.productsSection}>
      <div className={styles.container}>
        <h2 className={styles.sectionTitle}>Our Products</h2>
        <div className={styles.productsGrid}>
          {products.map((product) => (
            (() => {
              const isOutOfStock =
                product.isActive === false || (typeof product.quantity === 'number' && product.quantity <= 0);
              const categoryLabel = product.categoryId ? (categoryMap.get(product.categoryId) || 'Dairy') : 'Dairy';
              const productImage = getPrimaryProductImageUrl(product);
              return (
                <div
                  key={product.id}
                  className={`${styles.productCard} ${isOutOfStock ? styles.productCardOutOfStock : ''}`}
                  onClick={() => openProductPage(router, product.id)}
                >
                  <div className={styles.productImage} style={productImage ? { aspectRatio: 'auto' } : undefined}>
                    {isOutOfStock ? (
                      <div className={styles.outOfStockBadge}>Out of stock</div>
                    ) : null}
                    <ProductCardImage
                      src={productImage}
                      alt={product.name}
                      hoverSrc={product.hoverNextImage ? getOrderedProductImageUrls(product)[1] : undefined}
                    />
                    {/* Add to Favorite Button */}
                    <button
                      className={`${styles.favoriteButton} ${favorites[product.id] ? styles.favoriteButtonActive : ''}`}
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
                  <div className={styles.productInfo}>
                    {/* Row 1: Product Name and Quick Add */}
                    <div className={styles.productTitleRow}>
                      <h3 className={styles.productName}>{product.name}</h3>
                      <button
                        type="button"
                        className={styles.quickAddButton}
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
                    <div className={styles.productCategoryRow}>
                      <div className={styles.productPrice}>
                        {getCardPriceDisplay(product, '₹')}
                      </div>
                      <div className={styles.productRatingCompact}>
                        {(getProductReviewCount(product)) > 0 ? (
                          <>
                            <svg className={styles.starIconSmall} viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                            </svg>
                            <span>{getAverageProductRating(product).toFixed(1)}</span>
                          </>
                        ) : (
                          <>
                            <svg className={styles.starIconSmall} style={{ color: '#cbd5e1' }} viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                            </svg>
                            <span style={{ color: '#94a3b8' }}>0.0</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Row 3: Discount and Action (Temporarily Removed)
                    <div className={styles.productFooterRow}>
                      {(() => {
                        const off = getDiscountOff(product);
                        return off ? (
                          <div className={styles.discountOff}>
                            ₹ {off.toFixed(0)} OFF
                          </div>
                        ) : (
                          <div className={styles.discountPlaceholder} />
                        );
                      })()}
                      <button
                        className={styles.startCreatingButton}
                        disabled={isOutOfStock}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isOutOfStock) {
                            showToast('Out of stock', 'error');
                            return;
                          }

                          const variation = getFirstVariationForCard(product);
                          const result = addItem({
                            productId: product.id,
                            quantity: 1,
                            variationId: variation?.id,
                          }, product.maxQuantity);
                          if (result.appliedQuantity <= 0) {
                            showToast(`Maximum order quantity is ${product.maxQuantity ?? 99}`, 'error');
                            return;
                          }

                          showToast(result.ok ? 'Added to cart' : `Maximum order quantity is ${product.maxQuantity ?? 99}`, result.ok ? 'success' : 'error');

                          const imageUrl = getPrimaryProductImageUrl(product) || (product as any).imageUrl || '';
                          const sourceElement = e.currentTarget;

                          if (sourceElement && imageUrl) {
                            animateToCart({
                              imageUrl,
                              sourceElement,
                              targetElement: cartIconRefStore.getAny(),
                            });
                          }
                        }}
                        aria-label={isOutOfStock ? 'Out of stock' : 'Start creating'}
                      >
                        <span>Add to Cart</span>
                      </button>
                    </div>
                    */}
                  </div>
                </div>
              );
            })()
          ))}
        </div>
        <div className={styles.viewAllLink}>
          <Link href="/products" className={styles.viewAllButton}>
            <span>View All Products</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>

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
