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

  // PVC Tab State
  const [pvcTheme, setPvcTheme] = useState<'classic-black' | 'signature-gold' | 'custom'>('classic-black');
  const [pvcBackTheme, setPvcBackTheme] = useState<'classic-black' | 'signature-gold' | 'custom'>('classic-black');
  const [pvcCustomImage, setPvcCustomImage] = useState<string | null>(null);
  const [disableTextShadow, setDisableTextShadow] = useState<boolean>(false);
  const [frontImgPos, setFrontImgPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [backImgPos, setBackImgPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [frontImgFlip, setFrontImgFlip] = useState<boolean>(false);
  const [backImgFlip, setBackImgFlip] = useState<boolean>(false);
  const [frontImgRotate, setFrontImgRotate] = useState<number>(0);
  const [backImgRotate, setBackImgRotate] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startClientX: number; startClientY: number; startPosX: number; startPosY: number }>({ startClientX: 0, startClientY: 0, startPosX: 50, startPosY: 50 });
  const [customBg, setCustomBg] = useState<string>('linear-gradient(135deg, #111827, #374151)');
  const [customTextColor, setCustomTextColor] = useState<string>('#ffffff');
  const [showCustomPicker, setShowCustomPicker] = useState<boolean>(false);
  const [pvcQuantity, setPvcQuantity] = useState<number>(1);
  const [shippingPincode, setShippingPincode] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [pvcMessage, setPvcMessage] = useState('');
  const [pvcActiveStep, setPvcActiveStep] = useState<1 | 2>(1);
  const [pvcOrderSuccess, setPvcOrderSuccess] = useState(false);
  const [pvcOrderNumber, setPvcOrderNumber] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [pvcAmountOption, setPvcAmountOption] = useState<'500' | '1000' | '2000' | 'custom'>('1000');
  const [pvcAmount, setPvcAmount] = useState<number>(1000);

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

  const handleOrderPvc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingAddress.trim() || shippingPincode.length !== 6) {
      showToast('Please enter a valid address and 6-digit pincode', 'error');
      return;
    }
    setLoading(true);
    try {
      const addressObj = {
        name: user?.name || 'Customer',
        street: shippingAddress.trim(),
        city: 'Delhi',
        state: 'Delhi',
        postalCode: shippingPincode.trim(),
        country: 'India',
        phone: user?.phone || '9999999999'
      };

      const data = await apiClient.post<{
        id?: string;
        orderNumber?: string;
      }>('/api/orders', {
        paymentMethod: 'cod',
        deliveryAddress: addressObj,
        items: [
          {
            productId: 8, // PVC Keepsake Card catalog ID
            variationId: null,
            quantity: pvcQuantity,
            customizations: {
              finishFront: pvcThemes[pvcTheme].name,
              finishBack: pvcThemes[pvcBackTheme].name,
              message: pvcMessage,
              amount: pvcAmount
            }
          }
        ],
        subscriptionItem: null
      });

      setPvcOrderNumber(data.orderNumber || 'N/A');
      setPvcOrderSuccess(true);
      showToast('Physical PVC Gift Card order placed successfully!', 'success');
    } catch (err: any) {
      console.error('[PVC_ORDER] Failed to place order:', err);
      showToast(err?.message || 'Failed to place order. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePvcAmountOptionSelect = (option: '500' | '1000' | '2000' | 'custom') => {
    setPvcAmountOption(option);
    if (option !== 'custom') {
      setPvcAmount(Number(option));
    }
  };

  const handlePvcAmountInputChange = (val: string) => {
    const cleanVal = val.replace(/\D/g, '');
    setPvcAmount(cleanVal ? Number(cleanVal) : 0);
    if (cleanVal === '500') {
      setPvcAmountOption('500');
    } else if (cleanVal === '1000') {
      setPvcAmountOption('1000');
    } else if (cleanVal === '2000') {
      setPvcAmountOption('2000');
    } else {
      setPvcAmountOption('custom');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        showToast('Image size should be less than 8MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPvcCustomImage(event.target.result as string);
          setPvcTheme('signature-gold');
          setPvcBackTheme('signature-gold');
          showToast('Custom card image uploaded!', 'success');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, isBackFace: boolean = false) => {
    if (!pvcCustomImage || pvcOrderSuccess) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) { }
    setIsDragging(true);
    const activePos = isBackFace ? backImgPos : frontImgPos;
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPosX: activePos.x,
      startPosY: activePos.y
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>, isBackFace: boolean = false) => {
    if (!isDragging || !pvcCustomImage || pvcOrderSuccess) return;
    const cardEl = e.currentTarget;
    const rect = cardEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const deltaX = e.clientX - dragRef.current.startClientX;
    const deltaY = e.clientY - dragRef.current.startClientY;

    const shiftX = (deltaX / rect.width) * 100;
    const shiftY = (deltaY / rect.height) * 100;

    const newX = Math.min(100, Math.max(0, dragRef.current.startPosX - shiftX));
    const newY = Math.min(100, Math.max(0, dragRef.current.startPosY - shiftY));

    if (isBackFace) {
      setBackImgPos({ x: Math.round(newX), y: Math.round(newY) });
    } else {
      setFrontImgPos({ x: Math.round(newX), y: Math.round(newY) });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) { }
      setIsDragging(false);
    }
  };

  if (!user) {
    return (
      <CustomerSidebarLayout>
        <LoadingSpinner fullHeight />
      </CustomerSidebarLayout>
    );
  }



  const pvcThemes: Record<string, { name: string; bg: string; border: string; color: string }> = {
    'classic-black': { name: 'Carbon Black', bg: '#121212', border: 'none', color: '#ffffff' },
    'signature-gold': { name: 'Custom Image', bg: '#ffffff', border: '1px solid #e5e5ea', color: '#111111' },
    'custom': { name: 'Custom Gradient', bg: customBg, border: '1px solid rgba(0,0,0,0.1)', color: customTextColor }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'create':
        return 'Create a Gift Card';
      case 'pvc':
        return 'Order a Physical Card';
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
                          placeholder="e.g. GOPESH"
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

          {/* PVC TAB */}
          {activeTab === 'pvc' && (
            <div className={styles.twoColumnGrid}>
              {pvcOrderSuccess ? (
                <div className={styles.cardContainer} style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: '#e8f8f0',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.25rem auto',
                    boxShadow: 'none'
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '0.5rem', color: '#111' }}>Order Placed Successfully!</h3>
                  <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                    Your physical PVC gift keepsake card order has been submitted.
                  </p>

                  <div style={{ background: '#f5f5f7', padding: '1rem', borderRadius: '16px', border: '1px solid #e5e5ea', marginBottom: '2rem' }}>
                    <p style={{ margin: 0, fontSize: '0.95rem', color: '#333' }}>
                      Order Number: <strong>{pvcOrderNumber}</strong>
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      style={{ flex: 1, background: '#f5f5f7', color: '#333', boxShadow: 'none' }}
                      onClick={() => {
                        router.push('/orders');
                      }}
                    >
                      View Orders
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      style={{ flex: 1 }}
                      onClick={() => {
                        setPvcOrderSuccess(false);
                        setPvcOrderNumber('');
                        setPvcQuantity(1);
                        setShippingAddress('');
                        setShippingPincode('');
                        setPvcMessage('');
                        setPvcActiveStep(1);
                      }}
                    >
                      Order Another Card
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleOrderPvc} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Card 1: Customization */}
                  <div className={styles.cardContainer}>
                    <div className={styles.accordionHeader} onClick={() => setPvcActiveStep(1)}>
                      <div className={styles.accordionTitle}>
                        <span className={`${styles.accordionNumber} ${pvcActiveStep === 1 ? styles.accordionNumberActive : ''}`}>1</span>
                        Customize PVC Card
                      </div>
                      <svg
                        className={`${styles.chevronIcon} ${pvcActiveStep === 1 ? styles.chevronIconRotated : ''}`}
                        width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>

                    <div className={`${styles.accordionContent} ${pvcActiveStep === 1 ? styles.accordionContentActive : ''}`}>
                      <p className={styles.sectionDesc} style={{ marginBottom: '1.5rem' }}>Configure the finish, quantity, and engraving details of your physical keepsake card.</p>
                      <div className={styles.form} style={{ gap: '1.5rem' }}>
                        <div className={styles.inputGroup}>
                          <label className={styles.label}>
                            Select Premium Finish {isFlipped ? '(Back)' : '(Front)'}
                          </label>
                          <div className={styles.themeSelector}>
                            {Object.keys(pvcThemes).map((t) => {
                              const active = (isFlipped ? pvcBackTheme : pvcTheme) === t;
                              const theme = pvcThemes[t as keyof typeof pvcThemes];
                              return (
                                <button
                                  key={t}
                                  type="button"
                                  className={`${styles.themeCardBtn} ${active ? styles.themeCardBtnActive : ''}`}
                                  onClick={() => {
                                    if (isFlipped) {
                                      setPvcBackTheme(t as any);
                                    } else {
                                      setPvcTheme(t as any);
                                    }
                                    if (t === 'custom') {
                                      setShowCustomPicker(true);
                                    }
                                  }}
                                >
                                  <div
                                    className={styles.themeThumbnail}
                                    style={{ background: theme.bg, border: theme.border }}
                                  >
                                    {t === 'classic-black' && (
                                      <>
                                        <div className={styles.microCircle} />
                                        <div className={styles.microLine} />
                                      </>
                                    )}
                                    {t === 'signature-gold' && (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: '#555' }}>
                                        {pvcCustomImage ? (
                                          <div style={{
                                            width: '100%',
                                            height: '100%',
                                            backgroundImage: `url(${pvcCustomImage})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center'
                                          }} />
                                        ) : (
                                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                            <circle cx="8.5" cy="8.5" r="1.5" />
                                            <polyline points="21 15 16 10 5 21" />
                                          </svg>
                                        )}
                                      </div>
                                    )}
                                    {t === 'custom' && (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: customTextColor }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                          <line x1="12" y1="5" x2="12" y2="19"></line>
                                          <line x1="5" y1="12" x2="19" y2="12"></line>
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                  <span className={styles.themeLabelName}>{theme.name}</span>
                                </button>
                              );
                            })}
                          </div>

                          {((isFlipped ? pvcBackTheme : pvcTheme) === 'signature-gold') && (
                            <div style={{
                              background: '#f9f9fb',
                              border: '1.5px dashed #d1d1d6',
                              borderRadius: '18px',
                              padding: '1rem',
                              marginTop: '1rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.65rem',
                              alignItems: 'center',
                              textAlign: 'center'
                            }}>
                              <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#111' }}>
                                Upload Full Card Custom Image
                              </span>
                              <p style={{ fontSize: '0.775rem', color: '#666', margin: 0 }}>
                                Upload your photo or graphic design to cover the whole PVC card surface.
                              </p>

                              {pvcCustomImage ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginTop: '0.25rem' }}>
                                  <div style={{
                                    width: '60px',
                                    height: '38px',
                                    borderRadius: '8px',
                                    backgroundImage: `url(${pvcCustomImage})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    border: '1px solid #ccc',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                  }} />
                                  <button
                                    type="button"
                                    onClick={() => setPvcCustomImage(null)}
                                    title="Delete Custom Image"
                                    style={{
                                      background: '#fff0f2',
                                      color: '#ff0040',
                                      border: '1px solid #ffccd5',
                                      width: '38px',
                                      height: '38px',
                                      borderRadius: '50%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      boxShadow: 'none'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#ff0040';
                                      e.currentTarget.style.color = '#ffffff';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = '#fff0f2';
                                      e.currentTarget.style.color = '#ff0040';
                                    }}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                      <line x1="10" y1="11" x2="10" y2="17" />
                                      <line x1="14" y1="11" x2="14" y2="17" />
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                <label style={{
                                  background: '#ffffff',
                                  border: '1px solid #d1d1d6',
                                  padding: '0.65rem 0.95rem',
                                  borderRadius: '44px',
                                  fontSize: '0.85rem',
                                  fontWeight: '600',
                                  color: '#111',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                                  marginTop: '0.25rem'
                                }}>
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <polyline points="21 15 16 10 5 21" />
                                  </svg>
                                  Choose Custom Photo
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    style={{ display: 'none' }}
                                  />
                                </label>
                              )}

                              {pvcCustomImage && (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.65rem',
                                  marginTop: '0.65rem',
                                  flexWrap: 'wrap'
                                }}>
                                  <button
                                    type="button"
                                    onClick={() => setDisableTextShadow(!disableTextShadow)}
                                    style={{
                                      background: disableTextShadow ? '#fff0f2' : '#ffffff',
                                      color: disableTextShadow ? '#ff0040' : '#333',
                                      border: disableTextShadow ? '1px solid #ff0040' : '1px solid #d1d1d6',
                                      padding: '0.45rem 0.85rem',
                                      borderRadius: '44px',
                                      fontSize: '0.8rem',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      transition: 'all 0.2s ease',
                                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: '15px',
                                        height: '15px',
                                        borderRadius: '155px',
                                        background: disableTextShadow ? '#ff0040' : '#ffffff',
                                        border: disableTextShadow ? 'none' : '1.5px solid #ccc',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s ease',
                                        flexShrink: 0
                                      }}
                                    >
                                      {disableTextShadow && (
                                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      )}
                                    </div>
                                    <span>Disable Text Shadows</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isFlipped) {
                                        setBackImgFlip(!backImgFlip);
                                      } else {
                                        setFrontImgFlip(!frontImgFlip);
                                      }
                                    }}
                                    style={{
                                      background: (isFlipped ? backImgFlip : frontImgFlip) ? '#fff0f2' : '#ffffff',
                                      color: (isFlipped ? backImgFlip : frontImgFlip) ? '#ff0040' : '#333',
                                      border: (isFlipped ? backImgFlip : frontImgFlip) ? '1px solid #ff0040' : '1px solid #d1d1d6',
                                      padding: '0.45rem 0.85rem',
                                      borderRadius: '44px',
                                      fontSize: '0.8rem',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      transition: 'all 0.2s ease',
                                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                                    }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M17 3L21 7L17 11" />
                                      <path d="M3 7H21" />
                                      <path d="M7 21L3 17L7 13" />
                                      <path d="M21 17H3" />
                                    </svg>
                                    Flip Image {(isFlipped ? backImgFlip : frontImgFlip) ? '(Flipped)' : ''}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isFlipped) {
                                        setBackImgRotate((prev) => (prev + 90) % 360);
                                      } else {
                                        setFrontImgRotate((prev) => (prev + 90) % 360);
                                      }
                                    }}
                                    style={{
                                      background: (isFlipped ? backImgRotate : frontImgRotate) > 0 ? '#fff0f2' : '#ffffff',
                                      color: (isFlipped ? backImgRotate : frontImgRotate) > 0 ? '#ff0040' : '#333',
                                      border: (isFlipped ? backImgRotate : frontImgRotate) > 0 ? '1px solid #ff0040' : '1px solid #d1d1d6',
                                      padding: '0.45rem 0.85rem',
                                      borderRadius: '44px',
                                      fontSize: '0.8rem',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      transition: 'all 0.2s ease',
                                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                                    }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                                    </svg>
                                    Rotate Image {(isFlipped ? backImgRotate : frontImgRotate) > 0 ? `(${isFlipped ? backImgRotate : frontImgRotate}°)` : ''}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {showCustomPicker && ((isFlipped ? pvcBackTheme : pvcTheme) === 'custom') && (
                            <div style={{
                              background: '#ffffff',
                              border: '1.5px solid #e5e5ea',
                              borderRadius: '24px',
                              padding: '0.85rem 1.25rem 1.1rem 1.25rem',
                              marginTop: '1rem',
                              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.75rem'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '-0.15rem' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>
                                  Customize {isFlipped ? 'Back' : 'Front'} Card Theme
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setShowCustomPicker(false)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '1rem', fontWeight: '700', padding: '0.2rem' }}
                                >
                                  ✕
                                </button>
                              </div>

                              {/* Background Color & Gradient Selection */}
                              <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#555', marginBottom: '0.5rem' }}>
                                  Choose Background (Solid or Gradient)
                                </label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                  {[
                                    { name: 'Matte Black', val: '#121212' },
                                    { name: 'Midnight Blue', val: 'linear-gradient(135deg, #0f172a, #1e293b)' },
                                    { name: 'Sunset Glow', val: 'linear-gradient(135deg, #ff416c, #ff4b2b)' },
                                    { name: 'Royal Purple', val: 'linear-gradient(135deg, #654ea3, #eaafc8)' },
                                    { name: 'Emerald', val: 'linear-gradient(135deg, #059669, #10b981)' },
                                    { name: 'Ocean Cyan', val: 'linear-gradient(135deg, #0284c7, #38bdf8)' },
                                    { name: 'Rose Gold', val: 'linear-gradient(135deg, #f43f5e, #fb7185)' }
                                  ].map((p) => (
                                    <button
                                      key={p.name}
                                      type="button"
                                      onClick={() => setCustomBg(p.val)}
                                      style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        background: p.val,
                                        border: customBg === p.val ? '2px solid #ff0040' : '1px solid #ddd',
                                        cursor: 'pointer',
                                        boxShadow: customBg === p.val ? '0 0 0 2px rgba(255,0,64,0.3)' : 'none'
                                      }}
                                      title={p.name}
                                    />
                                  ))}
                                  <div style={{ position: 'relative', width: '28px', height: '28px', borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'conic-gradient(from 180deg at 50% 50%, #ff0055, #ff7a00, #ffee00, #10b981, #00dfd8, #7928ca, #ff0055)', cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 8px rgba(255, 0, 85, 0.35)' }} title="Custom Hex Color Picker">
                                    <input
                                      type="color"
                                      value={customBg.startsWith('#') ? customBg : '#121212'}
                                      onChange={(e) => setCustomBg(e.target.value)}
                                      style={{ position: 'absolute', inset: -4, width: '36px', height: '36px', border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0 }}
                                    />
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
                                      <line x1="12" y1="5" x2="12" y2="19"></line>
                                      <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                  </div>
                                </div>
                              </div>

                              {/* Text & Icon Color Selection */}
                              <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#555', marginBottom: '0.5rem' }}>
                                  Choose Text & Icon Color
                                </label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                  {[
                                    { name: 'White', val: '#ffffff' },
                                    { name: 'Black', val: '#000000' },
                                    { name: 'Signature Gold', val: '#dfb858' },
                                    { name: 'Neon Pink', val: '#ff0040' },
                                    { name: 'Electric Cyan', val: '#06b6d4' }
                                  ].map((p) => (
                                    <button
                                      key={p.name}
                                      type="button"
                                      onClick={() => setCustomTextColor(p.val)}
                                      style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        background: p.val,
                                        border: customTextColor === p.val ? '2px solid #ff0040' : '1px solid #ccc',
                                        cursor: 'pointer',
                                        boxShadow: customTextColor === p.val ? '0 0 0 2px rgba(255,0,64,0.3)' : 'none'
                                      }}
                                      title={p.name}
                                    />
                                  ))}
                                  <div style={{ position: 'relative', width: '28px', height: '28px', borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'conic-gradient(from 180deg at 50% 50%, #ff0055, #ff7a00, #ffee00, #10b981, #00dfd8, #7928ca, #ff0055)', cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 8px rgba(255, 0, 85, 0.35)' }} title="Custom Text Color Picker">
                                    <input
                                      type="color"
                                      value={customTextColor.startsWith('#') ? customTextColor : '#ffffff'}
                                      onChange={(e) => setCustomTextColor(e.target.value)}
                                      style={{ position: 'absolute', inset: -4, width: '36px', height: '36px', border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0 }}
                                    />
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
                                      <line x1="12" y1="5" x2="12" y2="19"></line>
                                      <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className={styles.inputGroup}>
                          <label htmlFor="pvcMessage" className={styles.label}>Engraved Message (Optional)</label>
                          <input
                            id="pvcMessage"
                            type="text"
                            maxLength={40}
                            placeholder="e.g. Welcome to the Team!"
                            className={styles.input}
                            value={pvcMessage}
                            onChange={(e) => setPvcMessage(e.target.value)}
                          />
                        </div>

                        <div className={styles.formRow}>
                          <div className={styles.inputGroup}>
                            <label htmlFor="pvcQuantity" className={styles.label}>Quantity</label>
                            <input
                              id="pvcQuantity"
                              type="number"
                              min="1"
                              className={styles.input}
                              value={pvcQuantity}
                              onChange={(e) => setPvcQuantity(Number(e.target.value))}
                            />
                          </div>

                          <div className={styles.inputGroup}>
                            <label htmlFor="pvcAmount" className={styles.label}>
                              Card Amount
                            </label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <span style={{ position: 'absolute', left: '1rem', color: '#666', fontSize: '1.1rem', fontWeight: '600' }}>₹</span>
                              <input
                                id="pvcAmount"
                                type="text"
                                className={styles.input}
                                style={{ paddingLeft: '2.2rem', fontSize: '1.1rem', fontWeight: '600' }}
                                value={pvcAmount || ''}
                                onChange={(e) => handlePvcAmountInputChange(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        <div className={styles.amountGrid} style={{ marginBottom: '0.5rem' }}>
                          {(['500', '1000', '2000', 'custom'] as const).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              className={`${styles.amountBtn} ${pvcAmountOption === opt ? styles.amountBtnActive : ''}`}
                              onClick={() => handlePvcAmountOptionSelect(opt)}
                            >
                              {opt === 'custom' ? 'Custom' : `₹${opt}`}
                            </button>
                          ))}
                        </div>

                        {(() => {
                          const isCustomImageRequiredButMissing = (pvcTheme === 'signature-gold' || pvcBackTheme === 'signature-gold') && !pvcCustomImage;
                          return (
                            <button
                              type="button"
                              disabled={isCustomImageRequiredButMissing}
                              className={styles.primaryButton}
                              style={{
                                alignSelf: 'flex-start',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginTop: '0.5rem',
                                marginBottom: '0.5rem',
                                opacity: isCustomImageRequiredButMissing ? 0.45 : 1,
                                cursor: isCustomImageRequiredButMissing ? 'not-allowed' : 'pointer',
                                filter: isCustomImageRequiredButMissing ? 'grayscale(0.6)' : 'none',
                                transition: 'all 0.2s ease'
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                if (isCustomImageRequiredButMissing) {
                                  showToast('Please upload a custom image for your PVC card before proceeding.', 'error');
                                  return;
                                }
                                setPvcActiveStep(2);
                              }}
                            >
                              Next
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                <polyline points="12 5 19 12 12 19"></polyline>
                              </svg>
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Delivery Address */}
                  <div className={styles.cardContainer}>
                    <div
                      className={styles.accordionHeader}
                      onClick={() => {
                        const isCustomImageRequiredButMissing = (pvcTheme === 'signature-gold' || pvcBackTheme === 'signature-gold') && !pvcCustomImage;
                        if (isCustomImageRequiredButMissing) {
                          showToast('Please upload a custom image for your PVC card before proceeding.', 'error');
                          return;
                        }
                        setPvcActiveStep(2);
                      }}
                    >
                      <div className={styles.accordionTitle}>
                        <span className={`${styles.accordionNumber} ${pvcActiveStep === 2 ? styles.accordionNumberActive : ''}`}>2</span>
                        Delivery Address
                      </div>
                      <svg
                        className={`${styles.chevronIcon} ${pvcActiveStep === 2 ? styles.chevronIconRotated : ''}`}
                        width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>

                    <div className={`${styles.accordionContent} ${pvcActiveStep === 2 ? styles.accordionContentActive : ''}`}>
                      <p className={styles.sectionDesc} style={{ marginBottom: '1.5rem' }}>Specify the shipping address where the physical card should be delivered.</p>
                      <div className={styles.form} style={{ gap: '1.5rem' }}>
                        <div className={styles.inputGroup}>
                          <label htmlFor="shippingPincode" className={styles.label}>Shipping Pincode</label>
                          <input
                            id="shippingPincode"
                            type="text"
                            maxLength={6}
                            placeholder="e.g. 110001"
                            className={styles.input}
                            value={shippingPincode}
                            onChange={(e) => setShippingPincode(e.target.value.replace(/\D/g, ''))}
                          />
                        </div>

                        <div className={styles.inputGroup}>
                          <label htmlFor="shippingAddress" className={styles.label}>Delivery Address</label>
                          <textarea
                            id="shippingAddress"
                            rows={3}
                            placeholder="Full delivery location details"
                            className={styles.textarea}
                            value={shippingAddress}
                            onChange={(e) => setShippingAddress(e.target.value)}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                          <button
                            type="button"
                            className={styles.primaryButton}
                            style={{ background: '#f5f5f7', color: '#333', boxShadow: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            onClick={(e) => {
                              e.preventDefault();
                              setPvcActiveStep(1);
                            }}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(180deg)' }}>
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                              <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                            Back
                          </button>
                          <button type="submit" className={styles.primaryButton} style={{ flex: 1 }}>
                            Order PVC Cards (₹250 each)
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {/* Preview Column */}
              <div className={styles.previewContainer}>
                <h3 className={styles.previewTitle}>PVC Card Mockup</h3>

                <div className={styles.pvcCardWrapper}>
                  <div className={`${styles.pvcCardInner} ${isFlipped ? styles.pvcCardInnerFlipped : ''}`}>
                    {/* Front Face */}
                    <div
                      className={`${styles.pvcCardFace} ${styles.pvcCardFront}`}
                      onPointerDown={(e) => handlePointerDown(e, false)}
                      onPointerMove={(e) => handlePointerMove(e, false)}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      style={{
                        background: (pvcTheme === 'signature-gold' && pvcCustomImage) ? 'transparent' : pvcThemes[pvcTheme].bg,
                        border: pvcThemes[pvcTheme].border,
                        color: (pvcTheme === 'signature-gold' && pvcCustomImage) ? '#ffffff' : pvcThemes[pvcTheme].color,
                        cursor: (pvcCustomImage && !pvcOrderSuccess) ? (isDragging ? 'grabbing' : 'grab') : 'default',
                        userSelect: 'none',
                        touchAction: pvcCustomImage ? 'none' : 'auto'
                      }}
                    >
                      {(pvcTheme === 'signature-gold' && pvcCustomImage) && (
                        <img
                          src={pvcCustomImage}
                          alt="Front Card Background"
                          style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: `${frontImgPos.x}% ${frontImgPos.y}%`,
                            transform: `scaleX(${frontImgFlip ? -1 : 1}) rotate(${frontImgRotate}deg)`,
                            pointerEvents: 'none',
                            zIndex: 0,
                            borderRadius: '12px'
                          }}
                        />
                      )}
                      {/* Top Header Row with Circle Dot (Top-Left) and Amount (Top-Right) */}
                      <div className={styles.pvcCardHeader} style={{ position: 'relative', zIndex: 2 }}>
                        <div className={styles.pvcChip} />
                        <div
                          className={styles.pvcCardAmount}
                          style={{
                            textShadow: (pvcTheme === 'signature-gold' && pvcCustomImage && !disableTextShadow) ? '0 2px 8px rgba(0,0,0,0.85)' : 'none'
                          }}
                        >
                          ₹{pvcAmount ? pvcAmount.toLocaleString('en-IN') : '0'}
                        </div>
                      </div>

                      {/* Bottom Body Row */}
                      <div className={styles.pvcCardBody} style={{ position: 'relative', zIndex: 2 }}>
                        <div className={styles.pvcContent}>
                          <div
                            className={styles.pvcLogoText}
                            style={{
                              textShadow: (pvcTheme === 'signature-gold' && pvcCustomImage && !disableTextShadow) ? '0 2px 8px rgba(0,0,0,0.85)' : 'none'
                            }}
                          >
                            Gift Card
                          </div>
                          {pvcMessage && (
                            <p
                              className={styles.pvcEngraved}
                              style={{
                                textShadow: (pvcTheme === 'signature-gold' && pvcCustomImage && !disableTextShadow) ? '0 2px 8px rgba(0,0,0,0.85)' : 'none'
                              }}
                            >
                              {pvcMessage}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Back Face */}
                    <div
                      className={`${styles.pvcCardFace} ${styles.pvcCardBack}`}
                      onPointerDown={(e) => handlePointerDown(e, true)}
                      onPointerMove={(e) => handlePointerMove(e, true)}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      style={{
                        background: (pvcBackTheme === 'signature-gold' && pvcCustomImage) ? 'transparent' : pvcThemes[pvcBackTheme].bg,
                        border: pvcThemes[pvcBackTheme].border,
                        color: (pvcBackTheme === 'signature-gold' && pvcCustomImage) ? '#ffffff' : pvcThemes[pvcBackTheme].color,
                        cursor: (pvcCustomImage && !pvcOrderSuccess) ? (isDragging ? 'grabbing' : 'grab') : 'default',
                        userSelect: 'none',
                        touchAction: pvcCustomImage ? 'none' : 'auto'
                      }}
                    >
                      {(pvcBackTheme === 'signature-gold' && pvcCustomImage) && (
                        <img
                          src={pvcCustomImage}
                          alt="Back Card Background"
                          style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: `${backImgPos.x}% ${backImgPos.y}%`,
                            transform: `scaleX(${backImgFlip ? -1 : 1}) rotate(${backImgRotate}deg)`,
                            pointerEvents: 'none',
                            zIndex: 0,
                            borderRadius: '12px'
                          }}
                        />
                      )}
                      <div className={styles.pvcCardBackContent} style={{ position: 'relative', zIndex: 2 }}>
                        <div className={styles.pvcSignaturePanel} style={{ position: 'relative', zIndex: 3 }}>
                          CODE: SCRB-XXXX
                        </div>
                        <p
                          className={styles.pvcBackText}
                          style={{
                            color: 'inherit',
                            textShadow: (pvcCustomImage && !disableTextShadow) ? '0 2px 8px rgba(0,0,0,0.85)' : 'none'
                          }}
                        >
                          * Valid for 1 year from activation.
                          <br />
                          * Redeemable at myscribble &gt; account &gt; Giftcards
                          <br />
                          * Secure Keepsake Card. Non-transferable.
                        </p>
                      </div>
                      <div
                        className={styles.pvcLogoText}
                        style={{
                          fontSize: '0.9rem',
                          opacity: 0.9,
                          textAlign: 'right',
                          textShadow: (pvcCustomImage && !disableTextShadow) ? '0 2px 8px rgba(0,0,0,0.85)' : 'none',
                          position: 'relative',
                          zIndex: 2
                        }}
                      >
                        myscribble.in
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`${styles.dragToolbarWrapper} ${(pvcTheme === 'signature-gold' && pvcCustomImage && !pvcOrderSuccess) ? styles.dragToolbarWrapperActive : ''}`}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    background: '#ffffff',
                    border: '1px solid #eaeaea',
                    borderRadius: '100px',
                    padding: '0.45rem 0.65rem 0.45rem 0.9rem',
                    boxShadow: '0px 1px 0px 0px #bebebec4'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#333', fontSize: '0.8rem', fontWeight: '600' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff0040" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="5 9 2 12 5 15"></polyline>
                        <polyline points="9 5 12 2 15 5"></polyline>
                        <polyline points="15 19 12 22 9 19"></polyline>
                        <polyline points="19 9 22 12 19 15"></polyline>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <line x1="12" y1="2" x2="12" y2="22"></line>
                      </svg>
                      <span>Drag to reposition</span>
                      <span style={{ fontSize: '0.725rem', color: '#777', background: '#f4f4f6', padding: '0.15rem 0.45rem', borderRadius: '12px', fontWeight: '600' }}>
                        {(isFlipped ? backImgPos.x : frontImgPos.x)}% • {(isFlipped ? backImgPos.y : frontImgPos.y)}%
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (isFlipped) {
                          setBackImgPos({ x: 50, y: 50 });
                        } else {
                          setFrontImgPos({ x: 50, y: 50 });
                        }
                      }}
                      style={{
                        background: '#f4f4f6',
                        color: '#444',
                        border: 'none',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fff0f2';
                        e.currentTarget.style.color = '#ff0040';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f4f4f6';
                        e.currentTarget.style.color = '#444';
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                      </svg>
                      Reset
                    </button>
                  </div>
                </div>

                {/* Preview controls */}
                <div className={styles.previewControls}>
                  <button
                    type="button"
                    className={`${styles.controlBtn} ${isFlipped ? styles.controlBtnActive : ''}`}
                    onClick={() => setIsFlipped(!isFlipped)}
                    title="Rotate Card"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    className={`${styles.controlBtn} ${showInfo ? styles.controlBtnActive : ''}`}
                    onClick={() => setShowInfo(!showInfo)}
                    title="Card Specifications"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                  </button>
                </div>

                {/* Specifications Info Box */}
                {showInfo && (
                  <div className={styles.infoBox}>
                    <p className={styles.infoText}>
                      The standard physical gift card (known as CR80) is 3.375 × 2.125 inches (85.6 × 54 mm) with a thickness of 0.030 inches (0.76 mm).
                    </p>
                    <button
                      type="button"
                      className={styles.closeInfoBtn}
                      onClick={() => setShowInfo(false)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </CustomerSidebarLayout>
  );
}
