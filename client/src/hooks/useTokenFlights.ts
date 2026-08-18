import { useEffect, useMemo, useRef, useState } from 'react';
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
  color: string;
  ringColor: string;
  label: string;
}

const BASE_FLIGHT_MS = 380;
const MAX_FLIGHT_MS = 650;
export const GHOST_SIZE_PX = 30; // kept in sync with .token-flight's width/height in global.css

/** Where a player's token actually renders once it's landed — the real element, kept in the
 * DOM (just invisible) while a flight is inbound to it, so this always resolves to the
 * precise spot the ghost needs to land on. Falls back to the whole seat only for the rare
 * case a player holds no token at all right now (nothing more specific to aim for). */
function seatEl(playerId: string): Element | null {
  return document.querySelector(`[data-token-slot="${playerId}"]`) ?? document.querySelector(`[data-seat-player="${playerId}"]`);
}

function starEl(star: number): Element | null {
  return document.querySelector(`[data-star="${star}"]`);
}

function center(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
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
 * tossed across the table rather than a dot sliding in a straight line. Positions are
 * measured fresh off the DOM each time `events` gets a new batch, so this stays correct
 * regardless of table size, seating order, or player count. */
export function useTokenFlights(
  events: TokenEvent[],
  players: PlayerPublic[],
  tokenColor: string,
): { flights: TokenFlight[]; inFlightStars: Set<number> } {
  const [flights, setFlights] = useState<TokenFlight[]>([]);
  const ctxRef = useRef({ players, tokenColor });
  ctxRef.current = { players, tokenColor };

  useEffect(() => {
    if (events.length === 0) return;
    const { players, tokenColor } = ctxRef.current;
    const additions: TokenFlight[] = [];
    for (const e of events) {
      const fromNode = e.fromPlayerId ? seatEl(e.fromPlayerId) : starEl(e.star);
      const toNode = e.toPlayerId ? seatEl(e.toPlayerId) : starEl(e.star);
      if (!fromNode || !toNode) continue;
      const from = center(fromNode);
      const to = center(toNode);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.hypot(dx, dy);
      const ringPlayerId = e.toPlayerId ?? e.fromPlayerId;
      const ringColor = players.find((p) => p.id === ringPlayerId)?.colorTag ?? 'transparent';
      additions.push({
        id: `flight-${e.seq}`,
        star: e.star,
        left: from.x - GHOST_SIZE_PX / 2,
        top: from.y - GHOST_SIZE_PX / 2,
        dx,
        dy,
        arc: Math.min(30, Math.max(10, distance * 0.22)),
        spin: dx >= 0 ? 8 : -8,
        durationMs: Math.min(MAX_FLIGHT_MS, BASE_FLIGHT_MS + distance * 0.35),
        color: tokenColor,
        ringColor,
        label: String(e.star),
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
