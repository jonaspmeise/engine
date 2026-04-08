import { ModifiableRuntime } from '../../../../src';
import { StearthhoneMinion } from '../entities/StearthhoneMinion';
import { StearthhonePlayAction } from './StearthhonePlayAction';
import { StearthhoneSummonMinionAction } from './StearthhoneSummonMinionAction';

export class StearthhonePlayMinionAction extends StearthhonePlayAction<
  'play_minion',
  { card: StearthhoneMinion; boardPosition: number }
> {
  public $type: 'play_minion' = 'play_minion';

  protected async doApply(runtime: ModifiableRuntime): Promise<void> {
    new StearthhoneSummonMinionAction(this.parameters).apply(runtime);
  }
}
