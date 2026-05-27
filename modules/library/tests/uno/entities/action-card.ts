import { ModifiableRuntime } from '../../../src';
import { UnoCard } from './card';
import { UnoMeta } from './meta';
import { UnoZone } from './zone';

export class ActionCard extends UnoCard {
  public static readonly $type: string = 'ActionCard';
  public $type: string = 'ActionCard';
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

  public async onPlay(runtime: ModifiableRuntime): Promise<void> {
    const meta = runtime.anyEntity(UnoMeta)!;

    switch (this.value) {
      case 'reverse':
        meta.direction *= -1;
        break;
      case 'skip':
        meta.currentPlayerIndex++;
        break;
      case 'draw-two':
        meta.drawOverloads += 2;
        break;
    }
  }
}
