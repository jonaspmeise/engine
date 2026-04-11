import { StearthhoneRarity } from './StearthhoneCard';

export class StearthhonePrototypeMinion {
  constructor(
    public readonly name: string,
    public readonly health: number,
    public readonly attack: number,
    public readonly cost: number,
    public readonly rarity: StearthhoneRarity,
  ) {}
}
