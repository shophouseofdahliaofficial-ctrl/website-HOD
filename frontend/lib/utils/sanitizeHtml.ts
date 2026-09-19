/**
 * Very small HTML sanitizer for user-entered rich text.
 * Goal: preserve basic formatting while preventing script injection.
 *
 * NOTE: This runs in the browser (client components). If you also render HTML
 * on the server, you should sanitize there too.
 */

const ALLOWED_TAGS = new Set([
  'B',
  'I',
  'EM',
  'STRONG',
  'U',
  'S',
  'STRIKE',
  'DEL',
  'INS',
  'BR',
  'WBR',
  'P',
  'DIV',
  'SPAN',
  'UL',
  'OL',
  'LI',
  'A',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BLOCKQUOTE',
  'HR',
  'PRE',
  'CODE',
  'SUB',
  'SUP',
  'TABLE',
  'THEAD',
  'TBODY',
  'TFOOT',
  'TR',
  'TH',
  'TD',
  'CAPTION',
]);

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function textToHtml(text: string) {
  return escapeHtml(text).replace(/\n/g, '<br/>');
}

export function looksLikeHtml(input: string) {
  return /<\/?[a-z][\s\S]*>/i.test(input);
}

function isBlankListNode(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) {
    return !node.textContent?.replace(/\u00a0/g, ' ').trim();
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const el = node as Element;
  if (el.tagName === 'BR') return true;
  if (['P', 'DIV', 'SPAN', 'O:P'].includes(el.tagName)) {
    return !el.textContent?.replace(/\u00a0/g, ' ').trim();
  }
  return false;
}

const LIST_BLOCK_WRAPPERS = new Set(['P', 'DIV', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

function unwrapBlockChildren(li: Element) {
  let changed = true;
  while (changed) {
    changed = false;
    [...li.children].forEach((child) => {
      if (!LIST_BLOCK_WRAPPERS.has(child.tagName)) return;
      while (child.firstChild) {
        li.insertBefore(child.firstChild, child);
      }
      child.remove();
      changed = true;
    });
  }
}

function plainTextToListHtml(text: string): string | null {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const bulletPattern = /^\s*(?:[-*•●◦‣▪▫]|\d+[.)])\s+(.*)$/;
  const items: { ordered: boolean; text: string }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(bulletPattern);
    if (!match) return null;
    const ordered = /^\d+[.)]/.test(trimmed);
    items.push({ ordered, text: match[1].trim() });
  }

  if (items.length === 0) return null;

  const allOrdered = items.every((item) => item.ordered);
  const tag = allOrdered ? 'ol' : 'ul';
  const lis = items
    .map((item) => `<li>${escapeHtml(item.text)}</li>`)
    .join('');
  return `<${tag}>${lis}</${tag}>`;
}

/** Flatten pasted Word/Docs list markup so bullets stay on the same line as text. */
export function normalizeListHtml(inputHtml: string): string {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return inputHtml;
  }

  const doc = new DOMParser().parseFromString(inputHtml, 'text/html');

  doc.querySelectorAll('li').forEach((li) => {
    while (li.firstChild && isBlankListNode(li.firstChild)) {
      li.firstChild.remove();
    }

    unwrapBlockChildren(li);

    while (li.firstChild && isBlankListNode(li.firstChild)) {
      li.firstChild.remove();
    }

    while (li.lastChild?.nodeName === 'BR') {
      li.lastChild.remove();
    }
  });

  return doc.body.innerHTML;
}

export function normalizePastedHtml(html: string, plainText: string): string {
  const trimmedHtml = html.trim();
  if (!trimmedHtml) {
    const fromPlain = plainTextToListHtml(plainText);
    return fromPlain ? fromPlain : textToHtml(plainText);
  }
  return sanitizeHtml(trimmedHtml);
}

export function sanitizeHtml(inputHtml: string) {
  // DOMParser only exists in the browser. In non-browser contexts, fall back to escaping.
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return escapeHtml(inputHtml);
  }

  const doc = new DOMParser().parseFromString(inputHtml, 'text/html');

  // Remove scripts/styles explicitly
  doc.querySelectorAll('script,style').forEach((n) => n.remove());

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  const elements: Element[] = [];
  while (walker.nextNode()) {
    elements.push(walker.currentNode as Element);
  }

  for (const el of elements) {
    if (!ALLOWED_TAGS.has(el.tagName)) {
      // unwrap disallowed element (preserve text/children)
      const parent = el.parentNode;
      if (!parent) continue;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      continue;
    }

    // Remove all attributes except href on <a>
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (el.tagName === 'A' && name === 'href') return;
      el.removeAttribute(attr.name);
    });

    if (el.tagName === 'A') {
      const href = (el.getAttribute('href') || '').trim();
      const safe =
        href.startsWith('/') ||
        href.startsWith('#') ||
        /^https?:\/\//i.test(href);
      if (!safe) el.removeAttribute('href');
      // Safe defaults
      el.setAttribute('rel', 'noopener noreferrer');
      el.setAttribute('target', '_blank');
    }
  }

  return normalizeListHtml(doc.body.innerHTML);
}

export function toSafeHtml(input: string) {
  const raw = input || '';
  return looksLikeHtml(raw) ? sanitizeHtml(raw) : textToHtml(raw);
}

