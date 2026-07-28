/** Run Grok's reference solution to compute expecteds, then emit a pass + harness file. */

import { executePython } from "../../services/python";
import type { PracticeFile } from "./practiceFile";

export type SealOk = { ok: true; file: PracticeFile };
export type SealErr = { ok: false; error: string };
export type SealResult = SealOk | SealErr;

type RunnerPayload = {
  ok: boolean;
  error?: string;
  fileName?: string;
  kind?: "function" | "class";
  fnName?: string;
  signature?: string;
  className?: string;
  methods?: Array<{ name: string; signature: string }>;
  classSource?: string;
  preamble?: string;
  cases?: unknown[][];
  results?: unknown[];
};

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Convert a JSON value to a Python literal. */
export function toPythonLiteral(value: unknown): string {
  if (value === null) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "None";
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => toPythonLiteral(item)).join(", ")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([k, v]) => `${toPythonLiteral(k)}: ${toPythonLiteral(v)}`,
    );
    return `{${entries.join(", ")}}`;
  }
  return "None";
}

function syncExamples(preamble: string, exampleLines: string[]): string {
  let header = preamble.trimEnd();
  if (/Examples?:/i.test(header)) {
    header = header.replace(
      /Examples?:[\s\S]*?(?="""|'''|$)/i,
      `Examples:\n${exampleLines.join("\n\n")}\n\n`,
    );
  } else if (/"""\s*$/.test(header) || /'''\s*$/.test(header)) {
    header = header.replace(
      /("""|''')\s*$/,
      `\n\nExamples:\n${exampleLines.join("\n\n")}\n$1`,
    );
  }
  return header;
}

/** Drop solution imports from sealed stubs (keep typing / from __future__). */
export function stripSolutionImports(preamble: string): string {
  return preamble
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!/^(import|from)\s+/.test(t)) return true;
      if (/^from\s+__future__\b/.test(t)) return true;
      if (/^from\s+typing\b/.test(t) || /^import\s+typing\b/.test(t))
        return true;
      return false;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

/** Pure rebuild: pass stub + sealed test_cases harness (function problems). */
export function rebuildSealedContent(options: {
  fileName: string;
  preamble: string;
  fnName: string;
  signature: string;
  cases: unknown[][];
  results: unknown[];
}): string {
  const { fileName, preamble, fnName, signature, cases, results } = options;
  if (cases.length === 0) throw new Error("CASES is empty");
  if (cases.length !== results.length) {
    throw new Error("CASES/results length mismatch");
  }

  const exampleLines = cases.slice(0, 3).map((args, i) => {
    const call =
      args.length === 1
        ? `${fnName}(${toPythonLiteral(args[0])})`
        : `${fnName}(${args.map((a) => toPythonLiteral(a)).join(", ")})`;
    return `Example ${i + 1}:\n    Input:  ${call}\n    Output: ${toPythonLiteral(results[i])}`;
  });

  const header = syncExamples(stripSolutionImports(preamble), exampleLines);
  const caseLines = cases.map((args, i) => {
    const parts = [
      ...args.map((a) => toPythonLiteral(a)),
      toPythonLiteral(results[i]),
    ];
    return `        (${parts.join(", ")}),`;
  });

  const multi = Math.max(...cases.map((c) => c.length), 0) > 1;
  const harness = multi
    ? `if __name__ == "__main__":
    test_cases = [
${caseLines.join("\n")}
    ]
    passed = 0
    for i, row in enumerate(test_cases, 1):
        *inp, expected = row
        try:
            result = ${fnName}(*inp)
            if result == expected:
                print(f"Test {i}: PASS")
                passed += 1
            else:
                print(f"Test {i}: FAIL (got {result!r}, expected {expected!r})")
        except Exception as e:
            print(f"Test {i}: FAIL ({e})")
    print(f"{passed}/{len(test_cases)} tests passed")
`
    : `if __name__ == "__main__":
    test_cases = [
${caseLines.join("\n")}
    ]
    passed = 0
    for i, (inp, expected) in enumerate(test_cases, 1):
        try:
            result = ${fnName}(inp)
            if result == expected:
                print(f"Test {i}: PASS")
                passed += 1
            else:
                print(f"Test {i}: FAIL (got {result!r}, expected {expected!r})")
        except Exception as e:
            print(f"Test {i}: FAIL ({e})")
    print(f"{passed}/{len(test_cases)} tests passed")
`;

  const body = `${header}

def ${signature}:
    pass


${harness}`;

  const withFile = body.startsWith("# FILE:")
    ? body
    : `# FILE: ${fileName}\n${body}`;
  return withFile.trimEnd() + "\n";
}

