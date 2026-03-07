/**
 * scripts/check-env.ts
 * Run: npx ts-node --project tsconfig.node.json scripts/check-env.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function check() {
  console.log("\n🔍  Checking your environment...\n");
  console.log("SUPABASE_URL     =", process.env.SUPABASE_URL ?? "NOT SET");
  console.log("SUPABASE_KEY set =", process.env.SUPABASE_SERVICE_KEY ? "YES (length: " + process.env.SUPABASE_SERVICE_KEY.length + ")" : "NOT SET");
  console.log("GEMINI_KEY set   =", process.env.GEMINI_API_KEY ? "YES (length: " + process.env.GEMINI_API_KEY.length + ")" : "NOT SET");
  console.log("SARVAM_KEY set   =", process.env.SARVAM_API_KEY ? "YES" : "NOT SET");
  console.log("");

  // ── Test Supabase ─────────────────────────────────────────────────────────
  console.log("Testing Supabase...");
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { count, error } = await sb
      .from("jyotish_chunks")
      .select("*", { count: "exact", head: true });

    if (error) throw error;
    console.log("✅  Supabase connected! Rows in jyotish_chunks:", count ?? 0);
  } catch (e: any) {
    console.log("❌  Supabase failed:", e.message);
    if (e.message.includes("does not exist")) {
      console.log("    → Table not found. Run schema.sql in Supabase SQL Editor.");
    } else if (e.message.includes("Invalid API key")) {
      console.log("    → Wrong key. Use service_role key from Supabase Settings → API.");
    } else {
      console.log("    → Check SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local");
    }
  }

  console.log("");

  // ── Test Gemini ───────────────────────────────────────────────────────────
  console.log("Testing Gemini...");
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`;
    const res  = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model:   "models/embedding-001",
        content: { parts: [{ text: "test" }] },
      }),
    });
    const json = await res.json();
    if (res.ok && json.embedding) {
      console.log("✅  Gemini working! Embedding dimensions:", json.embedding.values.length);
    } else {
      console.log("❌  Gemini error. Status:", res.status);
      console.log("    Response:", JSON.stringify(json).slice(0, 300));
    }
  } catch (e: any) {
    console.log("❌  Gemini network error:", e.message);
  }

  console.log("");

  // ── Test Sarvam ───────────────────────────────────────────────────────────
  console.log("Testing Sarvam...");
  try {
    const res  = await fetch("https://api.sarvam.ai/translate", {
      method:  "POST",
      headers: {
        "Content-Type":         "application/json",
        "api-subscription-key": process.env.SARVAM_API_KEY!,
      },
      body: JSON.stringify({
        input:                "hello",
        source_language_code: "en-IN",
        target_language_code: "hi-IN",
        model:                "mayura:v1",
      }),
    });
    const json = await res.json();
    if (res.ok) {
      console.log("✅  Sarvam working! Translation:", json.translated_text);
    } else {
      console.log("❌  Sarvam error. Status:", res.status);
      console.log("    Response:", JSON.stringify(json).slice(0, 200));
    }
  } catch (e: any) {
    console.log("❌  Sarvam network error:", e.message);
  }

  console.log("\n--- Done. Fix any ❌ before running npm run ingest ---\n");
}

check().catch(console.error);
