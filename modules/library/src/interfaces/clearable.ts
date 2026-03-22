export interface Clearable {
  /**
   * Clears the internal state of whatever implements this.
   * Useful for testing.
   */
  clear(): void;
}
