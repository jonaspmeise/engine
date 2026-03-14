import { Entity } from "./entity";
import { GameParameters, GameState } from "./game.types";

export abstract class Game<
    STATE extends GameState,
    PARAMETERS extends (GameParameters | undefined)
> {
    constructor(parameters: PARAMETERS) {
        this.initialize(parameters);
    }

    abstract initialize(parameters: PARAMETERS): STATE;
    abstract enrichen(state: STATE): Generator<Entity<STATE>, void, null>;
};