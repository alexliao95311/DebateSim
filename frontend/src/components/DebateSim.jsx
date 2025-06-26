import React, { useState, useEffect, useRef } from "react";
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import { auth } from "../firebase/firebaseConfig";
import { signOut, getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { jsPDF } from "jspdf";
import "./DebateSim.css";

function DebateSim({ user }) {
  const [mode, setMode] = useState("");
  const [debateTopic, setDebateTopic] = useState("AI does more good than harm");
  const [history, setHistory] = useState([]);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null); // New state for selected history item
  const [pdfError, setPdfError] = useState("");
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

  const handleDownloadPDF = () => {
    if (!selectedHistory) return;
    
    setPdfError("");
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
          const fileName = selectedHistory.topic 
            ? `${selectedHistory.topic.replace(/[^a-z0-9]/gi, '_')}_transcript.pdf`
            : `debate_transcript_${Date.now()}.pdf`;
          pdfInstance.save(fileName);
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
                  {item.topic ? item.topic : "Untitled Topic"} -{" "}
                  {new Date(item.createdAt).toLocaleDateString()}
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
            <button className="modal-close" onClick={() => setSelectedHistory(null)}>
              &times;
            </button>
            <h2>{selectedHistory.topic ? selectedHistory.topic : "Untitled Topic"}</h2>
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
                className="download-button" 
                onClick={handleDownloadPDF}
              >
                Download as PDF
              </button>
              <button 
                className="close-button" 
                onClick={() => setSelectedHistory(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
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