export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const HAND_CATEGORIES = [
  'highCard',
  'pair',
  'twoPair',
  'trips',
  'straight',
  'flush',
  'fullHouse',
  'quads',
  'straightFlush',
  'royalFlush',
] as const;
export type HandCategory = (typeof HAND_CATEGORIES)[number];

export interface HandEvaluation {
  category: HandCategory;
  categoryRank: number; // index into HAND_CATEGORIES, 0-9
  tiebreakers: Rank[]; // ranks in comparison order, fully encodes the hand's value
  bestFive: Card[];
}

export const ROUND_ORDER = ['white', 'yellow', 'orange', 'red'] as const;
export type RoundColor = (typeof ROUND_ORDER)[number];

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;
export const VAULTS_TO_WIN = 3;
export const ALARMS_TO_LOSE = 3;
export const BASE_HOLE_CARDS = 2;

export interface TokenHistoryEntry {
  stars: number;
  playerId: string;
  action: 'take' | 'release';
}

export interface RoundTokens {
  color: RoundColor;
  active: boolean; // false if this round's token step was skipped by a malus card
  starsAvailable: number[]; // e.g. [1,2,3,4] for a 4-player room
  holderByStars: Record<number, string | null>; // stars -> playerId | null
  lockedStars: number[]; // stars that can no longer change owner this round
  history: TokenHistoryEntry[]; // chronological take/release log for this round only
}

export interface ShowdownEntry {
  playerId: string;
  stars: number;
  holeCards: Card[];
  hand: HandEvaluation;
  orderOk: boolean;
}

export interface ShowdownState {
  order: string[]; // playerIds, weakest red token to strongest
  revealed: ShowdownEntry[];
  failed: boolean;
  guessGate: null | {
    guessType: 'category' | 'rank';
    targetPlayerId: string;
    resolved: boolean;
    correct: boolean | null;
  };
}

export interface ActiveCardState {
  cardId: string;
  kind: 'bonus' | 'malus';
}

export interface HeistRecord {
  heistNumber: number;
  outcome: 'success' | 'fail';
  activeCardId: string | null;
}

export interface GameState {
  heistNumber: number;
  currentRound: RoundColor | 'showdown' | 'result';
  communityCards: Card[];
  tokensByRound: Record<RoundColor, RoundTokens>;
  vaults: number;
  alarms: number;
  history: HeistRecord[];
  activeCard: ActiveCardState | null;
  holeCardsPerPlayer: number; // 2 normally, 3 with the "Renfort" bonus card
  wildAdvantagePlayerId: string | null;
  publicInfoReveal: Record<string, string> | null; // playerId -> short display value
  showdown: ShowdownState | null;
  lastResult: { outcome: 'success' | 'fail' } | null;
}

export interface PlayerPublic {
  id: string;
  name: string;
  colorTag: string;
  connected: boolean;
  isHost: boolean;
}

export interface PlayerPrivate {
  holeCards: Card[];
}

export interface RoomSettings {
  enabledCardIds: string[];
}

export type RoomStatus = 'lobby' | 'playing' | 'ended';

export interface RoomPublicState {
  code: string;
  status: RoomStatus;
  players: PlayerPublic[];
  settings: RoomSettings;
  game: GameState | null;
  finalResult: 'win' | 'lose' | null;
}

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'NAME_TAKEN'
  | 'NOT_HOST'
  | 'NOT_ENOUGH_PLAYERS'
  | 'TOO_MANY_PLAYERS'
  | 'INVALID_STATE'
  | 'TOKEN_LOCKED'
  | 'TOKEN_UNAVAILABLE'
  | 'ROUND_INACTIVE'
  | 'REJOIN_FAILED'
  | 'UNKNOWN_CARD'
  | 'GUESS_PENDING'
  | 'GUESS_NOT_ALLOWED';
