'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAllCategories } from '@/lib/api/categories';

export function useCategoryMap() {
  const [entries, setEntries] = useState<Array<[string, string]>>([]);

  useEffect(() => {
    let cancelled = false;

    getAllCategories()
      .then((categories) => {
        if (cancelled) return;
        setEntries(categories.map((category) => [category.id, category.name]));
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('Failed to fetch categories for product labels:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => new Map(entries), [entries]);
}
