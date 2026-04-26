import { Entity, ModifiableRuntime } from '../../../src';
import { AfterAction } from '../../../src/components/lifecyclehooks';
import { GraphRuntime } from '../../../src/game/graph-runtime';
import { UnoPlayCardAction } from '../actions/play-card';
import { UnoPlayer } from './player';
import { UnoZone } from './zone';

export abstract class UnoCard
  extends Entity
  implements AfterAction<UnoPlayCardAction>
{
  public $type: string = 'UnoCard';

  // This flag exists on the entity, but is overwritten in the visibility function.
  // Thus, the value of this property is dependent on the player's client.
  // TODO: Formalize this better?
  public _hidden = false;

  constructor(
    id: string,
    public location: UnoZone,
    public position: number,
  ) {
    super(`${id}-card`);
  }

  async afterPlay_card(
    runtime: ModifiableRuntime,
    parameters: { card: UnoCard },
  ) {
    // After a card is played, we execute its effect - if _this_ was the card played.
    if (parameters.card === this) {
      return await this.onPlay(runtime);
    }
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

  public abstract onPlay(runtime: GraphRuntime): Promise<void>;

  public visibility(player: UnoPlayer): Partial<this> {
    const hidden: Partial<this> = {
      $type: 'UnoCard',
      location: this.location,
      _hidden: true,
    } as unknown as Partial<this>;

    // Cards are not visible if they are in the deck.
    if (this.location.$type === 'Deck') {
      return hidden;
    }

    if (this.location.$type === 'Hand') {
      // Cards in own hand are visible.
      if ((this.location as any).player === player) {
        return this;
      }

      // Cards in other player's hands are not visible, but their position needs to be known for animations.
      return {
        ...hidden,
        position: this.position,
      };
    }

    return this;
  }

  public toString(): string {
    return `${this.color} ${this.value}`;
  }
}
