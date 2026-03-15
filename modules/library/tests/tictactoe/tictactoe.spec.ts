import { describe, test, expect } from 'bun:test';
import { TicTacToe } from './tictactoe';
import { TicTacToeState, TicTacToeParameters } from './tictactoe.typed';
import { Slot } from './slot';
import { GameTest } from '../game.spec';
import { TicTacToePlayer } from './player';
import { Lane } from './lane';

class TicTacToeSpec extends GameTest<TicTacToeState, TicTacToeParameters> {
  readonly name = 'TicTacToe';
  readonly GameClass = TicTacToe;
  readonly parameters = {
    firstPlayer: 'X' as const,
  };

  additionalTests(): void {
    test('board initializes with 9 empty slots.', () => {
      // THEN
      expect(this.game.entitySet(Slot)).toHaveLength(9);
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
      expect(this.game.entities(Lane)).toHaveLength(3);
    });

    test('initial current player matches parameter.', () => {
      // THEN
      expect(
        this.game
          .entities(TicTacToePlayer)
          .filter((player) => player.isCurrentPlayer)[0].mark,
      ).toEqual('X');
    });
  }
}

new TicTacToeSpec().run();
