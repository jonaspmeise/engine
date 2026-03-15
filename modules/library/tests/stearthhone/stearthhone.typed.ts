export type CardType = 'minion' | 'spell';

export type CardRarity = 'common' | 'rare' | 'epic' | 'legendary';

// The concept of a Card, which holds true outside the game, too.
export type BaseCard = {
  readonly name: string;
  readonly cost: number;
  readonly type: CardType;
  readonly rarity: CardRarity;
  readonly text: string | undefined;
};

export type MinionCard = BaseCard & {
  readonly type: 'minion';
  readonly attack: number;
  readonly health: number;
};

export type SpellCard = BaseCard & {
  readonly type: 'spell';
};

export type Card = MinionCard | SpellCard;

// The concept of a card, only within the game.
export type GameCard = Card & {
  readonly position: number; // The position in its zone.
  base: Readonly<Card>; // The base card.
};

export type HeroState = {
  health: number;
  maxMana: number;
  mana: number;
  deck: string[];
  hand: string[];
  currentPlayer: boolean;
};

export type StearthhoneState = {
  readonly heroes: HeroState[];
  readonly board: MinionCard[];
  readonly turn: number;
};
