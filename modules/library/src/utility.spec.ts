export const timeout = (done: (err: Error) => void, ms: number = 10) => {
  setTimeout(() => {
    done(new Error(`Test timed out after ${ms} ms!`));
  }, ms);
};

export const jsonRoundtrip = (obj: unknown): any =>
  JSON.parse(JSON.stringify(obj));
