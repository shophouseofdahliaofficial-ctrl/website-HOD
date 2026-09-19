'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type CheckoutStep = 'address' | 'review' | null;

type CheckoutStepContextValue = {
  checkoutStep: CheckoutStep;
  setCheckoutStep: (step: CheckoutStep) => void;
};

const CheckoutStepContext = createContext<CheckoutStepContextValue>({
  checkoutStep: null,
  setCheckoutStep: () => {},
});

export function CheckoutStepProvider({ children }: { children: ReactNode }) {
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>(null);
  const setter = useCallback((step: CheckoutStep) => setCheckoutStep(step), []);
  return (
    <CheckoutStepContext.Provider value={{ checkoutStep, setCheckoutStep: setter }}>
      {children}
    </CheckoutStepContext.Provider>
  );
}

export function useCheckoutStep() {
  return useContext(CheckoutStepContext);
}
