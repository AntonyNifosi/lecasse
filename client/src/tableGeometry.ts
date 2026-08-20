import type { CSSProperties } from 'react';

/** Where everyone sits around the oval, how wide the block in its middle may be, and where
 * that block starts.
 *
 * Its own module rather than living inside Table: these numbers decide the whole vertical
 * budget of the felt, and having them importable means a harness can measure the *real*
 * layout instead of an approximation of it. */

/** How far around the oval the opponents fan out, indexed by how many there are: one sits
 * dead center at the top, more spread toward the sides as there are more of them — past 90°
 * at 4-5, swinging the outermost seats below the horizontal midline, which is what it takes
 * to give revealed showdown cards (taller than a face-down peek) enough room between
 * neighbors without colliding (see Seat's .table-seat-cards.revealed). */
export const SPREAD_DEG = [0, 0, 55, 70, 95, 108];

/** Radii of the ring the seats sit on, as percentages of the arena. Much wider than it is
 * tall, so the seats ride out over the rail instead of floating on the green — which is also
 * what frees the middle of the felt sideways, so the block in the center can sit level with
 * the low side seats rather than being pushed under them (see centerTop). */
const RING_X = 47;
const RING_Y = 44;

/** The widest a seat's box may get relative to the arena — enforced in CSS as a hard cap on
 * --seat-w, so the clearance test below is a guarantee rather than an estimate. Seat widths
 * are otherwise in --tsz (they hold text, which doesn't scale with the table), which drifts
 * against the arena's own width as the viewport changes shape. */
export const SEAT_W_MAX_FRACTION = 0.2;

/** How wide the center block may be, as a fraction of the arena, per opponent count — and
 * per what's in it. Both rows are capped so the block clears the seats out on the rail
 * sideways; that clearance is exactly what lets centerTop ignore those seats.
 *
 * `guess` is the narrower of the two on purpose: the guess board needs height far more than
 * width (ten options to lay out in a grid), so it trades width for a clearance that lifts it
 * above the low side seats entirely. */
const CENTER_W = {
  cards: [0.66, 0.66, 0.66, 0.58, 0.54, 0.5],
  guess: [0.62, 0.62, 0.62, 0.5, 0.54, 0.5],
};

export type CenterMode = keyof typeof CENTER_W;

export function centerWidth(total: number, mode: CenterMode): number {
  const row = CENTER_W[mode];
  return row[Math.min(total, row.length - 1)];
}

/** Where opponent `index` of `total` sits. Angles run from the top of the oval (0°) outward
 * to either side, then get mapped onto the arena *inset by half a seat* — so a seat's own
 * box is always fully inside the arena, however short or narrow the viewport makes it. A
 * raw percentage would let the topmost seat hang off the top edge as soon as the oval got
 * squashed, which is exactly how the old layout broke on a real phone. */
export function seatPosition(index: number, total: number): CSSProperties {
  const { fx, fy } = seatFraction(index, total);
  return {
    left: `calc(var(--seat-inset-x) + (100% - 2 * var(--seat-inset-x)) * ${fx.toFixed(4)})`,
    top: `calc(var(--seat-inset-y) + (100% - 2 * var(--seat-inset-y)) * ${fy.toFixed(4)})`,
  };
}

export function seatFraction(index: number, total: number): { fx: number; fy: number } {
  const spread = SPREAD_DEG[Math.min(total, SPREAD_DEG.length - 1)];
  const deg = total <= 1 ? 0 : -spread + (index * 2 * spread) / (total - 1);
  const rad = (deg * Math.PI) / 180;
  return { fx: (50 + RING_X * Math.sin(rad)) / 100, fy: (50 - RING_Y * Math.cos(rad)) / 100 };
}

/** How close a seat's inner edge gets to the middle of the arena, as a fraction of its
 * width. seatPosition places a seat's *center* on the arena inset by half a seat, so its box
 * spans (1 - w) * fx .. + w. */
function seatReach(fx: number): number {
  const w = SEAT_W_MAX_FRACTION;
  return Math.abs((1 - w) * fx + w / 2 - 0.5) - w / 2;
}

/** Top edge of the band the center block lives in: just under the lowest seat that actually
 * sits *over* it. The oval is narrow enough on a phone that a seat and the block can't clear
 * each other sideways when both are near the middle — but the seats out on the rail do clear
 * it, and those don't push it down. That's the whole point of the wide ring above: with the
 * old, rounder one nothing ever cleared, so this had to follow the single lowest seat
 * wherever it went, and at six players that left the middle of the felt 19px tall. */
export function centerTop(total: number, mode: CenterMode): string {
  const half = centerWidth(total, mode) / 2;
  const overhead = Array.from({ length: Math.max(total, 1) }, (_, i) => seatFraction(i, total)).filter(
    ({ fx }) => seatReach(fx) < half,
  );
  const lowest = overhead.length > 0 ? Math.max(...overhead.map((s) => s.fy)) : 0;
  return `calc(2 * var(--seat-inset-y) + (100% - 2 * var(--seat-inset-y)) * ${lowest.toFixed(4)})`;
}
