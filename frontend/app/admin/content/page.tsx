'use client';

import { useEffect, useState } from 'react';
import { adminContentApi, SiteContent } from '@/lib/api';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import styles from './content.module.css';

const CONTENT_TYPES = [
  { type: 'terms', label: 'Terms & Conditions', path: '/terms' },
  { type: 'privacy', label: 'Privacy Policy', path: '/privacy' },
  { type: 'refunds', label: 'Exchanges & Refunds', path: '/refunds' },
  { type: 'about', label: 'About Us', path: '/about' },
  { type: 'contact', label: 'Contact Details', path: '/contact' },
  { type: 'reviews', label: 'Reviews Settings', path: '/admin/content/reviews' },
];

const OTHER_OPTIONS = [
  { type: 'logo', label: 'Logo', path: '/admin/logo', description: 'Upload logo, set width' },
  { type: 'favicon', label: 'Favicon', path: '/admin/favicon', description: 'Upload browser tab icon' },
  { type: 'platform_fee', label: 'Platform fees', path: '/admin/content/platform_fee', description: 'Set flat checkout fee charged once per order' },
  { type: 'categories', label: 'Product Categories', path: '/admin/categories', description: 'Manage product categories' },
  { type: 'coupons', label: 'Coupons', path: '/admin/coupons', description: 'Manage discounts' },
  { type: 'help_support', label: 'Help support number', path: '/admin/content/help_support', description: 'Number or link for Need help (WhatsApp, Telegram)' },
  { type: 'app_download', label: 'Download our App', path: '/admin/content/app_download', description: 'Store or custom URL for the Account page app download row (mobile)' },
  { type: 'homepage_products', label: 'Homepage Products Rows', path: '/admin/content/homepage_products', description: 'Adjust how many product rows appear on homepage "Our Products"' },
  { type: 'gifting', label: 'Gifting', path: '/admin/content/gifting', description: 'Configure gift wrapping price per product and toggle customer availability' },
  { type: 'cod', label: 'Cash on Delivery (COD)', path: '/admin/content/cod', description: 'Enable or disable Cash on Delivery across cart and checkout' },
];

function Icon({ name }: { name: string }) {
  // Minimal monochrome icons (Heroicons-ish). Keep them inline to avoid new deps.
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'terms':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M7 3h7l3 3v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M14 3v4a2 2 0 0 0 2 2h4" />
          <path d="M8 13h8M8 17h8M8 9h4" />
        </svg>
      );
    case 'privacy':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 3 20 7v6c0 5-3.5 9-8 9s-8-4-8-9V7l8-4Z" />
          <path d="M9.5 12.5a2.5 2.5 0 0 1 5 0V16h-5v-3.5Z" />
          <path d="M10 16h4" />
        </svg>
      );
    case 'refunds':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    case 'about':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10v6" />
          <path d="M12 7h.01" />
        </svg>
      );
    case 'contact':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3 5.18 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.72c.12.86.33 1.7.62 2.5a2 2 0 0 1-.45 2.11L9.1 10.9a16 16 0 0 0 4 4l1.57-1.07a2 2 0 0 1 2.11-.45c.8.29 1.64.5 2.5.62A2 2 0 0 1 22 16.92Z" />
        </svg>
      );
    case 'reviews':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27Z" />
        </svg>
      );
    case 'subscription_delivery':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case 'categories':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
          <path d="M7 16v2a2 2 0 0 0 2 2h9" />
        </svg>
      );
    case 'coupons':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M21 4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" />
          <path d="M7 8h10M7 12h10M7 16h6" />
        </svg>
      );
    case 'logo':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 9h6v6H9z" />
          <path d="M12 3v18M3 12h18" />
        </svg>
      );
    case 'favicon':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M6 4h8l4 4v12H6z" />
          <path d="M14 4v4h4" />
          <circle cx="12" cy="14" r="2.5" />
        </svg>
      );
    case 'platform_fee':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M6 7h12" />
          <path d="M6 12h8" />
          <path d="M6 17h10" />
          <path d="M17.5 10.5c1.93 0 3.5 1.57 3.5 3.5s-1.57 3.5-3.5 3.5S14 15.93 14 14h3.5" />
        </svg>
      );
    case 'delivery_rates':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
          <path d="M16 17h5" />
          <path d="M18.5 14.5v5" />
        </svg>
      );
    case 'help_support':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      );
    case 'app_download':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="6" y="2" width="12" height="20" rx="2" />
          <path d="M9 18h6" />
          <path d="M12 14v-4M10 12l2-2 2 2" />
        </svg>
      );
    case 'coming_soon':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'gifting':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <polyline points="20 12 20 22 4 22 4 12" />
          <rect x="2" y="7" width="20" height="5" />
          <line x1="12" y1="22" x2="12" y2="7" />
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
        </svg>
      );
    case 'cod':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 3v18M3 12h18" />
        </svg>
      );
  }
}

