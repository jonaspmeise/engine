import { Action, Choice, entityId, QueryableRuntime } from '@my-engine/library';
import { Client } from '../../src/client';
import { TicTacToe } from '../../../library/tests/tictactoe/tictactoe';
import { HorizontalLane } from '../../../library/tests/tictactoe/horizontal-lane';

export class TicTacToeClient extends Client<HTMLDivElement> {
  constructor() {
    super(
      document.getElementById('tic-tac-toe-target') as HTMLDivElement,
      new TicTacToe({
        firstPlayer: 'X',
      }),
    );
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
      let laneElement = renderTarget.querySelector(`#${lane[entityId]}`);

      if (laneElement === null) {
        laneElement = document.createElement('div');
        laneElement.id = lane[entityId];
        laneElement.classList.add('lane', 'horizontal-lane');
        renderTarget.appendChild(laneElement);
      }

      if (lane.wonBy(runtime)) {
        laneElement.classList.add(`player-${lane.wonBy(runtime)!.mark}`);
      }

      // Render slots.
      const slots = lane.slots(runtime);
      for (const slot of slots) {
        let slotElement = laneElement.querySelector(
          `#${slot[entityId]}`,
        ) as HTMLDivElement;

        if (slotElement === null) {
          slotElement = document.createElement('div');
          slotElement.id = slot[entityId];
          slotElement.classList.add('slot');
          laneElement.appendChild(slotElement);
        }

        if (!slot.isEmpty()) {
          slotElement.classList.add(`player-${slot.markedBy!.mark}`);
          slotElement.innerHTML = slot.markedBy!.mark;
        }
      }
    }
  }

  animate(choice: Choice<Action<any>>): Promise<void> {
    return Promise.resolve();
  }

  highlightStyle(): HTMLStyleElement {
    const style = document.createElement('style');
    style.innerHTML = `
      .slot.engine-choice {
        outline: 2px solid yellow;
      }

      .slot.engine-choice:hover {
        outline: 2px solid orange;
      }

      .slot.engine-choice:active {
        transform: scale(0.95);
      }
    `;
    return style;
  }
}
