import { Action } from '../../../src/components/action';
import { ModifiableRuntime } from '../../../src/game/modifiable-runtime';
import { TicTacToePlayer } from '../entities/player';
import { Slot } from '../entities/slot';

export class TicTacToeMark extends Action<
  'mark',
  {
    slot: Slot;
    player: TicTacToePlayer;
  }
> {
  public readonly $type = 'mark' as const;

  async doApply(runtime: ModifiableRuntime): Promise<void> {
    this.parameters.slot.markedBy = this.parameters.player;

    // Switch the active player.
    for (const player of runtime.entities(TicTacToePlayer)) {
      player.isCurrentPlayer = player !== this.parameters.player;
    }
  }
}
