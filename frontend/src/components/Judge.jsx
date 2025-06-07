import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import html2pdf from "html2pdf.js";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { auth } from "../firebase/firebaseConfig";
import { getAIJudgeFeedback } from "../api";
import "./Judge.css";
import { jsPDF } from "jspdf";
import { useLocation, useNavigate } from "react-router-dom";

function Judge() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Retrieve debate details from router state
  const { transcript, topic, mode, judgeModel } = location.state || {};

  // If required state is missing, redirect back to DebateSim
  if (!transcript || !topic || !mode || !judgeModel) {
    navigate("/debatesim");
    return null;
  }

  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [timestamp] = useState(() => new Date().toLocaleString());
  const [showBillText, setShowBillText] = useState(false);
  
  // Extract bill description from transcript
  const [billDescription, setBillDescription] = useState("");
  
  // Hidden PDF container ref
  const pdfContentRef = useRef(null);

  useEffect(() => {
    // Extract bill description from transcript if it exists
    const billMatch = transcript.match(/## Bill Description\s+([\s\S]*?)(?:\n## |\n### |$)/);
    if (billMatch && billMatch[1]) {
      setBillDescription(billMatch[1].trim());
    }
    
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

  // Automatically save after feedback is rendered.
  useEffect(() => {
    if (feedback && !saved && !saving) {
      const timer = setTimeout(() => {
        handleSaveTranscript();
      }, 100); // 100ms delay
      return () => clearTimeout(timer);
    }
  }, [feedback, saved, saving]);

  const handleSaveTranscript = async () => {
    if (!feedback || saved) return;
    const currentUser = auth.currentUser;
    if (!currentUser || (currentUser.isGuest || currentUser.uid === "guest")) {
      console.log("Guest user or no user detected; skipping save.");
      setSaved(true);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const combinedTranscript = `# Debate Transcript

${transcript}

---

### AI Judge Feedback
*Model: ${judgeModel}*

${feedback}`;

      const db = getFirestore();
      const transcriptsRef = collection(db, "users", currentUser.uid, "transcripts");
      
      await addDoc(transcriptsRef, {
        transcript: combinedTranscript,
        topic: topic,
        mode: mode,
        createdAt: new Date().toISOString(),
        judge_feedback: feedback
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

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "letter",
      });

      const margins = [72, 36, 72, 36];

      pdf.setFontSize(12);

      pdf.html(element, {
        callback: (pdfInstance) => {
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
              pageHeight - 18,
              { align: "right" }
            );
          }
          pdfInstance.save(`debate_${Date.now()}.pdf`);
        },
        margin: margins,
        autoPaging: "text",
        break: {
          avoid: "li, p, h2, h3",
        },
        html2canvas: {
          scale: 0.75,
          windowWidth: 540,
          useCORS: true,
        },
      });
    } catch (err) {
      setError("Failed to generate PDF. Please try again.");
      console.error("PDF generation error:", err);
    }
  };

  const handleBackToHome = () => {
    navigate("/");
  };

  // Format transcript to hide bill description unless requested
  const formattedTranscript = () => {
    if (!billDescription || showBillText) {
      return transcript;
    }
    // Remove the "## Bill Description" section from Markdown
    return transcript.replace(
      /## Bill Description\s+[\s\S]*?(?=\n## |\n### |$)/,
      ''
    );
  };

  return (
    <div className="judge-container">
      <h1 className="main-heading">Debate Results</h1>
      <h2 className="sub-heading">Topic: {topic}</h2>
      
      <div className="debate-sections-container">
        <div className="debate-sections">
          <div className="transcript-section">
            <div className="section-header">
              <h2>Debate Transcript</h2>
              {billDescription && (
                <button 
                  className="toggle-bill-text" 
                  onClick={() => setShowBillText(!showBillText)}
                >
                  {showBillText ? "Hide Bill Text" : "Show Bill Text"}
                </button>
              )}
            </div>
            <div className="scrollable-content">
              <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                {formattedTranscript()}
              </ReactMarkdown>
            </div>
          </div>

          <div className="feedback-section">
            <h2>AI Judge Feedback</h2>
            <div className="scrollable-content">
              {!feedback ? (
                <div className="loading-feedback">
                  <div className="loading-spinner"></div>
                  <p>Analyzing debate...</p>
                </div>
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
      </div>

      {/* Hidden PDF content for export */}
      <div style={{ position: "absolute", left: "-9999px" }}>
        <div
          ref={pdfContentRef}
          className="pdf-container"
          style={{
            width: "7.5in",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            whiteSpace: "normal",
            lineHeight: "1.4",
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

      {error && <p className="error-text">{error}</p>}
      <div className="button-group">
        <button 
          className="download-button" 
          onClick={handleDownloadPDF} 
          disabled={!feedback}
        >
          Download as PDF
        </button>
        <button className="home-button" onClick={handleBackToHome}>
          Back to Home
        </button>
      </div>
    </div>
  );
}

export default Judge;