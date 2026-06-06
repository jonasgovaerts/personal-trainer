import { createContext, useContext, useState, ReactNode } from 'react';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface UIContextType {
  toast: (message: string, type?: ToastType) => void;
  confirm: (message: string, onConfirm: () => void, onCancel?: () => void) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<{ message: string, onConfirm: () => void, onCancel?: () => void } | null>(null);

  const toast = (message: string, type: ToastType = 'info') => {
    if (type === 'error') {
      console.error(`[UI Error] ${message}`);
    }
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const confirm = (message: string, onConfirm: () => void, onCancel?: () => void) => {
    setConfirmState({ message, onConfirm, onCancel });
  };

  const handleConfirm = () => {
    if (confirmState) {
      confirmState.onConfirm();
      setConfirmState(null);
    }
  };

  const handleCancel = () => {
    if (confirmState && confirmState.onCancel) {
      confirmState.onCancel();
    }
    setConfirmState(null);
  };

  return (
    <UIContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toasts Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className="animate-in slide-in-from-top-4 fade-in duration-300">
            <div className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md min-w-[250px]",
              t.type === 'success' ? "bg-emerald-950/80 border-emerald-900/50 text-emerald-400" :
              t.type === 'error' ? "bg-red-950/80 border-red-900/50 text-red-400" :
              "bg-slate-900/80 border-slate-800 text-white"
            )}>
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
              {t.type === 'error' && <XCircle className="w-5 h-5" />}
              {t.type === 'info' && <AlertCircle className="w-5 h-5" />}
              <span className="font-semibold text-sm">{t.message}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm Modal */}
      {confirmState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-white mb-4">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="text-lg font-bold">Confirmation Required</h3>
            </div>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              {confirmState.message}
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={handleCancel}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirm}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
