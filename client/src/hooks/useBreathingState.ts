import { useState, useEffect, useCallback } from 'react';

/**
 * Breathing states that mirror the substrate's cycle
 */
export type BreathingState = 
  | 'listening'    // Waiting for user input
  | 'inhaling'     // GPT establishing context (4s)
  | 'shaping'      // Delta extraction (adaptive)
  | 'casting'      // Gemini rendering artifact (adaptive)
  | 'exhaling'     // GPT reflection on lineage (4s)
  | 'resting';     // Brief pause before returning to listening

/**
 * Timing configuration for breathing cycle
 */
const BREATHING_TIMINGS = {
  inhaling: 4000,   // 4 seconds - receptive phase
  shaping: 2000,    // 2 seconds - compression phase
  casting: 8000,    // 8 seconds - manifestation phase (adaptive in practice)
  exhaling: 4000,   // 4 seconds - reflection phase
  resting: 1000,    // 1 second - integration pause
} as const;

/**
 * Hook to manage breathing state machine
 * 
 * The breathing cycle mirrors the substrate's processing:
 * listening → inhaling → shaping → casting → exhaling → resting → listening
 * 
 * Frequency: ~0.25 Hz (one complete cycle every ~20 seconds)
 */
export function useBreathingState() {
  const [state, setState] = useState<BreathingState>('listening');
  const [progress, setProgress] = useState(0); // 0-1 progress through current state
  const [cycleCount, setCycleCount] = useState(0);

  /**
   * Start a breathing cycle (triggered when user sends message)
   */
  const startBreathing = useCallback(() => {
    setState('inhaling');
    setProgress(0);
    setCycleCount(prev => prev + 1);
  }, []);

  /**
   * Manually advance to next state (for backend-driven transitions)
   */
  const advanceState = useCallback((nextState: BreathingState) => {
    setState(nextState);
    setProgress(0);
  }, []);

  /**
   * Reset to listening state
   */
  const reset = useCallback(() => {
    setState('listening');
    setProgress(0);
  }, []);

  /**
   * Auto-advance through states with timing
   */
  useEffect(() => {
    if (state === 'listening') {
      setProgress(1);
      return;
    }

    const duration = BREATHING_TIMINGS[state];
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min(elapsed / duration, 1);
      setProgress(newProgress);

      // Auto-advance to next state when complete
      if (newProgress >= 1) {
        switch (state) {
          case 'inhaling':
            setState('shaping');
            setProgress(0);
            break;
          case 'shaping':
            setState('casting');
            setProgress(0);
            break;
          case 'casting':
            setState('exhaling');
            setProgress(0);
            break;
          case 'exhaling':
            setState('resting');
            setProgress(0);
            break;
          case 'resting':
            setState('listening');
            setProgress(1);
            break;
        }
      }
    }, 50); // Update every 50ms for smooth animation

    return () => clearInterval(interval);
  }, [state]);

  /**
   * Get current phase duration
   */
  const getCurrentDuration = useCallback(() => {
    return state === 'listening' ? 0 : BREATHING_TIMINGS[state];
  }, [state]);

  /**
   * Get breathing frequency (Hz)
   */
  const getFrequency = useCallback(() => {
    const totalDuration = Object.values(BREATHING_TIMINGS).reduce((a, b) => a + b, 0);
    return 1000 / totalDuration; // Convert ms to Hz
  }, []);

  return {
    state,
    progress,
    cycleCount,
    startBreathing,
    advanceState,
    reset,
    getCurrentDuration,
    getFrequency,
    isBreathing: state !== 'listening',
  };
}
