import { ModifiableRuntime } from '../../../../src';
import { StearthhoneSpell } from '../entities/StearthhoneSpell';
import { StearthhonePlayAction } from './StearthhonePlayAction';

export class StearthhonePlaySpell extends StearthhonePlayAction<
  'play_spell',
  { card: StearthhoneSpell }
> {
  protected async doApply(runtime: ModifiableRuntime): Promise<void> {
    this.parameters.card.onCast(runtime);
  }

  public $type: 'play_spell' = 'play_spell';
}
