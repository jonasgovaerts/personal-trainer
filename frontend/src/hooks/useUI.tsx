import { useContext } from 'react';
import { UIContext, UIContextType } from '../contexts/ui.context';

export function useUI(): UIContextType {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
