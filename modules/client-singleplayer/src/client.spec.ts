/// <reference lib="dom" />
import { describe, test, mock, beforeEach, jest, expect } from 'bun:test';
import { Client } from './client';
import {
  TestEntityA,
  TestEntityB,
  TestEntityC,
  TestGame,
} from '../../library/src/game/game.spec.types';
import {
  Action,
  Choice,
  PlayerEntity,
  QueryableRuntime,
  Snapshot,
} from '@my-engine/library';

const animateBefore = mock(() => Promise.resolve());
const animateAfter = mock(() => Promise.resolve());
const render = mock(() => {});
const element: HTMLElement = document.createElement('div');

class DummyClient extends Client {
  protected animateBefore(): Promise<void> {
    return animateBefore();
  }
  protected animateAfter(): Promise<void> {
    return animateAfter();
  }
  protected render(
    _renderTarget: HTMLElement,
    _runtime: QueryableRuntime,
  ): void {
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
    client = new DummyClient(element, new TestGame(), {} as PlayerEntity);
    jest.clearAllMocks();
  });

  describe('lifecycle', () => {
    test.todo(
      'feed method calls render into animate for a single snapshot.',
      async () => {
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
        expect(animateBefore).not.toHaveBeenCalled();
        expect(animateAfter).not.toHaveBeenCalled();
      },
    );

    test.todo(
      'feed method calls render into animate for multiple snapshots.',
      async () => {
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
            executed: new Choice({} as Action<string, any>, {} as PlayerEntity),
          },
        ];

        // WHEN
        await client.feed(snapshots, [], () => {});

        // THEN
        expect(render).toHaveBeenCalledTimes(2);
        // We only provided an executed choice in the second snapshot, so only this one should be animated.
        expect(animateBefore).toHaveBeenCalledTimes(1);
        expect(animateAfter).toHaveBeenCalledTimes(1);
      },
    );

    // TODO: IMPORTANT: Write many tests for all other integrated components, including the UI (stuff like highlighting, ...)!
  });
});
