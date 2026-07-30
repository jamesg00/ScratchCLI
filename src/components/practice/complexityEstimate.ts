export type ComplexityEstimate = {
  time: string;
  space: string;
  note: string;
};

/** Conservative static estimate for the local submit report. */
export function estimatePythonComplexity(source: string): ComplexityEstimate {
  const loopIndents: number[] = [];
  let maxLoopDepth = 0;
  let usesLinearStorage = false;

  for (const line of source.split(/\r?\n/)) {
    const code = line.replace(/#.*/, "");
    const indent = code.match(/^\s*/)?.[0].length ?? 0;
    while (loopIndents.at(-1) != null && loopIndents.at(-1)! >= indent) {
      loopIndents.pop();
    }
    if (/^\s*(for|while)\b/.test(code)) {
      loopIndents.push(indent);
      maxLoopDepth = Math.max(maxLoopDepth, loopIndents.length);
    }
    if (/\b(set|dict|defaultdict|Counter|deque)\s*\(|\[[^\]]*for\b|\.append\(/.test(code)) {
      usesLinearStorage = true;
    }
  }

  const time =
    maxLoopDepth === 0
      ? "O(1)"
      : maxLoopDepth === 1
        ? "O(n)"
        : `O(n^${maxLoopDepth})`;
  return {
    time,
    space: usesLinearStorage ? "O(n)" : "O(1)",
    note:
      maxLoopDepth === 0
        ? "No explicit loop was found; verify recursion or library calls manually."
        : `Estimated from ${maxLoopDepth} nested explicit loop${maxLoopDepth === 1 ? "" : "s"}.`,
  };
}
