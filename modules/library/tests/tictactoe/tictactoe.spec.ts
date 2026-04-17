import { test, expect } from 'bun:test';
import { TicTacToe } from './tictactoe';
import { TicTacToeParameters } from './tictactoe.typed';
import { BaseGameTest } from '../game.spec';
import { jsonRoundtrip, timeout } from '../../src/utility.spec';
import { Lane } from './entities/lane';
import { TicTacToePlayer } from './entities/player';
import { Slot } from './entities/slot';

class TicTacToeSpec extends BaseGameTest<TicTacToeParameters> {
  readonly numberOfPlayers = 2;
  readonly initializer = (parameters: TicTacToeParameters) =>
    new TicTacToe(parameters);
  readonly name = 'TicTacToe';
  readonly randomPlayDepth = 100;
  readonly parameters = {
    firstPlayer: 'X' as const,
  };

  additionalTests(): void {
    test.todo('board initializes with 9 empty slots.', () => {
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
      this.game.registerPlayerCallback(playerX, {
        state: (snapshots) => {
          expect(jsonRoundtrip(snapshots)).toEqual([
            {
              dirtyEntities: {
                'slot-0-0': {
                  markedBy: null,
                  $type: 'slot',
                  x: 0,
                  y: 0,
                },
                'slot-0-1': {
                  markedBy: null,
                  $type: 'slot',
                  x: 0,
                  y: 1,
                },
                'slot-0-2': {
                  markedBy: null,
                  $type: 'slot',
                  x: 0,
                  y: 2,
                },
                'slot-1-0': {
                  markedBy: null,
                  $type: 'slot',
                  x: 1,
                  y: 0,
                },
                'slot-1-1': {
                  markedBy: null,
                  $type: 'slot',
                  x: 1,
                  y: 1,
                },
                'slot-1-2': {
                  markedBy: null,
                  $type: 'slot',
                  x: 1,
                  y: 2,
                },
                'slot-2-0': {
                  markedBy: null,
                  $type: 'slot',
                  x: 2,
                  y: 0,
                },
                'slot-2-1': {
                  markedBy: null,
                  $type: 'slot',
                  x: 2,
                  y: 1,
                },
                'slot-2-2': {
                  markedBy: null,
                  $type: 'slot',
                  x: 2,
                  y: 2,
                },
                'HorizontalLane-0': {
                  index: 0,
                  $type: 'horizontal-lane',
                },
                'VerticalLane-0': {
                  index: 0,
                  $type: 'vertical-lane',
                },
                'HorizontalLane-1': {
                  index: 1,
                  $type: 'horizontal-lane',
                },
                'VerticalLane-1': {
                  index: 1,
                  $type: 'vertical-lane',
                },
                'HorizontalLane-2': {
                  index: 2,
                  $type: 'horizontal-lane',
                },
                'VerticalLane-2': {
                  index: 2,
                  $type: 'vertical-lane',
                },
                'DiagonalLane-0': {
                  index: 0,
                  $type: 'diagonal-lane',
                },
                'DiagonalLane-1': {
                  index: 1,
                  $type: 'diagonal-lane',
                },
                'player-X': {
                  isCurrentPlayer: true,
                  mark: 'X',
                  $type: 'TicTacToePlayer',
                },
                'player-O': {
                  isCurrentPlayer: false,
                  mark: 'O',
                  $type: 'TicTacToePlayer',
                },
              },
            },
          ]);
        },
        prompt: (choices) => {
          // X is the first player, thus they should have choices!
          expect(choices).toBeDefined();
          expect(choices).toHaveLength(9); // 9 possible slots to mark.

          expect(jsonRoundtrip(choices)).toEqual([
            {
              execution: {
                parameters: {
                  // We communicate using a placeholder to the Entity's ID here.
                  // This is done in order to not send the entire entity data multiple times and save bandwidth.
                  slot: '$ENGINE:slot-0-0',
                  player: '$ENGINE:player-X',
                },
                type: 'mark',
              },
              id: 0,
              player: '$ENGINE:player-X', // TODO: Redundant information! We know that only we are this player!
            },
            {
              execution: {
                parameters: {
                  slot: '$ENGINE:slot-0-1',
                  player: '$ENGINE:player-X',
                },
                type: 'mark',
              },
              id: 1,
              player: '$ENGINE:player-X',
            },
            {
              execution: {
                parameters: {
                  slot: '$ENGINE:slot-0-2',
                  player: '$ENGINE:player-X',
                },
                type: 'mark',
              },
              id: 2,
              player: '$ENGINE:player-X',
            },
            {
              execution: {
                parameters: {
                  slot: '$ENGINE:slot-1-0',
                  player: '$ENGINE:player-X',
                },
                type: 'mark',
              },
              id: 3,
              player: '$ENGINE:player-X',
            },
            {
              execution: {
                parameters: {
                  slot: '$ENGINE:slot-1-1',
                  player: '$ENGINE:player-X',
                },
                type: 'mark',
              },
              id: 4,
              player: '$ENGINE:player-X',
            },
            {
              execution: {
                parameters: {
                  slot: '$ENGINE:slot-1-2',
                  player: '$ENGINE:player-X',
                },
                type: 'mark',
              },
              id: 5,
              player: '$ENGINE:player-X',
            },
            {
              execution: {
                parameters: {
                  slot: '$ENGINE:slot-2-0',
                  player: '$ENGINE:player-X',
                },
                type: 'mark',
              },
              id: 6,
              player: '$ENGINE:player-X',
            },
            {
              execution: {
                parameters: {
                  slot: '$ENGINE:slot-2-1',
                  player: '$ENGINE:player-X',
                },
                type: 'mark',
              },
              id: 7,
              player: '$ENGINE:player-X',
            },
            {
              execution: {
                parameters: {
                  slot: '$ENGINE:slot-2-2',
                  player: '$ENGINE:player-X',
                },
                type: 'mark',
              },
              id: 8,
              player: '$ENGINE:player-X',
            },
          ]);

          playerXinformed = true;
          if (playerOinformed) {
            done();
          }
        },
      });
      this.game.registerPlayerCallback(playerO, {
        state: () => {
          // O is the second player, thus they should not have any choices.
          playerOinformed = true;
          if (playerXinformed) {
            done();
          }
        },
        prompt: () => {},
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
