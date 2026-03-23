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
      expect(players[0]!.mark).toEqual('X');
      expect(players[1]!.mark).toEqual('O');
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
          .filter((player) => player.isCurrentPlayer)[0]!.mark,
      ).toEqual('X');
    });

    test('the initial state for each player is correctly transmitted.', (done) => {
      const playerX = this.game
        .entities(TicTacToePlayer)
        .filter((player) => player.mark === 'X')[0]!;
      const playerO = this.game
        .entities(TicTacToePlayer)
        .filter((player) => player.mark === 'O')[0]!;

      let playerXinformed = false;
      let playerOinformed = false;

      // WHEN / THEN
      // Here, the websocket connection could be handed into the callback function.
      // FIXME: This is not quite ergonomic, but it works. Think about how the state is constructed.
      this.game.registerPlayerCallback(playerX, (_delta, choices) => {
        // X is the first player, thus they should have choices!
        expect(choices).toBeDefined();
        expect(choices).toHaveLength(9); // 9 possible slots to mark.

        playerXinformed = true;
        if (playerOinformed) {
          done();
        }
      });
      this.game.registerPlayerCallback(playerO, (_delta, choices) => {
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
    });

    test.todo(
      'if a player reconnects, they receive their full state again.',
      () => {},
    );
  }
}

new TicTacToeSpec().run();
