import type { VizStructureEdge, VizStructureNode, VizStructurePayload } from "./vizPlan";

type Props = {
  structure: VizStructurePayload;
};

type Point = { x: number; y: number };

const VIEW_W = 420;
const VIEW_H = 240;

function stateToColors(state?: string): { fill: string; stroke: string } {
  const s = (state ?? "").toLowerCase();
  if (!s) return { fill: "#4ea3ff", stroke: "#0b2b4a" };

  if (s.includes("active") || s.includes("cur") || s.includes("current")) {
    return { fill: "#ff4d4d", stroke: "#6b0b0b" };
  }
  if (s.includes("visited") || s.includes("done")) {
    return { fill: "#3ddc84", stroke: "#0f3a24" };
  }
  if (s.includes("frontier") || s.includes("queue") || s.includes("front")) {
    return { fill: "#ffcc00", stroke: "#5b3d00" };
  }
  if (s.includes("dim") || s.includes("deemphas")) {
    return { fill: "rgba(120,120,120,0.55)", stroke: "rgba(120,120,120,0.9)" };
  }
  if (s.includes("found") || s.includes("hit") || s.includes("target")) {
    return { fill: "#b86bff", stroke: "#3a1b5c" };
  }

  // Sensible fallback for unknown labels.
  return { fill: "#4ea3ff", stroke: "#0b2b4a" };
}

function edgeColor(edge: VizStructureEdge): string {
  const s = (edge.state ?? "").toLowerCase();
  if (!s) return "rgba(200,220,255,0.55)";
  if (s.includes("active") || s.includes("cur")) return "#ff4d4d";
  if (s.includes("visited") || s.includes("done")) return "#3ddc84";
  if (s.includes("front") || s.includes("frontier") || s.includes("queue")) return "#ffcc00";
  return "rgba(200,220,255,0.55)";
}

