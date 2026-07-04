import { describe, test, expect } from 'bun:test';
import { Action } from '../components/action';
import { Entity, entityId } from '../components/entity';
import { Graph } from '../components/graph/graph';
import { QueryableRuntime } from './queryable-runtime';
import { Class, EntityClass } from './game.types';
import { jsonRoundtrip, timeout } from '../utility.spec';
import { TestGame, TestPlayerEntity } from './game.spec.types';

/**
 * C3 integration coverage: an action whose doApply mutates an entity's
 * collection via a mutating method (e.g. `entity.list.push(x)`) must produce a
 * client-visible delta — i.e. the collection mutation has to flush the root
 * entity to the snapshot, exactly like a direct property assignment would.
 */
class ListEntity extends Entity {
  public static readonly $type: string = 'ListEntity';
  public $type: string = 'ListEntity';
  public list: string[] = [];

  constructor(_id: number) {
    super(`listEntity-${_id}`);
  }

  public toString(): string {
    return 'ListEntity';
  }
}

class PushToListAction extends Action<
  'PushToListAction',
  { id: string; value: string }
> {
  public $type: 'PushToListAction' = 'PushToListAction';

  async doApply(runtime: QueryableRuntime): Promise<void> {
    const entity = runtime
      .entities(ListEntity)
      .find((e) => e[entityId] === this.parameters.id)!;
    entity.list.push(this.parameters.value);
  }
}

describe('collection mutation reaches the client (C3)', () => {
  test('an action doApply that pushes onto an entity list produces a client-visible delta.', (done) => {
    // GIVEN
    const emitted: Array<Record<string, { list?: string[] }>> = [];
    let initialSeen = false;

    class DummyGame extends TestGame {
      initialize(): Set<Entity> {
        return new Set<Entity>([new TestPlayerEntity(1), new ListEntity(1)]);
      }

      rawGraph(): Graph<'INITIAL'> {
        return {
          INITIAL: async (runtime) => {
            // WHEN — the action mutates the list via a mutating method.
            await runtime.execute(
              new PushToListAction({ id: 'listEntity-1', value: 'shard' }),
            );

            setTimeout(() => {
              // THEN — the pushed value reaches the client in a snapshot.
              const lists = emitted
                .flatMap((snapshot) => Object.entries(snapshot))
                .filter(([id]) => id === 'listEntity-1')
                .map(([, entity]) => entity?.list);

              expect(lists).toContainEqual(['shard']);

              done();
            }, 5);
          },
        };
      }

      entityClasses(): Set<EntityClass<Entity>> {
        return new Set<EntityClass<Entity>>([ListEntity, TestPlayerEntity]);
      }

      actionClasses(): Set<Class<Action<string, any, any>>> {
        return new Set<Class<Action<string, any, any>>>([PushToListAction]);
      }
    }

    const game = new DummyGame();
    game
      .registerPlayerCallback(game.entities(TestPlayerEntity)[0]!, {
        prompt: () => {},
        state: (snapshots) => {
          for (const snapshot of snapshots) {
            // The initial full-state snapshot is not relevant to this test.
            if (!initialSeen) {
              initialSeen = true;
              continue;
            }
            emitted.push(jsonRoundtrip(snapshot.dirtyEntities));
          }
        },
      })
      .catch(done);

    timeout(done, 50);
  });
});
