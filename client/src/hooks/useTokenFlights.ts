import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PlayerPublic } from '@thegang/shared';
import type { TokenEvent } from './useTokenEvents';

export interface TokenFlight {
  id: string;
  star: number;
  left: number;
  top: number;
  dx: number;
  dy: number;
  arc: number;
  spin: number;
  durationMs: number;
  /** Measured off the chip it left, so the ghost starts out the same size as the real thing
   * whatever --tsz currently is. */
  size: number;
  /** What to scale to on arrival, so it also ends the same size as the chip it lands on. */
  landScale: number;
  color: string;
  ringColor: string;
}

const BASE_FLIGHT_MS = 380;
const MAX_FLIGHT_MS = 650;

/** Where a chip sits and how big it is. */
interface Anchor {
  x: number;
  y: number;
  size: number;
}

function anchorOf(chip: Element | null): Anchor | null {
  // offsetWidth rather than the rect's width, which counts transforms: a chip is often a
  // frame into its "just claimed" flash, and those keyframes open at scale(0.6). The centre
  // is safe to read off the rect — that scale is centred, so it doesn't move it.
  if (!(chip instanceof HTMLElement) || chip.offsetWidth === 0) return null;
  const r = chip.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, size: chip.offsetWidth };
}

/** Spawns a flying "ghost" token for each claim/steal/release, from wherever it came from
 * (the center pot slot, or a player's seat) to wherever it's going — purely decorative, the
 * real interactive token never moves. It stays fully visible (opaque, no mid-flight fade)
 * for its whole trip: the board hides the "landed" token at its destination for exactly as
 * long as the ghost is in the air (see inFlightStars below), so there's never a moment where
 * the real one has already popped in while the ghost is still travelling toward it — instead
 * the ghost itself visibly carries the token the entire way, and the real one takes over the
 * instant it lands. A short arc, a slight scale-up mid-flight and a small directional tilt
 * (both derived from the trip's own distance/direction) sell it as a token actually being
 * tossed across the table rather than a dot sliding in a straight line.
 *
 * Everything here runs in layout effects, before the browser paints: the state this reacts to
 * has already removed the token from where it was and put it where it now belongs, so an
 * ordinary effect would let that new arrangement show for a frame or two — the ghost's whole
 * trip spoiled by its destination appearing up front. */
export function useTokenFlights(
  events: TokenEvent[],
  players: PlayerPublic[],
  tokenColor: string,
): { flights: TokenFlight[]; inFlightStars: Set<number> } {
  const [flights, setFlights] = useState<TokenFlight[]>([]);
  const ctxRef = useRef({ players, tokenColor });
  ctxRef.current = { players, tokenColor };
  const anchorsRef = useRef(new Map<string, Anchor>());

  // Re-read after every commit, and deliberately never forget: by the time a move is known,
  // the chip it moved has already left where it was, so "where it was" only exists in what
  // was recorded on the way past. Without this the ghost had nothing to start from but the
  // whole seat, and left from its middle — between the name plate and the cards — instead of
  // from the chip's own corner.
  useLayoutEffect(() => {
    const anchors = anchorsRef.current;
    for (const chip of document.querySelectorAll<HTMLElement>('[data-token-slot]')) {
      const anchor = anchorOf(chip);
      if (anchor) anchors.set(`seat:${chip.dataset.tokenSlot}`, anchor);
    }
    for (const slot of document.querySelectorAll<HTMLElement>('[data-star]')) {
      const anchor = anchorOf(slot.querySelector('.token'));
      if (anchor) anchors.set(`pool:${slot.dataset.star}`, anchor);
    }
  });

  useLayoutEffect(() => {
    if (events.length === 0) return;
    const { players, tokenColor } = ctxRef.current;
    const anchors = anchorsRef.current;
    const additions: TokenFlight[] = [];
    for (const e of events) {
      const from = anchors.get(e.fromPlayerId ? `seat:${e.fromPlayerId}` : `pool:${e.star}`);
      const to = anchors.get(e.toPlayerId ? `seat:${e.toPlayerId}` : `pool:${e.star}`);
      if (!from || !to) continue;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.hypot(dx, dy);
      const ringPlayerId = e.toPlayerId ?? e.fromPlayerId;
      const ringColor = players.find((p) => p.id === ringPlayerId)?.colorTag ?? 'transparent';
      additions.push({
        id: `flight-${e.seq}`,
        star: e.star,
        left: from.x - from.size / 2,
        top: from.y - from.size / 2,
        dx,
        dy,
        arc: Math.min(30, Math.max(10, distance * 0.22)),
        spin: dx >= 0 ? 8 : -8,
        durationMs: Math.min(MAX_FLIGHT_MS, BASE_FLIGHT_MS + distance * 0.35),
        // A chip in the pot and a chip on a seat aren't the same size, so the ghost leaves at
        // the size of the one it left and grows or shrinks into the one it lands on.
        size: from.size,
        landScale: to.size / from.size,
        color: tokenColor,
        ringColor,
      });
    }
    if (additions.length === 0) return;
    setFlights((prev) => [...prev, ...additions]);
    for (const f of additions) {
      setTimeout(() => setFlights((prev) => prev.filter((x) => x.id !== f.id)), f.durationMs + 50);
    }
  }, [events]);

  // Which stars currently have a ghost airborne — the board masks the real token at both
  // ends of that trip while its star is in this set (see GameBoardScreen).
  const inFlightStars = useMemo(() => new Set(flights.map((f) => f.star)), [flights]);

  return { flights, inFlightStars };
}
