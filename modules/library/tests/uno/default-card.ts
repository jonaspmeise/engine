import { UnoCard } from './card';
import { UnoZone } from './zone';

export class DefaultCard extends UnoCard {
  public $type: string = 'DefaultCard';

  constructor(
    public readonly color: 'red' | 'yellow' | 'green' | 'blue',
    public readonly value: number,
    location: UnoZone,
    position: number,
  ) {
    super(`default-${color}-${value}`, location, position);
  }
}
