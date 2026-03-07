/**
 * scripts/ingest.ts
 * Run: npm run ingest -- --pdf ./bphs.pdf
 */

import fs   from "fs";
import path from "path";
import { createClient }       from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFReader, SentenceSplitter } from "llamaindex";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// ── Book registry — add more PDFs here ───────────────────────────────────────
const BOOKS: Record<string, { name: string; shortCode: string }> = {
  "bphs.pdf":            { name: "Brihat Parasara Hora Sastra", shortCode: "BPHS" },
  "brihat-jataka.pdf":   { name: "Brihat Jataka",               shortCode: "BJ"   },
  "saravali.pdf":        { name: "Saravali",                    shortCode: "SAR"  },
  "jataka-parijata.pdf": { name: "Jataka Parijata",             shortCode: "JP"   },
};

const BATCH_SIZE = 20;
const PDF_PATH   = process.argv[process.argv.indexOf("--pdf") + 1] ?? "./bphs.pdf";

// ── Clients ───────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const genai          = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const embeddingModel = genai.getGenerativeModel({ model: "embedding-001" });

// ── Helpers ───────────────────────────────────────────────────────────────────
async function embedBatch(texts: string[]): Promise<number[][]> {
  const results = await Promise.all(
    texts.map((t) =>
      embeddingModel.embedContent({
        content:  { parts: [{ text: t }], role: "user" },
        taskType: "RETRIEVAL_DOCUMENT" as any,
      })
    )
  );
  return results.map((r) => r.embedding.values);
}

function extractMetadata(text: string, chunkIndex: number, pdfFilename: string) {
  const book         = BOOKS[pdfFilename] ?? { name: pdfFilename, shortCode: "UNKNOWN" };
  const chapterMatch = text.match(/chapter\s+(\d+|[IVXLC]+)/i);
  const slokaMatch   = text.match(/sloka\s+(\d+)/i);
  return {
    source:      book.shortCode,
    source_full: book.name,
    chunk_index: chunkIndex,
    chapter:     chapterMatch?.[1] ?? null,
    sloka:       slokaMatch?.[1]   ?? null,
    preview:     text.slice(0, 120).replace(/\n/g, " "),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📖  Loading PDF: ${PDF_PATH}`);
  if (!fs.existsSync(PDF_PATH)) throw new Error(`PDF not found at ${PDF_PATH}`);

  const pdfFilename = path.basename(PDF_PATH);

  const reader  = new PDFReader();
  const rawDocs = await reader.loadData(PDF_PATH);
  console.log(`    Loaded ${rawDocs.length} pages.`);

  const splitter = new SentenceSplitter({ chunkSize: 512, chunkOverlap: 64 });
  const chunks: { text: string; metadata: object }[] = [];

  for (const doc of rawDocs) {
    const sentences = await splitter.splitText(doc.text);
    for (const sentence of sentences) {
      if (sentence.trim().length < 40) continue;
      chunks.push({
        text:     sentence,
        metadata: extractMetadata(sentence, chunks.length, pdfFilename),
      });
    }
  }
  console.log(`✂️   Created ${chunks.length} chunks.`);

  let inserted = 0;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    let embeddings: number[][];
    try {
      embeddings = await embedBatch(batch.map((c) => c.text));
    } catch (e) {
      console.error(`\n  Embedding error at batch ${i}, retrying in 5s...`);
      await sleep(5000);
      embeddings = await embedBatch(batch.map((c) => c.text));
    }

    const rows = batch.map((chunk, j) => ({
      content:   chunk.text,
      metadata:  chunk.metadata,
      embedding: embeddings[j],
    }));

    const { error } = await supabase.from("jyotish_chunks").insert(rows);
    if (error) throw error;

    inserted += batch.length;
    process.stdout.write(`\r    Inserted ${inserted}/${chunks.length} chunks...`);
    await sleep(200);
  }

  console.log(`\n✅  Done! ${inserted} chunks stored in Supabase.\n`);
}

main().catch(console.error);
