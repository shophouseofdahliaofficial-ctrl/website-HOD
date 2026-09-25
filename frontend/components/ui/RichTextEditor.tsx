'use client';

import { useEffect, useRef } from 'react';
import styles from './RichTextEditor.module.css';
import { normalizePastedHtml, sanitizeHtml } from '@/lib/utils/sanitizeHtml';

type Props = {
  value: string;
  onChange: (nextHtml: string) => void;
  placeholder?: string;
};

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write…',
}: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  // Keep DOM in sync if value is changed externally (e.g. loaded from API).
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const normalized = sanitizeHtml(value || '');
    if (el.innerHTML !== normalized) {
      el.innerHTML = normalized;
    }
  }, [value]);

  const syncEditorHtml = () => {
    const el = editorRef.current;
    if (!el) return;
    const cleaned = sanitizeHtml(el.innerHTML);
    if (el.innerHTML !== cleaned) {
      el.innerHTML = cleaned;
    }
    onChange(cleaned);
  };

  const exec = (command: string, arg?: string) => {
    // execCommand is deprecated but still widely supported and ideal for lightweight formatting.
    document.execCommand(command, false, arg);
    syncEditorHtml();
    editorRef.current?.focus();
  };

  const onInput = () => {
    const el = editorRef.current;
    if (!el) return;
    onChange(el.innerHTML);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = editorRef.current;
    if (!el) return;

    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    const toInsert = normalizePastedHtml(html, text);

    document.execCommand('insertHTML', false, toInsert);
    syncEditorHtml();
    el.focus();
  };

  const addLink = () => {
    const url = window.prompt('Enter link URL (https://...)');
    if (!url) return;
    exec('createLink', url);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.toolButton} onClick={() => exec('bold')} title="Bold">
          <span className={styles.toolIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 5h6a4 4 0 0 1 0 8H8V5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 13h7a4 4 0 0 1 0 8H8v-8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          Bold
        </button>
        <button type="button" className={styles.toolButton} onClick={() => exec('italic')} title="Italic">
          <span className={styles.toolIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 4h-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M12 20H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M14 4 10 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </span>
          Italic
        </button>
        <button type="button" className={styles.toolButton} onClick={() => exec('underline')} title="Underline">
          <span className={styles.toolIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 4v6a5 5 0 0 0 10 0V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M5 20h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </span>
          Underline
        </button>
        <button type="button" className={styles.toolButton} onClick={() => exec('insertUnorderedList')} title="Bullets">
          <span className={styles.toolIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 6h12M9 12h12M9 18h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            </svg>
          </span>
          Bullets
        </button>
        <button type="button" className={styles.toolButton} onClick={() => exec('insertOrderedList')} title="Numbered list">
          <span className={styles.toolIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 6h12M9 12h12M9 18h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M4 6h1M4 12h1M4 18h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </span>
          Numbered
        </button>
        <button type="button" className={styles.toolButton} onClick={addLink} title="Link">
          <span className={styles.toolIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          Link
        </button>
        <button type="button" className={styles.toolButton} onClick={() => exec('removeFormat')} title="Clear formatting">
          Clear
        </button>
      </div>

      <div
        ref={editorRef}
        className={styles.editor}
        contentEditable
        suppressContentEditableWarning
        onInput={onInput}
        onPaste={onPaste}
        onBlur={syncEditorHtml}
        data-placeholder={placeholder}
        data-lenis-prevent="true"
      />
    </div>
  );
}

