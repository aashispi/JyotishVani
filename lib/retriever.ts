/**
 * lib/retriever.ts
 * Supabase pgvector + Gemini embeddings
 */

import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const genai          = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const embeddingModel = genai.getGenerativeModel({ model: "embedding-001" });

export interface RetrievedChunk {
  id: number;
  content: string;
  metadata: {
    source?:      string;
    source_full?: string;
    chapter?:     string;
    sloka?:       string;
    preview?:     string;
    [key: string]: unknown;
  };
  similarity: number;
}

/** Embed a query string using Gemini */
async function getEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent({
    content:  { parts: [{ text }], role: "user" },
    taskType: "RETRIEVAL_QUERY" as any,
  });
  return result.embedding.values;
}

/**
 * Retrieve top-k similar chunks from Supabase pgvector.
 * Pass sources like ["BPHS","BJ"] to filter by book, or null for all.
 */
export async function retrieve(
  query:    string,
  topK      = 8,
  threshold = 0.68,
  sources:  string[] | null = null
): Promise<RetrievedChunk[]> {
  const embedding = await getEmbedding(query);

  const { data, error } = await supabase.rpc("match_jyotish_chunks", {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count:     topK,
    filter_sources:  sources,
  });

  if (error) throw new Error(`Supabase retrieval error: ${error.message}`);
  return (data ?? []) as RetrievedChunk[];
}

/**
 * Format retrieved chunks into a context block for the LLM prompt.
 */
export function buildContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "No relevant passages found.";

  return chunks
    .map((c, i) => {
      const parts = [
        c.metadata.source_full ?? c.metadata.source,
        c.metadata.chapter ? `Chapter ${c.metadata.chapter}` : null,
        c.metadata.sloka   ? `Śloka ${c.metadata.sloka}`     : null,
      ].filter(Boolean).join(", ");

      return `[${i + 1}]${parts ? ` (${parts})` : ""}\n${c.content}`;
    })
    .join("\n\n---\n\n");
}
