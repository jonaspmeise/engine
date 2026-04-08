import { Action, Entity, ActionParameters } from '../../../../src';
import { StearthhoneCard } from '../entities/StearthhoneCard';

export abstract class StearthhonePlayAction<
  NAME extends string,
  PARAMS extends ActionParameters,
> extends Action<NAME, PARAMS & { card: StearthhoneCard }, void> {
  public canApply(): boolean {
    const owner = this.parameters.card.owner;

    return owner.mana >= this.parameters.card.cost;
  }

  public message(): string {
    return `Played ${this.parameters.card.name}.`;
  }
  public prompt(): string {
    return `Play ${this.parameters.card.name}`;
  }
  public affectedEntities(): Entity[] {
    return [this.parameters.card];
  }
}
