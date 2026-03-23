import { PlayerInterfaceCallback } from '../game.types';

export const handler: unique symbol = Symbol('handler');
export const playerId: unique symbol = Symbol('playerId');
export const playerInterfaceMarker: unique symbol = Symbol(
  'playerInterfaceMarker',
);

export interface PlayerInterface {
  [playerInterfaceMarker]: true;
  [handler]?: PlayerInterfaceCallback;
  [playerId]?: string;
}

export function isPlayerInterface(entity: unknown): entity is PlayerInterface {
  return (
    typeof entity === 'object' &&
    entity !== null &&
    playerInterfaceMarker in entity &&
    (entity as PlayerInterface)[playerInterfaceMarker] === true
  );
}
