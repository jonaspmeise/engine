import { Entity } from '../../../src';
import { UnoPlayer } from './player';

/**
 * A "meta" entity that stores global data about the game.
 * This entity only exists as a singleton.
 */
export class UnoMeta extends Entity {
  public $type: string = 'Meta';

  public drawOverloads: number = 0;
  public currentPlayerIndex: number = 0;
  public direction: 1 | -1 = 1;

  constructor(public players: UnoPlayer[]) {
    super('meta');
  }

  public toString(): string {
    return `Meta`;
  }

  public currentPlayer() {
    return this.players[this.currentPlayerIndex]!;
  }
}
