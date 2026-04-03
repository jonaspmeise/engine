import { UnoZone } from './zone';

export class DiscardPile extends UnoZone {
  public $type: string = 'DiscardPile';

  constructor() {
    super('discard-pile');
  }
}
