'use client';


import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ProductsClient from '@/app/(customer)/products/ProductsClient';
import { creatorsApi, Creator } from '@/lib/api/creators';

export default function CreatorStorefrontPage() {
  const { slug } = useParams() as { slug: string };
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const fetchCreator = async () => {
      try {
        const data = await creatorsApi.getBySlug(slug);
        setCreator(data);
        if (typeof window !== 'undefined') {
          localStorage.setItem('referred_by_creator_slug', slug);
        }
        setLoading(false);
      } catch (err) {
        console.error('Failed to load creator page:', err);
        setError(true);
        setLoading(false);
      }
    };
    fetchCreator();
  }, [slug]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        <div style={{
          animation: 'spin 0.8s linear infinite',
          width: '32px',
          height: '32px',
          border: '3px solid rgba(255, 0, 64, 0.1)',
          borderTopColor: '#ff0040',
          borderRadius: '50%',
          marginBottom: '16px'
        }} />
        <span style={{ fontFamily: 'var(--font-inter), sans-serif', color: '#666', fontSize: '0.95rem' }}>Loading storefront...</span>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '0 20px' }}>
        <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '120px', height: '120px', marginBottom: '16px' }}>
          <g id="SVGRepo_bgCarrier" strokeWidth="0" />
          <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round" />
          <g id="SVGRepo_iconCarrier">
            <path d="M170.617 50.0127C154.839 63.5877 160.47 96.3945 163.077 103.311C165.911 110.832 171.792 117.155 174.671 120.514C177.451 123.759 184.529 129.02 188.531 130.477C201.49 135.191 214.458 135.992 227.62 131.263C240.69 126.567 249.91 118.355 253.923 104.692C257.019 94.146 258.551 83.414 259.249 72.3202C259.282 64.3552 257.179 56.7668 252.991 49.7801C247.378 40.4215 238.992 34.1879 228.502 32.1187C219.568 30.3558 210.179 30.5275 201.122 32.4269C197.725 33.1376 194.444 34.8653 191.397 36.6263" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M194.906 134.437C188.25 155.312 184.922 169.306 184.922 176.417C184.922 187.083 182.316 214.603 182.316 235.181" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M148.742 156.824C194.79 158.885 219.391 161.217 222.543 163.819C227.272 167.722 239.6 201.617 243.511 205.444C246.118 207.995 262.145 196.722 291.592 171.626C292.505 169.023 294.312 166.421 297.016 163.819" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M150.143 158.223C132.165 190.376 122.211 207.132 120.28 208.489C117.383 210.526 106.167 182.431 102.3 179.478C99.7217 177.509 97.485 173.468 95.5898 167.355" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M208.891 189.005C196.294 187.14 188.015 186.207 184.054 186.207C180.093 186.207 172.985 186.207 162.73 186.207" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M159.934 216.991L206.926 212.793H210.291" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M165.633 368.107H145.945C154.472 332.34 158.735 313.12 158.735 310.447C158.735 309.299 155.921 288.475 150.292 247.976L215.619 243.576L231.273 299.776L194.804 368.107H207.298" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M200.812 84.0645C201.331 85.7576 201.59 86.9237 201.59 87.5625C201.59 89.1442 200.812 90.1359 200.812 91.0606" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M224.979 84.0645C225.238 85.6649 225.367 86.7946 225.367 87.4534C225.367 89.0844 224.59 90.1071 224.59 91.0606" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M106.781 163.82L103.705 177.996C100.839 180.672 97.668 182.01 94.1914 182.01" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M284.43 162.421C285.754 169.883 288.418 173.615 292.421 173.615C296.425 173.615 301.222 173.615 306.811 173.615" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>
        <h2 style={{ fontFamily: 'var(--font-inter), sans-serif', color: '#1a1a1a', marginBottom: '8px' }}>Storefront Not Found</h2>
        <p style={{ fontFamily: 'var(--font-inter), sans-serif', color: '#666', fontSize: '0.95rem' }}>The requested creator link does not exist or has been removed.</p>
      </div>
    );
  }

  return (
    <ProductsClient 
      title={creator.productsTitle} 
      allowedProductIds={creator.productIds} 
    />
  );
}
