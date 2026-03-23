import { TicTacToeState, TicTacToeParameters, Mark } from './tictactoe.typed';
import { Game } from '../../src/game';
import { Entity } from '../../src/components/entity';
import { Slot } from './slot';
import { MarkAction } from './mark';
import { Action } from '../../src/components/action';
import { TicTacToePlayer } from './player';
import { VerticalLane } from './vertical-lane';
import { QueryableRuntime } from '../../src/interfaces/queryable-runtime';
import { HorizontalLane } from './horizontal-lane';
import { DiagonalLane } from './diagonal-lane';
import { NegativeRule } from '../../src/components/negative-rule';
import { PositiveRule } from '../../src/components/positive-rule';

export class TicTacToe extends Game<TicTacToeState, TicTacToeParameters> {
  positiveRules(): Set<PositiveRule<TicTacToeState>> {
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

  negativeRules(): void | Set<NegativeRule<TicTacToeState>> {
    // No negative rules in this game.
  }

  actions(): Set<Action<TicTacToeState, any>> {
    return new Set([new MarkAction()]);
  }

  public readonly name: string = 'Tic-Tac-Toe';

  *enrichen(
    state: TicTacToeState,
    _runtime: QueryableRuntime<TicTacToeState>,
  ): Generator<Entity<TicTacToeState>, void, undefined> {
    // Instead of hardcoding "3" here, we use the length of the board to determine its size.
    // This is a little overmodeled for a default Tic-Tac-Toe game, but showcases the possibility.
    const size = Math.sqrt(state.board.length);

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        yield new Slot(x, y);
      }
    }

    // Lanes.
    for (let i = 0; i < size; i++) {
      // Horizontal.
      yield new HorizontalLane(i);

      // Vertical.
      yield new VerticalLane(i);
    }

    // Diagonal lanes.
    yield new DiagonalLane(0);
    yield new DiagonalLane(1);

    // Players.
    const marks: Mark[] = ['X', 'O'];
    for (let i = 0; i < 2; i++) {
      yield new TicTacToePlayer(marks[i]!, state.currentPlayer === marks[i]);
    }
  }

  initialize(parameters: TicTacToeParameters): TicTacToeState {
    return {
      board: Array(9).fill(null),
      currentPlayer: parameters.firstPlayer,
    };
  }
}
