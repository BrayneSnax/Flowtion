export default function PatternInsights({ insights, onClose }) {
  if (!insights || insights.length === 0) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />
      <div className="fixed right-4 top-20 bottom-20 w-80 bg-white rounded-2xl shadow-2xl z-50 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Your rhythm</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {insights.map((insight, i) => (
            <div
              key={i}
              className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-200"
            >
              <p className="text-sm text-slate-700 leading-relaxed">
                {insight}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200 text-xs text-slate-500">
          These patterns emerge from your recent sessions
        </div>
      </div>
    </>
  );
}