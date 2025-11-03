import { X } from 'lucide-react';

export default function ConversationPanel({ messages, onClose, isVisible }) {
  if (!isVisible) return null;

  return (
    <div className="fixed left-4 top-20 bottom-32 w-96 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl z-40 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <h2 className="text-lg font-medium text-slate-900">Conversation</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors"
          title="Close conversation"
        >
          <X size={18} className="text-slate-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-slate-400 mt-8">
            <p className="text-sm">Your dialogue will appear here</p>
            <p className="text-xs mt-2">Speak and watch thoughts take form</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </p>
                {msg.nodes && msg.nodes.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/20">
                    <p className="text-xs opacity-75">
                      Created {msg.nodes.length} node{msg.nodes.length > 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-slate-200 text-xs text-slate-500 text-center">
        Messages flow here - structure emerges on canvas
      </div>
    </div>
  );
}
