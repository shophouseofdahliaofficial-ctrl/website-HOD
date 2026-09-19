'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { walletApi } from '@/lib/api';
import { SITE_NAME } from '@/lib/seo';
import { useToast } from '@/contexts/ToastContext';
import headerStyles from './Header.module.css';

export default function WalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { showToast } = useToast();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletTx, setWalletTx] = useState<Array<{ id: string; type: 'credit' | 'debit'; amount: number; source: string; createdAt?: string | null }>>(
    []
  );
  const [walletAmount, setWalletAmount] = useState('');
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletAddAmountOpen, setWalletAddAmountOpen] = useState(false);

  const formatWalletAmount = (amount: number) =>
    amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const loadRazorpayScript = (): Promise<void> => {
    if (typeof window !== 'undefined' && (window as unknown as { Razorpay?: unknown }).Razorpay) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load Razorpay'));
      document.head.appendChild(s);
    });
  };

  const handleAddMoney = async () => {
    const amt = Math.round(Number(walletAmount) * 100) / 100;
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }

    try {
      const topup = await walletApi.createTopupOrder(amt);

      // Manual top-up mode (dev/local): backend credited wallet without Razorpay.
      if ('manual' in topup && topup.manual) {
        setWalletAmount('');
        setWalletAddAmountOpen(false);
        setWalletBalance(topup.balance);
        const refreshed = await walletApi.getSummary();
        setWalletTx(refreshed.transactions || []);
        showToast('Wallet topped up', 'success');
        return;
      }

      // Razorpay top-up mode.
      if (!('razorpayOrderId' in topup)) return;
      const order = topup;
      await loadRazorpayScript();
      const Razorpay = (window as unknown as { Razorpay: new (o: unknown) => { open: () => void } }).Razorpay;
      const rzp = new Razorpay({
        key: order.key,
        order_id: order.razorpayOrderId,
        currency: order.currency || 'INR',
        name: SITE_NAME,
        description: 'Add money to wallet',
        handler: async function (resp: { razorpay_payment_id: string; razorpay_order_id: string }) {
          try {
            const v = await walletApi.verifyTopup({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
            });
            setWalletBalance(v.balance);
            setWalletAmount('');
            setWalletAddAmountOpen(false);
            const refreshed = await walletApi.getSummary();
            setWalletTx(refreshed.transactions || []);
            showToast('Wallet topped up', 'success');
          } catch (e) {
            showToast((e as { message?: string })?.message || 'Wallet top-up failed', 'error');
          }
        },
      });
      rzp.open();
    } catch (e) {
      showToast((e as { message?: string })?.message || 'Failed to start top-up', 'error');
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setWalletLoading(true);
    walletApi
      .getSummary()
      .then((w) => {
        if (cancelled) return;
        setWalletBalance(w.balance);
        setWalletTx(w.transactions || []);
      })
      .catch(() => {
        if (cancelled) return;
        setWalletBalance(null);
        setWalletTx([]);
      })
      .finally(() => {
        if (cancelled) return;
        setWalletLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (walletAddAmountOpen) {
        setWalletAddAmountOpen(false);
      } else {
        onClose();
      }
    };

    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, walletAddAmountOpen, onClose]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={headerStyles.walletModalOverlay}
      role="presentation"
      onClick={() => {
        setWalletAddAmountOpen(false);
        onClose();
      }}
    >
      <div
        className={headerStyles.walletModalContent}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={headerStyles.walletModalHeader}>
          <h2 id="wallet-modal-title" className={headerStyles.walletModalTitle}>
            Wallet
          </h2>
          <button
            type="button"
            className={headerStyles.walletModalClose}
            onClick={() => {
              setWalletAddAmountOpen(false);
              onClose();
            }}
            aria-label="Close wallet"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className={headerStyles.walletModalBalanceBlock}>
          <div className={headerStyles.walletModalBalanceLeft}>
            <span className={headerStyles.walletModalBalanceLabel}>Balance</span>
            <span className={headerStyles.walletModalBalanceValue}>
              {walletLoading ? 'Loading…' : walletBalance !== null ? `₹${formatWalletAmount(walletBalance)}` : '—'}
            </span>
          </div>
          <button
            type="button"
            className={headerStyles.walletModalBalanceAddBtn}
            onClick={() => {
              setWalletAmount('');
              setWalletAddAmountOpen(true);
            }}
          >
            <svg
              className={headerStyles.walletModalBalanceAddBtnIcon}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>Add money</span>
          </button>
        </div>

        {walletAddAmountOpen && (
          <div
            className={headerStyles.walletNestedOverlay}
            role="presentation"
            onClick={() => setWalletAddAmountOpen(false)}
          >
            <div
              className={headerStyles.walletNestedContent}
              role="dialog"
              aria-modal="true"
              aria-labelledby="wallet-add-amount-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="wallet-add-amount-title" className={headerStyles.walletNestedTitle}>
                How much do you want to add?
              </h3>
              <label className={headerStyles.walletNestedLabel} htmlFor="wallet-add-amount-input">
                Amount (₹)
              </label>
              <input
                id="wallet-add-amount-input"
                className={headerStyles.walletNestedInput}
                inputMode="decimal"
                placeholder="e.g. 500"
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
                autoFocus
              />
              <div className={headerStyles.walletNestedActions}>
                <button type="button" className={headerStyles.walletNestedCancel} onClick={() => setWalletAddAmountOpen(false)}>
                  Cancel
                </button>
                <button type="button" className={headerStyles.walletNestedSubmit} onClick={handleAddMoney}>
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={headerStyles.walletModalSectionLabel}>Transaction history</div>
        <div className={headerStyles.walletModalTxList}>
          {walletLoading ? (
            <p className={headerStyles.walletModalEmpty}>Loading…</p>
          ) : walletTx.length === 0 ? (
            <p className={headerStyles.walletModalEmpty}>
              <span
                className={headerStyles.walletModalEmptyIcon}
                aria-hidden="true"
                dangerouslySetInnerHTML={{
                  __html: `<svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M232.805 146.703C234.603 144.355 235.653 141.606 236.117 138.728C236.348 137.314 236.317 135.86 236.194 134.44C236.084 133.169 235.708 131.935 235.385 130.706C235.281 130.303 235.156 129.932 234.982 129.593C235.212 129.303 235.4 128.982 235.537 128.638C235.886 127.76 235.956 126.52 235.463 125.675C234.895 124.696 234.322 123.73 233.508 122.93C232.665 122.105 231.787 121.3 230.847 120.578C229.291 119.389 227.58 118.468 225.783 117.674C224.552 117.131 223.218 116.82 221.908 116.519C220.595 116.219 219.206 116.294 217.874 116.361C216.352 116.438 214.853 116.943 213.41 117.387C208.61 118.862 205.189 123.017 203.288 127.438C202.53 129.201 202.154 131.141 201.847 133.022C201.703 133.912 201.553 134.817 201.491 135.719C201.376 137.345 201.294 138.955 201.363 140.59C201.419 141.902 201.562 143.176 201.846 144.461C202.174 145.957 202.723 147.425 203.377 148.808C203.935 149.992 204.671 151.104 205.425 152.172C206.128 153.17 207.069 154.013 208.014 154.783C209.085 155.654 210.586 156.121 211.936 156.362C213.519 156.643 215.093 156.604 216.693 156.415C218.27 156.233 219.832 155.699 221.342 155.232C222.352 154.916 223.346 154.569 224.322 154.156C224.739 153.979 225.146 153.78 225.54 153.565C228.483 151.951 230.803 149.319 232.805 146.703Z" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path fill-rule="evenodd" clip-rule="evenodd" d="M169.749 119.35C168.825 119.971 168.109 120.717 167.351 121.527C166.45 122.492 165.873 123.785 165.326 124.959C164.845 125.988 164.534 127.085 164.277 128.195C162.438 128.005 160.603 129.069 159.939 130.831C158.879 133.666 158.911 136.615 159.437 139.552C159.678 140.893 160.124 142.212 160.535 143.51C160.888 144.626 161.265 145.727 161.735 146.802C162.086 147.609 162.592 148.376 163.085 149.104C163.563 149.815 164.081 150.465 164.684 151.083C165.38 151.796 166.171 152.466 166.973 153.07C167.638 153.568 168.424 153.923 169.16 154.302C168.831 154.134 168.504 153.964 168.174 153.796C169.14 154.291 170.071 154.748 171.093 155.106C172.226 155.503 173.411 155.73 174.583 155.978C176.75 156.436 179.063 156.301 181.215 155.841C183.48 155.357 185.576 154.413 187.499 153.166C191.327 150.684 194.19 146.793 195.457 142.475C196.099 140.289 196.25 138.119 196.001 135.861C195.893 134.872 195.754 133.894 195.558 132.917C195.094 130.63 194.399 128.337 193.415 126.215C192.986 125.292 192.436 124.418 191.869 123.572C191.539 123.08 191.185 122.62 190.802 122.162C190.317 121.591 189.707 121.119 189.152 120.618C188.118 119.685 186.747 119.068 185.489 118.496C184.904 118.231 184.28 118.048 183.673 117.841C181.887 117.23 179.991 116.912 178.104 116.912C175.153 116.911 172.223 117.69 169.749 119.35Z" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path opacity="0.503384" d="M235.464 179.408C235.536 182.688 235.585 186.889 235.643 190.169C235.672 191.806 235.74 193.438 235.809 195.068C235.871 196.568 235.966 198.064 236.019 199.567C236.059 200.706 236.094 201.844 236.125 202.983C236.124 202.967 236.124 202.952 236.123 202.936C236.163 205.111 236.187 207.289 236.248 209.463C236.309 211.609 236.385 213.754 236.443 215.903C236.476 217.646 236.499 219.389 236.533 221.132C236.551 222.06 236.569 222.988 236.533 221.132C236.551 222.06 236.569 222.988 236.587 223.916C236.607 224.895 236.634 225.877 236.615 226.858" stroke="#000000" stroke-opacity="0.9" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path> <path opacity="0.503384" d="M219.261 175.936C219.333 180.416 219.382 186.154 219.44 190.634C219.469 192.869 219.537 195.099 219.606 197.325C219.668 199.375 219.763 201.418 219.816 203.47C219.855 205.026 219.891 206.58 219.921 208.136C219.921 208.115 219.921 208.093 219.92 208.072C219.96 211.043 219.984 214.018 220.045 216.986C220.106 219.918 220.182 222.848 220.24 225.782C220.273 228.164 220.296 230.544 220.33 232.925C220.348 234.192 220.366 235.46 220.384 236.727C220.404 238.065 220.431 239.405 220.412 240.746" stroke="#000000" stroke-opacity="0.9" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path> <path opacity="0.503384" d="M162.552 179.408C162.671 183.248 162.752 188.166 162.848 192.006C162.895 193.922 163.008 195.833 163.122 197.741C163.224 199.498 163.37 212.05 163.47 214.594C163.571 217.107 163.319 219.618 163.414 222.133C163.47 224.175 163.508 226.215 163.563 228.256C163.593 229.342 163.624 230.428 163.653 231.514C163.686 232.661 163.73 233.81 163.698 234.96" stroke="#000000" stroke-opacity="0.9" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path> <path opacity="0.503384" d="M200.754 172.464C200.723 176.824 200.762 181.176 200.909 185.533C201.053 189.733 201.247 193.928 201.486 198.122C201.629 200.68 201.784 203.235 201.939 205.793C201.931 205.63 201.923 205.467 201.917 205.306C202.006 207.189 202.114 209.069 202.169 210.954C202.233 213.14 202.291 215.326 202.33 217.512C202.402 221.466 202.446 225.423 202.624 229.374C202.748 232.184 202.911 234.985 203.15 237.785C203.336 240.01 203.467 242.234 203.585 244.464C203.657 246.542 203.729 248.621 203.77 250.703C203.792 251.9 203.818 253.095 203.84 254.294C203.848 254.783 203.856 255.272 203.867 255.762C203.87 256.025 203.879 256.288 203.884 256.551C203.889 256.865 203.916 257.188 203.906 257.505C203.858 257.64 203.827 257.785 203.815 257.947C203.776 258.42 203.923 258.897 204.216 259.263" stroke="#000000" stroke-opacity="0.9" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path> <path opacity="0.503384" d="M182.227 174.778C182.355 178.762 182.251 187.946 182.354 191.936C182.351 191.789 182.348 191.646 182.346 191.501C182.424 195.324 182.497 199.147 182.564 202.972C182.625 206.484 182.657 209.999 182.69 213.513C182.704 215.028 182.711 216.545 182.722 218.061C182.732 219.53 182.76 221 182.781 222.469C182.8 223.971 182.846 225.473 182.88 226.976C182.908 228.228 182.941 229.478 182.972 230.73C183.019 232.951 183.059 235.172 183.098 237.393C183.14 239.711 183.218 242.021 183.278 244.336C183.278 244.323 183.277 244.309 183.277 244.296C183.296 245.214 183.314 246.131 183.33 247.05L183.356 248.558C183.365 249.04 183.372 249.523 183.384 250.005" stroke="#000000" stroke-opacity="0.9" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M107.972 355.322C102.224 294.943 121.961 259.451 167.181 248.848" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M238.936 247.69C274.427 247.69 292.173 283.567 292.173 355.322" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M168.339 250.005C172.192 264.219 183.708 282.736 202.888 305.557C220.283 281.301 230.756 262.784 234.307 250.005" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M203.059 304.399L204.216 342.591" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M134.776 304.978H172.968" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M251.387 204.869C252.167 204.187 252.747 203.432 253.267 202.553C253.486 202.178 253.706 201.804 253.928 201.432C254.419 200.6 254.942 199.784 255.486 198.986C256.574 197.384 257.884 195.944 258.916 194.307C260.062 192.493 260.916 190.487 261.817 188.549C262.639 186.778 263.51 185.033 264.34 183.266C265.954 179.829 267.572 176.402 268.925 172.855C269.586 171.117 270.025 169.285 270.451 167.477C270.955 165.338 271.452 163.193 271.841 161.028C272.548 157.092 273.136 153.13 273.446 149.142C273.741 145.305 273.654 141.43 273.601 137.588C273.548 133.481 283.251 128.921 283 124.822C282.786 121.325 272.437 118.307 271.867 114.85C271.291 111.382 270.785 107.905 270.039 104.466C269.63 102.582 269.183 100.707 268.741 98.8294C268.332 97.0788 267.969 95.3201 267.545 93.5726C267.048 91.5263 266.519 89.4659 265.767 87.4925C265.564 86.959 265.353 86.4314 265.135 85.9076C264.835 85.3206 264.539 84.7329 264.247 84.1429C263.667 82.9757 263.11 81.7995 262.568 80.6166C261.857 79.3564 261.088 78.1245 260.308 76.9104C259.338 75.3924 258.352 73.8797 257.317 72.4055C255.203 69.3896 253.004 66.4175 250.478 63.7271C248.978 62.1281 247.366 60.5462 245.545 59.3009C243.901 58.1753 242.229 57.0979 240.553 56.0213C238.609 54.7708 236.682 53.5344 234.614 52.489C233.766 52.0595 232.921 51.6679 232.05 51.2905C231.048 50.861 229.974 50.5475 228.942 50.196C225.141 48.9106 221.286 47.8629 217.371 46.9862C213.216 46.0544 208.97 45.619 204.757 45.0098C201.178 44.4904 197.593 44 193.991 44C192.35 44 190.704 44.1011 189.058 44.3477C187.023 44.6524 185.002 44.9949 182.993 45.4593C181.114 45.8977 179.256 46.4259 177.4 46.9542C175.607 47.4654 173.803 47.9328 172.019 48.4841C169.993 49.1105 168.022 49.8364 166.078 50.6812C164.367 51.4242 162.742 52.321 161.136 53.261C160.101 53.865 154.153 57.2686 143.849 70.0316C133.546 82.7945 129.271 111.662 129.075 113.428C128.655 117.222 128.18 121.008 127.999 124.822C127.818 128.649 116.941 133.759 117 137.588C117.027 139.323 127.88 139.778 127.946 141.509C128.026 143.674 128.216 145.822 128.462 147.976C128.871 151.586 129.254 155.208 129.9 158.787C130.592 162.623 131.274 166.466 132.187 170.258C132.609 172.021 133.089 173.772 133.546 175.53C133.99 177.24 134.412 178.959 134.907 180.656C135.464 182.567 136.04 184.473 136.601 186.385C137.203 188.431 137.787 190.486 138.532 192.484C138.985 193.696 139.587 194.83 140.228 195.956C140.916 197.173 141.643 198.356 142.399 199.531C143.239 200.869 144.048 202.227 145.072 203.439" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M154.451 130.819C154.125 130.805 153.8 130.8 153.476 130.8C151.667 130.8 149.883 130.987 148.079 131.183C146.838 131.316 145.596 131.417 144.352 131.535C142.029 131.761 139.736 132.178 137.422 132.462C136.446 132.581 135.471 132.684 134.507 132.877C133.318 133.114 132.152 133.544 131.016 133.952C130.095 134.285 129.187 134.658 128.278 135.02C127.303 135.407 126.33 135.911 125.518 136.586" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M275.708 129.33C275.169 128.625 274.629 128.05 273.813 127.654C273.098 127.31 272.326 127.088 271.534 127.006L271.488 127.001C270.534 126.907 269.563 126.899 268.605 126.855C267.27 126.797 265.938 126.845 264.604 126.912C263.101 126.988 261.603 127.166 260.101 127.266C258.599 127.368 257.092 127.374 255.588 127.415C254.31 127.453 253.03 127.506 251.75 127.501C250.266 127.495 248.785 127.477 247.301 127.55C245.81 127.621 244.323 127.754 242.831 127.811C241.443 127.864 240.069 128.006 238.689 128.141" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M193.839 133.742C193.113 134.822 202.609 134.066 201.859 133.114" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>`,
                }}
              />
              No transactions yet
            </p>
          ) : (
            walletTx.map((t) => (
              <div key={t.id} className={headerStyles.walletModalTxRow}>
                <span className={headerStyles.walletModalTxLeft}>{t.source}</span>
                <span className={headerStyles.walletModalTxRight}>
                  {t.type === 'credit' ? '+' : '-'}₹{formatWalletAmount(t.amount)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

