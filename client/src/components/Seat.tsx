import type { CSSProperties, ReactNode } from 'react';
import type { PlayerPublic } from '@thegang/shared';
import { Avatar } from './Avatar';

interface SeatProps {
  player: PlayerPublic;
  holeCards: ReactNode;
  /** True once this hand is actually revealed (showdown) — see the .table-seat-cards note
   * on Table/global.css for why that changes how the cards are laid out. */
  revealed?: boolean;
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
export function Seat({ player, holeCards, revealed, badge, token, extra, hyperactive, highlighted, flashSeq, style }: SeatProps) {
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
        {/* Face-down: a small peek tucked behind the avatar — fine since there's nothing to
         * read yet. Once revealed, that same treatment (tiny, rotated, behind the avatar and
         * name plate) would make the actual cards unreadable, so they move below instead. */}
        {!revealed && <div className="table-seat-cards">{holeCards}</div>}
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
      {revealed && <div className="table-seat-cards revealed">{holeCards}</div>}
      {extra}
    </div>
  );
}
