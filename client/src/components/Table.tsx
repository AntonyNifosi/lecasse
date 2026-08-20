import type { ReactNode } from 'react';
import { EMOTES, type EmoteId, type PlayerPublic } from '@thegang/shared';
import { centerTop, centerWidth, seatPosition, type CenterMode } from '../tableGeometry';
import { MySeat } from './MySeat';
import { Seat } from './Seat';

/** Renders a player's latest reaction as a floating bubble, keyed by seq so a repeat of the
 * same emote still restarts the pop-in/fade-out animation (see .seat-emote). */
function emoteBubble(entry: { emoteId: EmoteId; seq: number } | undefined): ReactNode {
  if (!entry) return undefined;
  const def = EMOTES.find((e) => e.id === entry.emoteId);
  if (!def) return undefined;
  return (
    <span key={entry.seq} className="seat-emote" aria-hidden="true">
      {def.emoji}
    </span>
  );
}

interface TableProps {
  players: PlayerPublic[];
  myPlayerId: string | null;
  centerContent: ReactNode;
  /** What's in the middle of the felt — the block is sized and placed differently for a row
   * of cards than for the guess board, which needs height far more than width (see
   * tableGeometry's CENTER_W). */
  centerMode?: CenterMode;
  renderHoleCards: (player: PlayerPublic, isMe: boolean) => ReactNode;
  /** True once a player's hand is actually revealed (showdown) — switches their cards from
   * the small face-down peek tucked behind the avatar to a plain, legible row (see Seat). */
  cardsRevealed?: (player: PlayerPublic) => boolean;
  renderBadge?: (player: PlayerPublic) => ReactNode;
  renderToken?: (player: PlayerPublic) => ReactNode;
  renderSeatExtra?: (player: PlayerPublic) => ReactNode;
  hyperactivePlayerIds?: Set<string>;
  highlightPlayerId?: string | null;
  /** playerId -> seq, for the momentary "just lost a token to a steal" shake. */
  seatFlashSeq?: Record<string, number>;
  /** playerId -> their latest reaction, shown as a floating bubble above the avatar. */
  emotes?: Record<string, { emoteId: EmoteId; seq: number }>;
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
  centerMode = 'cards',
  renderHoleCards,
  cardsRevealed,
  renderBadge,
  renderToken,
  renderSeatExtra,
  hyperactivePlayerIds,
  highlightPlayerId,
  seatFlashSeq,
  emotes,
}: TableProps) {
  const me = players.find((p) => p.id === myPlayerId);
  const others = players.filter((p) => p.id !== myPlayerId);

  return (
    <div className="table-arena" data-opponents={others.length}>
      <div className="table-felt" aria-hidden="true" />
      <div className="table-felt-surface" aria-hidden="true" />
      {others.map((player, i) => (
        <Seat
          key={player.id}
          player={player}
          holeCards={renderHoleCards(player, false)}
          revealed={cardsRevealed?.(player) ?? false}
          badge={renderBadge?.(player)}
          token={renderToken?.(player)}
          extra={renderSeatExtra?.(player)}
          hyperactive={hyperactivePlayerIds?.has(player.id) ?? false}
          highlighted={player.id === highlightPlayerId}
          flashSeq={seatFlashSeq?.[player.id]}
          emote={emoteBubble(emotes?.[player.id])}
          style={seatPosition(i, others.length)}
        />
      ))}
      {/* Holds the middle of the felt down to just under the lowest seat sitting over it. A
          spacer rather than a `top` on the block itself, so the block can then be a flex
          item that simply takes what's left between here and my own seat — whatever height
          my seat happens to be. It used to reserve that with a fixed 5.5 --tsz, which was
          wrong by 26px the moment my seat wrapped onto two rows on a narrow screen. */}
      <div className="table-center-spacer" aria-hidden="true" style={{ height: centerTop(others.length, centerMode) }} />
      <div
        className="table-center"
        data-mode={centerMode}
        style={{ width: `${(centerWidth(others.length, centerMode) * 100).toFixed(1)}%` }}
      >
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
          emote={emoteBubble(emotes?.[me.id])}
        />
      )}
    </div>
  );
}
