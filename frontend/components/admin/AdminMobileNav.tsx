'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './AdminMobileNav.module.css';

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

export default function AdminMobileNav() {
  const pathname = usePathname();

  const items: NavItem[] = [
    {
      label: 'Home',
      href: '/admin',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7" />
          <path d="M9 22V12h6v10" />
        </svg>
      ),
    },
    {
      label: 'Orders',
      href: '/admin/orders',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="M9 14l2 2 4-4" />
        </svg>
      ),
    },
    {
      label: 'Deliveries',
      href: '/admin/deliveries',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 3h15v13H1z" />
          <path d="M16 8h4l3 3v5h-7V8z" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      ),
    },
    {
      label: 'More',
      href: '/admin/more',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </svg>
      ),
    },
  ];

  return (
    <nav className={styles.nav} aria-label="Admin navigation">
      {items.map((item) => {
        const active = item.href === '/admin' ? pathname === '/admin' : pathname?.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={`${styles.item} ${active ? styles.active : ''}`}>
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

