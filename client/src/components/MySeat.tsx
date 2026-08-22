import { useRef, useState, type ReactNode } from 'react';
import type { PlayerPublic } from '@thegang/shared';
import { Avatar } from './Avatar';
import { MarqueeName } from './MarqueeName';

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
  const classes = ['my-seat', hyperactive && 'hyperactive', highlighted && 'highlighted', token && 'has-token']
    .filter(Boolean)
    .join(' ');

  // The little "cards shift into place" flourish from taking a token, without the seat-wide
  // slide it used to be: that one moved everything, cards included, by animating .my-seat's
  // own transform — which is exactly the transform useTokenFlights reads via
  // getBoundingClientRect() the instant the token appears, before any transition has had a
  // chance to run even one frame (see .my-seat.has-token's comment in global.css). Reading
  // mid-transition landed the flight, and the token's own first paint, short of the shift by
  // however much the animation hadn't caught up yet — the token flying in noticeably right
  // of my cards, snapping over once CSS caught up next frame. Restricting the animation to
  // just the two hole cards (a sibling of the token, never an ancestor of it) still reads as
  // "the cards shift," and getBoundingClientRect() on the token never has anything to lie
  // about — its own position is set once, instantly, never mid-flight.
  // Set during render, not an effect: an effect fires after the first paint, so the cards
  // would show one real frame in their final position before the animation's start keyframe
  // cut them back to it — a jump, then the slide it was supposed to replace. Adjusting state
  // from a ref comparison mid-render is React's own sanctioned way to have the very first
  // commit already reflect it.
  const [justClaimedSeq, setJustClaimedSeq] = useState(0);
  const hasToken = Boolean(token);
  // Seeded from this render's own value, not a hardcoded false: otherwise mounting already
  // holding a token (a page reload mid-round) reads as a claim happening right then too.
  const hadTokenRef = useRef(hasToken);
  if (hasToken !== hadTokenRef.current) {
    hadTokenRef.current = hasToken;
    if (hasToken) setJustClaimedSeq((s) => s + 1);
  }

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
      </span>
      <div className="my-seat-info">
        <span className="my-seat-name">
          <MarqueeName text={player.name} />
          {player.isHost && <span className="table-seat-host">★</span>}
        </span>
        {badge}
        {extra}
      </div>
      {/* Pinned to my own cards rather than sitting in the seat's flex row (that wrapped
       * onto a line of its own on a narrow screen, which cost .table-center — its bottom
       * edge has to clear my seat — a whole chip's height off the middle of the felt) or on
       * the avatar (technically as compact, but read less clearly as "my token" than
       * sitting with the hand it belongs to). */}
      <div className="my-seat-cards">
        <span key={justClaimedSeq} className="my-seat-hole-cards">
          {holeCards}
        </span>
        {token}
      </div>
    </div>
  );
}