/** Rebuild for design/class problems (ops + args lists). */
export function rebuildSealedClassContent(options: {
  fileName: string;
  preamble: string;
  className: string;
  methods: Array<{ name: string; signature: string }>;
  cases: unknown[][];
  results: unknown[];
}): string {
  const { fileName, preamble, className, methods, cases, results } = options;
  if (cases.length === 0) throw new Error("CASES is empty");
  if (cases.length !== results.length) {
    throw new Error("CASES/results length mismatch");
  }

  const exampleLines = cases.slice(0, 2).map((row, i) => {
    const ops = row[0];
    const args = row[1];
    return `Example ${i + 1}:\n    Input:  ops=${toPythonLiteral(ops)}, args=${toPythonLiteral(args)}\n    Output: ${toPythonLiteral(results[i])}`;
  });
  const header = syncExamples(stripSolutionImports(preamble), exampleLines);

  const methodBlocks = methods
    .map((m) => {
      if (m.name === "__init__") {
        return `    def ${m.signature}:\n        pass`;
      }
      return `    def ${m.signature}:\n        pass`;
    })
    .join("\n\n");

  const caseLines = cases.map((row, i) => {
    const ops = row[0];
    const args = row[1];
    return `        (${toPythonLiteral(ops)}, ${toPythonLiteral(args)}, ${toPythonLiteral(results[i])}),`;
  });

  const harness = `if __name__ == "__main__":
    # Design problem: each case is (ops, args, expected_outputs)
    test_cases = [
${caseLines.join("\n")}
    ]
    passed = 0
    for i, (ops, args, expected) in enumerate(test_cases, 1):
        try:
            obj = None
            got = []
            for op, arg in zip(ops, args):
                if op == ${JSON.stringify(className)}:
                    obj = ${className}(*arg)
                    got.append(None)
                else:
                    got.append(getattr(obj, op)(*arg))
            if got == expected:
                print(f"Test {i}: PASS")
                passed += 1
            else:
                print(f"Test {i}: FAIL (got {got!r}, expected {expected!r})")
        except Exception as e:
            print(f"Test {i}: FAIL ({e})")
    print(f"{passed}/{len(test_cases)} tests passed")
`;

  const body = `${header}

class ${className}:
${methodBlocks || "    pass"}


${harness}`;

  const withFile = body.startsWith("# FILE:")
    ? body
    : `# FILE: ${fileName}\n${body}`;
  return withFile.trimEnd() + "\n";
}

