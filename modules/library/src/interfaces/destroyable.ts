export interface Destroyable {
  // TODO: Only allow this for entities (or whatever other components).
  // TODO: Give the according services a Destroyer<Component> which they can use to destroy anything with.
  // TODO: Run sanity checks after destroying a component (e.g. destroying the only positive rule, ...).
}
