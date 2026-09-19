'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { adminProductsApi } from '@/lib/api';
import { Product } from '@/types';
import Link from 'next/link';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import styles from './page.module.css';
import { getAllCategories, Category } from '@/lib/api/categories';
import { useToast } from '@/contexts/ToastContext';
/**
 * Admin Products Page
 * Manage all products (create, edit, delete)
 */
export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sort, setSort] = useState<'updatedDesc' | 'nameAsc' | 'priceAsc' | 'priceDesc'>('updatedDesc');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchExpandRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  const getErrorMessage = (err: unknown) => {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object' && 'message' in err) {
      const maybe = (err as { message?: unknown }).message;
      if (typeof maybe === 'string') return maybe;
    }
    return 'Something went wrong';
  };

  const fetchProducts = async () => {
    try {
      const data = await adminProductsApi.getAll();
      setProducts(data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [showToast]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getAllCategories();
        setCategories(data);
      } catch (error) {
        // Non-blocking; products list can still load without category labels.
        console.warn('Failed to fetch categories:', error);
      }
    };

    fetchCategories();
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

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const getPrimaryPrice = (p: Product) => {
    const selling = p.sellingPrice;
    if (selling !== null && selling !== undefined) return selling;
    return p.pricePerLitre;
  };

  const filtered = products
    .filter((p) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    })
    .filter((p) => {
      if (statusFilter === 'all') return true;
      return statusFilter === 'active' ? p.isActive : !p.isActive;
    })
    .sort((a, b) => {
      if (sort === 'nameAsc') return a.name.localeCompare(b.name);
      if (sort === 'priceAsc') return getPrimaryPrice(a) - getPrimaryPrice(b);
      if (sort === 'priceDesc') return getPrimaryPrice(b) - getPrimaryPrice(a);
      // updatedDesc default
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const handleDeleteProduct = async (product: Product) => {
    const ok = confirm(
      `Delete product "${product.name}" permanently?\n\nThis will remove the product and its related data from backend.`
    );
    if (!ok) return;
    try {
      await adminProductsApi.delete(product.id);
      showToast('Product deleted successfully', 'success');
      await fetchProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
      showToast(getErrorMessage(error), 'error');
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
        <LoadingSpinnerWithText text="Loading products..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={adminStyles.adminPageTitle}>Products</h1>
          <div className={styles.subtitle}>
            {filtered.length} product{filtered.length !== 1 ? 's' : ''} shown
            {products.length !== filtered.length ? ` (filtered from ${products.length})` : ''}
          </div>
        </div>
        <div className={styles.headerActions}>
          <Link href="/admin/products/new" className={`${adminStyles.adminButton} ${styles.addProductDesktop}`}>
            Add Product
          </Link>
          <Link
            href="/admin/products/new"
            className={styles.addProductIconLink}
            aria-label="Add new product"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </Link>
        </div>
      </div>

      <div
        className={`${styles.toolbar} ${searchExpanded ? styles.toolbarSearchExpanded : ''}`}
      >
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
              placeholder="Search by name or description…"
              aria-label="Search products by name or description"
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

          <CustomSelect<'updatedDesc' | 'nameAsc' | 'priceAsc' | 'priceDesc'>
            value={sort}
            onChange={setSort}
            modalTitle="Sort"
            options={[
              { value: 'updatedDesc', label: 'Sort: Recently updated' },
              { value: 'nameAsc', label: 'Sort: Name (A → Z)' },
              { value: 'priceAsc', label: 'Sort: Price (low → high)' },
              { value: 'priceDesc', label: 'Sort: Price (high → low)' },
            ]}
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className={styles.panel}>
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            No products found. Try clearing filters or create a new product.
          </div>
        ) : (
          <table className={styles.table}>
            <thead className={styles.thead}>
              <tr>
                <th className={styles.th}>Product</th>
                <th className={styles.th}>Price</th>
                <th className={styles.th}>Stock</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Updated</th>
                <th className={styles.th} style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const categoryLabel = product.categoryId ? (categoryMap.get(product.categoryId) || 'Category') : 'Uncategorized';
                const qty = product.quantity ?? null;
                const low = product.lowStockThreshold ?? null;
                const isLowStock = qty !== null && low !== null && qty <= low;
                const primary = getPrimaryPrice(product);
                const compare = product.compareAtPrice;

                return (
                  <tr key={product.id} className={styles.row}>
                    <td className={styles.td}>
                      <div className={styles.productCell}>
                        <div className={styles.thumb}>
                          {product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span className={styles.thumbText}>{product.name.slice(0, 1).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <div className={styles.productName}>{product.name}</div>
                          <div className={styles.productMeta}>
                            {categoryLabel} • ID #{product.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.priceBlock}>
                        <div className={styles.priceMain}>
                          ₹{primary.toFixed(2)}
                          {compare !== null && compare !== undefined && compare > primary ? (
                            <span className={styles.strike}>₹{compare.toFixed(2)}</span>
                          ) : null}
                        </div>
                        <div className={styles.priceSub}>Base: ₹{product.pricePerLitre.toFixed(2)}</div>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, color: '#0f172a' }}>
                          {qty === null ? '—' : qty}
                        </span>
                        {isLowStock ? <span className={`${styles.badge} ${styles.badgeLowStock}`}>Low</span> : null}
                      </div>
                      <div className={styles.priceSub}>
                        Threshold: {low === null ? '—' : low}
                      </div>
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.badge} ${product.isActive ? styles.badgeActive : styles.badgeInactive}`}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className={styles.td}>
                      {new Date(product.updatedAt).toLocaleDateString()}
                    </td>
                    <td className={styles.td}>
                      <div className={styles.actions}>
                        <Link className={styles.linkButton} href={`/admin/products/${product.id}`}>
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(product)}
                          className={`${styles.linkButton} ${styles.actionIconButton} ${styles.deleteButton}`}
                          aria-label={`Delete ${product.name}`}
                          title="Delete product"
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
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile cards */}
      <div className={styles.cards}>
        {filtered.length === 0 ? (
          <div className={styles.card}>
            <div className={styles.emptyState} style={{ padding: '1rem' }}>
              No products found.
            </div>
          </div>
        ) : (
          filtered.map((product) => {
            const categoryLabel = product.categoryId ? (categoryMap.get(product.categoryId) || 'Category') : 'Uncategorized';
            const qty = product.quantity ?? null;
            const low = product.lowStockThreshold ?? null;
            const isLowStock = qty !== null && low !== null && qty <= low;
            const primary = getPrimaryPrice(product);
            const compare = product.compareAtPrice;

            return (
              <div className={styles.card} key={product.id}>
                <div className={styles.cardTop}>
                  <div className={styles.cardTitleRow}>
                    <div className={styles.thumb}>
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span className={styles.thumbText}>{product.name.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <div className={styles.productName}>{product.name}</div>
                      <div className={styles.productMeta}>{categoryLabel} • #{product.id}</div>
                    </div>
                  </div>
                  <span className={`${styles.badge} ${product.isActive ? styles.badgeActive : styles.badgeInactive}`}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.kv}>
                    <div className={styles.kvLabel}>PRICE</div>
                    <div className={styles.kvValue}>
                      ₹{primary.toFixed(2)}
                      {compare !== null && compare !== undefined && compare > primary ? (
                        <span className={styles.strike}>₹{compare.toFixed(2)}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className={styles.kv}>
                    <div className={styles.kvLabel}>STOCK</div>
                    <div className={styles.kvValue}>
                      {qty === null ? '—' : qty}
                      {isLowStock ? <span className={`${styles.badge} ${styles.badgeLowStock}`}>Low</span> : null}
                    </div>
                  </div>
                  <div className={styles.kv}>
                    <div className={styles.kvLabel}>UPDATED</div>
                    <div className={styles.kvValue}>{new Date(product.updatedAt).toLocaleDateString()}</div>
                  </div>
                  <div className={styles.kv}>
                    <div className={styles.kvLabel}>ACTIONS</div>
                    <div className={styles.actions}>
                      <Link className={styles.linkButton} href={`/admin/products/${product.id}`}>
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(product)}
                        className={`${styles.linkButton} ${styles.actionIconButton} ${styles.deleteButton}`}
                        aria-label={`Delete ${product.name}`}
                        title="Delete product"
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

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
              data-lenis-prevent
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

