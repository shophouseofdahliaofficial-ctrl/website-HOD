'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';

/**
 * Admin Deliveries Route
 * Redirects to /admin/orders (where all Delhivery logistics, AWB tracking, and order fulfillment are managed).
 */
export default function AdminDeliveriesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/orders');
  }, [router]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <LoadingSpinnerWithText text="Redirecting to Orders..." />
    </div>
  );
}
