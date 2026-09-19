'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminDomain, getPostLoginRedirect } from '@/lib/utils/domain';
import Link from 'next/link';
import FloatingLabelInput from '@/components/ui/FloatingLabelInput';
import Logo from '@/components/Logo';
import styles from '../auth.module.css';

function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.335z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

function EnvelopeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 127.14 96.36" fill="#5865F2" xmlns="http://www.w3.org/2000/svg">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c1-.72,1.93-1.48,2.83-2.28a74.58,74.58,0,0,0,72.24,0c.9,0.8,1.83,1.56,2.83,2.28a68.43,68.43,0,0,1-10.5,5A77.7,77.7,0,0,0,95.14,85.51,105.73,105.73,0,0,0,126.14,77.53C130,54.65,123.36,31.58,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z"/>
    </svg>
  );
}





function XIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#1a1a1a" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
      <circle cx="120" cy="120" r="120" fill="#24A1DE" />
      <path d="M81.229,128.772l14.237,39.406s1.78,3.687,3.686,3.687,30.255-29.492,30.255-29.492l31.525-60.89L81.737,118.6Z" fill="#c8daea" />
      <path d="M100.106,138.878l-2.733,29.046s-1.144,8.9,7.754,0,17.415-15.763,17.415-15.763" fill="#a9c6d8" />
      <path d="M81.486,130.178,52.2,120.636s-3.5-1.42-2.373-4.64c.232-.664.7-1.229,2.1-2.2,6.489-4.523,120.106-45.36,120.106-45.36s3.208-1.081,5.1-.362a2.766,2.766,0,0,1,1.885,2.055,9.357,9.357,0,0,1,.254,2.585c-.009.752-.1,1.449-.169,2.542-.692,11.165-21.4,94.493-21.4,94.493s-1.239,4.876-5.678,5.043A8.13,8.13,0,0,1,146.1,172.5c-8.711-7.493-38.819-27.727-45.472-32.177a1.27,1.27,0,0,1-.546-.9c-.093-.469.417-1.05.417-1.05s52.426-46.6,53.821-51.492c.108-.379-.3-.566-.848-.4-3.482,1.281-63.844,39.4-70.506,43.607A3.21,3.21,0,0,1,81.486,130.178Z" fill="#fff" />
    </svg>
  );
}

