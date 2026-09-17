import { create } from 'zustand';

interface ToastItem {
  id: number;
  emoji: string;
  color: string;
  text: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => get().dismiss(id), 2600);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export function showToast(text: string, emoji = '✅', color = '#D2603A'): void {
  useToastStore.getState().push({ text, emoji, color });
}