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
import { contentApi, productsApi, walletApi } from '@/lib/api';
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
import { useEnterpriseTransition } from '@/components/EnterpriseTransition';

/**
 * User Dropdown Component
 * Shows "Hi, [name]" with dropdown menu
 */
function UserDropdown({ user, logout, isAdmin, isMobile = false, className = '', onClose }: { user: User | null; logout: () => void; isAdmin: boolean; isMobile?: boolean; className?: string; onClose?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { showToast } = useToast();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletTx, setWalletTx] = useState<Array<{ id: string; type: 'credit' | 'debit'; amount: number; source: string; createdAt?: string | null }>>([]);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletAddAmountOpen, setWalletAddAmountOpen] = useState(false);

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

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setWalletLoading(true);
    walletApi
      .getSummary()
      .then((w) => {
        if (cancelled) return;
        setWalletBalance(w.balance);
        setWalletTx(w.transactions || []);
      })
      .catch(() => {
        if (cancelled) return;
        setWalletBalance(null);
        setWalletTx([]);
      })
      .finally(() => {
        if (cancelled) return;
        setWalletLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!walletModalOpen) return;
    let cancelled = false;
    setWalletLoading(true);
    walletApi
      .getSummary()
      .then((w) => {
        if (cancelled) return;
        setWalletBalance(w.balance);
        setWalletTx(w.transactions || []);
      })
      .catch(() => {
        if (cancelled) return;
        setWalletBalance(null);
        setWalletTx([]);
      })
      .finally(() => {
        if (cancelled) return;
        setWalletLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [walletModalOpen]);

  useEffect(() => {
    const handleWalletUpdate = async () => {
      try {
        const w = await walletApi.getSummary();
        setWalletBalance(w.balance);
        setWalletTx(w.transactions || []);
      } catch (err) {
        console.error('[WALLET_EVENT] Failed to refresh summary:', err);
      }
    };
    window.addEventListener('milko:wallet-updated', handleWalletUpdate);
    return () => window.removeEventListener('milko:wallet-updated', handleWalletUpdate);
  }, []);

  useEffect(() => {
    if (!walletModalOpen) {
      setWalletAddAmountOpen(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (walletAddAmountOpen) {
        setWalletAddAmountOpen(false);
      } else {
        setWalletModalOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [walletModalOpen, walletAddAmountOpen]);

  const loadRazorpayScript = (): Promise<void> => {
    if (typeof window !== 'undefined' && (window as unknown as { Razorpay?: unknown }).Razorpay) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load Razorpay'));
      document.head.appendChild(s);
    });
  };

  const handleAddMoney = async () => {
    const amt = Math.round(Number(walletAmount) * 100) / 100;
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }
    try {
      const topup = await walletApi.createTopupOrder(amt);

      // Manual top-up mode (dev/local): backend credited wallet without Razorpay.
      if ('manual' in topup && topup.manual) {
        setWalletAmount('');
        setWalletAddAmountOpen(false);
        setWalletBalance(topup.balance);
        const refreshed = await walletApi.getSummary();
        setWalletTx(refreshed.transactions || []);
        showToast('Wallet topped up', 'success');
        return;
      }

      if (!('razorpayOrderId' in topup)) return;
      const order = topup;
      await loadRazorpayScript();
      const Razorpay = (window as unknown as { Razorpay: new (o: unknown) => { open: () => void } }).Razorpay;
      const rzp = new Razorpay({
        key: order.key,
        order_id: order.razorpayOrderId,
        currency: order.currency || 'INR',
        name: SITE_NAME,
        description: 'Add money to wallet',
        handler: async function (resp: { razorpay_payment_id: string; razorpay_order_id: string }) {
          try {
            const v = await walletApi.verifyTopup({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
            });
            setWalletBalance(v.balance);
            setWalletAmount('');
            setWalletAddAmountOpen(false);
            const refreshed = await walletApi.getSummary();
            setWalletTx(refreshed.transactions || []);
            showToast('Wallet topped up', 'success');
          } catch (e) {
            showToast((e as { message?: string })?.message || 'Wallet top-up failed', 'error');
          }
        },
      });
      rzp.open();
    } catch (e) {
      showToast((e as { message?: string })?.message || 'Failed to start top-up', 'error');
    }
  };

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
    router.push('/');
  };

  const formatWalletAmount = (amount: number) =>
    amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getWalletTxPurpose = (tx: { type: 'credit' | 'debit'; source: string }) => {
    const source = (tx.source || '').toLowerCase();
    if (tx.type === 'credit') {
      return 'Money added';
    }
    if (source.includes('subscription')) {
      return 'Plan purchased';
    }
    if (source.includes('purchase')) {
      return 'Item bought';
    }
    if (source.includes('order') || source.includes('product') || source.includes('milk')) {
      return 'Order bought';
    }
    if (source.trim()) {
      return `${tx.source} bought`;
    }
    return 'Purchase made';
  };

  const formatWalletTxDate = (createdAt?: string | null) => {
    if (!createdAt) return '--.--.----';
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return '--.--.----';
    return date.toLocaleDateString('en-GB').replace(/\//g, '.');
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
        <Link href="/saved-designs" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
          <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Saved Designs
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
        <Link href="/reviews" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
          <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Reviews
        </Link>
        <Link href="/connectors" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
          <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Connectors
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
      {walletModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={styles.walletModalOverlay}
            role="presentation"
            onClick={() => {
              setWalletModalOpen(false);
              setWalletAddAmountOpen(false);
            }}
          >
            <div
              className={styles.walletModalContent}
              role="dialog"
              aria-modal="true"
              aria-labelledby="wallet-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.walletModalHeader}>
                <h2 id="wallet-modal-title" className={styles.walletModalTitle}>
                  Wallet
                </h2>
                <button
                  type="button"
                  className={styles.walletModalClose}
                  onClick={() => {
                    setWalletModalOpen(false);
                    setWalletAddAmountOpen(false);
                  }}
                  aria-label="Close wallet"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <div className={styles.walletModalBalanceBlock}>
                <div className={styles.walletModalBalanceLeft}>
                  <span className={styles.walletModalBalanceLabel}>Balance</span>
                  <span className={styles.walletModalBalanceValue}>
                    {walletLoading ? 'Loading…' : walletBalance !== null ? `₹${formatWalletAmount(walletBalance)}` : '—'}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.walletModalBalanceAddBtn}
                  onClick={() => {
                    setWalletAmount('');
                    setWalletAddAmountOpen(true);
                  }}
                >
                  <svg
                    className={styles.walletModalBalanceAddBtnIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span>Add money</span>
                </button>
              </div>
              {walletAddAmountOpen && (
                <div
                  className={styles.walletNestedOverlay}
                  role="presentation"
                  onClick={() => setWalletAddAmountOpen(false)}
                >
                  <div
                    className={styles.walletNestedContent}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="wallet-add-amount-title"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 id="wallet-add-amount-title" className={styles.walletNestedTitle}>
                      How much do you want to add?
                    </h3>
                    <label className={styles.walletNestedLabel} htmlFor="wallet-add-amount-input">
                      Amount (₹)
                    </label>
                    <input
                      id="wallet-add-amount-input"
                      className={styles.walletNestedInput}
                      inputMode="decimal"
                      placeholder="e.g. 500"
                      value={walletAmount}
                      onChange={(e) => setWalletAmount(e.target.value)}
                      autoFocus
                    />
                    <div className={styles.walletNestedActions}>
                      <button
                        type="button"
                        className={styles.walletNestedCancel}
                        onClick={() => setWalletAddAmountOpen(false)}
                      >
                        Cancel
                      </button>
                      <button type="button" className={styles.walletNestedSubmit} onClick={handleAddMoney}>
                        Continue
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className={styles.walletModalSectionLabel}>Transaction history</div>
              <div className={styles.walletModalTxList}>
                {walletLoading ? (
                  <p className={styles.walletModalEmpty}>Loading…</p>
                ) : walletTx.length === 0 ? (
                  <p className={styles.walletModalEmpty}>
                    <span
                      className={styles.walletModalEmptyIcon}
                      aria-hidden="true"
                      dangerouslySetInnerHTML={{
                        __html: `<svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M232.805 146.703C234.603 144.355 235.653 141.606 236.117 138.728C236.348 137.314 236.317 135.86 236.194 134.44C236.084 133.169 235.708 131.935 235.385 130.706C235.281 130.303 235.156 129.932 234.982 129.593C235.212 129.303 235.4 128.982 235.537 128.638C235.886 127.76 235.956 126.52 235.463 125.675C234.895 124.696 234.322 123.73 233.508 122.93C232.665 122.105 231.787 121.3 230.847 120.578C229.291 119.389 227.58 118.468 225.783 117.674C224.552 117.131 223.218 116.82 221.908 116.519C220.595 116.219 219.206 116.294 217.874 116.361C216.352 116.438 214.853 116.943 213.41 117.387C208.61 118.862 205.189 123.017 203.288 127.438C202.53 129.201 202.154 131.141 201.847 133.022C201.703 133.912 201.553 134.817 201.491 135.719C201.376 137.345 201.294 138.955 201.363 140.59C201.419 141.902 201.562 143.176 201.846 144.461C202.174 145.957 202.723 147.425 203.377 148.808C203.935 149.992 204.671 151.104 205.425 152.172C206.128 153.17 207.069 154.013 208.014 154.783C209.085 155.654 210.586 156.121 211.936 156.362C213.519 156.643 215.093 156.604 216.693 156.415C218.27 156.233 219.832 155.699 221.342 155.232C222.352 154.916 223.346 154.569 224.322 154.156C224.739 153.979 225.146 153.78 225.54 153.565C228.483 151.951 230.803 149.319 232.805 146.703Z" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path fill-rule="evenodd" clip-rule="evenodd" d="M169.749 119.35C168.825 119.971 168.109 120.717 167.351 121.527C166.45 122.492 165.873 123.785 165.326 124.959C164.845 125.988 164.534 127.085 164.277 128.195C162.438 128.005 160.603 129.069 159.939 130.831C158.879 133.666 158.911 136.615 159.437 139.552C159.678 140.893 160.124 142.212 160.535 143.51C160.888 144.626 161.265 145.727 161.735 146.802C162.086 147.609 162.592 148.376 163.085 149.104C163.563 149.815 164.081 150.465 164.684 151.083C165.38 151.796 166.171 152.466 166.973 153.07C167.638 153.568 168.424 153.923 169.16 154.302C168.831 154.134 168.504 153.964 168.174 153.796C169.14 154.291 170.071 154.748 171.093 155.106C172.226 155.503 173.411 155.73 174.583 155.978C176.75 156.436 179.063 156.301 181.215 155.841C183.48 155.357 185.576 154.413 187.499 153.166C191.327 150.684 194.19 146.793 195.457 142.475C196.099 140.289 196.25 138.119 196.001 135.861C195.893 134.872 195.754 133.894 195.558 132.917C195.094 130.63 194.399 128.337 193.415 126.215C192.986 125.292 192.436 124.418 191.869 123.572C191.539 123.08 191.185 122.62 190.802 122.162C190.317 121.591 189.707 121.119 189.152 120.618C188.118 119.685 186.747 119.068 185.489 118.496C184.904 118.231 184.28 118.048 183.673 117.841C181.887 117.23 179.991 116.912 178.104 116.912C175.153 116.911 172.223 117.69 169.749 119.35Z" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path opacity="0.503384" d="M235.464 179.408C235.536 182.688 235.585 186.889 235.643 190.169C235.672 191.806 235.74 193.438 235.809 195.068C235.871 196.568 235.966 198.064 236.019 199.567C236.059 200.706 236.094 201.844 236.125 202.983C236.124 202.967 236.124 202.952 236.123 202.936C236.163 205.111 236.187 207.289 236.248 209.463C236.309 211.609 236.385 213.754 236.443 215.903C236.476 217.646 236.499 219.389 236.533 221.132C236.551 222.06 236.569 222.988 236.533 221.132C236.551 222.06 236.569 222.988 236.587 223.916C236.607 224.895 236.634 225.877 236.615 226.858" stroke="#000000" stroke-opacity="0.9" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path> <path opacity="0.503384" d="M219.261 175.936C219.333 180.416 219.382 186.154 219.44 190.634C219.469 192.869 219.537 195.099 219.606 197.325C219.668 199.375 219.763 201.418 219.816 203.47C219.855 205.026 219.891 206.58 219.921 208.136C219.921 208.115 219.921 208.093 219.92 208.072C219.96 211.043 219.984 214.018 220.045 216.986C220.106 219.918 220.182 222.848 220.24 225.782C220.273 228.164 220.296 230.544 220.33 232.925C220.348 234.192 220.366 235.46 220.384 236.727C220.404 238.065 220.431 239.405 220.412 240.746" stroke="#000000" stroke-opacity="0.9" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path> <path opacity="0.503384" d="M162.552 179.408C162.671 183.248 162.752 188.166 162.848 192.006C162.895 193.922 163.008 195.833 163.122 197.741C163.224 199.498 163.37 212.05 163.47 214.594C163.571 217.107 163.319 219.618 163.414 222.133C163.47 224.175 163.508 226.215 163.563 228.256C163.593 229.342 163.624 230.428 163.653 231.514C163.686 232.661 163.73 233.81 163.698 234.96" stroke="#000000" stroke-opacity="0.9" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path> <path opacity="0.503384" d="M200.754 172.464C200.723 176.824 200.762 181.176 200.909 185.533C201.053 189.733 201.247 193.928 201.486 198.122C201.629 200.68 201.784 203.235 201.939 205.793C201.931 205.63 201.923 205.467 201.917 205.306C202.006 207.189 202.114 209.069 202.169 210.954C202.233 213.14 202.291 215.326 202.33 217.512C202.402 221.466 202.446 225.423 202.624 229.374C202.748 232.184 202.911 234.985 203.15 237.785C203.336 240.01 203.467 242.234 203.585 244.464C203.657 246.542 203.729 248.621 203.77 250.703C203.792 251.9 203.818 253.095 203.84 254.294C203.848 254.783 203.856 255.272 203.867 255.762C203.87 256.025 203.879 256.288 203.884 256.551C203.889 256.865 203.916 257.188 203.906 257.505C203.858 257.64 203.827 257.785 203.815 257.947C203.776 258.42 203.923 258.897 204.216 259.263" stroke="#000000" stroke-opacity="0.9" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path> <path opacity="0.503384" d="M182.227 174.778C182.355 178.762 182.251 187.946 182.354 191.936C182.351 191.789 182.348 191.646 182.346 191.501C182.424 195.324 182.497 199.147 182.564 202.972C182.625 206.484 182.657 209.999 182.69 213.513C182.704 215.028 182.711 216.545 182.722 218.061C182.732 219.53 182.76 221 182.781 222.469C182.8 223.971 182.846 225.473 182.88 226.976C182.908 228.228 182.941 229.478 182.972 230.73C183.019 232.951 183.059 235.172 183.098 237.393C183.14 239.711 183.218 242.021 183.278 244.336C183.278 244.323 183.277 244.309 183.277 244.296C183.296 245.214 183.314 246.131 183.33 247.05L183.356 248.558C183.365 249.04 183.372 249.523 183.384 250.005" stroke="#000000" stroke-opacity="0.9" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M107.972 355.322C102.224 294.943 121.961 259.451 167.181 248.848" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M238.936 247.69C274.427 247.69 292.173 283.567 292.173 355.322" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M168.339 250.005C172.192 264.219 183.708 282.736 202.888 305.557C220.283 281.301 230.756 262.784 234.307 250.005" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M203.059 304.399L204.216 342.591" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M134.776 304.978H172.968" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M251.387 204.869C252.167 204.187 252.747 203.432 253.267 202.553C253.486 202.178 253.706 201.804 253.928 201.432C254.419 200.6 254.942 199.784 255.486 198.986C256.574 197.384 257.884 195.944 258.916 194.307C260.062 192.493 260.916 190.487 261.817 188.549C262.639 186.778 263.51 185.033 264.34 183.266C265.954 179.829 267.572 176.402 268.925 172.855C269.586 171.117 270.025 169.285 270.451 167.477C270.955 165.338 271.452 163.193 271.841 161.028C272.548 157.092 273.136 153.13 273.446 149.142 273.741 145.305 273.654 141.43 273.601 137.588C273.548 133.481 283.251 128.921 283 124.822C282.786 121.325 272.437 118.307 271.867 114.85C271.291 111.382 270.785 107.905 270.039 104.466C269.63 102.582 269.183 100.707 268.741 98.8294C268.332 97.0788 267.969 95.3201 267.545 93.5726C267.048 91.5263 266.519 89.4659 265.767 87.4925C265.564 86.959 265.353 86.4314 265.135 85.9076C264.835 85.3206 264.539 84.7329 264.247 84.1429C263.667 82.9757 263.11 81.7995 262.568 80.6166C261.857 79.3564 261.088 78.1245 260.308 76.9104C259.338 75.3924 258.352 73.8797 257.317 72.4055C255.203 69.3896 253.004 66.4175 250.478 63.7271C248.978 62.1281 247.366 60.5462 245.545 59.3009C243.901 58.1753 242.229 57.0979 240.553 56.0213C238.609 54.7708 236.682 53.5344 234.614 52.489C233.766 52.0595 232.921 51.6679 232.05 51.2905C231.048 50.861 229.974 50.5475 228.942 50.196C225.141 48.9106 221.286 47.8629 217.371 46.9862C213.216 46.0544 208.97 45.619 204.757 45.0098C201.178 44.4904 197.593 44 193.991 44C192.35 44 190.704 44.1011 189.058 44.3477C187.023 44.6524 185.002 44.9949 182.993 45.4593C181.114 45.8977 179.256 46.4259 177.4 46.9542C175.607 47.4654 173.803 47.9328 172.019 48.4841C169.993 49.1105 168.022 49.8364 166.078 50.6812C164.367 51.4242 162.742 52.321 161.136 53.261C160.101 53.865 154.153 57.2686 143.849 70.0316C133.546 82.7945 129.271 111.662 129.075 113.428C128.655 117.222 128.18 121.008 127.999 124.822C127.818 128.649 116.941 133.759 117 137.588C117.027 139.323 127.88 139.778 127.946 141.509C128.026 143.674 128.216 145.822 128.462 147.976C128.871 151.586 129.254 155.208 129.9 158.787C130.592 162.623 131.274 166.466 132.187 170.258C132.609 172.021 133.089 173.772 133.546 175.53C133.99 177.24 134.412 178.959 134.907 180.656C135.464 182.567 136.04 184.473 136.601 186.385C137.203 188.431 137.787 190.486 138.532 192.484C138.985 193.696 139.587 194.83 140.228 195.956C140.916 197.173 141.643 198.356 142.399 199.531C143.239 200.869 144.048 202.227 145.072 203.439" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M154.451 130.819C154.125 130.805 153.8 130.8 153.476 130.8C151.667 130.8 149.883 130.987 148.079 131.183C146.838 131.316 145.596 131.417 144.352 131.535C142.029 131.761 139.736 132.178 137.422 132.462C136.446 132.581 135.471 132.684 134.507 132.877C133.318 133.114 132.152 133.544 131.016 133.952C130.095 134.285 129.187 134.658 128.278 135.02C127.303 135.407 126.33 135.911 125.518 136.586" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M275.708 129.33C275.169 128.625 274.629 128.05 273.813 127.654C273.098 127.31 272.326 127.088 271.534 127.006L271.488 127.001C270.534 126.907 269.563 126.899 268.605 126.855C267.27 126.797 265.938 126.845 264.604 126.912C263.101 126.988 261.603 127.166 260.101 127.266C258.599 127.368 257.092 127.374 255.588 127.415C254.31 127.453 253.03 127.506 251.75 127.501C250.266 127.495 248.785 127.477 247.301 127.55C245.81 127.621 244.323 127.754 242.831 127.811C241.443 127.864 240.069 128.006 238.689 128.141" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M193.839 133.742C193.113 134.822 202.609 134.066 201.859 133.114" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>`,
                      }}
                    />
                    No transactions yet
                  </p>
                ) : (
                  walletTx.map((t) => (
                    <div key={t.id} className={styles.walletModalTxRow}>
                      <div className={styles.walletModalTxLeft}>
                        <span
                          className={`${styles.walletModalTxIcon} ${t.type === 'credit' ? styles.walletModalTxIconCredit : styles.walletModalTxIconDebit
                            }`}
                          aria-hidden="true"
                        >
                          {t.type === 'credit' ? '↓' : '↑'}
                        </span>
                        <div className={styles.walletModalTxMeta}>
                          <span className={styles.walletModalTxTitle}>{getWalletTxPurpose(t)}</span>
                          <span className={styles.walletModalTxSub}>Txn ID: {t.id}</span>
                        </div>
                      </div>
                      <div className={styles.walletModalTxRight}>
                        <span
                          className={`${styles.walletModalTxAmount} ${t.type === 'credit' ? styles.walletModalTxAmountCredit : styles.walletModalTxAmountDebit
                            }`}
                        >
                          {t.type === 'credit' ? '+' : '-'} ₹{formatWalletAmount(t.amount)}
                        </span>
                        <span className={styles.walletModalTxDate}>{formatWalletTxDate(t.createdAt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
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
  const { triggerEnterpriseTransition } = useEnterpriseTransition();
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
  const [savedPincode, setSavedPincode] = useState<string | null>(null);
  const [savedDeliveryStatus, setSavedDeliveryStatus] = useState<'available' | 'unavailable' | null>(null);
  const [serviceablePincodes, setServiceablePincodes] = useState<Array<{ pincode: string; deliveryTime?: string }> | null>(null);
  const pincodeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Mobile navigation menu state, refs and effects
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileOthersOpen, setIsMobileOthersOpen] = useState(false);
  const [isMobileKeepsakesOpen, setIsMobileKeepsakesOpen] = useState(false);
  const rightButtonsRef = useRef<HTMLDivElement>(null);
  const rightButtonsCollapsedRef = useRef<HTMLDivElement>(null);
  const rightButtonsExpandedRef = useRef<HTMLDivElement>(null);
  const mobileMenuBackdropRef = useRef<HTMLDivElement>(null);
  const mobileMenuHeaderRef = useRef<HTMLDivElement>(null);
  const mobileNavMenuRef = useRef<HTMLElement>(null);
  const isMenuAnimatingRef = useRef(false);
  const collapsedPillRectRef = useRef<{ top: number; left: number; width: number; height: number } | null>(null);
  const [canScrollTop, setCanScrollTop] = useState(false);
  const [canScrollBottom, setCanScrollBottom] = useState(false);

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
    if (isMobileMenuOpen) {
      const nav = rightButtonsRef.current;
      const backdrop = mobileMenuBackdropRef.current;
      const collapsedContent = rightButtonsCollapsedRef.current;
      const expandedContent = rightButtonsExpandedRef.current;
      if (backdrop) gsap.set(backdrop, { display: 'none', pointerEvents: 'none', opacity: 0 });
      if (expandedContent) gsap.set(expandedContent, { display: 'none', opacity: 0 });
      if (collapsedContent) gsap.set(collapsedContent, { display: 'flex', opacity: 1 });
      if (nav) gsap.set(nav, { clearProps: 'all' });
      document.body.style.overflow = '';
      document.body.removeAttribute('data-mobile-menu-open');
      isMenuAnimatingRef.current = false;
    }
    setIsMobileMenuOpen(false);
    setIsMobileOthersOpen(false);
    setIsMobileKeepsakesOpen(false);
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
      document.body.style.overflow = 'hidden';
      document.body.setAttribute('data-mobile-menu-open', 'true');

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
      document.body.style.overflow = '';
      document.body.removeAttribute('data-mobile-menu-open');
    }
    return () => {
      document.body.style.overflow = '';
      document.body.removeAttribute('data-mobile-menu-open');
    };
  }, [isMobileMenuOpen]);

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
        // If ANY active product is nationwide, delivery is available
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

    return true;
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

  // If we have a saved pincode, compute saved status based on current config
  useEffect(() => {
    if (!savedPincode || savedPincode.length !== 6) return;
    const ok = isDeliverable(savedPincode);
    setSavedDeliveryStatus(ok ? 'available' : 'unavailable');
    localStorage.setItem(scopedPincodeStatusKey(pinUserId), ok ? 'available' : 'unavailable');
  }, [savedPincode, serviceablePincodes, allProducts, pinUserId]);

  // Focus first pincode input when modal opens
  useEffect(() => {
    if (isAddressModalOpen) {
      // Reset pincode and delivery status when modal opens
      setPincode(['', '', '', '', '', '']);
      setDeliveryStatus(null);
      // Focus first input after a short delay to ensure DOM is ready
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

  // Check pincode delivery availability
  const checkPincodeDelivery = async () => {
    const fullPincode = pincode.join('');
    if (fullPincode.length !== 6) return;

    setDeliveryStatus('checking');

    let productsList = allProducts;
    if (productsList === null) {
      try {
        productsList = await productsApi.getAll();
        setAllProducts(productsList);
      } catch (err) {
        console.error('Failed to load products for pincode check:', err);
      }
    }

    setTimeout(() => {
      const isAvailable = isDeliverable(fullPincode, productsList);
      setDeliveryStatus(isAvailable ? 'available' : 'unavailable');
    }, 400);
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
  const [isScrolled, setIsScrolled] = useState(false);
  const hasScrolledToMembershipRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [trustpilotUrl, setTrustpilotUrl] = useState<string>('');

  useEffect(() => {
    contentApi.getByType('reviews')
      .then((data) => {
        if (data && data.isActive && data.metadata && data.metadata.trustpilotUrl) {
          setTrustpilotUrl(data.metadata.trustpilotUrl);
        }
      })
      .catch((err) => {
        console.error('Failed to load reviews settings for header:', err);
      });
  }, []);

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
    // Update refs after a short delay to ensure DOM is ready
    const timeout = setTimeout(updateRefs, 100);
    return () => clearTimeout(timeout);
  }, [itemCount]); // Re-run when cart count changes

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
          setHeaderHeight(headerRef.current.getBoundingClientRect().height);
        }
      }
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isScrolled]);

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
                    <span className={styles.navLink}>Journals</span>
                    <span className={styles.navLink}>Scribbling Sets</span>
                    <span className={styles.keepsakesButton}>
                      Memory Keepsakes
                      <svg className={styles.dropdownArrow} viewBox="0 0 24 24" fill="none">
                        <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className={`${styles.navLink} ${styles.navLinkHighlight}`}>Try PhotoBooth</span>
                    <span className={styles.othersButton}>
                      Others
                      <svg className={styles.dropdownArrow} viewBox="0 0 24 24" fill="none">
                        <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className={styles.navLink}>Enterprise</span>
                  </div>

                  <nav
                    ref={navMenuRef}
                    className={`${styles.navMenu} ${expandedDropdown ? styles.navMenuExpanded : ''}`}
                  >
                    <div ref={navLinksRowRef} className={styles.navLinksRow}>
                      <Link
                        href="/journals"
                        className={`${styles.navLink} ${isHeaderNavActive(pathname, '/journals') ? styles.navLinkActive : ''}`}
                        onClick={() => setExpandedDropdown(null)}
                      >
                        Journals
                      </Link>
                      <Link
                        href="/scribbling-sets"
                        className={`${styles.navLink} ${isHeaderNavActive(pathname, '/scribbling-sets') ? styles.navLinkActive : ''}`}
                        onClick={() => setExpandedDropdown(null)}
                      >
                        Scribbling Sets
                      </Link>
                      <div className={styles.keepsakesDropdown}>
                        <button
                          type="button"
                          onClick={() => handleDropdownToggle('keepsakes')}
                          className={`${styles.keepsakesButton} ${expandedDropdown === 'keepsakes' || isKeepsakesNavActive(pathname) ? styles.navLinkActive : ''}`}
                        >
                          Memory Keepsakes
                          <svg
                            className={`${styles.dropdownArrow} ${expandedDropdown === 'keepsakes' ? styles.dropdownArrowOpen : ''}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                      <Link
                        href="/photobooth"
                        className={`${styles.navLink} ${styles.navLinkHighlight} ${isHeaderNavActive(pathname, '/photobooth') ? styles.navLinkActive : ''}`}
                        onClick={() => setExpandedDropdown(null)}
                      >
                        Try PhotoBooth
                      </Link>
                      <div className={styles.othersDropdown}>
                        <button
                          type="button"
                          onClick={() => handleDropdownToggle('others')}
                          className={`${styles.othersButton} ${expandedDropdown === 'others' || isOthersNavActive(pathname) ? styles.navLinkActive : ''}`}
                        >
                          Others
                          <svg
                            className={`${styles.dropdownArrow} ${expandedDropdown === 'others' ? styles.dropdownArrowOpen : ''}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                      <Link
                        href="/enterprise"
                        className={`${styles.navLink} ${isHeaderNavActive(pathname, '/enterprise') ? styles.navLinkActive : ''}`}
                        onClick={(e) => {
                          setExpandedDropdown(null);
                          e.preventDefault();
                          triggerEnterpriseTransition(e);
                        }}
                      >
                        Enterprise
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
                          } catch {}
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
                      onClick={() => {
                        ensureProducts();
                        setIsDesktopSearchOpen(true);
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
                    >
                      <div ref={cartButtonMobileRef as any} className={styles.cartIconWrapper}>
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
                    <Link
                      href="/cart"
                      className={styles.cartButton}
                      aria-label="Cart"
                    >
                      <div ref={cartButtonDesktopRef as any} className={styles.cartIconWrapper}>
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
                    </Link>
                  </div>

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
                          href="/journals"
                          className={`${styles.mobileNavLink} ${isHeaderNavActive(pathname, '/journals') ? styles.mobileNavLinkActive : ''}`}
                          onClick={closeMobileMenu}
                        >
                          Journals
                        </Link>
                        <Link
                          href="/scribbling-sets"
                          className={`${styles.mobileNavLink} ${isHeaderNavActive(pathname, '/scribbling-sets') ? styles.mobileNavLinkActive : ''}`}
                          onClick={closeMobileMenu}
                        >
                          Scribbling Sets
                        </Link>
                        <div className={styles.mobileKeepsakesDropdown} style={{ width: '100%' }}>
                          <button
                            type="button"
                            className={styles.mobileNavLink}
                            onClick={() => setIsMobileKeepsakesOpen(!isMobileKeepsakesOpen)}
                            style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: '0', textAlign: 'left', cursor: 'pointer' }}
                          >
                            <span>Memory Keepsakes</span>
                            <svg
                              className={`${styles.dropdownArrow} ${isMobileKeepsakesOpen ? styles.dropdownArrowOpen : ''}`}
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              style={{ width: '16px', height: '16px' }}
                            >
                              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          {isMobileKeepsakesOpen && (
                            <div className={styles.mobileSubMenu} style={{ paddingLeft: '1.5rem', paddingTop: '0.8rem', paddingBottom: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                              <Link
                                href="/memorybooks"
                                className={`${styles.mobileSubNavLink} ${isHeaderNavActive(pathname, '/memorybooks') ? styles.mobileSubNavLinkActive : ''}`}
                                onClick={closeMobileMenu}
                              >
                                Memory Books
                              </Link>
                              <Link
                                href="/polaroids"
                                className={`${styles.mobileSubNavLink} ${isHeaderNavActive(pathname, '/polaroids') ? styles.mobileSubNavLinkActive : ''}`}
                                onClick={closeMobileMenu}
                              >
                                Polas & Strips
                              </Link>
                            </div>
                          )}
                        </div>
                        <Link
                          href="/photobooth"
                          className={`${styles.mobileNavLink} ${styles.mobileNavLinkHighlight} ${isHeaderNavActive(pathname, '/photobooth') ? styles.mobileNavLinkActive : ''}`}
                          onClick={closeMobileMenu}
                        >
                          Try PhotoBooth
                        </Link>
                        <div className={styles.mobileOthersDropdown} style={{ width: '100%' }}>
                          <button
                            type="button"
                            className={styles.mobileNavLink}
                            onClick={() => setIsMobileOthersOpen(!isMobileOthersOpen)}
                            style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: '0', textAlign: 'left', cursor: 'pointer' }}
                          >
                            <span>Others</span>
                            <svg
                              className={`${styles.dropdownArrow} ${isMobileOthersOpen ? styles.dropdownArrowOpen : ''}`}
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              style={{ width: '16px', height: '16px' }}
                            >
                              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          {isMobileOthersOpen && (
                            <div className={styles.mobileSubMenu} style={{ paddingLeft: '1.5rem', paddingTop: '0.8rem', paddingBottom: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                              <Link
                                href="/calendars"
                                className={`${styles.mobileSubNavLink} ${isHeaderNavActive(pathname, '/calendars') ? styles.mobileSubNavLinkActive : ''}`}
                                onClick={closeMobileMenu}
                              >
                                Calendars
                              </Link>
                              <Link
                                href="/notepads"
                                className={`${styles.mobileSubNavLink} ${isHeaderNavActive(pathname, '/notepads') ? styles.mobileSubNavLinkActive : ''}`}
                                onClick={closeMobileMenu}
                              >
                                Notepads
                              </Link>
                              <Link
                                href="/posters"
                                className={`${styles.mobileSubNavLink} ${isHeaderNavActive(pathname, '/posters') ? styles.mobileSubNavLinkActive : ''}`}
                                onClick={closeMobileMenu}
                              >
                                Posters
                              </Link>
                              <Link
                                href="/sketchbooks"
                                className={`${styles.mobileSubNavLink} ${isHeaderNavActive(pathname, '/sketchbooks') ? styles.mobileSubNavLinkActive : ''}`}
                                onClick={closeMobileMenu}
                              >
                                Sketchbooks
                              </Link>
                              <Link
                                href="/planners"
                                className={`${styles.mobileSubNavLink} ${isHeaderNavActive(pathname, '/planners') ? styles.mobileSubNavLinkActive : ''}`}
                                onClick={closeMobileMenu}
                              >
                                Planners
                              </Link>
                              <Link
                                href="/papers"
                                className={`${styles.mobileSubNavLink} ${isHeaderNavActive(pathname, '/papers') ? styles.mobileSubNavLinkActive : ''}`}
                                onClick={closeMobileMenu}
                              >
                                Papers
                              </Link>
                              <Link
                                href="/cardstocks"
                                className={`${styles.mobileSubNavLink} ${isHeaderNavActive(pathname, '/cardstocks') ? styles.mobileSubNavLinkActive : ''}`}
                                onClick={closeMobileMenu}
                              >
                                Card Stocks
                              </Link>
                            </div>
                          )}
                        </div>
                        <Link
                          href="/enterprise"
                          className={`${styles.mobileNavLink} ${isHeaderNavActive(pathname, '/enterprise') ? styles.mobileNavLinkActive : ''}`}
                          onClick={(e) => {
                            e.preventDefault();
                            closeMobileMenu();
                            triggerEnterpriseTransition(e);
                          }}
                        >
                          Enterprise
                        </Link>
                      </nav>

                      {/* Bottom Linear Gradient Scroll Fade (Transparent to White) */}
                      <div
                        className={`${styles.mobileNavFadeBottom} ${canScrollBottom ? styles.mobileNavFadeBottomActive : ''}`}
                        aria-hidden="true"
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Second Row: Search Bar removed for mobile redesign */}

        {/* Address Modal */}
        {isAddressModalOpen ? (
          <div className={styles.modalOverlay} onClick={() => setIsAddressModalOpen(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
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

              {/* Delivery Location Text */}
              {(() => {
                const fullPincode = pincode.join('');
                if (deliveryStatus === 'available') {
                  return (
                    <p key="available" className={`${styles.deliveryLocationText} ${styles.deliveryLocationTextSuccess}`}>
                      ✓ We are deliverable to {fullPincode}
                    </p>
                  );
                }
                if (deliveryStatus === 'unavailable') {
                  return (
                    <p key="unavailable" className={`${styles.deliveryLocationText} ${styles.deliveryLocationTextError}`}>
                      ✕ Currently not deliverable to {fullPincode}
                    </p>
                  );
                }
                if (deliveryStatus === 'checking') {
                  return (
                    <p key="checking" className={`${styles.deliveryLocationText} ${styles.deliveryLocationTextChecking}`}>
                      Checking deliverability for {fullPincode}...
                    </p>
                  );
                }
                return (
                  <p key="default" className={styles.deliveryLocationText}>
                    Delivering to all over India
                  </p>
                );
              })()}

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

                          // Auto-focus next box if value entered
                          if (value && index < 5) {
                            pincodeInputRefs.current[index + 1]?.focus();
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
                        // Focus the last filled box or next empty box
                        const nextIndex = Math.min(pastedData.length, 5);
                        pincodeInputRefs.current[nextIndex]?.focus();
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
            </div>
          </div>
        ) : null}
      </header>

      {/* Desktop: Centered search overlay */}
      {!isMobile && isDesktopSearchOpen && (
        createPortal(
          <div
            className={styles.desktopSearchOverlay}
            onClick={() => setIsDesktopSearchOpen(false)}
          >
            <div
              className={styles.desktopSearchContent}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.desktopSearchHeader}>
                <h3 className={styles.desktopSearchTitle}>Search Products</h3>
                <button
                  type="button"
                  className={styles.desktopSearchClose}
                  onClick={() => setIsDesktopSearchOpen(false)}
                  aria-label="Close search"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6L18 18" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSearch} className={styles.desktopSearchForm}>
                {!isSearching && (
                  <div className={styles.desktopSearchIcon}>
                    <svg className={styles.desktopSearchIconSvg} viewBox="0 -0.5 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M5.5 11.1455C5.49956 8.21437 7.56975 5.69108 10.4445 5.11883C13.3193 4.54659 16.198 6.08477 17.32 8.79267C18.4421 11.5006 17.495 14.624 15.058 16.2528C12.621 17.8815 9.37287 17.562 7.3 15.4895C6.14763 14.3376 5.50014 12.775 5.5 11.1455Z" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                      <path d="M15.989 15.4905L19.5 19.0015" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </div>
                )}
                <input
                  ref={desktopSearchInputRef}
                  type="text"
                  placeholder="Search Anything"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.desktopSearchInput}
                  disabled={isSearching}
                />
                {isSearching && (
                  <div className={styles.desktopSearchSpinner}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.spinnerIcon}>
                      <circle cx="12" cy="12" r="10" stroke="#000000" strokeWidth="2" strokeOpacity="0.2" fill="none" />
                      <path d="M12 2C6.477 2 2 6.477 2 12" stroke="#000000" strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="20 40" />
                    </svg>
                  </div>
                )}
              </form>

              {/* Search Results */}
              <div
                className={`${styles.desktopSearchResultsScroll} ${searchQuery.trim() ? styles.desktopSearchResultsScrollExpanded : ''}`}
                data-lenis-prevent
              >
                {isSearchProductsLoading ? (
                  <div className={styles.desktopSearchLoading}>Loading products...</div>
                ) : searchQuery.trim() && searchResults.length > 0 ? (
                  <div className={styles.desktopSearchResultsList}>
                    <AnimatePresence mode="popLayout">
                      {searchResults.slice(0, 6).map((p) => {
                        const isOutOfStock = p.isActive === false || (typeof p.quantity === 'number' && p.quantity <= 0);
                        const imageUrl = getPrimaryProductImageUrl(p);
                        const categoryLabel = p.categoryId ? (categoryMap.get(p.categoryId) || 'Dairy') : 'Dairy';

                        return (
                          <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.96, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: -8 }}
                            transition={{
                              type: 'spring',
                              stiffness: 450,
                              damping: 35,
                              mass: 0.8,
                            }}
                            key={p.id}
                            className={`${cardStyles.productCard} ${isOutOfStock ? cardStyles.productCardOutOfStock : ''}`}
                            onClick={() => {
                              setIsDesktopSearchOpen(false);
                              router.push(`/product/${p.id}`);
                            }}
                          >
                            <div className={cardStyles.productImage} style={imageUrl ? { aspectRatio: 'auto' } : undefined}>
                              {isOutOfStock ? (
                                <div className={cardStyles.outOfStockBadge}>Out of stock</div>
                              ) : null}
                              {imageUrl ? (
                                <div className="product-card-image-wrapper">
                                  <Image
                                    src={imageUrl}
                                    alt={p.name}
                                    width={500}
                                    height={500}
                                    style={{ width: '100%', height: 'auto', display: 'block' }}
                                  />
                                  {p.hoverNextImage && getOrderedProductImageUrls(p)[1] && (
                                    <div className="product-card-hover-image-container">
                                      <Image
                                        src={getOrderedProductImageUrls(p)[1]}
                                        alt={p.name}
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
                          </motion.div>
                        );
                      })}
                      {searchResults.length > 6 && (
                        <motion.button
                          layout
                          key="show-more-desktop"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          type="button"
                          className={styles.searchShowMore}
                          onClick={() => {
                            setIsDesktopSearchOpen(false);
                            router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                          }}
                        >
                          Show all {searchResults.length} results
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                ) : searchQuery.trim() ? (
                  <div className={styles.desktopSearchEmpty}>No products found for &quot;{searchQuery}&quot;</div>
                ) : (
                  <div className={styles.desktopSearchSuggestions}>
                    <span className={styles.desktopSearchSuggestionsLabel}>Popular Searches</span>
                    <div className={styles.desktopSearchSuggestionsList}>
                      {['Polaroids', 'Photostrips', 'MemoryBooks', 'Journals', 'Photobooth'].map((term) => (
                        <button
                          key={term}
                          type="button"
                          className={styles.desktopSearchSuggestionTag}
                          onClick={() => {
                            if (term.toLowerCase().includes('photoboo')) {
                              setIsDesktopSearchOpen(false);
                              router.push('/photobooth');
                            } else {
                              setSearchQuery(term);
                              ensureProducts();
                            }
                          }}
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      )}

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
                    <path fillRule="evenodd" clipRule="evenodd" d="M5.5 11.1455C5.49956 8.21437 7.56975 5.69108 10.4445 5.11883C13.3193 4.54659 16.198 6.08477 17.32 8.79267C18.4421 11.5006 17.495 14.624 15.058 16.2528C12.621 17.8815 9.37287 17.562 7.3 15.4895C6.14763 14.3376 5.50014 12.775 5.5 11.1455Z" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M15.989 15.4905L19.5 19.0015" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
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
                <AnimatePresence mode="popLayout">
                  {searchResults.slice(0, 6).map((p) => {
                    const isOutOfStock = p.isActive === false || (typeof p.quantity === 'number' && p.quantity <= 0);
                    const imageUrl = getPrimaryProductImageUrl(p);
                    const categoryLabel = p.categoryId ? (categoryMap.get(p.categoryId) || 'Dairy') : 'Dairy';

                    return (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -8 }}
                        transition={{
                          type: 'spring',
                          stiffness: 450,
                          damping: 35,
                          mass: 0.8,
                        }}
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
                          {imageUrl ? (
                            <div className="product-card-image-wrapper">
                              <Image
                                src={imageUrl}
                                alt={p.name}
                                width={500}
                                height={500}
                                style={{ width: '100%', height: 'auto', display: 'block' }}
                              />
                              {p.hoverNextImage && getOrderedProductImageUrls(p)[1] && (
                                <div className="product-card-hover-image-container">
                                  <Image
                                    src={getOrderedProductImageUrls(p)[1]}
                                    alt={p.name}
                                    width={500}
                                    height={500}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className={cardStyles.placeholderImage}>
                              <span>🥛</span>
                            </div>
                          )}
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
                      </motion.div>
                    );
                  })}

                  {searchResults.length > 6 && (
                    <motion.button
                      layout
                      key="show-more-mobile"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      type="button"
                      className={styles.searchShowMore}
                      onClick={() => {
                        closeSearchOverlay();
                        router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                      }}
                      style={{ width: '100%' }}
                    >
                      Show all {searchResults.length} results
                    </motion.button>
                  )}
                </AnimatePresence>
              ) : (
                <p className={styles.searchOverlayStatus}>No products match</p>
              )
            ) : (
              <p className={styles.searchOverlayStatus}>Type to search products</p>
            )}
          </div>
        </div>
      )}

      {/* Mobile / tablet: Backdrop blur overlay behind expanding rightButtons */}
      {showNavMenuOverlay && (
        <div
          ref={mobileMenuBackdropRef}
          className={`${styles.mobileMenuBackdrop} ${isMobileMenuOpen ? styles.mobileMenuBackdropOpen : ''}`}
          onClick={closeMobileMenu}
        />
      )}

      {/* Spacer so content doesn't go under fixed header (keep auth pages overlay) */}
      {!isAuthPage ? (
        <div
          className={styles.headerSpacer}
          style={{ height: headerHeight }}
          aria-hidden="true"
        />
      ) : null}
    </>
  );
}
