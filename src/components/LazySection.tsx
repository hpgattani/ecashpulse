import { useEffect, useRef, useState, ReactNode } from 'react';

interface LazySectionProps {
  children: ReactNode;
  /** Extra pixels below viewport to start loading early */
  rootMargin?: string;
}

/**
 * Defers rendering of children until the section scrolls near the viewport.
 * This prevents below-fold components from firing network requests on page load.
 */
const LazySection = ({ children, rootMargin = '200px' }: LazySectionProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return <div ref={ref}>{visible ? children : null}</div>;
};

export default LazySection;
