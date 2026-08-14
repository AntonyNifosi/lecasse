import type { GameState, PlayerPrivate, PlayerPublic, RoomPublicState } from '@thegang/shared';
import type { InternalGameState, InternalPlayer, RoomInternal } from './roomTypes';

export function toPublicState(room: RoomInternal): RoomPublicState {
  return {
    code: room.code,
    status: room.status,
    players: room.players.map(toPublicPlayer),
    settings: room.settings,
    game: room.game ? toPublicGame(room.game) : null,
    finalResult: room.finalResult,
  };
}

function toPublicPlayer(player: InternalPlayer): PlayerPublic {
  return {
    id: player.id,
    name: player.name,
    colorTag: player.colorTag,
    connected: player.connected,
    isHost: player.isHost,
  };
}

function toPublicGame(game: InternalGameState): GameState {
  const { deck: _deck, ...publicGame } = game;
  return publicGame;
}

export function getPlayerPrivate(room: RoomInternal, playerId: string): PlayerPrivate | null {
  const player = room.players.find((p) => p.id === playerId);
  return player ? { holeCards: player.holeCards } : null;
}
