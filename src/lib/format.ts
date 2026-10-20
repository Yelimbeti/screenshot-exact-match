import type { ExtractedQuestion } from "./extract.functions";

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function mergeQuestions(all: ExtractedQuestion[]): ExtractedQuestion[] {
  const out: ExtractedQuestion[] = [];
  for (const q of all) {
    const dup = out.find(
      (o) => (q.question && norm(o.question) === norm(q.question)) || (q.number && o.number === q.number && norm(o.question) === norm(q.question)),
    );
    if (dup) {
      if (dup.options.length < q.options.length) dup.options = q.options;
      continue;
    }
    out.push({ ...q, options: [...q.options] });
  }
  return out;
}

export function toTxt(qs: ExtractedQuestion[]): string {
  return qs
    .map((q, i) => {
      const num = q.number || String(i + 1);
      const stmt = q.unreadable ? `[UNREADABLE – REVIEW NEEDED] ${q.question}`.trim() : q.question;
      const opts = q.options.map((o) => `${o.label}) ${o.text}`).join("\n\n");
      return `Question ${num}: ${stmt}\n\n${opts}`;
    })
    .join("\n\n\n");
}
