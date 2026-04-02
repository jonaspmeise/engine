/// <reference lib="dom" />
import { describe, test, mock, beforeEach, jest, expect } from 'bun:test';
import { Client } from './client';
import { TestGame } from '../../library/src/game.spec.types';
import {
  Action,
  Choice,
  PlayerEntity,
  QueryableRuntime,
  Snapshot,
} from '@my-engine/library';

const animate = mock(() => Promise.resolve());
const render = mock(() => {});
const element: HTMLElement = document.createElement('div');

class DummyClient extends Client {
  protected animate(): Promise<void> {
    return animate();
  }
  protected render(renderTarget: HTMLElement, runtime: QueryableRuntime): void {
    return render();
  }
  protected highlightStyle(): HTMLStyleElement {
    const style = document.createElement('style');
    // No highlighting needed here...
    return style;
  }
}

describe('client', () => {
  let client: Client;

  beforeEach(() => {
    client = new DummyClient(element, new TestGame());
    jest.clearAllMocks();
  });

  describe('lifecycle', () => {
    test('feed method calls render into animate for a single snapshot.', async () => {
      // GIVEN
      const snapshots: Snapshot[] = [
        {
          dirtyEntities: {
            'entity-1': {
              $type: 'TestEntityA',
            },
          },
        },
      ];

      // WHEN
      await client.feed(snapshots, [], () => {});

      // THEN
      expect(render).toHaveBeenCalled();
      // We did not provide a executed choice, so there is nothing to animate!
      expect(animate).not.toHaveBeenCalled();
    });

    test('feed method calls render into animate for multiple snapshots.', async () => {
      // GIVEN
      const snapshots: Snapshot[] = [
        {
          dirtyEntities: {
            'entity-1': {
              $type: 'TestEntityA',
            },
          },
        },
        {
          dirtyEntities: {
            'entity-1': {
              $type: 'TestEntityA',
            },
          },
          executed: new Choice({} as Action<any>, {} as PlayerEntity),
        },
      ];

      // WHEN
      await client.feed(snapshots, [], () => {});

      // THEN
      expect(render).toHaveBeenCalledTimes(2);
      // We only provided an executed choice in the second snapshot, so only this one should be animated.
      expect(animate).toHaveBeenCalledTimes(1);
    });

    // TODO: IMPORTANT: Write many tests for all other integrated components, including the UI (stuff like highlighting, ...)!
  });
});
