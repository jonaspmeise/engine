import {
  Action,
  Entity,
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
  protected async doApply(): Promise<void> {
    this.parameters.card.color = this.parameters.color;
  }

  public message(): string {
    return `${this.parameters.color} was picked.`;
  }

  public prompt(): string {
    return `Pick ${this.parameters.color}.`;
  }

  public affectedEntities(_runtime: QueryableRuntime): Entity[] | void {
    return [this.parameters.card];
  }

  public $type: 'pick_color' = 'pick_color';
}
