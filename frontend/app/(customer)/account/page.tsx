'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { contentApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CustomerSidebarLayout from '@/components/customer/CustomerSidebarLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import styles from './account.module.css';
import WalletModal from '@/components/WalletModal';

/**
 * Account menu page (mobile-focused).
 * Shown when logged-in users tap the account icon on mobile.
 * Profile card at top + list of the same options as the header dropdown.
 */
const DEFAULT_APP_STORE_HREF = 'https://play.google.com/store';

/** Google Search / Maps review entry for Milko Gwalior (deep link). */
const GOOGLE_REVIEW_HREF =
  'https://www.google.com/search?q=milko+gwalior&sca_esv=97f4d30082618abf&authuser=3&sxsrf=ANbL-n4tluVin4BMsSMJvYMRRPQx-fGQrQ%3A1777743917583&source=hp&ei=LTj2aYu8IeKX4-EPwpWjmQk&iflsig=AFdpzrgAAAAAafZGPSMhQxz1YrKCC9NLGB65tghrx4qu&ved=0ahUKEwjLhtSVlJuUAxXiyzgGHcLKKJMQ4dUDCCA&uact=5&oq=milko+gwalior&gs_lp=Egdnd3Mtd2l6Ig1taWxrbyBnd2FsaW9yMgUQIRigATIFECEYoAEyBRAhGKABMgUQIRigAUjYP1CKK1jxPnACeACQAQCYAbICoAH1EaoBBzAuOC4yLjK4AQPIAQD4AQGYAg6gAs4SqAIKwgIKEAAYAxiPARjqAsICChAuGAMYjwEY6gLCAhEQLhiABBiKBRiRAhjHARjRA8ICCxAAGIAEGIoFGJECwgIKEC4YgAQYigUYQ8ICChAAGIAEGIoFGEPCAg4QLhiABBixAxjHARjRA8ICDhAAGIAEGIoFGLEDGIMBwgIFEAAYgATCAggQABiABBixA8ICCxAuGIAEGLEDGIMBwgIIEC4YgAQYsQPCAgsQLhiDARixAxiABMICDhAAGIAEGIoFGJECGLEDwgIQEC4YgAQYigUYQxjHARivAcICERAAGIAEGIoFGJECGLEDGIMBwgILEC4YgAQYxwEYrwHCAg4QLhiABBjHARivARiOBZgDD_EFfn6r4MPb3hmSBwcyLjguMi4yoAfLaLIHBzAuOC4yLjK4B7oSwgcHMC41LjguMcgHPIAIAQ&sclient=gws-wiz&sei=STj2aYCQC6ab4-EP_-v80AI#lrd=0x3976c12bef6ae93f:0x8427baeae2ab4794,3,,,,';

function pickOAuthAvatarFromMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta || typeof meta !== 'object') return null;
  const picture = meta.picture ?? meta.avatar_url;
  if (typeof picture === 'string' && picture.startsWith('http')) return picture.trim();
  return null;
}

