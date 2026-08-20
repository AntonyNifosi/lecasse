import type { ReactNode } from 'react';
import type { PlayerPublic } from '@thegang/shared';
import { Avatar } from './Avatar';

interface MySeatProps {
  player: PlayerPublic;
  holeCards: ReactNode;
  badge?: ReactNode;
  token?: ReactNode;
  extra?: ReactNode;
  hyperactive?: boolean;
  highlighted?: boolean;
  /** Changes whenever I just lost a token to a steal — re-keying the wrapper below
   * restarts the "seat-pip-flash-lost" shake even if the class name is unchanged. */
  flashSeq?: number;
  /** A reaction bubble floating above my avatar, if I have one active — see Table. */
  emote?: ReactNode;
}

/** My own seat — the bottom edge of the table, in Table's normal flex flow (never a
 * percentage-based placement, so it can't overlap or get clipped), but sized and
 * highlighted to stand out: bigger avatar, bigger cards, permanent gold ring. */
export function MySeat({ player, holeCards, badge, token, extra, hyperactive, highlighted, flashSeq, emote }: MySeatProps) {
  const classes = ['my-seat', hyperactive && 'hyperactive', highlighted && 'highlighted'].filter(Boolean).join(' ');

  return (
    <div className={classes} data-seat-player={player.id}>
      {/* Only the avatar is re-keyed, not the wrapper — see the same note in Seat. */}
      <span className="avatar-wrap">
        <span
          key={`avatar-${flashSeq ?? 'idle'}`}
          className={`avatar-shake${flashSeq !== undefined ? ' seat-pip-flash-lost' : ''}`}
        >
          <Avatar name={player.name} color={player.colorTag} />
        </span>
        {emote}
        {/* Pinned on the avatar's corner exactly like everyone else's (see .my-seat .token),
         * rather than sitting in the seat's own flex row: out here it wrapped onto a line of
         * its own on a narrow screen, which added a whole chip's height to the tallest thing
         * on the table — and .table-center's bottom edge has to clear my seat, so that came
         * straight off the middle of the felt. */}
        {token}
      </span>
      <div className="my-seat-info">
        <span className="my-seat-name">
          {player.name}
          {player.isHost && <span className="table-seat-host">★</span>}
        </span>
        {badge}
        {extra}
      </div>
      <div className="my-seat-cards">{holeCards}</div>
    </div>
  );
}
