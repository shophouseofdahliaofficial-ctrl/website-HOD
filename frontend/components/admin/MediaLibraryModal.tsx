'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { adminMediaApi, MediaResource } from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import styles from './MediaLibraryModal.module.css';

interface MediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selected: MediaResource[]) => void;
  multiple?: boolean;
  initialFolder?: string;
  title?: string;
}

export default function MediaLibraryModal({
  isOpen,
  onClose,
  onSelect,
  multiple = false,
  initialFolder = 'all',
  title = 'Cloudinary Media Library',
}: MediaLibraryModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resources, setResources] = useState<MediaResource[]>([]);
  const [folder, setFolder] = useState<string>(initialFolder);
  const [search, setSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<MediaResource | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchMedia();
      setSelectedIds(new Set());
    }
  }, [isOpen, folder]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteTarget) setDeleteTarget(null);
        else onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, deleteTarget, onClose]);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const data = await adminMediaApi.getAll({
        folder: folder === 'all' ? undefined : folder,
        maxResults: 60,
      });
      setResources(data.resources || []);
      setNextCursor(data.nextCursor || null);
    } catch (err) {
      console.error('Failed to fetch media library:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMoreMedia = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await adminMediaApi.getAll({
        folder: folder === 'all' ? undefined : folder,
        maxResults: 60,
        nextCursor: nextCursor,
      });
      setResources((prev) => [...prev, ...(data.resources || [])]);
      setNextCursor(data.nextCursor || null);
    } catch (err) {
      console.error('Failed to load more media:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const targetFolder = folder === 'all' ? 'milko' : folder;
      for (let i = 0; i < files.length; i++) {
        const item = await adminMediaApi.upload(files[i], targetFolder);
        setResources((prev) => [item, ...prev]);
      }
    } catch (err) {
      console.error('Failed to upload image:', err);
      alert('Failed to upload one or more images.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminMediaApi.delete(deleteTarget.publicId);
      setResources((prev) => prev.filter((r) => r.publicId !== deleteTarget.publicId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.publicId);
        return next;
      });
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete media from Cloudinary:', err);
      alert('Failed to delete image from Cloudinary.');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleSelect = (item: MediaResource) => {
    if (multiple) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(item.publicId)) next.delete(item.publicId);
        else next.add(item.publicId);
        return next;
      });
    } else {
      setSelectedIds((prev) =>
        prev.has(item.publicId) ? new Set() : new Set([item.publicId])
      );
    }
  };

  const handleApplySelection = () => {
    const selectedItems = resources.filter((r) => selectedIds.has(r.publicId));
    if (selectedItems.length === 0) return;
    onSelect(selectedItems);
    onClose();
  };

  const filteredResources = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter(
      (r) =>
        r.publicId.toLowerCase().includes(q) ||
        (r.filename && r.filename.toLowerCase().includes(q))
    );
  }, [resources, search]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      data-lenis-prevent
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" data-lenis-prevent>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <h2 className={styles.title}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 12v9m0-9l-3 3m3-3l3 3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {title}
            </h2>
            <p className={styles.subtitle}>
              Browse, upload, or delete images hosted on Cloudinary
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search images by name or path…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.toolbarActions}>
            <select
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className={styles.folderSelect}
              aria-label="Filter by folder"
            >
              <option value="all">All Folders</option>
              <option value="houseofdahlia/products">houseofdahlia/products</option>
              <option value="houseofdahlia/banners">houseofdahlia/banners</option>
              <option value="houseofdahlia/media">houseofdahlia/media</option>
              <option value="houseofdahlia/customization">houseofdahlia/customization</option>
              <option value="houseofdahlia/logo">houseofdahlia/logo</option>
            </select>

            <button
              type="button"
              className={styles.refreshBtn}
              onClick={() => fetchMedia()}
              title="Refresh images"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <button
              type="button"
              className={styles.uploadBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <LoadingSpinner size="small" />
                  <span>Uploading…</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                  <span>Upload Image</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleUploadFiles}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* Media Grid */}
        <div className={styles.body} data-lenis-prevent>
          {loading ? (
            <div className={styles.loadingState}>
              <LoadingSpinner size="medium" />
              <span>Loading Cloudinary images…</span>
            </div>
          ) : filteredResources.length === 0 ? (
            <div className={styles.emptyState}>
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <p>No images found in this folder.</p>
              <button
                type="button"
                className={styles.uploadBtn}
                onClick={() => fileInputRef.current?.click()}
                style={{ marginTop: '0.5rem' }}
              >
                + Upload your first image
              </button>
            </div>
          ) : (
            <div className={styles.grid}>
              {filteredResources.map((item) => {
                const isSelected = selectedIds.has(item.publicId);
                return (
                  <div
                    key={item.publicId}
                    className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                    onClick={() => handleToggleSelect(item)}
                  >
                    <div className={styles.imageWrap}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt={item.filename || item.publicId} loading="lazy" />
                      {item.format && (
                        <span className={styles.formatBadge}>{item.format}</span>
                      )}
                      {isSelected && (
                        <span className={styles.checkBadge}>✓</span>
                      )}
                      <button
                        type="button"
                        className={styles.deleteCardBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(item);
                        }}
                        title="Delete from Cloudinary"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                    <div className={styles.cardInfo}>
                      <div className={styles.cardName} title={item.publicId}>
                        {item.filename || item.publicId.split('/').pop()}
                      </div>
                      <div className={styles.cardMeta}>
                        <span>{item.width && item.height ? `${item.width}×${item.height}` : ''}</span>
                        <span>{item.bytes ? `${Math.round(item.bytes / 1024)} KB` : ''}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {nextCursor && !loading && (
            <div className={styles.loadMoreWrap}>
              <button
                type="button"
                className={styles.loadMoreBtn}
                onClick={fetchMoreMedia}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <LoadingSpinner size="small" />
                    <span>Loading more images...</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Load More (60 images)</span>
                  </>
                )}
              </button>
              <div className={styles.loadedCountText}>
                Loaded {resources.length} images
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.selectedSummary}>
            {selectedIds.size > 0 ? (
              <span>
                <strong>{selectedIds.size}</strong> image{selectedIds.size > 1 ? 's' : ''} selected
              </span>
            ) : (
              <span>Click an image to select it</span>
            )}
          </div>
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.selectActionBtn}
              onClick={handleApplySelection}
              disabled={selectedIds.size === 0}
            >
              {multiple
                ? `Choose ${selectedIds.size || ''} Selected Image${selectedIds.size > 1 ? 's' : ''}`
                : 'Choose Selected Image'}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div
          className={styles.confirmBackdrop}
          role="presentation"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className={styles.confirmModal}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.confirmTitle}>Delete from Cloudinary?</h3>
            <p className={styles.confirmText}>
              Are you sure you want to permanently delete{' '}
              <strong>{deleteTarget.filename || deleteTarget.publicId}</strong> from your Cloudinary storage?
              Any live banners or products referencing this image may break.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmDeleteBtn}
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
