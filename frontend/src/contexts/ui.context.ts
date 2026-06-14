import { createContext } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface UIContextType {
  toast: (message: string, type?: ToastType) => void;
  confirm: (message: string, onConfirm: () => void, onCancel?: () => void) => void;
}

export const UIContext = createContext<UIContextType | undefined>(undefined);
