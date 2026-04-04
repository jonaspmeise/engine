import { UnoCard } from './card';
import { UnoZone } from './zone';

export class ActionCard extends UnoCard {
  constructor(
    public readonly value: 'reverse' | 'skip' | 'draw-two',
    public readonly color: 'red' | 'yellow' | 'green' | 'blue',
    location: UnoZone,
    position: number,
  ) {
    super(`action-${color}-${value}`, location, position);

    this.drawCards = value === 'draw-two' ? 2 : undefined;
  }

  drawCards: number | undefined;

  public playableOn(otherCard: UnoCard): boolean {
    return this.color === otherCard.color || this.value === otherCard.value;
  }
}
