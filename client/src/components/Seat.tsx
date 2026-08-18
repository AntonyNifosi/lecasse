import type { CSSProperties, ReactNode } from 'react';
import type { PlayerPublic } from '@thegang/shared';
import { Avatar } from './Avatar';

interface SeatProps {
  player: PlayerPublic;
  holeCards: ReactNode;
  badge?: ReactNode;
  /** The live, clickable current-round token this player holds, if any — pinned as a chip
   * on the corner of their avatar. */
  token?: ReactNode;
  extra?: ReactNode;
  hyperactive?: boolean;
  highlighted?: boolean;
  /** Changes whenever this player just lost a token to a steal — re-keying the wrapper
   * below restarts the "seat-pip-flash-lost" shake even if the class name is unchanged. */
  flashSeq?: number;
  /** Where on the oval's rim this seat sits (left/top percentages) — see Table. */
  style?: CSSProperties;
}

/** One other player, seated on the oval's rim. Deliberately compact — avatar, a name plate,
 * their two cards tucked behind it and their token pinned to its corner — so that a seat
 * never reaches far enough inward to crowd the community cards in the middle, however many
 * players are around the table. */
export function Seat({ player, holeCards, badge, token, extra, hyperactive, highlighted, flashSeq, style }: SeatProps) {
  const classes = [
    'table-seat',
    hyperactive && 'hyperactive',
    highlighted && 'highlighted',
    !player.connected && 'disconnected',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} data-seat-player={player.id} style={style}>
      <div className="table-seat-figure">
        <div className="table-seat-cards">{holeCards}</div>
        <span
          key={`avatar-${flashSeq ?? 'idle'}`}
          className={flashSeq !== undefined ? 'seat-pip-flash-lost' : undefined}
        >
          <Avatar name={player.name} color={player.colorTag} />
        </span>
        {token}
      </div>
      <span className="table-seat-name">
        {player.name}
        {player.isHost && <span className="table-seat-host">★</span>}
      </span>
      {badge}
      {extra}
    </div>
  );
}
