import { entityId } from '../../src';
import { UnoPlayer } from './player';
import { UnoZone } from './zone';

export class UnoHand extends UnoZone {
  public $type: string = 'Hand';

  constructor(public readonly player: UnoPlayer) {
    super(`${player[entityId]}-hand`);
  }
}
