'use client';

import { useEffect, useState, Suspense, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { productsApi } from '@/lib/api';
import { Product } from '@/types';
import styles from '@/components/ProductsSection.module.css';
import { openProductPage } from '@/lib/utils/productNavigation';
import RatingBadge from '@/components/ui/RatingBadge';
import { getFirstVariationForCard, getCardDiscountOff, getCardPriceDisplay, getProductDisplayUnitLabel } from '@/lib/utils/productCardPricing';
import { getPrimaryProductImageUrl, getOrderedProductImageUrls } from '@/lib/utils/productImages';
import { getAverageProductRating, getProductReviewCount } from '@/lib/utils/productReviewStats';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useCategoryMap } from '@/hooks/useCategoryMap';
import { triggerSparkleBurst } from '@/lib/utils/sparkleBurst';
import { animateToCart } from '@/lib/utils/cartAnimation';
import { cartIconRefStore } from '@/lib/utils/cartIconRef';
import QuickAddModal from '@/components/QuickAddModal';

/**
 * Search Results Page
 * Displays products matching the search query
 */
function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();
  const categoryMap = useCategoryMap();
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const searchProducts = async () => {
      if (!query.trim()) {
        setProducts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Get all products and filter on client side
        // TODO: Replace with API search endpoint when available
        const allProducts = await productsApi.getAll();
        const searchTerm = query.toLowerCase().trim();
        const filtered = allProducts.filter((product) => {
          // Filter out DEMO products
          const isDemo = product.name.toLowerCase().includes('demo') ||
            product.description?.toLowerCase().includes('demo');
          if (isDemo) return false;

          // Filter by search term
          const nameMatch = product.name.toLowerCase().includes(searchTerm);
          const descMatch = product.description?.toLowerCase().includes(searchTerm);
          return nameMatch || descMatch;
        });
        setProducts(filtered);
      } catch (error) {
        console.error('Failed to search products:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    searchProducts();
  }, [query]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') return products;
    return products.filter((p) => p.categoryId === selectedCategory);
  }, [products, selectedCategory]);

  const getDisplayPrice = (p: Product) => getCardPriceDisplay(p, '₹');
  const getDiscountOff = (p: Product) => getCardDiscountOff(p);

  if (loading) {
    return (
      <div className={styles.productsSection}>
        <div className={styles.container}>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p className={styles.loading}>Searching...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.productsSection}>
      <div className={styles.container}>
        {query.trim() ? (
          <>
            {products.length > 0 ? (
              <>
                <div className={styles.sectionTitleRow}>
                  <div className={styles.leftSpacer} />
                  <h1 className={styles.sectionTitle}>
                    Search results for &quot;{query}&quot;
                  </h1>
                  <div className={styles.filterWrapper} ref={filterRef}>
                    <button
                      className={styles.filterButton}
                      onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                      aria-label="Filter products"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                      </svg>
                      <span>{selectedCategory === 'all' ? 'Filter' : categoryMap.get(selectedCategory) || 'Filter'}</span>
                    </button>
                    {isFilterDropdownOpen && (
                      <div className={styles.filterDropdown}>
                        <button
                          className={`${styles.filterOption} ${selectedCategory === 'all' ? styles.filterOptionActive : ''}`}
                          onClick={() => {
                            setSelectedCategory('all');
                            setIsFilterDropdownOpen(false);
                          }}
                        >
                          All Products
                        </button>
                        {Array.from(categoryMap.entries()).map(([id, name]) => (
                          <button
                            key={id}
                            className={`${styles.filterOption} ${selectedCategory === id ? styles.filterOptionActive : ''}`}
                            onClick={() => {
                              setSelectedCategory(id);
                              setIsFilterDropdownOpen(false);
                            }}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <p style={{ color: 'black', marginBottom: '2rem', marginTop: '-32px', textAlign: 'center' }}>
                  Found {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
                </p>
                <div className={styles.productsGrid}>
                  {filteredProducts.map((product) => {
                    const categoryLabel = product.categoryId ? (categoryMap.get(product.categoryId) || 'Dairy') : 'Dairy';
                    const unitLabel = getProductDisplayUnitLabel(product);
                    const productImage = getPrimaryProductImageUrl(product);
                    const isOutOfStock = product.isActive === false || (typeof product.quantity === 'number' && product.quantity <= 0);

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
                          {productImage ? (
                            <div className="product-card-image-wrapper">
                              <Image
                                src={productImage}
                                alt={product.name}
                                width={500}
                                height={500}
                                style={{ width: '100%', height: 'auto', display: 'block' }}
                              />
                              {product.hoverNextImage && getOrderedProductImageUrls(product)[1] && (
                                <div className="product-card-hover-image-container">
                                  <Image
                                    src={getOrderedProductImageUrls(product)[1]}
                                    alt={product.name}
                                    width={500}
                                    height={500}
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
                              disabled={product.isActive === false || (typeof product.quantity === 'number' && product.quantity <= 0)}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (product.isActive === false || (typeof product.quantity === 'number' && product.quantity <= 0)) {
                                  showToast('Out of stock', 'error');
                                  return;
                                }
                                const variation = getFirstVariationForCard(product);
                                const result = addItem({ productId: product.id, quantity: 1, variationId: variation?.id }, product.maxQuantity);
                                showToast(
                                  result.appliedQuantity > 0 && result.ok ? 'Added to cart' : `Maximum order quantity is ${product.maxQuantity ?? 99}`,
                                  result.appliedQuantity > 0 && result.ok ? 'success' : 'error',
                                );
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
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                <svg
                  viewBox="0 0 400 400"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ width: '120px', height: '120px', margin: '0 auto 2rem', display: 'block' }}
                >
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <path d="M102.125 172.839C54.7551 235.791 48.0015 293.96 48.0015 358.802" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M102.127 172.839C112.108 211.439 135.434 277.795 135.434 315.781" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M239.518 264.433C213.65 264.433 169.98 298.927 138.209 315.781" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M244.768 263.706C249.159 263.939 253.393 265.447 257.646 266.567" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M240.901 274.147C244.213 274.487 247.407 276.681 250.615 278.311" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M338.919 157.733C340.939 144.264 337.021 134.241 329.704 129.879C320.415 124.341 306.18 126.646 294.174 140.144C234.303 207.45 303.365 267.433 336.284 167.065" stroke="#000000" strokeOpacity="0.5" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M271.896 228.351C256.447 251.963 241.631 280.024 226.1 303.291" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M190.709 38.6922C194.837 40.2666 196.907 44.8895 195.333 49.0178C193.759 53.146 189.136 55.2163 185.008 53.6419L190.709 38.6922ZM107.484 121.21L99.7221 123.147V123.147L107.484 121.21ZM203.668 55.5181C199.881 53.2421 198.656 48.3271 200.932 44.5402C203.208 40.7532 208.123 39.5283 211.91 41.8043L203.668 55.5181ZM115.246 119.273C123.042 150.508 138.113 163.3 153.165 166.64C168.914 170.135 187.524 163.989 203.183 151.387C218.792 138.824 229.947 121.027 231.726 103.633C233.429 86.9729 226.697 69.3591 203.668 55.5181L211.91 41.8043C239.737 58.5289 250.036 81.8529 247.643 105.26C245.324 127.933 231.255 149.332 213.214 163.852C195.222 178.332 171.755 187.154 149.699 182.26C126.945 177.211 108.485 158.258 99.7221 123.147L115.246 119.273ZM185.008 53.6419C159.208 43.8026 139.858 50.6989 127.879 63.9823C115.47 77.7426 110.234 99.1929 115.246 119.273L99.7221 123.147C93.5165 98.2833 99.7656 71.2655 115.997 53.2671C132.658 34.7918 159.103 26.6385 190.709 38.6922L185.008 53.6419Z" fill="#000000" fillOpacity="0.9"></path>
                    <path d="M200.539 121.09C201.081 118.803 201.752 118.543 202.334 116.314" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                  </g>
                </svg>
                <h1 className={styles.sectionTitle}>
                  Search for &quot;{query}&quot;
                </h1>
                <p style={{ color: '#666', marginBottom: '2rem', fontSize: '1rem' }}>
                  No products found matching your search.
                </p>
                <Link
                  href="/"
                  className={styles.viewAllButton}
                >
                  <span>Browse All Products</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <h1 className={styles.sectionTitle}>
              Search Products
            </h1>
            <p style={{ color: '#666', marginBottom: '2rem' }}>
              Enter a search term to find products.
            </p>
            <Link
              href="/"
              className={styles.viewAllButton}
            >
              <span>Browse All Products</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        )}
      </div>

      <QuickAddModal
        product={quickAddProduct}
        isOpen={Boolean(quickAddProduct)}
        onClose={() => setQuickAddProduct(null)}
        categoryName={quickAddProduct?.categoryId ? categoryMap.get(quickAddProduct.categoryId) : undefined}
      />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#666', letterSpacing: '-1px' }}>Loading...</p>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
