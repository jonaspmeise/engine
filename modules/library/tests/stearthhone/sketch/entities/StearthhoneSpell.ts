import { ModifiableRuntime } from '../../../../src';
import { StearthhoneCard } from './StearthhoneCard';

export abstract class StearthhoneSpell extends StearthhoneCard {
  public $type: string = 'Spell';

  public toString(): string {
    return this.name;
  }

  public abstract onCast(runtime: ModifiableRuntime): void;
}