export default function AccountPage() {
  const { user, isAuthenticated, logout, loading, refreshUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [walletOpen, setWalletOpen] = useState(false);
  const [appDownloadHref, setAppDownloadHref] = useState(
    () => process.env.NEXT_PUBLIC_PLAY_STORE_URL || DEFAULT_APP_STORE_HREF
  );
  /** Google (or other OAuth) picture from Supabase session metadata only — not persisted in Milko DB. */
  const [oauthAvatarUrl, setOauthAvatarUrl] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    refreshUser();
    contentApi
      .getByType('app_download')
      .then((c) => {
        const fromAdmin = (c.metadata?.downloadAppUrl || '').toString().trim();
        if (fromAdmin) setAppDownloadHref(fromAdmin);
        else setAppDownloadHref(process.env.NEXT_PUBLIC_PLAY_STORE_URL || DEFAULT_APP_STORE_HREF);
      })
      .catch(() => {
        setAppDownloadHref(process.env.NEXT_PUBLIC_PLAY_STORE_URL || DEFAULT_APP_STORE_HREF);
      });
    // Intentionally once on mount (same as before); refreshUser is not referentially stable from context.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid re-fetch loop
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import('@/lib/supabase/client');
        const { data } = await supabase.auth.getSession();
        const url = pickOAuthAvatarFromMetadata(
          (data.session?.user?.user_metadata || null) as Record<string, unknown> | null,
        );
        if (!cancelled) setOauthAvatarUrl(url);
      } catch {
        if (!cancelled) setOauthAvatarUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!showTooltip) return;
    const handleDocumentClick = () => {
      setShowTooltip(false);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [showTooltip]);

  const copyUserId = useCallback(async () => {
    if (!user?.id) return;
    try {
      await navigator.clipboard.writeText(user.id);
      showToast('User ID copied', 'success');
    } catch {
      showToast('Could not copy', 'error');
    }
  }, [user?.id, showToast]);

  if (loading) {
    return (
      <CustomerSidebarLayout>
        <LoadingSpinner fullHeight />
      </CustomerSidebarLayout>
    );
  }

  if (!isAuthenticated || !user) {
    router.push('/auth/login');
    return null;
  }

  const isAdmin = user.role === 'admin';
  const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <CustomerSidebarLayout>
      <Link href="/" className={styles.backLink} onClick={(e) => { e.preventDefault(); router.back(); }}>
        <svg className={styles.backIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back
      </Link>

      {/* Profile card */}
      <div className={styles.profileCard}>
        <div className={styles.avatar}>
          {oauthAvatarUrl || user?.avatarUrl ? (
            <img src={oauthAvatarUrl || user.avatarUrl} alt="" className={styles.avatarImage} referrerPolicy="no-referrer" />
          ) : (
            initial
          )}
        </div>
        <div className={styles.profileInfo}>
          <h1 className={styles.profileName}>{user.name || 'User'}</h1>
          <p className={styles.profileEmail}>{user.email}</p>
        </div>
      </div>

      {/* Options list (same as header dropdown) */}
      <div className={styles.optionsCard}>
        <Link href="/dashboard" className={styles.optionRow}>
          <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"/>
            <path d="M20.5899 22C20.5899 18.13 16.7399 15 11.9999 15C7.25991 15 3.40991 18.13 3.40991 22" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <span className={styles.optionLabel}>My Account</span>
          <svg className={styles.optionArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>

        <button
          type="button"
          className={styles.optionRow}
          onClick={() => setWalletOpen(true)}
        >
          <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M21 7H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19 7V5a2 2 0 0 0-2-2h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1 11h22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className={styles.optionLabel}>Wallet</span>
          <svg className={styles.optionArrow} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <Link href="/orders" className={styles.optionRow}>
          <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8C21 7.46957 20.7893 6.96086 20.4142 6.58579C20.0391 6.21071 19.5304 6 19 6H5C4.46957 6 3.96086 6.21071 3.58579 6.58579C3.21071 6.96086 3 7.46957 3 8V16C3 16.5304 3.21071 17.0391 3.58579 17.4142C3.96086 17.7893 4.46957 18 5 18H19C19.5304 18 20.0391 17.7893 20.4142 17.4142C20.7893 17.0391 21 16.5304 21 16Z"/>
            <path d="M3 10H21"/>
            <path d="M8 14H8.01"/>
          </svg>
          <span className={styles.optionLabel}>Orders</span>
          <svg className={styles.optionArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>

        {isAdmin && (
          <Link href="/admin" className={styles.optionRow}>
            <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3H10V10H3V3Z"/>
              <path d="M14 3H21V10H14V3Z"/>
              <path d="M3 14H10V21H3V14Z"/>
              <path d="M14 14H21V21H14V14Z"/>
            </svg>
            <span className={styles.optionLabel}>Panel</span>
            <svg className={styles.optionArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </Link>
        )}

        <Link href="/about" className={styles.optionRow}>
          <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
          <span className={styles.optionLabel}>About Us</span>
          <svg className={styles.optionArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>

        <Link href="/contact" className={styles.optionRow}>
          <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <span className={styles.optionLabel}>Contact Us</span>
          <svg className={styles.optionArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>

        <Link href="/privacy" className={styles.optionRow}>
          <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span className={styles.optionLabel}>Privacy</span>
          <svg className={styles.optionArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>

        <Link href="/terms" className={styles.optionRow}>
          <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
          </svg>
          <span className={styles.optionLabel}>Terms</span>
          <svg className={styles.optionArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>

        <button type="button" className={`${styles.optionRow} ${styles.optionRowLogout}`} onClick={handleLogout}>
          <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"/>
            <path d="M16 17L21 12L16 7"/>
            <path d="M21 12H9"/>
          </svg>
          <span className={styles.optionLabel}>Logout</span>
        </button>
      </div>



      <section className={styles.userIdFooterCard} aria-label="Your user ID">
        <div className={`${styles.profileUserIdRow} ${styles.profileUserIdRowFooter}`}>
          <div className={styles.labelContainer}>
            <span className={styles.profileUserIdLabel}>User ID</span>
            <button
              type="button"
              className={styles.infoButton}
              onClick={(e) => {
                e.stopPropagation();
                setShowTooltip(!showTooltip);
              }}
              aria-label="Show User ID explanation"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </button>
            {showTooltip && (
              <div className={styles.tooltip}>
                This userID can help us in case you are stuck with any of the thing
              </div>
            )}
          </div>
          <div className={styles.profileUserIdLine}>
            <span className={styles.profileUserId} title={user.id}>
              {user.id}
            </span>
            <button
              type="button"
              className={styles.profileUserIdCopy}
              onClick={() => void copyUserId()}
              aria-label="Copy user ID"
            >
              <svg className={styles.profileUserIdCopyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </CustomerSidebarLayout>
  );
}
