import {
  Entity,
  handler,
  playerId,
  PlayerInterface,
  PlayerInterfaceCallback,
  playerInterfaceMarker,
  QueryableRuntime,
} from '../../src';
import { UnoHand } from './hand';

export class UnoPlayer extends Entity implements PlayerInterface {
  public $type: string = 'UnoPlayer';

  [playerInterfaceMarker]: true = true as const;
  [handler]?: PlayerInterfaceCallback;
  [playerId]?: string;

  constructor(id: string) {
    super(id);
  }

  public hand(runtime: QueryableRuntime): UnoHand {
    return runtime.entities(UnoHand).find((hand) => hand.player === this)!;
  }
}
