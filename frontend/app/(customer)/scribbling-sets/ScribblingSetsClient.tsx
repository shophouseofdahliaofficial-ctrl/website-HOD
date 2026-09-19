'use client';

import { useCategoryMap } from '@/hooks/useCategoryMap';
import ProductsClient from '../products/ProductsClient';

export default function ScribblingSetsClient() {
  const categoryMap = useCategoryMap();
  
  const hasScribblingSetsCategory = Array.from(categoryMap.values()).some(
    (name) => name.toLowerCase() === 'scribbling sets'
  );

  // If a dedicated "Scribbling Sets" category exists, filter by it.
  // Otherwise, fallback to showing "Notepads" category.
  const filterVal = hasScribblingSetsCategory ? 'Scribbling Sets' : 'Notepads';

  return (
    <ProductsClient categoryFilter={filterVal} title="Scribbling Sets" />
  );
}
