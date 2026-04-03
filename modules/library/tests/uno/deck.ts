import { UnoZone } from './zone';

export class Deck extends UnoZone {
  public $type: string = 'Deck';

  constructor() {
    super('deck');
  }
}
