import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PauseLine({ visible, onContinue, onSaveAndExit, onReminder, onClose }) {
  useEffect(() => {
    if (visible) {
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          onClose?.();
        }
      };
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 animate-in fade-in duration-300" />
      
      {/* Pause Card */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full space-y-6 animate-in zoom-in duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <AlertCircle className="text-blue-600" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">One breath</h3>
              <p className="text-sm text-slate-600">I'm sensing you're switching contexts</p>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              onClick={onContinue}
              className="w-full justify-start h-12 text-left bg-slate-100 hover:bg-slate-200 text-slate-900"
              data-testid="pause-continue"
            >
              Continue where I was
            </Button>
            
            <Button
              onClick={onSaveAndExit}
              className="w-full justify-start h-12 text-left bg-slate-100 hover:bg-slate-200 text-slate-900"
              data-testid="pause-save-exit"
            >
              Save and step out
            </Button>
            
            <Button
              onClick={onReminder}
              className="w-full justify-start h-12 text-left bg-slate-100 hover:bg-slate-200 text-slate-900"
              data-testid="pause-reminder"
            >
              Set gentle reminder
            </Button>
          </div>

          <button
            onClick={onClose}
            className="w-full text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            Press Esc to dismiss
          </button>
        </div>
      </div>
    </>
  );
}