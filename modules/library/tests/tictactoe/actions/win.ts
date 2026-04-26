import { Action } from '../../../src/components/action';
import { ModifiableRuntime } from '../../../src';
import { TicTacToePlayer } from '../entities/player';
import { Lane } from '../entities/lane';

/**
 * Because this Action should
 * - be animated
 * - be logged
 * we explicitly model it as an Action for this game.
 * It doesn't do much, just internally wraps the ending-of-the-game logic.
 */
export class TicTacToeWin extends Action<
  'win',
  {
    player: TicTacToePlayer;
    lane: Lane;
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

  public readonly $type = 'win' as const;
}
