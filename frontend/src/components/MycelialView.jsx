import { useState, useEffect } from 'react';
import { Link2 } from 'lucide-react';

const stateConfig = {
  germinating: { color: 'bg-green-500' },
  active: { color: 'bg-orange-500' },
  cooling: { color: 'bg-blue-500' },
  crystallized: { color: 'bg-slate-500' },
  turbulent: { color: 'bg-purple-500' }
};

export default function MycelialView({ currentPageId, pages, onPageSelect, metaphorMode }) {
  const [backlinks, setBacklinks] = useState([]);
  const [nearbyIdeas, setNearbyIdeas] = useState([]);

  useEffect(() => {
    if (!currentPageId) return;

    // Find pages in same hierarchy
    const currentPage = pages.find(p => p.id === currentPageId);
    if (!currentPage) return;

    // Nearby: siblings and cousins
    const siblings = pages.filter(p => 
      p.parent_id === currentPage.parent_id && p.id !== currentPageId
    );
    const children = pages.filter(p => p.parent_id === currentPageId);
    setNearbyIdeas([...siblings, ...children].slice(0, 5));

    // Backlinks would come from actual content analysis
    // For now, show related by state
    const related = pages
      .filter(p => p.state === currentPage.state && p.id !== currentPageId)
      .slice(0, 3);
    setBacklinks(related);
  }, [currentPageId, pages]);

  if (!currentPageId) return null;

  const hasContent = backlinks.length > 0 || nearbyIdeas.length > 0;
  if (!hasContent) return null;

  return (
    <div className="border-t border-slate-200/50 p-4 space-y-4">
      {backlinks.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide flex items-center gap-2">
            <Link2 size={12} />
            {metaphorMode ? 'Echoes' : 'Mentioned in'}
          </h3>
          <div className="space-y-1">
            {backlinks.map((page) => {
              const state = stateConfig[page.state] || stateConfig.germinating;
              return (
                <button
                  key={page.id}
                  onClick={() => onPageSelect(page.id)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/50 transition-colors text-left text-sm"
                >
                  <div className={`w-2 h-2 rounded-full ${state.color} flex-shrink-0`} />
                  <span className="text-slate-700 truncate">{page.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {nearbyIdeas.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
            {metaphorMode ? 'Nearby resonance' : 'Nearby ideas'}
          </h3>
          <div className="space-y-1">
            {nearbyIdeas.map((page) => {
              const state = stateConfig[page.state] || stateConfig.germinating;
              return (
                <button
                  key={page.id}
                  onClick={() => onPageSelect(page.id)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/50 transition-colors text-left text-sm"
                >
                  <div className={`w-2 h-2 rounded-full ${state.color} flex-shrink-0`} />
                  <span className="text-slate-700 truncate">{page.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}