function IconBadge({ type }: { type: string }) {
  return (
    <div className={styles.cardIcon} aria-hidden="true">
      <Icon name={type} />
    </div>
  );
}

/**
 * Admin Content Management Page
 * Manage all site content (Terms, Privacy, About, Contact, Reviews)
 */
export default function AdminContentPage() {
  const router = useRouter();
  const [contentList, setContentList] = useState<SiteContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [comingSoonToggling, setComingSoonToggling] = useState(false);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const data = await adminContentApi.getAll();
      setContentList(data);
    } catch (error) {
      console.error('Failed to fetch content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (type: string) => {
    router.push(`/admin/content/${type}`);
  };

  const comingSoon = contentList.find((c) => c.contentType === 'coming_soon');
  const comingSoonEnabled = comingSoon?.isActive ?? false;

  const handleComingSoonToggle = async () => {
    setComingSoonToggling(true);
    try {
      await adminContentApi.toggleStatus('coming_soon', !comingSoonEnabled);
      await fetchContent();
    } catch (error) {
      console.error('Failed to toggle Coming Soon mode:', error);
    } finally {
      setComingSoonToggling(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '50vh',
        padding: '2rem'
      }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={adminStyles.adminPageTitle}>Manage Site Content & Settings</h1>

      <div className={styles.contentGrid}>
        {CONTENT_TYPES.map((contentType) => {
          const content = contentList.find(c => c.contentType === contentType.type);
          const isActive = content?.isActive ?? false;
          const lastUpdated = content?.updatedAt 
            ? new Date(content.updatedAt).toLocaleDateString()
            : 'Never';

          return (
            <div key={contentType.type} className={styles.contentCard}>
              <div className={styles.cardHeader}>
                <IconBadge type={contentType.type} />
                <div>
                  <h3 className={styles.cardTitle}>{contentType.label}</h3>
                  <div className={styles.cardMeta}>
                    <span className={isActive ? styles.activeBadge : styles.inactiveBadge}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className={styles.lastUpdated}>Updated: {lastUpdated}</span>
                  </div>
                </div>
              </div>
              <div className={styles.cardActions}>
                <button
                  onClick={() => handleEdit(contentType.type)}
                  className={styles.editButton}
                >
                  Edit
                </button>
                {contentType.path ? (
                  <a
                    href={contentType.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.viewButton}
                  >
                    View
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
        {OTHER_OPTIONS.map((option) => (
          <div key={option.type} className={styles.contentCard}>
            <div className={styles.cardHeader}>
              <IconBadge type={option.type} />
              <div>
                <h3 className={styles.cardTitle}>{option.label}</h3>
                <div className={styles.cardMeta}>
                  <span className={styles.lastUpdated}>{option.description || 'Manage'}</span>
                </div>
              </div>
            </div>
            <div className={styles.cardActions}>
              <button
                onClick={() => router.push(option.path)}
                className={styles.editButton}
              >
                Manage
              </button>
            </div>
          </div>
        ))}

        {/* Coming Soon Mode — toggle only */}
        <div className={styles.contentCard}>
          <div className={styles.cardHeader}>
            <IconBadge type="coming_soon" />
            <div>
              <h3 className={styles.cardTitle}>Coming Soon Mode</h3>
              <div className={styles.cardMeta}>
                <span className={comingSoonEnabled ? styles.activeBadge : styles.inactiveBadge}>
                  {comingSoonEnabled ? 'On' : 'Off'}
                </span>
                <span className={styles.lastUpdated}>
                  {comingSoon !== undefined
                    ? 'Show "We are coming" page to customers. Admins bypass via password.'
                    : 'Run DB migration: add_coming_soon_site_content.sql'}
                </span>
              </div>
            </div>
          </div>
          <div className={styles.cardActions}>
            <button
              type="button"
              className={styles.toggleButton}
              onClick={handleComingSoonToggle}
              disabled={comingSoonToggling || comingSoon === undefined}
            >
              {comingSoonToggling ? 'Updating…' : comingSoonEnabled ? 'Turn off' : 'Turn on'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin/content/coming_soon')}
              className={styles.editButton}
              style={{ marginLeft: '8px' }}
            >
              Edit Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
