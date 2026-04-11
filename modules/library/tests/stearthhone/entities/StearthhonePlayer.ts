import { Entity, entityId } from '@my-engine/library';
export class StearthhonePlayer extends Entity {
  public $type: string = 'Player';

  public mana = 0;
  public maxMana = 0;

  public toString(): string {
    return `Player ${this[entityId]}`;
  }
}
