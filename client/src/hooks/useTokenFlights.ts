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
const FALLBACK_GHOST_SIZE_PX = 30; // only if the source node somehow measures zero

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

/** offsetWidth, not the bounding rect, which counts transforms: the chip at the far end of a
 * trip is usually a frame into its "just claimed" flash, and those keyframes open at
 * scale(0.6) — enough to hand back a chip 40% smaller than the one it actually is. */
function chipWidth(chip: Element | null): number | null {
  return chip instanceof HTMLElement && chip.offsetWidth > 0 ? chip.offsetWidth : null;
}

/** The last chip size seen on each kind of seat. My own seat only ever holds one chip, so on
 * the trip that takes it away there is nothing of its kind left on screen to measure — and
 * that trip is precisely the one that needs the answer. Refreshed on every batch, so it
 * follows --tsz across a resize within a move or two. */
const rememberedChipSize = { mine: 0, opponent: 0 };

function rememberChipSizes(): void {
  rememberedChipSize.mine = chipWidth(document.querySelector('.my-seat .token')) ?? rememberedChipSize.mine;
  rememberedChipSize.opponent = chipWidth(document.querySelector('.table-seat .token')) ?? rememberedChipSize.opponent;
}

/** How big a chip on this player's seat is, for the one case chipIn can't answer: the seat a
 * token was just taken from has no chip left to measure. Any other seat of the same kind will
 * do — my own seat renders its chip larger than the others, so the two aren't interchangeable. */
function seatChipSize(playerId: string): number | null {
  const seat = document.querySelector(`[data-seat-player="${playerId}"]`);
  if (!seat) return null;
  const mine = seat.classList.contains('my-seat');
  return chipWidth(document.querySelector(mine ? '.my-seat .token' : '.table-seat .token')) ?? (rememberedChipSize[mine ? 'mine' : 'opponent'] || null);
}

/** The chip at one end of a trip, as opposed to whatever is holding it.
 *
 * The two functions above answer "where", and either can legitimately return something that
 * is not itself a chip: a pot slot, or — for the player a token was just taken from — their
 * whole seat, since they no longer have a chip in the DOM to point at. Measuring the ghost
 * against that is how a stolen token ended up flying across the table at the size of a seat. */
function chipIn(node: Element | null): Element | null {
  if (!node) return null;
  return node.classList.contains('token') ? node : node.querySelector('.token');
}

function center(r: DOMRect): { x: number; y: number } {
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
    rememberChipSizes();
    const additions: TokenFlight[] = [];
    for (const e of events) {
      const fromNode = e.fromPlayerId ? seatEl(e.fromPlayerId) : starEl(e.star);
      const toNode = e.toPlayerId ? seatEl(e.toPlayerId) : starEl(e.star);
      if (!fromNode || !toNode) continue;
      const from = center(fromNode.getBoundingClientRect());
      const to = center(toNode.getBoundingClientRect());
      // A chip in the pot and a chip on a seat aren't the same size, so the ghost leaves at
      // the size of the one it left and grows or shrinks into the one it lands on. Either end
      // can be unmeasurable — the chip a token was just taken from is already out of the DOM —
      // in which case both ends fall back to whatever the other one measured, and the trip
      // simply keeps one size throughout.
      const fromSize = chipWidth(chipIn(fromNode)) ?? (e.fromPlayerId ? seatChipSize(e.fromPlayerId) : null);
      const toSize = chipWidth(chipIn(toNode)) ?? (e.toPlayerId ? seatChipSize(e.toPlayerId) : null);
      const size = fromSize ?? toSize ?? chipWidth(document.querySelector('.token')) ?? FALLBACK_GHOST_SIZE_PX;
      const landScale = (toSize ?? size) / size;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.hypot(dx, dy);
      const ringPlayerId = e.toPlayerId ?? e.fromPlayerId;
      const ringColor = players.find((p) => p.id === ringPlayerId)?.colorTag ?? 'transparent';
      additions.push({
        id: `flight-${e.seq}`,
        star: e.star,
        left: from.x - size / 2,
        top: from.y - size / 2,
        dx,
        dy,
        arc: Math.min(30, Math.max(10, distance * 0.22)),
        spin: dx >= 0 ? 8 : -8,
        durationMs: Math.min(MAX_FLIGHT_MS, BASE_FLIGHT_MS + distance * 0.35),
        size,
        landScale,
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
