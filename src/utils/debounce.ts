export type Debounced<T extends (...args: never[]) => void> = T & {
  cancel: () => void;
  flush: () => void;
};

export function debounce<T extends (...args: never[]) => void>(
  callback: T,
  delayMs: number,
): Debounced<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let latestArgs: Parameters<T> | undefined;

  const run = (() => {
    if (!latestArgs) return;
    callback(...latestArgs);
    latestArgs = undefined;
  }) as () => void;

  const debounced = ((...args: Parameters<T>) => {
    latestArgs = args;
    clearTimeout(timeout);
    timeout = setTimeout(run, delayMs);
  }) as T;

  return Object.assign(debounced, {
    cancel: () => {
      clearTimeout(timeout);
      latestArgs = undefined;
    },
    flush: () => {
      clearTimeout(timeout);
      run();
    },
  });
}
