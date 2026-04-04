import {
  Action,
  entityId,
  EntityID,
  ModifiableRuntime,
  QueryableRuntime,
} from '../../../src';
import { UnoWildCard } from '../entities/wild-card';

export type UnoColor = 'red' | 'yellow' | 'green' | 'blue';

export class UnoPickColorAction extends Action<
  'pick_color',
  { card: UnoWildCard; color: UnoColor }
> {
  apply(_runtime: ModifiableRuntime): void {
    this.parameters.card.color = this.parameters.color;
  }

  public message(): string {
    return `${this.parameters.color} was picked.`;
  }

  public prompt(): string {
    return `Pick ${this.parameters.color}.`;
  }

  public affectedEntities(_runtime: QueryableRuntime): EntityID[] | void {
    return [this.parameters.card[entityId]];
  }

  public $type: 'pick_color' = 'pick_color';
}
