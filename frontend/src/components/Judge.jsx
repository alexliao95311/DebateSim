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
    <div style={{ backgroundColor: "#fff", padding: "2rem", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      <h2>AI Judge Feedback</h2>
      {error && <p className="error-text">{error}</p>}
      <ReactMarkdown className="markdown-renderer">{feedback}</ReactMarkdown>
      <button onClick={handleSaveTranscript} disabled={saving}>
        {saving ? "Saving..." : "Save Transcript"}
      </button>
    </div>
  );
}

export default Judge;