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

// The game bans talking about your cards, so a wordless reaction is the one legal way to
// visibly respond to a reveal or a risky token grab — this is meant to support that, not to
// become a chat feature, hence a closed, original set rather than free text or arbitrary emoji.
export const EMOTES = [
  { id: 'wahou', emoji: '😮', label: 'Wahou' },
  { id: 'content', emoji: '😄', label: 'Content' },
  { id: 'triste', emoji: '😢', label: 'Triste' },
  { id: 'rire', emoji: '😂', label: 'Mort de rire' },
  { id: 'stress', emoji: '😰', label: 'Stress' },
  { id: 'suspicion', emoji: '🤨', label: 'Suspicion' },
] as const;
export type EmoteId = (typeof EMOTES)[number]['id'];
export const EMOTE_COOLDOWN_MS = 2500;

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

export interface GuessGate {
  guessType: 'category' | 'rank';
  targetPlayerId: string;
  resolved: boolean;
  correct: boolean | null;
  // The group's final answer once every eligible voter has voted (majority, random
  // tie-break).
  finalGuess: HandCategory | Rank | null;
  // Each voter's own answer, playerId -> vote, shown live on their seat: around a real
  // table the group talks this through out loud, so hiding who thinks what only made the
  // wait opaque. Never includes the player being guessed about — they don't vote.
  votes: Record<string, HandCategory | Rank>;
}

export interface ShowdownState {
  order: string[]; // playerIds, weakest red token to strongest
  revealed: ShowdownEntry[];
  failed: boolean;
  // At most one gate per guessType (our pack has one category-guess and one rank-guess
  // card) — both can be pending at once in Gangster mode, where 2 malus cards run together.
  guessGates: GuessGate[];
}

export interface ActiveCardState {
  cardId: string;
  kind: 'bonus' | 'malus';
}

export interface HeistRecord {
  heistNumber: number;
  outcome: 'success' | 'fail';
  activeCardIds: string[];
}

export interface GameState {
  heistNumber: number;
  currentRound: RoundColor | 'showdown' | 'result';
  communityCards: Card[];
  tokensByRound: Record<RoundColor, RoundTokens>;
  vaults: number;
  alarms: number;
  alarmsToLose: number; // 3 normally, 2 in Gangster mode — fixed for the whole match
  history: HeistRecord[];
  activeCards: ActiveCardState[]; // 0-2: empty on heist 1 (unless Pro/Gangster), usually 1, up to 2 in Gangster mode
  holeCardsPerPlayer: number; // 2 normally, more with "Renfort"-like cards stacked
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

// avance: the base bonus/malus mode — one card at a time, drawn after each heist's outcome.
// pro: one malus card drawn at random is active permanently from heist 1, on top of the avance rotation.
// gangster: always exactly 2 malus cards active (no bonus cards at all), from heist 1, one
// swapped out per heist; losing threshold drops from 3 alarms to 2.
export type CardMode = 'avance' | 'pro' | 'gangster';

export interface RoomSettings {
  mode: CardMode;
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
  | 'GUESS_PENDING'
  | 'GUESS_NOT_ALLOWED'
  | 'NOT_YOUR_TURN'
  | 'EMOTE_RATE_LIMITED';
