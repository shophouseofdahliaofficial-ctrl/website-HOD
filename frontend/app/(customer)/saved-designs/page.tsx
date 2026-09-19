'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { photobookApi, productsApi } from '@/lib/api';
import type { PhotobookProjectRecord } from '@/lib/photobook/projectTypes';
import type { Product } from '@/types';
import { getPrimaryProductImageUrl } from '@/lib/utils/productImages';
import CustomerSidebarLayout from '@/components/customer/CustomerSidebarLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import styles from './saved-designs.module.css';

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Edited today';
  if (diffDays === 1) return 'Edited yesterday';
  if (diffDays < 30) return `Edited ${diffDays} days ago`;
  return date.toLocaleDateString();
}

function statusLabel(status: PhotobookProjectRecord['status']): string {
  if (status === 'purchased') return 'Purchased';
  if (status === 'cart') return 'In cart';
  return 'Draft';
}

function statusClass(status: PhotobookProjectRecord['status']): string {
  if (status === 'purchased') return styles.statusPurchased;
  if (status === 'cart') return styles.statusCart;
  return styles.statusDraft;
}

export default function SavedDesignsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<PhotobookProjectRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productCoverById, setProductCoverById] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rows, allProducts] = await Promise.all([
        photobookApi.listProjects(),
        productsApi.getAll(),
      ]);
      const projectsList = Array.isArray(rows) ? rows : [];
      setProjects(projectsList);
      setProducts(allProducts);

      const productById = new Map(allProducts.map((product) => [String(product.id), product]));
      const coverMap: Record<string, string | null> = {};
      for (const project of projectsList) {
        const productId = String(project.productId);
        if (productId in coverMap) continue;
        const product = productById.get(productId);
        coverMap[productId] = product ? getPrimaryProductImageUrl(product) : null;
      }
      setProductCoverById(coverMap);
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Failed to load saved designs';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/auth/login?redirect=/saved-designs');
      return;
    }
    void loadProjects();
  }, [authLoading, isAuthenticated, loadProjects, router]);

  const handleOpen = (project: PhotobookProjectRecord) => {
    router.push(`/product/${project.productId}?pbProject=${project.id}`);
  };

  const handleDeleteClick = (projectId: string) => {
    setDeleteProjectId(projectId);
  };

  const handleConfirmDelete = async () => {
    if (!deleteProjectId) return;
    try {
      await photobookApi.deleteProject(deleteProjectId);
      setProjects((prev) => prev.filter((p) => p.id !== deleteProjectId));
    } catch {
      window.alert('Could not delete this design.');
    } finally {
      setDeleteProjectId(null);
    }
  };

  const visibleProjects = projects.filter(
    (project) => project.status !== 'purchased' && !project.isLocked,
  );

  if (authLoading || (!isAuthenticated && !error)) {
    return (
      <CustomerSidebarLayout>
        <LoadingSpinner />
      </CustomerSidebarLayout>
    );
  }

  return (
    <CustomerSidebarLayout>
      <div className={styles.savedDesignsPage}>
        <div className={styles.header}>
          <h1 className={styles.title}>Saved Designs</h1>
          <p className={styles.subtitle}>Continue editing your photobook projects anytime.</p>
        </div>

        {loading ? <LoadingSpinner /> : null}
        {!loading && error ? <p className={styles.empty}>{error}</p> : null}

        {!loading && !error && visibleProjects.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No saved designs yet</p>
            <p>Start designing on a photobook product to see your projects here.</p>
            <p style={{ marginTop: '1rem' }}>
              <Link href="/memorybooks">Browse memory books</Link>
            </p>
          </div>
        ) : null}

        {!loading && !error && visibleProjects.length > 0 ? (
          <>
            <div className={styles.grid}>
              {visibleProjects.map((project) => {
              const productCoverImage = productCoverById[String(project.productId)];
              const product = products.find((p) => String(p.id) === String(project.productId));
              let projectSize = null;
              if (product) {
                // 1. Try to find the size in customization options (under group title 'Size' or group with photobook dimensions)
                if (product.customizationOptions && project.projectJson?.selectedCustomizations) {
                  const sizeGroup = product.customizationOptions.find(
                    (g) =>
                      g.title?.toLowerCase() === 'size' ||
                      g.values?.some((v) => v.photobookWidthCm && v.photobookHeightCm)
                  );
                  if (sizeGroup) {
                    const selectedValId = project.projectJson.selectedCustomizations[sizeGroup.id];
                    if (selectedValId) {
                      const selectedVal = sizeGroup.values?.find((v) => String(v.id) === String(selectedValId));
                      if (selectedVal?.name) {
                        projectSize = selectedVal.name;
                      }
                    }
                  }
                }

                // 2. Fallback to product variations
                if (!projectSize) {
                  const varId = project.variationId || project.projectJson?.variationId;
                  if (varId) {
                    const variation = product.variations?.find((v) => String(v.id) === String(varId));
                    if (variation?.size) {
                      projectSize = variation.size;
                    }
                  }
                }

                // 3. Fallback to pageSizeCm
                if (!projectSize) {
                  const pageSize = project.projectJson?.pageSizeCm;
                  if (pageSize && pageSize.width && pageSize.height) {
                    projectSize = `${pageSize.width}x${pageSize.height} cm`;
                  }
                }
              }

              return (
              <article key={project.id} className={styles.card}>
                {!project.isLocked ? (
                  <button
                    type="button"
                    className={styles.deleteIconBtn}
                    onClick={() => handleDeleteClick(project.id)}
                    aria-label="Delete saved design"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M3 6H5H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ) : null}
                <div className={styles.previewWrap}>
                  {productCoverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={productCoverImage} alt="" className={styles.previewImage} />
                  ) : (
                    <span className={styles.previewPlaceholder}>No preview</span>
                  )}
                </div>
                <div className={styles.body}>
                  <p className={styles.productName}>{project.productName || 'Photobook'}</p>
                  <h2 className={styles.projectName}>{project.projectName}</h2>
                  <div className={styles.meta}>
                    <span className={statusClass(project.status)}>{statusLabel(project.status)}</span>
                    {projectSize ? <span>{projectSize}</span> : null}
                    <span>{project.pageCount} pages</span>
                    <span>{formatRelativeTime(project.lastEditedAt)}</span>
                  </div>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.openBtn}
                      onClick={() => handleOpen(project)}
                      disabled={project.isLocked}
                    >
                      {project.isLocked ? 'Purchased' : 'Continue editing'}
                    </button>
                  </div>
                </div>
              </article>
              );
            })}
            </div>
            <p className={styles.autoDeleteNote}>
              Saved photobook designs are automatically deleted 30 days after your last edit unless purchased. Each time you continue editing, the 30-day timer resets.
            </p>
          </>
        ) : null}
      </div>

      {deleteProjectId ? (
        <div className={styles.modalOverlay} onClick={() => setDeleteProjectId(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalIcon}>
              <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" width="96" height="96" aria-hidden="true">
                <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                <g id="SVGRepo_iconCarrier">
                  <path d="M255.962 187.861C246.687 202.237 228.535 263.956 206.087 307.993" stroke="#000000" strokeOpacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path>
                  <path d="M206.074 307.993C180.325 288.847 147.975 256.496 124.621 225.659" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path>
                  <path d="M124.635 225.659C116.297 270.36 116.081 300.591 111.197 365.922" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path>
                  <path d="M255.324 188.419C271.914 189.623 276.618 190.543 291.359 188.972" stroke="#000000" strokeOpacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path>
                  <path d="M226.4 57.4394C169.856 20.2002 129.185 35.9782 113.298 46.3675C33.934 98.2782 73.6531 208.53 171.064 209.974C256.271 211.236 260.305 111.034 215.925 76.2003" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path>
                  <path d="M208.372 161.648C221.462 153.915 240.472 151.466 230.9 160.162" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path>
                  <path d="M230.905 160.162C244.697 171.039 219.76 172.523 208.501 166.457" stroke="#000000" strokeOpacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path>
                  <path d="M228.524 109.222C224.979 120.135 218.077 121.07 207.463 113.463" stroke="#000000" strokeOpacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path>
                  <path d="M194.683 115.408C194.145 126.557 182.207 131.742 171.946 126.557" stroke="#000000" strokeOpacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path>
                  <path d="M325.022 177.327C326.472 169.151 335.419 147.294 323.439 142.502C314.703 139.008 316.987 160.585 313.942 157.54C311.062 154.66 314.293 147.374 309.193 143.294C307.391 141.852 303.608 140.934 301.278 141.711C286.143 146.756 320.703 173.008 325.022 177.327Z" stroke="#EB5757" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path>
                  <path d="M178.969 66.7393C171.836 88.1846 157.147 107.313 139.891 121.692C135.967 124.962 130.478 121.946 125.848 126.577" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path>
                  <path d="M80.843 160.162C91.742 184.898 104.773 268.23 62.9483 268.23" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path>
                </g>
              </svg>
            </div>
            <h3 className={styles.modalTitle}>Delete Design?</h3>
            <p className={styles.modalDescription}>
              Are you sure you want to delete this saved design? This action cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setDeleteProjectId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmDeleteBtn}
                onClick={() => void handleConfirmDelete()}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </CustomerSidebarLayout>
  );
}
