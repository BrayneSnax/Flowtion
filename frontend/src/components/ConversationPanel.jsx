import { X, Sparkles, Link2, Archive, Brain, Plus, RefreshCw, MessageCircle } from 'lucide-react';

export default function ConversationPanel({ messages, onClose, isVisible }) {
  if (!isVisible) return null;

  const getActionIcon = (action) => {
    switch (action) {
      case 'create': return <Plus size={14} className="text-blue-500" />;
      case 'link': return <Link2 size={14} className="text-purple-500" />;
      case 'recall': return <Brain size={14} className="text-amber-500" />;
      case 'archive': return <Archive size={14} className="text-slate-500" />;
      case 'modify': return <RefreshCw size={14} className="text-green-500" />;
      default: return <Sparkles size={14} className="text-indigo-500" />;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'create': return 'from-blue-50 to-cyan-50 border-blue-200';
      case 'link': return 'from-purple-50 to-pink-50 border-purple-200';
      case 'recall': return 'from-amber-50 to-orange-50 border-amber-200';
      case 'archive': return 'from-slate-50 to-gray-50 border-slate-200';
      case 'modify': return 'from-green-50 to-emerald-50 border-green-200';
      default: return 'from-indigo-50 to-blue-50 border-indigo-200';
    }
  };

  const getActionLabel = (action) => {
    switch (action) {
      case 'create': return 'Creating';
      case 'link': return 'Connecting';
      case 'recall': return 'Reflecting';
      case 'archive': return 'Pausing';
      case 'modify': return 'Evolving';
      default: return 'Building';
    }
  };

  return (
    <div className="fixed left-4 top-20 bottom-32 w-80 bg-white/90 backdrop-blur-lg rounded-2xl shadow-2xl z-30 flex flex-col border border-slate-200/50">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-200/50">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-500" />
          <h2 className="text-sm font-medium text-slate-900">Flow</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
          title="Hide dialogue"
        >
          <X size={16} className="text-slate-400" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
        {messages.length === 0 ? (
          <div className="text-center text-slate-400 mt-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
              <Sparkles size={20} className="text-indigo-400" />
            </div>
            <p className="text-xs font-medium">Dialogue flows here</p>
            <p className="text-[10px] mt-1 text-slate-400">
              Alongside the canvas
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="space-y-2">
              {msg.role === 'user' ? (
                // User message - clean and simple
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-xl px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md">
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                </div>
              ) : (
                // AI response - rich and collaborative
                <div className="space-y-1.5">
                  {/* Action indicator */}
                  {msg.action && (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 ml-1">
                      {getActionIcon(msg.action)}
                      <span className="font-medium">{getActionLabel(msg.action)}</span>
                    </div>
                  )}
                  
                  {/* AI message */}
                  <div className={`rounded-xl p-3 border bg-gradient-to-br ${getActionColor(msg.action || 'default')} shadow-sm`}>
                    <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
                      {msg.content}
                    </p>
                    
                    {/* Nodes created */}
                    {msg.nodes && msg.nodes.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200/70 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600">
                          <Plus size={10} />
                          <span>On canvas</span>
                        </div>
                        <div className="space-y-1">
                          {msg.nodes.map((node, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-[10px] bg-white/80 rounded-lg px-2 py-1.5 border border-slate-200"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                              <span className="font-medium text-slate-700 truncate">{node.title}</span>
                              {node.type && (
                                <span className="ml-auto text-slate-500 text-[9px] uppercase tracking-wide flex-shrink-0">
                                  {node.type}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Links created */}
                    {msg.links && msg.links.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200/70 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600">
                          <Link2 size={10} />
                          <span>Woven</span>
                        </div>
                        <div className="space-y-1">
                          {msg.links.map((link, idx) => (
                            <div
                              key={idx}
                              className="text-[10px] bg-white/80 rounded-lg px-2 py-1.5 border border-slate-200"
                            >
                              <span className="text-slate-700">{link.from_title}</span>
                              <span className="text-slate-400 mx-1">→</span>
                              <span className="text-slate-700">{link.to_title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-slate-200/50">
        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-400 to-indigo-400" />
            <span>You</span>
          </div>
          <span>×</span>
          <div className="flex items-center gap-1">
            <Sparkles size={10} className="text-indigo-400" />
            <span>AI</span>
          </div>
        </div>
      </div>
    </div>
  );
}
