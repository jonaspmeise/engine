import { ModifiableRuntime } from '../../../src';
import { UnoPickColorAction } from '../actions/pick-color';
import { UnoDefaultColors } from '../uno';
import { UnoCard } from './card';
import { UnoMeta } from './meta';
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

  public async onPlay(runtime: ModifiableRuntime): Promise<void> {
    const meta = runtime.anyEntity(UnoMeta)!;
    const currentPlayer = meta.currentPlayer();

    switch (this.value) {
      case 'wild-draw-four':
        meta.drawOverloads += 4;
      case 'wild':
        await runtime.execute(
          await runtime.prompt(
            currentPlayer,
            UnoDefaultColors.map(
              (color) => new UnoPickColorAction({ card: this, color }),
            ),
          ),
        );
    }
  }
}
