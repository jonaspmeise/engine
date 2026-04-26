import { Action } from '../../../src';
import { UnoWildCard } from '../entities/wild-card';

export type UnoColor = 'red' | 'yellow' | 'green' | 'blue';

export class UnoPickColorAction extends Action<
  'pick_color',
  { card: UnoWildCard; color: UnoColor }
> {
  protected async doApply(): Promise<void> {
    this.parameters.card.color = this.parameters.color;
  }

  public $type: 'pick_color' = 'pick_color';
}
