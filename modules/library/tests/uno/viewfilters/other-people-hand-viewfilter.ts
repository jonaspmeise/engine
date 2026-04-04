import { Entity, entityId, ViewFilter } from '../../../src';
import { UnoCard } from '../entities/card';
import { UnoHand } from '../entities/hand';
import { UnoPlayer } from '../entities/player';

export class UnoOtherPlayerHandViewFilter extends ViewFilter {
  apply<ENTITY extends Entity>(entity: ENTITY): ENTITY {
    // You can't know information of cards in other players' hands!
    if (!(entity instanceof UnoCard)) {
      return entity;
    }

    if (
      entity.location instanceof UnoHand &&
      entity.location.player !== this.player
    ) {
      return {
        // TODO: Type safety would be good here!
        [entityId]: entity[entityId],
        $type: 'UnoCard', // You can still know that it's a card, but not which one!
        location: entity.location, // You can still know who holds the card, but not which one!
        // All other properties are hidden!
      } as unknown as ENTITY;
    }

    return entity;
  }

  constructor(readonly player: UnoPlayer) {
    super();
  }

  public $type: string = 'uno-other-player-hand';
}
