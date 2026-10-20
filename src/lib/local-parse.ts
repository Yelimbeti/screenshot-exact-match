import type { ExtractedQuestion } from "./types";

const JUNK =
  /^(candidate|roll|participant|application|test centre|test center|venue|exam|subject|test date|test time|question id|option id|status|chosen option|correct answer|given answer|marks?|section|question type|answered|not answered|marked for review|ans\b|answer\b)/i;
const Q_START = /^(?:Q(?:ue)?s?(?:tion)?\.?\s*(?:No\.?)?\s*)(\d{1,3})\s*[.:)\-]?\s*(.*)$/i;
const OPT = /^\(?([A-Ha-h]|[1-8])\s*[).:]\s*(.+)$/;

export function parsePageText(text: string, carry: ExtractedQuestion | null) {
  const out: ExtractedQuestion[] = [];
  let cur = carry;
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  for (const line of lines) {
    if (JUNK.test(line)) continue;
    const q = line.match(Q_START);
    if (q) {
      if (cur && cur !== carry) out.push(cur);
      cur = { number: q[1], question: q[2], options: [], unreadable: false };
      continue;
    }
    if (!cur) continue;
    const o = line.match(OPT);
    if (o) {
      const raw = o[1].toUpperCase();
      const label = /\d/.test(raw) ? String.fromCharCode(64 + Number(raw)) : raw;
      cur.options.push({ label, text: o[2] });
    } else if (cur.options.length === 0) {
      cur.question = (cur.question + " " + line).trim();
    } else {
      const last = cur.options[cur.options.length - 1];
      last.text = (last.text + " " + line).trim();
    }
  }
  if (cur && cur !== carry) out.push(cur);
  for (const q of out) q.unreadable = q.question.length < 3;
  return { questions: out, last: cur };
}