const OAUTH_STATE_MSG =
  'Google sign-in could not be completed. This can happen with strict privacy settings or ad blockers. Try a normal (non-incognito) window, Chrome or Firefox, or use email and password below.';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginWithGoogle, loginWithFacebook, loginWithDiscord, loginWithTwitter, loginWithTelegram, isAuthenticated, user } = useAuth();
  const redirectParam = searchParams?.get('redirect') || '';
  const safeRedirect = redirectParam.startsWith('/') ? redirectParam : '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(true);
  }, []);
  const isAdmin = isAdminDomain();

  // Phone auth state
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('+91');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<any>(null);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [hoveredPhone, setHoveredPhone] = useState(false);
  
  // Fallback state

  // Mandatory registration email overlay
  const [showEmailCollection, setShowEmailCollection] = useState(false);
  const [registrationEmail, setRegistrationEmail] = useState('');
  const [tempUserUid, setTempUserUid] = useState('');
  const [showOthers, setShowOthers] = useState(false);

  const verifyOtp = async () => {
    setError('');
    setLoading(true);
    try {
      if (!confirmationResult) {
        throw new Error('No verification session active. Please send OTP again.');
      }
      const result = await confirmationResult.confirm(verificationCode);
      const fbUser = result.user;
      
      const { db } = await import('@/lib/firebase/config');
      const { doc, getDoc } = await import('firebase/firestore');
      const userDocRef = doc(db, 'users', fbUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists() || !userDoc.data().email) {
        setTempUserUid(fbUser.uid);
        setShowEmailCollection(true);
      } else {
        const userRole = 'customer';
        const redirectPath = safeRedirect || getPostLoginRedirect(userRole);
        router.push(redirectPath);
      }
    } catch (err: any) {
      console.error('OTP verification error:', err);
      setError(err.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    if (!phoneNumber) {
      setError('Please enter your phone number.');
      setLoading(false);
      return;
    }

    try {
      const { auth } = await import('@/lib/firebase/config');
      const { RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth');

      let verifier = recaptchaVerifier;
      if (!verifier) {
        if (!document.getElementById('recaptcha-container')) {
          const container = document.createElement('div');
          container.id = 'recaptcha-container';
          document.body.appendChild(container);
        }
        verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            console.log('reCAPTCHA solved');
          }
        });
        setRecaptchaVerifier(verifier);
      }

      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      setConfirmationResult(confirmation);
      setShowOtpInput(true);
    } catch (err: any) {
      console.error('Send OTP error:', err);
      setError(err.message || 'Failed to send verification code. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!registrationEmail) {
      setError('Email address is required.');
      setLoading(false);
      return;
    }

    try {
      const normalizedEmail = registrationEmail.toLowerCase().trim();
      const { db } = await import('@/lib/firebase/config');
      const { doc, setDoc } = await import('firebase/firestore');
      
      await setDoc(doc(db, 'users', tempUserUid), {
        email: normalizedEmail,
        phoneNumber: phoneNumber,
        uid: tempUserUid,
        createdAt: new Date().toISOString()
      }, { merge: true });

      const userRole = 'customer';
      const redirectPath = safeRedirect || getPostLoginRedirect(userRole);
      router.push(redirectPath);
    } catch (err: any) {
      console.error('Save email error:', err);
      setError(err.message || 'Failed to save email address. Please try again.');
    } finally {
      setLoading(false);
      setShowEmailCollection(false);
    }
  };

  // Load Telegram script dynamically on page mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).Telegram) {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleTelegramLogin = async () => {
    if (typeof window === 'undefined' || !(window as any).Telegram?.Login) {
      setError('Telegram login is initializing. Please try again in a moment.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
      const configRes = await fetch(`${apiUrl}/api/auth/telegram/config`);
      const configData = await configRes.json();
      const botId = configData.botId;

      if (!botId) {
        throw new Error('Telegram Bot ID could not be loaded from server.');
      }

      setLoading(false);
      
      (window as any).Telegram.Login.auth(
        {
          bot_id: botId,
          request_access: 'write',
        },
        async (data: any) => {
          if (!data) {
            console.log('[TELEGRAM] User closed the authentication popup.');
            return;
          }

          console.log('[TELEGRAM] Auth data received:', data);
          setLoading(true);
          try {
            const response = await loginWithTelegram(data);
            const userRole = response.user.role?.toLowerCase() || 'customer';
            const redirectPath = safeRedirect || getPostLoginRedirect(userRole as any);
            router.push(redirectPath);
          } catch (err: any) {
            console.error('[TELEGRAM] Login error:', err);
            setError(err.message || 'Telegram login failed. Please try again.');
          } finally {
            setLoading(false);
          }
        }
      );
    } catch (err: any) {
      console.error('[TELEGRAM] Initialization error:', err);
      setError(err.message || 'Failed to initialize Telegram login.');
      setLoading(false);
    }
  };

  // Show message when redirected after OAuth bad_oauth_state
  useEffect(() => {
    if (searchParams?.get('error') === 'oauth_state') {
      setError(OAUTH_STATE_MSG);
      router.replace('/auth/login', { scroll: false });
    }
  }, [searchParams, router]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const userRole = user.role?.toLowerCase() || 'customer';
      console.log('[LOGIN] Already authenticated, user role:', user.role, 'normalized:', userRole);
      const redirectPath = safeRedirect || getPostLoginRedirect(userRole);
      console.log('[LOGIN] Redirect path for authenticated user:', redirectPath);
      if (redirectPath.startsWith('http')) {
        window.location.href = redirectPath;
      } else {
        router.push(redirectPath);
      }
    }
  }, [isAuthenticated, user, router, safeRedirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setTouched({ email: true, password: true });

    // Validate required fields
    if (!email || !password) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const response = await login(email, password);
      
      // Normalize role to lowercase for comparison
      const userRole = response.user.role?.toLowerCase() || 'customer';
      console.log('[LOGIN] User role after login:', response.user.role, 'normalized:', userRole);
      
      const redirectPath = safeRedirect || getPostLoginRedirect(userRole as 'admin' | 'customer');
      console.log('[LOGIN] Redirect path:', redirectPath);
      
      // If redirect path is an absolute URL (shouldn't happen now), use it
      // Otherwise, use router.push for same-domain navigation
      if (redirectPath.startsWith('http')) {
        window.location.href = redirectPath;
      } else {
        console.log('[LOGIN] Redirecting to:', redirectPath);
        router.push(redirectPath);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      // Handle timeout errors specifically
      if (err.message?.includes('timeout') || err.message?.includes('timed out')) {
        setError('Connection timed out. Please check your internet connection and try again.');
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${styles.authContainer} ${loaded ? styles.loaded : ''}`} style={{ 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: '#ffffff',
      padding: '3rem',
      position: 'relative',
    }}>
      <button
        type="button"
        onClick={() => {
          if (window.history.length > 1) {
            router.back();
          } else {
            router.push('/');
          }
        }}
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          border: 'none',
          background: '#fff',
          color: '#111827',
          borderRadius: '100px',
          padding: '9px 14px',
          fontSize: '0.9rem',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
         Back
      </button>
      {/* Logo */}
      <div style={{ height: '48px', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <h1 style={{ margin: 0, height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Logo textClassName={styles.authLogoText} imageClassName={styles.authLogoImg} />
        </h1>
      </div>

      {/* Login Card */}
      <div className={styles.authCard} style={{ 
        background: 'white', 
        padding: '2.5rem',
        borderRadius: '20px', 
        border: 'none',
        boxShadow: 'none',
        width: '100%',
        maxWidth: '440px'
      }}>
        {/* Title */}
        <h2 style={{ 
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#1a1a1a',
          marginBottom: '0.5rem',
          letterSpacing: '-1px',
          textAlign: 'center'
        }}>
          Log in to your account
        </h2>
        
        {/* Subtitle */}
        <p style={{ 
          fontSize: '0.85rem',
          color: '#000000',
          marginBottom: '2rem',
          lineHeight: '1.5',
          textAlign: 'center'
        }}>
          {showEmailForm 
            ? 'Please enter your email and password to log in.'
            : 'Welcome back! Please select an option to log in.'}
        </p>
        
        {/* Error Message */}
        {error && (
          <div style={{ 
            padding: '0.75rem 1rem', 
            background: '#fee', 
            color: '#c33', 
            borderRadius: '8px',
            marginBottom: '1.5rem',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        {showEmailCollection ? (
          <form onSubmit={handleRegisterEmailSubmit}>
            <p style={{ fontSize: '0.85rem', color: '#333', marginBottom: '1.5rem', lineHeight: '1.4', textAlign: 'center' }}>
              Authentication successful! Please enter your email address to complete registration.
            </p>
            <FloatingLabelInput
              type="email"
              value={registrationEmail}
              onChange={(e) => setRegistrationEmail(e.target.value)}
              label="Email Address"
              required
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '1rem',
                background: '#007cff',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '1.5rem',
              }}
            >
              {loading ? 'Saving...' : 'Submit'}
            </button>
          </form>
        ) : showPhoneForm ? (
          <div>
            {!showOtpInput && (
              <form onSubmit={handleSendOtp}>
                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1.5rem', textAlign: 'center' }}>
                  Enter your phone number to receive an SMS verification code.
                </p>
                
                <FloatingLabelInput
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith('+91')) {
                      const raw = val.slice(3).replace(/\D/g, '');
                      setPhoneNumber('+91' + raw);
                    } else {
                      const raw = val.replace(/^\+?9?1?/, '').replace(/\D/g, '');
                      setPhoneNumber('+91' + raw);
                    }
                  }}
                  label="Your Phone Number"
                  placeholder="Your Phone Number"
                  required
                />

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    background: '#007cff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '20px',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    marginTop: '1.5rem',
                  }}
                >
                  {loading ? 'Sending OTP...' : 'Send Verification OTP'}
                </button>
              </form>
            )}

            {showOtpInput && (
              <div>
                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1.5rem', textAlign: 'center' }}>
                  Enter the 6-digit verification code sent to {phoneNumber}.
                </p>
                <FloatingLabelInput
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  label="6-Digit OTP Code"
                  required
                />
                <button
                  type="button"
                  onClick={verifyOtp}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    background: '#007cff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '20px',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    marginTop: '1.5rem',
                  }}
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
              </div>
            )}

            {/* Back Button */}
            <button
              type="button"
              onClick={() => {
                setShowPhoneForm(false);
                setShowOtpInput(false);
                setError('');
              }}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: '#666',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: 'pointer',
                marginTop: '1.5rem',
                textDecoration: 'none',
                fontFamily: 'inherit',
                textAlign: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#111827';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#666';
              }}
            >
              ← Back to other options
            </button>
          </div>
        ) : showEmailForm ? (
          <form onSubmit={handleSubmit}>
            {/* Email Field */}
            <FloatingLabelInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
              label="Email"
              required
              hasError={touched.email && !email}
            />

            {/* Password Field */}
            <div style={{ marginBottom: '1.5rem' }}>
              <FloatingLabelInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
                label="Password"
                required
                showPasswordToggle
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword(!showPassword)}
                hasError={touched.password && !password}
              />
            </div>

            {/* Forgot Password Link */}
            <div style={{
              textAlign: 'right',
              marginBottom: '1.5rem',
              marginTop: '-0.8rem',
            }}>
              <Link
                href="/auth/reset-password"
                style={{
                  color: '#0070f3',
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                Forgot password?
              </Link>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '1rem',
                background: loading ? '#93c5fd' : '#007cff',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: '1rem',
                transition: 'background-color 0.2s',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = '#1d4ed8';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = '#007cff';
                }
              }}
            >
              {loading ? 'Logging in...' : 'Log in'}
            </button>

            {/* Back to other options */}
            <button
              type="button"
              onClick={() => setShowEmailForm(false)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: '#666',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: 'pointer',
                marginBottom: '1.5rem',
                textDecoration: 'none',
                fontFamily: 'inherit',
                textAlign: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#111827';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#666';
              }}
            >
              ← Back to other options
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Google Sign In */}
            <button
              type="button"
              onClick={() => {
                if (safeRedirect) localStorage.setItem('milko_return_after_auth', safeRedirect);
                loginWithGoogle();
              }}
              style={{
                width: '100%',
                padding: '1rem',
                background: '#ffffff',
                color: '#1a1a1a',
                border: '1px solid #ffffff',
                borderRadius: '100px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                fontFamily: 'inherit',
              }}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Login with Phone */}
            <button
              type="button"
              style={{
                width: '100%',
                padding: '1rem',
                background: '#ffffff',
                color: '#1a1a1a',
                border: '1px solid #ffffff',
                borderRadius: '100px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'not-allowed',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                fontFamily: 'inherit',
                opacity: 0.7,
              }}
              onMouseEnter={() => setHoveredPhone(true)}
              onMouseLeave={() => setHoveredPhone(false)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
              {hoveredPhone ? 'Coming Soon' : 'Continue with Phone'}
            </button>

            {/* Continue with Email */}
            <button
              type="button"
              onClick={() => setShowEmailForm(true)}
              style={{
                width: '100%',
                padding: '1rem',
                background: '#ffffff',
                color: 'rgb(26, 26, 26)',
                border: '1px solid #ffffff',
                borderRadius: '100px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                fontFamily: 'inherit',
              }}
            >
              <EnvelopeIcon />
              Continue with Email
            </button>

            {/* Others Toggle Button */}
            {!showOthers && (
              <button
                type="button"
                onClick={() => setShowOthers(true)}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: '#ffffff',
                  color: '#1a1a1a',
                  border: '1px solid #ffffff',
                  borderRadius: '100px',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  fontFamily: 'inherit',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
                Other Options
              </button>
            )}

            {/* Social Auth Buttons Row */}
            {showOthers && (
              <div className={styles.socialButtonsRow} style={{ marginBottom: '1.5rem' }}>
                {/* Facebook */}
                <button
                  type="button"
                  onClick={(e) => e.preventDefault()}
                  className={`${styles.socialButton} ${styles.mutedSocialButton}`}
                  title="Coming soon"
                >
                  <span className={styles.iconWrapper}>
                    <FacebookIcon />
                  </span>
                  <span className={styles.comingSoonText}>Coming soon</span>
                </button>

                {/* Discord */}
                <button
                  type="button"
                  onClick={() => {
                    if (safeRedirect) localStorage.setItem('milko_return_after_auth', safeRedirect);
                    loginWithDiscord();
                  }}
                  className={styles.socialButton}
                  title="Continue with Discord"
                >
                  <DiscordIcon />
                </button>

                {/* X (Twitter) */}
                <button
                  type="button"
                  onClick={() => {
                    if (safeRedirect) localStorage.setItem('milko_return_after_auth', safeRedirect);
                    loginWithTwitter();
                  }}
                  className={styles.socialButton}
                  title="Continue with X"
                >
                  <XIcon />
                </button>

                {/* Telegram */}
                <button
                  type="button"
                  onClick={handleTelegramLogin}
                  className={styles.socialButton}
                  title="Continue with Telegram"
                >
                  <TelegramIcon />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sign Up Link */}
        {!isAdmin && (
          <p style={{ 
            textAlign: 'center', 
            color: '#1a1a1a',
            fontWeight: 500,
            fontSize: '0.9rem',
            margin: 0
          }}>
            Don&apos;t have an account?{' '}
            <Link 
              href={safeRedirect ? `/auth/signup?redirect=${encodeURIComponent(safeRedirect)}` : '/auth/signup'} 
              style={{ 
                color: '#0070f3',
                textDecoration: 'none',
                fontWeight: 500
              }}
            >
              Sign up
            </Link>
          </p>
        )}
      </div>

      {/* Terms and Privacy Policy - Outside the card */}
      <p style={{ 
        textAlign: 'center', 
        color: '#1a1a1a',
        fontWeight: 500,
        fontSize: '0.75rem',
        margin: 0,
        marginTop: '1.5rem',
        lineHeight: '1.4',
        width: '100%',
        padding: '0px 61px',
        maxWidth: '440px'
      }}>
        By continuing, you agree to our{' '}
        <Link href="/terms" style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 500 }}>Terms of service</Link>
        {' & '}
        <Link href="/privacy" style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 500 }}>Privacy policy</Link>
      </p>
    </div>
  );
}

/**
 * Login Page – wraps LoginForm in Suspense (useSearchParams requires it for static prerender).
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.authContainer} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#ffffff', padding: '3rem' }}>
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}><h1 style={{ margin: 0 }}><Logo textClassName={styles.authLogoText} imageClassName={styles.authLogoImg} /></h1></div>
          <div style={{ background: 'white', padding: '2.5rem', borderRadius: '12px', width: '100%', maxWidth: '440px', textAlign: 'center', color: '#666' }}>Loading…</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