function computePositions(structure: VizStructurePayload): Map<string, Point> {
  const coordsProvided = structure.nodes.every(
    (n) => typeof n.x === "number" && Number.isFinite(n.x) && typeof n.y === "number" && Number.isFinite(n.y),
  );

  if (coordsProvided) {
    return new Map(
      structure.nodes.map((n) => [n.id, { x: n.x as number, y: n.y as number }]),
    );
  }

  const nodes = structure.nodes;

  if (structure.kind === "linked_list") {
    const left = 70;
    const step = Math.max(54, Math.min(86, (VIEW_W - 140) / Math.max(1, nodes.length)));
    const midY = 120;
    return new Map(nodes.map((n, i) => [n.id, { x: left + i * step, y: midY }]));
  }

  if (structure.kind === "graph") {
    const cx = VIEW_W / 2;
    const cy = 110;
    const r = Math.max(56, Math.min(120, 62 + nodes.length * 2));
    const start = -Math.PI / 2;
    return new Map(
      nodes.map((n, i) => {
        const theta = start + (i / Math.max(1, nodes.length)) * Math.PI * 2;
        return [n.id, { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) }];
      }),
    );
  }

  // tree layout
  if (structure.kind === "tree") {
    const root = structure.rootId ?? nodes[0]?.id;
    if (root && structure.edges && structure.edges.length > 0) {
      const childrenByParent = new Map<string, string[]>();
      for (const e of structure.edges) {
        const arr = childrenByParent.get(e.from) ?? [];
        arr.push(e.to);
        childrenByParent.set(e.from, arr);
      }
      const seen = new Set<string>();
      const depth = new Map<string, number>();
      const queue: string[] = [root];
      depth.set(root, 0);
      seen.add(root);

      // BFS layering to place nodes.
      while (queue.length > 0) {
        const cur = queue.shift()!;
        const d = depth.get(cur) ?? 0;
        const kids = childrenByParent.get(cur) ?? [];
        for (const k of kids) {
          if (seen.has(k)) continue;
          seen.add(k);
          depth.set(k, d + 1);
          queue.push(k);
        }
      }

      // Group nodes by depth in encounter order.
      const depths = new Map<number, string[]>();
      for (const n of nodes) {
        const d = depth.get(n.id);
        if (d === undefined) continue;
        const arr = depths.get(d) ?? [];
        arr.push(n.id);
        depths.set(d, arr);
      }

      const maxD = Math.max(0, ...Array.from(depths.keys()));
      const topY = 40;
      const rowH = 56;
      const leftMargin = 46;
      const rightMargin = VIEW_W - 46;
      const width = Math.max(1, rightMargin - leftMargin);

      const positions = new Map<string, Point>();
      for (let d = 0; d <= maxD; d += 1) {
        const row = depths.get(d) ?? [];
        const count = Math.max(1, row.length);
        for (let i = 0; i < row.length; i += 1) {
          const id = row[i]!;
          const x = leftMargin + ((i + 0.5) / count) * width;
          const y = topY + d * rowH;
          positions.set(id, { x, y });
        }
      }

      // Any nodes not reached by BFS fallback to circle-ish.
      const missing = nodes.filter((n) => !positions.has(n.id));
      if (missing.length > 0) {
        const fallback = computePositions({ ...structure, kind: "graph", nodes: missing } as any);
        for (const n of missing) {
          const p = fallback.get(n.id);
          if (p) positions.set(n.id, p);
        }
      }

      return positions;
    }

    // Heap-like binary tree placement when no edges/root info is available.
    return new Map(
      nodes.map((n, i) => {
        const depth = Math.floor(Math.log2(i + 1));
        const base = Math.pow(2, depth) - 1;
        const idxInRow = i - base;
        const rowCount = Math.pow(2, depth);

        const topY = 42;
        const rowH = 54;
        const leftMargin = 46;
        const rightMargin = VIEW_W - 46;
        const rowW = Math.max(1, rightMargin - leftMargin);
        const x = leftMargin + ((idxInRow + 0.5) / rowCount) * rowW;
        const y = topY + depth * rowH;
        return [n.id, { x, y }];
      }),
    );
  }

  // Ultimate fallback: simple left-to-right.
  const left = 70;
  const step = Math.max(44, Math.min(92, (VIEW_W - 140) / Math.max(1, nodes.length)));
  const midY = 110;
  return new Map(nodes.map((n, i) => [n.id, { x: left + i * step, y: midY }]));
}

function labelForNode(n: VizStructureNode): string {
  if (n.label !== undefined && n.label !== "") return n.label;
  return n.id;
}

export function StructureViz({ structure }: Props) {
  const positions = computePositions(structure);

  const edges = structure.edges ?? [];
  const edgeList: VizStructureEdge[] =
    edges.length > 0 ? edges : [];

  return (
    <div
      className="viz-structure"
      style={{
        padding: "0 10px 8px",
        display: "block",
      }}
    >
      <svg
        width="100%"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        style={{ height: 170, display: "block" }}
        role="img"
        aria-label={`${structure.kind} structure`}
      >
        <defs>
          <marker
            id="viz-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(200,220,255,0.55)" />
          </marker>
        </defs>

        {edgeList.map((e, i) => {
          const a = positions.get(e.from);
          const b = positions.get(e.to);
          if (!a || !b) return null;
          return (
            <line
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={edgeColor(e)}
              strokeWidth={2}
              markerEnd="url(#viz-arrow)"
              opacity={0.95}
            />
          );
        })}

        {structure.nodes.map((n) => {
          const p = positions.get(n.id);
          if (!p) return null;
          const { fill, stroke } = stateToColors(n.state);
          return (
            <g key={n.id}>
              <circle cx={p.x} cy={p.y} r={18} fill={fill} stroke={stroke} strokeWidth={2} />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontSize={12}
                fill="#0b0f14"
                style={{ userSelect: "none" }}
              >
                {labelForNode(n)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

