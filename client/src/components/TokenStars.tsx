import type { CSSProperties } from 'react';

/** How many stars fit on one row, by total count — 5 reads much better as 3 + 2 than as a
 * single cramped line. The wrapper wraps at exactly this many per row (each star is given
 * 1/cols of the width) and centers whatever is left over on the last row. */
const COLUMNS = [0, 1, 2, 3, 2, 3, 3];

/** A token's value drawn as that many little stars instead of a digit, the way the physical
 * chips are marked. Sized off --tsz like everything else on the table, and tightened up as
 * the count grows so six stars still fit inside the same chip as one. */
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
