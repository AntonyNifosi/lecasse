import { useLayoutEffect, useRef, useState } from 'react';

const PAUSE_MS = 1400;
const SCROLL_PX_PER_S = 38;
const MIN_SCROLL_MS = 600;

/** A name that fits its tag renders exactly as before — this only ever kicks in once the
 * text itself no longer does. Rather than the usual ellipsis, it holds the truncated start
 * a beat, scrolls to reveal the rest, holds that, then scrolls back and pauses again before
 * repeating — so a long pseudo is still fully readable, just not all at once.
 *
 * The Web Animations API rather than a CSS @keyframes: how far to scroll is only known once
 * the text is actually measured against its tag, and how long that takes has to scale with
 * the distance (a name overflowing by 4px and one overflowing by 40px reading at the same
 * speed) — both are runtime numbers a static keyframe can't take. */
export function MarqueeName({ text }: { text: string }) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    function measure() {
      const overflow = Math.ceil(textEl!.scrollWidth - container!.clientWidth);
      setDistance(overflow > 0 ? overflow : 0);
    }

    measure();
    // Re-measures on rotation, a table getting more/fewer seats, or any other resize that
    // changes --tsz (and so the tag's own width) without this component re-rendering.
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text]);

  useLayoutEffect(() => {
    const textEl = textRef.current;
    if (!textEl || distance === 0) return;
    const scrollMs = Math.max(MIN_SCROLL_MS, (distance / SCROLL_PX_PER_S) * 1000);
    const total = 2 * PAUSE_MS + 2 * scrollMs;
    const animation = textEl.animate(
      [
        { transform: 'translateX(0)', offset: 0 },
        { transform: 'translateX(0)', offset: PAUSE_MS / total },
        { transform: `translateX(-${distance}px)`, offset: (PAUSE_MS + scrollMs) / total },
        { transform: `translateX(-${distance}px)`, offset: (2 * PAUSE_MS + scrollMs) / total },
        { transform: 'translateX(0)', offset: 1 },
      ],
      { duration: total, iterations: Infinity, easing: 'ease-in-out' },
    );
    return () => animation.cancel();
  }, [distance]);

  return (
    <span className="marquee-name" ref={containerRef}>
      <span className="marquee-name-text" ref={textRef}>
        {text}
      </span>
    </span>
  );
}
