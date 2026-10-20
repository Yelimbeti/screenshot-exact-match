import type { ExtractedQuestion } from "./types";

const OPT = /^[\(\[]?([A-Da-d]|[1-4])\s*[).:,\]]\s*(.+)$/;
const STOP = /^(ans\b|question id|status\s*:|chosen option)/i;
const LETTERS = ["A", "B", "C", "D"];

function rawIndex(raw: string) {
  const r = raw.toUpperCase();
  return /\d/.test(r) ? Number(r) - 1 : LETTERS.indexOf(r);
}

/** Parse OCR text of ONE isolated question box. Max 4 options (A-D). */
export function parseQuestionBlock(number: string, text: string): ExtractedQuestion {
  const lines: string[] = [];
  for (const l of text.split(/\r?\n/)) {
    const s = l.replace(/\s+/g, " ").trim();
    if (!s) continue;
    if (STOP.test(s)) break;
    lines.push(s);
  }

  // Pass 1: strict option detection, in order A->D.
  const starts: { line: number; idx: number; text: string }[] = [];
  let expect = 0;
  lines.forEach((s, i) => {
    if (i === 0 || expect > 3) return;
    const o = s.match(OPT);
    if (!o) return;
    const idx = rawIndex(o[1] ?? "");
    if (idx >= expect && idx <= 3) {
      starts.push({ line: i, idx, text: o[2] ?? "" });
      expect = idx + 1;
    }
  });

  // Pass 2: repair missing labels (OCR often drops the "." e.g. "A7i").
  const loose = (s: string, idx: number) => {
    const m = s.match(/^\(?([A-D1-4])\s*[).:,]?\s*(.+)$/i);
    return m && rawIndex(m[1]!) === idx ? m[2]! : null;
  };
  for (let k = 0; k <= starts.length; k++) {
    const prevIdx = k === 0 ? -1 : starts[k - 1]!.idx;
    const nextIdx = k < starts.length ? starts[k]!.idx : 4;
    if (nextIdx - prevIdx !== 2) continue;
    const missing = prevIdx + 1;
    const from = k === 0 ? 1 : starts[k - 1]!.line + 1;
    const to = k < starts.length ? starts[k]!.line : lines.length;
    // search backwards from the gap end (closest line to the next option)
    for (let li = to - 1; li >= from; li--) {
      const t = loose(lines[li]!, missing);
      if (t) {
        starts.splice(k, 0, { line: li, idx: missing, text: t });
        break;
      }
    }
  }

  const firstOpt = starts[0]?.line ?? lines.length;
  const q: ExtractedQuestion = {
    number,
    question: lines.slice(0, firstOpt).join(" ").trim(),
    options: starts.map((s, k) => {
      const end = starts[k + 1]?.line ?? lines.length;
      const extra = lines.slice(s.line + 1, end).join(" ");
      return { label: LETTERS[s.idx]!, text: (s.text + " " + extra).trim() };
    }),
    unreadable: false,
  };
  q.unreadable = q.question.length < 3;
  return q;
}
