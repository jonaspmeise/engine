import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  mock,
  test,
} from 'bun:test';
import { Entity, entityId } from '../../components/entity';
import { ViewFilter } from '../../components/view-filter';
import { Logger, Snapshot } from '../../game.types';
import {
  PlayerInterface,
  playerInterfaceMarker,
} from '../../interfaces/player-interface';
import { PlayerEntity } from '../entity/entity-service.types';
import { ViewFilterService } from './view-filter-service';

class TestEntity extends Entity {
  public $type: string = 'TestEntity';
  public visibleField: string = 'visible';
  public secretField: string = 'secret';

  constructor(id: string) {
    super(id);
  }
}

class TestPlayer extends Entity implements PlayerInterface {
  public $type: string = 'TestPlayer';

  [playerInterfaceMarker] = true as const;

  constructor(id: string) {
    super(id);
  }
}

class HideSecretFieldFilter extends ViewFilter {
  constructor(readonly player: PlayerEntity) {
    super();
  }

  apply<ENTITY extends Entity>(entity: ENTITY): ENTITY {
    if (entity instanceof TestEntity) {
      return { ...entity, secretField: null } as unknown as ENTITY;
    }
    return entity;
  }
}

describe('ViewFilterService', () => {
  let service: ViewFilterService;
  let player: TestPlayer;
  let entity: TestEntity;
  let logger: Logger = {
    log: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {}),
  };

  beforeEach(() => {
    service = new ViewFilterService(logger);
    player = new TestPlayer('player-1');
    entity = new TestEntity('entity-1');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createSnapshotFilter', () => {
    test('if no view filter is registered, the snapshot filter returns the identity.', () => {
      // GIVEN
      const snapshot: Snapshot = {
        dirtyEntities: { [entity[entityId]]: { ...entity } },
      };

      // WHEN
      const result = service.createSnapshotFilter(player)(snapshot);

      // THEN
      expect(result).toBe(snapshot);
    });

    test('after clearing the service, the snapshot filter returns the identity again.', () => {
      // GIVEN
      service.create(new HideSecretFieldFilter(player));
      const snapshot: Snapshot = {
        dirtyEntities: { [entity[entityId]]: { ...entity } },
      };
      service.clear();

      // WHEN
      const result = service.createSnapshotFilter(player)(snapshot);

      // THEN
      expect(result).toBe(snapshot);
    });
  });

  describe('destroy', () => {
    test('a registered view filter can be removed.', () => {
      // GIVEN
      const viewFilter = service.create(new HideSecretFieldFilter(player));
      const snapshot: Snapshot = {
        dirtyEntities: { [entity[entityId]]: { ...entity } },
      };

      // WHEN
      service.destroy(viewFilter);
      const result = service.createSnapshotFilter(player)(snapshot);

      // THEN
      expect(result).toBe(snapshot);
    });
  });

  describe('create', () => {
    test('when a view filter that is already registered is registered again, a warning is logged.', () => {
      // GIVEN
      const viewFilter = new HideSecretFieldFilter(player);
      service.create(viewFilter);

      // WHEN
      service.create(viewFilter);

      // THEN
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });
  });
});
