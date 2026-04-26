import { StearthhoneCard, StearthhoneRarity } from './StearthhoneCard';
import { StearthhonePlayer } from './StearthhonePlayer';
import { StearthhonePrototypeMinion } from './StearthhonePrototypeMinion';
import { StearthhoneZone } from './StearthhoneZone';

export class StearthhoneMinion extends StearthhoneCard {
  public $type = 'StoneMinion';

  public attacksRemainingThisTurn: number = 0;
  public properties = {
    taunt: false,
    divineShield: false,
    windfury: false,
    charge: false,
    lifesteal: false,
    canAttack: true,
  };
  public readonly stats: {
    health: number;
    attack: number;
    cost: number;
  };

  public pendingDeath: boolean = false;

  constructor(
    id: string,
    owner: StearthhonePlayer,
    controller: StearthhonePlayer,
    position: number,
    location: StearthhoneZone,
    cost: number,
    rarity: StearthhoneRarity,
    // Unlike spells, minions are mutable (atleast in our version).
    public readonly source: StearthhonePrototypeMinion,
  ) {
    super(id, owner, controller, source.name, position, location, cost, rarity);
    {
      this.stats = {
        health: source.health,
        attack: source.attack,
        cost: source.cost,
      };
    }
  }

  public isDead(): boolean {
    return this.stats.health <= 0;
  }
}
