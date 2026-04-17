import { Action, ModifiableRuntime } from '../../../src';
import { UnoPlayer } from '../entities/player';

export class UnoWinGameAction extends Action<
  'WinGame',
  {
    player: UnoPlayer;
  }
> {
  async doApply(runtime: ModifiableRuntime): Promise<void> {
    runtime.end({
      winners: [this.parameters.player],
      losers: runtime
        .players()
        .filter((player) => player !== this.parameters.player),
    });
  }

  public $type: 'WinGame' = 'WinGame';
}
