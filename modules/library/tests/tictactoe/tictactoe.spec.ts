import { test, expect } from 'bun:test';
import { TicTacToe } from './tictactoe';
import { TicTacToeState, TicTacToeParameters } from './tictactoe.typed';
import { Slot } from './slot';
import { GameTest } from '../game.spec';
import { TicTacToePlayer } from './player';
import { Lane } from './lane';
import { timeout } from '../utility.spec';

class TicTacToeSpec extends GameTest<TicTacToeState, TicTacToeParameters> {
  readonly name = 'TicTacToe';
  readonly GameClass = TicTacToe;
  readonly randomPlayDepth = 100;
  readonly parameters = {
    firstPlayer: 'X' as const,
  };

  additionalTests(): void {
    test('board initializes with 9 empty slots.', () => {
      // THEN
      expect(this.game.entitySet(Slot)).toHaveLength(9);
      expect(this.game.entities(Slot)).toHaveLength(9);
      expect(
        Array.from(this.game.entities(Slot)).every(
          (slot) => slot.markedBy === null,
        ),
      ).toBe(true);
    });

    test('players are initialized correctly.', () => {
      // THEN
      const players = this.game.entities(TicTacToePlayer);
      expect(players).toHaveLength(2);
      expect(players[0].mark).toEqual('X');
      expect(players[1].mark).toEqual('O');
    });

    test('lanes are initialized correctly.', () => {
      // THEN
      expect(this.game.entities(Lane)).toHaveLength(3 + 3 + 2);
    });

    test('initial current player matches parameter.', () => {
      // THEN
      expect(
        this.game
          .entities(TicTacToePlayer)
          .filter((player) => player.isCurrentPlayer)[0].mark,
      ).toEqual('X');
    });

    test.todo(
      'the initial state for each player is correctly transmitted.',
      (done) => {
        // TODO: How to initiate players here?
        // Once the game is constructed, the players are already initialized due to their entities.

        // GIVEN
        // Hook up players to the game. We can connect external callbacks to the player entities,
        // even after they are spawned.

        // TODO: We need to map each player's interface secret ID to an external callback (e.g. a websocket connection).
        // This should be used to also reconnect to the player to the same player instance if they rejoin the game.
        // That temporarily created ID serves as the key to connect the player to a game.
        const playerX = this.game
          .entities(TicTacToePlayer)
          .filter((player) => player.mark === 'X')[0];
        const playerO = this.game
          .entities(TicTacToePlayer)
          .filter((player) => player.mark === 'O')[0];

        let playerXinformed = false;
        let playerOinformed = false;

        // WHEN / THEN
        // Here, the websocket connection could be handed into the callback function.
        this.game.registerPlayerCallback(playerX, (delta, choices) => {
          // X is the first player, thus they should have choices!
          expect(choices).toBeDefined();
          expect(choices).toHaveLength(9); // 9 possible slots to mark.

          playerXinformed = true;
          if (playerOinformed) {
            done();
          }
        });
        this.game.registerPlayerCallback(playerO, (delta, choices) => {
          // O is the second player, thus they should not have any choices.
          expect(choices).toBeDefined();
          expect(choices).toHaveLength(0);

          playerOinformed = true;
          if (playerXinformed) {
            done();
          }
        });

        // OTHERWISE
        timeout(done);
      },
    );
  }
}

new TicTacToeSpec().run();
