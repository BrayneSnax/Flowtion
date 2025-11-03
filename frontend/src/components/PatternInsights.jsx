export default function PatternInsights({ insights, onClose }) {
  if (!insights || insights.length === 0) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/20 z-30"
        onClick={onClose}
      />
      <div className="fixed right-4 top-20 bottom-32 w-80 bg-white/90 backdrop-blur-lg rounded-2xl shadow-2xl z-30 p-4 overflow-y-auto border border-amber-200/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Your rhythm</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          {insights.map((insight, i) => (
            <div
              key={i}
              className="p-3 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200"
            >
              <p className="text-xs text-slate-700 leading-relaxed">
                {insight}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200 text-[10px] text-slate-500">
          Patterns from recent sessions
        </div>
      </div>
    </>
  );
}