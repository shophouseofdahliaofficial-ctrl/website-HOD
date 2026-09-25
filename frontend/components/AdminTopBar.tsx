'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import styles from './AdminTopBar.module.css';

interface MenuItem {
  name: string;
  path: string;
  description: string;
}

/**
 * Admin Top Bar Component
 * Top bar with search functionality for admin panel
 */
export default function AdminTopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Admin menu items for search
  const adminMenuItems: MenuItem[] = [
    { name: 'Dashboard', path: '/admin', description: 'Admin dashboard overview' },
    { name: 'Products', path: '/admin/products', description: 'Manage products, stock, and pricing' },
    { name: 'Banners', path: '/admin/banners', description: 'Manage promotional homepage banners' },
    { name: 'Orders', path: '/admin/orders', description: 'View paid customer orders and details' },
    { name: 'Customers', path: '/admin/customers', description: 'Customer list, analytics, and wallet history' },
    { name: 'Feedback', path: '/admin/feedback', description: 'Customer feedback, reviews, and suggestions' },
    { name: 'Categories', path: '/admin/categories', description: 'Manage product categories' },
    { name: 'Coupons', path: '/admin/coupons', description: 'Manage active discount coupons and promo codes' },
    { name: 'More / Site Content', path: '/admin/content', description: 'Manage general website content and operational parameters' },
    { name: 'Logo', path: '/admin/logo', description: 'Configure store brand logo image and dimensions' },
    { name: 'Favicon', path: '/admin/favicon', description: 'Configure website browser tab icon image' },
    { name: 'Platform Fees', path: '/admin/content/platform_fee', description: 'Set flat checkout platform fee charged per order' },
    { name: 'Help & Support Number', path: '/admin/content/help_support', description: 'Configure WhatsApp or Telegram support link' },
    { name: 'App Download Link', path: '/admin/content/app_download', description: 'Configure Play Store or custom App URL for mobile' },
    { name: 'Homepage Products Rows', path: '/admin/content/homepage_products', description: 'Configure how many product rows appear on homepage' },
    { name: 'Terms & Conditions', path: '/admin/content/terms', description: 'Edit company terms and conditions page content' },
    { name: 'Privacy Policy', path: '/admin/content/privacy', description: 'Edit company privacy policy page content' },
    { name: 'About Us', path: '/admin/content/about', description: 'Edit company story, story details, and biography' },
    { name: 'Contact Details', path: '/admin/content/contact', description: 'Edit store phone numbers, address, and email links' },
    { name: 'Reviews Settings', path: '/admin/content/reviews', description: 'Configure Trustpilot and Google review URLs' },
    { name: 'Gifting', path: '/admin/content/gifting', description: 'Configure gift wrapping price per product and toggle customer availability' },
    { name: 'COD Settings', path: '/admin/content/cod', description: 'Enable or disable Cash on Delivery across cart and checkout' },
  ];

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    if (showSearchResults) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchResults]);

  // Filter menu items based on search
  useEffect(() => {
    if (searchQuery.trim()) {
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
    }
  }, [searchQuery]);

  const navigateToResult = (path: string) => {
    router.push(path);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() && adminMenuItems.length > 0) {
      navigateToResult(adminMenuItems[0].path);
    }
  };

  return (
    <div className={styles.topBar}>
      <div className={styles.topBarContent}>
        {/* Search Bar */}
        <div className={styles.searchContainer} ref={searchRef}>
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <div className={styles.searchIcon}>
              <svg 
                width="26"
                height="26"
                viewBox="0 -0.5 25 25" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  fillRule="evenodd" 
                  clipRule="evenodd" 
                  d="M5.5 11.1455C5.49956 8.21437 7.56975 5.69108 10.4445 5.11883C13.3193 4.54659 16.198 6.08477 17.32 8.79267C18.4421 11.5006 17.495 14.624 15.058 16.2528C12.621 17.8815 9.37287 17.562 7.3 15.4895C6.14763 14.3376 5.50014 12.775 5.5 11.1455Z" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <path 
                  d="M15.989 15.4905L19.5 19.0015" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search admin items (products, banners, customers...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchResults(false);
                }}
                className={styles.clearSearchButton}
                aria-label="Clear search"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </form>

          {/* Search Results Dropdown */}
          {showSearchResults && searchQuery.trim() && (
            <div className={styles.searchResults}>
              {adminMenuItems
                .filter(item =>
                  item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.description.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((item) => (
                  <button
                    key={item.path}
                    className={styles.searchResultItem}
                    onClick={() => navigateToResult(item.path)}
                  >
                    <div className={styles.searchResultName}>{item.name}</div>
                    <div className={styles.searchResultDesc}>{item.description}</div>
                  </button>
                ))}
              {adminMenuItems.filter(item =>
                item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.description.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && (
                <div className={styles.noResults}>No results found</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
