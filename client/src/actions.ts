import type { Ack, HandCategory, Rank, RejoinAck } from '@thegang/shared';
import { socket } from './socket';

function ensureConnected(): void {
  if (!socket.connected) socket.connect();
}

export function createRoom(name: string, colorTag: string): Promise<Ack> {
  ensureConnected();
  return new Promise((resolve) => socket.emit('room:create', { name, colorTag }, resolve));
}

export function joinRoom(roomCode: string, name: string, colorTag: string): Promise<Ack> {
  ensureConnected();
  return new Promise((resolve) => socket.emit('room:join', { roomCode: roomCode.toUpperCase(), name, colorTag }, resolve));
}

export function rejoinRoom(roomCode: string, playerId: string, secretToken: string): Promise<RejoinAck> {
  ensureConnected();
  return new Promise((resolve) => socket.emit('room:rejoin', { roomCode, playerId, secretToken }, resolve));
}

export function leaveRoom(): void {
  socket.emit('room:leave');
}

export function kickPlayer(playerId: string): void {
  socket.emit('room:kick', { playerId });
}

export function toggleCard(cardId: string, enabled: boolean): void {
  socket.emit('settings:toggleCard', { cardId, enabled });
}

export function startGame(): void {
  socket.emit('game:start');
}

export function takeToken(stars: number): void {
  socket.emit('token:take', { stars });
}

export function releaseToken(): void {
  socket.emit('token:release');
}

export function submitGuess(payload: { guessCategory?: HandCategory; guessRank?: Rank }): void {
  socket.emit('card:submitGuess', payload);
}

export function revealNext(): void {
  socket.emit('showdown:revealNext');
}

export function nextHeist(): void {
  socket.emit('game:nextHeist');
}

export function rematch(): void {
  socket.emit('game:rematch');
}
