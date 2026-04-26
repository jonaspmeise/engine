import { describe, test, expect, beforeEach } from 'bun:test';
import { Game } from '../src/game/game';
import { GameParameters } from '../src/game/game.types';
import { entityId } from '../src/components/entity';
import { timeout } from '../src/utility.spec';
import { Players } from '../src/components/players';

export abstract class BaseGameTest<
  PARAMETERS extends GameParameters | undefined = undefined,
> {
  abstract readonly name: string;
  abstract readonly initializer: (parameters: PARAMETERS) => Game<PARAMETERS>;
  abstract readonly parameters: PARAMETERS;
  abstract readonly randomPlayDepth: number;
  abstract readonly numberOfPlayers: number;

  abstract additionalTests(): void;

  protected game!: Game<PARAMETERS>;

  run(): void {
    const self = this;

    describe(this.name, () => {
      beforeEach(() => {
        this.game = self.initializer(self.parameters);
      });

      test('initialize returns more than one entity.', () => {
        // GIVEN / WHEN
        const state = this.game.entities();

        // THEN
        expect(state).toBeDefined();
        expect(state).not.toBeNull();
        expect(state.length).toBeGreaterThan(0);
      });

      test('more than one Entity is spawned initially.', () => {
        // THEN
        expect(this.game.entities().length).toBeGreaterThan(1);
      });

      test(`${this.randomPlayDepth} random plays end in a terminal state and do not throw any errors.`, (done) => {
        // GIVEN / WHEN
        for (let i = 0; i < self.randomPlayDepth; i++) {
          const game = self.initializer(self.parameters);

          game.registerCallbacks({
            onEnd: (status) => {
              console.debug(
                `Random play ${i + 1} ended. ${status.draws.length > 0 ? 'It was a draw.' : `Winner(s): ${status.winners.map((w) => w[entityId]).join(', ')}. Loser(s): ${status.losers.map((l) => l[entityId]).join(', ')}.`}`,
              );

              if (i === self.randomPlayDepth - 1) {
                done();
              }
            },
          });

          for (let player = 0; player < self.numberOfPlayers; player++) {
            game.registerPlayerCallback(
              game.players()[player]!,
              Players.chicken(),
            );
          }
        }

        timeout(done, 10000);
      });

      test('a registered type name -> entity class mapping is given.', () => {
        // THEN
        const mapping = this.game.entityClassMapping();

        expect(mapping).toBeDefined();
        expect(mapping).not.toBeNull();
        expect(Object.keys(mapping).length).toBeGreaterThan(0);
      });

      test('a MCTS player always wins against a random chicken player.', (done) => {
        // GIVEN
        for (let player = 0; player < self.numberOfPlayers - 1; player++) {
          this.game.registerPlayerCallback(
            this.game.players()[player]!,
            Players.chicken(),
          );
        }

        const mctsPlayer = this.game.players()[self.numberOfPlayers - 1]!;
        this.game.registerPlayerCallback(
          mctsPlayer,
          Players.mcts(this.game, mctsPlayer),
        );

        this.game.registerCallbacks({
          onEnd: (status) => {
            // THEN
            expect(status.winners).toHaveLength(1);
            expect(status.winners[0]).toBe(mctsPlayer);
            done();
          },
        });

        timeout(done, 10000);
      });

      this.additionalTests();
    });
  }
}
