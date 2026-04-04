import { Entity } from '../../../src';
import { UnoZone } from './zone';

export abstract class UnoCard extends Entity {
  public $type: string = 'UnoCard';

  constructor(
    id: string,
    public location: UnoZone,
    public position: number,
  ) {
    super(`${id}-card`);
  }

  public abstract readonly color: 'red' | 'yellow' | 'green' | 'blue' | 'black';
  public abstract readonly drawCards: number | undefined;
  public abstract readonly value:
    | number
    | 'skip'
    | 'reverse'
    | 'draw-two'
    | 'wild'
    | 'wild-draw-four';

  public abstract playableOn(otherCard: UnoCard): boolean;

  public toString(): string {
    return `${this.color} ${this.value}`;
  }
}
