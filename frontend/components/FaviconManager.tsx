'use client';

import { useEffect } from 'react';
import { contentApi } from '@/lib/api';

const MANAGED_REL_VALUES = ['icon', 'shortcut icon', 'apple-touch-icon'];

function upsertLink(rel: string, href: string) {
  let link = document.head.querySelector(`link[data-milko-favicon="${rel}"]`) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('data-milko-favicon', rel);
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
}

export default function FaviconManager() {
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await contentApi.getByType('favicon');
        const url = data?.metadata?.imageUrl;
        if (cancelled || !url) return;
        MANAGED_REL_VALUES.forEach((rel) => upsertLink(rel, url));
      } catch {
        // Keep whatever favicon is already present.
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
