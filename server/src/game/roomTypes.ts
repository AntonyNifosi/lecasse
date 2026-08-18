import type { ActiveCardState, Card, GameState, RoomSettings, RoomStatus } from '@thegang/shared';

export interface InternalPlayer {
  id: string;
  name: string;
  colorTag: string;
  secretToken: string;
  socketId: string | null;
  connected: boolean;
  isHost: boolean;
  disconnectedAt: number | null;
  holeCards: Card[];
  lastEmoteAt: number | null;
}

export interface InternalGameState extends GameState {
  deck: Card[];
}

export interface RoomInternal {
  code: string;
  status: RoomStatus;
  settings: RoomSettings;
  players: InternalPlayer[]; // join order == seating order, used for neighbor effects
  game: InternalGameState | null;
  finalResult: 'win' | 'lose' | null;
  cardPools: { malusQueue: string[]; bonusQueue: string[] };
  proPermanentCard: ActiveCardState | null; // Pro mode: drawn once at game start, active every heist
  gangsterSlots: string[]; // Gangster mode: up to 2 malus card ids, oldest first
  createdAt: number;
  lastActivityAt: number;
}

export type SideEffect =
  | { type: 'privatePeek'; toPlayerId: string; aboutPlayerId: string; card: Card }
  | { type: 'privateInfo'; toPlayerId: string; message: string; card?: Card };
