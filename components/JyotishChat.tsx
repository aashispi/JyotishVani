"use client";

import { useState, useRef, useEffect } from "react";
import type { SarvamLanguageCode } from "@/lib/sarvam";

interface Source {
  source?:  string;
  chapter?: string;
  sloka?:   string;
  preview?: string;
  similarity: number;
}

interface Message {
  role:         "user" | "assistant";
  content:      string;
  translation?: string;
  lang?:        SarvamLanguageCode;
  sources?:     Source[];
  loading?:     boolean;
}

const LANGUAGES: { code: SarvamLanguageCode | "en"; label: string }[] = [
  { code: "en",    label: "English"   },
  { code: "hi-IN", label: "हिंदी"      },
  { code: "bn-IN", label: "বাংলা"      },
  { code: "ta-IN", label: "தமிழ்"      },
  { code: "te-IN", label: "తెలుగు"     },
  { code: "mr-IN", label: "मराठी"      },
  { code: "kn-IN", label: "ಕನ್ನಡ"      },
  { code: "ml-IN", label: "മലയാളം"     },
  { code: "gu-IN", label: "ગુજરાતી"    },
];

const SAMPLE_QUESTIONS = [
  "What are the effects of Rahu in the 7th house?",
  "Explain the Vimshottari Dasha system",
  "What does BPHS say about Yogakaraka planets?",
  "How is Atmakaraka determined according to Parasara?",
];

