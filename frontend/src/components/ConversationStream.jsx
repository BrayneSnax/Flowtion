import { useState } from 'react';
import { MessageCircle, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ConversationStream({ messages, isVisible, onToggle }) {
  if (!isVisible && messages.length === 0) return null;

  // Minimized floating button
  if (!isVisible) {
    return (
      <motion.button
        onClick={onToggle}
        className="fixed left-6 bottom-32 w-14 h-14 bg-white/95 backdrop-blur-lg rounded-full shadow-xl border border-indigo-200 flex items-center justify-center z-30 hover:scale-110 transition-transform"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        title="Show conversation"
      >
        <MessageCircle size={24} className="text-indigo-600" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-indigo-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {messages.length}
          </span>
        )}
      </motion.button>
    );
  }

  // Expanded conversation panel
  return (
    <motion.div
      initial={{ x: -400 }}
      animate={{ x: 0 }}
      exit={{ x: -400 }}
      className="fixed left-6 bottom-32 top-24 w-96 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-30"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-blue-50">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-indigo-600" />
          <h3 className="font-semibold text-slate-900">Dialogue</h3>
          <span className="text-xs text-slate-500">({messages.length})</span>
        </div>
        <button
          onClick={onToggle}
          className="p-2 hover:bg-white/60 rounded-full transition-colors"
        >
          <X size={18} className="text-slate-600" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-slate-400 mt-8">
            <Sparkles size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Conversation will flow here</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              {msg.role === 'user' ? (
                // User message
                <div className="flex justify-end">
                  <div className="max-w-[85%] px-4 py-2 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm shadow-md">
                    {msg.content}
                  </div>
                </div>
              ) : (
                // AI message
                <div className="space-y-2">
                  {/* Model indicator */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 ml-2">
                    <Sparkles size={12} />
                    <span className="font-medium">{msg.model === 'hermes' ? 'Hermes' : 'GPT'}</span>
                  </div>
                  
                  {/* Message bubble */}
                  <div className="max-w-[90%] px-4 py-3 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 shadow-sm">
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                    
                    {/* Nodes created indicator */}
                    {msg.nodeCount > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        <p className="text-xs text-slate-600">
                          ✨ {msg.nodeCount} node{msg.nodeCount > 1 ? 's' : ''} manifested
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="p-3 border-t border-slate-200 text-center">
        <p className="text-xs text-slate-500">
          Dialogue persists • Nodes appear on canvas
        </p>
      </div>
    </motion.div>
  );
}
