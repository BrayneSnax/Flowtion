import { motion } from 'framer-motion';
import { Lightbulb, Edit2, Trash2 } from 'lucide-react';

export default function ArtifactRenderer({ artifact, onEdit, onDelete, onDragEnd, isHovered, onHover }) {
  const renderContent = () => {
    switch (artifact.type) {
      case 'lightbulb':
        return (
          <div className="flex flex-col items-center justify-center p-6">
            <Lightbulb 
              size={48} 
              className="mb-3"
              style={{ 
                color: artifact.style?.color || '#FFD700',
                filter: artifact.style?.glow ? 'drop-shadow(0 0 10px currentColor)' : 'none'
              }}
            />
            <p className="text-center text-sm font-medium" style={{ color: artifact.style?.textColor || '#333' }}>
              {artifact.content?.text || ''}
            </p>
          </div>
        );
      
      case 'text_bubble':
        const gradient = artifact.style?.gradient || 'slate-500-slate-600';
        const [from, to] = gradient.split('-');
        return (
          <div 
            className={`p-4 rounded-${artifact.style?.rounded ? '3xl' : 'xl'}`}
            style={{
              background: `linear-gradient(135deg, ${from || '#6B7280'}, ${to || '#4B5563'})`,
              color: artifact.style?.textColor || '#ffffff'
            }}
          >
            <p className="text-sm leading-relaxed">
              {artifact.content?.text || ''}
            </p>
          </div>
        );
      
      case 'diagram':
        return (
          <div className="bg-white p-4 rounded-xl border-2 border-slate-200">
            <div className="space-y-2">
              {artifact.content?.nodes?.map((node, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm text-slate-700">{node}</span>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'table':
        return (
          <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-100">
                <tr>
                  {artifact.content?.columns?.map((col, i) => (
                    <th key={i} className="px-4 py-2 text-left text-xs font-medium text-slate-700">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {artifact.content?.rows?.map((row, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    {row.map((cell, j) => (
                      <td key={j} className="px-4 py-2 text-sm text-slate-600">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      
      case 'shape':
        const shape = artifact.style?.shape || 'square';
        const size = artifact.style?.size || 100;
        return (
          <div 
            className={`flex items-center justify-center ${shape === 'circle' ? 'rounded-full' : 'rounded-lg'}`}
            style={{
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: artifact.style?.color || '#6B7280'
            }}
          >
            {artifact.content?.text && (
              <span className="text-white text-xs font-medium">{artifact.content.text}</span>
            )}
          </div>
        );
      
      case 'image':
        return (
          <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden">
            {artifact.content?.url && (
              <img 
                src={artifact.content.url} 
                alt={artifact.content?.caption || ''}
                className="w-full h-auto"
              />
            )}
            {artifact.content?.caption && (
              <div className="p-3 bg-slate-50 text-xs text-slate-600">
                {artifact.content.caption}
              </div>
            )}
          </div>
        );
      
      default:
        return (
          <div className="p-4 bg-slate-100 rounded-xl">
            <p className="text-sm text-slate-600">Unknown artifact type: {artifact.type}</p>
          </div>
        );
    }
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      onDragEnd={onDragEnd}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.03 }}
      style={{
        position: 'absolute',
        left: artifact.position.x,
        top: artifact.position.y,
        width: artifact.size?.width || 'auto',
        minWidth: artifact.size?.width || 200
      }}
      className="cursor-move group"
      onMouseEnter={() => onHover(artifact.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Action buttons */}
      <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(artifact);
          }}
          className="w-7 h-7 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-50 transition-colors"
        >
          <Edit2 size={14} className="text-blue-600" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(artifact.id);
          }}
          className="w-7 h-7 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-50 transition-colors"
        >
          <Trash2 size={14} className="text-red-600" />
        </button>
      </div>

      {/* Artifact content */}
      <div className={`shadow-xl ${isHovered ? 'shadow-2xl' : ''} transition-shadow`}>
        {renderContent()}
      </div>
    </motion.div>
  );
}
