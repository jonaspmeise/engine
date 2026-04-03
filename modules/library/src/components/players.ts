import { Game } from '../game';
import { PlayerInterfaceCallback } from '../game.types';

export namespace Players {
  // TODO: This file is growing. Refactor to different type somewhere else?
  export const randomChickenPlayer: (
    delay?: () => number,
  ) => PlayerInterfaceCallback =
    (delay: () => number = () => 0) =>
    (_, choices, execute) => {
      // This player does only take random choices...
      if (choices.length > 0) {
        setTimeout(() => {
          const choice = choices[Math.floor(Math.random() * choices.length)]!;
          execute(choice);
        }, delay());
      }
    };

  export const mctsPlayer: (game: Game<any>) => PlayerInterfaceCallback =
    () => (_, choices, execute) => {};
}
