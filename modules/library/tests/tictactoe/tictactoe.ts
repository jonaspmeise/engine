import { TicTacToeParameters, Mark } from './tictactoe.typed';
import { Game } from '../../src/game';
import { Entity } from '../../src/components/entity';
import { MarkAction } from './actions/mark';
import { Action } from '../../src/components/action';
import { DiagonalLane } from './entities/diagonal-lane';
import { NegativeRule } from '../../src/components/negative-rule';
import { PositiveRule } from '../../src/components/positive-rule';
import { Class, EntityClass } from '../../src/game.types';
import { Choice } from '../../src/components/choice';
import { Trigger } from '../../src/components/trigger';
import { ViewFilter } from '../../src/components/view-filter';
import { ChangeTurnTrigger } from './triggers/change-turn-trigger';
import { GameOverTrigger } from './triggers/game-over-trigger';
import { HorizontalLane } from './entities/horizontal-lane';
import { TicTacToePlayer } from './entities/player';
import { Slot } from './entities/slot';
import { VerticalLane } from './entities/vertical-lane';

export class TicTacToe extends Game<TicTacToeParameters> {
  entityClasses(): Set<EntityClass<Entity>> {
    return new Set<EntityClass<Entity>>([
      Slot,
      TicTacToePlayer,
      VerticalLane,
      HorizontalLane,
      DiagonalLane,
    ]);
  }

  triggers(): Set<Trigger> | void {
    return new Set([new ChangeTurnTrigger(), new GameOverTrigger()]);
  }

  positiveRules(): Set<PositiveRule> {
    return new Set([
      {
        name: 'marking-slot-allowed-during-your-turn',
        apply: (runtime) => {
          const currentPlayer = runtime
            .entities(TicTacToePlayer)
            .filter((player) => player.isCurrentPlayer)[0]!;

          return runtime
            .entities(Slot)
            .filter((slot) => slot.isEmpty())
            .map(
              (slot) =>
                new Choice(
                  new MarkAction({
                    slot: slot,
                    player: currentPlayer,
                  }),
                  currentPlayer,
                ),
            );
        },
      },
    ]);
  }

  negativeRules(): void | Set<NegativeRule> {
    // No negative rules in this game.
  }

  viewFilters(): void | Set<ViewFilter> {
    // TicTacToe has no hidden information.
  }

  actions(): Set<Class<Action<string, any>>> {
    return new Set([MarkAction]);
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
