import { useLayoutEffect, useRef, type ReactNode } from 'react';
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

  // Taking a token shifts this whole seat sideways (see .my-seat.has-token), instantly and
  // deliberately so: that shift is a transform on an *ancestor* of the token, and animating
  // it is what used to make useTokenFlights — which reads the token's real position with
  // getBoundingClientRect() the instant it appears, before a transition has run even one
  // frame — measure a position the token wasn't at yet, flying it in wide and snapping it
  // over next frame.
  //
  // So the seat still jumps instantly, and the *cards* are what slide: they start out
  // countering that jump exactly (rendering where they were a moment ago) and animate back
  // to zero, which reads as them gliding aside to make room. The wrapper they're in is a
  // sibling of the token, never an ancestor, so none of this can put the token's measured
  // position back in question.
  //
  // Driven imperatively rather than by re-keying this wrapper to restart a CSS animation:
  // re-keying remounts the cards themselves, and .playing-card has its own cardReveal
  // entrance animation (opacity 0, scaled, rotated) that restarts with them — which is why
  // that read as the cards blinking out and back rather than sliding. Animating the wrapper
  // in place never touches them.
  const hasToken = Boolean(token);
  // Seeded from this render's own value, not a hardcoded false: otherwise mounting already
  // holding a token (a page reload mid-round) reads as a claim happening right then too.
  const hadTokenRef = useRef(hasToken);
  const seatRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLSpanElement>(null);
  // The shift is only readable off the seat while it's actually applied, so it's captured on
  // the way in and reused to play the same slide in reverse on the way back out.
  const shiftPxRef = useRef(0);

  useLayoutEffect(() => {
    if (hasToken === hadTokenRef.current) return;
    hadTokenRef.current = hasToken;
    const seat = seatRef.current;
    const cards = cardsRef.current;
    if (!seat || !cards) return;

    if (hasToken) {
      // Whatever --tsz currently resolves to, rather than re-deriving the multiplier here:
      // the seat has already been shifted by the time this runs, so its own matrix is the
      // one number guaranteed to match what the cards have to counter.
      const matrix = new DOMMatrixReadOnly(getComputedStyle(seat).transform);
      shiftPxRef.current = Math.abs(matrix.m41);
    }
    const from = hasToken ? shiftPxRef.current : -shiftPxRef.current;
    if (from === 0) return;
    cards.animate([{ transform: `translateX(${from}px)` }, { transform: 'translateX(0)' }], {
      duration: 260,
      easing: 'ease-out',
    });
  }, [hasToken]);

  return (
    <div className={classes} data-seat-player={player.id} ref={seatRef}>
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
        <span className="my-seat-hole-cards" ref={cardsRef}>
          {holeCards}
        </span>
        {token}
      </div>
    </div>
  );
}
