'use client';

import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import gsap from 'gsap';

interface TransitionContextType {
  triggerEnterpriseTransition: (e: React.MouseEvent<HTMLElement> | MouseEvent) => void;
  isTransitioning: boolean;
}

const EnterpriseTransitionContext = createContext<TransitionContextType>({
  triggerEnterpriseTransition: () => {},
  isTransitioning: false,
});

export const useEnterpriseTransition = () => useContext(EnterpriseTransitionContext);

export function EnterpriseTransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const overlayRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<{ x: number; y: number; maxR: number }>({ x: 0, y: 0, maxR: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const phaseRef = useRef<'idle' | 'expanding' | 'waiting_page' | 'shrinking'>('idle');
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  const calculateMaxRadius = (x: number, y: number): number => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const h = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const d1 = Math.hypot(x, y);
    const d2 = Math.hypot(w - x, y);
    const d3 = Math.hypot(x, h - y);
    const d4 = Math.hypot(w - x, h - y);
    return Math.max(d1, d2, d3, d4) + 50;
  };

  const startShrinkAnimation = useCallback(() => {
    if (phaseRef.current !== 'waiting_page') return;
    phaseRef.current = 'shrinking';

    const overlay = overlayRef.current;
    if (!overlay) return;

    const { x, y, maxR } = originRef.current;
    const animObj = { radius: maxR };

    if (tweenRef.current) {
      tweenRef.current.kill();
    }

    tweenRef.current = gsap.to(animObj, {
      radius: 0,
      duration: 0.7,
      ease: 'power3.inOut',
      onUpdate: () => {
        if (overlayRef.current) {
          overlayRef.current.style.clipPath = `circle(${animObj.radius}px at ${x}px ${y}px)`;
        }
      },
      onComplete: () => {
        if (overlayRef.current) {
          overlayRef.current.style.display = 'none';
          overlayRef.current.style.clipPath = 'none';
        }
        phaseRef.current = 'idle';
        setIsTransitioning(false);
      },
    });
  }, []);

  const triggerEnterpriseTransition = useCallback(
    (e: React.MouseEvent<HTMLElement> | MouseEvent) => {
      if (phaseRef.current !== 'idle') return;

      let x = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
      let y = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;

      if (e) {
        const target = (e.currentTarget || e.target) as HTMLElement | null;
        if (target && target.getBoundingClientRect) {
          const rect = target.getBoundingClientRect();
          x = rect.left + rect.width / 2;
          y = rect.top + rect.height / 2;
        } else if ('clientX' in e && typeof e.clientX === 'number') {
          x = e.clientX;
          y = e.clientY;
        }
      }

      const maxR = calculateMaxRadius(x, y);
      originRef.current = { x, y, maxR };
      phaseRef.current = 'expanding';
      setIsTransitioning(true);

      const overlay = overlayRef.current;
      if (!overlay) return;

      // Show overlay
      overlay.style.display = 'block';
      overlay.style.opacity = '1';
      overlay.style.clipPath = `circle(0px at ${x}px ${y}px)`;

      // Kill any previous tween
      if (tweenRef.current) {
        tweenRef.current.kill();
      }

      const animObj = { radius: 0 };

      tweenRef.current = gsap.to(animObj, {
        radius: maxR,
        duration: 0.7,
        ease: 'power3.inOut',
        onUpdate: () => {
          if (overlayRef.current) {
            overlayRef.current.style.clipPath = `circle(${animObj.radius}px at ${x}px ${y}px)`;
          }
        },
        onComplete: () => {
          phaseRef.current = 'waiting_page';
          // Navigate to enterprise page if not already there
          if (pathname !== '/enterprise') {
            router.push('/enterprise');
          } else {
            // If already on /enterprise, force trigger reverse
            startShrinkAnimation();
          }
        },
      });
    },
    [pathname, router, startShrinkAnimation]
  );

  // Handle route change / page arrival
  useEffect(() => {
    if (pathname === '/enterprise' && phaseRef.current === 'waiting_page') {
      const timer = setTimeout(() => {
        startShrinkAnimation();
      }, 60);
      return () => clearTimeout(timer);
    } else if (phaseRef.current !== 'expanding' && phaseRef.current !== 'waiting_page' && phaseRef.current !== 'shrinking') {
      // Ensure overlay remains completely hidden on initial direct page load or refresh of /enterprise or any route
      if (overlayRef.current) {
        overlayRef.current.style.display = 'none';
        overlayRef.current.style.clipPath = 'none';
      }
      phaseRef.current = 'idle';
      setIsTransitioning(false);
    }
  }, [pathname, startShrinkAnimation]);

  return (
    <EnterpriseTransitionContext.Provider value={{ triggerEnterpriseTransition, isTransitioning }}>
      {children}
      {/* Fullscreen White Overlay Layer */}
      <div
        ref={overlayRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#ffffff',
          zIndex: 999999,
          pointerEvents: isTransitioning ? 'all' : 'none',
          display: 'none',
          willChange: 'clip-path',
        }}
      />
    </EnterpriseTransitionContext.Provider>
  );
}
