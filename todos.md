# Todos

- Make MCTS have a Proxy `MemoryPlayer` that replays all choices the player has done so far, if the player sees these choices again (maybe use choice-IDs for that?).
- Create an easy testing framework to build game-asserting test behaviors with.
- Refactor the `CheckAction`, `BeforeAction` and `AfterAction` so that they instead all can override a `hook(hooker)` method, where they can call `hooker.before(actionType, callback)`, `hooker.after(actionType, callback)` or `hooker.check(actionType, checkCallback)`.
- Test that snapshots are always sent before choices over a websocket.
- `choiceTypeMapping` does not enforce types...?
- `choiceTypeMapping` should pass the choice ID too!
- Refactor AI slop.
- `choiceTypeMapping` should allow for certain action types to share the same handler.
- Cache function calls on all entities for this snapshot. As long as state does not change, these functions don't need to be re-queried.
