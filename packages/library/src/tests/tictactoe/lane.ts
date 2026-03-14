import { Entity } from "../../entity";
import { EntityID } from "../../entity.types";
import { Slot } from "./slot";
import { LaneAlignment, TicTacToeState } from "./tictactoe.typed";

export class Lane extends Entity<TicTacToeState> {
    constructor(
        public readonly alignment: LaneAlignment,
        public readonly index: number,
        engine: RuntimeEngine<TicTacToeState, any>
    ) {
        super('lane', engine);
    }

    public slots(): Set<Slot> {
        this.engine;
    }

    public persist(state: TicTacToeState): void {
        // Do nothing, because this class is purely ergonomic and does _not_ have any
        // non-readonly properties.
    }
    public identify = (): EntityID => `lane-${this.alignment}-${this.index}`;

}