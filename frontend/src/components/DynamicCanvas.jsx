import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit2, Trash2 } from 'lucide-react';

// Simple node style - AI decides meaning through context, not preset types
const getNodeStyle = (node) => {
  // Default gentle style
  return {
    shape: 'rounded-2xl',
    bg: 'bg-gradient-to-br from-slate-500 to-slate-600',
    border: 'border-slate-700',
    size: 'min-w-[200px]',
    behavior: 'float'
  };
};

const frequencyStyles = {
  focus: {
    bg: 'from-slate-50 to-slate-100',
    node: 'bg-slate-800 border-slate-900',
    text: 'text-slate-100',
    line: 'stroke-slate-400',
    grid: true,
    motion: 'minimal'
  },
  dream: {
    bg: 'from-purple-50 via-pink-50 to-blue-50',
    node: 'bg-gradient-to-br from-purple-500 to-pink-500 border-purple-600',
    text: 'text-white',
    line: 'stroke-purple-300',
    grid: false,
    motion: 'fluid'
  },
  reflect: {
    bg: 'from-blue-50 to-cyan-50',
    node: 'bg-blue-500 border-blue-600',
    text: 'text-white',
    line: 'stroke-blue-300',
    grid: false,
    motion: 'gentle'
  },
  synthesize: {
    bg: 'from-indigo-50 via-violet-50 to-purple-50',
    node: 'bg-gradient-to-br from-indigo-600 to-violet-600 border-indigo-700',
    text: 'text-white',
    line: 'stroke-indigo-400',
    grid: false,
    motion: 'connecting'
  }
};

