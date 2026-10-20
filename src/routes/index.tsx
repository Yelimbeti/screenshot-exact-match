import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { FileText, UploadCloud, Download, Loader2, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ExtractedQuestion } from "@/lib/types";
import { parsePageText } from "@/lib/local-parse";
import { mergeQuestions, toTxt } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ION Question Extractor AI — PDF to TXT" },
      { name: "description", content: "Extract every question and option from ION response-sheet PDFs, including image-based questions, and download as text." },
      { property: "og:title", content: "ION Question Extractor AI" },
      { property: "og:description", content: "Convert image-based exam questions and options into a clean .txt file." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<ExtractedQuestion[]>([]);

  const pick = (f?: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    setError("");
    setQuestions([]);
    setFile(f);
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    setQuestions([]);
    setProgress(2);
    try {
      const { loadPages, ocr } = await import("@/lib/pdf-client");
      const doc = await loadPages(file);
      const collected: ExtractedQuestion[] = [];
      let carry: ExtractedQuestion | null = null;
      for (let n = 1; n <= doc.count; n++) {
        const step = 100 / doc.count;
        setStatus(`Page ${n} of ${doc.count}: reading text`);
        const { canvas } = await doc.render(n);
        setProgress((n - 1) * step + step * 0.2);
        setStatus(`Page ${n} of ${doc.count}: reading questions (OCR)`);
        const ocrText = await ocr(canvas);
        const res = parsePageText(ocrText, carry);
        carry = res.last;
        collected.push(...res.questions);
        setQuestions(mergeQuestions(collected));
        setProgress(n * step);
      }
      setStatus("Done");
    } catch (e: any) {
      setError(e?.message ?? "Extraction failed.");
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    const blob = new Blob([toTxt(questions)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (file?.name.replace(/\.pdf$/i, "") || "questions") + "-questions.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const flagged = questions.filter((q) => q.unreadable).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center gap-2 px-6 py-6">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
          <FileText className="h-5 w-5" />
        </div>
        <span className="font-display text-lg font-semibold">ION Question Extractor <span className="text-primary">AI</span></span>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24">
        <section className="pt-8 text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Extract Every Question From Your PDF</h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Upload your exam response sheet and convert image-based questions and answer options into readable text.
          </p>
        </section>

        <section className="mt-10 rounded-3xl border bg-card p-6 shadow-soft">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${drag ? "border-primary bg-accent" : "border-border bg-muted/40"}`}
          >
            <UploadCloud className="h-10 w-10 text-primary" />
            <p className="mt-3 font-medium">Drag & drop your PDF here</p>
            <p className="text-sm text-muted-foreground">or</p>
            <Button variant="outline" className="mt-3" onClick={() => inputRef.current?.click()} disabled={busy}>Browse Files</Button>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            {file && (
              <div className="mt-5 flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm text-accent-foreground">
                <FileText className="h-4 w-4" /> {file.name}
                {!busy && <button aria-label="Remove file" onClick={() => { setFile(null); setQuestions([]); }}><X className="h-4 w-4" /></button>}
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="flex-1" onClick={run} disabled={!file || busy}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Extracting…</> : "Extract Questions"}
            </Button>
            <Button size="lg" variant="secondary" className="flex-1" onClick={download} disabled={!questions.length || busy}>
              <Download className="h-4 w-4" /> Download as TXT
            </Button>
          </div>

          {(busy || status === "Done") && (
            <div className="mt-6">
              <Progress value={progress} />
              <p className="mt-2 text-sm text-muted-foreground">{status}</p>
            </div>
          )}
          {error && <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
        </section>

        {questions.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Preview · {questions.length} questions</h2>
              {flagged > 0 && (
                <span className="flex items-center gap-1 text-sm text-destructive"><AlertTriangle className="h-4 w-4" /> {flagged} need review</span>
              )}
            </div>
            <div className="space-y-4">
              {questions.map((q, i) => (
                <article key={i} className={`rounded-2xl border bg-card p-5 shadow-soft ${q.unreadable ? "border-destructive/50" : ""}`}>
                  <p className="font-medium">
                    <span className="text-primary">Question {q.number || i + 1}:</span>{" "}
                    {q.unreadable && <span className="text-destructive">[Unreadable – review] </span>}
                    {q.question}
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                    {q.options.map((o, j) => <li key={j}><span className="font-semibold text-foreground">{o.label})</span> {o.text}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
