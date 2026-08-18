import type { CSSProperties, ReactNode } from 'react';
import type { PlayerPublic } from '@thegang/shared';
import { MySeat } from './MySeat';
import { Seat } from './Seat';

/** How far around the oval the opponents fan out, indexed by how many there are: one sits
 * dead center at the top, more spread toward the sides. Deliberately capped well short of
 * the bottom arc (which belongs to my own seat) and short of straight-out left/right, so a
 * seat's full width always stays inside the arena instead of hanging off its edge. */
const SPREAD_DEG = [0, 0, 55, 70, 80, 88];

/** Where opponent `index` of `total` sits. Angles run from the top of the oval (0°) outward
 * to either side, then get mapped onto the arena *inset by half a seat* — so a seat's own
 * box is always fully inside the arena, however short or narrow the viewport makes it. A
 * raw percentage would let the topmost seat hang off the top edge as soon as the oval got
 * squashed, which is exactly how the old layout broke on a real phone. */
function seatPosition(index: number, total: number): CSSProperties {
  const { fx, fy } = seatFraction(index, total);
  return {
    left: `calc(var(--seat-inset-x) + (100% - 2 * var(--seat-inset-x)) * ${fx.toFixed(4)})`,
    top: `calc(var(--seat-inset-y) + (100% - 2 * var(--seat-inset-y)) * ${fy.toFixed(4)})`,
  };
}

function seatFraction(index: number, total: number): { fx: number; fy: number } {
  const spread = SPREAD_DEG[Math.min(total, SPREAD_DEG.length - 1)];
  const deg = total <= 1 ? 0 : -spread + (index * 2 * spread) / (total - 1);
  const rad = (deg * Math.PI) / 180;
  return { fx: (50 + 38 * Math.sin(rad)) / 100, fy: (50 - 44 * Math.cos(rad)) / 100 };
}

/** Top edge of the band the community cards and pot live in: just under the lowest seat on
 * the rim. The oval is narrow enough on a phone that a seat and the card row can't clear
 * each other sideways, so they're kept apart vertically instead — which means this has to
 * follow wherever the rim seats actually end up, rather than sitting at a fixed 50%. */
function centerTop(total: number): string {
  const lowest = Math.max(...Array.from({ length: Math.max(total, 1) }, (_, i) => seatFraction(i, total).fy));
  return `calc(2 * var(--seat-inset-y) + (100% - 2 * var(--seat-inset-y)) * ${lowest.toFixed(4)})`;
}

interface TableProps {
  players: PlayerPublic[];
  myPlayerId: string | null;
  centerContent: ReactNode;
  renderHoleCards: (player: PlayerPublic, isMe: boolean) => ReactNode;
  renderBadge?: (player: PlayerPublic) => ReactNode;
  renderToken?: (player: PlayerPublic) => ReactNode;
  renderSeatExtra?: (player: PlayerPublic) => ReactNode;
  hyperactivePlayerIds?: Set<string>;
  highlightPlayerId?: string | null;
  /** playerId -> seq, for the momentary "just lost a token to a steal" shake. */
  seatFlashSeq?: Record<string, number>;
}

/** An oval felt table: everyone else sits around its rim, the community cards and token pot
 * sit in the middle, and my own seat sits on the bottom of the felt — bigger than the rest,
 * since it's the one hand I actually hold.
 *
 * The felt, the opponents and the center are all absolutely positioned, which leaves my own
 * seat as the arena's only in-flow child (pushed to the bottom by justify-content). That's
 * on purpose: it's the one element that must never end up clipped or overlapped, and being
 * in flow guarantees it its own space however little room the viewport leaves. */
export function Table({
  players,
  myPlayerId,
  centerContent,
  renderHoleCards,
  renderBadge,
  renderToken,
  renderSeatExtra,
  hyperactivePlayerIds,
  highlightPlayerId,
  seatFlashSeq,
}: TableProps) {
  const me = players.find((p) => p.id === myPlayerId);
  const others = players.filter((p) => p.id !== myPlayerId);

  return (
    <div className="table-arena" data-opponents={others.length}>
      <div className="table-felt" aria-hidden="true" />
      {others.map((player, i) => (
        <Seat
          key={player.id}
          player={player}
          holeCards={renderHoleCards(player, false)}
          badge={renderBadge?.(player)}
          token={renderToken?.(player)}
          extra={renderSeatExtra?.(player)}
          hyperactive={hyperactivePlayerIds?.has(player.id) ?? false}
          highlighted={player.id === highlightPlayerId}
          flashSeq={seatFlashSeq?.[player.id]}
          style={seatPosition(i, others.length)}
        />
      ))}
      <div className="table-center" style={{ top: centerTop(others.length) }}>
        {centerContent}
      </div>
      {me && (
        <MySeat
          player={me}
          holeCards={renderHoleCards(me, true)}
          badge={renderBadge?.(me)}
          token={renderToken?.(me)}
          extra={renderSeatExtra?.(me)}
          hyperactive={hyperactivePlayerIds?.has(me.id) ?? false}
          highlighted={me.id === highlightPlayerId}
          flashSeq={seatFlashSeq?.[me.id]}
        />
      )}
    </div>
  );
}
