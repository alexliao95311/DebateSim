import React, { useState, useEffect, useRef } from "react";
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import { auth } from "../firebase/firebaseConfig";
import { signOut, getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import ShareModal from "./ShareModal";
import "./DebateSim.css";
import PDFGenerator from "../utils/pdfGenerator";

function DebateSim({ user }) {
  const [mode, setMode] = useState("");
  const [debateTopic, setDebateTopic] = useState("AI does more good than harm");
  const [history, setHistory] = useState([]);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null); // New state for selected history item
  const [pdfError, setPdfError] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const pdfContentRef = useRef(null);

  // Fetch history on load
  useEffect(() => {
    async function fetchHistory() {
      if (!user || user.isGuest) return;
      try {
        const db = getFirestore();
        const transcriptsRef = collection(db, "users", user.uid, "transcripts");
        const q = query(transcriptsRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const fetchedHistory = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setHistory(fetchedHistory);
        }
      } catch (err) {
        console.error("Error fetching debate history:", err);
      }
    }
    fetchHistory();
  }, [user]);

  const handleStartDebate = () => {
    if (!mode) {
      alert("Please select a debate mode before starting.");
      return;
    }
    // Check if debate topic is blank
    if (!debateTopic.trim()) {
      alert("Please enter a debate topic.");
      return;
    }
    navigate("/debate", { state: { mode, topic: debateTopic } });
  };

  const handleLogout = () => {
    signOut(getAuth())
      .then(() => {
        navigate("/");
      })
      .catch((err) => console.error("Logout error:", err));
  };

  // Helper functions for color-coded activity types (matching Legislation.jsx)
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
    if (item.activityType === 'Analyze Bill') return 'type-analyze';
    if (item.activityType === 'Debate Bill' || item.mode === 'bill-debate') return 'type-bill-debate';
    if (item.activityType === 'Debate Topic') return 'type-topic-debate';
    if (item.mode === 'ai-vs-ai') return 'type-ai-vs-ai';
    if (item.mode === 'ai-vs-user') return 'type-ai-vs-user';
    if (item.mode === 'user-vs-user') return 'type-user-vs-user';
    return 'type-default';
  };

  const handleDownloadPDF = () => {
    if (!selectedHistory) return;
    
    setPdfError("");
    try {
      // Prepare data for the PDF generator
      const pdfData = {
        topic: selectedHistory.topic || "Debate Transcript",
        transcript: selectedHistory.transcript || "No transcript available.",
        mode: selectedHistory.mode,
        activityType: selectedHistory.activityType,
        model: selectedHistory.model,
        createdAt: selectedHistory.createdAt
      };

      // Generate professional PDF
      PDFGenerator.generateDebatePDF(pdfData);
    } catch (err) {
      setPdfError("Failed to generate PDF. Please try again.");
      console.error("PDF generation error:", err);
    }
  };

  return (
    <div className={`home-container ${showHistorySidebar ? 'sidebar-open' : ''}`}>
      <header className="home-header">
        <div className="header-content">
          {/* LEFT SECTION: History Button */}
          <div className="header-left">
            <button
              className="history-button"
              onClick={() => setShowHistorySidebar(!showHistorySidebar)}
            >
              History
            </button>
          </div>

          {/* CENTER SECTION: Title */}
          <div className="header-center">
            <h1 onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
              Debate Simulator
            </h1>
          </div>

          {/* RIGHT SECTION: User + Logout */}
          <div className="header-right">
            <div className="user-section">
              <span className="username">{user?.displayName}</span>
              <button className="logout-button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="main-content">
        <h1 className="welcome-message">Welcome, {user?.displayName}</h1>
        <h2>Select a Debate Mode</h2>
        <div className="mode-buttons">
          <button
            className={mode === "ai-vs-ai" ? "selected-mode" : ""}
            onClick={() => setMode("ai-vs-ai")}
          >
            AI vs AI
          </button>
          <button
            className={mode === "ai-vs-user" ? "selected-mode" : ""}
            onClick={() => setMode("ai-vs-user")}
          >
            AI vs User
          </button>
          <button
            className={mode === "user-vs-user" ? "selected-mode" : ""}
            onClick={() => setMode("user-vs-user")}
          >
            User vs User
          </button>
        </div>

        <h2>Enter Debate Topic</h2>
        <div className="input-container">
          <input
            ref={inputRef}
            type="text"
            placeholder="Enter a debate topic..."
            value={debateTopic}
            onChange={(e) => setDebateTopic(e.target.value)}
          />
          {debateTopic && (
            <button className="clear-button" onClick={() => setDebateTopic("")}>
              &times;
            </button>
          )}
        </div>

        <button className="start-debate-button" onClick={handleStartDebate}>
          Start Debate
        </button>
      </div>

      {showHistorySidebar && (
        <div className={`history-sidebar ${showHistorySidebar ? 'expanded' : ''}`}>
          <h2>Debate History</h2>
          <ul>
            {history.length > 0 ? (
              history.map((item) => (
                <li
                  key={item.id}
                  onClick={() => setSelectedHistory(item)}
                  title="Click to view full transcript"
                >
                  <div className="history-item">
                    <div className="history-title">{item.topic || "Untitled Topic"}</div>
                    <div className="history-meta">
                      <span className={`history-type ${getActivityTypeClass(item)}`}>
                        {getActivityTypeDisplay(item)}
                      </span>
                      <span className="history-date">{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li>No history available</li>
            )}
          </ul>
          <button onClick={() => setShowHistorySidebar(false)}>Close</button>
        </div>
      )}

      {/* Modal to view selected history transcript */}
      {selectedHistory && (
        <div className="history-modal">
          <div className="modal-content">
            <div className="modal-header">
              <button 
                className="modal-header-share" 
                onClick={() => setShowShareModal(true)}
                title="Share this transcript"
              >
                📤
              </button>
              <h2>{selectedHistory.topic ? selectedHistory.topic : "Untitled Topic"}</h2>
              <button className="modal-header-close" onClick={() => setSelectedHistory(null)}>
                ❌
              </button>
            </div>
            <div className="transcript-viewer">
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
            <div className="modal-button-group">
              <button 
                className="share-button" 
                onClick={() => setShowShareModal(true)}
              >
                📤 Share
              </button>
              <button 
                className="download-button" 
                onClick={handleDownloadPDF}
              >
                📄 Download PDF
              </button>
              <button 
                className="close-button" 
                onClick={() => setSelectedHistory(null)}
              >
                ❌ Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {selectedHistory && (
        <ShareModal 
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          transcript={selectedHistory}
          transcriptId={selectedHistory.id}
        />
      )}

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

      <footer className="bottom-text">
        <a
          href="https://github.com/alexliao95311/DebateSim"
          target="_blank"
          rel="noopener noreferrer"
          className="github-link"
        >
          GitHub
        </a>
        <span>&copy; {new Date().getFullYear()} DebateSim. All rights reserved.</span>
      </footer>
    </div>
  );
}

export default DebateSim;