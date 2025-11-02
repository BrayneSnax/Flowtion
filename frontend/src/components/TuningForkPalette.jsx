import { useState, useEffect } from 'react';
import { Search, Clock, Sparkles } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const stateConfig = {
  germinating: { color: 'bg-green-500' },
  active: { color: 'bg-orange-500' },
  cooling: { color: 'bg-blue-500' },
  crystallized: { color: 'bg-slate-500' },
  turbulent: { color: 'bg-purple-500' }
};

export default function TuningForkPalette({ 
  open, 
  onClose, 
  pages, 
  onSelect, 
  metaphorMode,
  axiosInstance 
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      // Show recent pages when no query
      const sorted = [...pages].sort((a, b) => 
        new Date(b.last_viewed_at || b.updated_at) - new Date(a.last_viewed_at || a.updated_at)
      );
      setResults(sorted.slice(0, 5).map(p => ({ ...p, reason: 'Recently viewed' })));
      return;
    }

    // Simple client-side search
    const searchResults = pages
      .filter(p => p.title.toLowerCase().includes(query.toLowerCase()))
      .map(p => ({ ...p, reason: 'Title match' }));
    
    setResults(searchResults.slice(0, 5));
  }, [query, pages]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && results.length > 0) {
      onSelect(results[0].id);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden" data-testid="tuning-fork-palette">
        <div className="border-b border-slate-200 p-4 flex items-center gap-3">
          <Search className="text-slate-400" size={20} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={metaphorMode ? "Tune into..." : "Search pages..."}
            className="border-none shadow-none focus-visible:ring-0 text-lg"
            autoFocus
            data-testid="search-input"
          />
        </div>

        <div className="max-h-96 overflow-y-auto">
          {results.length > 0 ? (
            <div className="p-2">
              {results.map((page) => {
                const state = stateConfig[page.state] || stateConfig.germinating;
                return (
                  <button
                    key={page.id}
                    onClick={() => {
                      onSelect(page.id);
                      onClose();
                    }}
                    className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors text-left group"
                    data-testid={`search-result-${page.id}`}
                  >
                    <div className={`w-3 h-3 rounded-full ${state.color} mt-1 flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{page.title}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                        {page.reason === 'Recently viewed' && <Clock size={12} />}
                        {page.reason === 'Semantic match' && <Sparkles size={12} />}
                        <span>{page.reason}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : query ? (
            <div className="p-8 text-center text-slate-500">
              <p>No pages found</p>
              <p className="text-xs mt-2">Try a different search term</p>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Start typing to search</p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 p-3 bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
          <span>↑↓ to navigate • ↵ to select • esc to close</span>
          {metaphorMode && <span className="text-purple-600">✨ Resonance mode</span>}
        </div>
      </DialogContent>
    </Dialog>
  );
}