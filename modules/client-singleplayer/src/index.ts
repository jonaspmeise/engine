import type { GameState } from '@my-engine/library';
import { addEntity, applyTick, createGameState, setStatus } from '@my-engine/library';

export type SingleplayerSession = {
  readonly state: GameState;
};

export function createSession(): SingleplayerSession {
  return { state: setStatus(createGameState(), 'running') };
}

export function tick(session: SingleplayerSession): SingleplayerSession {
  return { state: applyTick(session.state) };
}

export function spawnEntity(session: SingleplayerSession, id: string): SingleplayerSession {
  return { state: addEntity(session.state, id) };
}
