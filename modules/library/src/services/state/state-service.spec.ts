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
});
