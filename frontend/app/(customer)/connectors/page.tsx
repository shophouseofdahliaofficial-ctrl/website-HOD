'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  requestGoogleAuthCode,
  DRIVE_SCOPE,
  PHOTOS_SCOPE,
} from '@/lib/google/googlePicker';
import { connectorsApi } from '@/lib/api/connectors';
import CustomerSidebarLayout from '@/components/customer/CustomerSidebarLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import styles from './connectors.module.css';
import modalStyles from '@/components/product/ProductPrintUploadModal.module.css';

export default function ConnectorsPage() {
  const { user, isAuthenticated, loading, logout, isAdmin } = useAuth();
  const { showToast } = useToast();
  const pathname = usePathname();
  const router = useRouter();

  const [gdriveConnected, setGdriveConnected] = useState(false);
  const [gphotosConnected, setGphotosConnected] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'drive' | 'photos' | null>(null);
  const [activeConnectorModal, setActiveConnectorModal] = useState<'drive' | 'photos' | null>(null);
  const [verifyNoticeSource, setVerifyNoticeSource] = useState<'drive' | 'photos' | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [loading, isAuthenticated, router]);

  // Fetch connection status from backend
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const status = await connectorsApi.getStatus();
        if (cancelled) return;
        setGdriveConnected(status.drive?.connected ?? false);
        setGphotosConnected(status.photos?.connected ?? false);
      } catch (err) {
        console.error('[Connectors] Failed to fetch status:', err);
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    };

    void fetchStatus();
    return () => { cancelled = true; };
  }, [user]);

  const handleConnect = async (source: 'drive' | 'photos') => {
    if (!user) return;
    setActionLoading(source);
    try {
      const scope = source === 'drive' ? DRIVE_SCOPE : PHOTOS_SCOPE;

      // Step 1: Get an authorization code from Google via popup
      const code = await requestGoogleAuthCode(scope);

      // Step 2: Send the code to the backend to exchange for refresh token
      await connectorsApi.exchangeCode(code, source);

      if (source === 'drive') {
        setGdriveConnected(true);
      } else {
        setGphotosConnected(true);
      }
      showToast(
        `${source === 'drive' ? 'Google Drive' : 'Google Photos'} connected successfully!`,
        'success'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed.';
      const normalized = message.toLowerCase();
      // Ignore user closing dialog
      if (
        normalized.includes('popup_closed') ||
        normalized.includes('access_denied') ||
        normalized.includes('user closed')
      ) {
        return;
      }
      showToast(message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (source: 'drive' | 'photos') => {
    if (!user) return;
    setActionLoading(source);
    try {
      await connectorsApi.disconnect(source);
      if (source === 'drive') {
        setGdriveConnected(false);
      } else {
        setGphotosConnected(false);
      }
      showToast(
        `${source === 'drive' ? 'Google Drive' : 'Google Photos'} disconnected.`,
        'success'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Disconnect failed.';
      showToast(message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || !isAuthenticated || !user) {
    return (
      <CustomerSidebarLayout>
        <LoadingSpinner fullHeight />
      </CustomerSidebarLayout>
    );
  }

  return (
    <CustomerSidebarLayout>
      <Link href="/account" className={styles.backLink} onClick={(e) => { e.preventDefault(); router.back(); }}>
        <svg className={styles.backIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back
      </Link>
      <h1 className={styles.pageTitle}>Connectors</h1>

      <section className={styles.infoCard}>
        <div className={styles.infoCardHeader}>
          <h2 className={styles.infoCardTitle}>Manage Authorized Connectors</h2>
        </div>

        <div className={styles.connectorsList}>
          {/* Google Drive */}
          <div className={styles.connectorCard}>
            <div className={styles.connectorInfo}>
              <div className={styles.connectorLogoWrap}>
                <svg viewBox="0 -13.5 256 256" width="24" height="24" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path d="M19.3542312,196.033928 L30.644172,215.534816 C32.9900287,219.64014 36.3622164,222.86588 40.3210929,225.211737 C51.6602421,210.818376 59.5534225,199.772864 64.000634,192.075201 C68.5137119,184.263529 74.0609657,172.045039 80.6423954,155.41973 C62.9064315,153.085282 49.4659974,151.918058 40.3210929,151.918058 C31.545465,151.918058 18.1051007,153.085282 0,155.41973 C0,159.964996 1.17298825,164.510261 3.51893479,168.615586 L19.3542312,196.033928 Z" fill="#0066DA"> </path> <path d="M215.681443,225.211737 C219.64032,222.86588 223.012507,219.64014 225.358364,215.534816 L230.050377,207.470615 L252.483511,168.615586 C254.829368,164.510261 256.002446,159.964996 256.002446,155.41973 C237.79254,153.085282 224.376613,151.918058 215.754667,151.918058 C206.488712,151.918058 193.072785,153.085282 175.506888,155.41973 C182.010479,172.136093 187.484394,184.354584 191.928633,192.075201 C196.412073,199.863919 204.329677,210.909431 215.681443,225.211737 Z" fill="#EA4335"> </path> <path d="M128.001268,73.3111515 C141.121182,57.4655263 150.162898,45.2470011 155.126415,36.6555757 C159.123121,29.7376196 163.521739,18.6920726 168.322271,3.51893479 C164.363395,1.1729583 159.818129,0 155.126415,0 L100.876121,0 C96.1841079,0 91.638842,1.31958557 87.6799655,3.51893479 C93.7861943,20.9210065 98.9675428,33.3058067 103.224011,40.6733354 C107.927832,48.8151881 116.186918,59.6944602 128.001268,73.3111515 Z" fill="#00832D"> </path> <path d="M175.360141,155.41973 L80.6420959,155.41973 L40.3210929,225.211737 C44.2799694,227.557893 48.8252352,228.730672 53.5172481,228.730672 L202.485288,228.730672 C207.177301,228.730672 211.722567,227.411146 215.681443,225.211737 L175.360141,155.41973 Z" fill="#2684FC"> </path> <path d="M128.001268,73.3111515 L87.680265,3.51893479 C83.7213885,5.86488134 80.3489013,9.09044179 78.0030446,13.1960654 L3.51893479,142.223575 C1.17298825,146.329198 0,150.874464 0,155.41973 L80.6423954,155.41973 L128.001268,73.3111515 Z" fill="#00AC47"> </path> <path d="M215.241501,77.7099697 L177.999492,13.1960654 C175.653635,9.09044179 172.281148,5.86488134 168.322271,3.51893479 L128.001268,73.3111515 L175.360141,155.41973 L255.855999,155.41973 C255.855999,150.874464 254.682921,146.329198 252.337064,142.223575 L215.241501,77.7099697 Z" fill="#FFBA00"> </path> </g> </g></svg>
              </div>
              <div className={styles.connectorDetails}>
                <div className={styles.connectorTitleRow}>
                  <h3 className={styles.connectorName}>Google Drive</h3>
                  <span className={styles.connectorCategory}>Productivity</span>
                </div>
                <p className={styles.connectorDesc}>
                  Give Scribble access to your Google Drive files to search and upload photos directly.
                </p>
              </div>
            </div>
            <div className={styles.connectorStatus}>
              {statusLoading ? (
                <span className={`${styles.badge} ${styles.badgeDisconnected}`}>Loading…</span>
              ) : (
                <span className={`${styles.badge} ${gdriveConnected ? styles.badgeConnected : styles.badgeDisconnected}`}>
                  {gdriveConnected ? 'Connected' : 'Disconnected'}
                </span>
              )}
              {gdriveConnected ? (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDisconnect}`}
                  disabled={actionLoading !== null}
                  onClick={() => void handleDisconnect('drive')}
                >
                  {actionLoading === 'drive' ? 'Disconnecting...' : 'Disconnect'}
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnConnect}`}
                  disabled={actionLoading !== null || statusLoading}
                  onClick={() => setActiveConnectorModal('drive')}
                >
                  {actionLoading === 'drive' ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          </div>

          {/* Google Photos */}
          <div className={styles.connectorCard}>
            <div className={styles.connectorInfo}>
              <div className={styles.connectorLogoWrap}>
                <svg viewBox="0 0 256 256" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path d="M64,58.1485714 C99.328,58.1485714 128,86.8205714 128,122.148571 L128,122.148571 L128,128 L5.85142857,128 C2.63314286,128 0,125.366857 0,122.148571 C0,86.8205714 28.672,58.1485714 64,58.1485714 L64,58.1485714 Z" fill="#FBBB05"> </path> <path d="M197.851429,64 C197.851429,99.328 169.179429,128 133.851429,128 L128,128 L128,5.85142857 C128,2.63314286 130.633143,0 133.851429,0 L133.851429,0 C169.179429,0 197.851429,28.672 197.851429,64 Z" fill="#E94335"> </path> <path d="M192,197.851429 C156.672,197.851429 128,169.179429 128,133.851429 L128,133.851429 L128,128 L250.148571,128 C253.366857,128 256,130.633143 256,133.851429 L256,133.851429 C256,169.179429 227.328,197.851429 192,197.851429 L192,197.851429 Z" fill="#4285F4"> </path> <path d="M58.1485714,192 C58.1485714,156.672 86.8205714,128 122.148571,128 L128,128 L128,250.148571 C128,253.366857 125.366857,256 122.148571,256 L122.148571,256 C86.8205714,256 58.1485714,227.328 58.1485714,192 Z" fill="#0F9D58"> </path> </g> </g></svg>
              </div>
              <div className={styles.connectorDetails}>
                <div className={styles.connectorTitleRow}>
                  <h3 className={styles.connectorName}>Google Photos</h3>
                  <span className={styles.connectorCategory}>Media</span>
                </div>
                <p className={styles.connectorDesc}>
                  Give Scribble access to your Google Photos library to import your memories.
                </p>
              </div>
            </div>
            <div className={styles.connectorStatus}>
              {statusLoading ? (
                <span className={`${styles.badge} ${styles.badgeDisconnected}`}>Loading…</span>
              ) : (
                <span className={`${styles.badge} ${gphotosConnected ? styles.badgeConnected : styles.badgeDisconnected}`}>
                  {gphotosConnected ? 'Connected' : 'Disconnected'}
                </span>
              )}
              {gphotosConnected ? (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDisconnect}`}
                  disabled={actionLoading !== null}
                  onClick={() => void handleDisconnect('photos')}
                >
                  {actionLoading === 'photos' ? 'Disconnecting...' : 'Disconnect'}
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnConnect}`}
                  disabled={actionLoading !== null || statusLoading}
                  onClick={() => setActiveConnectorModal('photos')}
                >
                  {actionLoading === 'photos' ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {activeConnectorModal && typeof document !== 'undefined' ? createPortal(
        <div
          className={modalStyles.connectorOverlay}
          onClick={(e) => {
            e.stopPropagation();
            setActiveConnectorModal(null);
          }}
        >
          <div className={modalStyles.connectorDialog} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={modalStyles.connectorCloseBtn}
              onClick={() => setActiveConnectorModal(null)}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <div className={modalStyles.connectorHeader}>
              <div className={modalStyles.connectorTitleSection}>
                <div className={modalStyles.connectorLogoBig}>
                  {activeConnectorModal === 'drive' ? (
                    <svg viewBox="0 -13.5 256 256" width="40" height="40" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path d="M19.3542312,196.033928 L30.644172,215.534816 C32.9900287,219.64014 36.3622164,222.86588 40.3210929,225.211737 C51.6602421,210.818376 59.5534225,199.772864 64.000634,192.075201 C68.5137119,184.263529 74.0609657,172.045039 80.6423954,155.41973 C62.9064315,153.085282 49.4659974,151.918058 40.3210929,151.918058 C31.545465,151.918058 18.1051007,153.085282 0,155.41973 C0,159.964996 1.17298825,164.510261 3.51893479,168.615586 L19.3542312,196.033928 Z" fill="#0066DA"> </path> <path d="M215.681443,225.211737 C219.64032,222.86588 223.012507,219.64014 225.358364,215.534816 L230.050377,207.470615 L252.483511,168.615586 C254.829368,164.510261 256.002446,159.964996 256.002446,155.41973 C237.79254,153.085282 224.376613,151.918058 215.754667,151.918058 C206.488712,151.918058 193.072785,153.085282 175.506888,155.41973 C182.010479,172.136093 187.484394,184.354584 191.928633,192.075201 C196.412073,199.863919 204.329677,210.909431 215.681443,225.211737 Z" fill="#EA4335"> </path> <path d="M128.001268,73.3111515 C141.121182,57.4655263 150.162898,45.2470011 155.126415,36.6555757 C159.123121,29.7376196 163.521739,18.6920726 168.322271,3.51893479 C164.363395,1.1729583 159.818129,0 155.126415,0 L100.876121,0 C96.1841079,0 91.638842,1.31958557 87.6799655,3.51893479 C93.7861943,20.9210065 98.9675428,33.3058067 103.224011,40.6733354 C107.927832,48.8151881 116.186918,59.6944602 128.001268,73.3111515 Z" fill="#00832D"> </path> <path d="M175.360141,155.41973 L80.6420959,155.41973 L40.3210929,225.211737 C44.2799694,227.557893 48.8252352,228.730672 53.5172481,228.730672 L202.485288,228.730672 C207.177301,228.730672 211.722567,227.411146 215.681443,225.211737 L175.360141,155.41973 Z" fill="#2684FC"> </path> <path d="M128.001268,73.3111515 L87.680265,3.51893479 C83.7213885,5.86488134 80.3489013,9.09044179 78.0030446,13.1960654 L3.51893479,142.223575 C1.17298825,146.329198 0,150.874464 0,155.41973 L80.6423954,155.41973 L128.001268,73.3111515 Z" fill="#00AC47"> </path> <path d="M215.241501,77.7099697 L177.999492,13.1960654 C175.653635,9.09044179 172.281148,5.86488134 168.322271,3.51893479 L128.001268,73.3111515 L175.360141,155.41973 L255.855999,155.41973 C255.855999,150.874464 254.682921,146.329198 252.337064,142.223575 L215.241501,77.7099697 Z" fill="#FFBA00"> </path> </g> </g></svg>
                  ) : (
                    <svg viewBox="0 0 256 256" width="36" height="36" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path d="M64,58.1485714 C99.328,58.1485714 128,86.8205714 128,122.148571 L128,122.148571 L128,128 L5.85142857,128 C2.63314286,128 0,125.366857 0,122.148571 C0,86.8205714 28.672,58.1485714 64,58.1485714 L64,58.1485714 Z" fill="#FBBB05"> </path> <path d="M197.851429,64 C197.851429,99.328 169.179429,128 133.851429,128 L128,128 L128,5.85142857 C128,2.63314286 130.633143,0 133.851429,0 L133.851429,0 C169.179429,0 197.851429,28.672 197.851429,64 Z" fill="#E94335"> </path> <path d="M192,197.851429 C156.672,197.851429 128,169.179429 128,133.851429 L128,133.851429 L128,128 L250.148571,128 C253.366857,128 256,130.633143 256,133.851429 L256,133.851429 C256,169.179429 227.328,197.851429 192,197.851429 L192,197.851429 Z" fill="#4285F4"> </path> <path d="M58.1485714,192 C58.1485714,156.672 86.8205714,128 122.148571,128 L128,128 L128,250.148571 C128,253.366857 125.366857,256 122.148571,256 L122.148571,256 C86.8205714,256 58.1485714,227.328 58.1485714,192 Z" fill="#0F9D58"> </path> </g> </g></svg>
                  )}
                </div>
                <div className={modalStyles.connectorTitles}>
                  <h3 className={modalStyles.connectorTitleText}>
                    {activeConnectorModal === 'drive' ? 'Google Drive' : 'Google Photos'}
                  </h3>
                  <span className={modalStyles.connectorCategoryText}>
                    {activeConnectorModal === 'drive' ? 'Productivity' : 'Media'}
                  </span>
                </div>
              </div>
            </div>

            <div className={modalStyles.connectorBody}>
              <p className={modalStyles.connectorIntro}>
                Give Scribble access to your {activeConnectorModal === 'drive' ? 'Google Drive' : 'Google Photos'} files.
              </p>

              <div className={modalStyles.connectorDivider} />

              <h4 className={modalStyles.connectorAboutTitle}>About this Connector</h4>

              <div className={modalStyles.connectorInfoRow}>
                <div className={modalStyles.connectorInfoIcon}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className={modalStyles.connectorInfoTextSection}>
                  <div className={modalStyles.connectorInfoHead}>Access your files</div>
                  <div className={modalStyles.connectorInfoBody}>
                    Search for files, photos of your {activeConnectorModal === 'drive' ? 'Google Drive' : 'Google Photos'} to import it.
                  </div>
                </div>
              </div>

              <div className={modalStyles.connectorInfoRow}>
                <div className={modalStyles.connectorInfoIcon}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div className={modalStyles.connectorInfoTextSection}>
                  <div className={modalStyles.connectorInfoHead}>We never train on your data</div>
                  <div className={modalStyles.connectorInfoBody}>
                    Scribble does not train on your {activeConnectorModal === 'drive' ? 'Google Drive' : 'Google Photos'} data.
                  </div>
                </div>
              </div>

              <div className={modalStyles.connectorInfoRow}>
                <div className={modalStyles.connectorInfoIcon}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div className={modalStyles.connectorInfoTextSection}>
                  <div className={modalStyles.connectorInfoHead}>You control your data</div>
                  <div className={modalStyles.connectorInfoBody}>Disconnect anytime in Connectors.</div>
                </div>
              </div>

              <button
                type="button"
                className={modalStyles.connectorConnectBtnBottom}
                disabled={actionLoading !== null}
                onClick={() => {
                  const source = activeConnectorModal;
                  setActiveConnectorModal(null);
                  setVerifyNoticeSource(source);
                }}
              >
                Connect
              </button>

              <div className={modalStyles.connectorPrivacyPolicyText}>
                By connecting, you agree to our{' '}
                <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </Link>
                .
              </div>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {verifyNoticeSource && typeof document !== 'undefined' ? createPortal(
        <div
          className={modalStyles.noticeOverlay}
          onClick={(e) => {
            e.stopPropagation();
            setVerifyNoticeSource(null);
          }}
        >
          <div className={modalStyles.noticeDialog} onClick={(e) => e.stopPropagation()}>
            <h3 className={modalStyles.noticeTitle}>Google OAuth Verification Notice (for Customers and Google)</h3>
            <div className={modalStyles.noticeText}>
              <p className={modalStyles.noticeParagraph}>
                When signing in with Google, you may see a message stating &quot;Google hasn't verified this app.&quot; This is not a security issue or data breach. The warning appears because Scribble's Google OAuth verification is currently under review and has not yet been approved by Google.
              </p>
              <p className={modalStyles.noticeParagraph}>
                Scribble uses Google's official OAuth authentication system, and all user data is transmitted securely over encrypted connections. We only request the permissions necessary to provide the application's intended functionality, and user information is handled securely in accordance with our Privacy Policy.
              </p>
              <p className={modalStyles.noticeParagraph}>
                This warning is a standard Google message shown to applications awaiting verification. Once Google completes the verification process, this warning will be automatically removed, and users will be able to sign in without seeing the unverified app screen.
              </p>
              <p className={modalStyles.noticeParagraph}>
                We appreciate your patience while the verification process is completed.
              </p>
            </div>
            <div className={modalStyles.noticeActions}>
              <button
                type="button"
                className={modalStyles.noticeCancelBtn}
                onClick={() => setVerifyNoticeSource(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={modalStyles.noticeConfirmBtn}
                onClick={() => {
                  const source = verifyNoticeSource;
                  setVerifyNoticeSource(null);
                  void handleConnect(source);
                }}
              >
                I trust scribble, proceed
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </CustomerSidebarLayout>
  );
}
