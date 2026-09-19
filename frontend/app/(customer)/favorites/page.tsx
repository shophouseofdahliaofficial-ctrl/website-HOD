'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { productsApi } from '@/lib/api';
import { Product } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import { openProductPage } from '@/lib/utils/productNavigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { getCardPriceDisplay } from '@/lib/utils/productCardPricing';
import { getPrimaryProductImageUrl, getOrderedProductImageUrls } from '@/lib/utils/productImages';
import { getAverageProductRating, getProductReviewCount } from '@/lib/utils/productReviewStats';
import { useCategoryMap } from '@/hooks/useCategoryMap';
import { triggerSparkleBurst } from '@/lib/utils/sparkleBurst';
import CustomerSidebarLayout from '@/components/customer/CustomerSidebarLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import cardStyles from '@/components/ProductsSection.module.css';
import styles from './favorites.module.css';

export default function FavoritesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const categoryMap = useCategoryMap();
  
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  // Load favorites mapping
  useEffect(() => {
    if (authLoading || !user) return;
    const favKey = `milko_favorites_u_${user.id}`;
    const loadFavs = () => {
      const favsRaw = localStorage.getItem(favKey);
      if (favsRaw) {
        try {
          setFavorites(JSON.parse(favsRaw));
        } catch (e) {
          console.error(e);
        }
      }
    };
    loadFavs();
    window.addEventListener('favorites-updated', loadFavs);
    return () => window.removeEventListener('favorites-updated', loadFavs);
  }, [user, authLoading]);

  // Load products details and filter by favorites
  useEffect(() => {
    if (authLoading || !user) return;
    
    const fetchFavoriteProducts = async () => {
      try {
        setLoading(true);
        const allProducts = await productsApi.getAll();
        
        // Filter by favorites listed in localStorage
        const favKey = `milko_favorites_u_${user.id}`;
        const favsRaw = localStorage.getItem(favKey);
        let favMap: Record<string, boolean> = {};
        if (favsRaw) {
          try {
            favMap = JSON.parse(favsRaw);
          } catch (e) {
            console.error(e);
          }
        }
        
        const favProductIds = Object.keys(favMap).filter((id) => favMap[id]);
        const favBaseProducts = allProducts.filter((p) => favProductIds.includes(p.id));
        
        setProducts(favBaseProducts);
      } catch (error) {
        console.error('Failed to fetch favorite products:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFavoriteProducts();
  }, [user, authLoading, favorites]);

  const toggleFavorite = (productId: string, name: string) => {
    if (!user) return;
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

  if (authLoading || (loading && products.length === 0)) {
    return (
      <CustomerSidebarLayout>
        <LoadingSpinner fullHeight />
      </CustomerSidebarLayout>
    );
  }

  return (
    <CustomerSidebarLayout>
      <h1 className={styles.title}>Your Favorites</h1>
      
      {products.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '120px', height: '120px' }}>
              <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
              <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
              <g id="SVGRepo_iconCarrier">
                <path d="M171.223 268.434C155.617 258.928 152.422 253.723 138.876 240.022C57.3444 157.56 128.4 104.119 164.108 117.038C170.838 119.473 178.512 126.973 187.131 139.539C189.325 129.208 195.596 120.913 205.944 114.654C277.944 71.1053 311.921 166.851 242.549 229.015C225.845 243.988 199.123 268.943 188.086 279.259" stroke="#ff0040" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                <path d="M309.316 311.732C271.404 277.617 237.148 239.571 203.477 201.082" stroke="#ff0040" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                <path d="M124.097 116.892C110.051 104.765 100.489 93.3393 86.8125 78.4053" stroke="#ff0040" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                <path d="M82.7305 109.676C77.5045 61.1192 101.381 76.9653 120.487 85.1114" stroke="#ff0040" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                <path d="M295.294 300.757C295.407 304.728 293.815 326.819 285.168 324.836C264.566 320.113 250.952 274.631 275.796 270.486C316.252 263.738 337.259 299.531 293.043 296.285" stroke="#ff0040" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
              </g>
            </svg>
          </div>
          <h2>No Favorites Saved Yet</h2>
          <p>Explore our products and tap the heart icon to save them here!</p>
          <Link href="/products" className={styles.browseButton}>
            Browse Products
          </Link>
        </div>
      ) : (
        <div className={cardStyles.productsGrid}>
          {products.map((product) => {
            const isOutOfStock = product.isActive === false || (typeof product.quantity === 'number' && product.quantity <= 0);
            const categoryLabel = product.categoryId ? (categoryMap.get(product.categoryId) || 'Dairy') : 'Dairy';
            const productImage = getPrimaryProductImageUrl(product);

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
                    <div className={cardStyles.placeholderImage}>
                      <img src="/scribble-logo-bw.png" alt="Scribble Logo" className={cardStyles.placeholderLogo} />
                    </div>
                  )}
                  {/* Add to Favorite Button */}
                  <button
                    className={`${cardStyles.favoriteButton} ${cardStyles.favoriteButtonActive}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(product.id, product.name);
                    }}
                    aria-label="Remove from favorites"
                  >
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>
                </div>

                <div className={cardStyles.productInfo}>
                  <div className={cardStyles.productTitleRow}>
                    <h3 className={cardStyles.productName}>{product.name}</h3>
                    <span className={cardStyles.productPrice}>{getCardPriceDisplay(product, '₹')}</span>
                  </div>

                  <div className={cardStyles.productCategoryRow}>
                    <div className={cardStyles.productCategory}>
                      {categoryLabel}
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
                </div>
              </div>
            );
          })}
        </div>
      )}

    </CustomerSidebarLayout>
  );
}
