'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/Logo';
import topBarStyles from '@/components/AdminTopBar.module.css';
import sidebarStyles from '@/components/AdminSidebar.module.css';

interface MenuItem {
  name: string;
  path: string;
  description: string;
}

export default function AdminMobileHeader() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const adminMenuItems: MenuItem[] = [
    { name: 'Dashboard', path: '/admin', description: 'Admin dashboard' },
    { name: 'Orders', path: '/admin/orders', description: 'View paid orders' },
    { name: 'Deliveries', path: '/admin/deliveries', description: 'Delivery schedule' },
    { name: 'Products', path: '/admin/products', description: 'Manage products' },
    { name: 'Banners', path: '/admin/banners', description: 'Manage banners' },
    { name: 'Customers', path: '/admin/customers', description: 'Customer list & analytics' },
    { name: 'Plans', path: '/admin/subscriptions', description: 'Manage recurring plans' },
    { name: 'Feedback', path: '/admin/feedback', description: 'Customer feedback' },
    { name: 'Categories', path: '/admin/categories', description: 'Manage categories' },
    { name: 'Coupons', path: '/admin/coupons', description: 'Manage coupons' },
    { name: 'Content', path: '/admin/content', description: 'Manage site pages' },
    { name: 'Logo', path: '/admin/logo', description: 'Update logo' },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setShowSearchResults(!!searchQuery.trim());
  }, [searchQuery]);

  const navigateToResult = (path: string) => {
    router.push(path);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    const match = adminMenuItems.find(
      (item) =>
        item.name.toLowerCase().includes(q.toLowerCase()) ||
        item.description.toLowerCase().includes(q.toLowerCase())
    );
    if (match) navigateToResult(match.path);
  };

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('adminPanelVerified');
    }
    await logout();
    router.push('/auth/login');
  };

  return (
    <div style={{ padding: '0.75rem 1rem 0.5rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center' }} aria-hidden="true">
            <Logo
              imageClassName={sidebarStyles.logoImage}
              textClassName={sidebarStyles.logoTextFallback}
              fallbackText="Scribble Studios"
            />
          </span>
        </Link>

        <div ref={userDropdownRef} style={{ position: 'relative' }}>
          <button
            className={sidebarStyles.userButton}
            onClick={() => setShowUserDropdown((v) => !v)}
            aria-label="Open admin menu"
            style={{ width: 'auto', padding: 0, background: 'transparent' }}
          >
            <div className={sidebarStyles.userAvatar} style={{ width: 36, height: 36 }}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
                  stroke="#000000"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M20.5899 22C20.5899 18.13 16.7399 15 11.9999 15C7.25991 15 3.40991 18.13 3.40991 22"
                  stroke="#000000"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </button>

          {showUserDropdown && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 8px)',
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                overflow: 'hidden',
                minWidth: 180,
                zIndex: 50,
              }}
            >
              <Link
                href="/"
                style={{
                  display: 'block',
                  padding: '0.75rem 0.9rem',
                  textDecoration: 'none',
                  color: '#111',
                  fontWeight: 700,
                  borderBottom: '1px solid #f3f4f6',
                }}
                onClick={() => setShowUserDropdown(false)}
              >
                View site
              </Link>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.9rem',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: 800,
                  color: '#b91c1c',
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      <div ref={searchRef} style={{ marginTop: '0.75rem' }}>
        <form onSubmit={handleSearch} className={topBarStyles.searchForm}>
          <div className={topBarStyles.searchIcon}>
            <svg width="22" height="22" viewBox="0 -0.5 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
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
            placeholder="Search admin items…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={topBarStyles.searchInput}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setShowSearchResults(false);
              }}
              className={topBarStyles.clearSearchButton}
              aria-label="Clear search"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M18 6L6 18M6 6L18 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </form>

        {showSearchResults && searchQuery.trim() && (
          <div
            style={{
              marginTop: '0.5rem',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
            }}
          >
            {adminMenuItems
              .filter(
                (item) =>
                  item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.description.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .slice(0, 8)
              .map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigateToResult(item.path)}
                  style={{
                    width: '100%',
                    padding: '0.85rem 0.9rem',
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#111' }}>{item.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 2 }}>{item.description}</div>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

