'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { adminBannersApi, Banner, adminContentApi } from '@/lib/api';
import LoadingSpinner, { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import MediaLibraryModal from '@/components/admin/MediaLibraryModal';
import adminStyles from '../admin-styles.module.css';
import styles from './page.module.css';
import { useToast } from '@/contexts/ToastContext';
import { MediaResource } from '@/lib/api';

interface BannerImageItem {
  id: string;
  isExisting?: boolean;
  file: File | null;
  previewUrl: string;
  imagePublicId?: string | null;
  mobileFile: File | null;
  mobilePreviewUrl: string | null;
  mobileImagePublicId?: string | null;
  title?: string;
  link?: string;
  linkTarget?: 'same_tab' | 'new_tab';
}

/**
 * Admin Banners Page
 * Manage homepage banners
 */
export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [desktopDisplayMode, setDesktopDisplayMode] = useState<'swipe' | 'down'>('swipe');
  const [mobileDisplayMode, setMobileDisplayMode] = useState<'swipe' | 'down'>('swipe');
  const [imageItems, setImageItems] = useState<BannerImageItem[]>([]);
  const [submitProgress, setSubmitProgress] = useState<string>('');
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaModalTarget, setMediaModalTarget] = useState<
    | { type: 'bulk_add' }
    | { type: 'desktop'; index: number }
    | { type: 'mobile'; index: number }
    | null
  >(null);
  const [formData, setFormData] = useState({
    title: '',
    link: '',
    linkTarget: 'same_tab' as 'same_tab' | 'new_tab',
    desktopDisplayMode: 'swipe' as 'swipe' | 'down',
    mobileDisplayMode: 'swipe' as 'swipe' | 'down',
    orderIndex: '0',
    isActive: true,
    adaptToFirstImage: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sort, setSort] = useState<'orderAsc' | 'orderDesc' | 'titleAsc' | 'updatedDesc'>('orderAsc');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchExpandRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetchBanners();
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!searchExpanded) return;
    const onDown = (e: MouseEvent) => {
      const el = searchExpandRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      setSearchExpanded(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [searchExpanded]);

  const fetchBanners = async () => {
    try {
      const data = await adminBannersApi.getAll();
      setBanners(data);
    } catch (error) {
      console.error('Failed to fetch banners:', error);
      showToast('Failed to load banners', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await adminContentApi.getByType('banner_settings');
      if (res && res.metadata) {
        const dMode = res.metadata.desktopMode === 'down' ? 'down' : 'swipe';
        const mMode = res.metadata.mobileMode === 'down' ? 'down' : 'swipe';
        setDesktopDisplayMode(dMode);
        setMobileDisplayMode(mMode);
        setFormData((prev) => ({
          ...prev,
          desktopDisplayMode: dMode,
          mobileDisplayMode: mMode,
        }));
      }
    } catch (error) {
      // Default to swipe
    }
  };

  const handleAddDesktopImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: BannerImageItem[] = [];
    Array.from(files).forEach((file) => {
      const previewUrl = URL.createObjectURL(file);
      newItems.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        previewUrl,
        mobileFile: null,
        mobilePreviewUrl: null,
        title: '',
        link: '',
      });
    });

    setImageItems((prev) => [...prev, ...newItems]);
    e.target.value = '';
  };

  const handleChangeItemDesktopImage = (index: number, file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setImageItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        file,
        previewUrl,
      };
      return updated;
    });
  };

  const handleChangeItemMobileImage = (index: number, file: File | null) => {
    setImageItems((prev) => {
      const updated = [...prev];
      if (file) {
        const mobilePreviewUrl = URL.createObjectURL(file);
        updated[index] = {
          ...updated[index],
          mobileFile: file,
          mobilePreviewUrl,
        };
      } else {
        updated[index] = {
          ...updated[index],
          mobileFile: null,
          mobilePreviewUrl: null,
        };
      }
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setImageItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMediaSelect = (selected: MediaResource[] | MediaResource) => {
    const items = Array.isArray(selected) ? selected : [selected];
    if (!mediaModalTarget) return;

    if (mediaModalTarget.type === 'bulk_add') {
      const newItems: BannerImageItem[] = items.map((r) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file: null,
        previewUrl: r.url,
        imagePublicId: r.publicId,
        mobileFile: null,
        mobilePreviewUrl: null,
        title: '',
        link: '',
      }));
      setImageItems((prev) => [...prev, ...newItems]);
    } else if (mediaModalTarget.type === 'desktop') {
      const r = items[0];
      if (r) {
        setImageItems((prev) => {
          const updated = [...prev];
          updated[mediaModalTarget.index] = {
            ...updated[mediaModalTarget.index],
            file: null,
            previewUrl: r.url,
            imagePublicId: r.publicId,
          };
          return updated;
        });
      }
    } else if (mediaModalTarget.type === 'mobile') {
      const r = items[0];
      if (r) {
        setImageItems((prev) => {
          const updated = [...prev];
          updated[mediaModalTarget.index] = {
            ...updated[mediaModalTarget.index],
            mobileFile: null,
            mobilePreviewUrl: r.url,
            mobileImagePublicId: r.publicId,
          };
          return updated;
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (imageItems.length === 0) {
      showToast('Please add at least one desktop banner image', 'error');
      return;
    }

    setSubmitting(true);
    setSubmitProgress(editingBanner ? 'Updating banner...' : 'Creating banner...');

    try {
      const imagesPayload = imageItems.map((item, idx) => ({
        id: item.id || `img_${idx}`,
        imageUrl: item.previewUrl || '',
        imagePublicId: item.imagePublicId || undefined,
        mobileImageUrl: item.mobilePreviewUrl || null,
        mobileImagePublicId: item.mobileImagePublicId || null,
        title: item.title || '',
        link: item.link || '',
        linkTarget: formData.linkTarget || 'same_tab',
      }));

      const primaryImage = imagesPayload[0] || {};

      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title || primaryImage.title || '');
      formDataToSend.append('description', editingBanner?.description || '');
      formDataToSend.append('link', formData.link || primaryImage.link || '');
      formDataToSend.append('linkTarget', formData.linkTarget);
      formDataToSend.append('orderIndex', formData.orderIndex || '0');
      formDataToSend.append('isActive', formData.isActive.toString());
      formDataToSend.append('adaptToFirstImage', formData.adaptToFirstImage.toString());
      formDataToSend.append('desktopDisplayMode', formData.desktopDisplayMode);
      formDataToSend.append('mobileDisplayMode', formData.mobileDisplayMode);
      formDataToSend.append('images', JSON.stringify(imagesPayload));
      formDataToSend.append('imageUrl', primaryImage.imageUrl || '');
      if (primaryImage.imagePublicId) {
        formDataToSend.append('imagePublicId', primaryImage.imagePublicId);
      }
      if (primaryImage.mobileImageUrl) {
        formDataToSend.append('mobileImageUrl', primaryImage.mobileImageUrl);
      }
      if (primaryImage.mobileImagePublicId) {
        formDataToSend.append('mobileImagePublicId', primaryImage.mobileImagePublicId);
      }

      if (editingBanner) {
        await adminBannersApi.update(editingBanner.id, formDataToSend);
        showToast('Banner updated successfully', 'success');
      } else {
        await adminBannersApi.create(formDataToSend);
        showToast('Banner created successfully', 'success');
      }

      // Reset form
      setFormData({
        title: '',
        link: '',
        linkTarget: 'same_tab',
        desktopDisplayMode: 'swipe',
        mobileDisplayMode: 'swipe',
        orderIndex: '0',
        isActive: true,
        adaptToFirstImage: false,
      });
      setImageItems([]);
      setShowForm(false);
      setEditingBanner(null);
      fetchBanners();
    } catch (error: any) {
      console.error('Failed to save banner:', error);
      showToast(error.message || 'Failed to save banner', 'error');
    } finally {
      setSubmitting(false);
      setSubmitProgress('');
    }
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    
    let loadedItems: BannerImageItem[] = [];
    if (banner.images && banner.images.length > 0) {
      loadedItems = banner.images.map((img, idx) => ({
        id: img.id || `${banner.id}-${idx}`,
        isExisting: true,
        file: null,
        previewUrl: img.imageUrl,
        imagePublicId: img.imagePublicId,
        mobileFile: null,
        mobilePreviewUrl: img.mobileImageUrl || null,
        mobileImagePublicId: img.mobileImagePublicId,
        title: img.title || '',
        link: img.link || '',
      }));
    } else {
      loadedItems = [
        {
          id: banner.id,
          isExisting: true,
          file: null,
          previewUrl: banner.imageUrl,
          imagePublicId: banner.imagePublicId,
          mobileFile: null,
          mobilePreviewUrl: banner.mobileImageUrl || null,
          mobileImagePublicId: banner.mobileImagePublicId,
          title: banner.title || '',
          link: banner.link || '',
        },
      ];
    }

    setImageItems(loadedItems);
    setFormData({
      title: banner.title || '',
      link: banner.link || '',
      linkTarget: banner.linkTarget || 'same_tab',
      desktopDisplayMode: banner.desktopDisplayMode || 'swipe',
      mobileDisplayMode: banner.mobileDisplayMode || 'swipe',
      orderIndex: banner.orderIndex.toString(),
      isActive: banner.isActive,
      adaptToFirstImage: banner.adaptToFirstImage || false,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this banner?')) {
      return;
    }

    try {
      await adminBannersApi.delete(id);
      showToast('Banner deleted successfully', 'success');
      fetchBanners();
    } catch (error) {
      console.error('Failed to delete banner:', error);
      showToast('Failed to delete banner', 'error');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingBanner(null);
    setImageItems([]);
    setFormData({
      title: '',
      link: '',
      linkTarget: 'same_tab',
      desktopDisplayMode,
      mobileDisplayMode,
      orderIndex: '0',
      isActive: true,
      adaptToFirstImage: false,
    });
  };

  const filtered = useMemo(() => {
    return banners
      .filter((b) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (
          (b.title || '').toLowerCase().includes(q) ||
          (b.description || '').toLowerCase().includes(q) ||
          (b.link || '').toLowerCase().includes(q)
        );
      })
      .filter((b) => {
        if (statusFilter === 'all') return true;
        return statusFilter === 'active' ? b.isActive : !b.isActive;
      })
      .sort((a, b) => {
        if (sort === 'orderAsc') return a.orderIndex - b.orderIndex;
        if (sort === 'orderDesc') return b.orderIndex - a.orderIndex;
        if (sort === 'titleAsc') return (a.title || '').localeCompare(b.title || '');
        // updatedDesc default
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [banners, query, statusFilter, sort]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '50vh',
        padding: '2rem'
      }}>
        <LoadingSpinnerWithText text="Loading banners..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {!showForm && (
        <>
          <div className={styles.headerRow}>
            <div>
              <h1 className={adminStyles.adminPageTitle}>Banners</h1>
              <div className={styles.subtitle}>
                {filtered.length} banner{filtered.length !== 1 ? 's' : ''} shown
                {banners.length !== filtered.length ? ` (filtered from ${banners.length})` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingBanner(null);
                setImageItems([]);
                setFormData({
                  title: '',
                  link: '',
                  linkTarget: 'same_tab',
                  desktopDisplayMode,
                  mobileDisplayMode,
                  orderIndex: '0',
                  isActive: true,
                  adaptToFirstImage: false,
                });
                setShowForm(true);
              }}
              className={`${adminStyles.adminButton} ${styles.addBannerDesktop}`}
            >
              Add Banner
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingBanner(null);
                setImageItems([]);
                setFormData({
                  title: '',
                  link: '',
                  linkTarget: 'same_tab',
                  desktopDisplayMode,
                  mobileDisplayMode,
                  orderIndex: '0',
                  isActive: true,
                  adaptToFirstImage: false,
                });
                setShowForm(true);
              }}
              className={styles.addBannerIconLink}
              aria-label="Add new banner"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className={`${styles.toolbar} ${searchExpanded ? styles.toolbarSearchExpanded : ''}`}>
            <div className={styles.searchSlot} ref={searchExpandRef}>
              <div className={styles.searchWrap}>
                <span className={styles.searchIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.5-3.5" />
                  </svg>
                </span>
                <input
                  className={styles.searchInput}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setSearchExpanded(true)}
                  placeholder="Search by title, description, or link…"
                  aria-label="Search banners"
                />
              </div>
            </div>

            <div className={styles.filterSlot}>
              <CustomSelect<'all' | 'active' | 'inactive'>
                value={statusFilter}
                onChange={setStatusFilter}
                modalTitle="Status"
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
              />

              <CustomSelect<'orderAsc' | 'orderDesc' | 'titleAsc' | 'updatedDesc'>
                value={sort}
                onChange={setSort}
                modalTitle="Sort"
                options={[
                  { value: 'orderAsc', label: 'Sort: Order (low → high)' },
                  { value: 'orderDesc', label: 'Sort: Order (high → low)' },
                  { value: 'titleAsc', label: 'Sort: Title (A → Z)' },
                  { value: 'updatedDesc', label: 'Sort: Recently updated' },
                ]}
              />
            </div>
          </div>

          <div className={styles.panel}>
            {filtered.length === 0 ? (
              <div className={styles.emptyState}>
                No banners found. Try clearing filters or create a new banner.
              </div>
            ) : (
              <table className={styles.table}>
                <thead className={styles.thead}>
                  <tr>
                    <th className={styles.th}>Banner</th>
                    <th className={styles.th}>Link</th>
                    <th className={styles.th}>Order</th>
                    <th className={styles.th}>Status</th>
                    <th className={styles.th} style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((banner) => (
                    <tr key={banner.id} className={styles.row}>
                      <td className={styles.td}>
                        <div className={styles.bannerCell}>
                          <div className={styles.thumb}>
                            {banner.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={banner.imageUrl} alt={banner.title || 'Banner'} />
                            ) : (
                              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>No image</span>
                            )}
                          </div>
                          <div>
                            <div className={styles.bannerName}>{banner.title || '(No title)'}</div>
                            {banner.description && (
                              <div className={styles.bannerMeta}>{banner.description}</div>
                            )}
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                              <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', background: '#f1f5f9', borderRadius: '4px', color: '#334155', fontWeight: 600 }}>
                                {banner.images && banner.images.length > 0 ? `${banner.images.length} photo${banner.images.length > 1 ? 's' : ''}` : '1 photo'}
                              </span>
                              <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', background: '#e0f2fe', borderRadius: '4px', color: '#0369a1', fontWeight: 500 }}>
                                Desktop: {banner.desktopDisplayMode === 'down' ? 'Down' : 'Swipe'}
                              </span>
                              <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', background: '#fef3c7', borderRadius: '4px', color: '#92400e', fontWeight: 500 }}>
                                Mobile: {banner.mobileDisplayMode === 'down' ? 'Down' : 'Swipe'}
                              </span>
                              {banner.mobileImageUrl && (
                                <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', background: '#f3e8ff', borderRadius: '4px', color: '#6b21a8', fontWeight: 500 }}>
                                  📱 Has mobile image
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={styles.td}>
                        {banner.link ? (
                          <a 
                            href={banner.link} 
                            target={banner.linkTarget === 'new_tab' ? '_blank' : '_self'}
                            rel={banner.linkTarget === 'new_tab' ? 'noopener noreferrer' : undefined}
                            className={styles.linkUrl}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {banner.link.length > 30 ? `${banner.link.substring(0, 30)}...` : banner.link}
                          </a>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td className={styles.td}>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{banner.orderIndex}</span>
                      </td>
                      <td className={styles.td}>
                        <span className={`${styles.badge} ${banner.isActive ? styles.badgeActive : styles.badgeInactive}`}>
                          {banner.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <div className={styles.actions}>
                          <button
                            onClick={() => handleEdit(banner)}
                            className={styles.linkButton}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(banner.id)}
                            className={`${styles.linkButton} ${styles.deleteButton}`}
                            aria-label="Delete banner"
                            title="Delete banner"
                          >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={styles.cards}>
            {filtered.length === 0 ? (
              <div className={styles.card}>
                <div className={styles.emptyState} style={{ padding: '1rem' }}>
                  No banners found.
                </div>
              </div>
            ) : (
              filtered.map((banner) => (
                <div className={styles.card} key={banner.id}>
                  <div className={styles.cardTop}>
                    <div className={styles.cardTitleRow}>
                      <div className={styles.thumb}>
                        {banner.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={banner.imageUrl} alt={banner.title || 'Banner'} />
                        ) : (
                          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>No image</span>
                        )}
                      </div>
                      <div>
                        <div className={styles.bannerName}>{banner.title || '(No title)'}</div>
                        {banner.description ? (
                          <div className={styles.bannerMeta}>{banner.description}</div>
                        ) : null}
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                          <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', background: '#f1f5f9', borderRadius: '4px', color: '#334155', fontWeight: 600 }}>
                            {banner.images && banner.images.length > 0 ? `${banner.images.length} photos` : '1 photo'}
                          </span>
                          <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', background: '#fef3c7', borderRadius: '4px', color: '#92400e', fontWeight: 500 }}>
                            Mobile: {banner.mobileDisplayMode === 'down' ? 'Down' : 'Swipe'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className={`${styles.badge} ${banner.isActive ? styles.badgeActive : styles.badgeInactive}`}>
                      {banner.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.kv}>
                      <div className={styles.kvLabel}>LINK</div>
                      <div className={styles.kvValue}>
                        {banner.link ? (
                          <a
                            href={banner.link}
                            target={banner.linkTarget === 'new_tab' ? '_blank' : '_self'}
                            rel={banner.linkTarget === 'new_tab' ? 'noopener noreferrer' : undefined}
                            className={styles.cardLink}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {banner.link.length > 42 ? `${banner.link.substring(0, 42)}…` : banner.link}
                          </a>
                        ) : (
                          <span style={{ color: '#94a3b8', fontWeight: 600 }}>—</span>
                        )}
                      </div>
                    </div>
                    <div className={styles.kv}>
                      <div className={styles.kvLabel}>ORDER</div>
                      <div className={styles.kvValue}>{banner.orderIndex}</div>
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    <button type="button" onClick={() => handleEdit(banner)} className={styles.linkButton}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(banner.id)}
                      className={`${styles.linkButton} ${styles.deleteButton}`}
                      aria-label="Delete banner"
                      title="Delete banner"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {showForm && (
        <div className={styles.formPanel}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>
              {editingBanner ? 'Edit Banner' : 'Add New Banner'}
            </h2>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handleCancel();
              }}
              className={styles.backLink}
            >
              ← Back to Banners
            </a>
          </div>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Title (optional)</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={styles.input}
                placeholder="Banner title"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Link URL (optional)</label>
              <input
                type="url"
                value={formData.link}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                placeholder="https://example.com or /products"
                className={styles.input}
              />
              <div className={styles.helpText}>
                If provided, the banner will be clickable and redirect to this URL
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Open Link In</label>
              <select
                value={formData.linkTarget}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    linkTarget: e.target.value as 'same_tab' | 'new_tab',
                  })
                }
                className={styles.input}
              >
                <option value="same_tab">Same tab</option>
                <option value="new_tab">New tab</option>
              </select>
              <div className={styles.helpText}>
                Choose whether clicking the banner opens in the same tab or a new tab.
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Banner Images {imageItems.length === 0 && '*'}
              </label>
              <div className={styles.helpText} style={{ marginBottom: '0.75rem' }}>
                Upload desktop banner images (and optional mobile versions) or pick from Cloudinary. You can select multiple images at once to create multiple banners in bulk.
              </div>

              {/* Multiple Image Items List */}
              {imageItems.length > 0 && (
                <div className={styles.multiImageContainer}>
                  {imageItems.map((item, index) => (
                    <div className={styles.imageItemCard} key={item.id}>
                      <div className={styles.imageItemHeader}>
                        <span className={styles.imageItemBadge}>
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                          </svg>
                          {editingBanner && index === 0 && item.isExisting
                            ? 'Current Banner'
                            : `Banner #${index + 1}`}
                        </span>
                        {(imageItems.length > 1 || !item.isExisting) && (
                          <button
                            type="button"
                            className={styles.imageItemRemoveBtn}
                            onClick={() => handleRemoveItem(index)}
                            title="Remove this banner image"
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Remove
                          </button>
                        )}
                      </div>

                      <div className={styles.imageItemGrid}>
                        {/* Desktop Image Slot */}
                        <div className={styles.imageSlot}>
                          <span className={styles.imageSlotLabel}>
                            🖥️ Desktop Image (required)
                          </span>
                          <div className={styles.imageSlotPreview}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.previewUrl} alt={`Desktop ${index + 1}`} />
                            <div style={{ position: 'absolute', bottom: '8px', right: '8px', display: 'flex', gap: '0.4rem' }}>
                              <button
                                type="button"
                                className={styles.imageSlotChangeBtn}
                                style={{ background: '#0070f3' }}
                                onClick={() => {
                                  setMediaModalTarget({ type: 'desktop', index });
                                  setMediaModalOpen(true);
                                }}
                              >
                                Change Image
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Mobile Image Slot */}
                        <div className={styles.imageSlot}>
                          <span className={styles.imageSlotLabel}>
                            📱 Mobile Image (optional)
                          </span>
                          {item.mobilePreviewUrl ? (
                            <div className={styles.imageSlotPreview}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={item.mobilePreviewUrl} alt={`Mobile ${index + 1}`} />
                              <div style={{ position: 'absolute', bottom: '8px', right: '8px', display: 'flex', gap: '0.4rem' }}>
                                <button
                                  type="button"
                                  className={styles.imageSlotChangeBtn}
                                  style={{ background: '#0070f3' }}
                                  onClick={() => {
                                    setMediaModalTarget({ type: 'mobile', index });
                                    setMediaModalOpen(true);
                                  }}
                                >
                                  Change Image
                                </button>
                                <button
                                  type="button"
                                  className={styles.imageSlotChangeBtn}
                                  style={{ background: 'rgba(239, 68, 68, 0.85)' }}
                                  onClick={() => handleChangeItemMobileImage(index, null)}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className={styles.imageSlotEmpty}
                              style={{ width: '100%', borderStyle: 'dashed', borderColor: '#0070f3', background: '#eff6ff', color: '#0070f3', cursor: 'pointer' }}
                              onClick={() => {
                                setMediaModalTarget({ type: 'mobile', index });
                                setMediaModalOpen(true);
                              }}
                            >
                              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                                <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5" strokeLinecap="round"/>
                              </svg>
                              <span>+ Add Mobile Image</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Media Library picker for adding new / more images */}
              <div style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className={styles.addMoreImagesBtn}
                  style={{
                    width: '100%',
                    background: '#0070f3',
                    color: '#ffffff',
                    borderColor: '#0070f3',
                    padding: imageItems.length === 0 ? '0.85rem 1.25rem' : '0.75rem 1.25rem',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                  }}
                  onClick={() => {
                    setMediaModalTarget({ type: 'bulk_add' });
                    setMediaModalOpen(true);
                  }}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.25">
                    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 12v9m0-9l-3 3m3-3l3 3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {imageItems.length === 0 ? '+ Add from Media Library' : '+ Add More from Media Library'}
                </button>
              </div>
            </div>

            {/* Desktop Banner Display Mode */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Desktop Banner Display Mode
              </label>
              <div className={styles.displayModeOptionGrid}>
                <button
                  type="button"
                  className={`${styles.displayModeCard} ${formData.desktopDisplayMode === 'swipe' ? styles.displayModeCardActive : ''}`}
                  onClick={() => setFormData({ ...formData, desktopDisplayMode: 'swipe' })}
                >
                  <div className={styles.displayModeCardIcon}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 16l-4-4m0 0l4-4m-4 4h18" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M17 8l4 4m0 0l-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className={styles.displayModeCardInfo}>
                    <span className={styles.displayModeCardTitle}>Banner swipe</span>
                    <span className={styles.displayModeCardSub}>Horizontal slide carousel with auto-play</span>
                  </div>
                  {formData.desktopDisplayMode === 'swipe' && (
                    <span className={styles.displayModeCheck}>✓</span>
                  )}
                </button>

                <button
                  type="button"
                  className={`${styles.displayModeCard} ${formData.desktopDisplayMode === 'down' ? styles.displayModeCardActive : ''}`}
                  onClick={() => setFormData({ ...formData, desktopDisplayMode: 'down' })}
                >
                  <div className={styles.displayModeCardIcon}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="4" x2="12" y2="20" strokeLinecap="round"/>
                      <polyline points="18 14 12 20 6 14" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className={styles.displayModeCardInfo}>
                    <span className={styles.displayModeCardTitle}>Banners down one by one</span>
                    <span className={styles.displayModeCardSub}>Vertical list stacked one below another</span>
                  </div>
                  {formData.desktopDisplayMode === 'down' && (
                    <span className={styles.displayModeCheck}>✓</span>
                  )}
                </button>
              </div>
              <div className={styles.helpText}>
                Controls how active banners appear on desktop screens (wider than 768px).
              </div>
            </div>

            {/* Mobile Banner Display Mode */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Mobile Banner Display Mode
              </label>
              <div className={styles.displayModeOptionGrid}>
                <button
                  type="button"
                  className={`${styles.displayModeCard} ${formData.mobileDisplayMode === 'swipe' ? styles.displayModeCardActive : ''}`}
                  onClick={() => setFormData({ ...formData, mobileDisplayMode: 'swipe' })}
                >
                  <div className={styles.displayModeCardIcon}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 16l-4-4m0 0l4-4m-4 4h18" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M17 8l4 4m0 0l-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className={styles.displayModeCardInfo}>
                    <span className={styles.displayModeCardTitle}>Banner swipe</span>
                    <span className={styles.displayModeCardSub}>Horizontal slide carousel with touch swipe</span>
                  </div>
                  {formData.mobileDisplayMode === 'swipe' && (
                    <span className={styles.displayModeCheck}>✓</span>
                  )}
                </button>

                <button
                  type="button"
                  className={`${styles.displayModeCard} ${formData.mobileDisplayMode === 'down' ? styles.displayModeCardActive : ''}`}
                  onClick={() => setFormData({ ...formData, mobileDisplayMode: 'down' })}
                >
                  <div className={styles.displayModeCardIcon}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="4" x2="12" y2="20" strokeLinecap="round"/>
                      <polyline points="18 14 12 20 6 14" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className={styles.displayModeCardInfo}>
                    <span className={styles.displayModeCardTitle}>Banners down one by one</span>
                    <span className={styles.displayModeCardSub}>Vertical list stacked one below another</span>
                  </div>
                  {formData.mobileDisplayMode === 'down' && (
                    <span className={styles.displayModeCheck}>✓</span>
                  )}
                </button>
              </div>
              <div className={styles.helpText}>
                Controls how active banners appear on mobile devices (768px and below).
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Order Index (lower numbers appear first)</label>
              <input
                type="number"
                value={formData.orderIndex}
                onChange={(e) => setFormData({ ...formData, orderIndex: e.target.value })}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className={styles.checkbox}
                />
                Active
              </label>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.adaptToFirstImage}
                  onChange={(e) => setFormData({ ...formData, adaptToFirstImage: e.target.checked })}
                  className={styles.checkbox}
                />
                Adapt to first image
              </label>
              <div className={styles.helpText} style={{ marginLeft: '1.5rem' }}>
                If enabled, the banner container will adapt its height to match the first image&apos;s aspect ratio
              </div>
            </div>

            <div className={styles.formActions}>
              <button
                type="submit"
                disabled={submitting}
                className={styles.saveButton}
              >
                {submitting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <LoadingSpinner size="small" />
                    {submitProgress || 'Saving...'}
                  </span>
                ) : editingBanner ? (
                  'Update Banner'
                ) : (
                  'Create Banner'
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className={styles.cancelButton}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <MediaLibraryModal
        isOpen={mediaModalOpen}
        onClose={() => {
          setMediaModalOpen(false);
          setMediaModalTarget(null);
        }}
        onSelect={handleMediaSelect}
        multiple={mediaModalTarget?.type === 'bulk_add'}
        initialFolder="milko/banners"
        title="Select Banner Image from Cloudinary"
      />
    </div>
  );
}

function CustomSelect<T extends string>({
  value,
  onChange,
  options,
  modalTitle,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string }>;
  modalTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const modalTitleId = useId();

  const selected = options.find((o) => o.value === value) || options[0];
  const useModal = isNarrow;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open || useModal) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, useModal]);

  useEffect(() => {
    if (open && useModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open, useModal]);

  const optionList = options.map((opt) => {
    const isActive = opt.value === value;
    return (
      <button
        key={opt.value}
        type="button"
        role="option"
        aria-selected={isActive}
        className={`${styles.dropdownItem} ${isActive ? styles.dropdownItemActive : ''}`}
        onClick={() => {
          onChange(opt.value);
          setOpen(false);
        }}
      >
        <span>{opt.label}</span>
        {isActive ? <span className={styles.dropdownHint}>Selected</span> : null}
      </button>
    );
  });

  return (
    <div className={styles.selectWrap} ref={ref}>
      <button
        type="button"
        className={styles.selectButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.selectValue}>{selected?.label}</span>
        <span className={styles.selectChevron} aria-hidden="true">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5.5 7.5L10 12l4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && !useModal && (
        <div className={styles.dropdown} role="listbox" aria-label={modalTitle}>
          {optionList}
        </div>
      )}

      {mounted && open && useModal
        ? createPortal(
            <div
              className={styles.selectModalBackdrop}
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                className={styles.selectModalPanel}
                role="dialog"
                aria-modal="true"
                aria-labelledby={modalTitleId}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className={styles.selectModalHeader}>
                  <h2 id={modalTitleId} className={styles.selectModalTitle}>
                    {modalTitle}
                  </h2>
                  <button type="button" className={styles.selectModalClose} aria-label="Close" onClick={() => setOpen(false)}>
                    ×
                  </button>
                </div>
                <div className={styles.selectModalBody} role="listbox" aria-label={modalTitle}>
                  {optionList}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
