import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ErrorCode,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@thegang/shared';
import * as engine from '../game/engine';
import { GameError } from '../game/errors';
import * as rooms from '../game/rooms';
import type { RoomInternal, SideEffect } from '../game/roomTypes';
import { getPlayerPrivate, toPublicState } from '../game/serialize';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// Module-level (not per-connection): just needs to keep increasing across every emote from
// every player so clients can key each one uniquely, not a real id — process-lifetime is fine.
let emoteSeq = 0;

function broadcastRoom(io: AppServer, room: RoomInternal): void {
  io.to(room.code).emit('room:state', toPublicState(room));
  for (const player of room.players) {
    if (player.connected && player.socketId) {
      const priv = getPlayerPrivate(room, player.id);
      if (priv) io.to(player.socketId).emit('player:private', priv);
    }
  }
}

function dispatchSideEffects(io: AppServer, room: RoomInternal, effects: SideEffect[]): void {
  for (const effect of effects) {
    const player = room.players.find((p) => p.id === effect.toPlayerId);
    if (!player?.socketId) continue;
    if (effect.type === 'privatePeek') {
      io.to(player.socketId).emit('card:privatePeek', { aboutPlayerId: effect.aboutPlayerId, card: effect.card });
    } else {
      io.to(player.socketId).emit('card:privateInfo', { message: effect.message, card: effect.card });
    }
  }
}

function sendError(socket: AppSocket, err: unknown): void {
  if (err instanceof GameError) {
    socket.emit('error', { code: err.code, message: err.message });
    return;
  }
  console.error(err);
  socket.emit('error', { code: 'INVALID_STATE' satisfies ErrorCode, message: 'Une erreur inattendue est survenue.' });
}

function currentRoom(socket: AppSocket): RoomInternal | null {
  if (!socket.data.roomCode) return null;
  try {
    return rooms.getRoom(socket.data.roomCode);
  } catch {
    return null;
  }
}

export function registerSocketHandlers(io: AppServer, socket: AppSocket): void {
  socket.data.roomCode = null;
  socket.data.playerId = null;

  socket.on('room:create', ({ name, colorTag }, cb) => {
    try {
      const { room, player } = rooms.createRoom(name, colorTag);
      player.socketId = socket.id;
      socket.data.roomCode = room.code;
      socket.data.playerId = player.id;
      socket.join(room.code);
      cb({ ok: true, roomCode: room.code, playerId: player.id, secretToken: player.secretToken });
      broadcastRoom(io, room);
    } catch (err) {
      cb({ ok: false, error: err instanceof GameError ? err.code : 'INVALID_STATE' });
    }
  });

  socket.on('room:join', ({ roomCode, name, colorTag }, cb) => {
    try {
      const room = rooms.getRoom(roomCode);
      const player = rooms.joinRoom(room, name, colorTag);
      player.socketId = socket.id;
      socket.data.roomCode = room.code;
      socket.data.playerId = player.id;
      socket.join(room.code);
      cb({ ok: true, roomCode: room.code, playerId: player.id, secretToken: player.secretToken });
      rooms.touchRoom(room);
      broadcastRoom(io, room);
    } catch (err) {
      cb({ ok: false, error: err instanceof GameError ? err.code : 'INVALID_STATE' });
    }
  });

  socket.on('room:rejoin', ({ roomCode, playerId, secretToken }, cb) => {
    try {
      const room = rooms.getRoom(roomCode);
      const player = rooms.rejoinRoom(room, playerId, secretToken);
      player.socketId = socket.id;
      socket.data.roomCode = room.code;
      socket.data.playerId = player.id;
      socket.join(room.code);
      cb({ ok: true });
      rooms.touchRoom(room);
      broadcastRoom(io, room);
    } catch (err) {
      cb({ ok: false, error: err instanceof GameError ? err.code : 'INVALID_STATE' });
    }
  });

  socket.on('room:leave', () => {
    const room = currentRoom(socket);
    const playerId = socket.data.playerId;
    if (!room || !playerId) return;
    try {
      rooms.leaveRoom(room, playerId);
      engine.refreshGuessGates(room);
      socket.leave(room.code);
      broadcastRoom(io, room);
    } catch (err) {
      sendError(socket, err);
    } finally {
      socket.data.roomCode = null;
      socket.data.playerId = null;
    }
  });

  socket.on('room:kick', ({ playerId: targetId }) => {
    const room = currentRoom(socket);
    if (!room || !socket.data.playerId) return;
    try {
      rooms.kickPlayer(room, socket.data.playerId, targetId);
      broadcastRoom(io, room);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on('settings:setMode', ({ mode }) => {
    const room = currentRoom(socket);
    if (!room || !socket.data.playerId) return;
    try {
      rooms.setMode(room, socket.data.playerId, mode);
      broadcastRoom(io, room);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on('game:start', () => {
    const room = currentRoom(socket);
    if (!room || !socket.data.playerId) return;
    try {
      const effects = engine.startGame(room, socket.data.playerId);
      rooms.touchRoom(room);
      broadcastRoom(io, room);
      dispatchSideEffects(io, room, effects);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on('token:take', ({ stars }) => {
    const room = currentRoom(socket);
    if (!room || !socket.data.playerId) return;
    try {
      const effects = engine.takeToken(room, socket.data.playerId, stars);
      rooms.touchRoom(room);
      broadcastRoom(io, room);
      dispatchSideEffects(io, room, effects);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on('token:release', () => {
    const room = currentRoom(socket);
    if (!room || !socket.data.playerId) return;
    try {
      engine.releaseToken(room, socket.data.playerId);
      rooms.touchRoom(room);
      broadcastRoom(io, room);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on('card:submitGuess', ({ guessCategory, guessRank }) => {
    const room = currentRoom(socket);
    if (!room || !socket.data.playerId) return;
    try {
      engine.submitGuess(room, socket.data.playerId, guessCategory, guessRank);
      broadcastRoom(io, room);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on('showdown:revealNext', () => {
    const room = currentRoom(socket);
    if (!room || !socket.data.playerId) return;
    try {
      engine.revealNext(room, socket.data.playerId);
      broadcastRoom(io, room);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on('game:nextHeist', () => {
    const room = currentRoom(socket);
    if (!room) return;
    try {
      const effects = engine.nextHeist(room);
      rooms.touchRoom(room);
      broadcastRoom(io, room);
      dispatchSideEffects(io, room, effects);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on('player:emote', ({ emoteId }) => {
    const room = currentRoom(socket);
    if (!room || !socket.data.playerId) return;
    try {
      rooms.sendEmote(room, socket.data.playerId, emoteId);
      emoteSeq += 1;
      io.to(room.code).emit('player:emoteReceived', { playerId: socket.data.playerId, emoteId, seq: emoteSeq });
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on('game:rematch', () => {
    const room = currentRoom(socket);
    if (!room) return;
    try {
      engine.rematch(room);
      broadcastRoom(io, room);
    } catch (err) {
      sendError(socket, err);
    }
  });

  socket.on('disconnect', () => {
    const room = currentRoom(socket);
    if (!room || !socket.data.playerId) return;
    const player = room.players.find((p) => p.id === socket.data.playerId);
    // A newer socket may have already taken over this identity (fast reload, reconnect
    // race) — only the socket currently on record for the player may mark it disconnected.
    if (!player || player.socketId !== socket.id) return;
    rooms.markDisconnected(room, socket.data.playerId);
    // Someone dropping out must not leave the rest of the gang waiting on a vote that can
    // no longer be cast — the showdown would sit there forever.
    engine.refreshGuessGates(room);
    broadcastRoom(io, room);
  });
}