export default function DynamicCanvas({ frequency, nodes, onNodeClick }) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [isBreathing, setIsBreathing] = useState(false);
  const [idleTime, setIdleTime] = useState(0);
  const [editingNode, setEditingNode] = useState(null);
  const [localNodes, setLocalNodes] = useState(nodes);
  const style = frequencyStyles[frequency] || frequencyStyles.reflect;

  const handleDragEnd = async (nodeId, event, info) => {
    const node = localNodes.find(n => n.id === nodeId);
    if (!node) return;

    const newX = node.position.x + info.offset.x;
    const newY = node.position.y + info.offset.y;

    // Update local state immediately
    setLocalNodes(localNodes.map(n => 
      n.id === nodeId 
        ? { ...n, position: { x: newX, y: newY } }
        : n
    ));

    // Persist to backend
    try {
      const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('token');
      await fetch(`${BACKEND_URL}/api/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          position: { x: newX, y: newY }
        })
      });
    } catch (error) {
      console.error('Failed to save position:', error);
    }
  };

  const handleDelete = async (nodeId) => {
    if (!window.confirm('Delete this node?')) return;

    try {
      const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('token');
      await fetch(`${BACKEND_URL}/api/nodes/${nodeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setLocalNodes(localNodes.filter(n => n.id !== nodeId));
    } catch (error) {
      console.error('Failed to delete node:', error);
    }
  };

  const handleSaveEdit = async (nodeId, updates) => {
    try {
      const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      
      const updated = await response.json();
      setLocalNodes(localNodes.map(n => n.id === nodeId ? updated : n));
      setEditingNode(null);
    } catch (error) {
      console.error('Failed to save edit:', error);
    }
  };

  // Breathing detection
  useEffect(() => {
    let counter = 0;
    let timer;

    const resetIdle = () => {
      counter = 0;
      setIdleTime(0);
      setIsBreathing(false);
    };

    const incrementIdle = () => {
      counter += 1;
      setIdleTime(counter);
      
      // After 15 seconds, start breathing
      if (counter >= 15) {
        setIsBreathing(true);
      }
    };

    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    timer = setInterval(incrementIdle, 1000);

    return () => {
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      clearInterval(timer);
    };
  }, []);

  if (!nodes || nodes.length === 0) {
    return (
      <div className={`h-full flex items-center justify-center bg-gradient-to-br ${style.bg} transition-all duration-1000`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center space-y-4"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="text-6xl opacity-40"
          >
            ✨
          </motion.div>
          <div className="text-2xl font-light text-slate-600">Empty field</div>
          <div className="text-sm text-slate-500">Speak to create structure</div>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      className={`relative h-full bg-gradient-to-br ${style.bg} overflow-hidden`}
      animate={{
        opacity: isBreathing ? 0.7 : 1,
        scale: isBreathing ? 0.98 : 1
      }}
      transition={{ duration: 2, ease: "easeInOut" }}
    >
      {/* Grid overlay for focus mode */}
      {style.grid && (
        <div className="absolute inset-0 opacity-20">
          <div className="h-full w-full" style={{
            backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />
        </div>
      )}

      {/* Breathing overlay */}
      <AnimatePresence>
        {isBreathing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white backdrop-blur-sm pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* SVG for connections */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {nodes.map((node, i) => {
          if (i === nodes.length - 1) return null;
          const nextNode = nodes[i + 1];
          return (
            <motion.line
              key={`${node.id}-${nextNode.id}`}
              x1={node.position.x + 100}
              y1={node.position.y + 50}
              x2={nextNode.position.x + 100}
              y2={nextNode.position.y + 50}
              className={`${style.line} opacity-30`}
              strokeWidth="2"
              strokeDasharray={style.motion === 'fluid' ? '5,5' : '0'}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />
          );
        })}
      </svg>

      {/* Nodes */}
      <div className="relative h-full p-8">
        {localNodes.map((node, index) => {
          const nodeStyle = getNodeStyle(node);

          return (
            <motion.div
              key={node.id}
              drag
              dragMomentum={false}
              dragElastic={0}
              onDragEnd={(event, info) => handleDragEnd(node.id, event, info)}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: isBreathing ? [0, -3, 0] : 0,
                transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" }
              }}
              whileHover={{ scale: 1.05 }}
              style={{
                position: 'absolute',
                left: node.position.x,
                top: node.position.y,
              }}
              className="cursor-move group"
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              data-testid={`node-${node.id}`}
            >
              <div className={`${nodeStyle.bg} ${nodeStyle.shape} ${nodeStyle.size} px-6 py-4 shadow-xl border-2 ${nodeStyle.border} transition-all ${
                hoveredNode === node.id ? 'shadow-2xl scale-105' : ''
              }`}>
                {/* Action buttons - appear on hover */}
                <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingNode(node);
                    }}
                    className="w-7 h-7 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-50 transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={14} className="text-blue-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(node.id);
                    }}
                    className="w-7 h-7 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} className="text-red-600" />
                  </button>
                </div>

                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="text-white font-medium mb-1">
                      {node.title}
                    </div>
                    {node.content && node.content !== node.title && (
                      <div className="text-xs text-white/70 mt-1">
                        {node.content.slice(0, 80)}
                        {node.content.length > 80 ? '...' : ''}
                      </div>
                    )}
                    {node.tags && node.tags.length > 0 && (
                      <div className="flex gap-2 flex-wrap mt-2">
                        {node.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-white"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      {/* Edit Modal */}
      <AnimatePresence>
        {editingNode && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setEditingNode(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl"
            >
              <div className="bg-white rounded-2xl shadow-2xl p-6 mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Edit Node</h3>
                  <button
                    onClick={() => setEditingNode(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X size={20} className="text-slate-600" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      defaultValue={editingNode.title}
                      onChange={(e) => setEditingNode({ ...editingNode, title: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Node title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Content
                    </label>
                    <textarea
                      defaultValue={editingNode.content}
                      onChange={(e) => setEditingNode({ ...editingNode, content: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                      placeholder="Develop your idea here..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Type
                    </label>
                    <select
                      value={editingNode.type}
                      onChange={(e) => setEditingNode({ ...editingNode, type: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="thought">💭 Thought</option>
                      <option value="pattern">🔄 Pattern</option>
                      <option value="ritual">🕯️ Ritual</option>
                      <option value="project">🎯 Project</option>
                      <option value="question">❓ Question</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      defaultValue={editingNode.tags?.join(', ') || ''}
                      onChange={(e) => setEditingNode({ 
                        ...editingNode, 
                        tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                      })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="morning, focus, creative"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => handleSaveEdit(editingNode.id, {
                        title: editingNode.title,
                        content: editingNode.content,
                        type: editingNode.type,
                        tags: editingNode.tags
                      })}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => setEditingNode(null)}
                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}