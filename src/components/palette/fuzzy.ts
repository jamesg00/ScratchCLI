/** Simple subsequence fuzzy score; higher is better. -1 = no match. */
export function fuzzyScore(query: string, target: string): number {
  const q = query.trim().toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 1;
  if (t === q) return 10_000;
  if (t.startsWith(q)) return 5_000 + (100 - t.length);
  if (t.includes(q)) return 1_000 + (100 - t.indexOf(q));

  let ti = 0;
  let score = 0;
  let streak = 0;
  for (let qi = 0; qi < q.length; qi += 1) {
    const ch = q[qi]!;
    const found = t.indexOf(ch, ti);
    if (found < 0) return -1;
    streak = found === ti ? streak + 1 : 1;
    score += 10 + streak * 5 - (found - ti);
    ti = found + 1;
  }
  return score;
}

export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
): T[] {
  const scored = items
    .map((item) => ({ item, score: fuzzyScore(query, getText(item)) }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((row) => row.item);
}
