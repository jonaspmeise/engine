import { Action, entityId, PlayerInterface } from '@my-engine/library';
import { Client } from '../../src/client';
import { TicTacToe } from '../../../library/tests/tictactoe/tictactoe';
import { HorizontalLane } from '../../../library/tests/tictactoe/entities/horizontal-lane';
import { TicTacToeDraw } from '../../../library/tests/tictactoe/actions/draw';
import { TicTacToeMark } from '../../../library/tests/tictactoe/actions/mark';
import { ClientEntityHandler } from '../../src/client-entity-handler';
import { TicTacToeWin } from '../../../library/tests/tictactoe/actions/win';
import { TicTacToePlayer } from '../../../library/tests/tictactoe/entities/player';
import { ChoiceTypeMapping } from '../../src/client.types';

export class TicTacToeClient extends Client<HTMLDivElement, TicTacToeMark> {
  /**
   * Optional hook called after the result overlay is dismissed.
   * When set (e.g. in multiplayer), the callee decides what to do:
   *   - 'restart' → request a new game from the server
   *   - 'cancel'  → navigate back to the menu
   * When not set the default singleplayer behaviour applies (`this.clear()`).
   */
  public onResultChoice: ((result: 'restart' | 'cancel') => void) | null = null;

  constructor(player: PlayerInterface) {
    super(
      document.getElementById('tic-tac-toe-target') as HTMLDivElement,
      new TicTacToe({
        firstPlayer: 'X',
      }),
      player,
    );
  }

  render(renderTarget: HTMLDivElement, runtime: ClientEntityHandler): void {
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

  public choiceTypeMapping = {
    mark: {
      render: async (choice, execute) => {
        // Highlight the slot in question and make it clickable.
        const element = document.getElementById(
          choice.parameters.slot[entityId],
        )!;

        element.classList.add('highlighted');
        element.onclick = () => {
          element.classList.remove('highlighted');
          element.onclick = null;
          execute();
        };
      },
      erase: async (choice) => {
        // And remove the highlight again...
        const element = document.getElementById(
          choice.parameters.slot[entityId],
        )!;
        element.classList.remove('highlighted');
        element.onclick = null;
      },
    },
  } satisfies ChoiceTypeMapping<TicTacToeMark>;

  protected async animateBefore(_choice: Action<string, any>): Promise<void> {}

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

  private _showResult(
    type: 'win' | 'lose' | 'draw',
  ): Promise<'restart' | 'cancel'> {
    return new Promise((resolve) => {
      const overlay = document.getElementById('result-overlay')!;
      const text = document.getElementById('result-text')!;
      const btn = document.getElementById('play-again')!;
      const cancelBtn = document.getElementById('cancel-btn')!;

      const labels: Record<string, string> = {
        win: 'You Win!',
        lose: 'You Lose!',
        draw: "It's a Draw!",
      };

      overlay.className = `result-${type} visible`;
      text.textContent = labels[type]!;

      // Force CSS animations to replay (they already fired on first game).
      for (const el of [text, btn, cancelBtn] as HTMLElement[]) {
        el.style.animation = 'none';
        el.offsetHeight; // force reflow
        el.style.animation = '';
      }

      if (type === 'win') {
        this._launchFireworks();
      }

      const cleanup = (): void => {
        overlay.className = '';
      };

      btn.addEventListener(
        'click',
        (e) => {
          e.stopPropagation();
          cleanup();
          resolve('restart');
        },
        { once: true },
      );

      cancelBtn.addEventListener(
        'click',
        (e) => {
          e.stopPropagation();
          cleanup();
          resolve('cancel');
        },
        { once: true },
      );
    });
  }

  protected async animateAfter(
    choice: TicTacToeMark | TicTacToeWin | TicTacToeDraw,
  ): Promise<void> {
    switch (choice.$type) {
      case 'win': {
        const didWin =
          choice.parameters!.player[entityId] ===
          (this.player as unknown as TicTacToePlayer)[entityId];
        const result = await this._showResult(didWin ? 'win' : 'lose');
        if (this.onResultChoice) {
          this.onResultChoice(result);
        } else {
          this.clear();
        }
        break;
      }
      case 'draw': {
        const result = await this._showResult('draw');
        if (this.onResultChoice) {
          this.onResultChoice(result);
        } else {
          this.clear();
        }
        break;
      }
      case 'mark': {
        // We animate the move by having the mark of that current player "zoom in" slowly to its full size.
        const slotId = choice.parameters!.slot[entityId];
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
}
