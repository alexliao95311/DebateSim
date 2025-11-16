import React, { useState } from "react";
import UserDropdown from "./UserDropdown";
import Footer from "./Footer.jsx";
import VoiceInput from "./VoiceInput";
import { generateAIResponse } from "../api";
import "./debatetrainer.css";

function DebateTrainer({ user, onLogout }) {
  const [speechText, setSpeechText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [error, setError] = useState("");

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
      const model = "openai/gpt-5-mini";
      const prompt = `You are a Debate Speech Efficiency Coach.
Focus specifically on word efficiency and concise persuasion for competitive debate.

Given the student's speech below, produce the following:
1) Efficiency critique (bulleted): where to cut fluff, redundancy, filler, hedging, throat-clearing, and overlong phrasing. Note pacing and signposting improvements. Be concrete.
2) Precise cuts and rewrites (most important): for each item, QUOTE the exact original span to cut or reword, include its first and last 5 characters in quotes to locate it, and give:
   - Original: "…quoted span…"
   - Location hint: "…first5…" → "…last5…"
   - Action: CUT or REWORD
   - Replacement (if REWORD): "…shorter alternative…"
   - Words saved: ~N
3) Tighter rewrite: provide a rewritten version 20–35% shorter that preserves claims → warrants → impacts and clear weighing. Use crisp signposts and concise impact calculus.
4) Quick checklist: 5 one-line rules they can apply next attempt.

Student speech:
${speechText}`;
      const out = await generateAIResponse(
        "Efficiency Coach",
        prompt,
        model,
        "",
        "",
        1,
        "default",
        "default",
        "pro-first"
      );
      setAnalysis(out);
    } catch (e) {
      console.error(e);
      setError("Failed to analyze speech. Please try again.");
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
          {analysis && (
            <div className="speech-feedback-output">
              <label className="speech-feedback-label">AI Feedback</label>
              <pre>{analysis}</pre>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default DebateTrainer;

