import { useState, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ConversationalInput({ frequency, onStructureCreated, axiosInstance }) {
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [modelPreference, setModelPreference] = useState('hermes'); // hermes or openai

  useEffect(() => {
    // Context-aware placeholder suggestions
    const suggestions = {
      focus: "Define the next clear action...",
      dream: "What wants to emerge?",
      reflect: "What patterns are you noticing?",
      synthesize: "How do these threads connect?"
    };
    setSuggestion(suggestions[frequency] || "Speak and it builds...");
  }, [frequency]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!input.trim() || processing) return;

    setProcessing(true);
    const userInput = input;
    setInput('');
    
    // Pass user input to parent
    if (onUserInput) {
      onUserInput(userInput);
    }

    try {
      const response = await axiosInstance.post(`${API}/converse`, {
        text: userInput,
        current_frequency: frequency,
        model_preference: modelPreference
      });

      // Pass full response data to parent
      onStructureCreated?.({
        ...response.data,
        action: response.data.action
      });
      
      // Show brief toast confirmation
      if (response.data.nodes && response.data.nodes.length > 0) {
        toast.success(`${response.data.nodes.length} node${response.data.nodes.length > 1 ? 's' : ''} added to field`, {
          duration: 2000
        });
      }
    } catch (error) {
      toast.error('Could not process that');
      setInput(userInput); // Restore input on error
    } finally {
      setProcessing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-center p-6 pointer-events-none">
      <div className="w-full max-w-3xl pointer-events-auto space-y-3">
        {/* Model selector - subtle and warm */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 backdrop-blur-md shadow-lg border border-slate-200">
            <Sparkles size={14} className="text-slate-400" />
            <button
              onClick={() => setModelPreference('hermes')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                modelPreference === 'hermes'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Hermes
            </button>
            <button
              onClick={() => setModelPreference('openai')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                modelPreference === 'openai'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              OpenAI
            </button>
          </div>
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={suggestion}
              disabled={processing}
              className="w-full px-6 py-4 pr-14 rounded-full bg-white/95 backdrop-blur-md shadow-2xl border-2 border-slate-200 focus:border-blue-400 focus:outline-none text-lg placeholder-slate-400 transition-all"
              data-testid="conversational-input"
              autoFocus
            />
            <button
              type="submit"
              disabled={!input.trim() || processing}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              data-testid="submit-input"
            >
              {processing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}