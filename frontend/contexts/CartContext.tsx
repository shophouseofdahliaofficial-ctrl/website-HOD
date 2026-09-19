'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, useMemo } from 'react';
import { getCartStorage, CartItem, CartMutationResult, mergeGuestCartIntoUserCart } from '@/lib/utils/cart';
import { trackCartEvent } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  addItem: (item: CartItem, maxQuantity?: number) => CartMutationResult;
  removeItem: (productId: string, variationId?: string, customizations?: any) => void;
  setItemQuantity: (productId: string, quantity: number, variationId?: string, maxQuantity?: number, customizations?: any) => CartMutationResult;
  clearCart: () => void;
  refreshCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const cart = useMemo(() => getCartStorage(user?.id ?? null), [user?.id]);
  const [items, setItems] = useState<CartItem[]>([]);
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  const refreshCart = useCallback(() => {
    setItems(cart.get());
  }, [cart]);

  const getCartItemCount = useCallback(() => {
    return cart.get().reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, [cart]);

  useEffect(() => {
    const userId = user?.id ?? null;
    const prevUserId = prevUserIdRef.current;

    if (prevUserId === undefined) {
      if (userId) mergeGuestCartIntoUserCart(userId);
      refreshCart();
    } else if (!prevUserId && userId) {
      mergeGuestCartIntoUserCart(userId);
      refreshCart();
    } else if (prevUserId && !userId) {
      refreshCart();
    } else if (prevUserId !== userId) {
      refreshCart();
    }

    prevUserIdRef.current = userId;
  }, [user?.id, refreshCart]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key === cart.storageKey || e.key.startsWith('milko_cart_v1')) {
        refreshCart();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [cart, refreshCart]);

  const addItem = useCallback(
    (item: CartItem, maxQuantity?: number) => {
      const result = cart.add(item, maxQuantity);
      refreshCart();
      if (result.appliedQuantity > 0) {
        void trackCartEvent({
          eventType: 'add',
          cartItemCount: getCartItemCount(),
          productId: item.productId,
          variationId: item.variationId,
        });
      }
      return result;
    },
    [cart, refreshCart, getCartItemCount],
  );

  const removeItem = useCallback(
    (productId: string, variationId?: string, customizations?: any) => {
      cart.remove(productId, variationId, customizations);
      refreshCart();
      void trackCartEvent({
        eventType: 'remove',
        cartItemCount: getCartItemCount(),
        productId,
        variationId,
      });
    },
    [cart, refreshCart, getCartItemCount],
  );

  const setItemQuantity = useCallback(
    (productId: string, quantity: number, variationId?: string, maxQuantity?: number, customizations?: any) => {
      const previousCount = getCartItemCount();
      const existingItem = cart.get().find(
        (item) => item.productId === productId && 
                  (item.variationId || '') === (variationId || '') &&
                  JSON.stringify(item.customizations || {}) === JSON.stringify(customizations || {}),
      );
      const result = cart.setQuantity(productId, quantity, variationId, maxQuantity, customizations);
      refreshCart();
      const nextCount = getCartItemCount();
      if (existingItem && nextCount !== previousCount) {
        void trackCartEvent({
          eventType: nextCount > previousCount ? 'add' : 'remove',
          cartItemCount: nextCount,
          productId,
          variationId,
        });
      }
      return result;
    },
    [cart, refreshCart, getCartItemCount],
  );

  const clearCart = useCallback(() => {
    cart.clear();
    refreshCart();
    void trackCartEvent({
      eventType: 'clear',
      cartItemCount: 0,
    });
  }, [cart, refreshCart]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        addItem,
        removeItem,
        setItemQuantity,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
