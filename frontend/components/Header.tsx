'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import styles from './Header.module.css';
import cardStyles from './ProductsSection.module.css';
import { User, Product } from '@/types';
import { cartIconRefStore } from '@/lib/utils/cartIconRef';
import { readScopedPincode, writeScopedPincode, scopedPincodeStatusKey } from '@/lib/utils/userScopedStorage';
import { apiClient, contentApi, productsApi, walletApi, deliveryApi, DeliveryPincodeCheckResponse } from '@/lib/api';
import ProductDetailsModal from './ProductDetailsModal';
import Logo from './Logo';
import NavigationProgressBar from './NavigationProgressBar';
import { getFirstVariationForCard, getCardPriceDisplay, getProductDisplayUnitLabel, getVariationSellingPrice } from '@/lib/utils/productCardPricing';
import { getPrimaryProductImageUrl, getOrderedProductImageUrls } from '@/lib/utils/productImages';
import { useCategoryMap } from '@/hooks/useCategoryMap';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { SITE_NAME } from '@/lib/seo';
import DesktopCartDrawer from './DesktopCartDrawer';
import DesktopSearchDrawer from './DesktopSearchDrawer';
import ProductCardImage from '@/components/ui/ProductCardImage';
import WalletModal from './WalletModal';

const REVIEW_US_URL =
  'https://www.google.com/search?q=milko+gwalior&sca_esv=8fdea6dbd6add952&authuser=3&sxsrf=ANbL-n7qfx2M_iJY6Dk6JYLRfKEGrnK91w%3A1777917729569&source=hp&ei=Id_4afLiH-6q4-EPrrmjiQ0&iflsig=AFdpzrgAAAAAafjtMdqwAiRFfJiXKjlPPoicbxX6o5Sg&oq=milko&gs_lp=Egdnd3Mtd2l6IgVtaWxrbyoCCAAyBBAjGCcyCxAAGIAEGIoFGJECMgsQABiABBiKBRiRAjIKEC4YgAQYigUYQzIKEC4YgAQYigUYQzIFEAAYgAQyBRAAGIAEMgUQABiABDILEC4YgAQYxwEYrwEyBRAAGIAESP4NUABYqgRwAHgAkAEAmAGPAaABigWqAQMwLjW4AQHIAQD4AQGYAgWgArYFwgIREC4YgAQYigUYkQIYxwEY0QPCAg4QLhiABBixAxjHARjRA8ICDhAAGIAEGIoFGLEDGIMBwgIOEC4YgAQYigUYsQMYgwHCAgsQABiABBixAxiDAcICCBAuGIAEGLEDwgIOEAAYgAQYigUYkQIYsQPCAhMQLhiABBiKBRhDGMcBGK8BGI4FwgIKEAAYgAQYigUYQ8ICCBAAGIAEGLEDmAMA4gMFEgExIECSBwMwLjWgB8pIsgcDMC41uAe2BcIHBTItNC4xyAcigAgB&sclient=gws-wiz#lrd=0x3976c12bef6ae93f:0x8427baeae2ab4794,3,,,,';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.04 14.69 2 12.04 2ZM12.04 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.04 20.16C10.66 20.16 9.3 19.81 8.08 19.14L7.79 18.97L4.68 19.79L5.51 16.76L5.32 16.46C4.58 15.18 4.19 13.72 4.19 11.91C4.19 7.37 7.89 3.67 12.04 3.67ZM8.53 7.33C8.37 7.33 8.1 7.39 7.87 7.64C7.65 7.89 7.01 8.49 7.01 9.71C7.01 10.93 7.9 12.11 8.02 12.28C8.15 12.44 9.77 14.94 12.25 16.01C12.84 16.27 13.3 16.42 13.66 16.53C14.25 16.72 14.79 16.69 15.22 16.63C15.7 16.56 16.68 16.03 16.89 15.45C17.1 14.87 17.1 14.38 17.04 14.27C16.97 14.17 16.81 14.11 16.56 13.98C16.31 13.86 15.09 13.26 14.86 13.18C14.64 13.09 14.47 13.05 14.31 13.3C14.14 13.55 13.67 14.11 13.52 14.27C13.38 14.44 13.23 14.46 12.98 14.34C12.74 14.21 11.94 13.95 11 13.11C10.26 12.46 9.77 11.65 9.62 11.41C9.48 11.16 9.6 11.02 9.73 10.89C9.84 10.78 9.97 10.6 10.1 10.45C10.22 10.31 10.26 10.2 10.34 10.04C10.43 9.87 10.38 9.73 10.32 9.61C10.26 9.48 9.77 8.27 9.56 7.78C9.36 7.29 9.15 7.36 9 7.35L8.53 7.33Z" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function FeedbackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function formatWhatsAppLink(raw?: string): string {
  if (!raw || !raw.trim()) return 'https://wa.me/';
  const trimmed = raw.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const cleanDigits = trimmed.replace(/[^\d]/g, '');
  return cleanDigits ? `https://wa.me/${cleanDigits}` : 'https://wa.me/';
}

/**
 * User Dropdown Component
 * Shows "Hi, [name]" with dropdown menu
 */
