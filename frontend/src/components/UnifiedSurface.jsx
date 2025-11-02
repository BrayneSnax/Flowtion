import { useState, useEffect, useRef } from "react";
import { Sparkles, Layers, LogOut, Circle, Search, Settings } from "lucide-react";
import { toast } from "sonner";
import BlockEditor from "@/components/BlockEditor";
import OrientationHeader from "@/components/OrientationHeader";
import PauseLine from "@/components/PauseLine";
import TuningForkPalette from "@/components/TuningForkPalette";
import MycelialView from "@/components/MycelialView";
import { useMetaphorMode, useFrictionDetection, getLabel } from "@/hooks/usePDA";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const stateConfig = {
  germinating: { color: 'bg-green-500', pulse: true, label: 'Germinating 🌱' },
  active: { color: 'bg-orange-500', pulse: true, label: 'Active 🔥' },
  cooling: { color: 'bg-blue-500', pulse: false, label: 'Cooling 💧' },
  crystallized: { color: 'bg-slate-500', pulse: false, label: 'Crystallized 🪨' },
  turbulent: { color: 'bg-purple-500', pulse: true, label: 'Turbulent 🌀' }
};

const frequencyBg = {
  focus: 'from-orange-50/30 to-red-50/30',
  dream: 'from-purple-50/30 to-pink-50/30',
  reflect: 'from-blue-50/30 to-cyan-50/30',
  synthesize: 'from-indigo-50/30 to-violet-50/30'
};

export default function UnifiedSurface({
  page,
  pages,
  recentPages,
  callingPages,
  frequency,
  onPageCreate,
  onPageUpdate,
  onPageDissolve,
  onPageSelect,
  onViewConstellation,
  onChangeFrequency,
  onLogout,
  axiosInstance
}) {
  const [title, setTitle] = useState(page?.title || "");
  const [showRecent, setShowRecent] = useState(false);
  const [showStates, setShowStates] = useState(false);
  const [pauseVisible, setPauseVisible] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const titleRef = useRef(null);
  const { enabled: metaphorMode, toggle: toggleMetaphor } = useMetaphorMode();
  const { recordFriction } = useFrictionDetection(() => {
    setPauseVisible(true);
  });

  useEffect(() => {
    setTitle(page?.title || "");
  }, [page?.id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape to pause
      if (e.key === 'Escape' && !pauseVisible && !searchOpen) {
        e.preventDefault();
        setPauseVisible(true);
      }
      // Cmd/Ctrl+K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      // Shift+F to change frequency
      if (e.shiftKey && e.key === 'F') {
        e.preventDefault();
        onChangeFrequency();
      }
      // Shift+C to view constellation
      if (e.shiftKey && e.key === 'C') {
        e.preventDefault();
        onViewConstellation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pauseVisible, searchOpen]);

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
  };

  const handleTitleBlur = () => {
    if (page && title !== page.title) {
      onPageUpdate(page.id, { title: title || "Untitled" });
    }
  };

  const changeState = (newState) => {
    if (page) {
      onPageUpdate(page.id, { state: newState });
      setShowStates(false);
    }
  };

  if (!page) {
    return (
      <div className={`h-screen flex items-center justify-center bg-gradient-to-br ${frequencyBg[frequency]} p-8`}>
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6 opacity-50">✨</div>
          <h2 className="text-3xl font-light text-slate-700 mb-4">Empty canvas</h2>
          <p className="text-slate-500 mb-8">Create a new thought or let one emerge</p>
          <button
            onClick={() => onPageCreate('germinating')}
            className="px-8 py-3 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors"
            data-testid="create-first-page"
          >
            Begin
          </button>
        </div>
      </div>
    );
  }

  const currentState = stateConfig[page.state] || stateConfig.germinating;

  return (
    <>
      <div className={`h-screen flex flex-col bg-gradient-to-br ${frequencyBg[frequency]} transition-colors duration-1000`}>
        {/* Orientation Header */}
        <OrientationHeader
          breadcrumb={['Workspace', page.title]}
          intent="drafting"
          options={[
            { label: 'save', onClick: () => toast.success('Saved') },
            { label: 'pause', onClick: () => setPauseVisible(true) },
          ]}
        />

        {/* Minimal Header */}
        <div className="flex items-center justify-between px-4 sm:px-8 py-3 border-b border-slate-200/50 backdrop-blur-sm bg-white/30">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            {/* State Indicator */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowStates(!showStates)}
                className="flex items-center gap-1 sm:gap-2 p-2 rounded-full hover:bg-white/50 transition-colors"
                data-testid="state-selector"
              >
                <div className={`w-3 h-3 rounded-full ${currentState.color} ${
                  currentState.pulse ? 'animate-pulse' : ''
                }`} />
              </button>

              {showStates && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowStates(false)}
                  />
                  <div className="absolute top-full mt-2 left-0 bg-white rounded-xl shadow-2xl p-2 z-50 min-w-[200px]">
                    {Object.entries(stateConfig).map(([state, config]) => (
                      <button
                        key={state}
                        onClick={() => changeState(state)}
                        className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors text-left"
                      >
                        <div className={`w-3 h-3 rounded-full ${config.color}`} />
                        <span className="text-sm text-slate-700">{config.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Title */}
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              placeholder="Untitled"
              className="flex-1 text-lg sm:text-2xl font-light bg-transparent border-none outline-none text-slate-900 placeholder-slate-400 min-w-0"
              data-testid="page-title-input"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button
              onClick={() => setShowRecent(!showRecent)}
              className="p-2 rounded-full hover:bg-white/50 transition-colors"
              title="Recent pages"
              data-testid="toggle-recent"
            >
              <Circle size={18} className="text-slate-600" />
            </button>
            <button
              onClick={onViewConstellation}
              className="p-2 rounded-full hover:bg-white/50 transition-colors"
              title="Constellation"
              data-testid="view-constellation"
            >
              <Layers size={18} className="text-slate-600" />
            </button>
            <button
              onClick={onLogout}
              className="p-2 rounded-full hover:bg-white/50 transition-colors"
              title="Logout"
              data-testid="logout-button"
            >
              <LogOut size={18} className="text-slate-600" />
            </button>
          </div>
        </div>

        {/* Main Surface */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-12">
            <BlockEditor
              page={page}
              onPageUpdate={onPageUpdate}
              axiosInstance={axiosInstance}
              frequency={frequency}
            />
          </div>
        </div>
      </div>

      {/* Recent Pages Drawer (Mobile-friendly) */}
      {showRecent && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowRecent(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 sm:right-auto sm:top-0 sm:w-80 bg-white rounded-t-2xl sm:rounded-none sm:border-r border-slate-200 p-6 z-50 max-h-[70vh] sm:max-h-full overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Recent</h2>
              <button
                onClick={() => setShowRecent(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <Circle size={18} className="text-slate-600" />
              </button>
            </div>
            
            {recentPages.length > 0 ? (
              <div className="space-y-2">
                {recentPages.slice(0, 10).map((p) => {
                  const state = stateConfig[p.state] || stateConfig.germinating;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        onPageSelect(p.id);
                        setShowRecent(false);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className={`w-3 h-3 rounded-full ${state.color} flex-shrink-0`} />
                      <span className="text-sm text-slate-700 truncate flex-1">
                        {p.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">No recent pages</p>
            )}

            <button
              onClick={() => {
                onPageCreate('germinating');
                setShowRecent(false);
              }}
              className="w-full mt-4 py-3 px-4 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
            >
              New Page
            </button>
          </div>
        </>
      )}
    </>
  );
}