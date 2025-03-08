import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import html2pdf from "html2pdf.js";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { auth } from "../firebase/firebaseConfig"; // adjust the path as needed
import { getAIJudgeFeedback } from "../api";
import "./Judge.css";
import { jsPDF } from "jspdf";

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

  
  
const handleDownloadPDF = () => {
  setError("");
  try {
    const element = pdfContentRef.current;
    if (!element) {
      throw new Error("PDF content element not found");
    }

    // Create a new jsPDF instance with pt units (72pt = 1in)
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "letter", // 612pt x 792pt
    });

    // Define margins: 1" top/bottom and 0.5" left/right
    const margins = [72, 36, 72, 36];

    // Set a base font size for added text (page numbers, etc.)
    pdf.setFontSize(12);

    pdf.html(element, {
      callback: (pdfInstance) => {
        // Add page numbers to each page
        const totalPages = pdfInstance.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdfInstance.setPage(i);
          pdfInstance.setFontSize(10);
          pdfInstance.setTextColor(150);

          const pageWidth = pdfInstance.internal.pageSize.getWidth();
          const pageHeight = pdfInstance.internal.pageSize.getHeight();
          pdfInstance.text(
            `Page ${i} of ${totalPages}`,
            pageWidth - margins[1],
            pageHeight - 18, // ~0.25 in from bottom
            { align: "right" }
          );
        }
        pdfInstance.save(`debate_${Date.now()}.pdf`);
      },
      // Use only the margin option, not x/y/width, to avoid conflicts
      margin: margins,
      autoPaging: "text",
      break: {
        // Avoid breaking inside list items, paragraphs, and headings.
        avoid: "li, p, h2, h3",
      },
      html2canvas: {
        scale: 0.75,       // Adjust scale as needed
        windowWidth: 540,  // Force viewport width to match container (7.5in = 540pt)
        useCORS: true,
      },
    });
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

      <div style={{ position: "absolute", left: "-9999px" }}>
      <div
        ref={pdfContentRef}
        className="pdf-container"
        style={{
          width: "7.5in", // Matches the 7.5in content area (612pt - 72pt margins)
          wordBreak: "break-word",
          overflowWrap: "break-word",
          whiteSpace: "normal",
          lineHeight: "1.4",
          // Ensure lists do not break mid-item
        }}
      >
        <style>
          {`
            li, p, h2, h3 {
              page-break-inside: avoid;
              break-inside: avoid-page;
            }
          `}
        </style>
        <p style={{ fontStyle: "italic", color: "#555", fontSize: "10pt" }}>
          Generated on: {timestamp}
        </p>
        <h1 style={{ textAlign: "center", marginTop: 0, fontSize: "18pt" }}>
          Debate Transcript
        </h1>
        <hr />
        <h2 style={{ fontSize: "16pt" }}>Topic: {topic}</h2>
        <h3 style={{ fontSize: "14pt" }}>Mode: {mode}</h3>
        <div className="page-break" style={{ pageBreakBefore: "always" }} />
        <h2 style={{ fontSize: "16pt" }}>Debate Content</h2>
        <ReactMarkdown rehypePlugins={[rehypeRaw]} style={{ fontSize: "12pt" }}>
          {transcript}
        </ReactMarkdown>
        <div className="page-break" style={{ pageBreakBefore: "always" }} />
        <h2 style={{ fontSize: "16pt" }}>Judge Feedback</h2>
        <div className="speech-block">
          <h3 style={{ fontSize: "14pt" }}>AI Judge:</h3>
          <p className="model-info" style={{ fontSize: "10pt" }}>
            Model: {judgeModel}
          </p>
          <ReactMarkdown rehypePlugins={[rehypeRaw]} style={{ fontSize: "12pt" }}>
            {feedback}
          </ReactMarkdown>
        </div>
      </div>
    </div>

      {/* ===== Error & Buttons ===== */}
      {error && <p className="error-text">{error}</p>}
      <div className="button-group">
        <button onClick={handleDownloadPDF} disabled={!feedback}>Download as PDF</button>
        <button onClick={handleBackToHome}>Back to Home</button>
      </div>
    </div>
  );
}

export default Judge;