import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import html2pdf from "html2pdf.js"; 
import { getAIJudgeFeedback, saveTranscript } from "../api";
import "./Debate.css";

function Judge({ transcript, topic, mode }) {
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Capture a timestamp once when the component mounts
  const [timestamp] = useState(() => new Date().toLocaleString());

  // This ref will point to our hidden PDF container
  const pdfContentRef = useRef(null);

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
      alert(message);
    } catch (err) {
      setError("Failed to save transcript. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    setError("");
    try {
      // The hidden container we want to convert
      const element = pdfContentRef.current;

      // Set your html2pdf options
      const options = {
        margin: 0.5, // in inches
        filename: `debate_${Date.now()}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
        // The 'pagebreak' object helps avoid cutting text inside blocks
        pagebreak: { mode: ["avoid-all", "css"] },
      };

      await html2pdf().from(element).set(options).save();
    } catch (err) {
      setError("Failed to generate PDF. Please try again.");
      console.error("PDF generation error:", err);
    }
  };

  return (
    <div className="judge-container">
      {/* ===== Visible UI: transcript & feedback side-by-side ===== */}
      <div id="debate-content" className="debate-sections">
        <div className="transcript-section">
          <h2>Debate Transcript</h2>
          <div className="scrollable-content">
            <ReactMarkdown>{transcript}</ReactMarkdown>
          </div>
        </div>

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

      {/* ===== Hidden PDF container (rendered, but display: none) ===== */}
      <div style={{ display: "none" }}>
        <div ref={pdfContentRef} className="pdf-container">
          {/* Timestamp at the top */}
          <p style={{ fontStyle: "italic", color: "#555", marginBottom: "0.5em" }}>
            Generated on: {timestamp}
          </p>
          <h1 style={{ textAlign: "center", marginTop: 0 }}>Debate Transcript</h1>
          <hr />

          <h2>Topic: {topic}</h2>
          <h3>Mode: {mode}</h3>

          <div className="page-break" />

          <h2>Debate Content</h2>
          <ReactMarkdown>{transcript}</ReactMarkdown>

          <div className="page-break" />

          <h2>Judge Feedback</h2>
          <ReactMarkdown>{feedback}</ReactMarkdown>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      <div className="button-group">
        <button onClick={handleSaveTranscript} disabled={saving}>
          {saving ? "Saving..." : "Save to Server"}
        </button>
        <button onClick={handleDownloadPDF}>Download as PDF</button>
      </div>
    </div>
  );
}

export default Judge;