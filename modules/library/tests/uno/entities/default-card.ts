import { UnoCard } from './card';
import { UnoZone } from './zone';

export class UnoDefaultCard extends UnoCard {
  public static readonly $type: string = 'DefaultCard';
  public drawCards: number | undefined = undefined;
  public $type: string = 'DefaultCard';

  constructor(
    public readonly color: 'red' | 'yellow' | 'green' | 'blue',
    public readonly value: number,
    location: UnoZone,
    position: number,
  ) {
    super(`default-${color}-${value}`, location, position);
  }

  public playableOn(otherCard: UnoCard): boolean {
    return this.color === otherCard.color || this.value === otherCard.value;
  }

  public async onPlay(): Promise<void> {}
}
