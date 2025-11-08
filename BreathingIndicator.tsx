import { useBreathingState, type BreathingState } from '@/hooks/useBreathingState';

/**
 * Visual indicator that pulses with the breathing rhythm
 * 
 * Design principles:
 * - Opacity and scale oscillate with breathing state
 * - Motion curves use ease-in-out for organic feel
 * - Progress is shown through subtle animation, not explicit percentage
 */

interface BreathingIndicatorProps {
  state: BreathingState;
  progress: number;
}

/**
 * Get state display text
 */
function getStateText(state: BreathingState): string {
  switch (state) {
    case 'listening':
      return 'listening';
    case 'inhaling':
      return 'weaving context...';
    case 'shaping':
      return 'shaping intent...';
    case 'casting':
      return 'casting form...';
    case 'exhaling':
      return 'reflecting...';
    case 'resting':
      return 'integrating...';
  }
}

/**
 * Calculate pulse scale based on state and progress
 * Inhale: expand (1.0 → 1.1)
 * Exhale: contract (1.1 → 1.0)
 * Others: gentle pulse
 */
function getPulseScale(state: BreathingState, progress: number): number {
  const easeInOut = (t: number) => t < 0.5 
    ? 2 * t * t 
    : -1 + (4 - 2 * t) * t;
  
  const easedProgress = easeInOut(progress);
  
  switch (state) {
    case 'inhaling':
      return 1.0 + (easedProgress * 0.1); // Expand
    case 'exhaling':
      return 1.1 - (easedProgress * 0.1); // Contract
    case 'shaping':
    case 'casting':
      // Gentle heartbeat pulse
      return 1.05 + (Math.sin(easedProgress * Math.PI * 4) * 0.02);
    default:
      return 1.0;
  }
}

/**
 * Calculate opacity based on state and progress
 */
function getPulseOpacity(state: BreathingState, progress: number): number {
  const easeInOut = (t: number) => t < 0.5 
    ? 2 * t * t 
    : -1 + (4 - 2 * t) * t;
  
  const easedProgress = easeInOut(progress);
  
  switch (state) {
    case 'listening':
      return 0.4;
    case 'inhaling':
      return 0.4 + (easedProgress * 0.4); // Brighten
    case 'exhaling':
      return 0.8 - (easedProgress * 0.4); // Dim
    case 'shaping':
    case 'casting':
      return 0.7 + (Math.sin(easedProgress * Math.PI * 4) * 0.1);
    default:
      return 0.6;
  }
}

export function BreathingIndicator({ state, progress }: BreathingIndicatorProps) {
  if (state === 'listening') {
    return (
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        <div className="w-2 h-2 rounded-full bg-neutral-300" />
        <span>{getStateText(state)}</span>
      </div>
    );
  }

  const scale = getPulseScale(state, progress);
  const opacity = getPulseOpacity(state, progress);

  return (
    <div className="flex items-center gap-2 text-xs">
      <div 
        className="w-2 h-2 rounded-full bg-blue-500 transition-all duration-100"
        style={{
          transform: `scale(${scale})`,
          opacity: opacity,
        }}
      />
      <span 
        className="text-neutral-600 transition-opacity duration-100"
        style={{ opacity: opacity }}
      >
        {getStateText(state)}
      </span>
    </div>
  );
}

/**
 * Progress bar that pulses with breathing rhythm
 */
interface BreathingProgressProps {
  state: BreathingState;
  progress: number;
}

export function BreathingProgress({ state, progress }: BreathingProgressProps) {
  if (state === 'listening') {
    return null;
  }

  const opacity = getPulseOpacity(state, progress);

  return (
    <div className="w-full h-1 bg-neutral-100 rounded-full overflow-hidden">
      <div 
        className="h-full bg-blue-400 transition-all duration-100 ease-out"
        style={{
          width: `${progress * 100}%`,
          opacity: opacity,
        }}
      />
    </div>
  );
}
