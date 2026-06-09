/// <reference lib="dom" />
import { describe, test, expect } from 'bun:test';
import { Action, type QueryableRuntime } from '@my-engine/library';
import { Client } from './client';
import type { ChoiceTypeMapping } from './client.types';
import { TestPlayerEntity } from '../../library/src/game/game.spec.types';

class SlowAction extends Action<'SLOW'> {
  public $type: 'SLOW' = 'SLOW';
  async doApply(_runtime: QueryableRuntime): Promise<void> {}
}

class FastAction extends Action<'FAST'> {
  public $type: 'FAST' = 'FAST';
  async doApply(_runtime: QueryableRuntime): Promise<void> {}
}

type ProbeActions = SlowAction | FastAction;

/** Records the order in which executed snapshots finish animating; the SLOW
 *  action's animation takes a while, like a card-play fly-in. */
class OrderProbeClient extends Client<HTMLElement, ProbeActions> {
  public processed: string[] = [];

  public choiceTypeMapping: ChoiceTypeMapping<ProbeActions> = {
    SLOW: { render: async () => {}, erase: async () => {} },
    FAST: { render: async () => {}, erase: async () => {} },
  };

  protected override async animateBefore(choice: ProbeActions): Promise<void> {
    if (choice.$type === 'SLOW') {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  protected override async animateAfter(choice: ProbeActions): Promise<void> {
    this.processed.push(choice.$type);
  }

  protected render(): void {}
}

describe('Client.feedSnapshots ordering', () => {
  // Snapshot batches must process strictly in arrival order even when fed
  // concurrently: a slow animation in an earlier batch (e.g. a card being
  // played) has to finish before a later batch's effects render/animate —
  // otherwise an effect (victory, conquer flare, …) appears before the play
  // animation that caused it completes.
  test('a later batch waits for an earlier batch with a slow animation', async () => {
    const client = new OrderProbeClient(
      document.createElement('div'),
      {},
      new TestPlayerEntity(1),
    );

    const slow = client.feedSnapshots([
      { dirtyEntities: {}, executed: new SlowAction() },
    ]);
    const fast = client.feedSnapshots([
      { dirtyEntities: {}, executed: new FastAction() },
    ]);
    await Promise.all([slow, fast]);

    expect(client.processed).toEqual(['SLOW', 'FAST']);
  });
});
