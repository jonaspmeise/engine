import { GameState, PlayerInterfaceCallback } from '../game.types';

export const handler: unique symbol = Symbol('handler');
export const playerId: unique symbol = Symbol('playerId');
export const playerInterfaceMarker: unique symbol = Symbol(
  'playerInterfaceMarker',
);

export interface PlayerInterface<STATE extends GameState> {
  [playerInterfaceMarker]: true;
  [handler]?: PlayerInterfaceCallback<STATE>;
  [playerId]?: string;
}

export function isPlayerInterface<STATE extends GameState>(
  entity: unknown,
): entity is PlayerInterface<STATE> {
  return (
    typeof entity === 'object' &&
    entity !== null &&
    playerInterfaceMarker in entity &&
    (entity as PlayerInterface<STATE>)[playerInterfaceMarker] === true
  );
}
