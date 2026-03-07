/**
 * app/api/chat/route.ts
 * POST /api/chat — streaming RAG endpoint
 */

import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { retrieve, buildContext } from "@/lib/retriever";
import { detectLanguage, translateToIndian, SarvamLanguageCode } from "@/lib/sarvam";

export const runtime = "edge";

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const llm   = genai.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
});

const SYSTEM_PROMPT = `You are a learned Jyotish (Vedic astrology) scholar.
Answer ONLY from the provided context passages.
If the context does not contain the answer, say so clearly — do not make things up.
Always cite the source text and chapter/śloka when available (e.g. "BPHS, Chapter 7, Śloka 12").
Use Sanskrit terms with brief English explanations (e.g. "Lagna (Ascendant)").
Be respectful of the sacred nature of this knowledge.`;

export async function POST(req: NextRequest) {
  const { message, language, sources } = await req.json();

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "Empty message" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const targetLang: SarvamLanguageCode | null =
    language ?? (await detectLanguage(message));

  const chunks  = await retrieve(message, 8, 0.68, sources ?? null);
  const context = buildContext(chunks);

  const userPrompt = `CONTEXT FROM JYOTISH TEXTS:\n${context}\n\nUSER QUESTION: ${message}\n\nAnswer based only on the context above.`;

  const encoder = new TextEncoder();
  const stream  = new ReadableStream({
    async start(controller) {
      let fullAnswer = "";
      try {
        const result = await llm.generateContentStream([
          { role: "user",  parts: [{ text: SYSTEM_PROMPT }] },
          { role: "model", parts: [{ text: "Understood. I will only answer from the provided context and cite sources." }] },
          { role: "user",  parts: [{ text: userPrompt }] },
        ]);

        for await (const chunk of result.stream) {
          const token = chunk.text();
          fullAnswer += token;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ token, type: "token" })}\n\n`)
          );
        }

        if (targetLang) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "translating" })}\n\n`)
          );
          const translated = await translateToIndian(fullAnswer, targetLang);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "translation", text: translated, lang: targetLang })}\n\n`
            )
          );
        }

        const sources_out = chunks.slice(0, 5).map((c) => ({
          source:     c.metadata.source_full ?? c.metadata.source,
          chapter:    c.metadata.chapter,
          sloka:      c.metadata.sloka,
          preview:    c.metadata.preview,
          similarity: Math.round(c.similarity * 100),
        }));
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "sources", sources: sources_out })}\n\n`)
        );

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", message: String(e) })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      Connection:      "keep-alive",
    },
  });
}
