'use client';

import { useEffect, useState, useMemo } from 'react';
import { adminCreatorsApi, Creator } from '@/lib/api/creators';
import { adminProductsApi } from '@/lib/api';
import { Product } from '@/types';
import { getPrimaryProductImageUrl } from '@/lib/utils/productImages';
import { useToast } from '@/contexts/ToastContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import styles from './page.module.css';

export default function AdminCreatorsPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCreator, setEditingCreator] = useState<Creator | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [productsTitle, setProductsTitle] = useState('Our Products');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Search & Filter state
  const [tableQuery, setTableQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');

  const { showToast } = useToast();

  // Resolve base URL for page links
  const baseUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.host}/creator/`;
    }
    return 'http://localhost:3000/creator/';
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('[Creators Admin] Fetching data...');
      
      const creatorsData = await adminCreatorsApi.getAll().catch(err => {
        console.error('[Creators Admin] Failed to fetch creators:', err);
        showToast('Failed to fetch creators: ' + (err?.message || 'Unknown error'), 'error');
        return [];
      });

      const productsData = await adminProductsApi.getAll().catch(err => {
        console.error('[Creators Admin] Failed to fetch products:', err);
        showToast('Failed to fetch products: ' + (err?.message || 'Unknown error'), 'error');
        return [];
      });

      console.log('[Creators Admin] Resolved data:', { creators: creatorsData, products: productsData });

      setCreators(creatorsData || []);
      setProducts(productsData || []);
    } catch (error) {
      console.error('[Creators Admin] Error in fetchData:', error);
      showToast('Failed to fetch dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate slug from name if not manually modified (during creation)
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    if (!editingCreator) {
      // Auto slugify: lowercase, replace spaces & special chars with hyphens
      const autoSlug = newName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      setSlug(autoSlug);
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Sanitize slug inputs: allow only lowercase, numbers, and hyphens
    const val = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    setSlug(val);
  };

  const toggleProductSelect = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const selectAllProducts = () => {
    // Select all currently visible filtered products
    const filteredIds = filteredProducts.map((p) => p.id);
    setSelectedProductIds((prev) => {
      const merged = new Set([...prev, ...filteredIds]);
      return Array.from(merged);
    });
  };

  const clearProductSelection = () => {
    setSelectedProductIds([]);
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingCreator(null);
    setName('');
    setSlug('');
    setProductsTitle('Our Products');
    setSelectedProductIds([]);
    setProductQuery('');
  };

  const handleEdit = (creator: Creator) => {
    setEditingCreator(creator);
    setName(creator.name);
    setSlug(creator.slug);
    setProductsTitle(creator.productsTitle || 'Our Products');
    setSelectedProductIds(creator.productIds || []);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string, creatorName: string) => {
    if (!confirm(`Are you sure you want to delete creator "${creatorName}"?`)) {
      return;
    }
    try {
      await adminCreatorsApi.delete(id);
      showToast('Creator deleted successfully', 'success');
      setCreators((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      console.error('Failed to delete creator:', error);
      showToast('Failed to delete creator', 'error');
    }
  };

  const handleCopyLink = async (creatorSlug: string) => {
    const fullUrl = `${baseUrl}${creatorSlug}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      showToast('Link copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy link:', err);
      showToast('Failed to copy link', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast('Creator name is required', 'error');
      return;
    }
    if (!slug.trim()) {
      showToast('Custom link suffix is required', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        productsTitle: productsTitle.trim() || 'Our Products',
        productIds: selectedProductIds
      };

      if (editingCreator) {
        await adminCreatorsApi.update(editingCreator.id, payload);
        showToast('Creator updated successfully', 'success');
      } else {
        await adminCreatorsApi.create(payload);
        showToast('Creator created successfully', 'success');
      }

      await fetchData();
      handleCancel();
    } catch (error) {
      console.error('Failed to save creator:', error);
      showToast(error instanceof Error ? error.message : 'Failed to save creator', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter creators table list
  const filteredCreators = useMemo(() => {
    let result = [...creators];
    if (tableQuery.trim()) {
      const q = tableQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q) ||
          (c.productsTitle || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [creators, tableQuery]);

  // Filter products to select from
  const filteredProducts = useMemo(() => {
    if (!productQuery.trim()) return products;
    const q = productQuery.trim().toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, productQuery]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', minHeight: '50vh', padding: '2rem' }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={adminStyles.adminPageTitle}>Creators Storefronts</h1>
          <p className={styles.subtitle}>
            {isFormOpen
              ? 'Configure custom landing page whitelists for influencers and creators'
              : `${filteredCreators.length} creator${filteredCreators.length !== 1 ? 's' : ''} active`}
          </p>
        </div>
        {!isFormOpen && (
          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className={adminStyles.adminButton}
          >
            Add Creator Link
          </button>
        )}
      </div>

      {isFormOpen && (
        <div className={styles.formPanel}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>
              {editingCreator ? `Edit Storefront: ${editingCreator.name}` : 'New Creator Link'}
            </h2>
            <button type="button" onClick={handleCancel} className={styles.backLink}>
              ← Back to listing
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Creator Name</label>
              <input
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder="e.g. John Doe"
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Custom Link Suffix (Slug)</label>
              <input
                type="text"
                value={slug}
                onChange={handleSlugChange}
                placeholder="e.g. john-doe-deals"
                className={styles.input}
                required
              />
              <div className={styles.linkPreviewBox}>
                <span>
                  Preview: <span className={styles.linkPreview}>{baseUrl}{slug || 'your-suffix'}</span>
                </span>
                {slug && (
                  <button
                    type="button"
                    onClick={() => handleCopyLink(slug)}
                    className={styles.copyIconBtn}
                    title="Copy Link Preview"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Custom Products Page Title</label>
              <input
                type="text"
                value={productsTitle}
                onChange={(e) => setProductsTitle(e.target.value)}
                placeholder="e.g. John's Favorites Selection"
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Select Whitelisted Products ({selectedProductIds.length} selected)</label>
              <div className={styles.productsSelector}>
                <div className={styles.selectorHeader}>
                  <input
                    type="text"
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    placeholder="Search products to whitelist..."
                    className={styles.input}
                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                  />
                  <div className={styles.selectorActions}>
                    <button type="button" onClick={selectAllProducts} className={styles.selectorBtn}>
                      Select Filtered
                    </button>
                    <button type="button" onClick={clearProductSelection} className={styles.selectorBtn}>
                      Clear All
                    </button>
                  </div>
                </div>

                <div className={styles.productsGrid}>
                  {filteredProducts.map((p) => {
                    const isSelected = selectedProductIds.includes(p.id);
                    const coverImg = getPrimaryProductImageUrl(p);
                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleProductSelect(p.id)}
                        className={`${styles.productSelectItem} ${isSelected ? styles.productSelectItemActive : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className={styles.productSelectCheckbox}
                        />
                        <div className={styles.productThumb}>
                          {coverImg ? (
                            <img src={coverImg} alt={p.name} className={styles.productThumbImg} />
                          ) : (
                            <span>🥛</span>
                          )}
                        </div>
                        <span className={styles.productSelectName} title={p.name}>{p.name}</span>
                      </div>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>
                      No matching products found.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.formActions}>
              <button type="submit" className={styles.saveButton} disabled={submitting}>
                {submitting ? 'Saving...' : editingCreator ? 'Update Creator Link' : 'Create Creator Link'}
              </button>
              <button type="button" onClick={handleCancel} className={styles.cancelButton}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {!isFormOpen && (
        <>
          <div style={{ marginBottom: '1.25rem' }}>
            <input
              type="text"
              value={tableQuery}
              onChange={(e) => setTableQuery(e.target.value)}
              placeholder="Search creator name or link..."
              className={styles.input}
              style={{ maxWidth: '400px' }}
            />
          </div>

          <div className={styles.panel}>
            {filteredCreators.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyStateIcon}>👥</span>
                <p className={styles.emptyStateText}>No creators found</p>
                <p className={styles.subtitle}>Create a custom link to get started.</p>
              </div>
            ) : (
              <div className={styles.table}>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Slug (Custom Link)</th>
                      <th>Products Title</th>
                      <th>Products Selected</th>
                      <th>Sales Stats</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCreators.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <span className={styles.creatorName}>{c.name}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className={styles.creatorSlug}>{c.slug}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyLink(c.slug)}
                              className={styles.copyIconBtn}
                              title="Copy URL to clipboard"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                        <td>
                          <span className={styles.creatorTitle}>{c.productsTitle}</span>
                        </td>
                        <td>
                          <span className={styles.productCount}>
                            📦 {c.productIds ? c.productIds.length : 0} items
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
                              🛍️ {c.salesCount || 0} sold
                            </span>
                            <span style={{ fontSize: '0.82rem', color: '#059669', fontWeight: 700 }}>
                              ₹{(c.salesMoney || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.actions}>
                            <button
                              type="button"
                              onClick={() => handleEdit(c)}
                              className={styles.linkButton}
                            >
                              Edit
                            </button>
                            <a
                              href={`/creator/${c.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.linkButton}
                            >
                              Open page
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDelete(c.id, c.name)}
                              className={`${styles.linkButton} ${styles.deleteButton}`}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
