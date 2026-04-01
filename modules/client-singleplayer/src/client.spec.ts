/// <reference lib="dom" />
import { describe, test, mock, beforeEach, jest, expect } from 'bun:test';
import { Client } from './client';
import { QueryableRuntime, Snapshot } from '@my-engine/library';

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
}

describe('client', () => {
  let client: Client;

  beforeEach(() => {
    client = new DummyClient(element);
    jest.clearAllMocks();
  });

  describe('lifecycle', () => {
    test('feed method calls render into animate for a single snapshot.', async () => {
      // GIVEN
      const snapshots: Snapshot[] = [
        {
          dirtyEntities: {
            'entity-1': {
              $type: 'TestEntity',
            },
          },
        },
      ];

      // WHEN
      await client.feed(snapshots, [], () => {});

      // THEN
      expect(render).toHaveBeenCalled();
      expect(animate).toHaveBeenCalled();
    });

    test('feed method calls render into animate for multiple snapshots.', async () => {
      // GIVEN
      const snapshots: Snapshot[] = [
        {
          dirtyEntities: {
            'entity-1': {
              $type: 'TestEntity',
            },
          },
        },
        {
          dirtyEntities: {
            'entity-1': {
              $type: 'TestEntity',
            },
          },
        },
      ];

      // WHEN
      await client.feed(snapshots, [], () => {});

      // THEN
      expect(render).toHaveBeenCalledTimes(2);
      expect(animate).toHaveBeenCalledTimes(2);
    });
  });
});
