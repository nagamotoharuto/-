"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  category: string;
}

export interface UserProfile {
  nickname: string;
  userType: string;
}

interface BakeryStore {
  cart: CartItem[];
  user: UserProfile | null;
  pickupTime: string;
  paymentMethod: string;

  setUser: (user: UserProfile) => void;
  setPickupTime: (time: string) => void;
  setPaymentMethod: (method: string) => void;
  addToCart: (item: Omit<CartItem, "quantity">) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getTotalItems: () => number;
}

export const useBakeryStore = create<BakeryStore>()(
  persist(
    (set, get) => ({
      cart: [],
      user: null,
      pickupTime: "",
      paymentMethod: "cash",

      setUser: (user) => set({ user }),
      setPickupTime: (time) => set({ pickupTime: time }),
      setPaymentMethod: (method) => set({ paymentMethod: method }),

      addToCart: (item) => {
        const { cart } = get();
        const existing = cart.find((c) => c.productId === item.productId);
        if (existing) {
          set({
            cart: cart.map((c) =>
              c.productId === item.productId
                ? { ...c, quantity: c.quantity + 1 }
                : c
            ),
          });
        } else {
          set({ cart: [...cart, { ...item, quantity: 1 }] });
        }
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(productId);
          return;
        }
        set({
          cart: get().cart.map((c) =>
            c.productId === productId ? { ...c, quantity } : c
          ),
        });
      },

      removeFromCart: (productId) => {
        set({ cart: get().cart.filter((c) => c.productId !== productId) });
      },

      clearCart: () => set({ cart: [] }),

      getTotal: () =>
        get().cart.reduce((sum, item) => sum + item.price * item.quantity, 0),

      getTotalItems: () =>
        get().cart.reduce((sum, item) => sum + item.quantity, 0),
    }),
    { name: "bakery-store" }
  )
);
