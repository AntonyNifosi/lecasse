import { randomUUID } from 'node:crypto';
import { MAX_PLAYERS, type CardMode } from '@thegang/shared';
import { GameError } from './errors';
import type { InternalPlayer, RoomInternal } from './roomTypes';

const rooms = new Map<string, RoomInternal>();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1, avoids ambiguity when read aloud
const IDLE_ROOM_TTL_MS = 30 * 60 * 1000;

function generateRoomCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function makePlayer(name: string, colorTag: string, isHost: boolean): InternalPlayer {
  return {
    id: randomUUID(),
    name: name.trim().slice(0, 20) || 'Gangster',
    colorTag,
    secretToken: randomUUID(),
    socketId: null,
    connected: true,
    isHost,
    disconnectedAt: null,
    holeCards: [],
  };
}

export function createRoom(name: string, colorTag: string): { room: RoomInternal; player: InternalPlayer } {
  const player = makePlayer(name, colorTag, true);
  const room: RoomInternal = {
    code: generateRoomCode(),
    status: 'lobby',
    settings: { mode: 'avance' },
    players: [player],
    game: null,
    finalResult: null,
    cardPools: { malusQueue: [], bonusQueue: [] },
    proPermanentCard: null,
    gangsterSlots: [],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };
  rooms.set(room.code, room);
  return { room, player };
}

export function getRoom(code: string): RoomInternal {
  const room = rooms.get(code.toUpperCase());
  if (!room) throw new GameError('ROOM_NOT_FOUND', "Cette salle n'existe pas (ou plus).");
  return room;
}

export function removeRoom(code: string): void {
  rooms.delete(code);
}

export function getPlayer(room: RoomInternal, playerId: string): InternalPlayer {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) throw new GameError('REJOIN_FAILED', 'Joueur introuvable dans cette salle.');
  return player;
}

export function requireHost(room: RoomInternal, playerId: string): void {
  if (!getPlayer(room, playerId).isHost) {
    throw new GameError('NOT_HOST', "Seul l'hôte de la salle peut faire ça.");
  }
}

export function joinRoom(room: RoomInternal, name: string, colorTag: string): InternalPlayer {
  // 'lobby' (pre-game) and 'ended' (between two games, before a rematch) both accept
  // newcomers — only a heist actually in progress ('playing') is off-limits.
  if (room.status === 'playing') throw new GameError('INVALID_STATE', 'Une partie est en cours, réessayez entre deux parties.');
  if (room.players.length >= MAX_PLAYERS) throw new GameError('ROOM_FULL', 'Cette salle est complète.');
  const trimmed = name.trim().slice(0, 20) || 'Gangster';
  const taken = room.players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());
  if (taken) throw new GameError('NAME_TAKEN', 'Ce pseudo est déjà pris dans cette salle.');
  const player = makePlayer(trimmed, colorTag, false);
  room.players.push(player);
  return player;
}

export function rejoinRoom(room: RoomInternal, playerId: string, secretToken: string): InternalPlayer {
  const player = getPlayer(room, playerId);
  if (player.secretToken !== secretToken) throw new GameError('REJOIN_FAILED', 'Jeton de reconnexion invalide.');
  player.connected = true;
  player.disconnectedAt = null;
  return player;
}

export function leaveRoom(room: RoomInternal, playerId: string): void {
  if (room.status === 'lobby') {
    const wasHost = getPlayer(room, playerId).isHost;
    room.players = room.players.filter((p) => p.id !== playerId);
    if (wasHost && room.players.length > 0) room.players[0].isHost = true;
  } else {
    markDisconnected(room, playerId);
  }
}

export function kickPlayer(room: RoomInternal, hostId: string, targetId: string): void {
  requireHost(room, hostId);
  if (room.status !== 'lobby') throw new GameError('INVALID_STATE', "Impossible d'exclure quelqu'un en pleine partie.");
  if (targetId === hostId) throw new GameError('INVALID_STATE', "L'hôte ne peut pas s'auto-exclure.");
  room.players = room.players.filter((p) => p.id !== targetId);
}

export function setMode(room: RoomInternal, hostId: string, mode: CardMode): void {
  requireHost(room, hostId);
  if (room.status !== 'lobby') throw new GameError('INVALID_STATE', 'Les réglages sont verrouillés une fois la partie lancée.');
  room.settings.mode = mode;
}

export function markDisconnected(room: RoomInternal, playerId: string): void {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return;
  player.connected = false;
  player.socketId = null;
  player.disconnectedAt = Date.now();
}

export function touchRoom(room: RoomInternal): void {
  room.lastActivityAt = Date.now();
}

export function sweepIdleRooms(): void {
  const now = Date.now();
  for (const room of rooms.values()) {
    const anyoneConnected = room.players.some((p) => p.connected);
    if (!anyoneConnected && now - room.lastActivityAt > IDLE_ROOM_TTL_MS) {
      rooms.delete(room.code);
    }
  }
}