export default function JyotishChat() {
  const [messages,         setMessages]         = useState<Message[]>([]);
  const [input,            setInput]            = useState("");
  const [language,         setLanguage]         = useState<SarvamLanguageCode | "en">("en");
  const [isLoading,        setIsLoading]        = useState(false);
  const [showTranslation,  setShowTranslation]  = useState<Record<number, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text = input) {
    if (!text.trim() || isLoading) return;
    setInput("");
    setIsLoading(true);

    const userMsg:      Message = { role: "user",      content: text };
    const assistantMsg: Message = { role: "assistant", content: "", loading: true };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      const res = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:  text,
          language: language === "en" ? null : language,
        }),
      });

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer      = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            setMessages((prev) => {
              const next = [...prev];
              const last = { ...next[next.length - 1] };

              if      (parsed.type === "token")       { last.content = (last.content ?? "") + parsed.token; last.loading = false; }
              else if (parsed.type === "translation") { last.translation = parsed.text; last.lang = parsed.lang; }
              else if (parsed.type === "sources")     { last.sources = parsed.sources; }

              next[next.length - 1] = last;
              return next;
            });
          } catch { /* skip malformed lines */ }
        }
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: "An error occurred. Please try again." };
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  return (
    <div className="chat-root">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo">
          <span className="om">ॐ</span>
          <div>
            <div className="logo-title">Jyotish GPT</div>
            <div className="logo-sub">Brihat Parāśara Horā Śāstra</div>
          </div>
        </div>

        <div className="section-label">Response Language</div>
        <div className="lang-grid">
          {LANGUAGES.map((l) => (
            <button key={l.code} className={`lang-btn ${language === l.code ? "active" : ""}`} onClick={() => setLanguage(l.code)}>
              {l.label}
            </button>
          ))}
        </div>

        <div className="section-label">Sample Questions</div>
        <div className="samples">
          {SAMPLE_QUESTIONS.map((q) => (
            <button key={q} className="sample-q" onClick={() => sendMessage(q)}>{q}</button>
          ))}
        </div>

        <div className="disclaimer">
          Answers sourced from BPHS (Santhanam translation). Consult a qualified Jyotishi for personal guidance.
        </div>
      </aside>

      {/* Chat area */}
      <main className="chat-area">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="yantra">☸</div>
            <h2>Ask the Rishis</h2>
            <p>Query the Brihat Parāśara Horā Śāstra — the root text of Vedic astrology</p>
          </div>
        )}

        <div className="messages">
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              {msg.role === "assistant" && <div className="avatar"><span>ग्र</span></div>}
              <div className="bubble-wrap">
                <div className={`bubble ${msg.loading ? "loading" : ""}`}>
                  {msg.loading ? (
                    <span className="dots"><span /><span /><span /></span>
                  ) : (
                    <>
                      <div className="msg-text">{msg.content}</div>

                      {msg.translation && (
                        <div className="translation-block">
                          <button className="toggle-trans" onClick={() => setShowTranslation((s) => ({ ...s, [i]: !s[i] }))}>
                            {showTranslation[i] ? "▾ Hide" : "▸ Show"} {msg.lang?.split("-")[0].toUpperCase()} translation
                          </button>
                          {showTranslation[i] && <div className="translated-text">{msg.translation}</div>}
                        </div>
                      )}

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="sources">
                          <div className="sources-label">📜 Sources</div>
                          {msg.sources.map((s, j) => (
                            <div key={j} className="source-item">
                              <span className="source-loc">
                                {s.source ? `${s.source}` : ""}
                                {s.chapter ? ` · Ch. ${s.chapter}` : ""}
                                {s.sloka   ? ` · Ś. ${s.sloka}`    : ""}
                              </span>
                              <span className="source-sim">{s.similarity}%</span>
                              <div className="source-preview">{s.preview}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              {msg.role === "user" && <div className="avatar user-avatar"><span>🙏</span></div>}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="input-bar">
          <textarea
            className="chat-input"
            placeholder="Ask about grahas, bhavas, dashas, yogas…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={2}
            disabled={isLoading}
          />
          <button className={`send-btn ${isLoading ? "sending" : ""}`} onClick={() => sendMessage()} disabled={isLoading || !input.trim()}>
            {isLoading ? "⟳" : "→"}
          </button>
        </div>
      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Noto+Sans+Devanagari:wght@400;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #0d0a1a; --sidebar: #120e25; --card: #1a1430; --border: rgba(255,180,50,0.18);
          --gold: #e8a020; --gold-lt: #f0c060; --saffron: #ff6b10;
          --text: #e8e0f0; --muted: #8878aa; --bubble-ai: #1e1838; --bubble-usr: #2a1f50; --radius: 12px;
        }
        body { background: var(--bg); color: var(--text); font-family: 'Libre Baskerville', Georgia, serif; }
        .chat-root { display: grid; grid-template-columns: 280px 1fr; height: 100vh; overflow: hidden; }
        .sidebar { background: var(--sidebar); border-right: 1px solid var(--border); padding: 24px 16px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; }
        .logo { display: flex; align-items: center; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
        .om { font-size: 2.4rem; color: var(--gold); font-family: 'Noto Sans Devanagari', sans-serif; }
        .logo-title { font-size: 1.1rem; font-weight: 700; color: var(--gold-lt); }
        .logo-sub { font-size: 0.65rem; color: var(--muted); font-style: italic; }
        .section-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); }
        .lang-grid { display: flex; flex-wrap: wrap; gap: 6px; }
        .lang-btn { padding: 5px 10px; border-radius: 6px; font-size: 0.78rem; cursor: pointer; background: var(--card); border: 1px solid var(--border); color: var(--text); transition: all 0.15s; }
        .lang-btn:hover { border-color: var(--gold); color: var(--gold); }
        .lang-btn.active { background: var(--gold); color: #000; border-color: var(--gold); font-weight: 700; }
        .samples { display: flex; flex-direction: column; gap: 6px; }
        .sample-q { text-align: left; padding: 8px 10px; border-radius: 8px; font-size: 0.78rem; background: var(--card); border: 1px solid var(--border); color: var(--text); cursor: pointer; font-family: inherit; line-height: 1.4; transition: border-color 0.15s; }
        .sample-q:hover { border-color: var(--saffron); color: var(--gold-lt); }
        .disclaimer { font-size: 0.62rem; color: var(--muted); line-height: 1.5; font-style: italic; margin-top: auto; }
        .chat-area { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: radial-gradient(ellipse at 50% 0%, #1a0f35 0%, var(--bg) 60%); }
        .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--muted); text-align: center; padding: 40px; }
        .yantra { font-size: 4rem; color: var(--gold); opacity: 0.5; }
        .empty-state h2 { font-size: 1.8rem; color: var(--gold-lt); }
        .empty-state p { font-size: 0.9rem; max-width: 380px; }
        .messages { flex: 1; overflow-y: auto; padding: 24px 32px; display: flex; flex-direction: column; gap: 24px; }
        .message { display: flex; gap: 12px; align-items: flex-start; animation: slideUp 0.25s ease; }
        .message.user { flex-direction: row-reverse; }
        .avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; flex-shrink: 0; background: linear-gradient(135deg, var(--gold) 0%, var(--saffron) 100%); color: #000; font-weight: 700; font-family: 'Noto Sans Devanagari', sans-serif; border: 1px solid var(--gold); }
        .user-avatar { background: var(--bubble-usr); font-size: 1.1rem; }
        .bubble-wrap { max-width: min(680px, 80%); }
        .bubble { background: var(--bubble-ai); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 18px; line-height: 1.75; font-size: 0.9rem; }
        .message.user .bubble { background: var(--bubble-usr); border-color: rgba(79,70,229,0.4); }
        .loading .dots { display: flex; gap: 5px; padding: 4px 0; }
        .loading .dots span { width: 7px; height: 7px; border-radius: 50%; background: var(--gold); animation: pulse 1s infinite; }
        .loading .dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading .dots span:nth-child(3) { animation-delay: 0.4s; }
        .msg-text { white-space: pre-wrap; }
        .translation-block { margin-top: 12px; border-top: 1px solid var(--border); padding-top: 10px; }
        .toggle-trans { font-size: 0.72rem; color: var(--gold); background: none; border: none; cursor: pointer; font-family: inherit; }
        .translated-text { margin-top: 8px; font-size: 0.88rem; color: var(--gold-lt); line-height: 1.8; font-family: 'Noto Sans Devanagari', serif; }
        .sources { margin-top: 14px; border-top: 1px solid var(--border); padding-top: 10px; }
        .sources-label { font-size: 0.7rem; color: var(--muted); margin-bottom: 8px; }
        .source-item { display: grid; grid-template-columns: 1fr auto; grid-template-rows: auto auto; gap: 2px 8px; padding: 6px 8px; margin-bottom: 4px; background: rgba(255,180,50,0.05); border-radius: 6px; border-left: 2px solid var(--gold); }
        .source-loc { font-size: 0.72rem; color: var(--gold); font-weight: 700; }
        .source-sim { font-size: 0.68rem; color: var(--saffron); }
        .source-preview { grid-column: 1/-1; font-size: 0.72rem; color: var(--muted); line-height: 1.4; }
        .input-bar { padding: 16px 32px 24px; display: flex; gap: 10px; border-top: 1px solid var(--border); background: rgba(13,10,26,0.8); }
        .chat-input { flex: 1; padding: 12px 16px; border-radius: var(--radius); background: var(--card); border: 1px solid var(--border); color: var(--text); font-family: inherit; font-size: 0.9rem; resize: none; outline: none; line-height: 1.5; transition: border-color 0.2s; }
        .chat-input:focus { border-color: var(--gold); }
        .chat-input::placeholder { color: var(--muted); }
        .send-btn { width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg, var(--gold), var(--saffron)); border: none; cursor: pointer; font-size: 1.4rem; color: #000; font-weight: 700; transition: transform 0.15s, opacity 0.15s; display: flex; align-items: center; justify-content: center; align-self: flex-end; }
        .send-btn:hover:not(:disabled) { transform: scale(1.08); }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .send-btn.sending { animation: spin 1s linear infinite; }
        @keyframes pulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
        @media (max-width: 700px) { .chat-root { grid-template-columns: 1fr; } .sidebar { display: none; } .messages, .input-bar { padding-inline: 16px; } }
      `}</style>
    </div>
  );
}
