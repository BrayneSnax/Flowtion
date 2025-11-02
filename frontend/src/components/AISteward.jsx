import { useState, useEffect } from 'react';
import { Bookmark, Link2, Clock, Archive } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AISteward({ visible, currentPage, axiosInstance, onAction }) {
  const [suggestion, setSuggestion] = useState(null);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [idleTime, setIdleTime] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  // Track idle time
  useEffect(() => {
    let idleTimer;
    let counter = 0;

    const resetIdle = () => {
      counter = 0;
      setIdleTime(0);
    };

    const incrementIdle = () => {
      counter += 1;
      setIdleTime(counter);
      
      // After 3 minutes of idle, show soft suggestion
      if (counter === 180 && !showSummary) {
        loadSessionSummary();
      }
    };

    // Reset on activity
    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    
    // Increment every second
    idleTimer = setInterval(incrementIdle, 1000);

    return () => {
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      clearInterval(idleTimer);
    };
  }, [showSummary]);

  const loadSessionSummary = async () => {
    try {
      const response = await axiosInstance.post(`${API}/steward/session-summary`);
      setSessionSummary(response.data);
      setShowSummary(true);
    } catch (error) {
      console.error('Failed to load session summary', error);
    }
  };

  const handleIntent = async (intent) => {
    onAction?.(intent);
    setShowSummary(false);
    
    if (intent === 'rest') {
      toast.success('Taking a breath...');
    }
  };

  if (!visible) return null;

  return (
    <>
      {/* Soft footer chip row */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-center p-4 pointer-events-none">
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg px-4 py-2 pointer-events-auto border border-slate-200">
          <button
            onClick={() => handleIntent('keep')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors text-sm text-slate-700"
            data-testid="steward-keep"
            title="Save current state"
          >
            <Bookmark size={14} />
            <span>keep</span>
          </button>
          
          <div className="w-px h-4 bg-slate-300" />
          
          <button
            onClick={() => handleIntent('connect')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors text-sm text-slate-700"
            data-testid="steward-connect"
            title="Link to another page"
          >
            <Link2 size={14} />
            <span>connect</span>
          </button>
          
          <div className="w-px h-4 bg-slate-300" />
          
          <button
            onClick={() => handleIntent('remind')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors text-sm text-slate-700"
            data-testid="steward-remind"
            title="Set a reminder"
          >
            <Clock size={14} />
            <span>remind</span>
          </button>
          
          <div className="w-px h-4 bg-slate-300" />
          
          <button
            onClick={() => handleIntent('rest')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors text-sm text-slate-700"
            data-testid="steward-rest"
            title="Take a break"
          >
            <Archive size={14} />
            <span>rest</span>
          </button>
        </div>
      </div>

      {/* Session summary card (appears after 3 min idle) */}
      {showSummary && sessionSummary && (
        <div className="fixed bottom-24 right-4 z-30 max-w-sm">
          <div className="bg-white rounded-xl shadow-2xl p-4 border border-slate-200 animate-in slide-in-from-bottom">
            <div className="flex items-start justify-between mb-2">
              <div className="text-sm font-medium text-slate-900">Session rhythm</div>
              <button
                onClick={() => setShowSummary(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>
            
            <p className="text-sm text-slate-600 mb-3">
              {sessionSummary.summary}
            </p>
            
            {sessionSummary.next_step && (
              <div className="text-xs text-slate-500 mb-3 pl-3 border-l-2 border-blue-200">
                Next: {sessionSummary.next_step}
              </div>
            )}
            
            <div className="text-xs text-slate-400">
              {sessionSummary.pages_touched} pages touched
            </div>
          </div>
        </div>
      )}

      {/* Right-edge glow (state indicator) */}
      {currentPage && (
        <div className="fixed right-0 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div 
            className={`w-1 h-32 blur-xl transition-all duration-1000 ${
              currentPage.state === 'active' || currentPage.state === 'germinating'
                ? 'bg-orange-400 opacity-60'
                : 'bg-blue-400 opacity-30'
            }`}
          />
        </div>
      )}
    </>
  );
}