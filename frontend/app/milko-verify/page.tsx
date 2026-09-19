'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './page.module.css';
import { resolveApiBaseUrl } from '@/lib/utils/apiBaseUrl';
import { useAuth } from '@/contexts/AuthContext';
import { tokenStorage } from '@/lib/utils/storage';

export default function MilkoVerifyPage() {
  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<'idle' | 'success' | 'failure'>('idle');
  const [verificationData, setVerificationData] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeNotDetail, setActiveNotDetail] = useState<number | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Configure references for inputs
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, 6);
  }, []);

  const handleChange = (index: number, val: string) => {
    // Only allow alphanumeric characters
    const cleanVal = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!cleanVal) {
      const newCode = [...code];
      newCode[index] = '';
      setCode(newCode);
      return;
    }

    const newCode = [...code];
    // Take the last character typed
    const char = cleanVal.slice(-1);
    newCode[index] = char;
    setCode(newCode);

    // Auto-focus next input
    if (index < 5 && char) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!code[index] && index > 0) {
        // Clear previous input and focus it
        const newCode = [...code];
        newCode[index - 1] = '';
        setCode(newCode);
        inputRefs.current[index - 1]?.focus();
      } else {
        // Clear current input
        const newCode = [...code];
        newCode[index] = '';
        setCode(newCode);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().toUpperCase().replace(/[^a-zA-Z0-9]/g, '');
    if (pastedData.length > 0) {
      const newCode = [...code];
      for (let i = 0; i < 6; i++) {
        if (pastedData[i]) {
          newCode[i] = pastedData[i];
        }
      }
      setCode(newCode);
      
      // Focus the last filled input or the 6th input
      const targetIndex = Math.min(pastedData.length - 1, 5);
      inputRefs.current[targetIndex]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join('');
    if (fullCode.length < 6) return;

    setIsVerifying(true);
    setVerificationData(null);
    setFetchError(null);

    try {
      const token = tokenStorage.get();
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const verifyUrl = `${resolveApiBaseUrl()}/api/verify/${fullCode}`;
      const response = await fetch(verifyUrl, { headers });
      const resJson = await response.json();

      setIsVerifying(false);

      if (response.ok && resJson.success) {
        setVerificationData(resJson.data);
        setResult('success');
      } else {
        setVerificationData(null);
        if (response.status === 403) {
          setFetchError(resJson.error || 'You are not authorized to view this verification clip.');
        } else {
          setFetchError(resJson.error || 'Verification code not found. The code was never registered with us.');
        }
        setResult('failure');
      }
    } catch (err) {
      console.error('❌ Error calling public verification API:', err);
      setIsVerifying(false);
      setFetchError('Network error. Connection to backend was interrupted.');
      setResult('failure');
    }
  };

  const handleVerifyClick = () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
    } else {
      handleVerify();
    }
  };

  const handleReset = () => {
    setCode(Array(6).fill(''));
    setResult('idle');
    setVerificationData(null);
    setActiveNotDetail(null);
    setShowVideoModal(false);
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 50);
  };

  const isCodeComplete = code.join('').length === 6;

  // Current verified date string
  const getVerifiedDate = (dateString?: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true 
    };
    const date = dateString ? new Date(dateString) : new Date();
    return date.toLocaleDateString('en-IN', options);
  };

  return (
    <div className={`${styles.pageWrapper} ${result === 'failure' ? styles.pageWrapperError : ''}`}>
      {/* Premium Customer Login Required Popup */}
      {showLoginModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.loginIconCircle}>
              <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h3 className={styles.modalTitle}>Verification Requires Login</h3>
            <p className={styles.modalText}>
              To protect customer order authenticity, verifying product genuineness requires you to be logged into your Scribble Studios account.
            </p>
            <div className={styles.modalButtonsRow}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setShowLoginModal(false)}
              >
                Cancel
              </button>
              <a
                href={`/auth/login?redirect=/milko-verify`}
                className={styles.modalLoginBtn}
              >
                <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25V9m12.75 3v1.5a2.25 2.25 0 01-2.25 2.25h-6A2.25 2.25 0 013.75 13.5V12m12.75-3H6m9 0l-3-3m3 3l-3 3" />
                </svg>
                Log In Now
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Premium Verification Video Popup Modal */}
      {showVideoModal && verificationData?.driveFileId && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalCard} ${styles.videoModalCard}`}>
            <div className={styles.videoModalHeader}>
              <h3 className={styles.modalTitle} style={{ margin: 0 }}>Verification Clip</h3>
              <button 
                type="button" 
                className={styles.closeModalBtn}
                onClick={() => setShowVideoModal(false)}
                aria-label="Close video player"
              >
                <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className={styles.videoContainer}>
              <iframe 
                src={`https://drive.google.com/file/d/${verificationData.driveFileId}/preview`}
                width="100%" 
                height="100%" 
                allow="autoplay"
                style={{ border: 'none' }}
              />
            </div>
            
            <div className={styles.retentionContainer}>
              <div className={`${styles.retentionCard} ${styles.uploadCard}`}>
                <div className={styles.retentionIconWrap}>
                  <svg className={styles.calendarIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className={styles.retentionText}>
                  <span className={styles.retentionMiniLabel}>UPLOADED ON</span>
                  <span className={styles.retentionDate}>{getVerifiedDate(verificationData?.createdAt)}</span>
                </div>
              </div>

              <div className={`${styles.retentionCard} ${styles.deletionCard}`}>
                <div className={styles.retentionIconWrap}>
                  <svg className={styles.hourglassIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 2h14M5 22h14M19 2v6a7 7 0 01-7 7m0 0a7 7 0 01-7-7V2m7 13a7 7 0 00-7 7m7-7a7 7 0 007 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className={styles.retentionText}>
                  <span className={styles.retentionMiniLabel}>AUTO-DELETES ON</span>
                  <span className={styles.retentionDate}>
                    {getVerifiedDate(new Date(new Date(verificationData?.createdAt).getTime() + 15 * 24 * 60 * 60 * 1000).toISOString())}
                  </span>
                </div>
              </div>
            </div>
            
            <div className={styles.videoModalFooter}>
              <a 
                href={`https://drive.google.com/file/d/${verificationData.driveFileId}/view?usp=drivesdk`}
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.driveLinkBtn}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{ marginRight: '6px' }}>
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
                </svg>
                View on Google Drive
              </a>
            </div>
          </div>
        </div>
      )}

      <div className={`${styles.verifyCard} ${isVerifying ? styles.scanning : ''}`}>
        {result === 'idle' && (
          <>
            {/* Tick icon in the center */}
            <div className={styles.iconOuterCircle}>
              <div className={styles.iconInnerCircle}>
                <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"></path>
                </svg>
              </div>
            </div>

            {/* Content Texts */}
            <h1 id="verify-heading" className={styles.title}>
              Check if your product is fake or real?
            </h1>
            <p className={styles.description}>
              Enter your 6 digit code that is on the product you ordered from us
            </p>

            {/* 6 Digit Check Box Input */}
            <div className={styles.pinContainer}>
              {code.map((digit, index) => (
                <input
                  key={index}
                  id={`pin-input-${index}`}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  maxLength={1}
                  className={`${styles.pinInput} ${isVerifying ? styles.pinInputDisabled : ''}`}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  disabled={isVerifying}
                  placeholder="•"
                  aria-label={`Digit ${index + 1}`}
                />
              ))}
            </div>

            {/* Verify Button */}
            <button
              id="verify-btn"
              type="button"
              className={`${styles.verifyBtn} ${(!isCodeComplete || isVerifying) ? styles.verifyBtnDisabled : ''}`}
              onClick={handleVerifyClick}
              disabled={!isCodeComplete || isVerifying}
            >
              {isVerifying ? (
                <>
                  <span className={styles.spinner}></span>
                  Verifying...
                </>
              ) : (
                'Verify My Product'
              )}
            </button>
          </>
        )}

        {/* Verification Success Screen */}
        {result === 'success' && (
          <div className={styles.resultContent}>
            <div className={`${styles.iconOuterCircle} ${styles.successCircle}`}>
              <div className={`${styles.iconInnerCircle} ${styles.successInner}`}>
                <svg fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"></path>
                </svg>
              </div>
            </div>

            <h2 className={styles.resultTitle}>Authentic Product</h2>
            <span className={styles.resultSubtitle}>100% Genuine</span>

            {/* Premium Google Drive Video Player Placeholder Overlay */}
            {verificationData?.driveFileId && (
              <div 
                className={styles.videoPlaceholder}
                onClick={() => setShowVideoModal(true)}
              >
                <div className={styles.videoPlaceholderOverlay}>
                  <div className={styles.playButtonCircle}>
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                      <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                      <g id="SVGRepo_iconCarrier">
                        <path d="M8.286 3.407A1.5 1.5 0 0 0 6 4.684v14.632a1.5 1.5 0 0 0 2.286 1.277l11.888-7.316a1.5 1.5 0 0 0 0-2.555L8.286 3.407z" fill="currentColor"></path>
                      </g>
                    </svg>
                  </div>
                  <span className={styles.videoPlaceholderText}>Watch Extraction & Verification Video</span>
                </div>
              </div>
            )}

            <div className={styles.detailsList}>
              <div className={styles.detailsRow}>
                <span className={styles.detailsLabel}>Verification Code</span>
                <span className={styles.detailsVal}>{code.join('')}</span>
              </div>
              <div className={styles.detailsRow}>
                <span className={styles.detailsLabel}>Status</span>
                <span className={styles.detailsVal} style={{ color: '#2e7d32' }}>{verificationData?.status || 'Active & Original'}</span>
              </div>
              <div className={styles.detailsRow}>
                <span className={styles.detailsLabel}>Extracted On</span>
                <span className={styles.detailsVal}>{getVerifiedDate(verificationData?.createdAt)}</span>
              </div>
              <div className={styles.detailsRow}>
                <span className={styles.detailsLabel}>Quality Seal</span>
                <span className={styles.detailsVal}>Grade A+ Premium</span>
              </div>
            </div>

            <button id="reset-success-btn" type="button" className={styles.resetBtn} onClick={handleReset}>
              Verify Another Product
            </button>
          </div>
        )}

        {/* Verification Failure Screen */}
        {result === 'failure' && (
          <div className={styles.resultContent}>
            <div className={`${styles.iconOuterCircle} ${styles.errorCircle}`}>
              <div className={`${styles.iconInnerCircle} ${styles.errorInner}`}>
                <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"></path>
                </svg>
              </div>
            </div>

            <h2 className={styles.resultTitle} style={{ color: '#c62828' }}>Security Warning</h2>
            <span className={`${styles.resultSubtitle} ${styles.warningSubtitle}`}>Verification Unsuccessful</span>

            <div className={styles.infoBox}>
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"></path>
              </svg>
              <div className={styles.infoText}>
                {fetchError ? (
                  fetchError
                ) : (
                  <>
                    The code <strong>{code.join('')}</strong> could not be authenticated. It may be duplicate, invalid, or expired.
                  </>
                )}
                <br />
                <span style={{ display: 'block', marginTop: '6px', fontSize: '0.8rem', opacity: 0.85 }}>
                  If you are stuck at anything, reach out to our support team for faster replies and to report a suspicious product.
                </span>
              </div>
            </div>

            <button id="reset-failure-btn" type="button" className={styles.resetBtn} onClick={handleReset}>
              Try Again
            </button>
          </div>
        )}
      </div>

      {result === 'success' && (
        <div className={styles.proofContainer}>
          <h3 className={styles.proofTitle}>Your verification currently proves:</h3>
          
          <div className={styles.proofSection}>
            <ul className={styles.proofList}>
              <li className={styles.proofItem}>
                <svg className={styles.checkIcon} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>batch existed</span>
              </li>
              <li className={styles.proofItem}>
                <svg className={styles.checkIcon} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>code genuine</span>
              </li>
              <li className={styles.proofItem}>
                <svg className={styles.checkIcon} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>team verified</span>
              </li>
              <li className={styles.proofItem}>
                <svg className={styles.checkIcon} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>order existed</span>
              </li>
            </ul>
          </div>
          
          <div className={styles.proofSection}>
            <span className={styles.proofSubtitle}>BUT NOT:</span>
            <ul className={styles.proofList}>
              <li className={`${styles.proofItem} ${styles.notItem}`}>
                <div className={styles.notItemLeft}>
                  <svg className={styles.crossIcon} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>product remained untouched after delivery</span>
                </div>
                <button 
                  type="button" 
                  className={styles.infoIconButton}
                  onClick={() => setActiveNotDetail(activeNotDetail === 1 ? null : 1)}
                  aria-label="More details on product untouched after delivery"
                >
                  <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                </button>
              </li>
              {activeNotDetail === 1 && (
                <div className={styles.detailsDrawer}>
                  <div className={styles.drawerTitle}>1. Product Remained Untouched After Delivery</div>
                  <div>
                    Example:<br />
                    Customer receives a genuine product.
                  </div>
                  <div className={styles.drawerExample}>
                    Then later:<br /><br />
                    opens packaging<br />
                    mishandles the item<br />
                    stores it improperly<br />
                    changes contents<br /><br />
                    Then says:<br /><br />
                    {"“Product quality is bad.”"}
                  </div>
                </div>
              )}

              <li className={`${styles.proofItem} ${styles.notItem}`}>
                <div className={styles.notItemLeft}>
                  <svg className={styles.crossIcon} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>customer stored properly</span>
                </div>
                <button 
                  type="button" 
                  className={styles.infoIconButton}
                  onClick={() => setActiveNotDetail(activeNotDetail === 2 ? null : 2)}
                  aria-label="More details on customer stored properly"
                >
                  <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                </button>
              </li>
              {activeNotDetail === 2 && (
                <div className={styles.detailsDrawer}>
                  <div className={styles.drawerTitle}>2. Customer Stored Properly</div>
                  <div>
                    Example:<br />
                    Product delivered in good condition.
                  </div>
                  <div className={styles.drawerExample}>
                    But customer:<br /><br />
                    leaves it exposed for hours<br />
                    keeps it in heat<br />
                    no proper storage<br /><br />
                    Product is damaged.<br /><br />
                    Then customer blames us.
                  </div>
                </div>
              )}

              <li className={`${styles.proofItem} ${styles.notItem}`}>
                <div className={styles.notItemLeft}>
                  <svg className={styles.crossIcon} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>no tampering after opening</span>
                </div>
                <button 
                  type="button" 
                  className={styles.infoIconButton}
                  onClick={() => setActiveNotDetail(activeNotDetail === 3 ? null : 3)}
                  aria-label="More details on no tampering after opening"
                >
                  <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                </button>
              </li>
              {activeNotDetail === 3 && (
                <div className={styles.detailsDrawer}>
                  <div className={styles.drawerTitle}>3. No Tampering After Opening</div>
                  <div>
                    Once seal broken:
                  </div>
                  <div className={styles.drawerExample}>
                    anyone can modify contents<br />
                    refill bottle<br />
                    mix substances<br />
                    replace contents<br /><br />
                    Our verification still shows:<br /><br />
                    {"“genuine batch”"}
                  </div>
                </div>
              )}
            </ul>
          </div>
        </div>
      )}

      <div className={styles.sellerText}>
        <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
        </svg>
        Always buy from verified Scribble Studios sellers
      </div>
    </div>
  );
}