function UserDropdown({ user, logout, isAdmin, isMobile = false, className = '', onClose }: { user: User | null; logout: () => void; isAdmin: boolean; isMobile?: boolean; className?: string; onClose?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
    router.push('/');
  };

  // Mobile: redirect to /account page instead of showing dropdown
  if (isMobile) {
    return (
      <Link
        href="/account"
        className={`${styles.iconButton} ${className}`.trim()}
        aria-label="Account"
        onClick={() => {
          if (onClose) onClose();
        }}
      >
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name || 'User'}
            className={styles.buttonIcon}
            referrerPolicy="no-referrer"
            style={{ borderRadius: '50%', objectFit: 'cover', width: '20px', height: '20px' }}
          />
        ) : (
          <svg className={styles.buttonIcon} viewBox="0 0 24.00 24.00" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
            <g id="SVGRepo_iconCarrier">
              <path fillRule="evenodd" clipRule="evenodd" d="M8.25 9C8.25 6.92893 9.92893 5.25 12 5.25C14.0711 5.25 15.75 6.92893 15.75 9C15.75 11.0711 14.0711 12.75 12 12.75C9.92893 12.75 8.25 11.0711 8.25 9ZM12 6.75C10.7574 6.75 9.75 7.75736 9.75 9C9.75 10.2426 10.7574 11.25 12 11.25C13.2426 11.25 14.25 10.2426 14.25 9C14.25 7.75736 13.2426 6.75 12 6.75Z" fill="currentColor"></path>
              <path fillRule="evenodd" clipRule="evenodd" d="M1.25 12C1.25 6.06294 6.06294 1.25 12 1.25C17.9371 1.25 22.75 6.06294 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75C6.06294 22.75 1.25 17.9371 1.25 12ZM12 2.75C6.89137 2.75 2.75 6.89137 2.75 12C2.75 14.5456 3.77827 16.851 5.4421 18.5235C5.6225 17.5504 5.97694 16.6329 6.68837 15.8951C7.75252 14.7915 9.45416 14.25 12 14.25C14.5457 14.25 16.2474 14.7915 17.3115 15.8951C18.023 16.6329 18.3774 17.5505 18.5578 18.5236C20.2217 16.8511 21.25 14.5456 21.25 12C21.25 6.89137 17.1086 2.75 12 2.75ZM17.1937 19.6554C17.0918 18.4435 16.8286 17.5553 16.2318 16.9363C15.5823 16.2628 14.3789 15.75 12 15.75C9.62099 15.75 8.41761 16.2628 7.76815 16.9363C7.17127 17.5553 6.90811 18.4434 6.80622 19.6553C8.28684 20.6618 10.0747 21.25 12 21.25C13.9252 21.25 15.7131 20.6618 17.1937 19.6554Z" fill="currentColor"></path>
            </g>
          </svg>
        )}
      </Link>
    );
  }

  return (
    <div className={styles.userDropdown} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={styles.userButton}
        aria-label="Account"
      >
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name || 'User'}
            className={styles.userButtonIcon}
            referrerPolicy="no-referrer"
            style={{ borderRadius: '50%', objectFit: 'cover', width: '20px', height: '20px' }}
          />
        ) : (
          <svg className={styles.userButtonIcon} viewBox="0 0 24.00 24.00" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
            <g id="SVGRepo_iconCarrier">
              <path fillRule="evenodd" clipRule="evenodd" d="M8.25 9C8.25 6.92893 9.92893 5.25 12 5.25C14.0711 5.25 15.75 6.92893 15.75 9C15.75 11.0711 14.0711 12.75 12 12.75C9.92893 12.75 8.25 11.0711 8.25 9ZM12 6.75C10.7574 6.75 9.75 7.75736 9.75 9C9.75 10.2426 10.7574 11.25 12 11.25C13.2426 11.25 14.25 10.2426 14.25 9C14.25 7.75736 13.2426 6.75 12 6.75Z" fill="currentColor"></path>
              <path fillRule="evenodd" clipRule="evenodd" d="M1.25 12C1.25 6.06294 6.06294 1.25 12 1.25C17.9371 1.25 22.75 6.06294 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75C6.06294 22.75 1.25 17.9371 1.25 12ZM12 2.75C6.89137 2.75 2.75 6.89137 2.75 12C2.75 14.5456 3.77827 16.851 5.4421 18.5235C5.6225 17.5504 5.97694 16.6329 6.68837 15.8951C7.75252 14.7915 9.45416 14.25 12 14.25C14.5457 14.25 16.2474 14.7915 17.3115 15.8951C18.023 16.6329 18.3774 17.5505 18.5578 18.5236C20.2217 16.8511 21.25 14.5456 21.25 12C21.25 6.89137 17.1086 2.75 12 2.75ZM17.1937 19.6554C17.0918 18.4435 16.8286 17.5553 16.2318 16.9363C15.5823 16.2628 14.3789 15.75 12 15.75C9.62099 15.75 8.41761 16.2628 7.76815 16.9363C7.17127 17.5553 6.90811 18.4434 6.80622 19.6553C8.28684 20.6618 10.0747 21.25 12 21.25C13.9252 21.25 15.7131 20.6618 17.1937 19.6554Z" fill="currentColor"></path>
            </g>
          </svg>
        )}
        <span className={styles.userButtonText}>Hi, {user?.name || 'User'}</span>
        <svg className={`${styles.dropdownArrow} ${isOpen ? styles.dropdownArrowOpen : ''}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className={`${styles.dropdownMenu} ${isOpen ? styles.dropdownMenuOpen : ''}`}>
        <Link href="/dashboard" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
          <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20.5899 22C20.5899 18.13 16.7399 15 11.9999 15C7.25991 15 3.40991 18.13 3.40991 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          My Account
        </Link>

        <Link href="/orders" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
          <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 16V8C21 7.46957 20.7893 6.96086 20.4142 6.58579C20.0391 6.21071 19.5304 6 19 6H5C4.46957 6 3.96086 6.21071 3.58579 6.58579C3.21071 6.96086 3 7.46957 3 8V16C3 16.5304 3.21071 17.0391 3.58579 17.4142C3.96086 17.7893 4.46957 18 5 18H19C19.5304 18 20.0391 17.7893 20.4142 17.4142C20.7893 17.0391 21 16.5304 21 16Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 10H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 14H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Orders
        </Link>
        <Link href="/favorites" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
          <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Favorites
        </Link>
        <button
          type="button"
          className={styles.dropdownItem}
          onClick={() => {
            setIsOpen(false);
            setWalletModalOpen(true);
          }}
        >
          <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 7H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19 7V5a2 2 0 0 0-2-2h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1 11h22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Wallet
        </button>
        <Link href="/customer/giftcard" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
          <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 8V16C21 17.1 20.1 18 19 18H5C3.9 18 3 17.1 3 16V8M21 8C21 6.9 20.1 6 19 6H5C3.9 6 3 6.9 3 8M21 8V10C21 11.1 20.1 12 19 12H5C3.9 12 3 11.1 3 10V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 2C9.5 2 7.5 4 7.5 6.5C7.5 8 8.5 9 10 10L12 12L14 10C15.5 9 16.5 8 16.5 6.5C16.5 4 14.5 2 12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Gift Cards
        </Link>
        {isAdmin && (
          <Link href="/admin" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
            <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3H10V10H3V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 3H21V10H14V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 14H10V21H3V14Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 14H21V21H14V14Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Panel
          </Link>
        )}
        <button className={styles.dropdownItem} onClick={handleLogout}>
          <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 12H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Logout
        </button>
      </div>
      <WalletModal open={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </div>
  );
}

const getProductPriceRange = (p: Product) => {
  if (!p.variations || p.variations.length === 0) return '';
  const prices = p.variations.map(v => getVariationSellingPrice(v, p));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  if (minPrice === maxPrice) {
    return `₹${minPrice.toFixed(0)}`;
  }
  return `₹${minPrice.toFixed(0)} - ₹${maxPrice.toFixed(0)}`;
};

const OTHERS_NAV_PATHS = ['/calendars', '/notepads', '/posters', '/sketchbooks', '/planners', '/papers', '/cardstocks'];
const KEEPSAKES_NAV_PATHS = ['/memorybooks', '/polaroids'];

const OTHERS_MARQUEE_ITEMS = [
  { label: 'Calendars', href: '/calendars' },
  { label: 'Notepads', href: '/notepads' },
  { label: 'Posters', href: '/posters' },
  { label: 'Sketchbooks', href: '/sketchbooks' },
  { label: 'Planners', href: '/planners' },
  { label: 'Papers', href: '/papers' },
  { label: 'Card Stocks', href: '/cardstocks' },
];

const KEEPSAKES_MARQUEE_ITEMS = [
  { label: 'Memory Books', href: '/memorybooks' },
  { label: 'Polas & Strips', href: '/polaroids' },
];

function isHeaderNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isOthersNavActive(pathname: string | null): boolean {
  if (!pathname) return false;
  return OTHERS_NAV_PATHS.some((href) => isHeaderNavActive(pathname, href));
}

function isKeepsakesNavActive(pathname: string | null): boolean {
  if (!pathname) return false;
  return KEEPSAKES_NAV_PATHS.some((href) => isHeaderNavActive(pathname, href));
}

/**
 * Header Component
 * Contains logo, search bar, membership button, and login button
 */
export default function Header() {
  const categoryMap = useCategoryMap();
  const { isAuthenticated, user, logout, isAdmin, loading } = useAuth();
  const { itemCount, items, addItem } = useCart();
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[] | null>(null);
  const [isSearchProductsLoading, setIsSearchProductsLoading] = useState(false);
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
  const [isSearchOverlayClosing, setIsSearchOverlayClosing] = useState(false);
  const searchOverlayInputRef = useRef<HTMLInputElement>(null);
  const searchOverlayCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const [isDesktopSearchOpen, setIsDesktopSearchOpen] = useState(false);
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);
  const [isCallMenuOpen, setIsCallMenuOpen] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const callMenuRef = useRef<HTMLDivElement>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [pincode, setPincode] = useState(['', '', '', '', '', '']);
  const [deliveryStatus, setDeliveryStatus] = useState<'checking' | 'available' | 'unavailable' | null>(null);
  const [pincodeDetails, setPincodeDetails] = useState<DeliveryPincodeCheckResponse | null>(null);
  const [savedPincode, setSavedPincode] = useState<string | null>(null);
  const [savedDeliveryStatus, setSavedDeliveryStatus] = useState<'available' | 'unavailable' | null>(null);
  const [serviceablePincodes, setServiceablePincodes] = useState<Array<{ pincode: string; deliveryTime?: string }> | null>(null);
  const pincodeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Mobile navigation menu state, refs and effects
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopCartOpen, setIsDesktopCartOpen] = useState(false);
  const [isDesktopHelpOpen, setIsDesktopHelpOpen] = useState(false);
  const [isDesktopSearchDrawerOpen, setIsDesktopSearchDrawerOpen] = useState(false);
  const [isMobileOthersOpen, setIsMobileOthersOpen] = useState(false);
  const [isMobileKeepsakesOpen, setIsMobileKeepsakesOpen] = useState(false);
  const [isMobileHelpOpen, setIsMobileHelpOpen] = useState(false);
  const rightButtonsRef = useRef<HTMLDivElement>(null);
  const rightButtonsCollapsedRef = useRef<HTMLDivElement>(null);
  const rightButtonsExpandedRef = useRef<HTMLDivElement>(null);
  const desktopCartExpandedRef = useRef<HTMLDivElement>(null);
  const desktopHelpExpandedRef = useRef<HTMLDivElement>(null);
  const desktopSearchExpandedRef = useRef<HTMLDivElement>(null);
  const mobileMenuBackdropRef = useRef<HTMLDivElement>(null);
  const mobileMenuHeaderRef = useRef<HTMLDivElement>(null);
  const mobileNavMenuRef = useRef<HTMLElement>(null);
  const isMenuAnimatingRef = useRef(false);
  const collapsedPillRectRef = useRef<{ top: number; left: number; width: number; height: number } | null>(null);
  const currentDesktopCartScrollYRef = useRef(0);
  const [canScrollTop, setCanScrollTop] = useState(false);
  const [canScrollBottom, setCanScrollBottom] = useState(false);

  // Help & Feedback / Review State
  const [whatsappNumber, setWhatsappNumber] = useState<string>('');
  const [trustpilotUrl, setTrustpilotUrl] = useState<string>('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('contact@myscribble.in');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [feedbackEmail, setFeedbackEmail] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Load reviews URLs, WhatsApp support number and Contact details on mount
  useEffect(() => {
    contentApi.getByType('help_support')
      .then((data) => {
        if (data && data.isActive && data.metadata && data.metadata.helpSupportNumber) {
          setWhatsappNumber(data.metadata.helpSupportNumber);
        }
      })
      .catch((err) => {
        console.error('Failed to load help_support settings for Header:', err);
      });

    contentApi.getByType('reviews')
      .then((data) => {
        if (data && data.isActive && data.metadata) {
          if (data.metadata.trustpilotUrl) {
            setTrustpilotUrl(data.metadata.trustpilotUrl);
          }
          if (data.metadata.googleReviewUrl) {
            setGoogleReviewUrl(data.metadata.googleReviewUrl);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load reviews settings for Header:', err);
      });

    contentApi.getByType('contact')
      .then((data) => {
        if (data && data.metadata) {
          if (data.metadata.email) {
            setContactEmail(data.metadata.email);
          }
          if (data.metadata.whatsapp) {
            setWhatsappNumber((prev) => prev || data.metadata.whatsapp);
          } else if (data.metadata.phone) {
            setWhatsappNumber((prev) => prev || data.metadata.phone);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load contact info for Header:', err);
      });
  }, []);

  // Prefill email if logged in
  useEffect(() => {
    if (isAuthenticated && user?.email) {
      setFeedbackEmail(user.email);
    } else {
      setFeedbackEmail('');
    }
  }, [user, isAuthenticated, feedbackOpen]);

  const closeFeedbackModal = () => {
    setFeedbackOpen(false);
    setFeedbackMessage('');
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackEmail.trim() || !feedbackMessage.trim()) {
      showToast('Please fill out all fields.', 'error');
      return;
    }
    setSubmittingFeedback(true);
    try {
      await apiClient.post('/api/feedback', {
        email: feedbackEmail.trim(),
        message: feedbackMessage.trim(),
      });
      showToast('Thank you for your feedback!', 'success');
      closeFeedbackModal();
    } catch (err: any) {
      console.error('Failed to submit feedback:', err);
      showToast(err?.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const updateScrollFades = useCallback(() => {
    const el = mobileNavMenuRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const isScrollable = scrollHeight > clientHeight + 2;

    if (!isScrollable) {
      setCanScrollTop(false);
      setCanScrollBottom(false);
      return;
    }

    setCanScrollTop(scrollTop > 4);
    setCanScrollBottom(scrollTop + clientHeight < scrollHeight - 4);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    updateScrollFades();
    const timer1 = setTimeout(updateScrollFades, 60);
    const timer2 = setTimeout(updateScrollFades, 260);
    const timer3 = setTimeout(updateScrollFades, 560);
    window.addEventListener('resize', updateScrollFades);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      window.removeEventListener('resize', updateScrollFades);
    };
  }, [isMobileMenuOpen, isMobileKeepsakesOpen, isMobileOthersOpen, updateScrollFades]);

  const openMobileMenu = () => {
    if (isMenuAnimatingRef.current) return;
    const nav = rightButtonsRef.current;
    if (nav) {
      const rect = nav.getBoundingClientRect();
      collapsedPillRectRef.current = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
    }
    setIsMobileMenuOpen(true);
  };

  const openDesktopCart = useCallback(() => {
    if (isMenuAnimatingRef.current) return;
    setIsDesktopHelpOpen(false);
    currentDesktopCartScrollYRef.current = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    const nav = rightButtonsRef.current;
    if (nav) {
      const rect = nav.getBoundingClientRect();
      collapsedPillRectRef.current = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
    }
    setIsDesktopCartOpen(true);
  }, []);

  const openDesktopHelp = useCallback(() => {
    if (isMenuAnimatingRef.current) return;
    setIsDesktopCartOpen(false);
    setIsDesktopSearchDrawerOpen(false);
    const nav = rightButtonsRef.current;
    if (nav) {
      const rect = nav.getBoundingClientRect();
      collapsedPillRectRef.current = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
    }
    setIsDesktopHelpOpen(true);
  }, []);

  const openDesktopSearch = useCallback(() => {
    if (isMenuAnimatingRef.current) return;
    setIsDesktopCartOpen(false);
    setIsDesktopHelpOpen(false);
    ensureProducts();
    const nav = rightButtonsRef.current;
    if (nav) {
      const rect = nav.getBoundingClientRect();
      collapsedPillRectRef.current = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
    }
    setIsDesktopSearchDrawerOpen(true);
  }, []);

  const closeDesktopSearch = useCallback(() => {
    if (isMenuAnimatingRef.current) return;
    const nav = rightButtonsRef.current;
    const collapsedContent = rightButtonsCollapsedRef.current;
    const searchContent = desktopSearchExpandedRef.current;

    if (!nav) {
      setIsDesktopSearchDrawerOpen(false);
      return;
    }

    isMenuAnimatingRef.current = true;
    const savedRect = collapsedPillRectRef.current || {
      top: 14,
      left: window.innerWidth - 100,
      width: 86,
      height: 44,
    };

    gsap.killTweensOf([nav, collapsedContent, searchContent].filter(Boolean));

    const tl = gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      onComplete: () => {
        setIsDesktopSearchDrawerOpen(false);
        if (searchContent) gsap.set(searchContent, { display: 'none' });
        if (collapsedContent) gsap.set(collapsedContent, { display: 'flex', opacity: 1 });
        gsap.set(nav, { clearProps: 'all' });
        isMenuAnimatingRef.current = false;
      },
    });

    if (searchContent) {
      tl.to(searchContent, { opacity: 0, duration: 0.15, ease: 'power2.in' }, 0);
    }

    tl.to(
      nav,
      {
        top: savedRect.top,
        left: savedRect.left,
        width: savedRect.width,
        height: savedRect.height,
        borderRadius: 555,
        background: '#ffffffbf',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '3px 4px',
        boxShadow: 'none',
        duration: 0.42,
        ease: 'power3.inOut',
      },
      0.04
    );

    if (collapsedContent) {
      tl.to(
        collapsedContent,
        {
          opacity: 1,
          duration: 0.18,
          ease: 'power2.out',
          onStart: () => {
            gsap.set(collapsedContent, { display: 'flex' });
          },
        },
        0.24
      );
    }
  }, []);

  const closeDesktopHelp = useCallback(() => {
    if (isMenuAnimatingRef.current) return;
    const nav = rightButtonsRef.current;
    const backdrop = mobileMenuBackdropRef.current;
    const collapsedContent = rightButtonsCollapsedRef.current;
    const helpContent = desktopHelpExpandedRef.current;

    if (!nav) {
      setIsDesktopHelpOpen(false);
      return;
    }

    isMenuAnimatingRef.current = true;
    const savedRect = collapsedPillRectRef.current || {
      top: 14,
      left: window.innerWidth - 100,
      width: 86,
      height: 44,
    };

    gsap.killTweensOf([backdrop, nav, collapsedContent, helpContent].filter(Boolean));

    const tl = gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      onComplete: () => {
        setIsDesktopHelpOpen(false);
        document.documentElement.removeAttribute('data-desktop-help-open');
        document.body.removeAttribute('data-desktop-help-open');
        if (backdrop) gsap.set(backdrop, { display: 'none', pointerEvents: 'none' });
        if (helpContent) gsap.set(helpContent, { display: 'none' });
        if (collapsedContent) gsap.set(collapsedContent, { display: 'flex', opacity: 1 });
        gsap.set(nav, { clearProps: 'all' });
        isMenuAnimatingRef.current = false;
      },
    });

    if (backdrop) {
      tl.to(backdrop, { opacity: 0, duration: 0.35, ease: 'power2.inOut' }, 0);
    }

    if (helpContent) {
      tl.to(helpContent, { opacity: 0, duration: 0.15, ease: 'power2.in' }, 0);
    }

    tl.to(
      nav,
      {
        top: savedRect.top,
        left: savedRect.left,
        width: savedRect.width,
        height: savedRect.height,
        borderRadius: 555,
        background: '#ffffffbf',
        padding: '3px 4px',
        boxShadow: 'none',
        duration: 0.42,
        ease: 'power3.inOut',
      },
      0.04
    );

    if (collapsedContent) {
      tl.to(
        collapsedContent,
        {
          opacity: 1,
          duration: 0.18,
          ease: 'power2.out',
          onStart: () => {
            gsap.set(collapsedContent, { display: 'flex' });
          },
        },
        0.24
      );
    }
  }, []);

  useEffect(() => {
    const handleOpenDesktopCart = () => {
      openDesktopCart();
    };
    window.addEventListener('open-desktop-cart', handleOpenDesktopCart);
    window.addEventListener('open-cart-drawer', handleOpenDesktopCart);
    window.addEventListener('milko:open-desktop-cart', handleOpenDesktopCart);
    return () => {
      window.removeEventListener('open-desktop-cart', handleOpenDesktopCart);
      window.removeEventListener('open-cart-drawer', handleOpenDesktopCart);
      window.removeEventListener('milko:open-desktop-cart', handleOpenDesktopCart);
    };
  }, [openDesktopCart]);

  const closeDesktopCart = () => {
    if (isMenuAnimatingRef.current) return;
    const nav = rightButtonsRef.current;
    const backdrop = mobileMenuBackdropRef.current;
    const collapsedContent = rightButtonsCollapsedRef.current;
    const cartContent = desktopCartExpandedRef.current;

    if (!nav) {
      setIsDesktopCartOpen(false);
      return;
    }

    isMenuAnimatingRef.current = true;
    const savedRect = collapsedPillRectRef.current || {
      top: 14,
      left: window.innerWidth - 100,
      width: 86,
      height: 44,
    };

    gsap.killTweensOf([backdrop, nav, collapsedContent, cartContent].filter(Boolean));

    const tl = gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      onComplete: () => {
        setIsDesktopCartOpen(false);
        document.body.removeAttribute('data-desktop-cart-open');
        (window as any).lenis?.start();
        if (backdrop) gsap.set(backdrop, { display: 'none', pointerEvents: 'none' });
        if (cartContent) gsap.set(cartContent, { display: 'none' });
        if (collapsedContent) gsap.set(collapsedContent, { display: 'flex', opacity: 1 });
        gsap.set(nav, { clearProps: 'all' });
        isMenuAnimatingRef.current = false;
      },
    });

    if (backdrop) {
      tl.to(backdrop, { opacity: 0, duration: 0.35, ease: 'power2.inOut' }, 0);
    }

    if (cartContent) {
      tl.to(cartContent, { opacity: 0, duration: 0.15, ease: 'power2.in' }, 0);
    }

    tl.to(
      nav,
      {
        top: savedRect.top,
        left: savedRect.left,
        width: savedRect.width,
        height: savedRect.height,
        borderRadius: 555,
        background: '#ffffffbf',
        padding: '3px 4px',
        boxShadow: 'none',
        duration: 0.42,
        ease: 'power3.inOut',
      },
      0.04
    );

    if (collapsedContent) {
      tl.to(
        collapsedContent,
        {
          opacity: 1,
          duration: 0.18,
          ease: 'power2.out',
          onStart: () => {
            gsap.set(collapsedContent, { display: 'flex' });
          },
        },
        0.24
      );
    }
  };

  const closeMobileMenu = () => {
    if (isMenuAnimatingRef.current) return;
    const nav = rightButtonsRef.current;
    const backdrop = mobileMenuBackdropRef.current;
    const collapsedContent = rightButtonsCollapsedRef.current;
    const expandedContent = rightButtonsExpandedRef.current;
    const header = mobileMenuHeaderRef.current;
    const navMenu = mobileNavMenuRef.current;

    if (!nav) {
      setIsMobileMenuOpen(false);
      return;
    }

    isMenuAnimatingRef.current = true;
    const savedRect = collapsedPillRectRef.current || {
      top: 14,
      left: window.innerWidth - 100,
      width: 86,
      height: 44,
    };
    const navChildren = navMenu ? Array.from(navMenu.children) : [];

    gsap.killTweensOf([backdrop, nav, collapsedContent, expandedContent, header, ...navChildren]);

    const tl = gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      onComplete: () => {
        setIsMobileMenuOpen(false);
        document.body.style.overflow = '';
        document.body.removeAttribute('data-mobile-menu-open');
        if (backdrop) gsap.set(backdrop, { display: 'none', pointerEvents: 'none' });
        if (expandedContent) gsap.set(expandedContent, { display: 'none' });
        if (collapsedContent) gsap.set(collapsedContent, { display: 'flex', opacity: 1 });
        gsap.set(nav, { clearProps: 'all' });
        isMenuAnimatingRef.current = false;
      }
    });

    // Fade out backdrop
    if (backdrop) {
      tl.to(
        backdrop,
        {
          opacity: 0,
          duration: 0.42,
          ease: 'power2.inOut',
        },
        0
      );
    }

    // Fade out expanded content
    tl.to(
      [header, ...navChildren].filter(Boolean),
      {
        opacity: 0,
        duration: 0.16,
        ease: 'power2.in',
      },
      0
    );

    if (expandedContent) {
      tl.to(
        expandedContent,
        {
          opacity: 0,
          duration: 0.18,
          ease: 'power2.in',
        },
        0
      );
    }

    // Morph rightButtons back to its collapsed pill position, size, and 555px border-radius (shrinking back up and to the right)
    tl.to(
      nav,
      {
        top: savedRect.top,
        left: savedRect.left,
        width: savedRect.width,
        height: savedRect.height,
        borderRadius: '555px',
        background: '#ffffffbf',
        padding: '3px 4px',
        boxShadow: 'none',
        duration: 0.46,
        ease: 'power3.inOut',
      },
      0.04
    );

    // Fade in collapsed buttons
    if (collapsedContent) {
      tl.set(collapsedContent, { display: 'flex', opacity: 0 }, 0.08);
      tl.to(
        collapsedContent,
        {
          opacity: 1,
          duration: 0.22,
          ease: 'power2.out',
        },
        0.22
      );
    }
  };

  // Desktop in-pill expanded sub-menu state
  const [expandedDropdown, setExpandedDropdown] = useState<'keepsakes' | 'others' | null>(null);
  const [navNaturalWidth, setNavNaturalWidth] = useState<number | null>(null);
  const navMenuRef = useRef<HTMLElement>(null);
  const navLinksRowRef = useRef<HTMLDivElement>(null);
  const expandedSectionRef = useRef<HTMLDivElement>(null);
  const marqueeTrackRef = useRef<HTMLDivElement>(null);
  const marqueeContentRef = useRef<HTMLDivElement>(null);
  const marqueeContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartPosRef = useRef(0);
  const marqueePosRef = useRef(0);
  const marqueeSpeedRef = useRef(-1.0);
  const scrollVelocityRef = useRef(0);
  const targetSpeedRef = useRef(-1.0);
  const openTimeRef = useRef(0);
  const isHoveredRef = useRef(false);

  const currentDropdownItems = expandedDropdown === 'others'
    ? OTHERS_MARQUEE_ITEMS
    : expandedDropdown === 'keepsakes'
      ? KEEPSAKES_MARQUEE_ITEMS
      : [];

  const isMarqueeLooping = expandedDropdown === 'others';

  const handleDropdownToggle = (type: 'keepsakes' | 'others') => {
    setExpandedDropdown((prev) => (prev === type ? null : type));
  };

  // Measure initial natural width of top nav items to strictly lock width during expansion
  useEffect(() => {
    const measureWidth = () => {
      if (navLinksRowRef.current) {
        const w = navLinksRowRef.current.scrollWidth || navLinksRowRef.current.offsetWidth;
        if (w > 0) {
          setNavNaturalWidth(w + 16); // +16 for horizontal padding
        }
      }
    };

    measureWidth();
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(measureWidth);
    }
    window.addEventListener('resize', measureWidth);
    return () => window.removeEventListener('resize', measureWidth);
  }, []);

  // Close dropdown on route changes
  useEffect(() => {
    if (isMobileMenuOpen || isDesktopCartOpen || isDesktopHelpOpen) {
      const nav = rightButtonsRef.current;
      const backdrop = mobileMenuBackdropRef.current;
      const collapsedContent = rightButtonsCollapsedRef.current;
      const expandedContent = rightButtonsExpandedRef.current;
      const cartContent = desktopCartExpandedRef.current;
      const helpContent = desktopHelpExpandedRef.current;
      if (backdrop) gsap.set(backdrop, { display: 'none', pointerEvents: 'none', opacity: 0 });
      if (expandedContent) gsap.set(expandedContent, { display: 'none', opacity: 0 });
      if (cartContent) gsap.set(cartContent, { display: 'none', opacity: 0 });
      if (helpContent) gsap.set(helpContent, { display: 'none', opacity: 0 });
      if (collapsedContent) gsap.set(collapsedContent, { display: 'flex', opacity: 1 });
      if (nav) gsap.set(nav, { clearProps: 'all' });
      document.body.style.overflow = '';
      document.body.removeAttribute('data-mobile-menu-open');
      document.body.removeAttribute('data-desktop-cart-open');
      isMenuAnimatingRef.current = false;
    }
    setIsMobileMenuOpen(false);
    setIsDesktopCartOpen(false);
    setIsDesktopHelpOpen(false);
    setIsMobileOthersOpen(false);
    setIsMobileKeepsakesOpen(false);
    setIsMobileHelpOpen(false);
    setExpandedDropdown(null);
  }, [pathname]);

  // GSAP smooth height expand & collapse animation for desktop .navMenu
  useEffect(() => {
    const nav = navMenuRef.current;
    const section = expandedSectionRef.current;
    if (!nav) return;

    const rowH = navLinksRowRef.current?.offsetHeight || 28;
    const baseH = rowH + 20;

    if (expandedDropdown) {
      gsap.killTweensOf(nav);
      if (section) {
        section.style.display = 'flex';
        gsap.killTweensOf(section);
      }

      const targetHeight = baseH + 195;

      gsap.to(nav, {
        height: targetHeight,
        duration: 0.35,
        ease: 'power3.inOut',
      });

      if (section) {
        gsap.fromTo(
          section,
          { opacity: 0, y: -4 },
          { opacity: 1, y: 0, duration: 0.35, ease: 'power3.inOut' }
        );
      }
    } else {
      gsap.killTweensOf(nav);
      if (section) gsap.killTweensOf(section);

      if (section) {
        gsap.to(section, {
          opacity: 0,
          duration: 0.2,
          ease: 'power2.in',
        });
      }

      gsap.to(nav, {
        height: baseH,
        duration: 0.35,
        ease: 'power3.inOut',
        onComplete: () => {
          if (section) section.style.display = 'none';
          if (nav) nav.style.height = 'auto';
        },
      });
    }
  }, [expandedDropdown]);

  // Click outside and Escape key to close expanded dropdown
  useEffect(() => {
    if (!expandedDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (navMenuRef.current && !navMenuRef.current.contains(e.target as Node)) {
        setExpandedDropdown(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpandedDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [expandedDropdown]);

  // Infinite Marquee animation loop with smooth inertia glide (only when items overflow/loop)
  useEffect(() => {
    if (!expandedDropdown || !isMarqueeLooping) {
      if (marqueeTrackRef.current) {
        marqueeTrackRef.current.style.transform = 'none';
      }
      marqueeSpeedRef.current = -1.0;
      scrollVelocityRef.current = 0;
      targetSpeedRef.current = -1.0;
      return;
    }

    marqueePosRef.current = 0;
    marqueeSpeedRef.current = -1.0;
    scrollVelocityRef.current = 0;
    targetSpeedRef.current = -1.0;

    let animId: number | null = null;

    const loop = () => {
      const track = marqueeTrackRef.current;
      const contentOne = marqueeContentRef.current;
      if (track && contentOne) {
        const contentWidth = contentOne.offsetWidth;

        if (contentWidth > 0) {
          const defaultSpeed = isHoveredRef.current ? -0.25 : -1.0;
          marqueeSpeedRef.current += (defaultSpeed - marqueeSpeedRef.current) * 0.08;

          // Smoothly decay wheel scroll momentum each frame for a buttery glide
          const wheelInertia = scrollVelocityRef.current;
          scrollVelocityRef.current *= 0.88;
          if (Math.abs(scrollVelocityRef.current) < 0.01) {
            scrollVelocityRef.current = 0;
          }

          marqueePosRef.current += marqueeSpeedRef.current - wheelInertia;

          if (marqueePosRef.current <= -contentWidth) {
            marqueePosRef.current += contentWidth;
          } else if (marqueePosRef.current > 0) {
            marqueePosRef.current -= contentWidth;
          }

          track.style.transform = `translate3d(${marqueePosRef.current}px, 0, 0)`;
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [expandedDropdown, isMarqueeLooping]);

  // Non-passive wheel event listener: intercepts all scrolling inside the sub-menu container
  // preventing page scroll (and Lenis) and smoothly panning the marquee with inertia
  useEffect(() => {
    const container = marqueeContainerRef.current;
    if (!container || !expandedDropdown || !isMarqueeLooping) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rawDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      // Add smoothly to the scroll velocity buffer
      scrollVelocityRef.current += rawDelta * 0.16;
      // Clamp maximum momentum to prevent runaway acceleration
      scrollVelocityRef.current = Math.min(Math.max(scrollVelocityRef.current, -28), 28);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [expandedDropdown, isMarqueeLooping]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.documentElement.setAttribute('data-mobile-menu-open', 'true');
      document.body.setAttribute('data-mobile-menu-open', 'true');
      (window as any).lenis?.stop();

      const nav = rightButtonsRef.current;
      const backdrop = mobileMenuBackdropRef.current;
      const collapsedContent = rightButtonsCollapsedRef.current;
      const expandedContent = rightButtonsExpandedRef.current;
      const header = mobileMenuHeaderRef.current;
      const navMenu = mobileNavMenuRef.current;

      if (!nav) return;

      isMenuAnimatingRef.current = true;
      const savedRect = collapsedPillRectRef.current || {
        top: 14,
        left: window.innerWidth - 100,
        width: 86,
        height: 44,
      };
      const navChildren = navMenu ? Array.from(navMenu.children) : [];

      gsap.killTweensOf([backdrop, nav, collapsedContent, expandedContent, header, ...navChildren]);

      // Initial state: fix rightButtons at its natural top-right pill geometry using exact left and top coordinates
      gsap.set(nav, {
        position: 'fixed',
        top: savedRect.top,
        left: savedRect.left,
        right: 'auto',
        bottom: 'auto',
        width: savedRect.width,
        height: savedRect.height,
        borderRadius: '555px',
        background: '#ffffffbf',
        zIndex: 9999,
        padding: '3px 4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        overflow: 'hidden',
        boxShadow: 'none',
      });

      if (collapsedContent) {
        gsap.set(collapsedContent, { display: 'flex', opacity: 1 });
      }
      if (expandedContent) {
        gsap.set(expandedContent, { display: 'flex', opacity: 0 });
      }
      if (header) {
        gsap.set(header, { opacity: 0, y: -8 });
      }
      if (navChildren.length > 0) {
        gsap.set(navChildren, { opacity: 0, x: -14 });
      }
      if (backdrop) {
        gsap.set(backdrop, { opacity: 0, display: 'block', pointerEvents: 'auto' });
      }

      const tl = gsap.timeline({
        defaults: { ease: 'power4.out' },
        onComplete: () => {
          isMenuAnimatingRef.current = false;
        }
      });

      // 1. Fade in backdrop blur
      if (backdrop) {
        tl.to(backdrop, {
          opacity: 1,
          duration: 0.45,
          ease: 'power2.out'
        }, 0);
      }

      // 2. Fade out collapsed buttons
      if (collapsedContent) {
        tl.to(collapsedContent, {
          opacity: 0,
          duration: 0.12,
          ease: 'power2.out',
          onComplete: () => {
            gsap.set(collapsedContent, { display: 'none' });
          }
        }, 0);
      }

      // 3. Grow rightButtons ITSELF to full screen menu card (expanding towards left & bottom)
      const targetTop = 10;
      const targetLeft = 10;
      const targetWidth = Math.max(0, window.innerWidth - 20);
      const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const targetHeight = Math.max(0, viewportHeight - 20);

      tl.to(nav, {
        top: targetTop,
        left: targetLeft,
        width: targetWidth,
        height: targetHeight,
        borderRadius: 28,
        background: '#ffffff',
        padding: 0,
        boxShadow: '0 24px 80px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.06)',
        duration: 0.52,
        ease: 'power4.out',
      }, 0);

      // 4. Reveal expanded menu content
      if (expandedContent) {
        tl.to(expandedContent, {
          opacity: 1,
          duration: 0.2,
          ease: 'power1.out',
        }, 0.08);
      }

      // 5. Reveal header icons
      if (header) {
        tl.to(header, {
          opacity: 1,
          y: 0,
          duration: 0.35,
          ease: 'power3.out'
        }, 0.12);
      }

      // 6. Stagger animate nav menu items in
      if (navChildren.length > 0) {
        tl.to(navChildren, {
          opacity: 1,
          x: 0,
          stagger: 0.035,
          duration: 0.35,
          ease: 'power3.out'
        }, 0.16);
      }
    } else {
      document.documentElement.removeAttribute('data-mobile-menu-open');
      document.body.removeAttribute('data-mobile-menu-open');
      (window as any).lenis?.start();
    }
    return () => {
      document.documentElement.removeAttribute('data-mobile-menu-open');
      document.body.removeAttribute('data-mobile-menu-open');
      (window as any).lenis?.start();
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (isDesktopCartOpen) {
      document.documentElement.setAttribute('data-desktop-cart-open', 'true');
      document.body.setAttribute('data-desktop-cart-open', 'true');
      (window as any).lenis?.stop();

      const handlePreventBackgroundScroll = (e: WheelEvent | TouchEvent) => {
        const target = e.target as HTMLElement | null;
        if (target && target.closest('[data-lenis-prevent]')) {
          return;
        }
        e.preventDefault();
      };

      const handlePreventKeyboardScroll = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.closest('[data-lenis-prevent]'))
        ) {
          return;
        }
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) {
          e.preventDefault();
        }
      };

      const initialScrollY = currentDesktopCartScrollYRef.current;
      const handleScrollLock = () => {
        if (Math.abs(window.scrollY - initialScrollY) > 1) {
          window.scrollTo({ top: initialScrollY, behavior: 'instant' });
        }
      };

      window.addEventListener('wheel', handlePreventBackgroundScroll, { passive: false });
      window.addEventListener('touchmove', handlePreventBackgroundScroll, { passive: false });
      window.addEventListener('keydown', handlePreventKeyboardScroll, { passive: false });
      window.addEventListener('scroll', handleScrollLock, { passive: true });

      const nav = rightButtonsRef.current;
      const backdrop = mobileMenuBackdropRef.current;
      const collapsedContent = rightButtonsCollapsedRef.current;
      const cartContent = desktopCartExpandedRef.current;

      if (!nav) return;

      isMenuAnimatingRef.current = true;
      const savedRect = collapsedPillRectRef.current || {
        top: 14,
        left: window.innerWidth - 100,
        width: 86,
        height: 44,
      };

      gsap.killTweensOf([backdrop, nav, collapsedContent, cartContent].filter(Boolean));

      gsap.set(nav, {
        position: 'fixed',
        top: savedRect.top,
        left: savedRect.left,
        right: 'auto',
        bottom: 'auto',
        width: savedRect.width,
        height: savedRect.height,
        borderRadius: '555px',
        background: '#ffffffbf',
        zIndex: 9999,
        padding: '3px 4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        overflow: 'hidden',
        boxShadow: 'none',
      });

      if (collapsedContent) {
        gsap.set(collapsedContent, { display: 'flex', opacity: 1 });
      }
      if (cartContent) {
        gsap.set(cartContent, { display: 'flex', opacity: 0 });
      }
      if (backdrop) {
        gsap.set(backdrop, { opacity: 0, display: 'block', pointerEvents: 'auto' });
      }

      const tl = gsap.timeline({
        defaults: { ease: 'power4.out' },
        onComplete: () => {
          isMenuAnimatingRef.current = false;
        },
      });

      if (backdrop) {
        tl.to(
          backdrop,
          {
            opacity: 1,
            duration: 0.45,
            ease: 'power2.out',
          },
          0
        );
      }

      if (collapsedContent) {
        tl.to(
          collapsedContent,
          {
            opacity: 0,
            duration: 0.12,
            ease: 'power2.out',
            onComplete: () => {
              gsap.set(collapsedContent, { display: 'none' });
            },
          },
          0
        );
      }

      const targetWidth = Math.min(400, Math.max(340, window.innerWidth - 24));
      const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const targetHeight = Math.max(0, viewportHeight - 20);
      const targetTop = 10;
      const targetLeft = Math.max(10, window.innerWidth - targetWidth - 12);

      tl.to(
        nav,
        {
          top: targetTop,
          left: targetLeft,
          width: targetWidth,
          height: targetHeight,
          borderRadius: 24,
          background: '#ffffff',
          padding: 0,
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.06)',
          duration: 0.52,
          ease: 'power4.out',
        },
        0
      );

      if (cartContent) {
        tl.to(
          cartContent,
          {
            opacity: 1,
            duration: 0.25,
            ease: 'power2.out',
          },
          0.12
        );
      }

      return () => {
        (window as any).lenis?.start();
        window.removeEventListener('wheel', handlePreventBackgroundScroll);
        window.removeEventListener('touchmove', handlePreventBackgroundScroll);
        window.removeEventListener('keydown', handlePreventKeyboardScroll);
        window.removeEventListener('scroll', handleScrollLock);
        document.documentElement.removeAttribute('data-desktop-cart-open');
        document.body.removeAttribute('data-desktop-cart-open');
      };
    } else {
      (window as any).lenis?.start();
      document.documentElement.removeAttribute('data-desktop-cart-open');
      document.body.removeAttribute('data-desktop-cart-open');
    }
  }, [isDesktopCartOpen]);

  // Listen for custom open-desktop-cart events (e.g. from Add to Cart or external triggers)
  useEffect(() => {
    const handleOpenCartEvent = () => {
      if (window.innerWidth >= 768) {
        openDesktopCart();
      }
    };
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDesktopCartOpen) closeDesktopCart();
      }
    };
    window.addEventListener('milko:open-desktop-cart', handleOpenCartEvent);
    window.addEventListener('open-desktop-cart', handleOpenCartEvent);
    window.addEventListener('keydown', handleEscapeKey);
    return () => {
      window.removeEventListener('milko:open-desktop-cart', handleOpenCartEvent);
      window.removeEventListener('open-desktop-cart', handleOpenCartEvent);
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isDesktopCartOpen]);

  useEffect(() => {
    if (isDesktopHelpOpen) {
      document.documentElement.setAttribute('data-desktop-help-open', 'true');
      document.body.setAttribute('data-desktop-help-open', 'true');
      const nav = rightButtonsRef.current;
      const backdrop = mobileMenuBackdropRef.current;
      const collapsedContent = rightButtonsCollapsedRef.current;
      const helpContent = desktopHelpExpandedRef.current;

      if (!nav) return;

      isMenuAnimatingRef.current = true;
      const savedRect = collapsedPillRectRef.current || {
        top: 14,
        left: window.innerWidth - 100,
        width: 86,
        height: 44,
      };

      gsap.killTweensOf([backdrop, nav, collapsedContent, helpContent].filter(Boolean));

      gsap.set(nav, {
        position: 'fixed',
        top: savedRect.top,
        left: savedRect.left,
        right: 'auto',
        bottom: 'auto',
        width: savedRect.width,
        height: savedRect.height,
        borderRadius: '555px',
        background: '#ffffffbf',
        zIndex: 9999,
        padding: '3px 4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        overflow: 'hidden',
        boxShadow: 'none',
      });

      if (collapsedContent) {
        gsap.set(collapsedContent, { display: 'flex', opacity: 1 });
      }
      if (helpContent) {
        gsap.set(helpContent, { display: 'flex', opacity: 0 });
      }
      if (backdrop) {
        gsap.set(backdrop, { opacity: 0, display: 'block', pointerEvents: 'auto' });
      }

      const tl = gsap.timeline({
        defaults: { ease: 'power4.out' },
        onComplete: () => {
          isMenuAnimatingRef.current = false;
        },
      });

      if (backdrop) {
        tl.to(
          backdrop,
          {
            opacity: 1,
            duration: 0.45,
            ease: 'power2.out',
          },
          0
        );
      }

      if (collapsedContent) {
        tl.to(
          collapsedContent,
          {
            opacity: 0,
            duration: 0.12,
            ease: 'power2.out',
            onComplete: () => {
              gsap.set(collapsedContent, { display: 'none' });
            },
          },
          0
        );
      }

      const targetWidth = 300;
      const targetHeight = 236;
      const targetTop = 10;
      const targetLeft = Math.max(10, window.innerWidth - targetWidth - 12);

      tl.to(
        nav,
        {
          top: targetTop,
          left: targetLeft,
          width: targetWidth,
          height: targetHeight,
          borderRadius: 24,
          background: '#ffffff',
          padding: 0,
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.06)',
          duration: 0.48,
          ease: 'power4.out',
        },
        0
      );

      if (helpContent) {
        tl.to(
          helpContent,
          {
            opacity: 1,
            duration: 0.25,
            ease: 'power2.out',
          },
          0.12
        );
      }

      const handleClickOutside = (e: MouseEvent) => {
        if (nav && !nav.contains(e.target as Node)) {
          closeDesktopHelp();
        }
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          closeDesktopHelp();
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.documentElement.removeAttribute('data-desktop-help-open');
        document.body.removeAttribute('data-desktop-help-open');
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isDesktopHelpOpen, closeDesktopHelp]);

  useEffect(() => {
    if (isDesktopSearchDrawerOpen) {
      const nav = rightButtonsRef.current;
      const collapsedContent = rightButtonsCollapsedRef.current;
      const searchContent = desktopSearchExpandedRef.current;

      if (!nav) return;

      isMenuAnimatingRef.current = true;
      const savedRect = collapsedPillRectRef.current || {
        top: 14,
        left: window.innerWidth - 100,
        width: 86,
        height: 44,
      };

      gsap.killTweensOf([nav, collapsedContent, searchContent].filter(Boolean));

      gsap.set(nav, {
        position: 'fixed',
        top: savedRect.top,
        left: savedRect.left,
        right: 'auto',
        bottom: 'auto',
        width: savedRect.width,
        height: savedRect.height,
        borderRadius: '555px',
        background: '#ffffffbf',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 9999,
        padding: '3px 4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        overflow: 'hidden',
        boxShadow: 'none',
      });

      if (collapsedContent) {
        gsap.set(collapsedContent, { display: 'flex', opacity: 1 });
      }
      if (searchContent) {
        gsap.set(searchContent, { display: 'flex', opacity: 0 });
      }

      const tl = gsap.timeline({
        defaults: { ease: 'power4.out' },
        onComplete: () => {
          isMenuAnimatingRef.current = false;
        },
      });

      if (collapsedContent) {
        tl.to(
          collapsedContent,
          {
            opacity: 0,
            duration: 0.12,
            ease: 'power2.out',
            onComplete: () => {
              gsap.set(collapsedContent, { display: 'none' });
            },
          },
          0
        );
      }

      const targetWidth = Math.min(480, Math.max(380, window.innerWidth - 24));
      const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const targetHeight = Math.max(0, viewportHeight - 20);
      const targetTop = 10;
      const targetLeft = Math.max(10, window.innerWidth - targetWidth - 12);

      tl.to(
        nav,
        {
          top: targetTop,
          left: targetLeft,
          width: targetWidth,
          height: targetHeight,
          borderRadius: 24,
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          padding: 0,
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.06)',
          duration: 0.52,
          ease: 'power4.out',
        },
        0
      );

      if (searchContent) {
        tl.to(
          searchContent,
          {
            opacity: 1,
            duration: 0.25,
            ease: 'power2.out',
          },
          0.12
        );
      }

      const handleClickOutside = (e: MouseEvent) => {
        if (nav && !nav.contains(e.target as Node)) {
          closeDesktopSearch();
        }
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          closeDesktopSearch();
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isDesktopSearchDrawerOpen, closeDesktopSearch]);

  useEffect(() => {
    if (isSearchOverlayOpen) {
      document.body.style.overflow = 'hidden';
      document.body.setAttribute('data-search-overlay-open', 'true');
    } else {
      document.body.style.overflow = '';
      document.body.removeAttribute('data-search-overlay-open');
    }
    return () => {
      document.body.style.overflow = '';
      document.body.removeAttribute('data-search-overlay-open');
    };
  }, [isSearchOverlayOpen]);


  const pinUserId = user?.id ?? null;

  // Load saved pincode for the current account (guest vs logged-in)
  useEffect(() => {
    const saved = readScopedPincode(pinUserId);
    const pin = (saved || '').trim();
    setSavedPincode(/^\d{6}$/.test(pin) ? pin : null);
  }, [pinUserId]);

  // Load serviceable pincode(s) and delivery time from admin-configured site content
  useEffect(() => {
    (async () => {
      try {
        const cfg = await contentApi.getByType('subscription_delivery');
        const meta = (cfg?.metadata || {}) as any;
        let list: Array<{ pincode: string; deliveryTime?: string }> = [];
        if (Array.isArray(meta.serviceablePincodes)) {
          list = meta.serviceablePincodes.map((el: any) =>
            typeof el === 'string'
              ? { pincode: el.trim(), deliveryTime: '1h' }
              : { pincode: (el.pincode || el).toString().trim(), deliveryTime: (el.deliveryTime || '1h').toString().trim() || '1h' }
          ).filter((x: { pincode: string }) => x.pincode.length === 6);
        } else if (typeof meta.serviceablePincode === 'string' && meta.serviceablePincode.trim()) {
          list = [{ pincode: meta.serviceablePincode.trim(), deliveryTime: '1h' }];
        }
        setServiceablePincodes(list.length > 0 ? list : null);
      } catch {
        setServiceablePincodes(null);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;

    contentApi
      .getByType('contact')
      .then((data) => {
        if (cancelled) return;
        setContactPhone(String(data?.metadata?.phone || '').trim());
      })
      .catch(() => {
        if (!cancelled) setContactPhone('');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isCallMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (callMenuRef.current && event.target instanceof Node && !callMenuRef.current.contains(event.target)) {
        setIsCallMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCallMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isCallMenuOpen]);

  const isDeliverable = (pin: string, productsList: Product[] | null = allProducts) => {
    const cleaned = (pin || '').trim();
    if (!/^\d{6}$/.test(cleaned)) return false;
    const pinNum = parseInt(cleaned, 10);
    if (!pinNum || pinNum < 110000 || pinNum > 855999) return false;

    // 1. Check admin-configured subscription delivery pincodes (serviceablePincodes)
    if (serviceablePincodes && serviceablePincodes.length > 0) {
      if (serviceablePincodes.some((entry) => entry.pincode === cleaned)) {
        return true;
      }
    }

    // 2. Check product catalog pincodes
    const productsToCheck = productsList || allProducts;
    if (productsToCheck && productsToCheck.length > 0) {
      const activeProducts = productsToCheck.filter((p) => p.isActive !== false);
      if (activeProducts.length > 0) {
        // If ANY active product is nationwide, delivery is available for valid Indian pins
        const hasNationwide = activeProducts.some((p) => Boolean(p.isNationwideDelivery));
        if (hasNationwide) return true;

        // If no active product is nationwide, check if any product explicitly supports this pincode
        const matchesProduct = activeProducts.some((p) => {
          const configs = p.deliveryPincodeConfigs || [];
          const pincodes = p.deliveryPincodes || [];
          return (
            configs.some((c) => String(c.pincode || '').trim() === cleaned) ||
            pincodes.some((x) => String(x || '').trim() === cleaned)
          );
        });

        return matchesProduct;
      }
    }

    return false;
  };

  const parseEtaMinutes = (value: string): number => {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return Number.POSITIVE_INFINITY;
    const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(min|mins|minute|minutes|hr|hrs|hour|hours|day|days|week|weeks)\b/);
    const singleMatch = text.match(/(\d+(?:\.\d+)?)\s*(min|mins|minute|minutes|hr|hrs|hour|hours|day|days|week|weeks)\b/);
    const unitToMinutes = (n: number, unitRaw: string) => {
      const unit = unitRaw.toLowerCase();
      if (unit.startsWith('min')) return n;
      if (unit.startsWith('hr') || unit.startsWith('hour')) return n * 60;
      if (unit.startsWith('day')) return n * 24 * 60;
      if (unit.startsWith('week')) return n * 7 * 24 * 60;
      return Number.POSITIVE_INFINITY;
    };
    if (rangeMatch) {
      const lo = parseFloat(rangeMatch[1]);
      const hi = parseFloat(rangeMatch[2]);
      const unit = rangeMatch[3];
      if (Number.isFinite(lo) && Number.isFinite(hi)) {
        return unitToMinutes((lo + hi) / 2, unit);
      }
    }
    if (singleMatch) {
      const n = parseFloat(singleMatch[1]);
      const unit = singleMatch[2];
      if (Number.isFinite(n)) {
        return unitToMinutes(n, unit);
      }
    }
    return Number.POSITIVE_INFINITY;
  };

  const getDeliveryTimeFor = (pin: string): string => {
    const cleaned = (pin || '').trim();
    const matchedTexts = (allProducts || [])
      .flatMap((p) => (p.deliveryPincodeConfigs || [])
        .filter((cfg) => cfg.pincode === cleaned && (cfg.deliveryTimeText || '').trim())
        .map((cfg) => String(cfg.deliveryTimeText || '').trim()))
      .filter((text) => text.length > 0);
    if (matchedTexts.length > 0) {
      const chosen = [...matchedTexts].sort((a, b) => {
        const byEta = parseEtaMinutes(a) - parseEtaMinutes(b);
        if (byEta !== 0) return byEta;
        return a.localeCompare(b);
      })[0];
      if (chosen) return chosen;
    }
    return '3-5 Days Delivery';
  };

  const formatDeliveryTimeDisplay = (t: string): string => {
    const s = (t || '1h').trim();
    if (/^\d+h$/.test(s)) return s.replace(/h$/, 'hr'); // 1h->1hr, 2h->2hr
    return s;
  };

  const contactPhoneDigits = contactPhone.replace(/\D/g, '');
  const hasContactPhone = contactPhoneDigits.length > 0;
  const telHref = hasContactPhone ? `tel:${contactPhone}` : '#';
  const whatsappHref = hasContactPhone ? `https://wa.me/${contactPhoneDigits}` : '#';
  const contactPhoneLabel = contactPhone || 'Not available';

  // If we have a saved pincode, compute saved status based on live Delhivery serviceability
  useEffect(() => {
    if (!savedPincode || savedPincode.length !== 6) {
      setSavedDeliveryStatus(null);
      return;
    }
    const pinNum = parseInt(savedPincode, 10);
    if (!pinNum || pinNum < 110000 || pinNum > 855999) {
      setSavedDeliveryStatus('unavailable');
      localStorage.setItem(scopedPincodeStatusKey(pinUserId), 'unavailable');
      return;
    }
    deliveryApi
      .checkPincode(savedPincode)
      .then((res) => {
        const status = res.deliverable ? 'available' : 'unavailable';
        setSavedDeliveryStatus(status);
        localStorage.setItem(scopedPincodeStatusKey(pinUserId), status);
      })
      .catch(() => {
        const ok = isDeliverable(savedPincode);
        setSavedDeliveryStatus(ok ? 'available' : 'unavailable');
        localStorage.setItem(scopedPincodeStatusKey(pinUserId), ok ? 'available' : 'unavailable');
      });
  }, [savedPincode, serviceablePincodes, allProducts, pinUserId]);

  // Focus first pincode input when modal opens & ensure boxes are blank for fresh entry
  useEffect(() => {
    if (isAddressModalOpen) {
      setPincode(['', '', '', '', '', '']);
      setDeliveryStatus(null);
      setPincodeDetails(null);
      setTimeout(() => {
        pincodeInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isAddressModalOpen]);

  // Allow other pages/components to open the header pincode modal
  useEffect(() => {
    const onOpen = () => setIsAddressModalOpen(true);
    window.addEventListener('milko:open-pincode-modal', onOpen as EventListener);
    return () => window.removeEventListener('milko:open-pincode-modal', onOpen as EventListener);
  }, []);

  // Check pincode delivery availability (via Delhivery)
  const checkPincodeDelivery = async (pinToCheck?: string) => {
    const fullPincode = pinToCheck || pincode.join('');
    if (fullPincode.length !== 6) return;

    const pinNum = parseInt(fullPincode, 10);
    if (!pinNum || pinNum < 110000 || pinNum > 855999) {
      setPincodeDetails({
        success: true,
        deliverable: false,
        pincode: fullPincode,
        locationLabel: fullPincode,
        message: `Pincode ${fullPincode} is not serviceable for delivery`
      });
      setDeliveryStatus('unavailable');
      return;
    }

    setDeliveryStatus('checking');

    try {
      const res = await deliveryApi.checkPincode(fullPincode);
      setPincodeDetails(res);
      setDeliveryStatus(res.deliverable ? 'available' : 'unavailable');
    } catch (err) {
      console.warn('Delhivery check fallback in header:', err);
      setPincodeDetails({
        success: true,
        deliverable: false,
        pincode: fullPincode,
        locationLabel: fullPincode,
        message: `Pincode ${fullPincode} is not serviceable for delivery`
      });
      setDeliveryStatus('unavailable');
    }
  };

  // Handle final done action
  const handleDone = () => {
    const fullPincode = pincode.join('');
    if (deliveryStatus === 'available') {
      // Save pincode and status to localStorage and state
      writeScopedPincode(pinUserId, fullPincode, 'available');
      setSavedPincode(fullPincode);
      setSavedDeliveryStatus('available');
      window.dispatchEvent(
        new CustomEvent('milko:pincode-updated', {
          detail: { pincode: fullPincode, status: 'available' },
        })
      );
      setIsAddressModalOpen(false);
    } else if (deliveryStatus === 'unavailable') {
      // Save unavailable status
      writeScopedPincode(pinUserId, fullPincode, 'unavailable');
      setSavedPincode(fullPincode);
      setSavedDeliveryStatus('unavailable');
      window.dispatchEvent(
        new CustomEvent('milko:pincode-updated', {
          detail: { pincode: fullPincode, status: 'unavailable' },
        })
      );
      // Close the modal when pincode is unavailable
      setIsAddressModalOpen(false);
    }
  };
  const headerRef = useRef<HTMLElement | null>(null);
  const cartButtonMobileRef = useRef<HTMLElement | null>(null);
  const cartButtonDesktopRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isScrolled, setIsScrolled] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.scrollY > 10;
    }
    return false;
  });
  const hasScrolledToMembershipRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const check = () => {
      if (typeof window === 'undefined') return;
      const width = window.innerWidth;
      setIsMobile(width <= 767);
      setIsTablet(width >= 768 && width <= 1023);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const showDesktopNav = !isMobile && !isTablet;
  const showNavMenuOverlay = isMobile || isTablet;

  // Store cart icon refs for animation
  useEffect(() => {
    const updateRefs = () => {
      cartIconRefStore.setMobile(cartButtonMobileRef.current);
      cartIconRefStore.setDesktop(cartButtonDesktopRef.current);
    };

    updateRefs();
    const t1 = setTimeout(updateRefs, 50);
    const t2 = setTimeout(updateRefs, 200);
    const t3 = setTimeout(updateRefs, 600);
    window.addEventListener('resize', updateRefs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', updateRefs);
    };
  }, [itemCount, showDesktopNav]);

  // Check if we're on an auth page or admin page
  const isAuthPage = pathname?.startsWith('/auth');
  const isAdminPage = pathname?.startsWith('/admin');

  // Pincode modal auto-open disabled (closed by default)
  useEffect(() => {
    setIsAddressModalOpen(false);
  }, [pathname, pinUserId, loading]);

  // Simulate initial loading (show shimmer for first load)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      requestAnimationFrame(() => {
        if (headerRef.current) {
          setHeaderHeight(headerRef.current.getBoundingClientRect().height);
        }
      });
    }, 800); // Show shimmer for 800ms on initial load

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const measure = () => {
      if (headerRef.current) {
        // On mobile, when scrolled, only measure searchRow height
        if (window.innerWidth <= 767 && isScrolled) {
          const searchRow = headerRef.current.querySelector(`.${styles.searchRow}`);
          if (searchRow) {
            setHeaderHeight(searchRow.getBoundingClientRect().height + 0.5); // Add padding
          }
        } else {
          const measured = headerRef.current.getBoundingClientRect().height;
          if (isLoading) {
            const defaultH = window.innerWidth <= 767 ? 88 : 70;
            setHeaderHeight(Math.max(measured, defaultH));
          } else {
            setHeaderHeight(measured);
          }
        }
      }
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isScrolled, isLoading]);

  // Scroll detection for mobile header behavior
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          setIsScrolled(scrollY > 10); // Small threshold to prevent flickering
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Focus overlay search input when mobile search overlay opens; lock body scroll
  useEffect(() => {
    if (isSearchOverlayOpen) {
      if (searchOverlayCloseTimeoutRef.current) {
        clearTimeout(searchOverlayCloseTimeoutRef.current);
        searchOverlayCloseTimeoutRef.current = null;
      }
      setIsSearchOverlayClosing(false);
      setTimeout(() => searchOverlayInputRef.current?.focus(), 50);
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        // Don't restore if another overlay (e.g. ProductDetailsModal) has taken over body
        if (document.body.style.position === 'fixed') return;
        document.body.style.overflow = prev;
      };
    }
  }, [isSearchOverlayOpen]);

  // Focus desktop search input when overlay opens; lock body scroll
  useEffect(() => {
    if (isDesktopSearchOpen) {
      setTimeout(() => desktopSearchInputRef.current?.focus(), 50);
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isDesktopSearchOpen]);

  // Clear close timeout on unmount
  useEffect(() => {
    return () => {
      if (searchOverlayCloseTimeoutRef.current) clearTimeout(searchOverlayCloseTimeoutRef.current);
    };
  }, []);

  // Desktop: close search dropdown when clicking outside (left click)
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // only left button
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // If we land on /#membership (e.g., from another route), scroll after the page renders.
  // Only scroll once when the hash is first detected, not on every render or scroll.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const scrollToMembership = () => {
      const el = document.getElementById('membership');
      if (!el) return false;
      const y = el.getBoundingClientRect().top + window.scrollY - headerHeight - 8;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      return true;
    };

    if (window.location.hash !== '#membership') {
      // Reset the ref when hash changes away from membership
      hasScrolledToMembershipRef.current = false;
      return;
    }

    // If we've already scrolled to membership in this session, don't scroll again
    // This prevents the glitch where scrolling back up triggers another scroll
    if (hasScrolledToMembershipRef.current) return;

    let cancelled = false;
    const tryScroll = (attempt: number) => {
      if (cancelled) return;
      if (scrollToMembership()) {
        hasScrolledToMembershipRef.current = true;
        return;
      }
      if (attempt >= 20) return;
      window.setTimeout(() => tryScroll(attempt + 1), 100);
    };

    // Let Next render the page first.
    window.setTimeout(() => tryScroll(0), 0);
    return () => {
      cancelled = true;
    };
  }, [pathname, headerHeight]);

  const scrollToMembership = () => {
    const el = document.getElementById('membership');
    if (!el) return false;
    const y = el.getBoundingClientRect().top + window.scrollY - headerHeight - 8;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    return true;
  };

  const ensureProducts = () => {
    if (allProducts === null && !isSearchProductsLoading) {
      setIsSearchProductsLoading(true);
      productsApi.getAll().then((p) => {
        setAllProducts(p);
        setIsSearchProductsLoading(false);
      }).catch(() => setIsSearchProductsLoading(false));
    }
  };

  useEffect(() => {
    if ((items || []).length === 0) return;
    ensureProducts();
  }, [items, allProducts, isSearchProductsLoading]);

  useEffect(() => {
    if (!savedPincode && !isAddressModalOpen) return;
    ensureProducts();
  }, [savedPincode, isAddressModalOpen, allProducts, isSearchProductsLoading]);

  const searchResults = useMemo(() => {
    if (!allProducts || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return allProducts.filter((p) => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
  }, [allProducts, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearching(true);
      if (isMobile) {
        searchOverlayInputRef.current?.blur();
        if (searchOverlayCloseTimeoutRef.current) {
          clearTimeout(searchOverlayCloseTimeoutRef.current);
          searchOverlayCloseTimeoutRef.current = null;
        }
        setIsSearchOverlayClosing(false);
        setIsSearchOverlayOpen(false);
      } else {
        setIsSearchDropdownOpen(false);
        setIsDesktopSearchOpen(false);
        desktopSearchInputRef.current?.blur();
      }
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setTimeout(() => setIsSearching(false), 1000);
    }
  };

  const closeSearchOverlay = () => {
    if (searchOverlayCloseTimeoutRef.current) {
      clearTimeout(searchOverlayCloseTimeoutRef.current);
    }
    setIsSearchOverlayClosing(true);
    searchOverlayCloseTimeoutRef.current = setTimeout(() => {
      setIsSearchOverlayOpen(false);
      setIsSearchOverlayClosing(false);
      searchOverlayCloseTimeoutRef.current = null;
    }, 280);
  };

  // Don't render header on admin pages (AdminHeader handles that)
  // All hooks are called above, so this is safe
  if (isAdminPage) {
    return null;
  }

  return (
    <>
      <header
        ref={headerRef}
        className={[
          isAuthPage ? `${styles.header} ${styles.headerTransparent}` : `${styles.header} ${isScrolled ? styles.headerScrolled : ''}`,
          !isAuthPage && !isMobile && styles.headerScrimBlue,
          !isAuthPage && isMobile && savedPincode && savedDeliveryStatus === 'available' && styles.headerMobileBgServiceable,
          !isAuthPage && isMobile && savedPincode && savedDeliveryStatus === 'unavailable' && styles.headerMobileBgUnserviceable
        ].filter(Boolean).join(' ')}
        style={{ '--header-height': `${headerHeight}px` } as React.CSSProperties}
      >
        {/* Backdrop blur overlay — inside header so it blurs headerRow & page below it, while rightButtons (cart / help) expands above it */}
        <div
          ref={mobileMenuBackdropRef}
          className={`${styles.mobileMenuBackdrop} ${isMobileMenuOpen || isDesktopCartOpen || isDesktopHelpOpen ? styles.mobileMenuBackdropOpen : ''}`}
          onClick={() => {
            if (isDesktopCartOpen) closeDesktopCart();
            else if (isDesktopHelpOpen) closeDesktopHelp();
            else if (isMobileMenuOpen) closeMobileMenu();
          }}
        />

        <NavigationProgressBar />

        {/* First Row: Logo and Icons */}
        <div className={`${styles.headerRow} ${isScrolled ? styles.headerRowScrolled : ''}`}>
          {isLoading ? (
            <>
              {/* Column 1 (Left): Logo Skeleton */}
              <div className={styles.logoContainer}>
                <div className={`${styles.logoShimmer} ${styles.shimmer}`}></div>
              </div>

              {/* Column 2 (Right): 2 Icon Skeletons on Mobile, 3 on Desktop */}
              <div className={styles.rightButtonsShimmer}>
                <div className={`${styles.buttonShimmer} ${styles.shimmer}`}></div>
                <div className={`${styles.buttonShimmer} ${styles.shimmer}`}></div>
                <div className={`${styles.buttonShimmer} ${styles.shimmer} ${styles.desktopOnlyShimmer}`}></div>
              </div>
            </>
          ) : (
            <>
              {/* Container for Back Button and Logo/DeliveryAtLogo (at very left on mobile) */}
              <div className={styles.logoContainer}>
                <Link
                  href="/"
                  className={`${styles.logo} ${pathname === '/' ? styles.logoOnHomepage : ''}`}
                >
                  <Logo textClassName={styles.logoText} imageClassName={styles.logoImg} />
                </Link>
              </div>

              {/* Desktop Navigation Menu with Smooth GSAP Expand & In-Pill Marquee */}
              {showDesktopNav && !isAuthPage && (
                <div className={styles.navMenuAnchor}>
                  {/* Invisible Natural Sizer ensuring navMenuAnchor has the exact natural width & height */}
                  <div className={styles.navMenuSizer} aria-hidden="true">
                    <span className={styles.navLink}>Collections</span>
                  </div>

                  <nav
                    ref={navMenuRef}
                    className={`${styles.navMenu} ${expandedDropdown ? styles.navMenuExpanded : ''}`}
                  >
                    <div ref={navLinksRowRef} className={styles.navLinksRow}>
                      <Link
                        href="/products"
                        className={`${styles.navLink} ${isHeaderNavActive(pathname, '/products') ? styles.navLinkActive : ''}`}
                        onClick={() => setExpandedDropdown(null)}
                      >
                        Collections
                      </Link>
                    </div>

                    {/* In-Pill Infinite Marquee Sub-Menu Section */}
                    <div
                      ref={expandedSectionRef}
                      className={`${styles.expandedMarqueeSection} ${!isMarqueeLooping ? styles.expandedMarqueeSectionCentered : ''}`}
                      style={{ display: 'none' }}
                    >
                      <div className={styles.expandedMarqueeDivider} />
                      <div
                        ref={marqueeContainerRef}
                        className={`${styles.expandedMarqueeContainer} ${!isMarqueeLooping ? styles.expandedMarqueeContainerCentered : ''}`}
                        data-lenis-prevent
                        onMouseEnter={() => { isHoveredRef.current = true; }}
                        onMouseLeave={() => {
                          isHoveredRef.current = false;
                          isDraggingRef.current = false;
                        }}
                        onPointerDown={(e) => {
                          if (!isMarqueeLooping) return;
                          isDraggingRef.current = true;
                          dragStartXRef.current = e.clientX;
                          dragStartPosRef.current = marqueePosRef.current;
                          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                        }}
                        onPointerMove={(e) => {
                          if (!isDraggingRef.current || !isMarqueeLooping) return;
                          const diff = e.clientX - dragStartXRef.current;
                          marqueePosRef.current = dragStartPosRef.current + diff;
                        }}
                        onPointerUp={(e) => {
                          if (!isMarqueeLooping) return;
                          isDraggingRef.current = false;
                          try {
                            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                          } catch { }
                        }}
                        onPointerCancel={() => {
                          isDraggingRef.current = false;
                        }}
                      >
                        <div
                          ref={marqueeTrackRef}
                          className={`${styles.expandedMarqueeTrack} ${!isMarqueeLooping ? styles.expandedMarqueeTrackCentered : ''}`}
                        >
                          {(isMarqueeLooping ? [0, 1, 2, 3] : [0]).map((cloneIdx) => (
                            <div
                              key={cloneIdx}
                              ref={cloneIdx === 0 ? marqueeContentRef : undefined}
                              className={styles.expandedMarqueeContent}
                              aria-hidden={cloneIdx > 0 ? true : undefined}
                            >
                              {currentDropdownItems.map((item, idx) => (
                                <span key={`${cloneIdx}-${item.label}-${idx}`} className={styles.marqueeItemWrapper}>
                                  <Link
                                    href={item.href}
                                    className={`${styles.marqueeItemLink} ${isHeaderNavActive(pathname, item.href) ? styles.marqueeItemLinkActive : ''}`}
                                    onClick={() => setExpandedDropdown(null)}
                                  >
                                    {item.label}
                                  </Link>
                                  {(isMarqueeLooping || idx < currentDropdownItems.length - 1) && (
                                    <span className={styles.marqueeItemDot}>•</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                      {isMarqueeLooping && (
                        <div className={styles.marqueeScrollHint}>
                          <svg className={styles.marqueeScrollMouseIcon} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="5" y="2" width="14" height="20" rx="7" />
                            <line x1="12" y1="6" x2="12" y2="10" />
                          </svg>
                          <span className={styles.marqueeScrollHintText}>Scroll</span>
                        </div>
                      )}
                    </div>
                  </nav>
                </div>
              )}

              {/* Right Side Icons / Expanding Menu - Hide on auth pages */}
              {!isAuthPage && (
                <div className={styles.rightButtonsSlot}>
                  <div
                    ref={rightButtonsRef}
                    className={`${styles.rightButtons} ${isMobileMenuOpen ? styles.rightButtonsExpanded : ''}`}
                  >
                    {/* Collapsed Mode Icons */}
                    <div
                      ref={rightButtonsCollapsedRef}
                      className={styles.rightButtonsCollapsed}
                    >
                      {/* Desktop Search Button */}
                      <button
                        type="button"
                        className={styles.searchButton}
                        onClick={(e) => {
                          e.preventDefault();
                          openDesktopSearch();
                        }}
                        aria-label="Search"
                      >
                        <svg className={`${styles.buttonIcon} ${styles.searchButtonIcon}`} viewBox="0 -0.5 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                          <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                          <g id="SVGRepo_iconCarrier">
                            <path fillRule="evenodd" clipRule="evenodd" d="M5.5 11.1455C5.49956 8.21437 7.56975 5.69108 10.4445 5.11883C13.3193 4.54659 16.198 6.08477 17.32 8.79267C18.4421 11.5006 17.495 14.624 15.058 16.2528C12.621 17.8815 9.37287 17.562 7.3 15.4895C6.14763 14.3376 5.50014 12.775 5.5 11.1455Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                            <path d="M15.989 15.4905L19.5 19.0015" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                          </g>
                        </svg>
                        <span className={styles.buttonText}>Search</span>
                      </button>

                      {/* Desktop WhatsApp / Help Button (left of account) */}
                      <button
                        type="button"
                        className={styles.helpButton}
                        aria-label="Help"
                        title="Need help?"
                        onClick={(e) => {
                          e.preventDefault();
                          openDesktopHelp();
                        }}
                      >
                        <WhatsAppIcon className={styles.helpButtonIcon} />
                      </button>

                      {/* Desktop Login/User Button */}
                      {isAuthenticated ? (
                        <UserDropdown user={user} logout={logout} isAdmin={isAdmin} />
                      ) : (
                        <Link
                          href="/auth/login"
                          className={styles.loginButton}
                          aria-label="Login"
                        >
                          <svg className={styles.buttonIcon} viewBox="0 0 24.00 24.00" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="0.00024000000000000003">
                            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                            <g id="SVGRepo_iconCarrier">
                              <path fillRule="evenodd" clipRule="evenodd" d="M8.25 9C8.25 6.92893 9.92893 5.25 12 5.25C14.0711 5.25 15.75 6.92893 15.75 9C15.75 11.0711 14.0711 12.75 12 12.75C9.92893 12.75 8.25 11.0711 8.25 9ZM12 6.75C10.7574 6.75 9.75 7.75736 9.75 9C9.75 10.2426 10.7574 11.25 12 11.25C13.2426 11.25 14.25 10.2426 14.25 9C14.25 7.75736 13.2426 6.75 12 6.75Z" fill="currentColor"></path>
                              <path fillRule="evenodd" clipRule="evenodd" d="M1.25 12C1.25 6.06294 6.06294 1.25 12 1.25C17.9371 1.25 22.75 6.06294 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75C6.06294 22.75 1.25 17.9371 1.25 12ZM12 2.75C6.89137 2.75 2.75 6.89137 2.75 12C2.75 14.5456 3.77827 16.851 5.4421 18.5235C5.6225 17.5504 5.97694 16.6329 6.68837 15.8951C7.75252 14.7915 9.45416 14.25 12 14.25C14.5457 14.25 16.2474 14.7915 17.3115 15.8951C18.023 16.6329 18.3774 17.5505 18.5578 18.5236C20.2217 16.8511 21.25 14.5456 21.25 12C21.25 6.89137 17.1086 2.75 12 2.75ZM17.1937 19.6554C17.0918 18.4435 16.8286 17.5553 16.2318 16.9363C15.5823 16.2628 14.3789 15.75 12 15.75C9.62099 15.75 8.41761 16.2628 7.76815 16.9363C7.17127 17.5553 6.90811 18.4434 6.80622 19.6553C8.28684 20.6618 10.0747 21.25 12 21.25C13.9252 21.25 15.7131 20.6618 17.1937 19.6554Z" fill="currentColor"></path>
                            </g>
                          </svg>
                          <span className={styles.buttonText}>Login</span>
                        </Link>
                      )}

                      {/* Mobile & Tablet Menu Button */}
                      {(isMobile || isTablet) && (
                        <button
                          type="button"
                          className={`${styles.iconButton} ${styles.mobileMenuButton}`}
                          aria-label="Menu"
                          onClick={openMobileMenu}
                        >
                          <svg viewBox="0 0 24 24" fill="none" className={styles.buttonIcon} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M4 17H20M4 12H20M4 7H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}

                      {/* Cart Button - Icon Only on Mobile */}
                      <Link
                        href="/cart"
                        className={`${styles.iconButton} ${styles.mobileCartButton}`}
                        aria-label="Cart"
                        data-cart-target="mobile"
                      >
                        <div ref={cartButtonMobileRef as any} className={styles.cartIconWrapper} data-cart-icon-wrapper="true">
                          <svg className={`${styles.buttonIcon} ${styles.cartIcon}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                            <g id="SVGRepo_iconCarrier">
                              <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11M8 8H16C19 8 20 11.8899 20 13.5C20 19.5259 18.3966 20.5 12 20.5C5.60338 20.5 4 19.5259 4 13.5C4 11.8899 5 8 8 8Z" stroke="currentColor" strokeWidth="1.488" strokeLinecap="round" strokeLinejoin="round"></path>
                            </g>
                          </svg>
                          {itemCount > 0 && (
                            <span className={styles.cartBadge}>{itemCount}</span>
                          )}
                        </div>
                        <span className={styles.iconButtonText}>Cart</span>
                      </Link>

                      {/* Desktop Cart Button */}
                      <button
                        type="button"
                        className={styles.cartButton}
                        aria-label="Cart"
                        data-cart-target="desktop"
                        onClick={(e) => {
                          e.preventDefault();
                          openDesktopCart();
                        }}
                      >
                        <div ref={cartButtonDesktopRef as any} className={styles.cartIconWrapper} data-cart-icon-wrapper="true">
                          <svg className={`${styles.buttonIcon} ${styles.cartIcon}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                            <g id="SVGRepo_iconCarrier">
                              <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11M8 8H16C19 8 20 11.8899 20 13.5C20 19.5259 18.3966 20.5 12 20.5C5.60338 20.5 4 19.5259 4 13.5C4 11.8899 5 8 8 8Z" stroke="currentColor" strokeWidth="1.488" strokeLinecap="round" strokeLinejoin="round"></path>
                            </g>
                          </svg>
                          {itemCount > 0 && (
                            <span className={styles.cartBadge}>{itemCount}</span>
                          )}
                        </div>
                        <span className={styles.buttonText}>Cart</span>
                      </button>
                    </div>

                    {/* Expanded Desktop Help Content directly inside .rightButtons */}
                    {isDesktopHelpOpen && (
                      <div
                        ref={desktopHelpExpandedRef}
                        className={styles.desktopHelpExpandedInner}
                        style={{ display: isDesktopHelpOpen ? 'flex' : 'none', width: '100%' }}
                      >
                        <div className={styles.desktopHelpHeader}>
                          <span className={styles.desktopHelpTitle}>Need help?</span>
                          <button
                            type="button"
                            className={styles.desktopHelpCloseBtn}
                            onClick={closeDesktopHelp}
                            aria-label="Close help"
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        <ul className={styles.desktopHelpList}>
                          <li>
                            <a
                              href={formatWhatsAppLink(whatsappNumber)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.desktopHelpLink}
                              onClick={closeDesktopHelp}
                            >
                              <WhatsAppIcon className={styles.desktopHelpItemIcon} />
                              <span>WhatsApp</span>
                            </a>
                          </li>
                          <li>
                            <Link
                              href="/contact"
                              className={styles.desktopHelpLink}
                              onClick={closeDesktopHelp}
                            >
                              <PhoneIcon className={styles.desktopHelpItemIcon} />
                              <span>Contact</span>
                            </Link>
                          </li>
                          <li>
                            <button
                              type="button"
                              className={styles.desktopHelpLink}
                              onClick={() => {
                                closeDesktopHelp();
                                setReviewOpen(true);
                              }}
                            >
                              <StarIcon className={styles.desktopHelpItemIcon} />
                              <span>Review us</span>
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              className={styles.desktopHelpLink}
                              onClick={() => {
                                closeDesktopHelp();
                                setFeedbackOpen(true);
                              }}
                            >
                              <FeedbackIcon className={styles.desktopHelpItemIcon} />
                              <span>Feedback</span>
                            </button>
                          </li>
                        </ul>
                      </div>
                    )}

                    {/* Expanded Desktop Cart & Checkout Content directly inside .rightButtons */}
                    {isDesktopCartOpen && (
                      <div
                        ref={desktopCartExpandedRef}
                        className={styles.rightButtonsExpandedInner}
                        style={{ display: isDesktopCartOpen ? 'flex' : 'none', height: '100%', width: '100%' }}
                      >
                        <DesktopCartDrawer onClose={closeDesktopCart} />
                      </div>
                    )}

                    {/* Expanded Desktop Search Content directly inside .rightButtons */}
                    {isDesktopSearchDrawerOpen && (
                      <div
                        ref={desktopSearchExpandedRef}
                        className={styles.rightButtonsExpandedInner}
                        style={{ display: isDesktopSearchDrawerOpen ? 'flex' : 'none', height: '100%', width: '100%' }}
                      >
                        <DesktopSearchDrawer
                          onClose={closeDesktopSearch}
                          allProducts={allProducts}
                          isSearchProductsLoading={isSearchProductsLoading}
                          categoryMap={categoryMap}
                        />
                      </div>
                    )}

                    {/* Expanded Mobile Menu Content directly inside .rightButtons */}
                    {showNavMenuOverlay && (
                      <div
                        ref={rightButtonsExpandedRef}
                        className={styles.rightButtonsExpandedInner}
                        style={{ display: isMobileMenuOpen ? 'flex' : 'none' }}
                      >
                        <div ref={mobileMenuHeaderRef} className={styles.mobileMenuHeader}>
                          <div className={styles.mobileMenuHeaderLeft}>
                            {/* Account Icon */}
                            {isAuthenticated ? (
                              <UserDropdown
                                user={user}
                                logout={logout}
                                isAdmin={isAdmin}
                                isMobile={true}
                                className={styles.mobileMenuHeaderButton}
                                onClose={closeMobileMenu}
                              />
                            ) : (
                              <Link
                                href="/auth/login"
                                className={`${styles.iconButton} ${styles.mobileMenuHeaderButton}`}
                                aria-label="Login"
                                onClick={closeMobileMenu}
                              >
                                <svg className={styles.buttonIcon} viewBox="0 0 24.00 24.00" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="0.00024">
                                  <path fillRule="evenodd" clipRule="evenodd" d="M8.25 9C8.25 6.92893 9.92893 5.25 12 5.25C14.0711 5.25 15.75 6.92893 15.75 9C15.75 11.0711 14.0711 12.75 12 12.75C9.92893 12.75 8.25 11.0711 8.25 9ZM12 6.75C10.7574 6.75 9.75 7.75736 9.75 9C9.75 10.2426 10.7574 11.25 12 11.25C13.2426 11.25 14.25 10.2426 14.25 9C14.25 7.75736 13.2426 6.75 12 6.75Z" fill="currentColor"></path>
                                  <path fillRule="evenodd" clipRule="evenodd" d="M1.25 12C1.25 6.06294 6.06294 1.25 12 1.25C17.9371 1.25 22.75 6.06294 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75C6.06294 22.75 1.25 17.9371 1.25 12ZM12 2.75C6.89137 2.75 2.75 6.89137 2.75 12C2.75 14.5456 3.77827 16.851 5.4421 18.5235C5.6225 17.5504 5.97694 16.6329 6.68837 15.8951C7.75252 14.7915 9.45416 14.25 12 14.25C14.5457 14.25 16.2474 14.7915 17.3115 15.8951C18.023 16.6329 18.3774 17.5505 18.5578 18.5236C20.2217 16.8511 21.25 14.5456 21.25 12C21.25 6.89137 17.1086 2.75 12 2.75ZM17.1937 19.6554C17.0918 18.4435 16.8286 17.5553 16.2318 16.9363C15.5823 16.2628 14.3789 15.75 12 15.75C9.62099 15.75 8.41761 16.2628 7.76815 16.9363C7.17127 17.5553 6.90811 18.4434 6.80622 19.6553C8.28684 20.6618 10.0747 21.25 12 21.25C13.9252 21.25 15.7131 20.6618 17.1937 19.6554Z" fill="currentColor"></path>
                                </svg>
                              </Link>
                            )}

                            {/* Search Icon */}
                            <button
                              type="button"
                              className={`${styles.iconButton} ${styles.mobileMenuHeaderButton}`}
                              aria-label="Search"
                              onClick={() => {
                                ensureProducts();
                                setIsSearchOverlayOpen(true);
                                closeMobileMenu();
                              }}
                            >
                              <svg viewBox="0 -0.5 25 25" fill="none" className={styles.buttonIcon} xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" clipRule="evenodd" d="M5.5 11.1455C5.49956 8.21437 7.56975 5.69108 10.4445 5.11883C13.3193 4.54659 16.198 6.08477 17.32 8.79267C18.4421 11.5006 17.495 14.624 15.058 16.2528C12.621 17.8815 9.37287 17.562 7.3 15.4895C6.14763 14.3376 5.50014 12.775 5.5 11.1455Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                                <path d="M15.989 15.4905L19.5 19.0015" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                              </svg>
                            </button>
                          </div>

                          {/* Close Button */}
                          <button
                            type="button"
                            className={styles.mobileMenuCloseBtn}
                            onClick={closeMobileMenu}
                            aria-label="Close menu"
                          >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        {/* Top Linear Gradient Scroll Fade (Transparent to White) */}
                        <div
                          className={`${styles.mobileNavFadeTop} ${canScrollTop ? styles.mobileNavFadeTopActive : ''}`}
                          aria-hidden="true"
                        />

                        <nav
                          ref={mobileNavMenuRef}
                          className={styles.mobileNavMenu}
                          onScroll={updateScrollFades}
                          data-lenis-prevent
                        >
                          <Link
                            href="/products"
                            className={`${styles.mobileNavLink} ${isHeaderNavActive(pathname, '/products') ? styles.mobileNavLinkActive : ''}`}
                            onClick={closeMobileMenu}
                          >
                            Collections
                          </Link>

                          <Link
                            href="/returns"
                            className={`${styles.mobileNavLink} ${isHeaderNavActive(pathname, '/returns') ? styles.mobileNavLinkActive : ''}`}
                            onClick={closeMobileMenu}
                          >
                            Returns &amp; Exchanges
                          </Link>


                          {/* Help Submenu in Mobile Drawer */}
                          <div className={styles.mobileOthersDropdown} style={{ width: '100%' }}>
                            <button
                              type="button"
                              className={styles.mobileNavLink}
                              onClick={() => setIsMobileHelpOpen(!isMobileHelpOpen)}
                              style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: '0', textAlign: 'left', cursor: 'pointer' }}
                            >
                              <span>Help</span>
                              <svg
                                className={`${styles.dropdownArrow} ${isMobileHelpOpen ? styles.dropdownArrowOpen : ''}`}
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                style={{ width: '16px', height: '16px' }}
                              >
                                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                            {isMobileHelpOpen && (
                              <div className={styles.mobileSubMenu} style={{ paddingLeft: '1.5rem', paddingTop: '0.8rem', paddingBottom: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <a
                                  href={formatWhatsAppLink(whatsappNumber)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.mobileSubNavLink}
                                  onClick={closeMobileMenu}
                                >
                                  WhatsApp
                                </a>
                                <Link
                                  href="/contact"
                                  className={styles.mobileSubNavLink}
                                  onClick={closeMobileMenu}
                                >
                                  Contact
                                </Link>
                                <button
                                  type="button"
                                  className={styles.mobileSubNavLink}
                                  style={{ background: 'none', border: 'none', padding: '0', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                                  onClick={() => {
                                    closeMobileMenu();
                                    setReviewOpen(true);
                                  }}
                                >
                                  Review us
                                </button>
                                <button
                                  type="button"
                                  className={styles.mobileSubNavLink}
                                  style={{ background: 'none', border: 'none', padding: '0', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                                  onClick={() => {
                                    closeMobileMenu();
                                    setFeedbackOpen(true);
                                  }}
                                >
                                  Feedback
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Bottom Center Horizontal Links with 0.52rem Font Size */}
                          <nav className={styles.mobileHorizontalLinks} aria-label="Footer links">
                            <span className={styles.mobileLinkItem}>
                              <Link href="/faqs" className={styles.mobileBottomLink} onClick={closeMobileMenu}>
                                FAQs
                              </Link>
                              <span className={styles.mobileDot} aria-hidden="true">•</span>
                            </span>

                            <span className={styles.mobileLinkItem}>
                              <Link href="/stories" className={styles.mobileBottomLink} onClick={closeMobileMenu}>
                                Stories
                              </Link>
                              <span className={styles.mobileDot} aria-hidden="true">•</span>
                            </span>

                            <span className={styles.mobileLinkItem}>
                              <Link href="/contact" className={styles.mobileBottomLink} onClick={closeMobileMenu}>
                                Contact Us
                              </Link>
                              <span className={styles.mobileDot} aria-hidden="true">•</span>
                            </span>

                            <span className={styles.mobileLinkItem}>
                              <Link href="/privacy" className={styles.mobileBottomLink} onClick={closeMobileMenu}>
                                Privacy
                              </Link>
                              <span className={styles.mobileDot} aria-hidden="true">•</span>
                            </span>

                            <span className={styles.mobileLinkItem}>
                              <Link href="/terms" className={styles.mobileBottomLink} onClick={closeMobileMenu}>
                                Terms
                              </Link>
                              <span className={styles.mobileDot} aria-hidden="true">•</span>
                            </span>

                            <span className={styles.mobileLinkItem}>
                              <Link href="/dashboard" className={styles.mobileBottomLink} onClick={closeMobileMenu}>
                                My Account
                              </Link>
                              <span className={styles.mobileDot} aria-hidden="true">•</span>
                            </span>

                            <span className={styles.mobileLinkItem}>
                              <Link href="/cart" className={styles.mobileBottomLink} onClick={closeMobileMenu}>
                                Cart
                              </Link>
                              <span className={styles.mobileDot} aria-hidden="true">•</span>
                            </span>

                            <span className={styles.mobileLinkItem}>
                              <Link href="/returns" className={styles.mobileBottomLink} onClick={closeMobileMenu}>
                                Returns &amp; Exchanges
                              </Link>
                            </span>
                          </nav>
                        </nav>

                        {/* Bottom Linear Gradient Scroll Fade (Transparent to White) */}
                        <div
                          className={`${styles.mobileNavFadeBottom} ${canScrollBottom ? styles.mobileNavFadeBottomActive : ''}`}
                          aria-hidden="true"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Second Row: Search Bar removed for mobile redesign */}

        {/* Address Modal */}
        {isAddressModalOpen ? (
          <div className={styles.modalOverlay} onClick={() => setIsAddressModalOpen(false)}>
            <motion.div
              layout
              transition={{ layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }}
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className={styles.modalHeader}>
                <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className={`${styles.modalMainSvg} ${deliveryStatus === 'available' ? styles.modalMainSvgSuccess : deliveryStatus === 'unavailable' ? styles.modalMainSvgError : ''}`}>
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <path d="M205.735 290.665C155.409 242.963 94.9593 90.7124 198.78 64.9814C256.847 50.5932 289.256 117.652 275.878 166.285C264.567 207.397 234.224 242.805 215.301 280.323" stroke="currentColor" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M189.108 132.102C246.901 97.3222 240.303 180.36 200.747 170.01C189.108 166.965 186.672 160.822 186.672 150.044" stroke="currentColor" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M154.93 274.873C6.29812 328.742 232.117 357.483 281.256 319.162C318.054 290.46 277.824 274.873 249.19 274.873" stroke="currentColor" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                  </g>
                </svg>
                <h2 className={styles.modalTitle}>Enter your pincode</h2>
                <button
                  className={styles.modalCloseButton}
                  onClick={() => setIsAddressModalOpen(false)}
                  aria-label="Close"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {/* Delivery Location Text & Estimated Transit Details */}
              <div className={styles.deliveryStatusBlock}>
                <p
                  className={`${styles.deliveryLocationText} ${deliveryStatus === 'available'
                      ? styles.deliveryLocationTextSuccess
                      : deliveryStatus === 'unavailable'
                        ? styles.deliveryLocationTextError
                        : deliveryStatus === 'checking'
                          ? styles.deliveryLocationTextChecking
                          : ''
                    }`}
                >
                  {deliveryStatus === 'available'
                    ? `Delivery available to ${pincodeDetails?.locationLabel || pincode.join('')}`
                    : deliveryStatus === 'unavailable'
                      ? `Currently not deliverable to ${pincodeDetails?.locationLabel || pincode.join('')}`
                      : deliveryStatus === 'checking'
                        ? `Checking deliverability for ${pincode.join('')}...`
                        : 'Delivering to all over India'}
                </p>
                <AnimatePresence initial={false}>
                  {deliveryStatus === 'available' && (
                    <motion.div
                      key="delivery-meta"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      style={{ overflow: 'hidden', width: '100%' }}
                    >
                      <div className={styles.deliveryMetaRow} style={{ paddingTop: 4 }}>
                        <span>
                          Estimated delivery: <strong>{pincodeDetails?.deliveryTimeText || '3-5 Days'}</strong>
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Pincode Field - 6 separate boxes */}
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Pincode</label>
                <div className={styles.pincodeBoxes}>
                  {pincode.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { pincodeInputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={digit}
                      autoFocus={index === 0}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        if (value.length <= 1) {
                          const newPincode = [...pincode];
                          newPincode[index] = value;
                          setPincode(newPincode);
                          setDeliveryStatus(null);
                          setPincodeDetails(null);

                          // Auto-focus next box if value entered
                          if (value && index < 5) {
                            pincodeInputRefs.current[index + 1]?.focus();
                          }

                          const fullPin = newPincode.join('');
                          if (fullPin.length === 6) {
                            checkPincodeDelivery(fullPin);
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        // Handle backspace to go to previous box
                        if (e.key === 'Backspace' && !pincode[index] && index > 0) {
                          pincodeInputRefs.current[index - 1]?.focus();
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
                        const newPincode = [...pincode];
                        for (let i = 0; i < 6; i++) {
                          newPincode[i] = pastedData[i] || '';
                        }
                        setPincode(newPincode);
                        setDeliveryStatus(null);
                        setPincodeDetails(null);
                        const nextIndex = Math.min(pastedData.length, 5);
                        pincodeInputRefs.current[nextIndex]?.focus();
                        if (pastedData.length === 6) {
                          checkPincodeDelivery(pastedData);
                        }
                      }}
                      className={`${styles.pincodeBox} ${deliveryStatus === 'available'
                        ? styles.pincodeBoxSuccess
                        : deliveryStatus === 'unavailable'
                          ? styles.pincodeBoxError
                          : ''
                        }`}
                      maxLength={1}
                      autoComplete="off"
                    />
                  ))}
                </div>
              </div>



              {/* Check/Done Button */}
              <button
                className={`${styles.modalDoneButton} ${deliveryStatus === 'available' ? styles.modalDoneButtonSuccess :
                  deliveryStatus === 'unavailable' ? styles.modalDoneButtonError : ''
                  }`}
                onClick={() => {
                  const fullPincode = pincode.join('');
                  if (fullPincode.length !== 6) return;

                  if (deliveryStatus === null || deliveryStatus === 'checking') {
                    checkPincodeDelivery();
                  } else {
                    handleDone();
                  }
                }}
                disabled={pincode.join('').length !== 6 || deliveryStatus === 'checking'}
                style={{
                  opacity: pincode.join('').length === 6 && deliveryStatus !== 'checking' ? 1 : 0.5,
                  cursor:
                    pincode.join('').length === 6 && deliveryStatus !== 'checking' ? 'pointer' : 'not-allowed',
                }}
              >
                {deliveryStatus === 'checking' ? 'Checking...' :
                  deliveryStatus === 'available' || deliveryStatus === 'unavailable' ? 'Done' : 'Check'}
              </button>
            </motion.div>
          </div>
        ) : null}
      </header>

      {/* Mobile: full-page white search overlay when search is focused */}
      {isMobile && isSearchOverlayOpen && (
        <div
          className={`${styles.searchOverlay} ${isSearchOverlayClosing ? styles.searchOverlayClosing : ''} ${selectedProduct ? styles.searchOverlayBehindModal : ''}`}
        >
          <div className={styles.searchOverlayBar}>
            <form onSubmit={handleSearch} className={`${styles.searchForm} ${styles.searchOverlayForm}`}>
              <div className={styles.searchIcon}>
                <svg viewBox="0 -0.5 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <path fillRule="evenodd" clipRule="evenodd" d="M5.5 11.1455C5.49956 8.21437 7.56975 5.69108 10.4445 5.11883C13.3193 4.54659 16.198 6.08477 17.32 8.79267C18.4421 11.5006 17.495 14.624 15.058 16.2528C12.621 17.8815 9.37287 17.562 7.3 15.4895C6.14763 14.3376 5.50014 12.775 5.5 11.1455Z" stroke="#7d7d7d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M15.989 15.4905L19.5 19.0015" stroke="#7d7d7d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                  </g>
                </svg>
              </div>
              <input
                ref={searchOverlayInputRef}
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
                autoComplete="off"
              />
            </form>
            <button type="button" className={styles.searchOverlayClose} onClick={closeSearchOverlay} aria-label="Close search">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className={styles.searchOverlayResults} data-lenis-prevent>
            {isSearchProductsLoading ? (
              <p className={styles.searchOverlayStatus}>Loading...</p>
            ) : searchQuery.trim() ? (
              searchResults.length > 0 ? (
                <>
                  {searchResults.slice(0, 6).map((p) => {
                    const isOutOfStock = p.isActive === false || (typeof p.quantity === 'number' && p.quantity <= 0);
                    const imageUrl = getPrimaryProductImageUrl(p);
                    const categoryLabel = p.categoryId ? (categoryMap.get(p.categoryId) || 'Dairy') : 'Dairy';

                    return (
                      <div
                        key={p.id}
                        className={`${cardStyles.productCard} ${isOutOfStock ? cardStyles.productCardOutOfStock : ''}`}
                        onClick={() => {
                          closeSearchOverlay();
                          router.push(`/product/${p.id}`);
                        }}
                      >
                        <div className={cardStyles.productImage} style={imageUrl ? { aspectRatio: 'auto' } : undefined}>
                          {isOutOfStock ? (
                            <div className={cardStyles.outOfStockBadge}>Out of stock</div>
                          ) : null}
                          <ProductCardImage
                            src={imageUrl}
                            alt={p.name}
                            hoverSrc={p.hoverNextImage ? getOrderedProductImageUrls(p)[1] : undefined}
                          />
                        </div>

                        <div className={cardStyles.productInfo}>
                          <div className={cardStyles.productTitleRow}>
                            <h3 className={cardStyles.productName}>{p.name}</h3>
                            <span className={cardStyles.productPrice}>{getCardPriceDisplay(p, '₹')}</span>
                          </div>

                          <div className={cardStyles.productCategoryRow}>
                            <div className={cardStyles.productCategory}>
                              {categoryLabel}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {searchResults.length > 6 && (
                    <button
                      key="show-more-mobile"
                      type="button"
                      className={styles.searchShowMore}
                      onClick={() => {
                        closeSearchOverlay();
                        router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                      }}
                      style={{ width: '100%' }}
                    >
                      Show all {searchResults.length} results
                    </button>
                  )}
                </>
              ) : (
                <p className={styles.searchOverlayStatus}>No products match</p>
              )
            ) : (
              <p className={styles.searchOverlayStatus}>Type to search products</p>
            )}
          </div>
        </div>
      )}

      {/* Spacer so content doesn't go under fixed header (keep auth pages overlay) */}
      {!isAuthPage ? (
        <div
          className={styles.headerSpacer}
          style={{ height: '79.58px' }}
          aria-hidden="true"
        />
      ) : null}

      {/* Feedback Modal */}
      {feedbackOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className={styles.modalOverlay} onClick={closeFeedbackModal}>
            <div className={styles.modalPanel} onClick={(e) => e.stopPropagation()}>
              <button className={styles.modalCloseBtn} onClick={closeFeedbackModal} aria-label="Close">
                ×
              </button>
              <h3 className={styles.modalTitle}>Share Feedback</h3>
              <p className={styles.modalSubtitle}>Your feedback helps us improve our service.</p>

              <form onSubmit={handleFeedbackSubmit} className={styles.feedbackForm}>
                <div className={styles.formGroup}>
                  <label htmlFor="feedback-email" className={styles.formLabel}>
                    Email Address
                  </label>
                  <input
                    id="feedback-email"
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={feedbackEmail}
                    onChange={(e) => setFeedbackEmail(e.target.value)}
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="feedback-message" className={styles.formLabel}>
                    Your Message
                  </label>
                  <textarea
                    id="feedback-message"
                    required
                    rows={4}
                    placeholder="How can we help you? Write your feedback here..."
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    className={styles.formTextarea}
                  />
                </div>

                <div className={styles.modalActions}>
                  <button type="submit" className={styles.btnSubmit} disabled={submittingFeedback}>
                    {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Review Us Modal */}
      {reviewOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className={styles.modalOverlay} onClick={() => setReviewOpen(false)}>
            <div className={styles.modalPanel} onClick={(e) => e.stopPropagation()}>
              <button className={styles.modalCloseBtn} onClick={() => setReviewOpen(false)} aria-label="Close">
                ×
              </button>
              <h3 className={styles.modalTitle}>Review Us</h3>
              <p className={styles.modalSubtitle}>We would love to know how we did. Choose a platform to write your review:</p>

              <div className={styles.reviewPlatforms}>
                <a
                  href={trustpilotUrl || 'https://www.trustpilot.com'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.reviewBtn} ${styles.btnTrustpilot}`}
                  onClick={() => setReviewOpen(false)}
                >
                  <svg className={styles.platformIcon} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                  Review on Trustpilot
                </a>

                <a
                  href={googleReviewUrl || REVIEW_US_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.reviewBtn} ${styles.btnGoogle}`}
                  onClick={() => setReviewOpen(false)}
                >
                  <svg className={styles.platformIcon} viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      fill="#EA4335"
                    />
                  </svg>
                  Review on Google
                </a>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
