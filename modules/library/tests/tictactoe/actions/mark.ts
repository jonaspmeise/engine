import { Action } from '../../../src/components/action';
import { Entity, entityId } from '../../../src/components/entity';
import { ModifiableRuntime } from '../../../src/game/modifiable-runtime';
import { TicTacToePlayer } from '../entities/player';
import { Slot } from '../entities/slot';

export class MarkAction extends Action<
  'mark',
  {
    slot: Slot;
    player: TicTacToePlayer;
  }
> {
  public message(): string {
    return `Player ${this.parameters.player.mark} marked slot ${this.parameters.slot[entityId]}!`;
  }

  public prompt(): string {
    return `Mark slot ${this.parameters.slot[entityId]} with ${this.parameters.player.mark}`;
  }

  public affectedEntities(): Entity[] | void {
    return [this.parameters.slot];
  }

  public readonly $type = 'mark' as const;

  async doApply(_runtime: ModifiableRuntime): Promise<void> {
    this.parameters.slot.markedBy = this.parameters.player;
  }
}
