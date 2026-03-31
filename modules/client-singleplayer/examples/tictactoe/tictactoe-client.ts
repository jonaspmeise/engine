import {
  entityId,
  PlayerInterfaceCallback,
  QueryableRuntime,
} from '@my-engine/library';
import { Client } from '../../src/client';
import { HorizontalLane } from '../../../library/tests/tictactoe/horizontal-lane';
export class TicTacToeClient extends Client<HTMLDivElement> {
  constructor() {
    super(document.getElementById('tic-tac-toe-target') as HTMLDivElement);
  }

  render(renderTarget: HTMLDivElement, runtime: QueryableRuntime): void {
    // Render board.
    let board = renderTarget.querySelector('#board');
    if (board === null) {
      const board = document.createElement('div');
      board.id = 'board';
      renderTarget.appendChild(board);
    }

    // Render horizontal lanes.
    const horizontalLanes = runtime.entities(HorizontalLane);
    for (const lane of horizontalLanes) {
      let laneElement = renderTarget.querySelector(`#lane-${lane[entityId]}`);

      if (laneElement === null) {
        laneElement = document.createElement('div');
        laneElement.id = `lane-${lane[entityId]}`;
        laneElement.classList.add('lane', 'horizontal-lane');
        renderTarget.appendChild(laneElement);
      }
      laneElement.classList.add(
        lane.wonBy(runtime) ? `player-${lane.wonBy(runtime)!.mark}` : '',
      );

      // Render slots.
      const slots = lane.slots(runtime);
      for (const slot of slots) {
        let slotElement = laneElement.querySelector(
          `#slot-${slot[entityId]}`,
        ) as HTMLDivElement;

        if (slotElement === null) {
          slotElement = document.createElement('div');
          slotElement.id = `slot-${slot[entityId]}`;
          slotElement.classList.add('slot');
          laneElement.appendChild(slotElement);
        }

        slotElement.classList.add(
          slot.markedBy === null ? '' : `player-${slot.markedBy.mark}`,
        );
        slotElement.innerHTML =
          slot.markedBy === null ? '' : slot.markedBy.mark;
      }
    }
  }

  animate(): Promise<void> {
    return Promise.resolve();
  }
}
