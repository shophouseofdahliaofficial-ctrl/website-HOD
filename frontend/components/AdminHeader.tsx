'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import styles from './AdminHeader.module.css';

/**
 * Admin Header Component
 * Custom header for admin pages only
 */
export default function AdminHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Admin menu items for search
  const adminMenuItems = [
    { name: 'Products', path: '/admin/products', description: 'Manage products' },
    { name: 'Banners', path: '/admin/banners', description: 'Manage banners' },
    { name: 'Orders', path: '/admin/orders', description: 'View paid orders & Delhivery shipments' },
    { name: 'Customers', path: '/admin/customers', description: 'Customer list & analytics' },
    { name: 'More', path: '/admin/content', description: 'Manage site content' },
    { name: 'Dashboard', path: '/admin', description: 'Admin dashboard' },
  ];

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const filtered = adminMenuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filtered.map(item => item.path));
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
    }
  };

  // Navigate to search result
  const navigateToResult = (path: string) => {
    router.push(path);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    if (showSearchResults || showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchResults, showUserDropdown]);

  // Filter menu items based on search
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = adminMenuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filtered.map(item => item.path));
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
    }
  }, [searchQuery]);

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  return (
    <header className={styles.adminHeader}>
      <div className={styles.adminHeaderContent}>
        {/* Left: Logo */}
        <Link href="/admin" className={styles.adminLogo}>
          House Of Dahlia Admin
        </Link>

        {/* Center: Search Bar */}
        <div className={styles.searchContainer} ref={searchRef}>
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <div className={styles.searchIcon}>
              <svg 
                width="25"
                height="25"
                viewBox="0 -0.5 25 25" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                <g id="SVGRepo_iconCarrier">
                  <path 
                    fillRule="evenodd" 
                    clipRule="evenodd" 
                    d="M5.5 11.1455C5.49956 8.21437 7.56975 5.69108 10.4445 5.11883C13.3193 4.54659 16.198 6.08477 17.32 8.79267C18.4421 11.5006 17.495 14.624 15.058 16.2528C12.621 17.8815 9.37287 17.562 7.3 15.4895C6.14763 14.3376 5.50014 12.775 5.5 11.1455Z" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  ></path>
                  <path 
                    d="M15.989 15.4905L19.5 19.0015" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  ></path>
                </g>
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
          {showSearchResults && searchResults.length > 0 && (
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
            </div>
          )}
        </div>

        {/* Right: Admin Menu */}
        <div className={styles.adminMenu}>
          <Link 
            href="/admin/products" 
            className={pathname === '/admin/products' ? styles.activeLink : ''}
          >
            Products
          </Link>
          <Link 
            href="/admin/banners"
            className={pathname === '/admin/banners' ? styles.activeLink : ''}
          >
            Banners
          </Link>
          <Link 
            href="/admin/orders"
            className={pathname === '/admin/orders' ? styles.activeLink : ''}
          >
            Orders
          </Link>
          <Link 
            href="/admin/customers"
            className={pathname === '/admin/customers' ? styles.activeLink : ''}
          >
            Customers
          </Link>
          <Link 
            href="/admin/content"
            className={pathname?.startsWith('/admin/content') ? styles.activeLink : ''}
          >
            More
          </Link>
          
          {/* User Dropdown */}
          <div className={styles.userDropdown} ref={userDropdownRef}>
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className={styles.userButton}
            >
              <span>Hi, {user?.name || 'Admin'}</span>
              <svg 
                className={`${styles.dropdownArrow} ${showUserDropdown ? styles.dropdownArrowOpen : ''}`} 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {showUserDropdown && (
              <div className={styles.dropdownMenu}>
                <Link 
                  href="/" 
                  className={styles.dropdownItem}
                  onClick={() => setShowUserDropdown(false)}
                >
                  View Site
                </Link>
                <button 
                  className={styles.dropdownItem}
                  onClick={() => {
                    setShowUserDropdown(false);
                    handleLogout();
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
