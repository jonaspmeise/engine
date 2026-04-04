import { Action } from '../../../src/components/action';
import { entityId } from '../../../src/components/entity';
import { EntityID } from '../../../src/components/entity.types';
import { ModifiableRuntime } from '../../../src/interfaces/modifiable-runtime';
import { TicTacToePlayer } from './player';
import { Slot } from './slot';

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

  public affectedEntities(): EntityID[] | void {
    return [this.parameters.slot[entityId]];
  }

  public readonly $type = 'mark' as const;

  apply(_runtime: ModifiableRuntime): void {
    this.parameters.slot.markedBy = this.parameters.player;
  }
}
