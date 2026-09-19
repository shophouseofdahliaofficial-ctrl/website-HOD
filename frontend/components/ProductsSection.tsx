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
                    {product.isCustomizable ? (
                      <div className={`${styles.assuredBadge} ${styles.customizableBadge}`}>
                        <svg className={styles.verifiedIcon} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true">
                          <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                            <g fill="currentColor">
                              <g>
                                <path d="M14.775,1.206 L13.73,4.289 L15.676,6.896 L12.422,6.855 L10.543,9.511 L9.577,6.404 L6.471,5.439 L9.127,3.559 L9.086,0.305 L11.692,2.251 L14.775,1.206 Z"></path>
                                <path d="M1.852,15.533 C1.462,15.924 0.93,16.025 0.664,15.759 L0.258,15.354 C-0.008,15.088 0.094,14.557 0.485,14.166 L10.788,3.863 C11.179,3.472 11.71,3.371 11.976,3.636 L12.382,4.042 C12.648,4.308 12.547,4.839 12.155,5.23 L1.852,15.533 L1.852,15.533 Z"></path>
                                <path d="M13.511,13.949 C13.511,13.949 13.673,12.89 12.901,12.126 C12.128,11.364 11.031,11.5 11.031,11.5 C11.031,11.5 12.297,11.52 12.926,10.897 C13.557,10.274 13.512,9.05 13.512,9.05 C13.512,9.05 13.645,10.4 14.146,10.897 C14.651,11.393 15.993,11.5 15.993,11.5 C15.993,11.5 14.732,11.602 14.174,12.152 C13.614,12.705 13.511,13.949 13.511,13.949 L13.511,13.949 Z"></path>
                                <path d="M8.511,15.949 C8.511,15.949 8.673,14.89 7.901,14.126 C7.128,13.364 6.031,13.5 6.031,13.5 C6.031,13.5 7.297,13.52 7.926,12.897 C8.557,12.274 8.512,11.05 8.512,11.05 C8.512,11.05 8.645,12.4 9.146,12.897 C9.651,13.393 10.993,13.5 10.993,13.5 C10.993,13.5 9.732,13.602 9.174,14.152 C8.614,14.705 8.511,15.949 8.511,15.949 L8.511,15.949 Z"></path>
                                <path d="M3.511,4.949 C3.511,4.949 3.673,3.89 2.901,3.126 C2.128,2.364 1.031,2.5 1.031,2.5 C1.031,2.5 2.297,2.52 2.926,1.897 C3.557,1.274 3.512,0.05 3.512,0.05 C3.512,0.05 3.645,1.4 4.146,1.897 C4.651,2.393 5.993,2.5 5.993,2.5 C5.993,2.5 4.732,2.602 4.174,3.152 C3.614,3.705 3.511,4.949 3.511,4.949 L3.511,4.949 Z"></path>
                              </g>
                            </g>
                          </g>
                        </svg>
                        <span>Customizable</span>
                      </div>
                    ) : null}
                    {productImage ? (
                      <div className="product-card-image-wrapper">
                        <Image
                          src={productImage}
                          alt={product.name}
                          width={500}
                          height={500}
                          sizes="(max-width: 640px) 50vw, (max-width: 968px) 50vw, (max-width: 1200px) 33vw, 25vw"
                          style={{ width: '100%', height: 'auto', display: 'block' }}
                        />
                        {product.hoverNextImage && getOrderedProductImageUrls(product)[1] && (
                          <div className="product-card-hover-image-container">
                            <Image
                              src={getOrderedProductImageUrls(product)[1]}
                              alt={product.name}
                              width={500}
                              height={500}
                              sizes="(max-width: 640px) 50vw, (max-width: 968px) 50vw, (max-width: 1200px) 33vw, 25vw"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={styles.placeholderImage}>
                        <img src="/house-of-dahlia-logo.png" alt="House Of Dahlia" className={styles.placeholderLogo} />
                      </div>
                    )}
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
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                  </div>
                  <div className={styles.productInfo}>
                    {/* Row 1: Product Name and Price */}
                    <div className={styles.productTitleRow}>
                      <h3 className={styles.productName}>{product.name}</h3>
                      <span className={styles.productPrice}>{getDisplayPrice(product)}</span>
                    </div>

                    {/* Row 2: Category and rating */}
                    <div className={styles.productCategoryRow}>
                      <div className={styles.productCategory}>
                        {categoryLabel}
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

                          const imageUrl = getPrimaryProductImageUrl(product) || '';
                          const sourceElement = e.currentTarget;
                          const targetElement = cartIconRefStore.getAny();

                          if (sourceElement && targetElement && imageUrl) {
                            animateToCart({
                              imageUrl,
                              sourceElement,
                              targetElement,
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

    </div>
  );
}
