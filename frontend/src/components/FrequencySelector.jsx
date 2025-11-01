import { useState } from "react";
import { Waves, Flame, Droplets, Sparkles } from "lucide-react";

const frequencies = [
  {
    id: 'focus',
    name: 'Focus',
    icon: Flame,
    color: 'from-orange-500 to-red-500',
    bg: 'from-orange-50 to-red-50',
    description: 'Sharp, directed energy. For execution and clarity.',
    states: ['active', 'germinating']
  },
  {
    id: 'dream',
    name: 'Dream',
    icon: Sparkles,
    color: 'from-purple-500 to-pink-500',
    bg: 'from-purple-50 to-pink-50',
    description: 'Expansive, associative. For ideation and play.',
    states: ['germinating', 'turbulent']
  },
  {
    id: 'reflect',
    name: 'Reflect',
    icon: Droplets,
    color: 'from-blue-500 to-cyan-500',
    bg: 'from-blue-50 to-cyan-50',
    description: 'Quiet, integrative. For processing and understanding.',
    states: ['cooling', 'crystallized']
  },
  {
    id: 'synthesize',
    name: 'Synthesize',
    icon: Waves,
    color: 'from-indigo-500 to-violet-500',
    bg: 'from-indigo-50 to-violet-50',
    description: 'Connecting, weaving. For finding patterns across.',
    states: ['turbulent', 'active']
  }
];

export default function FrequencySelector({ onSelect }) {
  const [hoveredId, setHoveredId] = useState(null);

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12 content-fade-in">
          <h1 className="text-4xl font-light text-white mb-4">
            What frequency are you in right now?
          </h1>
          <p className="text-slate-400 text-lg">
            Let your current state shape how the workspace breathes
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          {frequencies.map((freq) => {
            const Icon = freq.icon;
            const isHovered = hoveredId === freq.id;
            
            return (
              <button
                key={freq.id}
                onClick={() => onSelect(freq.id)}
                onMouseEnter={() => setHoveredId(freq.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`relative p-4 sm:p-8 rounded-2xl border-2 transition-all duration-500 ${
                  isHovered 
                    ? 'border-white scale-105 shadow-2xl' 
                    : 'border-slate-700 hover:border-slate-600'
                } bg-gradient-to-br ${freq.bg} backdrop-blur-sm`}
                data-testid={`frequency-${freq.id}`}
              >
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
                  <div className={`p-2 sm:p-3 rounded-xl bg-gradient-to-br ${freq.color} text-white`}>
                    <Icon size={24} className="sm:w-7 sm:h-7" />
                  </div>
                  <h2 className="text-lg sm:text-2xl font-semibold text-slate-900">
                    {freq.name}
                  </h2>
                </div>
                
                <p className="text-slate-700 text-xs sm:text-sm leading-relaxed">
                  {freq.description}
                </p>

                <div className={`mt-3 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-300 transition-opacity duration-300 ${
                  isHovered ? 'opacity-100' : 'opacity-0'
                }`}>
                  <p className="text-xs text-slate-600">
                    {freq.states.join(', ')}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-center mt-8 text-slate-500 text-sm">
          <p>You can change this anytime with <kbd className="px-2 py-1 bg-slate-700 text-slate-300 rounded">Shift+F</kbd></p>
        </div>
      </div>
    </div>
  );
}