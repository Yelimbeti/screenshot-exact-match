import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  pageNumber: z.number(),
  image: z.string().startsWith("data:image/"),
  pdfText: z.string().max(40000),
  ocrText: z.string().max(40000),
});

export type ExtractedQuestion = {
  number: string;
  question: string;
  options: { label: string; text: string }[];
  unreadable: boolean;
};

const SYSTEM = `You extract exam questions from one page of an ION Digital Zone response sheet.
You get the page image, the selectable PDF text, and rough OCR text. Questions are often only in the image; options are often in the PDF text.
Return ONLY JSON: {"questions":[{"number":"1","question":"...","options":[{"label":"A","text":"..."}],"unreadable":false}]}
Rules:
- Include every question on the page with its options, in order. Keep original numbering and option labels (A, B, C, D...). If options are numbered 1,2,3,4 map to A,B,C,D.
- Exclude candidate details, exam info, question IDs, option IDs, status, chosen/correct answers, marks, explanations.
- Write math/symbols in readable plain text (e.g. x^2, sqrt(3), π).
- Never invent text. If a question is unreadable set "question" to what you can read (or "") and "unreadable": true.
- If the page has no questions return {"questions":[]}.`;

export const extractPage = createServerFn({ method: "POST" })
  .validator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ questions: ExtractedQuestion[] }> => {
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI service is not configured.");

    let runId: string | undefined;
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
        const res = await fetch(input, { ...init, headers });
        runId ??= res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
        return res;
      },
    });

    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Page ${data.pageNumber}.\n\n--- PDF TEXT ---\n${data.pdfText || "(none)"}\n\n--- OCR TEXT ---\n${data.ocrText || "(none)"}`,
            },
            { type: "image", image: data.image },
          ],
        },
      ],
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    let text = "";
    try {
      text = await result.text;
    } catch (e: any) {
      const status = e?.statusCode ?? e?.lastError?.statusCode;
      if (status === 402) throw new Error("AI credits are used up. Add credits to continue.");
      if (status === 429) throw new Error("Too many requests. Please wait a moment and try again.");
      throw new Error(e?.message ?? "AI extraction failed.");
    }
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { questions: [] };
    try {
      const parsed = JSON.parse(match[0]);
      const qs = Array.isArray(parsed.questions) ? parsed.questions : [];
      return {
        questions: qs.map((q: any) => ({
          number: String(q.number ?? ""),
          question: String(q.question ?? ""),
          options: Array.isArray(q.options)
            ? q.options.map((o: any) => ({ label: String(o.label ?? ""), text: String(o.text ?? "") }))
            : [],
          unreadable: Boolean(q.unreadable) || !q.question,
        })),
      };
    } catch {
      return { questions: [] };
    }
  });
