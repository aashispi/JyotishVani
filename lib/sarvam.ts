/**
 * lib/sarvam.ts
 * Sarvam AI — translation + language detection for Indian languages.
 */

const SARVAM_API_KEY = process.env.SARVAM_API_KEY!;
const SARVAM_BASE    = "https://api.sarvam.ai";

export type SarvamLanguageCode =
  | "hi-IN"   // Hindi
  | "bn-IN"   // Bengali
  | "ta-IN"   // Tamil
  | "te-IN"   // Telugu
  | "mr-IN"   // Marathi
  | "kn-IN"   // Kannada
  | "ml-IN"   // Malayalam
  | "gu-IN"   // Gujarati
  | "pa-IN";  // Punjabi

/**
 * Translate English text to target Indian language.
 * Falls back to original English text on any error.
 */
export async function translateToIndian(
  text:       string,
  targetLang: SarvamLanguageCode
): Promise<string> {
  if (!SARVAM_API_KEY) return text;

  try {
    const res = await fetch(`${SARVAM_BASE}/translate`, {
      method: "POST",
      headers: {
        "Content-Type":        "application/json",
        "api-subscription-key": SARVAM_API_KEY,
      },
      body: JSON.stringify({
        input:                text,
        source_language_code: "en-IN",
        target_language_code: targetLang,
        speaker_gender:       "Male",
        mode:                 "formal",
        model:                "mayura:v1",
        enable_preprocessing: true,
      }),
    });

    if (!res.ok) throw new Error(`Sarvam ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.translated_text ?? text;
  } catch (e) {
    console.error("Translation failed:", e);
    return text;
  }
}

/**
 * Detect if the user message is in an Indian language.
 * Returns the language code, or null if English.
 */
export async function detectLanguage(
  text: string
): Promise<SarvamLanguageCode | null> {
  if (!SARVAM_API_KEY) return null;

  try {
    const res = await fetch(`${SARVAM_BASE}/text-analytics/identify-language`, {
      method: "POST",
      headers: {
        "Content-Type":        "application/json",
        "api-subscription-key": SARVAM_API_KEY,
      },
      body: JSON.stringify({ input: text }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const lang = data.language_code as string;
    if (!lang || lang === "en-IN" || lang === "en") return null;
    return lang as SarvamLanguageCode;
  } catch {
    return null;
  }
}
