import { Entity } from "../../entity";
import { EntityID } from "../../entity.types";
import { Mark, TicTacToeState } from "./tictactoe.typed";

export class Slot extends Entity<TicTacToeState> {
    public mark: Mark | null = null;

    constructor(
        public readonly x: number,
        public readonly y: number
    ) {
        super('slot');
    }
    
    persist(state: TicTacToeState): void {
        state.board[this.y * 3 + this.x] = this.mark || null;
    }
    identify = (): EntityID => `slot-${this.x}-${this.y}`;
}