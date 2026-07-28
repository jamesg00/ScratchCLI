export type TestCaseResult = {
  label: string;
  passed: boolean;
  line?: number;
};

export type TestRunSummary = {
  passed: number;
  total: number;
  cases: TestCaseResult[];
  raw: string;
};

/** Parse PASS/FAIL style practice output into a summary. */
export function parseTestOutput(raw: string): TestRunSummary | null {
  const lines = raw.split(/\r?\n/);
  const cases: TestCaseResult[] = [];
  let passed = 0;
  let total = 0;

  for (const line of lines) {
    const summary = line.match(/\b(\d+)\s*\/\s*(\d+)\b/);
    if (summary && /pass|fail|ok|tests?/i.test(line)) {
      passed = Number(summary[1]);
      total = Number(summary[2]);
    }
    const fail = line.match(/\bFAIL\b\s*[:-]?\s*(.*)$/i);
    if (fail) {
      cases.push({ label: fail[1]?.trim() || "case", passed: false });
    }
    const ok = line.match(/\bPASS\b\s*[:-]?\s*(.*)$/i);
    if (ok) {
      cases.push({ label: ok[1]?.trim() || "case", passed: true });
    }
  }

  if (total === 0 && cases.length > 0) {
    total = cases.length;
    passed = cases.filter((c) => c.passed).length;
  }

  if (total === 0 && passed === 0 && cases.length === 0) {
    return null;
  }

  return { passed, total: total || cases.length, cases, raw };
}

export function looksLikePracticeFile(content: string): boolean {
  return (
    /if\s+__name__\s*==\s*["']__main__["']/.test(content) ||
    /#\s*FILE:/i.test(content) ||
    /\bPASS\b/.test(content)
  );
}
