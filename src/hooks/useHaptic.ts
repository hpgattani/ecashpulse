/**
 * Haptic feedback utility for mobile immersion
 * Uses the Vibration API when available
 */

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'water';

const patterns: Record<HapticPattern, number | number[]> = {
  light: 5,
  medium: 15,
  heavy: 30,
  success: [10, 50, 20],
  error: [30, 100, 30, 100, 30],
  water: [8, 30, 5], // Mimics water ripple/droplet
};

export const triggerHaptic = (pattern: HapticPattern = 'light') => {
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
    trigger: triggerHaptic,
  };
};
