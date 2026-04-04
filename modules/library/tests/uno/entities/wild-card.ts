import { UnoCard } from './card';
import { UnoZone } from './zone';

export class UnoWildCard extends UnoCard {
  public $type: string = 'WildCard';
  public color: 'red' | 'yellow' | 'green' | 'blue' | 'black' = 'black';
  drawCards: number | undefined;

  constructor(
    number: number,
    public readonly value: 'wild' | 'wild-draw-four',
    location: UnoZone,
    position: number,
  ) {
    super(`${value}-${number}`, location, position);

    this.drawCards = value === 'wild-draw-four' ? 4 : undefined;
  }

  public playableOn(_otherCard: UnoCard): boolean {
    // Wild cards are always playable!
    return true;
  }
}
