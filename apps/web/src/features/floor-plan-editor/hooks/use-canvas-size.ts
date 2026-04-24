'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * Tracks the size of a container element via ResizeObserver.
 * Konva's <Stage /> needs explicit pixel dimensions — bindding them to
 * the parent's size makes the canvas flex-friendly without manual
 * window-resize wiring.
 */
export function useCanvasSize(
  ref: RefObject<HTMLElement | null>,
): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Initial measurement for the first paint.
    const rect = el.getBoundingClientRect();
    setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}
