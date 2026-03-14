import { dirty, EntityID } from "./entity.types";
import { GameState } from "./game.types";

export abstract class Entity<STATE extends GameState> {
    public readonly id: EntityID;
    public [dirty]: boolean = false;

    constructor(
        public readonly type: string,
        private readonly engine: Engine<STATE, any>;
    ) {
        this.id = this.identify();
    }

    abstract persist(state: STATE): void;
    abstract identify(): EntityID;
}