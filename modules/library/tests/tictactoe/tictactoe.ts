import { TicTacToeParameters, Mark } from './tictactoe.typed';
import { Game } from '../../src/game';
import { Entity } from '../../src/components/entity';
import { Slot } from './slot';
import { MarkAction } from './mark';
import { Action } from '../../src/components/action';
import { TicTacToePlayer } from './player';
import { VerticalLane } from './vertical-lane';
import { HorizontalLane } from './horizontal-lane';
import { DiagonalLane } from './diagonal-lane';
import { NegativeRule } from '../../src/components/negative-rule';
import { PositiveRule } from '../../src/components/positive-rule';
import { ModifiableRuntime } from '../../src/interfaces/modifiable-runtime';

export class TicTacToe extends Game<TicTacToeParameters> {
  positiveRules(): Set<PositiveRule> {
    return new Set([
      {
        name: 'marking-slot-allowed-during-your-turn',
        apply: (runtime) => {
          const currentPlayer = runtime
            .entities(TicTacToePlayer)
            .filter((player) => player.isCurrentPlayer)[0]!;

          // TODO: Make Choice instantiate the Action object itself...?
          return runtime.entities(Slot).map((slot) => ({
            action: MarkAction,
            parameters: {
              playerId: currentPlayer.id(),
              x: slot.x,
              y: slot.y,
            },
            player: currentPlayer,
          }));
        },
      },
    ]);
  }

  negativeRules(): void | Set<NegativeRule> {
    // No negative rules in this game.
  }

  actions(): Set<Action<any>> {
    return new Set([new MarkAction()]);
  }

  public readonly name: string = 'Tic-Tac-Toe';

  initialize(parameters: TicTacToeParameters): Set<Entity> {
    const entities = new Set<Entity>();

    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        entities.add(new Slot(x, y));
      }
    }

    // Lanes.
    for (let i = 0; i < 3; i++) {
      // Horizontal.
      entities.add(new HorizontalLane(i));

      // Vertical.
      entities.add(new VerticalLane(i));
    }

    // Diagonal lanes.
    entities.add(new DiagonalLane(0));
    entities.add(new DiagonalLane(1));

    // Players.
    const marks: Mark[] = ['X', 'O'];
    for (let i = 0; i < 2; i++) {
      entities.add(
        new TicTacToePlayer(marks[i]!, parameters.firstPlayer === marks[i]),
      );
    }

    return entities;
  }
}
