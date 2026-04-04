import { UnoZone } from './zone';

export class UnoDiscardPile extends UnoZone {
  public toString(): string {
    return 'Discard Pile';
  }

  public $type: string = 'DiscardPile';

  constructor() {
    super('discard-pile');
  }
}
