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
      <button onClick={handleSaveTranscript} disabled={saving}>
        {saving ? "Saving..." : "Save Transcript"}
      </button>
    </div>
  );
}

export default Judge;