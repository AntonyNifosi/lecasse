import type { ReactNode } from 'react';

/** How many stars go on a row, by total count. Every count above one stacks into a pyramid
 * centered on the chip — 3 as a Y (two up, one down), 5 as 3 + 2 — which packs a circle far
 * better than a single line and keeps every star the same size, however many there are. */
const COLUMNS = [0, 1, 2, 2, 2, 3, 3];

/** A token's value drawn as that many little stars instead of a digit, the way the physical
 * chips are marked. One size for every chip and every count (see --star in global.css): the
 * stars are markings on the chip, so they scale with the chip and nothing else.
 *
 * Rows are chunked here in JS rather than left for CSS to wrap on its own: a row sized off
 * an assumed pixel width (a border could out-eat it) or off the container's own percentage
 * (which stretches stars apart to fill it instead of packing them) both amount to guessing
 * how much room a row needs. Building the rows outright needs no guess — each is exactly as
 * wide as its own stars, and centering it is just flexbox, same as a single row would be. */
export function TokenStars({ count }: { count: number }) {
  const cols = COLUMNS[count] ?? 3;
  const rows: ReactNode[][] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    (rows[row] ??= []).push(
      <span key={i} aria-hidden="true">
        ★
      </span>,
    );
  }
  return (
    <span className="token-stars" data-count={count} aria-label={`${count} étoiles`}>
      {rows.map((row, r) => (
        <span className="token-stars-row" key={r}>
          {row}
        </span>
      ))}
    </span>
  );
}
