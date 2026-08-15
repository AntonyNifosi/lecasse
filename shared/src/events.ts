import type { Card, CardMode, ErrorCode, HandCategory, Rank, RoomPublicState, PlayerPrivate } from './types';

export interface AckOk {
  ok: true;
  roomCode: string;
  playerId: string;
  secretToken: string;
}
export interface AckErr {
  ok: false;
  error: ErrorCode;
}
export type Ack = AckOk | AckErr;
export type RejoinAck = { ok: true } | AckErr;

/**
 * The server is the single source of truth: almost every mutation simply
 * re-broadcasts the full `RoomPublicState` to the room via `room:state`.
 * The client keeps one reducer that replaces its state wholesale on every
 * `room:state` event, and derives animations (a new showdown reveal, a new
 * heist result, ...) by diffing against the previous state. This avoids a
 * combinatorial explosion of fine-grained events that could arrive out of
 * order or get missed.
 */
export interface ClientToServerEvents {
  'room:create': (payload: { name: string; colorTag: string }, cb: (res: Ack) => void) => void;
  'room:join': (payload: { roomCode: string; name: string; colorTag: string }, cb: (res: Ack) => void) => void;
  'room:rejoin': (payload: { roomCode: string; playerId: string; secretToken: string }, cb: (res: RejoinAck) => void) => void;
  'room:leave': () => void;
  'room:kick': (payload: { playerId: string }) => void;
  'settings:toggleCard': (payload: { cardId: string; enabled: boolean }) => void;
  'settings:randomizeCards': (payload: { kind: 'bonus' | 'malus'; count: number }) => void;
  'settings:setMode': (payload: { mode: CardMode }) => void;
  'game:start': () => void;
  'token:take': (payload: { stars: number }) => void;
  'token:release': () => void;
  'card:submitGuess': (payload: { guessCategory?: HandCategory; guessRank?: Rank }) => void;
  'showdown:revealNext': () => void;
  'game:nextHeist': () => void;
  'game:rematch': () => void;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomPublicState) => void;
  'player:private': (data: PlayerPrivate) => void;
  'card:privatePeek': (data: { aboutPlayerId: string; card: Card }) => void;
  'card:privateInfo': (data: { message: string; card?: Card }) => void;
  error: (data: { code: ErrorCode; message: string }) => void;
}

export type InterServerEvents = Record<string, never>;

export interface SocketData {
  roomCode: string | null;
  playerId: string | null;
}
