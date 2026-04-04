import { UnoZone } from './zone';

export class UnoDeck extends UnoZone {
  public $type: string = 'Deck';

  constructor() {
    super('deck');
  }

  public toString(): string {
    return 'Deck';
  }
}
