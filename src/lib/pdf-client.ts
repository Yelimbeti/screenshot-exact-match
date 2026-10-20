// Browser-only: imported dynamically.
export async function loadPages(file: File) {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  return {
    count: pdf.numPages,
    async render(n: number) {
      const page = await pdf.getPage(n);
      const tc = await page.getTextContent();
      const pdfText = tc.items.map((i: any) => (i.str ?? "") + (i.hasEOL ? "\n" : " ")).join("");
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport, canvas } as any).promise;
      return { pdfText, canvas, image: canvas.toDataURL("image/jpeg", 0.85) };
    },
  };
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
