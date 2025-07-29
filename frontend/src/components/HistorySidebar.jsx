import React, { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import ShareModal from "./ShareModal";
import PDFGenerator from "../utils/pdfGenerator";
import { 
  X, 
  Download, 
  Share2, 
  Clock, 
  MessageSquare 
} from "lucide-react";
import "./HistorySidebar.css";

function HistorySidebar({ 
  user, 
  history, 
  showHistorySidebar, 
  setShowHistorySidebar,
  componentPrefix = "debatesim" // allows customization for different components
}) {
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const pdfContentRef = useRef(null);

  // Helper functions for color-coded activity types
  const getActivityTypeDisplay = (item) => {
    if (item.activityType === 'Analyze Bill') return 'Analyze Bill';
    if (item.activityType === 'Debate Bill') return 'Bill Debate';
    if (item.activityType === 'Debate Topic') return 'Topic Debate';
    if (item.mode === 'bill-debate') return 'Bill Debate';
    if (item.mode === 'ai-vs-ai') return 'AI vs AI';
    if (item.mode === 'ai-vs-user') return 'AI vs User';
    if (item.mode === 'user-vs-user') return 'User vs User';
    return 'Debate';
  };

  const getActivityTypeClass = (item) => {
    if (item.activityType === 'Analyze Bill') return `${componentPrefix}-type-analyze`;
    if (item.activityType === 'Debate Bill' || item.mode === 'bill-debate') return `${componentPrefix}-type-bill-debate`;
    if (item.activityType === 'Debate Topic') return `${componentPrefix}-type-topic-debate`;
    if (item.mode === 'ai-vs-ai') return `${componentPrefix}-type-ai-vs-ai`;
    if (item.mode === 'ai-vs-user') return `${componentPrefix}-type-ai-vs-user`;
    if (item.mode === 'user-vs-user') return `${componentPrefix}-type-user-vs-user`;
    return `${componentPrefix}-type-default`;
  };

  const handleDownloadPDF = () => {
    if (!selectedHistory) return;
    
    setPdfError("");
    try {
      const pdfData = {
        topic: selectedHistory.topic || "Debate Transcript",
        transcript: selectedHistory.transcript || "No transcript available.",
        mode: selectedHistory.mode,
        activityType: selectedHistory.activityType,
        model: selectedHistory.model,
        createdAt: selectedHistory.createdAt
      };

      // Check if it's an analysis or debate
      if (selectedHistory.activityType === 'Analyze Bill') {
        PDFGenerator.generateAnalysisPDF({
          topic: selectedHistory.topic,
          content: selectedHistory.transcript,
          grades: selectedHistory.grades,
          model: selectedHistory.model,
          createdAt: selectedHistory.createdAt
        });
      } else {
        PDFGenerator.generateDebatePDF(pdfData);
      }
    } catch (err) {
      setPdfError("Failed to generate PDF. Please try again.");
      console.error("PDF generation error:", err);
    }
  };

  return (
    <>
      {/* History Sidebar */}
      <div className={`${componentPrefix}-history-sidebar ${showHistorySidebar ? `${componentPrefix}-expanded` : ''}`}>
        <h2>{componentPrefix === 'home' ? 'Activity History' : 'Debate History'}</h2>
        <ul className={`${componentPrefix}-history-list`}>
          {history.length > 0 ? (
            history.map((item) => (
              <li
                key={item.id}
                className={`${componentPrefix}-history-item`}
                onClick={() => setSelectedHistory(item)}
                title="Click to view full transcript"
              >
                <div className={`${componentPrefix}-history-title`}>{item.topic || "Untitled Topic"}</div>
                <div className={`${componentPrefix}-history-meta`}>
                  <span className={`${componentPrefix}-history-type ${getActivityTypeClass(item)}`}>
                    {getActivityTypeDisplay(item)}
                  </span>
                  <span className={`${componentPrefix}-history-date`}>{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
              </li>
            ))
          ) : (
            <li className={`${componentPrefix}-history-item`} style={{ textAlign: 'center', color: '#94a3b8' }}>
              <Clock size={24} style={{ margin: '0 auto 0.5rem auto' }} />
              No history available
            </li>
          )}
        </ul>
        <button 
          className={`${componentPrefix}-close-sidebar-button`}
          onClick={() => setShowHistorySidebar(false)}
        >
          Close History
        </button>
      </div>

      {/* Modal to view selected history transcript */}
      {selectedHistory && (
        <div className={`${componentPrefix}-history-modal`}>
          <div className={`${componentPrefix}-modal-content`}>
            <div className={`${componentPrefix}-modal-header`}>
              <button 
                className={`${componentPrefix}-modal-header-share`} 
                onClick={() => setShowShareModal(true)}
                title="Share this transcript"
              >
                <Share2 size={18} />
              </button>
              <h2>{selectedHistory.topic ? selectedHistory.topic : "Untitled Topic"}</h2>
              <button 
                className={`${componentPrefix}-modal-header-close`} 
                onClick={() => setSelectedHistory(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className={`${componentPrefix}-transcript-viewer`}>
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
                {selectedHistory.transcript
                  ? selectedHistory.transcript
                  : "No transcript available."}
              </ReactMarkdown>
            </div>
            
            {/* Error message and download button */}
            {pdfError && <p className="error-text">{pdfError}</p>}
            <div className={`${componentPrefix}-modal-button-group`}>
              <button 
                className={`${componentPrefix}-share-button`} 
                onClick={() => setShowShareModal(true)}
              >
                <Share2 size={16} />
                Share
              </button>
              <button 
                className={`${componentPrefix}-download-button`} 
                onClick={handleDownloadPDF}
              >
                <Download size={16} />
                Download PDF
              </button>
              <button 
                className={`${componentPrefix}-close-button`} 
                onClick={() => setSelectedHistory(null)}
              >
                <X size={16} />
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      <ShareModal 
        isOpen={showShareModal && !!selectedHistory}
        onClose={() => setShowShareModal(false)}
        transcript={selectedHistory}
        transcriptId={selectedHistory?.id}
      />

      {/* Hidden PDF content for export */}
      {selectedHistory && (
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
              Generated on: {new Date().toLocaleString()}
            </p>
            <h1 style={{ textAlign: "center", marginTop: 0, fontSize: "18pt" }}>
              Debate Transcript
            </h1>
            <hr />
            <h2 style={{ fontSize: "16pt" }}>
              Topic: {selectedHistory.topic || "Untitled Topic"}
            </h2>
            {selectedHistory.mode && (
              <h3 style={{ fontSize: "14pt" }}>Mode: {selectedHistory.mode}</h3>
            )}
            <div className="page-break" style={{ pageBreakBefore: "always" }} />
            <h2 style={{ fontSize: "16pt" }}>Debate Content</h2>
            <ReactMarkdown rehypePlugins={[rehypeRaw]} style={{ fontSize: "12pt" }}>
              {selectedHistory.transcript || "No transcript available."}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </>
  );
}

export default HistorySidebar; 