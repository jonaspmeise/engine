import { TicTacToeParameters, Mark } from './tictactoe.typed';
import { Game } from '../../src/game/game';
import { Entity } from '../../src/components/entity';
import { MarkAction } from './actions/mark';
import { Action } from '../../src/components/action';
import { DiagonalLane } from './entities/diagonal-lane';
import { Class, EntityClass } from '../../src/game/game.types';
import { HorizontalLane } from './entities/horizontal-lane';
import { TicTacToePlayer } from './entities/player';
import { Slot } from './entities/slot';
import { VerticalLane } from './entities/vertical-lane';
import { Graph } from '../../src/components/graph/graph';
import { ModifiableRuntime } from '../../src';

export class TicTacToe extends Game<TicTacToeParameters> {
  public graph(): Graph<'INITIAL'> {
    return {
      INITIAL: async (runtime: ModifiableRuntime) => {
        while (true) {
          const currentPlayer = runtime
            .entities(TicTacToePlayer)
            .find((player) => player.isCurrentPlayer)!;

          const freeSlots = runtime
            .entities(Slot)
            .filter((slot) => slot.isEmpty());

          if (freeSlots.length === 0) {
            runtime.end({ draws: runtime.entities(TicTacToePlayer) });
            return;
          }

          runtime.execute(
            await runtime.prompt(
              currentPlayer,
              freeSlots.map(
                (slot) =>
                  new MarkAction({
                    slot: slot,
                    player: currentPlayer,
                  }),
              ),
            ),
          );
        }
      },
    };
  }

  entityClasses(): Set<EntityClass<Entity>> {
    return new Set<EntityClass<Entity>>([
      Slot,
      TicTacToePlayer,
      VerticalLane,
      HorizontalLane,
      DiagonalLane,
    ]);
  }

  actions(): Set<Class<Action<string, any, any>>> {
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
