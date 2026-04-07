import { Entity } from '@my-engine/library';
import { StearthhoneEntity } from './StearthhoneEntity';

export class StearthhoneMinion extends StearthhoneEntity {
  public $type = 'StoneMinion';

  public readonly basePrototypeCard: StearthhoneMinionCard;

  /** Combat stats are different from the base prototype card! */
  public attack: number;

  /** Board position among this owner's minions (0-indexed). */
  public boardPosition: number = 0;

  // Combat flags
  public canAttackThisTurn: boolean = false; // false until start of next turn (summoning sickness)
  public attacksRemainingThisTurn: number = 0;

  // Keywords
  public hasTaunt: boolean = false;
  public hasDivineShield: boolean = false;
  public hasWindfury: boolean = false;
  public hasCharge: boolean = false; // can attack same turn as summoned
  public hasLifesteal: boolean = false;

  /** True once health drops to 0 or below — processed by death-check trigger. */
  public pendingDeath: boolean = false;

  /** Copied from card.cantAttack at summon. Can be reset by silence. */
  public cantAttack: boolean = false;

  constructor(
    id: string,
    public readonly owner: StoneHero,
    /** The card this minion was created from. */
    public readonly sourceCard: StoneCard,
    base: MinionCard,
  ) {
    super(id);
    this.attack = base.attack;
    this.health = base.health;
    this.maxHealth = base.health;
  }

  public isDead(): boolean {
    return this.health <= 0;
  }

  public toString(): string {
    return `${this.sourceCard.base.name} (${this.attack}/${this.health})`;
  }

  public static fromCard(
    card: StoneCard,
    boardPosition: number,
  ): StearthhoneMinion {
    return new StearthhoneMinion({ card, boardPosition });
  }
}
