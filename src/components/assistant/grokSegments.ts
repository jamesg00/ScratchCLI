import { parseVizPlan, type VizPlan } from "./vizPlan";

export type GrokSegment =
  | { kind: "text"; text: string }
  | {
      kind: "code";
      lang: string;
      code: string;
      complete: boolean;
      important: boolean;
    }
  | {
      kind: "viz";
      raw: string;
      complete: boolean;
      plan: VizPlan | null;
    };

const FENCE_START = /^```([\w+-]*)(?:\s+([^\s`]+))?\s*$/;

function looksLikePython(code: string): boolean {
  return /^\s*(def |class |import |from |if __name__|print\(|async def )/m.test(
    code,
  );
}

function isVizFence(lang: string, meta: string): boolean {
  const tag = lang.trim().toLowerCase();
  const extra = meta.trim().toLowerCase();
  return (
    tag === "viz" ||
    tag === "visualize" ||
    extra === "viz" ||
    extra === "visualize"
  );
}

function resolveLang(raw: string, fallback: string, code: string): string {
  const tagged = raw.trim().toLowerCase();
  if (tagged === "py" || tagged === "python") return "python";
  if (tagged) return tagged;
  const prefer = fallback.trim().toLowerCase();
  if (prefer === "python" || prefer === "py") return "python";
  if (looksLikePython(code)) return "python";
  return prefer || "python";
}

/** Split assistant text into prose + fenced code/viz blocks (supports incomplete fences while streaming). */
export function parseGrokSegments(
  source: string,
  fallbackLanguage = "python",
): GrokSegment[] {
  const lines = source.split("\n");
  const segments: GrokSegment[] = [];
  let textBuf: string[] = [];
  let inCode = false;
  let codeLang = "";
  let codeMeta = "";
  let codeBuf: string[] = [];
  let asViz = false;

  const flushText = () => {
    if (textBuf.length === 0) return;
    const text = textBuf.join("\n");
    textBuf = [];
    if (text.length > 0) segments.push({ kind: "text", text });
  };

  const flushCode = (complete: boolean) => {
    const code = codeBuf.join("\n").replace(/\n$/, "");
    if (asViz) {
      segments.push({
        kind: "viz",
        raw: code,
        complete,
        plan: complete ? parseVizPlan(code) : null,
      });
    } else {
      const lang = resolveLang(codeLang, fallbackLanguage, code);
      const important =
        /\bimportant\b/i.test(codeMeta) || /\bimportant\b/i.test(codeLang);
      segments.push({ kind: "code", lang, code, complete, important });
    }
    codeBuf = [];
    codeLang = "";
    codeMeta = "";
    inCode = false;
    asViz = false;
  };

  for (const line of lines) {
    if (!inCode) {
      const open = line.match(FENCE_START);
      if (open) {
        flushText();
        inCode = true;
        codeLang = open[1] ?? "";
        codeMeta = open[2] ?? "";
        asViz = isVizFence(codeLang, codeMeta);
        codeBuf = [];
        continue;
      }
      textBuf.push(line);
      continue;
    }

    if (line.startsWith("```")) {
      flushCode(true);
      continue;
    }
    codeBuf.push(line);
  }

  if (inCode) {
    flushCode(false);
  } else {
    flushText();
  }

  return segments.length > 0 ? segments : [{ kind: "text", text: source }];
}
