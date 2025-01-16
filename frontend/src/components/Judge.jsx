import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { getAIJudgeFeedback, saveTranscript } from "../api";
import "./Debate.css";

function Judge({ transcript, topic, mode }) {
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const result = await getAIJudgeFeedback(transcript);
        setFeedback(result);
      } catch (err) {
        setError("Failed to fetch judge feedback. Please try again.");
      }
    };
    fetchFeedback();
  }, [transcript]);

  const handleSaveTranscript = async () => {
    setSaving(true);
    setError("");

    try {
      const message = await saveTranscript(transcript, topic, mode, feedback);
      alert(message); // Notify user of success
    } catch (err) {
      setError("Failed to save transcript. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    // Create content for the markdown file
    const content = `# Debate Transcript\n\n` +
      `**Topic:** ${topic}\n` +
      `**Mode:** ${mode}\n\n` +
      `## Debate Transcript\n\n` +
      `${transcript}\n\n` +
      `## Judge Feedback\n\n` +
      `${feedback}`;

    // Create blob and download link
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debate_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="judge-container">
      <div className="debate-sections">
        {/* Left column: Debate Transcript */}
        <div className="transcript-section">
          <h2>Debate Transcript</h2>
          <div className="scrollable-content">
            <ReactMarkdown>{transcript}</ReactMarkdown>
          </div>
        </div>

        {/* Right column: Judge Feedback */}
        <div className="feedback-section">
          <h2>AI Judge Feedback</h2>
          <div className="scrollable-content">
            {!feedback ? (
              <div className="loading-feedback">Analyzing debate...</div>
            ) : (
              <ReactMarkdown>{feedback}</ReactMarkdown>
            )}
          </div>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      <div className="button-group">
        <button onClick={handleSaveTranscript} disabled={saving}>
          {saving ? "Saving..." : "Save to Server"}
        </button>
        <button onClick={handleDownload}>
          Download as Markdown
        </button>
      </div>
    </div>
  );
}

export default Judge;