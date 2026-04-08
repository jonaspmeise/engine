import { Entity } from '@my-engine/library';
import { StearthhoneZone } from './StearthhoneZone';
import { StearthhonePlayer } from './StearthhonePlayer';

export type StearthhoneRarity =
  | 'Token'
  | 'Common'
  | 'Rare'
  | 'Epic'
  | 'Legendary';

export abstract class StearthhoneCard extends Entity {
  constructor(
    id: string,
    public readonly owner: StearthhonePlayer,
    public readonly controller: StearthhonePlayer,
    public readonly name: string,
    public position: number,
    public location: StearthhoneZone,
    public cost: number,
    public readonly rarity: StearthhoneRarity,
  ) {
    super(id);
  }

  public toString(): string {
    return this.name;
  }
}
