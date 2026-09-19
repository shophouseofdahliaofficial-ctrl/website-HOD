'use client';

export const runtime = 'edge';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminContentApi, adminProductsApi, SiteContent } from '@/lib/api';
import { Product } from '@/types';
import LoadingSpinner, { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import RichTextEditor from '@/components/ui/RichTextEditor';
import adminStyles from '../../admin-styles.module.css';
import styles from './edit.module.css';
import {
  DEFAULT_DELIVERY_TIME_OFF_BODY,
  DEFAULT_DELIVERY_TIME_OFF_TITLE,
} from '@/lib/utils/deliveryTimeOff';

const CONTENT_TYPE_LABELS: Record<string, string> = {
  terms: 'Terms & Conditions',
  privacy: 'Privacy Policy',
  about: 'About Us',
  contact: 'Contact Details',
  reviews: 'Reviews Settings',
  subscription_delivery: 'Subscription Delivery',
  help_support: 'Help support number',
  app_download: 'Download our App',
  homepage_products: 'Homepage Products Rows',
  platform_fee: 'Platform fees',
  delivery_rates: 'Delivery rates',
  delivery_time_off: 'Delivery time off',
  coming_soon: 'Coming Soon Settings',
  'coming-soon': 'Coming Soon Settings',
  photobooth_links: 'Photobooth settings',
};

/**
 * Admin Content Edit Page
 * Edit specific content type
 */
export default function AdminContentEditPage() {
  const params = useParams();
  const router = useRouter();
  const contentType = params.type as string;

  useEffect(() => {
    if (contentType === 'pincodes') {
      router.replace('/admin/content/subscription_delivery');
    }
  }, [contentType, router]);

  const [content, setContent] = useState<SiteContent | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [contentText, setContentText] = useState('');
  const [metadata, setMetadata] = useState<Record<string, any>>({});
  const [isActive, setIsActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [serviceablePincodes, setServiceablePincodes] = useState<string[]>([]);
  const [newPincodeInput, setNewPincodeInput] = useState('');
  const [deliveryTimeSlots, setDeliveryTimeSlots] = useState<Array<{ label: string; value: string; end?: string }>>([
    { label: '06:00 AM - 09:00 AM', value: '06:00', end: '09:00' },
    { label: '05:00 PM - 08:00 PM', value: '17:00', end: '20:00' },
  ]);
  const [deliveryRateRows, setDeliveryRateRows] = useState<Array<{ startMeters: string; endMeters: string; rate: string }>>([]);
  const [newSlotValue, setNewSlotValue] = useState('06:00');
  const [newSlotEnd, setNewSlotEnd] = useState('09:00');

  const formatTime12h = (hhmm: string): string => {
    const [hRaw, mRaw] = String(hhmm || '').split(':');
    const h = Number(hRaw);
    const m = Number(mRaw);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
  };

  const buildRangeLabel = (start: string, end: string): string =>
    `${formatTime12h(start)} - ${formatTime12h(end)}`;

  useEffect(() => {
    fetchContent();
  }, [contentType]);

  useEffect(() => {
    if (contentType === 'photobooth_links') {
      const fetchProducts = async () => {
        try {
          const prodList = await adminProductsApi.getAll();
          setProducts(prodList || []);
        } catch (err) {
          console.error('Failed to fetch products:', err);
        }
      };
      void fetchProducts();
    }
  }, [contentType]);

  const sortedActiveProducts = useMemo(() => {
    return [...products]
      .filter(p => p.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const data = await adminContentApi.getByType(contentType);
      setContent(data);
      setTitle(data.title);
      setContentText(data.content);
      setMetadata(data.metadata || {});
      setIsActive(data.isActive);
      if (contentType === 'photobooth_links') {
        setMetadata({
          polaroidsUrl: data.metadata?.polaroidsUrl ?? '',
          photostripsUrl: data.metadata?.photostripsUrl ?? '',
          polaroidsCoverProductId: data.metadata?.polaroidsCoverProductId ?? '',
          photostripsCoverProductId: data.metadata?.photostripsCoverProductId ?? '',
          polaroidsPromoProductId: data.metadata?.polaroidsPromoProductId ?? '',
          photostripsPromoProductId: data.metadata?.photostripsPromoProductId ?? '',
        });
      }
      if (contentType === 'platform_fee') {
        const metadataAmount = Number(data.metadata?.amount);
        const titleAmount = Number(data.title);
        const resolvedAmount = Number.isFinite(metadataAmount)
          ? metadataAmount
          : Number.isFinite(titleAmount)
            ? titleAmount
            : 0;
        setTitle(String(resolvedAmount));
        setContentText('Flat platform fee charged once per order.');
        setMetadata({ ...(data.metadata || {}), amount: resolvedAmount });
      }
      if (contentType === 'delivery_rates') {
        const rows = Array.isArray(data.metadata?.ranges) && data.metadata.ranges.length > 0
          ? data.metadata.ranges.map((row: any) => ({
            startMeters: String(row?.startMeters ?? ''),
            endMeters: String(row?.endMeters ?? ''),
            rate: String(row?.rate ?? ''),
          }))
          : [{ startMeters: '0', endMeters: '1000', rate: '0' }];
        setTitle('Delivery rates');
        setContentText('Distance-based delivery charges from warehouse to customer.');
        setMetadata({
          warehouseLatitude: data.metadata?.warehouseLatitude ?? '',
          warehouseLongitude: data.metadata?.warehouseLongitude ?? '',
          adminPincode: data.metadata?.adminPincode ?? '',
          ranges: data.metadata?.ranges ?? [],
        });
        setDeliveryRateRows(rows);
      }
      if (contentType === 'delivery_time_off') {
        const meta = data.metadata || {};
        setTitle((data.title || '').trim() || DEFAULT_DELIVERY_TIME_OFF_TITLE);
        setContentText((data.content || '').trim() || DEFAULT_DELIVERY_TIME_OFF_BODY);
        setMetadata({
          enabled: meta.enabled === true,
          cutoffTime: typeof meta.cutoffTime === 'string' && /^\d{1,2}:\d{2}$/.test(meta.cutoffTime.trim())
            ? meta.cutoffTime.trim()
            : '22:00',
        });
      }
      if (contentType === 'subscription_delivery') {
        const meta = data.metadata || {};
        const parsedServiceablePincodes = Array.isArray(meta.serviceablePincodes)
          ? meta.serviceablePincodes
            .map((entry: any) => (typeof entry === 'string' ? entry : entry?.pincode))
            .map((pin: any) => String(pin || '').trim())
            .filter((pin: string) => /^\d{6}$/.test(pin))
          : [];
        setServiceablePincodes(Array.from(new Set(parsedServiceablePincodes)));
        if (Array.isArray(meta.deliveryTimeSlots) && meta.deliveryTimeSlots.length > 0) {
          const parsedSlots = meta.deliveryTimeSlots
            .map((slot: any) => ({
              label: (slot?.label || '').toString().trim(),
              value: (slot?.value || '').toString().trim(),
              end: (slot?.end || '').toString().trim(),
            }))
            .filter((slot: { label: string; value: string }) => slot.label && slot.value);
          setDeliveryTimeSlots(
            parsedSlots.length > 0
              ? parsedSlots
              : [
                { label: '06:00 AM - 09:00 AM', value: '06:00', end: '09:00' },
                { label: '05:00 PM - 08:00 PM', value: '17:00', end: '20:00' },
              ]
          );
        } else {
          setDeliveryTimeSlots([
            { label: '06:00 AM - 09:00 AM', value: '06:00', end: '09:00' },
            { label: '05:00 PM - 08:00 PM', value: '17:00', end: '20:00' },
          ]);
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch content:', error);
      // If this content type doesn't exist yet, allow creating it from the UI
      if (contentType === 'subscription_delivery') {
        setError('');
        setContent(null);
        setTitle('Pincode Settings');
        setContentText('Delivery pincode settings');
        setMetadata({
          serviceablePincodes: [],
          deliveryTimeSlots: [
            { label: '06:00 AM - 09:00 AM', value: '06:00', end: '09:00' },
            { label: '05:00 PM - 08:00 PM', value: '17:00', end: '20:00' },
          ],
        });
        setServiceablePincodes([]);
        setDeliveryTimeSlots([
          { label: '06:00 AM - 09:00 AM', value: '06:00', end: '09:00' },
          { label: '05:00 PM - 08:00 PM', value: '17:00', end: '20:00' },
        ]);
        setIsActive(true);
      } else if (contentType === 'help_support') {
        setError('');
        setContent(null);
        setTitle('Help support number');
        setContentText('Support contact for Need help button.');
        setMetadata({ helpSupportNumber: '' });
        setIsActive(true);
      } else if (contentType === 'app_download') {
        setError('');
        setContent(null);
        setTitle('Download our App');
        setContentText('Mobile app store link for Account page.');
        setMetadata({ downloadAppUrl: '' });
        setIsActive(true);
      } else if (contentType === 'homepage_products') {
        setError('');
        setContent(null);
        setTitle('Homepage Products Rows');
        setContentText('Homepage products section settings.');
        setMetadata({ rows: 1 });
        setIsActive(true);
      } else if (contentType === 'platform_fee') {
        setError('');
        setContent(null);
        setTitle('0');
        setContentText('Flat platform fee charged once per order.');
        setMetadata({ amount: 0 });
        setIsActive(true);
      } else if (contentType === 'delivery_rates') {
        setError('');
        setContent(null);
        setTitle('Delivery rates');
        setContentText('Distance-based delivery charges from warehouse to customer.');
        setMetadata({ warehouseLatitude: '', warehouseLongitude: '', ranges: [] });
        setDeliveryRateRows([{ startMeters: '0', endMeters: '1000', rate: '0' }]);
        setIsActive(true);
      } else if (contentType === 'delivery_time_off') {
        setError('');
        setContent(null);
        setTitle(DEFAULT_DELIVERY_TIME_OFF_TITLE);
        setContentText(DEFAULT_DELIVERY_TIME_OFF_BODY);
        setMetadata({ enabled: false, cutoffTime: '22:00' });
        setIsActive(true);
      } else if (contentType === 'photobooth_links') {
        setError('');
        setContent(null);
        setTitle('Photobooth settings');
        setContentText('Configure redirect links, cover images, and promo card placements for Polaroids and Photostrips');
        setMetadata({
          polaroidsUrl: '',
          photostripsUrl: '',
          polaroidsCoverProductId: '',
          photostripsCoverProductId: '',
          polaroidsPromoProductId: '',
          photostripsPromoProductId: '',
        });
        setIsActive(true);
      } else if (contentType === 'coming_soon' || contentType === 'coming-soon') {
        setError('');
        setContent(null);
        setTitle('Scribble is coming soon!');
        setContentText('We’re working behind the scenes to bring you 100% pure, chemical-free milk and dairy products.');
        setMetadata({ imageUrl: '', imagePublicId: '', waitingCount: 0 });
        setIsActive(true);
      } else {
        setError(error.message || 'Failed to load content');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      let finalMetadata = { ...metadata };

      if ((contentType === 'coming_soon' || contentType === 'coming-soon') && imageFile) {
        try {
          const fd = new FormData();
          fd.append('image', imageFile);
          const uploadedContent = await adminContentApi.uploadImage(contentType, fd);
          finalMetadata = {
            ...finalMetadata,
            imageUrl: uploadedContent.metadata?.imageUrl || '',
            imagePublicId: uploadedContent.metadata?.imagePublicId || '',
          };
        } catch (uploadErr: any) {
          setError(uploadErr.message || 'Image upload failed.');
          setSaving(false);
          return;
        }
      }

      // Handle contact-specific fields
      if (contentType === 'contact') {
        finalMetadata = {
          email: metadata.email || '',
          phone: metadata.phone || '',
          address: metadata.address || '',
        };
      }

      // Handle reviews-specific fields
      if (contentType === 'reviews') {
        finalMetadata = {
          allowPublicReviews: metadata.allowPublicReviews ?? true,
          requireApproval: metadata.requireApproval ?? true,
          trustpilotUrl: (metadata.trustpilotUrl || '').toString().trim(),
          googleReviewUrl: (metadata.googleReviewUrl || '').toString().trim(),
        };
      }

      // Handle subscription delivery slots
      if (contentType === 'subscription_delivery') {
        const validPincodes = Array.from(
          new Set(
            serviceablePincodes
              .map((pin) => String(pin || '').trim())
              .filter((pin) => pin.length > 0)
          )
        );
        const invalid = validPincodes.filter((pin) => !/^\d{6}$/.test(pin));
        if (invalid.length > 0) {
          setError('All Serviceable Pincodes must be exactly 6 digits.');
          return;
        }
        const validSlots = deliveryTimeSlots
          .map((slot) => ({
            value: (slot.value || '').toString().trim(),
            end: (slot.end || '').toString().trim(),
            label: buildRangeLabel((slot.value || '').toString().trim(), (slot.end || '').toString().trim()),
          }))
          .filter((slot) => slot.label && slot.value && slot.end);

        if (validSlots.length === 0) {
          setError('Please keep at least one delivery time slot.');
          return;
        }

        finalMetadata = { serviceablePincodes: validPincodes, deliveryTimeSlots: validSlots };
      }

      // Handle help_support (Need help button: WhatsApp number or custom link)
      if (contentType === 'help_support') {
        finalMetadata = { helpSupportNumber: (metadata.helpSupportNumber || '').toString().trim() };
      }

      // Handle app_download (Account page store / custom URL)
      if (contentType === 'app_download') {
        const raw = (metadata.downloadAppUrl || '').toString().trim();
        let downloadAppUrl = '';
        if (raw) {
          const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
          try {
            const u = new URL(withScheme);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') {
              setError('Please enter a valid URL (http or https).');
              setSaving(false);
              return;
            }
            downloadAppUrl = u.toString();
          } catch {
            setError('Please enter a valid URL.');
            setSaving(false);
            return;
          }
        }
        finalMetadata = { downloadAppUrl };
      }

      // Handle homepage_products
      if (contentType === 'homepage_products') {
        const raw = Number(metadata.rows);
        const rows = Number.isFinite(raw) ? Math.max(1, Math.min(10, Math.floor(raw))) : 1;
        finalMetadata = { rows };
      }

      if (contentType === 'platform_fee') {
        const raw = Number(title);
        if (!Number.isFinite(raw) || raw < 0) {
          setError('Platform fee must be 0 or more.');
          setSaving(false);
          return;
        }
        finalMetadata = { ...(metadata || {}), amount: Math.round(raw * 100) / 100 };
      }

      if (contentType === 'delivery_rates') {
        const warehouseLatitude = Number(metadata.warehouseLatitude);
        const warehouseLongitude = Number(metadata.warehouseLongitude);
        if (!Number.isFinite(warehouseLatitude) || warehouseLatitude < -90 || warehouseLatitude > 90) {
          setError('Warehouse latitude must be between -90 and 90.');
          setSaving(false);
          return;
        }
        if (!Number.isFinite(warehouseLongitude) || warehouseLongitude < -180 || warehouseLongitude > 180) {
          setError('Warehouse longitude must be between -180 and 180.');
          setSaving(false);
          return;
        }
        const parsedRows = deliveryRateRows.map((row, index) => {
          const startMeters = Number(row.startMeters);
          const endMeters = Number(row.endMeters);
          const rate = Number(row.rate);
          if (!Number.isFinite(startMeters) || startMeters < 0) {
            throw new Error(`Row ${index + 1}: Start distance must be 0 or more.`);
          }
          if (!Number.isFinite(endMeters) || endMeters < 0) {
            throw new Error(`Row ${index + 1}: End distance must be 0 or more.`);
          }
          if (endMeters < startMeters) {
            throw new Error(`Row ${index + 1}: End distance must be greater than or equal to start distance.`);
          }
          if (!Number.isFinite(rate) || rate < 0) {
            throw new Error(`Row ${index + 1}: Delivery rate must be 0 or more.`);
          }
          return {
            startMeters: Math.round(startMeters),
            endMeters: Math.round(endMeters),
            rate: Math.round(rate * 100) / 100,
          };
        });
        if (parsedRows.length === 0) {
          setError('Please add at least one delivery-rate row.');
          setSaving(false);
          return;
        }
        finalMetadata = {
          warehouseLatitude,
          warehouseLongitude,
          adminPincode: (metadata.adminPincode || '').toString().trim(),
          ranges: parsedRows.sort((a, b) => a.startMeters - b.startMeters || a.endMeters - b.endMeters),
        };
      }

      if (contentType === 'delivery_time_off') {
        const cutoffRaw = (metadata.cutoffTime || '22:00').toString().trim();
        if (!/^\d{1,2}:\d{2}$/.test(cutoffRaw)) {
          setError('Cutoff time must be in HH:mm format (24h).');
          setSaving(false);
          return;
        }
        const [ch, cm] = cutoffRaw.split(':').map((x: string) => Number(x));
        if (!Number.isFinite(ch) || !Number.isFinite(cm) || ch < 0 || ch > 23 || cm < 0 || cm > 59) {
          setError('Cutoff time must be a valid time of day.');
          setSaving(false);
          return;
        }
        finalMetadata = {
          enabled: metadata.enabled === true,
          cutoffTime: `${String(ch).padStart(2, '0')}:${String(cm).padStart(2, '0')}`,
        };
      }

      if (contentType === 'photobooth_links') {
        finalMetadata = {
          polaroidsUrl: (metadata.polaroidsUrl || '').toString().trim(),
          photostripsUrl: (metadata.photostripsUrl || '').toString().trim(),
          polaroidsCoverProductId: (metadata.polaroidsCoverProductId || '').toString().trim(),
          photostripsCoverProductId: (metadata.photostripsCoverProductId || '').toString().trim(),
          polaroidsPromoProductId: (metadata.polaroidsPromoProductId || '').toString().trim(),
          photostripsPromoProductId: (metadata.photostripsPromoProductId || '').toString().trim(),
        };
      }

      await adminContentApi.update(contentType, {
        title:
          contentType === 'subscription_delivery'
            ? 'Subscription Delivery Settings'
            : contentType === 'help_support'
              ? 'Help support number'
              : contentType === 'app_download'
                ? 'Download our App'
                : contentType === 'platform_fee'
                  ? String(finalMetadata.amount ?? 0)
                  : contentType === 'delivery_rates'
                    ? 'Delivery rates'
                    : contentType === 'delivery_time_off'
                      ? title.trim() || DEFAULT_DELIVERY_TIME_OFF_TITLE
                      : contentType === 'photobooth_links'
                        ? 'Photobooth settings'
                        : title,
        content:
          contentType === 'subscription_delivery'
            ? 'Subscription delivery settings'
            : contentType === 'help_support'
              ? 'Support contact for Need help button.'
              : contentType === 'app_download'
                ? 'Mobile app store link for Account page.'
                : contentType === 'platform_fee'
                  ? 'Flat platform fee charged once per order.'
                  : contentType === 'delivery_rates'
                    ? 'Distance-based delivery charges from warehouse to customer.'
                    : contentType === 'delivery_time_off'
                      ? contentText.trim() || DEFAULT_DELIVERY_TIME_OFF_BODY
                      : contentType === 'photobooth_links'
                        ? 'Configure links for Polaroids and Photostrips'
                        : contentText,
        metadata: finalMetadata,
      });

      alert('Content saved successfully!');
      router.push('/admin/content');
    } catch (error: any) {
      console.error('Failed to save content:', error);
      setError(error.message || 'Failed to save content');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    try {
      const updated = await adminContentApi.toggleStatus(contentType, !isActive);
      setIsActive(updated.isActive);
      alert(`Content ${updated.isActive ? 'activated' : 'deactivated'} successfully!`);
    } catch (error: any) {
      console.error('Failed to toggle status:', error);
      alert('Failed to update status');
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
        <LoadingSpinnerWithText text="Loading content..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => router.back()} className={styles.backButton}>
          ← Back
        </button>
        <h1 className={adminStyles.adminPageTitle}>
          Edit {CONTENT_TYPE_LABELS[contentType] || contentType}
        </h1>
      </div>

      {error && (
        <div className={styles.errorMessage}>{error}</div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        {contentType !== 'subscription_delivery' && contentType !== 'help_support' && contentType !== 'app_download' && contentType !== 'delivery_rates' && contentType !== 'delivery_time_off' && contentType !== 'coming_soon' && contentType !== 'coming-soon' && contentType !== 'photobooth_links' && (
          <div className={styles.formGroup}>
            <label className={styles.label}>
              {contentType === 'platform_fee' ? 'Platform fee (INR) *' : 'Title *'}
            </label>
            <input
              type={contentType === 'platform_fee' ? 'number' : 'text'}
              min={contentType === 'platform_fee' ? 0 : undefined}
              step={contentType === 'platform_fee' ? '0.01' : undefined}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={styles.input}
              disabled={contentType === 'contact' || contentType === 'reviews'}
            />
            {contentType === 'platform_fee' && (
              <div className={styles.helpText}>
                This flat fee is added once per checkout, regardless of product quantity.
              </div>
            )}
          </div>
        )}

        {contentType === 'delivery_rates' && (
          <>
            <div className={styles.formGroup}>
              <label className={styles.label}>Warehouse latitude *</label>
              <input
                type="number"
                step="any"
                value={metadata.warehouseLatitude ?? ''}
                onChange={(e) => setMetadata({ ...metadata, warehouseLatitude: e.target.value })}
                className={styles.input}
                placeholder="e.g. 22.5726"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Warehouse longitude *</label>
              <input
                type="number"
                step="any"
                value={metadata.warehouseLongitude ?? ''}
                onChange={(e) => setMetadata({ ...metadata, warehouseLongitude: e.target.value })}
                className={styles.input}
                placeholder="e.g. 88.3639"
              />
              <div className={styles.helpText}>
                Customers are charged by the straight-line distance from this warehouse location to the selected checkout address.
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Admin Pincode (Shiprocket Origin) *</label>
              <input
                type="text"
                maxLength={6}
                value={metadata.adminPincode ?? ''}
                onChange={(e) => setMetadata({ ...metadata, adminPincode: e.target.value.replace(/[^\d]/g, '') })}
                className={styles.input}
                placeholder="e.g. 147001"
              />
              <div className={styles.helpText}>
                This pincode is used as the warehouse pickup/origin pincode for calculating nationwide delivery rates from Shiprocket.
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Delivery rate ranges</label>
              <div className={styles.helpText}>
                If a customer distance is above the last row&apos;s end distance, the last row&apos;s delivery rate will be used automatically.
              </div>
              <div className={styles.deliveryRateList}>
                {deliveryRateRows.map((row, index) => (
                  <div key={`rate-${index}`} className={styles.deliveryRateRow}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={styles.input}
                      value={row.startMeters}
                      onChange={(e) => {
                        const next = [...deliveryRateRows];
                        next[index] = { ...next[index], startMeters: e.target.value };
                        setDeliveryRateRows(next);
                      }}
                      placeholder="Start (m)"
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={styles.input}
                      value={row.endMeters}
                      onChange={(e) => {
                        const next = [...deliveryRateRows];
                        next[index] = { ...next[index], endMeters: e.target.value };
                        setDeliveryRateRows(next);
                      }}
                      placeholder="End (m)"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={styles.input}
                      value={row.rate}
                      onChange={(e) => {
                        const next = [...deliveryRateRows];
                        next[index] = { ...next[index], rate: e.target.value };
                        setDeliveryRateRows(next);
                      }}
                      placeholder="Delivery rate (INR)"
                    />
                    <button
                      type="button"
                      className={styles.removePincodeButton}
                      onClick={() => {
                        if (deliveryRateRows.length === 1) return;
                        setDeliveryRateRows(deliveryRateRows.filter((_, rowIndex) => rowIndex !== index));
                      }}
                      disabled={deliveryRateRows.length === 1}
                      aria-label={`Remove delivery rate row ${index + 1}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className={styles.addPincodeButton}
                onClick={() => {
                  setDeliveryRateRows([...deliveryRateRows, { startMeters: '', endMeters: '', rate: '' }]);
                }}
              >
                Add row
              </button>
            </div>
          </>
        )}

        {contentType === 'delivery_time_off' && (
          <>
            <div className={styles.formGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={metadata.enabled === true}
                  onChange={(e) => setMetadata({ ...metadata, enabled: e.target.checked })}
                  className={styles.checkbox}
                />
                Enable delivery time off (modal after cutoff, IST)
              </label>
              <div className={styles.helpText}>
                When enabled and this page is active, customers who tap pay after the cutoff (India time) see a confirmation before COD or Razorpay.
              </div>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Daily cutoff (IST) *</label>
              <input
                type="time"
                value={metadata.cutoffTime || '22:00'}
                onChange={(e) => setMetadata({ ...metadata, cutoffTime: e.target.value })}
                className={styles.input}
                required
              />
              <div className={styles.helpText}>
                From this time onward until midnight IST, the modal appears on final pay (cart checkout, subscription pay, trial pack pay).
              </div>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Modal title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={styles.input}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Modal description *</label>
              <textarea
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                rows={6}
                className={styles.textarea}
                required
              />
            </div>
          </>
        )}

        {contentType === 'contact' && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Email</label>
            <input
              type="email"
              value={metadata.email || ''}
              onChange={(e) => setMetadata({ ...metadata, email: e.target.value })}
              className={styles.input}
            />
          </div>
        )}

        {contentType === 'contact' && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Phone</label>
            <input
              type="tel"
              value={metadata.phone || ''}
              onChange={(e) => setMetadata({ ...metadata, phone: e.target.value })}
              className={styles.input}
            />
          </div>
        )}

        {contentType === 'contact' && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Address</label>
            <textarea
              value={metadata.address || ''}
              onChange={(e) => setMetadata({ ...metadata, address: e.target.value })}
              rows={4}
              className={styles.textarea}
            />
          </div>
        )}

        {contentType === 'reviews' && (
          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={metadata.allowPublicReviews ?? true}
                onChange={(e) => setMetadata({ ...metadata, allowPublicReviews: e.target.checked })}
                className={styles.checkbox}
              />
              Allow Public Reviews
            </label>
          </div>
        )}

        {contentType === 'reviews' && (
          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={metadata.requireApproval ?? true}
                onChange={(e) => setMetadata({ ...metadata, requireApproval: e.target.checked })}
                className={styles.checkbox}
              />
              Require Admin Approval
            </label>
          </div>
        )}

        {contentType === 'reviews' && (
          <>
            <div className={styles.formGroup}>
              <label className={styles.label}>Trustpilot Review URL</label>
              <input
                type="text"
                value={metadata.trustpilotUrl || ''}
                onChange={(e) => setMetadata({ ...metadata, trustpilotUrl: e.target.value })}
                className={styles.input}
                placeholder="e.g. https://www.trustpilot.com/evaluate/yourdomain.com"
              />
              <div className={styles.helpText}>
                The link used for the &quot;Review us&quot; buttons in the header and footer of the website.
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Google Review URL</label>
              <input
                type="text"
                value={metadata.googleReviewUrl || ''}
                onChange={(e) => setMetadata({ ...metadata, googleReviewUrl: e.target.value })}
                className={styles.input}
                placeholder="e.g. https://g.page/r/your-google-review-id/review"
              />
              <div className={styles.helpText}>
                The link used for the &quot;Review Us on Google&quot; button in the footer of the website.
              </div>
            </div>
          </>
        )}

        {contentType === 'help_support' && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Number or link *</label>
            <input
              type="text"
              value={metadata.helpSupportNumber || ''}
              onChange={(e) => setMetadata({ ...metadata, helpSupportNumber: e.target.value })}
              className={styles.input}
              placeholder="e.g. 919876543210 or https://wa.me/919876543210 or https://t.me/username"
            />
            <div className={styles.helpText} style={{ marginTop: '0.5rem' }}>
              Phone with country code (e.g. 919876543210) for WhatsApp, or a full URL (e.g. https://t.me/username) for Telegram or custom app.
            </div>
          </div>
        )}

        {contentType === 'app_download' && (
          <div className={styles.formGroup}>
            <label className={styles.label}>App / store URL</label>
            <input
              type="text"
              value={metadata.downloadAppUrl || ''}
              onChange={(e) => setMetadata({ ...metadata, downloadAppUrl: e.target.value })}
              className={styles.input}
              placeholder="https://play.google.com/store/apps/details?id=..."
            />
            <div className={styles.helpText} style={{ marginTop: '0.5rem' }}>
              Shown on the mobile Account page &quot;Download our App&quot; row. Leave empty to use{' '}
              <code style={{ fontSize: '0.9em' }}>NEXT_PUBLIC_PLAY_STORE_URL</code> or the default Play Store link.
            </div>
          </div>
        )}

        {contentType === 'homepage_products' && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Homepage rows (Our Products)</label>
            <input
              type="number"
              min={1}
              max={10}
              step={1}
              value={metadata.rows ?? 1}
              onChange={(e) => setMetadata({ ...metadata, rows: e.target.value === '' ? 1 : Number(e.target.value) })}
              className={styles.input}
            />
            <div className={styles.helpText}>
              Sets how many rows are shown on the homepage product grid. The shop/products page will still show all products.
            </div>
          </div>
        )}

        {contentType === 'subscription_delivery' ? (
          <div className={styles.formGroup}>
            <label className={styles.label}>Serviceable Pincodes (6 digits)</label>
            {serviceablePincodes.length > 0 && (
              <div className={styles.pincodeList}>
                {serviceablePincodes.map((pin, index) => (
                  <div key={`${pin}-${index}`} className={styles.pincodeItem}>
                    <span className={styles.pincodeValue}>{pin}</span>
                    <button
                      type="button"
                      onClick={() => setServiceablePincodes(serviceablePincodes.filter((x) => x !== pin))}
                      className={styles.removePincodeButton}
                      aria-label={`Remove pincode ${pin}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.addPincodeRow}>
              <input
                type="text"
                inputMode="numeric"
                value={newPincodeInput}
                onChange={(e) => setNewPincodeInput(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                className={styles.input}
                placeholder="6-digit pincode"
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  if (newPincodeInput.length !== 6) return;
                  if (serviceablePincodes.includes(newPincodeInput)) return;
                  setServiceablePincodes([...serviceablePincodes, newPincodeInput]);
                  setNewPincodeInput('');
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (newPincodeInput.length !== 6) return;
                  if (serviceablePincodes.includes(newPincodeInput)) return;
                  setServiceablePincodes([...serviceablePincodes, newPincodeInput]);
                  setNewPincodeInput('');
                }}
                disabled={newPincodeInput.length !== 6 || serviceablePincodes.includes(newPincodeInput)}
                className={styles.addPincodeButton}
              >
                Add
              </button>
            </div>
            <div className={styles.helpText}>
              This list is used only for subscription and trial-subscription checkout. If empty, all pincodes are allowed.
            </div>

            <div className={styles.deliverySlotsBlock}>
              <label className={styles.label}>Subscription delivery slots</label>
              <div className={styles.helpText}>
                These slots appear in the customer subscription page delivery-time dropdown as ranges.
              </div>

              {deliveryTimeSlots.length > 0 && (
                <div className={styles.deliverySlotList}>
                  {deliveryTimeSlots.map((slot, index) => (
                    <div key={`${slot.value}-${index}`} className={styles.deliverySlotItem}>
                      <input
                        type="time"
                        value={slot.value}
                        onChange={(e) => {
                          const next = [...deliveryTimeSlots];
                          next[index] = { ...next[index], value: e.target.value };
                          setDeliveryTimeSlots(next);
                        }}
                        className={styles.deliveryTimeInput}
                      />
                      <input
                        type="time"
                        value={slot.end || ''}
                        onChange={(e) => {
                          const next = [...deliveryTimeSlots];
                          next[index] = { ...next[index], end: e.target.value };
                          setDeliveryTimeSlots(next);
                        }}
                        className={styles.deliveryTimeInput}
                      />
                      <input
                        type="text"
                        value={buildRangeLabel(slot.value, slot.end || slot.value)}
                        readOnly
                        className={styles.input}
                        placeholder="Range"
                      />
                      <button
                        type="button"
                        onClick={() => setDeliveryTimeSlots(deliveryTimeSlots.filter((_, i) => i !== index))}
                        className={styles.removePincodeButton}
                        aria-label={`Remove slot ${slot.label || slot.value}`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.addPincodeRow}>
                <input
                  type="time"
                  value={newSlotValue}
                  onChange={(e) => setNewSlotValue(e.target.value)}
                  className={styles.deliveryTimeInput}
                />
                <input
                  type="time"
                  value={newSlotEnd}
                  onChange={(e) => setNewSlotEnd(e.target.value)}
                  className={styles.deliveryTimeInput}
                />
                <input
                  type="text"
                  value={buildRangeLabel(newSlotValue, newSlotEnd)}
                  readOnly
                  className={styles.input}
                  placeholder="Range"
                />
                <button
                  type="button"
                  onClick={() => {
                    const value = newSlotValue.trim();
                    const end = newSlotEnd.trim();
                    if (!value || !end) return;
                    if (deliveryTimeSlots.some((s) => s.value === value && (s.end || '') === end)) return;
                    setDeliveryTimeSlots([
                      ...deliveryTimeSlots,
                      { label: buildRangeLabel(value, end), value, end },
                    ]);
                  }}
                  disabled={!newSlotValue.trim() || !newSlotEnd.trim()}
                  className={styles.addPincodeButton}
                >
                  Add slot
                </button>
              </div>
            </div>
          </div>
        ) : contentType === 'help_support' || contentType === 'app_download' || contentType === 'platform_fee' || contentType === 'delivery_time_off' || contentType === 'coming_soon' || contentType === 'coming-soon' || contentType === 'photobooth_links' ? null : (
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Content {contentType === 'contact' ? '(Optional)' : '*'}
            </label>
            {contentType === 'contact' ? (
              <textarea
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                rows={4}
                className={styles.textarea}
                placeholder="Additional contact information..."
              />
            ) : (
              <RichTextEditor
                value={contentText}
                onChange={setContentText}
                placeholder="Enter content here..."
              />
            )}
          </div>
        )}

        {contentType === 'photobooth_links' && (
          <>
            <div className={styles.formGroup}>
              <label className={styles.label}>Polaroids Product Link *</label>
              <input
                type="text"
                value={metadata.polaroidsUrl || ''}
                onChange={(e) => setMetadata({ ...metadata, polaroidsUrl: e.target.value })}
                className={styles.input}
                placeholder="e.g. /product/2"
                required
              />
              <div className={styles.helpText}>
                The redirect URL used when a customer builds Polaroid memories in the Photobooth.
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Show Cover Image of Product (Polaroids)</label>
              <select
                value={metadata.polaroidsCoverProductId || ''}
                onChange={(e) => setMetadata({ ...metadata, polaroidsCoverProductId: e.target.value })}
                className={styles.input}
              >
                <option value="">-- No product selected --</option>
                {sortedActiveProducts.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className={styles.helpText}>
                Select which catalog product cover image shows in the customer orders page when keepsake image is not generated.
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Show Promo Card on Product Detail Page (Polaroids)</label>
              <select
                value={metadata.polaroidsPromoProductId || ''}
                onChange={(e) => setMetadata({ ...metadata, polaroidsPromoProductId: e.target.value })}
                className={styles.input}
              >
                <option value="">-- No product selected --</option>
                {sortedActiveProducts.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className={styles.helpText}>
                Select on which product details modal the Polaroids #Photobooth promo card should be shown.
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Photostrips Product Link *</label>
              <input
                type="text"
                value={metadata.photostripsUrl || ''}
                onChange={(e) => setMetadata({ ...metadata, photostripsUrl: e.target.value })}
                className={styles.input}
                placeholder="e.g. /product/4"
                required
              />
              <div className={styles.helpText}>
                The redirect URL used when a customer builds Photostrip memories in the Photobooth.
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Show Cover Image of Product (Photostrips)</label>
              <select
                value={metadata.photostripsCoverProductId || ''}
                onChange={(e) => setMetadata({ ...metadata, photostripsCoverProductId: e.target.value })}
                className={styles.input}
              >
                <option value="">-- No product selected --</option>
                {sortedActiveProducts.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className={styles.helpText}>
                Select which catalog product cover image shows in the customer orders page when keepsake image is not generated.
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Show Promo Card on Product Detail Page (Photostrips)</label>
              <select
                value={metadata.photostripsPromoProductId || ''}
                onChange={(e) => setMetadata({ ...metadata, photostripsPromoProductId: e.target.value })}
                className={styles.input}
              >
                <option value="">-- No product selected --</option>
                {sortedActiveProducts.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className={styles.helpText}>
                Select on which product details modal the Photostrips #Photobooth promo card should be shown.
              </div>
            </div>
          </>
        )}

        {(contentType === 'coming_soon' || contentType === 'coming-soon') && (
          <>
            <div className={styles.formGroup}>
              <label className={styles.label}>Coming Soon Headline *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className={styles.input}
                placeholder="Scribble is coming soon!"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Coming Soon Subtitle *</label>
              <textarea
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                required
                rows={4}
                className={styles.textarea}
                placeholder="e.g. We’re working behind the scenes..."
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Waiting list likes count *</label>
              <input
                type="number"
                min={0}
                step={1}
                value={metadata.waitingCount ?? 0}
                onChange={(e) => setMetadata({ ...metadata, waitingCount: Number(e.target.value) })}
                required
                className={styles.input}
              />
              <div className={styles.helpText}>
                The total number of waitlist requests submitted by customers on the public Coming Soon page.
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Upload Coming Soon Image (Cloudinary)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                  }
                }}
                className={styles.input}
                style={{ padding: '8px' }}
              />
              <p className={styles.helpText}>
                PNG, JPG or WebP. Fit-to-content layout on desktop mode. Previous image will be replaced on save.
              </p>
              {(imagePreview || metadata.imageUrl) && (
                <div style={{ marginTop: '1rem', border: '1px solid rgba(0, 0, 0, 0.08)', borderRadius: '12px', overflow: 'hidden', maxWidth: '280px', maxHeight: '200px' }}>
                  <img
                    src={imagePreview || metadata.imageUrl}
                    alt="Coming soon image preview"
                    style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }}
                  />
                </div>
              )}
            </div>
          </>
        )}

        <div className={styles.formActions}>
          <button
            type="submit"
            disabled={saving}
            className={styles.saveButton}
          >
            {saving ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LoadingSpinner size="small" />
                Saving...
              </span>
            ) : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={handleToggleStatus}
            className={isActive ? styles.deactivateButton : styles.activateButton}
          >
            {isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className={styles.cancelButton}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
