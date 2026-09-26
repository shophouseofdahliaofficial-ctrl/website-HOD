'use client';


import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import ProductDetailsModal from '@/components/ProductDetailsModal';
import { productsApi } from '@/lib/api';
import type { Product } from '@/types';

/**
 * Deep link / refresh target for product modal: /product/[id]
 */
function ProductDeepLinkContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pbProjectId = searchParams.get('pbProject') || undefined;
  const raw = params?.id;
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    if (!id) {
      setFailed(true);
      setProduct(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = await productsApi.getById(id, true);
        if (!cancelled) {
          setProduct(p);
          setFailed(false);
        }
      } catch {
        if (!cancelled) {
          setProduct(null);
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (product === undefined) {
    return (
      <ProductDetailsModal
        product={null as any}
        isOpen
        onClose={() => router.back()}
        isFlatPage
        initialPhotobookProjectId={pbProjectId}
      />
    );
  }

  if (!id || failed || !product) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '2rem 1.5rem',
          textAlign: 'center',
        }}
      >
        <svg
          viewBox="0 0 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          style={{ width: '111px', height: '111px', marginBottom: '1.25rem' }}
        >
          <path
            d="M208.966 110.117C254.405 154.438 251.905 240.684 230.919 288.101C201.051 355.593 209.978 250.359 184.602 277.117C177.704 284.391 181.81 317.719 156.516 320.269C138.085 322.126 154.096 266.606 141.635 277.117C127.283 289.224 121.293 331.099 103.61 320.269C96.98 288.749 95.6539 205.826 103.61 164.619"
            stroke="#000000"
            strokeOpacity="0.9"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M334.001 205.901C300.792 236.16 270.173 269.031 239.891 302.247C231.256 311.719 217.546 319.675 207.086 324.435"
            stroke="#000000"
            strokeOpacity="0.9"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M240.001 310.082C261.705 300.029 259.1 324.324 252.155 325.999C233.056 330.607 236.719 314.627 238.123 312.595"
            stroke="#000000"
            strokeOpacity="0.9"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M318.739 227.487C333.322 228.815 333.932 239.822 328.721 245.562C322.396 252.532 303.881 248.558 312.768 230.427"
            stroke="#000000"
            strokeOpacity="0.9"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M67 154.417C74.2958 151.934 94.2222 144.012 102.587 140.456M102.587 140.456C132.714 127.648 168.181 109.352 197.507 96.1835C186.549 83.4764 160.167 66.0223 132.221 75.9106C98.42 87.8702 101.97 124.204 102.587 140.456Z"
            stroke="#000000"
            strokeOpacity="0.9"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M212.18 168.071C211.362 164.294 211.429 160.869 210.359 156.308"
            stroke="#000000"
            strokeOpacity="0.9"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M189.816 170.532C190.383 167.512 189.063 162.444 188.656 159.594"
            stroke="#000000"
            strokeOpacity="0.9"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h1
          style={{
            margin: '0 0 1.25rem',
            color: '#222',
            fontSize: 'clamp(1.25rem, 4.5vw, 1.25rem)',
            fontWeight: 600,
            lineHeight: 1.35,
            maxWidth: '22rem',
            letterSpacing: '-0.5px',
          }}
        >
          Product so cooked we couldn&apos;t find it
        </h1>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            justifyContent: 'center',
            marginTop: '0.55rem',
          }}
        >
          <a
            href="https://www.instagram.com/myscribble.in/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: 80,
              border: '1px solid rgb(255, 6, 88)',
              background: 'rgb(255, 6, 88)',
              color: '#fff',
              fontWeight: 500,
              cursor: 'pointer',
              textDecoration: 'none',
              fontSize: '0.95rem',
            }}
          >
            Request this product
          </a>
          <button
            type="button"
            onClick={() => router.push('/')}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: 80,
              border: '1px solid rgb(255, 6, 88)',
              background: '#fff0',
              color: 'rgb(255, 6, 88)',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <ProductDetailsModal
      product={product}
      isOpen
      onClose={() => router.back()}
      onRelatedProductClick={(related) => router.push(`/product/${related.id}`)}
      isFlatPage
      initialPhotobookProjectId={pbProjectId}
    />
  );
}

export default function ProductDeepLinkPage() {
  return (
    <Suspense
      fallback={
        <ProductDetailsModal
          product={null as any}
          isOpen
          onClose={() => {}}
          isFlatPage
        />
      }
    >
      <ProductDeepLinkContent />
    </Suspense>
  );
}
