import { entityId, QueryableRuntime } from '../../../src';
import { StearthhoneCard } from './StearthhoneCard';
import { StearthhonePlayer } from './StearthhonePlayer';
import { StearthhoneZone } from './StearthhoneZone';
export class StearthhoneBoard extends StearthhoneZone {
  public $type: string = 'Board';

  public constructor(
    id: string,
    public readonly owner: StearthhonePlayer,
  ) {
    super(id);
  }

  public toString(): string {
    return `${this.owner}'s Board`;
  }

  public hasRoom(runtime: QueryableRuntime): boolean {
    return this.cards(runtime).length < 7;
  }

  public override cards(runtime: QueryableRuntime): StearthhoneCard[] {
    return super
      .cards(runtime)
      .filter((c) => c.controller[entityId] === this.owner[entityId]);
  }
}
