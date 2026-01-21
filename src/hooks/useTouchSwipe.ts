import { useRef, useCallback } from "react";

export type SwipeDirection = "up" | "down" | "left" | "right";

interface UseTouchSwipeOptions {
  onSwipe: (direction: SwipeDirection) => void;
  onTap?: () => void;
  threshold?: number; // Minimum distance for a swipe
}

export const useTouchSwipe = ({ onSwipe, onTap, threshold = 30 }: UseTouchSwipeOptions) => {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchEndRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchEndRef.current = null;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current) return;

    // If no movement, treat as tap
    if (!touchEndRef.current) {
      onTap?.();
      touchStartRef.current = null;
      return;
    }

    const deltaX = touchEndRef.current.x - touchStartRef.current.x;
    const deltaY = touchEndRef.current.y - touchStartRef.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Check if swipe exceeds threshold
    if (Math.max(absX, absY) < threshold) {
      onTap?.();
      touchStartRef.current = null;
      touchEndRef.current = null;
      return;
    }

    // Determine direction
    if (absX > absY) {
      // Horizontal swipe
      onSwipe(deltaX > 0 ? "right" : "left");
    } else {
      // Vertical swipe
      onSwipe(deltaY > 0 ? "down" : "up");
    }

    touchStartRef.current = null;
    touchEndRef.current = null;
  }, [onSwipe, onTap, threshold]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
};
