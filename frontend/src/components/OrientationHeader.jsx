export default function OrientationHeader({ breadcrumb, intent, options }) {
  return (
    <section 
      role="region" 
      aria-label="Orientation" 
      className="sticky top-0 z-30 border-b bg-white/70 backdrop-blur-sm px-4 sm:px-8 py-2 flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm"
    >
      <nav className="text-slate-600 flex items-center gap-1">
        {breadcrumb.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-400">/</span>}
            <span>{crumb}</span>
          </span>
        ))}
      </nav>
      
      <span className="hidden sm:inline text-slate-500">•</span>
      
      <span className="text-slate-700">
        Purpose: <strong className="font-medium text-slate-900">{intent}</strong>
      </span>
      
      {options && options.length > 0 && (
        <>
          <span className="hidden sm:inline text-slate-500 ml-auto">Next:</span>
          <div className="flex gap-2 ml-auto">
            {options.map((option, i) => (
              <button
                key={i}
                onClick={option.onClick}
                className="px-2 py-1 rounded-md border border-slate-300 hover:bg-slate-50 transition-colors text-xs font-medium text-slate-700"
                data-testid={`orientation-option-${i}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}