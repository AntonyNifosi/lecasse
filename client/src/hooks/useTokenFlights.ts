import { useEffect, useRef, useState } from 'react';
import type { PlayerPublic } from '@thegang/shared';
import type { TokenEvent } from './useTokenEvents';

export interface TokenFlight {
  id: string;
  left: number;
  top: number;
  dx: number;
  dy: number;
  color: string;
  ringColor: string;
  label: string;
}

const FLIGHT_MS = 450;
export const GHOST_SIZE_PX = 30; // kept in sync with .token-flight's width/height in global.css

function seatEl(playerId: string): Element | null {
  return document.querySelector(`[data-seat-player="${playerId}"]`);
}

function starEl(star: number): Element | null {
  return document.querySelector(`[data-star="${star}"]`);
}

function center(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Spawns a short-lived flying "ghost" token for each claim/steal/release, from wherever
 * it came from (the center pot slot, or a player's seat) to wherever it's going — purely
 * decorative, the real interactive token never moves. Positions are measured fresh off the
 * DOM (data-star / data-seat-player) each time `events` gets a new batch, so this stays
 * correct regardless of table size, seating order, or player count. */
export function useTokenFlights(events: TokenEvent[], players: PlayerPublic[], tokenColor: string): TokenFlight[] {
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
      const ringPlayerId = e.toPlayerId ?? e.fromPlayerId;
      const ringColor = players.find((p) => p.id === ringPlayerId)?.colorTag ?? 'transparent';
      additions.push({
        id: `flight-${e.seq}`,
        left: from.x - GHOST_SIZE_PX / 2,
        top: from.y - GHOST_SIZE_PX / 2,
        dx: to.x - from.x,
        dy: to.y - from.y,
        color: tokenColor,
        ringColor,
        label: String(e.star),
      });
    }
    if (additions.length === 0) return;
    setFlights((prev) => [...prev, ...additions]);
    for (const f of additions) {
      setTimeout(() => setFlights((prev) => prev.filter((x) => x.id !== f.id)), FLIGHT_MS + 50);
    }
  }, [events]);

  return flights;
}
