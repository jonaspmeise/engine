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

describe('StateService', () => {
  let service: StateService;

  const logger: Logger = {
    log: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {}),
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

    test('the cloned service preserves the snapshot depth from the original.', () => {
      // GIVEN — simulate depth by calling execute (which pushes to pastSnapshots)
      const action: Action<string, any, any> = {
        $type: 'dummy',
        apply: () => {},
        parameters: {},
        returned: () => undefined,
      } as any;
      service.execute(action, {} as ModifiableRuntime);
      service.execute(action, {} as ModifiableRuntime);

      // WHEN
      const clone = service.clone();

      // THEN
      expect(clone.depth()).toBe(2);
      expect(service.depth()).toBe(2);
    });
  });
});
