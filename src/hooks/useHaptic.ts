/**
 * Haptic feedback utility for mobile immersion
 * Uses the Vibration API when available
 * Debounced to prevent lag from rapid triggers
 */

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'water' | 'chop';

const patterns: Record<HapticPattern, number | number[]> = {
  light: 5,
  medium: 12,
  heavy: 25,
  success: [8, 40, 15],
  error: [25, 80, 25, 80, 25],
  water: [6, 25, 4],
  chop: [15, 10, 8], // Quick impact pattern for wood chopping
};

let lastTrigger = 0;
const MIN_INTERVAL = 50; // Minimum ms between haptic triggers

export const triggerHaptic = (pattern: HapticPattern = 'light') => {
  const now = Date.now();
  if (now - lastTrigger < MIN_INTERVAL) return; // Debounce
  lastTrigger = now;
  
  if ('vibrate' in navigator) {
    navigator.vibrate(patterns[pattern]);
  }
};

export const useHaptic = () => {
  return {
    light: () => triggerHaptic('light'),
    medium: () => triggerHaptic('medium'),
    heavy: () => triggerHaptic('heavy'),
    success: () => triggerHaptic('success'),
    error: () => triggerHaptic('error'),
    water: () => triggerHaptic('water'),
    chop: () => triggerHaptic('chop'),
    trigger: triggerHaptic,
  };
};
