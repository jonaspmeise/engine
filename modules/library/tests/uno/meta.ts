import { Entity } from '../../src';
import { UnoPlayer } from './player';

export class Meta extends Entity {
  public $type: string = 'Meta';

  public drawOverloads: number = 0;

  constructor(public currentPlayer: UnoPlayer) {
    super('meta');
  }
}
