import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import html2pdf from "html2pdf.js";
import { getAIJudgeFeedback } from "../api";
import { saveTranscriptToUser } from "../firebase/saveTranscript";
import LoadingSpinner from "./LoadingSpinner";
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

  // Automatically save after feedback is rendered
  useEffect(() => {
    if (feedback && !saved && !saving) {
      const timer = setTimeout(() => {
        handleSaveTranscript();
      }, 100); // 100ms delay
      return () => clearTimeout(timer);
    }
  }, [feedback, saved, saving]);

  const handleSaveTranscript = async () => {
    if (!feedback || saved || saving) return;
    
    setSaving(true);
    setError("");
    try {
      // Create a combined transcript with judge feedback
      const combinedTranscript = `${transcript}

---

# AI Judge Feedback
*Model: ${judgeModel}*

${feedback}`;

      // Determine activity type based on topic content
      let activityType;
      if (topic.includes('Bill Analysis:')) {
        activityType = 'Analyze Bill';
      } else if (billDescription || topic.toLowerCase().includes('bill') || mode === 'bill-debate') {
        activityType = 'Debate Bill';
      } else {
        activityType = 'Debate Topic';
      }
      
      // Save using the improved saveTranscriptToUser function
      await saveTranscriptToUser(combinedTranscript, topic, mode, activityType);
      console.log("Complete transcript with judge feedback saved!");
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
              <ReactMarkdown
                rehypePlugins={[rehypeRaw]}
                components={{
                  h1: ({node, ...props}) => <h1 className="debate-heading-h1" {...props} />,
                  h2: ({node, ...props}) => <h2 className="debate-heading-h2" {...props} />,
                  h3: ({node, ...props}) => <h3 className="debate-heading-h3" {...props} />,
                  h4: ({node, ...props}) => <h4 className="debate-heading-h4" {...props} />,
                  p: ({node, ...props}) => <p className="debate-paragraph" {...props} />,
                  ul: ({node, ...props}) => <ul className="debate-list" {...props} />,
                  ol: ({node, ...props}) => <ol className="debate-numbered-list" {...props} />,
                  li: ({node, ...props}) => <li className="debate-list-item" {...props} />,
                  strong: ({node, ...props}) => <strong className="debate-strong" {...props} />,
                  em: ({node, ...props}) => <em className="debate-emphasis" {...props} />,
                  hr: ({node, ...props}) => <hr className="divider" {...props} />
                }}
              >
                {formattedTranscript()}
              </ReactMarkdown>
            </div>
          </div>

          <div className="feedback-section">
            <h2>AI Judge Feedback</h2>
            <div className="scrollable-content">
              {!feedback ? (
                <LoadingSpinner 
                  message="Analyzing debate and generating judgment" 
                  showProgress={true}
                  estimatedTime={60000}
                />
              ) : (
                <div className="speech-block">
                  <h3>AI Judge:</h3>
                  <p className="model-info">Model: {judgeModel}</p>
                  <ReactMarkdown
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      h1: ({node, ...props}) => <h1 className="debate-heading-h1" {...props} />,
                      h2: ({node, ...props}) => <h2 className="debate-heading-h2" {...props} />,
                      h3: ({node, ...props}) => <h3 className="debate-heading-h3" {...props} />,
                      h4: ({node, ...props}) => <h4 className="debate-heading-h4" {...props} />,
                      p: ({node, ...props}) => <p className="debate-paragraph" {...props} />,
                      ul: ({node, ...props}) => <ul className="debate-list" {...props} />,
                      ol: ({node, ...props}) => <ol className="debate-numbered-list" {...props} />,
                      li: ({node, ...props}) => <li className="debate-list-item" {...props} />,
                      strong: ({node, ...props}) => <strong className="debate-strong" {...props} />,
                      em: ({node, ...props}) => <em className="debate-emphasis" {...props} />,
                      hr: ({node, ...props}) => <hr className="divider" {...props} />
                    }}
                  >
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
            lineHeight: "1.5",
            background: "#f5f8fa",
            color: "#222",
            padding: "32px",
            borderRadius: "12px",
            fontFamily: "Segoe UI, Arial, sans-serif"
          }}
        >
          <style>
            {`
              .pdf-container {
                background: #f5f8fa !important;
                color: #222 !important;
                font-family: 'Segoe UI', Arial, sans-serif !important;
              }
              h1, .debate-heading-h1 {
                color: #1a365d !important;
                font-size: 2rem !important;
                font-weight: 700;
                margin-top: 0.5em;
                margin-bottom: 0.5em;
                text-align: center;
                border-bottom: 2px solid #4a90e2;
                padding-bottom: 0.2em;
              }
              h2, .debate-heading-h2 {
                color: #205081 !important;
                font-size: 1.3rem !important;
                font-weight: 600;
                margin-top: 1.2em;
                margin-bottom: 0.5em;
                border-bottom: 1px solid #b6c6e3;
                padding-bottom: 0.15em;
              }
              h3, .debate-heading-h3 {
                color: #2d6cdf !important;
                font-size: 1.1rem !important;
                font-weight: 600;
                margin-top: 1em;
                margin-bottom: 0.4em;
              }
              h4, .debate-heading-h4 {
                color: #4a90e2 !important;
                font-size: 1rem !important;
                font-weight: 600;
                margin-top: 0.8em;
                margin-bottom: 0.3em;
              }
              .model-info {
                color: #4a90e2 !important;
                font-weight: bold;
                font-size: 0.95rem !important;
              }
              .debate-paragraph, p {
                color: #222 !important;
                font-size: 1rem !important;
                margin-bottom: 0.7em;
              }
              .debate-list, ul {
                margin-left: 1.2em;
                color: #222 !important;
              }
              .debate-numbered-list, ol {
                margin-left: 1.2em;
                color: #222 !important;
              }
              .debate-list-item, li {
                margin-bottom: 0.3em;
              }
              .debate-strong, strong {
                color: #1a365d !important;
                font-weight: bold;
              }
              .debate-emphasis, em {
                color: #2d6cdf !important;
                font-style: italic;
              }
              .divider, hr {
                border: none;
                border-top: 1.5px solid #b6c6e3;
                margin: 1.2em 0;
              }
              .speech-block {
                background: #eaf1fb;
                border-radius: 8px;
                padding: 16px 18px;
                margin-bottom: 1.2em;
                box-shadow: 0 1px 4px rgba(74,144,226,0.07);
              }
              .error-text {
                color: #e53e3e !important;
              }
              .page-break {
                page-break-before: always;
              }
              li, p, h2, h3 {
                page-break-inside: avoid;
                break-inside: avoid-page;
              }
            `}
          </style>
          <p style={{ fontStyle: "italic", color: "#555", fontSize: "10pt" }}>
            Generated on: {timestamp}
          </p>
          <h1 className="debate-heading-h1" style={{ textAlign: "center", marginTop: 0 }}>
            Debate Transcript
          </h1>
          <hr className="divider" />
          <h2 className="debate-heading-h2">Topic: {topic}</h2>
          <h3 className="debate-heading-h3">Mode: {mode}</h3>
          <div className="page-break" style={{ pageBreakBefore: "always" }} />
          <h2 className="debate-heading-h2">Debate Content</h2>
          <ReactMarkdown rehypePlugins={[rehypeRaw]}>
            {transcript}
          </ReactMarkdown>
          <div className="page-break" style={{ pageBreakBefore: "always" }} />
          <h2 className="debate-heading-h2">Judge Feedback</h2>
          <div className="speech-block">
            <h3 className="debate-heading-h3">AI Judge:</h3>
            <p className="model-info">
              Model: {judgeModel}
            </p>
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>
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