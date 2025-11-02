import { useState, useEffect } from 'react';

// PDA hook: Invitation → Mirror → Pause → Option
export function usePDA() {
  const [stage, setStage] = useState('invite');
  const [visible, setVisible] = useState(false);

  const next = () => {
    setStage(s => 
      s === 'invite' ? 'mirror' : 
      s === 'mirror' ? 'pause' : 
      'options'
    );
  };

  const reset = () => {
    setStage('invite');
    setVisible(false);
  };

  const show = () => setVisible(true);

  return { stage, next, reset, show, visible, setVisible };
}

// Friction detection
export function useFrictionDetection(onFriction) {
  const [frictionEvents, setFrictionEvents] = useState([]);

  const recordFriction = () => {
    const now = Date.now();
    const recent = frictionEvents.filter(t => now - t < 60000); // Last 60s
    const updated = [...recent, now];
    
    setFrictionEvents(updated);
    
    if (updated.length >= 2) {
      onFriction?.();
      setFrictionEvents([]);
    }
  };

  return { recordFriction };
}

// Metaphor mode
export function useMetaphorMode() {
  const [enabled, setEnabled] = useState(() => {
    const stored = localStorage.getItem('metaphorMode');
    return stored ? JSON.parse(stored) : false;
  });

  const toggle = () => {
    const newValue = !enabled;
    setEnabled(newValue);
    localStorage.setItem('metaphorMode', JSON.stringify(newValue));
  };

  return { enabled, toggle };
}

// Labels that feel
export const metaphorLabels = {
  pages: { technical: 'Pages', metaphor: 'Heartbeat' },
  recent: { technical: 'Recent', metaphor: 'Pulse' },
  search: { technical: 'Search', metaphor: 'Tuning Fork' },
  state: { technical: 'State', metaphor: 'Frequency' },
  constellation: { technical: 'Constellation', metaphor: 'Field' },
  blocks: { technical: 'Blocks', metaphor: 'Breath' },
  links: { technical: 'Links', metaphor: 'Threads' },
  backlinks: { technical: 'Backlinks', metaphor: 'Echoes' },
};

export function getLabel(key, useMetaphor) {
  const labels = metaphorLabels[key];
  if (!labels) return key;
  return useMetaphor ? labels.metaphor : labels.technical;
}