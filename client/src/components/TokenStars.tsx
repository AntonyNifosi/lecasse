import type { CSSProperties } from 'react';

/** How many stars go on a row, by total count. Every count above one stacks into a pyramid
 * centered on the chip — 3 as a Y (two up, one down), 5 as 3 + 2 — which packs a circle far
 * better than a single line and keeps every star the same size, however many there are. */
const COLUMNS = [0, 1, 2, 2, 2, 3, 3];

/** A token's value drawn as that many little stars instead of a digit, the way the physical
 * chips are marked. One size for every chip and every count (see --star in global.css): the
 * stars are markings on the chip, so they scale with the chip and nothing else. */
export function TokenStars({ count }: { count: number }) {
  const cols = COLUMNS[count] ?? 3;
  return (
    <span className="token-stars" data-count={count} style={{ '--cols': cols } as CSSProperties} aria-label={`${count} étoiles`}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}
