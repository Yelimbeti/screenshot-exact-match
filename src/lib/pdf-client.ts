// Browser-only: imported dynamically.
const SCALE = 2.5;

export type Marker = { kind: "Q" | "ANS"; num?: string; y: number };

export async function loadPages(file: File) {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  return {
    count: pdf.numPages,
    async render(n: number) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: SCALE });
      const tc = await page.getTextContent();
      const markers: Marker[] = [];
      for (const it of tc.items as any[]) {
        const s = String(it.str ?? "").trim();
        if (!s) continue;
        const [, vy] = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
        const h = (it.height || 9) * SCALE;
        const top = vy - h;
        const q = s.match(/^Q\.?\s*(\d{1,3})$/i);
        if (q) markers.push({ kind: "Q", num: q[1], y: top });
        else if (/^Ans$/i.test(s)) markers.push({ kind: "ANS", y: top });
      }
      markers.sort((a, b) => a.y - b.y);
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport, canvas } as any).promise;
      return { canvas, markers, scale: SCALE };
    },
  };
}

export function crop(src: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, x, y, w, h, 0, 0, w, h);
  return c;
}

let workerPromise: Promise<any> | null = null;
export async function ocr(canvas: HTMLCanvasElement): Promise<string> {
  try {
    if (!workerPromise) {
      workerPromise = import("tesseract.js").then((t) => t.createWorker("eng"));
    }
    const w = await workerPromise;
    const { data } = await w.recognize(canvas);
    return data.text ?? "";
  } catch {
    return "";
  }
}
