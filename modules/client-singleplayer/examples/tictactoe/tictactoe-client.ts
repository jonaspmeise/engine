import {
  Action,
  Choice,
  entityId,
  PlayerInterface,
  QueryableRuntime,
} from '@my-engine/library';
import { Client } from '../../src/client';
import { TicTacToe } from '../../../library/tests/tictactoe/tictactoe';
import { HorizontalLane } from '../../../library/tests/tictactoe/horizontal-lane';
import { Win } from '../../../library/tests/tictactoe/win';
import { MarkAction } from '../../../library/tests/tictactoe/mark';
import { Draw } from '../../../library/tests/tictactoe/draw';

export class TicTacToeClient extends Client<HTMLDivElement> {
  constructor(player: PlayerInterface) {
    super(
      document.getElementById('tic-tac-toe-target') as HTMLDivElement,
      new TicTacToe({
        firstPlayer: 'X',
      }),
      player,
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

  protected async animateBefore(
    choice: Choice<Action<string, any>>,
  ): Promise<void> {}

  protected async animateAfter(
    choice: Choice<MarkAction | Win | Draw>,
  ): Promise<void> {
    switch (choice.execution.$type) {
      case 'win': {
        if (choice.execution.parameters!.player === this.player) {
          alert('You win!');
        } else {
          alert('You lose!');
        }
        break;
      }
      case 'draw': {
        alert("It's a draw!");
        break;
      }
      case 'mark': {
        // We animate the move by having the mark of that current player "zoom in" slowly to its full size.
        const slotId = choice.execution.parameters!.slot[entityId];
        const slotElement = document.getElementById(slotId);
        if (slotElement) {
          await slotElement.animate(
            [
              { transform: 'scale(0.1)', opacity: '0.5' },
              { transform: 'scale(1)', opacity: '1' },
            ],
            {
              duration: 300,
              easing: 'ease-out',
            },
          ).finished;
        }
      }
    }
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
