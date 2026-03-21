import { Entity } from './entity';
import { GameState } from './game.types';

export const stateHandler: unique symbol = Symbol('stateHandler');

export interface PlayerInterface<STATE extends GameState> {
  [stateHandler]: (state: STATE) => void;
}

export function isPlayerInterface<STATE extends GameState>(
  entity: unknown,
): entity is PlayerInterface<STATE> {
  return (
    typeof entity === 'object' &&
    entity !== null &&
    stateHandler in entity &&
    typeof (entity as any)[stateHandler] === 'function'
  );
}