const SEAL_PY = `
import ast
import base64
import json
import re
import sys

SOURCE = base64.b64decode(SOURCE_B64).decode("utf-8")
FILE_NAME = base64.b64decode(NAME_B64).decode("utf-8")


def is_main_guard(node):
    if not isinstance(node, ast.If):
        return False
    try:
        return ast.unparse(node.test).replace(" ", "") in (
            '__name__=="__main__"',
            "__name__=='__main__'",
        )
    except Exception:
        return False


def fail(msg):
    print(json.dumps({"ok": False, "error": msg}))
    sys.exit(0)


def to_jsonable(value):
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, tuple):
        return [to_jsonable(v) for v in value]
    if isinstance(value, list):
        return [to_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {str(k): to_jsonable(v) for k, v in value.items()}
    return repr(value)


def method_signature(node):
    try:
        sig = ast.unparse(node).splitlines()[0]
        if sig.startswith("async def "):
            return sig[len("async def "):].rstrip(":")
        if sig.startswith("def "):
            return sig[len("def "):].rstrip(":")
    except Exception:
        pass
    return node.name + "(self)"


try:
    tree = ast.parse(SOURCE)
except SyntaxError as e:
    fail("syntax error in reference file: " + str(e))

top = []
main_body = []
for node in tree.body:
    if is_main_guard(node):
        main_body.extend(node.body)
    else:
        top.append(node)

fn_defs = [n for n in top if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
class_defs = [n for n in top if isinstance(n, ast.ClassDef)]

ns = {"__name__": "practice_ref"}
mod = ast.Module(body=top, type_ignores=[])
try:
    exec(compile(mod, "<practice_ref>", "exec"), ns)
except Exception as e:
    fail("reference solution failed to load: " + str(e))

cases = None
for node in main_body:
    if isinstance(node, ast.Assign):
        for t in node.targets:
            if isinstance(t, ast.Name) and t.id == "CASES":
                try:
                    exec(
                        compile(
                            ast.Module(body=[node], type_ignores=[]),
                            "<cases>",
                            "exec",
                        ),
                        ns,
                    )
                    cases = ns.get("CASES")
                except Exception as e:
                    fail("CASES failed to evaluate: " + str(e))

if cases is None:
    fail("CASES missing under if __name__ == '__main__'")
if not isinstance(cases, (list, tuple)) or len(cases) == 0:
    fail("CASES must be a non-empty list")

src_lines = SOURCE.splitlines()
preamble_lines = []
for line in src_lines:
    if re.match(r"^(async\\s+)?def\\s+", line) or re.match(r"^class\\s+", line):
        break
    preamble_lines.append(line)
preamble = "\\n".join(preamble_lines).rstrip()
if not preamble.startswith("# FILE:"):
    preamble = "# FILE: " + FILE_NAME + "\\n" + preamble

# --- Class / design problems ---
if class_defs and not fn_defs:
    cls_node = class_defs[0]
    class_name = cls_node.name
    methods = []
    for item in cls_node.body:
        if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
            methods.append({
                "name": item.name,
                "signature": method_signature(item),
            })
    if not methods:
        fail("class has no methods")

    # Detect empty / stub-only class bodies
    for item in cls_node.body:
        if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
            body = [b for b in item.body if not isinstance(b, (ast.Pass, ast.Expr))]
            # allow docstring Expr + pass only as stub
            real = []
            for b in item.body:
                if isinstance(b, ast.Pass):
                    continue
                if isinstance(b, ast.Expr) and isinstance(getattr(b, "value", None), ast.Constant):
                    continue
                real.append(b)
            if item.name != "__init__" and not real:
                # still allow sealing if SOME method has real body — check later
                pass

    has_real = False
    for item in cls_node.body:
        if not isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for b in item.body:
            if isinstance(b, ast.Pass):
                continue
            if isinstance(b, ast.Expr) and isinstance(getattr(b, "value", None), ast.Constant):
                continue
            has_real = True
            break
        if has_real:
            break
    if not has_real:
        fail("reference class is only pass stubs — need a WORKING implementation to seal tests")

    Cls = ns.get(class_name)
    if Cls is None:
        fail("class not found: " + class_name)

    norm_cases = []
    results = []
    for i, case in enumerate(cases):
        # Accept (ops, args) or [ops, args]
        if isinstance(case, (list, tuple)) and len(case) == 2:
            ops, args = case[0], case[1]
        else:
            fail(
                "case "
                + str(i + 1)
                + ": design problems need CASES = [(ops, args), ...] where ops/args are parallel lists"
            )
        if not isinstance(ops, (list, tuple)) or not isinstance(args, (list, tuple)):
            fail("case " + str(i + 1) + ": ops and args must be lists")
        if len(ops) != len(args):
            fail("case " + str(i + 1) + ": ops/args length mismatch")
        ops = list(ops)
        args = [list(a) if isinstance(a, (list, tuple)) else [a] for a in args]
        norm_cases.append([ops, args])
        try:
            obj = None
            got = []
            for op, arg in zip(ops, args):
                if op == class_name:
                    obj = Cls(*arg)
                    got.append(None)
                else:
                    if obj is None:
                        fail("case " + str(i + 1) + ": first op must construct " + class_name)
                    got.append(getattr(obj, op)(*arg))
            results.append(got)
        except Exception as e:
            fail("case " + str(i + 1) + " raised: " + str(e))

    print(json.dumps({
        "ok": True,
        "kind": "class",
        "fileName": FILE_NAME,
        "className": class_name,
        "methods": methods,
        "preamble": preamble,
        "cases": [to_jsonable(c) for c in norm_cases],
        "results": [to_jsonable(r) for r in results],
        # placeholders so older parsers stay happy
        "fnName": class_name,
        "signature": class_name + "()",
    }))
    sys.exit(0)

# --- Function problems ---
if not fn_defs:
    fail("no function or class definition found")
fn_node = fn_defs[0]
fn_name = fn_node.name
signature = method_signature(fn_node)

# Reject pass-only functions
real_body = []
for b in fn_node.body:
    if isinstance(b, ast.Pass):
        continue
    if isinstance(b, ast.Expr) and isinstance(getattr(b, "value", None), ast.Constant):
        continue
    real_body.append(b)
if not real_body:
    fail("reference function is only pass — need a WORKING implementation to seal tests")

fn = ns.get(fn_name)
if not callable(fn):
    fail("entry function not found: " + fn_name)

norm_cases = []
results = []
for i, case in enumerate(cases):
    if isinstance(case, tuple):
        args = list(case)
    elif isinstance(case, list):
        args = list(case)
    else:
        args = [case]
    norm_cases.append(args)
    try:
        results.append(fn(*args))
    except Exception as e:
        fail("case " + str(i + 1) + " raised: " + str(e))

print(json.dumps({
    "ok": True,
    "kind": "function",
    "fileName": FILE_NAME,
    "fnName": fn_name,
    "signature": signature,
    "preamble": preamble,
    "cases": [to_jsonable(c) for c in norm_cases],
    "results": [to_jsonable(r) for r in results],
}))
`.trim();

