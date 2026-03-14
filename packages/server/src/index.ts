import type { GameState } from '@my-engine/library';
import { applyTick, createGameState, setStatus } from '@my-engine/library';

export type ServerRoom = {
  readonly state: GameState;
  readonly connectedPeers: ReadonlyArray<string>;
};

export function createRoom(): ServerRoom {
  return { state: setStatus(createGameState(), 'running'), connectedPeers: [] };
}

export function tickRoom(room: ServerRoom): ServerRoom {
  return { ...room, state: applyTick(room.state) };
}

export function joinRoom(room: ServerRoom, peerId: string): ServerRoom {
  return { ...room, connectedPeers: [...room.connectedPeers, peerId] };
}

export function leaveRoom(room: ServerRoom, peerId: string): ServerRoom {
  return { ...room, connectedPeers: room.connectedPeers.filter((id) => id !== peerId) };
}
