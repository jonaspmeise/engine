import {
  jest,
  describe,
  afterEach,
  beforeEach,
  mock,
  expect,
  test,
} from 'bun:test';
import { Logger } from '../../game/game.types';
import { StateService } from './state-service';
import { PlayerEntity } from '../entity/entity-service.types';
import { ModifiableRuntime } from '../../game/modifiable-runtime';
import { Action } from '../../components/action';
import { TestEntityA } from '../../game/game.spec.types';
import { entityId } from '../../components/entity';
import { handler, playerId, playerInterfaceMarker } from '../..';

describe('StateService', () => {
  let service: StateService;

  const logger: Logger = {
    log: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {}),
  };

  const player: PlayerEntity = {
    [playerInterfaceMarker]: true,
    $type: 'PlayerEntity',
    toString: () => 'PlayerEntity',
    visibility: () => ({}),
    [entityId]: 'my-player',
    [handler]: {
      state: mock(() => {}),
      prompt: () => {},
    },
  };

  beforeEach(() => {
    service = new StateService(logger);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('prompt', () => {
    test('throws an error if no choices were provided.', () => {
      // GIVEN / WHEN / THEN
      expect(() => service.promptPlayer({} as PlayerEntity, [])).toThrowError(
        /no choices/gi,
      );
    });
  });

  describe('clone', () => {
    test('the cloned service has the same initial status as the original.', () => {
      // GIVEN / WHEN
      const clone = service.clone();

      // THEN
      expect(clone.status()).toBe('setup');
      expect(clone.endStatus()).toBeUndefined();
      expect(service.status()).toBe('setup');
      expect(service.endStatus()).toBeUndefined();
    });

    test('the clone always starts in setup status, regardless of the original status.', () => {
      // GIVEN — clones must always start as 'setup' so that _start() is called when
      // player callbacks are registered, which is required for MCTS simulations to run.
      service.setStatus('running');

      // WHEN
      const clone = service.clone();

      // THEN
      expect(clone.status()).toBe('setup');
      expect(service.status()).toBe('running');
    });

    test('the cloned service preserves end parameters from the original.', () => {
      // GIVEN
      const endParams = { winners: [], losers: [], draws: [] };
      service.setStatus('ended');
      service.setEndParameters(endParams);

      // WHEN
      const clone = service.clone();

      // THEN — status is reset to 'setup'; end parameters are preserved
      expect(clone.status()).toBe('setup');
      expect(clone.endStatus()).toEqual(endParams);
      expect(service.status()).toBe('ended');
      expect(service.endStatus()).toEqual(endParams);
    });

    test('changing the status on the clone does not affect the original.', () => {
      // GIVEN
      service.setStatus('running');
      const clone = service.clone();

      // WHEN
      clone.setStatus('ended');

      // THEN
      expect(service.status()).toBe('running');
      expect(clone.status()).toBe('ended');
    });

    test('changing the status on the original after cloning does not affect the clone.', () => {
      // GIVEN
      service.setStatus('running');
      const clone = service.clone();

      // WHEN
      service.setStatus('ended');

      // THEN — clone is always 'setup' initially; further mutations to original don't affect it
      expect(clone.status()).toBe('setup');
      expect(service.status()).toBe('ended');
    });

    test('the cloned service preserves the snapshot depth from the original.', async () => {
      // GIVEN — simulate depth by calling execute (which pushes to pastSnapshots).
      // Each top-level execute must settle (its apply must resolve and the action
      // pop off the execution stack) before the next one starts, mirroring how the
      // engine always awaits an execute before driving the next top-level action.
      const action: Action<string, any, any> = {
        $type: 'dummy',
        apply: async () => {},
        parameters: {},
        returned: () => undefined,
      } as any;
      await service.execute(action, {} as ModifiableRuntime);
      await service.execute(action, {} as ModifiableRuntime);

      // WHEN
      const clone = service.clone();

      // THEN
      expect(clone.depth()).toBe(2);
      expect(service.depth()).toBe(2);
    });
  });

  describe('markDirty', () => {
    test('when an entity is marked dirty with update type "created", it is saved in its entirety.', () => {
      // GIVEN
      const entity = new TestEntityA(1);

      // WHEN
      service.markDirty(entity, 'created');

      // THEN
      service.informPlayer(player);

      expect(player[handler]!.state).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            dirtyEntities: {
              [entity[entityId]]: entity,
            },
          }),
        ]),
      );
    });

    test('when an entity is marked dirty with update type "updated", it is saved in its entirety.', () => {
      // GIVEN
      const entity = new TestEntityA(1);

      // WHEN
      service.markDirty(entity, 'updated');

      // THEN
      service.informPlayer(player);

      expect(player[handler]!.state).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            dirtyEntities: {
              [entity[entityId]]: entity,
            },
          }),
        ]),
      );
    });

    test('when an entity is marked dirty with update type "deleted", "null" is saved for it.', () => {
      // GIVEN
      const entity = new TestEntityA(1);

      // WHEN
      service.markDirty(entity, 'deleted');

      // THEN
      service.informPlayer(player);

      expect(player[handler]!.state).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            dirtyEntities: {
              [entity[entityId]]: null,
            },
          }),
        ]),
      );
    });
  });

  describe('informPlayer', () => {
    test('applies the visibility function of entities before sending them to the player.', () => {
      // GIVEN
      const player1: PlayerEntity = {
        ...player,
        [playerId]: 'player1',
        [handler]: {
          state: mock(() => {}),
          prompt: () => {},
        },
        visibility: () => ({}),
      };
      const player2: PlayerEntity = {
        ...player,
        [playerId]: 'player2',
        [handler]: {
          state: mock(() => {}),
          prompt: () => {},
        },
        visibility: () => ({}),
      };

      class DummyEntity extends TestEntityA {
        public readonly value = 0;
        public override visibility(p: PlayerEntity): Partial<this> {
          if (p[playerId] === 'player1') {
            return { ...this, value: 1 };
          }
          return { ...this, value: 2 };
        }
      }

      // WHEN
      service.markDirty(new DummyEntity(1), 'created');
      service.informPlayer(player1);
      service.informPlayer(player2);

      // THEN
      expect(player1[handler]!.state).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            dirtyEntities: {
              'testentityA-1': expect.objectContaining({ value: 1 }),
            },
          }),
        ]),
      );
      expect(player2[handler]!.state).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            dirtyEntities: {
              'testentityA-1': expect.objectContaining({ value: 2 }),
            },
          }),
        ]),
      );
    });

    test('when the player has no handler registered, it logs an error and does not call state.', () => {
      // GIVEN — a player without a registered handler (e.g. disconnected)
      // @ts-expect-error intentionally omit handler to simulate disconnected player
      const disconnectedPlayer: PlayerEntity = {
        ...player,
        [handler]: undefined,
      };

      // WHEN
      service.informPlayer(disconnectedPlayer);

      // THEN — error is logged, state is never called on anything
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/disconnect/i),
      );
    });
  });
});
