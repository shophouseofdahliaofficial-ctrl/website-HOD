import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import WalletModal from '@/components/WalletModal';
import styles from './CustomerSidebarLayout.module.css';

export default function CustomerSidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams?.get('tab') || 'redeem';
  const { isAdmin, logout } = useAuth();

  const [isGiftCardsOpen, setIsGiftCardsOpen] = useState(pathname.startsWith('/customer/giftcard'));
  const [walletOpen, setWalletOpen] = useState(false);

  useEffect(() => {
    if (pathname.startsWith('/customer/giftcard')) {
      setIsGiftCardsOpen(true);
    }
  }, [pathname]);

  const sidebarLinks = [
    {
      href: '/dashboard', label: 'My Account', icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20.5899 22C20.5899 18.13 16.7399 15 11.9999 15C7.25991 15 3.40991 18.13 3.40991 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: 'Wallet',
      onClick: () => setWalletOpen(true),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 7H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19 7V5a2 2 0 0 0-2-2h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M1 11h22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      href: '/orders', label: 'Orders', icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 16V8C21 7.46957 20.7893 6.96086 20.4142 6.58579C20.0391 6.21071 19.5304 6 19 6H5C4.46957 6 3.96086 6.21071 3.58579 6.58579C3.21071 6.96086 3 7.46957 3 8V16C3 16.5304 3.21071 17.0391 3.58579 17.4142C3.96086 17.7893 4.46957 18 5 18H19C19.5304 18 20.0391 17.7893 20.4142 17.4142C20.7893 17.0391 21 16.5304 21 16Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 10H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      href: '/favorites', label: 'Favorites', icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      href: '/reviews', label: 'Reviews', icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
      )
    },
    {
      href: '/connectors', label: 'Connectors', icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: 'Gift Cards',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 8V16C21 17.1 20.1 18 19 18H5C3.9 18 3 17.1 3 16V8M21 8C21 6.9 20.1 6 19 6H5C3.9 6 3 6.9 3 8M21 8V10C21 11.1 20.1 12 19 12H5C3.9 12 3 11.1 3 10V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 2C9.5 2 7.5 4 7.5 6.5C7.5 8 8.5 9 10 10L12 12L14 10C15.5 9 16.5 8 16.5 6.5C16.5 4 14.5 2 12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      isCollapsible: true,
      children: [
        { href: '/customer/giftcard?tab=redeem', label: 'Redeem Gift Card' },
        { href: '/customer/giftcard?tab=create', label: 'Create a Gift Card' },
        { href: '/customer/giftcard?tab=pvc', label: 'Order a Physical Card' },
        { href: '/customer/giftcard?tab=history', label: 'Gift Card History' }
      ]
    },
    ...(isAdmin ? [{
      href: '/admin', label: 'Admin Panel', icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 3H10V10H3V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 3H21V10H14V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }] : []),
  ];

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <nav className={styles.sidebarNav}>
            {sidebarLinks.map((link, idx) => {
              if ('isCollapsible' in link && link.isCollapsible) {
                const isActive = pathname.startsWith('/customer/giftcard');
                return (
                  <div key="gift-cards-group" style={{ width: '100%' }}>
                    <button
                      type="button"
                      onClick={() => setIsGiftCardsOpen(!isGiftCardsOpen)}
                      className={`${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`}
                    >
                      <span className={styles.sidebarIcon}>{link.icon}</span>
                      <span className={styles.sidebarLabel} style={{ flex: 1 }}>{link.label}</span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{
                          transform: isGiftCardsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease',
                          color: 'currentColor',
                          opacity: 0.7
                        }}
                      >
                        <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    {isGiftCardsOpen && (
                      <div className={styles.sidebarSubNav}>
                        {link.children.map((sub) => {
                          const isSubActive = pathname === '/customer/giftcard' && sub.href.includes(`tab=${activeTab}`);
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              className={`${styles.sidebarSubItem} ${isSubActive ? styles.sidebarSubItemActive : ''}`}
                            >
                              {sub.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              if ('onClick' in link && link.onClick) {
                const actionLink = link as { label: string; onClick: () => void; icon: React.ReactNode };
                return (
                  <button
                    key={actionLink.label}
                    type="button"
                    onClick={actionLink.onClick}
                    className={styles.sidebarItem}
                  >
                    <span className={styles.sidebarIcon}>{actionLink.icon}</span>
                    <span className={styles.sidebarLabel}>{actionLink.label}</span>
                  </button>
                );
              }

              const normalLink = link as { href: string; label: string; icon: React.ReactNode };
              return (
                <Link
                  key={normalLink.href}
                  href={normalLink.href}
                  className={`${styles.sidebarItem} ${pathname === normalLink.href ? styles.sidebarItemActive : ''}`}
                >
                  <span className={styles.sidebarIcon}>{normalLink.icon}</span>
                  <span className={styles.sidebarLabel}>{normalLink.label}</span>
                </Link>
              );
            })}
            <button
              className={`${styles.sidebarItem} ${styles.sidebarLogout}`}
              onClick={logout}
            >
              <span className={styles.sidebarIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className={styles.sidebarLabel}>Logout</span>
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <div className={styles.mainContent}>
          {children}
        </div>
      </div>
      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  );
}
