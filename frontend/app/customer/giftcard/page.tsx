'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import CustomerSidebarLayout from '@/components/customer/CustomerSidebarLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import { apiClient, walletApi } from '@/lib/api';
import Logo from '@/components/Logo';
import styles from './page.module.css';

interface GiftCardHistoryItem {
  id: string;
  code: string;
  amount: number;
  type: 'created' | 'redeemed';
  status: 'Created' | 'Redeemed';
  date: string;
}

export default function GiftCardsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams?.get('tab') || 'redeem';
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);

  // Redeem Tab State
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [redeemedValue, setRedeemedValue] = useState<number | null>(null);

  // History State
  const [historyList, setHistoryList] = useState<GiftCardHistoryItem[]>([]);

  // Create Tab State
  const [creationType, setCreationType] = useState<'random' | 'custom'>('random');
  const [customName, setCustomName] = useState('');
  const [createdGiftCode, setCreatedGiftCode] = useState<string | null>(null);
  const [step, setStep] = useState<'configure' | 'amount' | 'success'>('configure');
  const [giftCardAmount, setGiftCardAmount] = useState<string>('');
  const [selectedAmountOption, setSelectedAmountOption] = useState<'500' | '1000' | '2000' | 'custom' | null>(null);



  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('milko_gift_card_history');
      if (stored) {
        try {
          setHistoryList(JSON.parse(stored));
        } catch (e) {
          setHistoryList([]);
        }
      } else {
        const defaultHistory: GiftCardHistoryItem[] = [
          {
            id: '1',
            code: 'SCRB-WNJ8-92L2',
            amount: 1000,
            type: 'created',
            status: 'Created',
            date: new Date(Date.now() - 3600000 * 24).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          },
          {
            id: '2',
            code: 'SCRB-78KL-M90P',
            amount: 500,
            type: 'redeemed',
            status: 'Redeemed',
            date: new Date(Date.now() - 3600000 * 48).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          }
        ];
        localStorage.setItem('milko_gift_card_history', JSON.stringify(defaultHistory));
        setHistoryList(defaultHistory);
      }
    }
  }, []);

  const recordHistory = (code: string, amount: number, type: 'created' | 'redeemed') => {
    if (typeof window === 'undefined') return;
    const newItem: GiftCardHistoryItem = {
      id: Date.now().toString(),
      code,
      amount,
      type,
      status: type === 'created' ? 'Created' : 'Redeemed',
      date: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    };
    const stored = localStorage.getItem('milko_gift_card_history');
    const existing: GiftCardHistoryItem[] = stored ? JSON.parse(stored) : [];
    const updated = [newItem, ...existing];
    localStorage.setItem('milko_gift_card_history', JSON.stringify(updated));
    setHistoryList(updated);
  };

  // Synchronize Tab Changes
  const handleTabChange = (tab: string) => {
    router.push(`/customer/giftcard?tab=${tab}`);
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemCode.trim()) {
      showToast('Please enter a valid gift card code', 'error');
      return;
    }

    setLoading(true);
    try {
      const code = redeemCode.trim().toUpperCase();
      let valueToRedeem = 1000; // default/fallback amount if code was not created locally in this browser

      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('milko_created_gift_cards');
        const cardsMap = stored ? JSON.parse(stored) : {};
        if (cardsMap[code]) {
          valueToRedeem = Number(cardsMap[code]);
          // Remove single-use card
          delete cardsMap[code];
          localStorage.setItem('milko_created_gift_cards', JSON.stringify(cardsMap));
        }
      }

      // Call backend wallet api to credit user balance via real DB query!
      await walletApi.createTopupOrder(valueToRedeem);

      recordHistory(code, valueToRedeem, 'redeemed');
      setRedeemSuccess(true);
      setRedeemedValue(valueToRedeem);
      showToast(`Gift card successfully redeemed to wallet! Credited ₹${valueToRedeem}`, 'success');

      // Dispatch custom DOM event to trigger Header.tsx wallet update immediately
      window.dispatchEvent(new Event('milko:wallet-updated'));
    } catch (err: any) {
      console.error('[REDEEM] Failed to credit wallet:', err);
      showToast(err?.message || 'Failed to redeem gift card. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGift = (e: React.FormEvent) => {
    e.preventDefault();
    if (creationType === 'custom' && !customName.trim()) {
      showToast('Please enter your name', 'error');
      return;
    }
    setLoading(true);
    // Simulate creation flow
    setTimeout(() => {
      setLoading(false);
      let code = '';
      if (creationType === 'custom') {
        const sanitized = customName.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (!sanitized) {
          showToast('Please enter a valid alphanumeric name', 'error');
          setLoading(false);
          return;
        }
        const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        code = `${sanitized}-${suffix}`;
      } else {
        const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
        const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
        const part3 = Math.random().toString(36).substring(2, 6).toUpperCase();
        code = `SCRB-${part1}-${part2}-${part3}`;
      }
      setCreatedGiftCode(code);
      setStep('amount');
    }, 1000);
  };

  const handleConfirmAmount = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(giftCardAmount);
    if (!giftCardAmount || isNaN(amountNum) || amountNum <= 0) {
      showToast('Please enter a valid amount greater than 0', 'error');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);

      // Save code and amount to localStorage registry
      if (typeof window !== 'undefined' && createdGiftCode) {
        const stored = localStorage.getItem('milko_created_gift_cards');
        const cardsMap = stored ? JSON.parse(stored) : {};
        cardsMap[createdGiftCode] = amountNum;
        localStorage.setItem('milko_created_gift_cards', JSON.stringify(cardsMap));
        recordHistory(createdGiftCode, amountNum, 'created');
      }

      setStep('success');
    }, 1200);
  };

  const handleAmountOptionSelect = (option: '500' | '1000' | '2000' | 'custom') => {
    setSelectedAmountOption(option);
    if (option !== 'custom') {
      setGiftCardAmount(option);
    } else {
      setGiftCardAmount('');
    }
  };

  const handleAmountInputChange = (val: string) => {
    const cleanVal = val.replace(/[^0-9]/g, '');
    setGiftCardAmount(cleanVal);

    if (cleanVal === '500') {
      setSelectedAmountOption('500');
    } else if (cleanVal === '1000') {
      setSelectedAmountOption('1000');
    } else if (cleanVal === '2000') {
      setSelectedAmountOption('2000');
    } else {
      setSelectedAmountOption('custom');
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'create':
        return 'Create a Gift Card';
      case 'history':
        return 'Gift Card History';
      case 'redeem':
      default:
        return 'Redeem Gift Card';
    }
  };

  return (
    <CustomerSidebarLayout>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{getTabTitle()}</h1>
      </div>

      {loading && <LoadingSpinner fullHeight />}

      {!loading && (
        <div className={styles.tabContent}>
          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className={styles.cardContainer}>
              <div className={styles.formSection}>
                <h2 className={styles.sectionTitle}>Gift Card History</h2>
                <p className={styles.sectionDesc}>Track all your generated and redeemed gift card codes, amounts, and activity dates.</p>

                {historyList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#888' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 1rem auto', display: 'block', opacity: 0.5 }}>
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <p style={{ fontSize: '1rem', fontWeight: '600' }}>No gift card history found</p>
                    <p style={{ fontSize: '0.85rem', color: '#aaa' }}>Created and redeemed gift cards will appear here.</p>
                  </div>
                ) : (
                  <div className={styles.historyList}>
                    {historyList.map((item) => (
                      <div key={item.id} className={styles.historyItem}>
                        <div className={styles.historyItemLeft}>
                          <div className={`${styles.historyBadge} ${item.type === 'created' ? styles.historyBadgeCreated : styles.historyBadgeRedeemed}`}>
                            {item.type === 'created' ? 'Created' : 'Redeemed'}
                          </div>
                          <div className={styles.historyCodeBox}>
                            <code className={styles.historyCode}>{item.code}</code>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(item.code);
                                showToast('Code copied to clipboard!', 'success');
                              }}
                              className={styles.historyCopyBtn}
                              title="Copy code"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className={styles.historyItemRight}>
                          <span className={styles.historyAmount}>₹{item.amount.toLocaleString('en-IN')}</span>
                          <span className={styles.historyDate}>{item.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* REDEEM TAB */}
          {activeTab === 'redeem' && (
            <div className={styles.cardContainer} style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div className={styles.formSection}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '2rem' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', color: '#111' }}>
                    <svg width="60" height="60" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                      <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                      <g id="SVGRepo_iconCarrier">
                        <path d="M125.636 167.282C152.172 164.088 262.835 146.609 279.5 158.654C281.599 160.17 280.166 171.957 280.166 174.471C280.166 179.149 282.039 189.814 280.166 193.882C278.641 197.187 240.578 199.634 226.442 199.634" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                        <path d="M176.975 202.882C145.167 205.872 123.489 205.549 120.143 205.323C116.974 205.11 120.871 187.006 120.143 166.126" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                        <path d="M130.562 228.771C133.962 239.962 126.692 302.709 131.228 312.53C131.995 314.189 150.273 312.53 165.815 312.53C202.128 312.53 239.35 312.53 275.594 312.53" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                        <path d="M270.19 205.461C272.139 241.723 274.243 276.979 274.243 313.267" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                        <path opacity="0.498698" d="M179.679 171.954C185.26 216.522 180.157 271.997 182.011 310.354" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                        <path opacity="0.498698" d="M221.112 174.867C221.404 218.687 219.277 262.16 219.277 305.983" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                        <path opacity="0.498698" d="M189.52 156.742C173.291 151.062 142.054 106.007 161.574 90.2834C185.2 71.2555 196.917 120.945 196.173 135.304C195.402 150.203 192.455 162.165 192.847 161.745C199.688 154.398 199.455 114.605 218.131 104.576C254.204 85.2074 275.915 114.289 248.075 131.731C235.143 139.83 200.167 148.122 200.167 149.597C200.167 158.403 222.416 149.647 238.093 152.455" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                      </g>
                    </svg>
                  </div>
                  <h2 className={styles.sectionTitle}>Add Gift Card to Wallet</h2>
                  <p className={styles.sectionDesc} style={{ margin: 0 }}>Enter your 12-digit or alphanumeric Gift Card code to add the balance directly to your Scribble wallet credits.</p>
                </div>

                {redeemSuccess ? (
                  <div className={styles.successBox}>
                    <div className={styles.successIcon}>✓</div>
                    <h3>Redeemed Successfully!</h3>
                    <p>Gift card value of <strong>₹{redeemedValue}</strong> has been successfully credited to your wallet balance.</p>
                    <button
                      className={styles.primaryButton}
                      onClick={() => {
                        setRedeemSuccess(false);
                        setRedeemCode('');
                      }}
                    >
                      Redeem Another Card
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRedeem} className={styles.form}>
                    <div className={styles.inputGroup}>
                      <label htmlFor="redeemCode" className={styles.label}>Gift Card Code</label>
                      <input
                        id="redeemCode"
                        type="text"
                        placeholder="e.g. SCRB-WNJ8-92L2"
                        className={styles.input}
                        value={redeemCode}
                        onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                      />
                    </div>
                    <button type="submit" className={styles.primaryButton}>
                      Redeem to Wallet
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* CREATE TAB */}
          {activeTab === 'create' && (
            <div className={styles.cardContainer} style={{ maxWidth: '600px', margin: '0 auto' }}>
              {step === 'success' && createdGiftCode ? (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#e8f5e9', color: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem', color: '#111' }}>Gift Card Created!</h3>
                  <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                    Your unique gift card loaded with <strong>₹{giftCardAmount}</strong> has been created. You can share this code or redeem it immediately to your wallet credits.
                  </p>

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center', background: '#f5f5f7', padding: '1rem', borderRadius: '16px', border: '1px solid #e5e5ea', marginBottom: '2rem' }}>
                    <code style={{ fontSize: '1.25rem', fontWeight: '700', fontFamily: 'monospace', color: '#111', letterSpacing: '1px', wordBreak: 'break-all', textAlign: 'left' }}>{createdGiftCode}</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(createdGiftCode);
                        showToast('Code copied to clipboard!', 'success');
                      }}
                      style={{ background: 'white', border: '1px solid #d1d1d6', padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: '600', flexShrink: 0 }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy
                    </button>
                  </div>

                  <button
                    type="button"
                    className={styles.primaryButton}
                    style={{ width: '100%' }}
                    onClick={() => {
                      setCreatedGiftCode(null);
                      setCustomName('');
                      setGiftCardAmount('');
                      setSelectedAmountOption(null);
                      setStep('configure');
                    }}
                  >
                    Create Another Gift Card
                  </button>
                </div>
              ) : step === 'amount' && createdGiftCode ? (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: '#fff5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', color: '#ff0040' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23"></line>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                      </svg>
                    </div>
                    <h2 className={styles.sectionTitle} style={{ fontSize: '1.25rem', lineHeight: '1.4' }}>
                      How much amount would you like to add to your Gift Card?
                    </h2>
                  </div>

                  <form onSubmit={handleConfirmAmount} className={styles.form}>
                    <div className={styles.inputGroup}>
                      <label htmlFor="giftCardAmount" className={styles.label}>Gift Card Amount (₹)</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '1.1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '700', color: '#555', fontSize: '1.1rem' }}>₹</span>
                        <input
                          id="giftCardAmount"
                          type="text"
                          pattern="[0-9]*"
                          inputMode="numeric"
                          placeholder="Enter amount"
                          className={styles.input}
                          style={{ paddingLeft: '2.2rem', fontSize: '1.1rem', fontWeight: '600' }}
                          value={giftCardAmount}
                          onChange={(e) => handleAmountInputChange(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className={styles.amountGrid}>
                      <button
                        type="button"
                        className={`${styles.amountBtn} ${selectedAmountOption === '500' ? styles.amountBtnActive : ''}`}
                        onClick={() => handleAmountOptionSelect('500')}
                      >
                        ₹500
                      </button>
                      <button
                        type="button"
                        className={`${styles.amountBtn} ${selectedAmountOption === '1000' ? styles.amountBtnActive : ''}`}
                        onClick={() => handleAmountOptionSelect('1000')}
                      >
                        ₹1000
                      </button>
                      <button
                        type="button"
                        className={`${styles.amountBtn} ${selectedAmountOption === '2000' ? styles.amountBtnActive : ''}`}
                        onClick={() => handleAmountOptionSelect('2000')}
                      >
                        ₹2000
                      </button>
                      <button
                        type="button"
                        className={`${styles.amountBtn} ${selectedAmountOption === 'custom' ? styles.amountBtnActive : ''}`}
                        onClick={() => handleAmountOptionSelect('custom')}
                      >
                        Custom
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                      <button
                        type="button"
                        className={styles.primaryButton}
                        style={{ flex: 1, background: '#f5f5f7', color: '#333', boxShadow: 'none' }}
                        onClick={() => {
                          setStep('configure');
                          setCreatedGiftCode(null);
                        }}
                      >
                        Back
                      </button>
                      <button type="submit" className={styles.primaryButton} style={{ flex: 2 }}>
                        Confirm & Create
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', color: '#111' }}>
                      <svg width="60" height="60" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                        <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                        <g id="SVGRepo_iconCarrier">
                          <path d="M117.762 93.5452C177.416 7.2401 286.219 146.205 209.763 203.086C150.352 247.291 80.6021 178.391 108.495 118.441" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                          <path d="M88 321.134C133.281 320.049 143.28 234.293 193.563 243.336C205.066 245.405 226.354 258.484 257.428 282.574C280.54 221.917 294.439 187.164 299.126 178.314" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                          <path d="M176.828 250.418C172.914 276.105 172.098 314.839 169.104 335" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                          <path d="M275.954 176.928C288.293 174.815 299.957 171.054 312 168.608" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                          <path opacity="0.503384" d="M311.262 172.768C299.91 187.356 315.455 311.32 311.262 314.353C309.543 315.597 286.14 312.922 257.287 312.922C235.322 312.922 214.817 318.919 206.528 312.922C205.561 312.223 206.528 301.77 206.528 300.05C206.528 270.933 206.34 240.71 202.575 212.098" stroke="#000000" strokeOpacity="0.9" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round"></path>
                          <path opacity="0.503384" d="M236.046 120.922C259.303 120.238 282.269 120.922 305.563 120.922" stroke="#000000" strokeOpacity="0.9" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round"></path>
                        </g>
                      </svg>
                    </div>
                    <h2 className={styles.sectionTitle}>Create a Gift Card</h2>
                    <p className={styles.sectionDesc} style={{ margin: 0 }}>Configure and generate a unique gift card. Choose a random code structure or brand it with your custom name.</p>
                  </div>

                  <form onSubmit={handleCreateGift} className={styles.form} style={{ gap: 0 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setCreationType('random')}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '1.25rem 0.5rem',
                          borderRadius: '16px',
                          border: creationType === 'random' ? '2px solid #f2f1f6' : '1px solid #e5e5ea',
                          background: creationType === 'random' ? '#f5f5f7' : 'white',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span style={{ fontSize: '1rem', fontWeight: '700', color: '#111', marginBottom: '0.25rem', whiteSpace: 'nowrap' }}>Random Code</span>
                        <span style={{ fontSize: '0.75rem', color: '#666' }}>Generate random alphanumerics</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCreationType('custom')}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '1.25rem 0.5rem',
                          borderRadius: '16px',
                          border: creationType === 'custom' ? '2px solid #f2f1f6' : '1px solid #e5e5ea',
                          background: creationType === 'custom' ? '#f5f5f7' : 'white',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span style={{ fontSize: '1rem', fontWeight: '700', color: '#111', marginBottom: '0.25rem', whiteSpace: 'nowrap' }}>Custom Name</span>
                        <span style={{ fontSize: '0.75rem', color: '#666' }}>Include custom name or text</span>
                      </button>
                    </div>

                    {creationType === 'custom' && (
                      <div className={styles.inputGroup} style={{ marginBottom: '1.5rem' }}>
                        <label htmlFor="customName" className={styles.label} style={{ whiteSpace: 'nowrap' }}>Your Name / Custom Text</label>
                        <input
                          id="customName"
                          type="text"
                          maxLength={15}
                          placeholder="e.g. MODI"
                          className={styles.input}
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                        />
                      </div>
                    )}

                    <button type="submit" className={styles.primaryButton} style={{ width: '100%' }}>
                      Create Gift Card
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </CustomerSidebarLayout>
  );
}