/** Build the one-shot Python program that evaluates CASES via the reference solution. */
export function buildSealRunner(source: string, fileName: string): string {
  return (
    `SOURCE_B64 = ${JSON.stringify(utf8ToBase64(source))}\n` +
    `NAME_B64 = ${JSON.stringify(utf8ToBase64(fileName))}\n` +
    SEAL_PY
  );
}

export function parseSealStdout(stdout: string): SealResult {
  const text = stdout.trim();
  if (!text) {
    return { ok: false, error: "Sealer produced no output" };
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  let payload: RunnerPayload | null = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      payload = JSON.parse(lines[i]!) as RunnerPayload;
      break;
    } catch {
      /* keep looking */
    }
  }
  if (!payload) {
    return { ok: false, error: "Sealer returned invalid JSON" };
  }
  if (!payload.ok) {
    return {
      ok: false,
      error: payload.error || "Failed to seal practice tests",
    };
  }
  if (
    !payload.fileName ||
    !payload.preamble ||
    !payload.cases ||
    !payload.results
  ) {
    return { ok: false, error: "Sealer returned incomplete payload" };
  }

  try {
    if (payload.kind === "class") {
      if (!payload.className || !payload.methods?.length) {
        return { ok: false, error: "Sealer returned incomplete class payload" };
      }
      const content = rebuildSealedClassContent({
        fileName: payload.fileName,
        preamble: payload.preamble,
        className: payload.className,
        methods: payload.methods,
        cases: payload.cases,
        results: payload.results,
      });
      return { ok: true, file: { fileName: payload.fileName, content } };
    }

    if (!payload.fnName || !payload.signature) {
      return {
        ok: false,
        error: "Sealer returned incomplete function payload",
      };
    }
    const content = rebuildSealedContent({
      fileName: payload.fileName,
      preamble: payload.preamble,
      fnName: payload.fnName,
      signature: payload.signature,
      cases: payload.cases,
      results: payload.results,
    });
    return { ok: true, file: { fileName: payload.fileName, content } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function sealPracticeFile(
  practice: PracticeFile,
  runPython: typeof executePython = executePython,
): Promise<SealResult> {
  if (!/\bCASES\s*=/.test(practice.content)) {
    return {
      ok: false,
      error:
        "Practice file needs CASES = [(...), ...] (inputs only). Ask invent / easy again.",
    };
  }

  const runner = buildSealRunner(practice.content, practice.fileName);
  try {
    const result = await runPython(runner, "run");
    if (result.stderr?.trim() && !result.stdout?.trim()) {
      return {
        ok: false,
        error: result.stderr.trim().slice(0, 400),
      };
    }
    const sealed = parseSealStdout(result.stdout ?? "");
    if (!sealed.ok && result.stderr?.trim()) {
      return {
        ok: false,
        error: `${sealed.error} — ${result.stderr.trim().slice(0, 240)}`,
      };
    }
    return sealed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
