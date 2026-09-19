'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './MobileBottomNav.module.css';
import AppDownloadBanner from './AppDownloadBanner';

const navItems = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/products', label: 'Shop', icon: 'shop' },
  { href: '/get-trial-pack', label: 'Trial', icon: 'trial' },
  { href: '/subscriptions', label: 'Plans', icon: 'subscription' },
  { href: '/orders', label: 'Orders', icon: 'orders' },
] as const;

function NavIcon({ name, active }: { name: (typeof navItems)[number]['icon']; active: boolean }) {
  const c = active ? '#000' : '#666';
  switch (name) {
    case 'home':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case 'shop':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    case 'subscription':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 4v6h6" />
          <path d="M23 20v-6h-6" />
          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
        </svg>
      );
    case 'trial':
      return (
        <svg width="22" height="22" viewBox="0 0 54.391 54.391" fill={c} xmlns="http://www.w3.org/2000/svg">
          <g>
            <polygon points="0.285,19.392 24.181,49.057 13.342,19.392" />
            <polygon points="15.472,19.392 27.02,50.998 38.795,19.392" />
            <polygon points="29.593,49.823 54.105,19.392 40.929,19.392" />
            <polygon points="44.755,3.392 29.297,3.392 39.896,16.437" />
            <polygon points="38.094,17.392 27.195,3.979 16.297,17.392" />
            <polygon points="25.094,3.392 9.625,3.392 14.424,16.525" />
            <polygon points="7.959,4.658 0,17.392 12.611,17.392" />
            <polygon points="54.391,17.392 46.424,4.645 41.674,17.392" />
          </g>
        </svg>
      );
    case 'orders':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    default:
      return null;
  }
}

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const isAuth = pathname?.startsWith('/auth');
  const isAdmin = pathname?.startsWith('/admin');
  const isComingSoon = pathname === '/coming-soon';

  if (!isMobile || isAuth || isAdmin || isComingSoon) return null;

  return (
    <>
      <AppDownloadBanner />
      <div className={styles.spacer} aria-hidden />
      <nav className={styles.nav} aria-label="Bottom navigation">
      {navItems.map(({ href, label, icon }) => {
        const active = href === '/' ? pathname === '/' : pathname?.startsWith(href);
        return (
          <Link
            key={label}
            href={href}
            className={`${styles.item} ${icon === 'trial' ? styles.trialItem : ''} ${active ? styles.active : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className={styles.icon}>
              <NavIcon name={icon} active={!!active} />
            </span>
            <span className={styles.label}>{label}</span>
          </Link>
        );
      })}
      </nav>
    </>
  );
}
