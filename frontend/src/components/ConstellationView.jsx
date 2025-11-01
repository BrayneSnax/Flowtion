import { useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut } from "lucide-react";

const stateColors = {
  germinating: '#10b981',
  active: '#f97316',
  cooling: '#3b82f6',
  crystallized: '#64748b',
  turbulent: '#a855f7'
};

export default function ConstellationView({ pages, currentPageId, onPageSelect, onClose, frequency }) {
  const canvasRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width;
    canvas.height = height;

    // Calculate node intensity (recency + state)
    const now = Date.now();
    const nodesWithIntensity = pages.map((page) => {
      const lastViewed = new Date(page.last_viewed_at || page.updated_at).getTime();
      const hoursSinceView = (now - lastViewed) / (1000 * 60 * 60);
      
      // Intensity based on recency (fades over 7 days)
      let intensity = Math.max(0, 1 - (hoursSinceView / (24 * 7)));
      
      // Boost active states
      if (page.state === 'active') intensity = Math.min(1, intensity * 1.5);
      if (page.state === 'germinating') intensity = Math.min(1, intensity * 1.3);
      
      return {
        ...page,
        intensity,
        x: Math.random() * width * 0.8 + width * 0.1,
        y: Math.random() * height * 0.8 + height * 0.1,
        radius: 8 + intensity * 12
      };
    });

    setNodes(nodesWithIntensity);

    // Draw constellation
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-width / 2, -height / 2);

      // Draw connections (weak ties)
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.1)';
      ctx.lineWidth = 1;
      nodesWithIntensity.forEach((node, i) => {
        nodesWithIntensity.slice(i + 1).forEach((otherNode) => {
          const distance = Math.sqrt(
            Math.pow(node.x - otherNode.x, 2) + Math.pow(node.y - otherNode.y, 2)
          );
          
          // Draw connection if nodes are close
          if (distance < 200) {
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(otherNode.x, otherNode.y);
            ctx.stroke();
          }
        });
      });

      // Draw nodes
      nodesWithIntensity.forEach((node) => {
        const isSelected = node.id === selectedNode?.id;
        const isCurrent = node.id === currentPageId;
        
        // Glow for active nodes
        if (node.intensity > 0.5) {
          const gradient = ctx.createRadialGradient(
            node.x, node.y, 0,
            node.x, node.y, node.radius * 2
          );
          gradient.addColorStop(0, `${stateColors[node.state]}40`);
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.fillRect(
            node.x - node.radius * 2,
            node.y - node.radius * 2,
            node.radius * 4,
            node.radius * 4
          );
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = stateColors[node.state] || stateColors.germinating;
        ctx.globalAlpha = 0.3 + node.intensity * 0.7;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Border for current/selected
        if (isCurrent || isSelected) {
          ctx.strokeStyle = isSelected ? '#fff' : '#000';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Title on hover
        if (isSelected) {
          ctx.fillStyle = '#1e293b';
          ctx.font = '14px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(node.title, node.x, node.y - node.radius - 10);
        }
      });

      ctx.restore();
    };

    draw();

    // Handle click
    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - width / 2) / zoom + width / 2;
      const y = (e.clientY - rect.top - height / 2) / zoom + height / 2;

      const clickedNode = nodesWithIntensity.find((node) => {
        const distance = Math.sqrt(
          Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2)
        );
        return distance < node.radius;
      });

      if (clickedNode) {
        onPageSelect(clickedNode.id);
      }
    };

    const handleMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - width / 2) / zoom + width / 2;
      const y = (e.clientY - rect.top - height / 2) / zoom + height / 2;

      const hoveredNode = nodesWithIntensity.find((node) => {
        const distance = Math.sqrt(
          Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2)
        );
        return distance < node.radius;
      });

      setSelectedNode(hoveredNode || null);
      draw();
    };

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handleMove);

    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mousemove', handleMove);
    };
  }, [pages, currentPageId, zoom, selectedNode]);

  return (
    <div className="fixed inset-0 bg-slate-900 z-50">
      {/* Canvas */}
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Controls */}
      <div className="fixed top-4 right-4 flex items-center gap-2">
        <button
          onClick={() => setZoom(Math.min(2, zoom + 0.2))}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-lg backdrop-blur-sm transition-colors"
        >
          <ZoomIn size={20} className="text-white" />
        </button>
        <button
          onClick={() => setZoom(Math.max(0.5, zoom - 0.2))}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-lg backdrop-blur-sm transition-colors"
        >
          <ZoomOut size={20} className="text-white" />
        </button>
        <button
          onClick={onClose}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-lg backdrop-blur-sm transition-colors"
        >
          <X size={20} className="text-white" />
        </button>
      </div>

      {/* Legend */}
      <div className="fixed bottom-4 left-4 bg-white/10 backdrop-blur-sm rounded-lg p-4 text-white text-sm">
        <div className="font-medium mb-2">Constellation</div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Germinating</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span>Active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Cooling</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-500" />
            <span>Crystallized</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span>Turbulent</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-white/20 text-xs opacity-75">
          Brightness = Recent activity<br />
          Size = Intensity
        </div>
      </div>
    </div>
  );
}