import { Entity } from '../../src';
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

  public abstract readonly color: 'red' | 'yellow' | 'green' | 'blue' | 'wild';
  public abstract readonly value:
    | number
    | 'skip'
    | 'reverse'
    | 'draw-two'
    | 'wild'
    | 'wild-draw-four';
}
