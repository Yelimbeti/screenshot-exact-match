import type { ExtractedQuestion } from "./types";

const OPT = /^[\(\[]?([A-Da-d]|[1-4])\s*[).:\]]\s*(.+)$/;
const STOP = /^(ans\b|question id|status\s*:|chosen option)/i;

/** Parse OCR text of ONE isolated question box. Max 4 options. */
export function parseQuestionBlock(number: string, text: string): ExtractedQuestion {
  const q: ExtractedQuestion = { number, question: "", options: [], unreadable: false };
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  for (const line of lines) {
    if (STOP.test(line)) break;
    const o = line.match(OPT);
    if (o && q.options.length < 4) {
      const raw = (o[1] ?? "").toUpperCase();
      const label = /\d/.test(raw) ? String.fromCharCode(64 + Number(raw)) : raw;
      const expected = String.fromCharCode(65 + q.options.length);
      if (label === expected || q.question.length > 0) {
        q.options.push({ label: expected, text: o[2] ?? "" });
        continue;
      }
    }
    if (q.options.length === 0) q.question = (q.question + " " + line).trim();
    else if (q.options.length < 4 || true) {
      const last = q.options[q.options.length - 1]!;
      last.text = (last.text + " " + line).trim();
    }
  }
  q.unreadable = q.question.length < 3;
  return q;
}
