import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import UserDropdown from "./UserDropdown";
import Footer from "./Footer.jsx";
import VoiceInput from "./VoiceInput";
import { analyzeSpeechEfficiency } from "../api";
import "./debatetrainer.css";

function DebateTrainer({ user, onLogout }) {
  const [speechText, setSpeechText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [error, setError] = useState("");

  const sanitizeAnalysis = (text) => {
    if (!text) return text;
    const lines = text.split(/\r?\n/);
    const filtered = lines.filter((line, idx) => {
      const lower = line.toLowerCase();
      // Strip top-level debatey title lines and debate tropes
      if (idx === 0 && line.trim().startsWith("#")) return false;
      if (lower.includes("opponent")) return false;
      if (lower.includes("i win")) return false;
      if (lower.includes("rebut")) return false;
      if (lower.includes("crossfire")) return false;
      if (lower.includes("judge")) return false;
      if (lower.match(/\bround\b/)) return false;
      return true;
    }).map(l => l.replace(/\(frontline\)/gi, "").trimEnd());
    return filtered.join("\n").trim();
  };

  const handleVoiceFinalChunk = (chunk) => {
    // Append only new final chunks coming from VoiceInput
    setSpeechText((prev) => (prev ? prev + " " : "") + chunk);
  };

  const handleAnalyze = async () => {
    if (!speechText.trim()) return;
    setAnalyzing(true);
    setError("");
    setAnalysis("");
    try {
      const model = "openai/gpt-4o-mini";
      console.log("[Trainer] Analyze start. chars:", speechText.length, "model:", model);
      const prompt = `SYSTEM: You are a Speech Efficiency Coach. This is NOT a debate.
Do NOT simulate opponents, judges, rounds, personas, crossfire, rebuttals, or win/loss language.
Do NOT include any headers or text that references "Round", "Opponent", "Frontline", "Judge", or "I win".
Only provide coaching on concision and efficiency for the single user speech. Respond as a coaching note, not as a speech.

Output using EXACT section headings:
== Efficiency Critique ==
== Precise Cuts and Rewrites ==
== Tighter Rewrite ==
== Checklist ==

Requirements:
1) Efficiency Critique (bulleted): where to cut fluff, redundancy, filler, hedging, throat‑clearing, and overlong phrasing. Note pacing and signposting improvements. Be concrete.
2) Precise Cuts and Rewrites (most important): for each item, QUOTE the exact original span to cut or reword, include its first and last 5 characters in quotes to locate it, and give:
   - Original: "…quoted span…"
   - Location hint: "…first5…" → "…last5…"
   - Action: CUT or REWORD
   - Replacement (if REWORD): "…shorter alternative…"
   - Words saved: ~N
3) Tighter Rewrite: provide a rewritten version 20–35% shorter that preserves claims → warrants → impacts and clear weighing. Use crisp signposts and concise impact calculus.
4) Checklist: 5 one‑line rules they can apply next attempt.

Student speech:
${speechText}`;
      // Use dedicated trainer endpoint to avoid debate chain
      const out = await analyzeSpeechEfficiency(speechText, { model });
      const sanitized = sanitizeAnalysis(out || "");
      console.log("[Trainer] Analyze success. out chars:", out?.length, "sanitized chars:", sanitized?.length);

      if (!sanitized) {
        setError("The AI didn't return any feedback. Try shortening your speech or trying again in a moment.");
        setAnalysis("");
      } else {
        setError("");
        setAnalysis(sanitized);
      }
    } catch (e) {
      console.error("[Trainer] Analyze error:", e);
      setError(e?.message || "Failed to analyze speech. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleClear = () => {
    setSpeechText("");
    setAnalysis("");
    setError("");
  };

  return (
    <div className="debate-trainer-container">
      <header className="debate-trainer-header">
        <div className="debate-trainer-header-content">
          <div className="debate-trainer-header-left">
            {/* Empty for alignment */}
          </div>
          <div
            className="debate-trainer-header-center"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}
          >
            <h1 className="debate-trainer-site-title">Debate Trainer</h1>
          </div>
          <div className="debate-trainer-header-right">
            <UserDropdown user={user} onLogout={onLogout} className="debate-trainer-user-dropdown" />
          </div>
        </div>
      </header>

      <div className="debate-trainer-main">
        <div className="debate-trainer-card">
          <h2>Speech Feedback</h2>
          <p>Read out or paste your speech. Get concise, efficiency-focused coaching.</p>

          <div className="speech-feedback-section">
            <div className="speech-feedback-voice">
              <VoiceInput
                onTranscript={handleVoiceFinalChunk}
                placeholder="Click to start speaking. We'll transcribe as you go."
              />
            </div>

            <div className="speech-feedback-editor">
              <label className="speech-feedback-label">Your Speech</label>
              <textarea
                className="speech-feedback-textarea"
                rows={8}
                value={speechText}
                onChange={(e) => setSpeechText(e.target.value)}
                placeholder="Paste or dictate your speech here..."
              />
              <div className="speech-feedback-actions">
                <button
                  className="debate-trainer-btn"
                  onClick={handleClear}
                  disabled={analyzing && !speechText}
                >
                  Clear
                </button>
                <button
                  className="debate-trainer-btn primary"
                  onClick={handleAnalyze}
                  disabled={analyzing || !speechText.trim()}
                >
                  {analyzing ? "Analyzing..." : "Analyze Efficiency"}
                </button>
              </div>
            </div>
          </div>

          {error && <div className="speech-feedback-error">{error}</div>}
          
          {(speechText || analysis) && (
            <div className="speech-feedback-comparison">
              <div className="speech-feedback-left">
                <label className="speech-feedback-label">Your Speech</label>
                <div className="speech-feedback-display">
                  {speechText || <span className="speech-feedback-placeholder">Your speech will appear here...</span>}
                </div>
              </div>
              {analysis && (
                <div className="speech-feedback-right">
                  <label className="speech-feedback-label">AI Feedback</label>
                  <div className="speech-feedback-output">
                    <ReactMarkdown
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        h1: ({ node, ...props }) => <h1 className="trainer-markdown-h1" {...props} />,
                        h2: ({ node, ...props }) => <h2 className="trainer-markdown-h2" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="trainer-markdown-h3" {...props} />,
                        h4: ({ node, ...props }) => <h4 className="trainer-markdown-h4" {...props} />,
                        p: ({ node, ...props }) => <p className="trainer-markdown-p" {...props} />,
                        ul: ({ node, ...props }) => <ul className="trainer-markdown-ul" {...props} />,
                        ol: ({ node, ...props }) => <ol className="trainer-markdown-ol" {...props} />,
                        li: ({ node, ...props }) => <li className="trainer-markdown-li" {...props} />,
                        strong: ({ node, ...props }) => <strong className="trainer-markdown-strong" {...props} />,
                        em: ({ node, ...props }) => <em className="trainer-markdown-em" {...props} />,
                        code: ({ node, ...props }) => <code className="trainer-markdown-code" {...props} />,
                        pre: ({ node, ...props }) => <pre className="trainer-markdown-pre" {...props} />,
                      }}
                    >
                      {analysis}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default DebateTrainer;

