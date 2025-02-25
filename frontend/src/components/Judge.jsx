import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import html2pdf from "html2pdf.js";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { auth } from "../firebase/firebaseConfig"; // adjust the path as needed
import { getAIJudgeFeedback } from "../api";
import "./Judge.css";

function Judge({ transcript, topic, mode, judgeModel }) {
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [timestamp] = useState(() => new Date().toLocaleString());

  // Hidden PDF container ref
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

  // Automatically save after feedback is rendered by waiting briefly.
  useEffect(() => {
    if (feedback && !saved && !saving) {
      // Delay the save to ensure that feedback is rendered in the UI.
      const timer = setTimeout(() => {
        handleSaveTranscript();
      }, 100); // 100ms delay
      return () => clearTimeout(timer);
    }
  }, [feedback, saved, saving]);

  const handleSaveTranscript = async () => {
    // If feedback is not available or already saved, exit.
    if (!feedback || saved) return;

    // Get the current user.
    const currentUser = auth.currentUser;
    // Skip saving if no user or if guest.
    if (!currentUser || (currentUser.isGuest || currentUser.uid === "guest")) {
      console.log("Guest user or no user detected; skipping save.");
      setSaved(true);
      return;
    }

    setSaving(true);
    setError("");
    try {
      // Combine debate transcript with judge feedback.
      const combinedTranscript =
        transcript +
        "\n<hr class='divider' />\n" +
        `<div class="judge-feedback">
          <h3>AI Judge Feedback:</h3>
          <p class="model-info">Model: ${judgeModel}</p>
          ${feedback}
        </div>`;

      const db = getFirestore();
      const transcriptsRef = collection(db, "users", currentUser.uid, "transcripts");
      
      await addDoc(transcriptsRef, {
        transcript: combinedTranscript,
        topic: topic,
        mode: mode,
        createdAt: new Date().toISOString()
      });
      console.log("Transcript saved automatically!");
      setSaved(true);
    } catch (err) {
      console.error("Error saving transcript:", err);
      setError("Failed to save transcript. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    setError("");
    try {
      const element = pdfContentRef.current;
      const options = {
        margin: 0.5, // inches
        filename: `debate_${Date.now()}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css"] }
      };

      await html2pdf()
        .from(element)
        .set(options)
        .toPdf()
        .get("pdf")
        .then((pdfObj) => {
          const totalPages = pdfObj.internal.getNumberOfPages();
          for (let i = 1; i <= totalPages; i++) {
            pdfObj.setPage(i);
            pdfObj.setFontSize(10);
            pdfObj.setTextColor(150);
            const pageWidth = pdfObj.internal.pageSize.getWidth();
            const pageHeight = pdfObj.internal.pageSize.getHeight();
            pdfObj.text(`Page ${i} of ${totalPages}`, pageWidth - 60, pageHeight - 10);
          }
        })
        .save();
    } catch (err) {
      setError("Failed to generate PDF. Please try again.");
      console.error("PDF generation error:", err);
    }
  };

  const handleBackToHome = () => {
    const currentUser = auth.currentUser;
    if (currentUser && (currentUser.isGuest || currentUser.uid === "guest")) {
      // Redirect to guest home page
      window.location.href = "/guest";
    } else {
      // Redirect to regular home page
      window.location.href = "/";
    }
  };

  return (
    <div className="judge-container">
      {/* ===== Visible: Transcript & Feedback sections ===== */}
      <div id="debate-content" className="debate-sections">
        <div className="transcript-section">
          <h2>Debate Transcript</h2>
          <div className="scrollable-content">
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>
              {transcript}
            </ReactMarkdown>
          </div>
        </div>

        <div className="feedback-section">
          <h2>AI Judge Feedback</h2>
          <div className="scrollable-content">
            {!feedback ? (
              <div className="loading-feedback">Analyzing debate...</div>
            ) : (
              <div className="speech-block">
                <h3>AI Judge:</h3>
                <p className="model-info">Model: {judgeModel}</p>
                <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                  {feedback}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Hidden PDF Container ===== */}
      <div style={{ display: "none" }}>
        <div ref={pdfContentRef} className="pdf-container">
          <p style={{ fontStyle: "italic", color: "#555" }}>
            Generated on: {timestamp}
          </p>
          <h1 style={{ textAlign: "center", marginTop: 0 }}>
            Debate Transcript
          </h1>
          <hr />
          <h2>Topic: {topic}</h2>
          <h3>Mode: {mode}</h3>
          <div className="page-break" />
          <h2>Debate Content</h2>
          <ReactMarkdown rehypePlugins={[rehypeRaw]}>
            {transcript}
          </ReactMarkdown>
          <div className="page-break" />
          <h2>Judge Feedback</h2>
          <div className="speech-block">
            <h3>AI Judge:</h3>
            <p className="model-info">Model: {judgeModel}</p>
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>
              {feedback}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      {/* ===== Error & Buttons ===== */}
      {error && <p className="error-text">{error}</p>}
      <div className="button-group">
        <button onClick={handleDownloadPDF}>Download as PDF</button>
        <button onClick={handleBackToHome}>Back to Home</button>
      </div>
    </div>
  );
}

export default Judge;