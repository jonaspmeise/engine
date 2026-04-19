import {
  Entity,
  handler,
  playerId,
  PlayerInterface,
  PlayerInterfaceCallback,
  playerInterfaceMarker,
  QueryableRuntime,
} from '../../../src';
import { UnoHand } from './hand';
import { entityId } from '@my-engine/library';

export class UnoPlayer extends Entity implements PlayerInterface {
  public $type: string = 'UnoPlayer';

  [playerInterfaceMarker]: true = true as const;
  [handler]?: PlayerInterfaceCallback;
  [playerId]?: string;

  constructor(
    id: string,
    private readonly number: number,
  ) {
    super(id);
  }

  public hand(runtime: QueryableRuntime): UnoHand {
    return runtime
      .entities(UnoHand)
      .find((hand) => hand.player[entityId] === this[entityId])!;
  }

  public toString(): string {
    return `Player #${this.number}`;
  }
}
