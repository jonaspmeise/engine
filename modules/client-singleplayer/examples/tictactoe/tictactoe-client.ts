import {
  Action,
  Choice,
  entityId,
  PlayerInterface,
  QueryableRuntime,
} from '@my-engine/library';
import { Client } from '../../src/client';
import { TicTacToe } from '../../../library/tests/tictactoe/tictactoe';
import { HorizontalLane } from '../../../library/tests/tictactoe/entities/horizontal-lane';
import { Draw } from '../../../library/tests/tictactoe/actions/draw';
import { MarkAction } from '../../../library/tests/tictactoe/actions/mark';
import { Win } from '../../../library/tests/tictactoe/actions/win';

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
      board = document.createElement('div');
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

  private _launchFireworks(): void {
    const colors = [
      '#fbbf24',
      '#f472b6',
      '#34d399',
      '#60a5fa',
      '#a78bfa',
      '#fb923c',
    ];
    for (let b = 0; b < 7; b++) {
      setTimeout(() => {
        const burst = document.createElement('div');
        burst.className = 'firework-burst';
        burst.style.left = `${15 + Math.random() * 70}vw`;
        burst.style.top = `${10 + Math.random() * 55}vh`;
        document.body.appendChild(burst);

        const numParticles = 20;
        for (let i = 0; i < numParticles; i++) {
          const angle = (i / numParticles) * 2 * Math.PI;
          const dist = 55 + Math.random() * 90;
          const p = document.createElement('div');
          p.className = 'firework-particle';
          p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
          p.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
          p.style.setProperty('--dur', `${0.65 + Math.random() * 0.55}s`);
          p.style.background =
            colors[Math.floor(Math.random() * colors.length)]!;
          burst.appendChild(p);
        }

        setTimeout(() => burst.remove(), 1600);
      }, b * 320);
    }
  }

  private _showResult(type: 'win' | 'lose' | 'draw'): Promise<void> {
    return new Promise((resolve) => {
      const overlay = document.getElementById('result-overlay')!;
      const text = document.getElementById('result-text')!;
      const btn = document.getElementById('play-again')!;

      const labels: Record<string, string> = {
        win: 'You Win!',
        lose: 'You Lose!',
        draw: "It's a Draw!",
      };

      overlay.className = `result-${type} visible`;
      text.textContent = labels[type]!;

      // Force CSS animations to replay (they already fired on first game).
      for (const el of [text, btn] as HTMLElement[]) {
        el.style.animation = 'none';
        el.offsetHeight; // force reflow
        el.style.animation = '';
      }

      if (type === 'win') {
        this._launchFireworks();
      }

      const doRestart = (): void => {
        overlay.className = '';
        this.clear();
        resolve();
      };

      // "Play again?" button restarts immediately.
      btn.addEventListener(
        'click',
        (e) => {
          e.stopPropagation();
          doRestart();
        },
        { once: true },
      );

      // Clicking elsewhere on the overlay just dismisses it (board stays visible).
      const dismiss = (): void => {
        overlay.className = '';
        overlay.removeEventListener('click', dismiss);
        resolve();
      };
      overlay.addEventListener('click', dismiss);
    });
  }

  protected async animateAfter(
    choice: Choice<MarkAction | Win | Draw>,
  ): Promise<void> {
    switch (choice.execution.$type) {
      case 'win': {
        const didWin = choice.execution.parameters!.player === this.player;
        await this._showResult(didWin ? 'win' : 'lose');
        break;
      }
      case 'draw': {
        await this._showResult('draw');
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
