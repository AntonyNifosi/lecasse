import { useEffect, useRef, useState } from 'react';
import type { RoundColor, RoundTokens } from '@thegang/shared';

export interface TokenEvent {
  star: number;
  kind: 'claim' | 'steal' | 'release';
  fromPlayerId: string | null;
  toPlayerId: string | null;
  seq: number;
}

interface Snapshot {
  color: RoundColor;
  holderByStars: Record<number, string | null>;
}

/** Diffs holderByStars before/after each render to classify what just happened to each
 * star this round — sufficient to distinguish claim/steal/release without needing to
 * pattern-match the history log. Scoped to the round's own life span: a color change
 * (new round) just re-baselines with zero spurious events, same as the very first render. */
export function useTokenEvents(rs: RoundTokens | undefined): TokenEvent[] {
  const prevRef = useRef<Snapshot | null>(null);
  const seqRef = useRef(0);
  const [events, setEvents] = useState<TokenEvent[]>([]);

  useEffect(() => {
    if (!rs) return;
    const prev = prevRef.current;
    if (prev && prev.color === rs.color) {
      const next: TokenEvent[] = [];
      for (const star of rs.starsAvailable) {
        const before = prev.holderByStars[star] ?? null;
        const after = rs.holderByStars[star] ?? null;
        if (before === after) continue;
        seqRef.current += 1;
        const kind: TokenEvent['kind'] = before === null ? 'claim' : after === null ? 'release' : 'steal';
        next.push({ star, kind, fromPlayerId: before, toPlayerId: after, seq: seqRef.current });
      }
      if (next.length > 0) setEvents(next);
    }
    prevRef.current = { color: rs.color, holderByStars: { ...rs.holderByStars } };
  }, [rs]);

  return events;
}
