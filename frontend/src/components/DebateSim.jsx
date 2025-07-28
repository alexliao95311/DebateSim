import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import { auth } from "../firebase/firebaseConfig";
import { signOut, getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import ShareModal from "./ShareModal";
import PDFGenerator from "../utils/pdfGenerator";
import { 
  Users, 
  Bot, 
  UserCheck, 
  PlayCircle, 
  History, 
  User,
  LogOut,
  Award,
  ChevronRight,
  X,
  Download,
  Share2,
  Clock,
  MessageSquare,
  Code
} 
from "lucide-react";
import "./DebateSim.css";
import Footer from "./Footer.jsx";

function DebateSim({ user }) {
  const [mode, setMode] = useState("");
  const [debateTopic, setDebateTopic] = useState("AI does more good than harm");
  const [history, setHistory] = useState([]);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [pdfError, setPdfError] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hoveredMode, setHoveredMode] = useState(null);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const pdfContentRef = useRef(null);

  // Immediate scroll reset using useLayoutEffect
  useLayoutEffect(() => {
    // Multiple scroll reset methods to ensure it works
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // Animation trigger
  useEffect(() => {
    // Start animations after a brief delay
    const animationTimer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(animationTimer);
  }, []);

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

  const modes = [
    {
      id: "ai-vs-ai",
      title: "AI vs AI",
      description: "Watch two AI systems debate each other with advanced reasoning and counter-arguments",
      icon: <Bot size={48} />,
      tags: ["Automated", "Analysis"],
      color: "from-blue-500 to-purple-600"
    },
    {
      id: "ai-vs-user",
      title: "AI vs User",
      description: "Challenge yourself against AI. Test your debating skills and learn new perspectives",
      icon: <UserCheck size={48} />,
      tags: ["Interactive", "Educational"],
      color: "from-green-500 to-teal-600"
    },
    {
      id: "user-vs-user",
      title: "User vs User",
      description: "Debate with friends or colleagues. Perfect for educational discussions and team activities",
      icon: <Users size={48} />,
      tags: ["Collaborative", "Social"],
      color: "from-orange-500 to-red-600"
    }
  ];

  const handleStartDebate = () => {
    if (!mode) {
      alert("Please select a debate mode before starting.");
      return;
    }
    if (!debateTopic.trim()) {
      alert("Please enter a debate topic.");
      return;
    }
    navigate("/debate", { state: { mode, topic: debateTopic } });
  };

  const handleLogout = () => {
    // Reset scroll position before logout
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    signOut(getAuth())
      .then(() => {
        // Additional scroll reset after navigation
        setTimeout(() => {
          window.scrollTo(0, 0);
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        }, 0);
        navigate("/");
      })
      .catch((err) => console.error("Logout error:", err));
  };

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
    if (item.activityType === 'Analyze Bill') return 'debatesim-type-analyze';
    if (item.activityType === 'Debate Bill' || item.mode === 'bill-debate') return 'debatesim-type-bill-debate';
    if (item.activityType === 'Debate Topic') return 'debatesim-type-topic-debate';
    if (item.mode === 'ai-vs-ai') return 'debatesim-type-ai-vs-ai';
    if (item.mode === 'ai-vs-user') return 'debatesim-type-ai-vs-user';
    if (item.mode === 'user-vs-user') return 'debatesim-type-user-vs-user';
    return 'debatesim-type-default';
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
    <div className={`debatesim-container ${showHistorySidebar ? 'debatesim-sidebar-open' : ''}`}>
      <header className="debatesim-header">
        <div className="debatesim-header-content">
          {/* LEFT SECTION: History Button */}
          <div className="debatesim-header-left">
            <button
              className="debatesim-history-button"
              onClick={() => setShowHistorySidebar(!showHistorySidebar)}
            >
              <History size={18} />
              <span>History</span>
            </button>
          </div>

          {/* CENTER SECTION: Title */}
          <div className="debatesim-header-center">
            <h1 className="debatesim-site-title" onClick={() => navigate("/")}>
              Debate Simulator
            </h1>
          </div>

          {/* RIGHT SECTION: User + Logout */}
          <div className="debatesim-header-right">
            <div className="debatesim-user-section">
              <div className="debatesim-user-info">
                <User size={18} />
                <span>{user?.displayName}</span>
              </div>
              <button className="debatesim-logout-button" onClick={handleLogout}>
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="debatesim-main-content">
        {/* Hero Section */}
        <div className={`debatesim-hero-section ${isVisible ? 'debatesim-visible' : ''}`}>
          <h1 className="debatesim-welcome-message">
            Welcome back, <span className="debatesim-username-highlight">{user?.displayName}</span>
          </h1>
          <p className="debatesim-hero-subtitle">
            Choose your debate mode and engage in thoughtful discussions
          </p>
        </div>

        {/* Mode Selection Section */}
        <div className={`debatesim-section ${isVisible ? 'debatesim-visible' : ''}`} style={{ animationDelay: '0.2s' }}>
          <h2 className="debatesim-section-title">Select a Debate Mode</h2>
          <div className="debatesim-mode-grid">
            {modes.map((modeOption, index) => (
              <div
                key={modeOption.id}
                className={`debatesim-mode-card ${mode === modeOption.id ? 'debatesim-selected' : ''}`}
                onMouseEnter={() => setHoveredMode(modeOption.id)}
                onMouseLeave={() => setHoveredMode(null)}
                style={{ animationDelay: `${0.3 + index * 0.1}s` }}
              >
                <div className="debatesim-mode-icon">
                  {modeOption.icon}
                </div>
                <h3 className="debatesim-mode-title">{modeOption.title}</h3>
                <p className="debatesim-mode-description">{modeOption.description}</p>
                <div className="debatesim-mode-tags">
                  {modeOption.tags.map((tag, tagIndex) => (
                    <span key={tagIndex} className="debatesim-mode-tag">
                      {tag}
                    </span>
                  ))}
                </div>
                <button 
                  className={`debatesim-mode-select-btn ${mode === modeOption.id ? 'debatesim-selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMode(modeOption.id);
                  }}
                >
                  {mode === modeOption.id ? (
                    <>
                      <span>✓ Selected</span>
                    </>
                  ) : (
                    <>
                      <span>Select Mode</span>
                      <ChevronRight size={16} />
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Topic Input Section */}
        <div className={`debatesim-section ${isVisible ? 'debatesim-visible' : ''}`} style={{ animationDelay: '0.6s' }}>
          <h2 className="debatesim-section-title">Enter Debate Topic</h2>
          <div className="debatesim-input-section">
            <div className="debatesim-input-container">
              <input
                ref={inputRef}
                className="debatesim-topic-input"
                type="text"
                placeholder="Enter a compelling debate topic..."
                value={debateTopic}
                onChange={(e) => setDebateTopic(e.target.value)}
              />
              {debateTopic && (
                <button 
                  className="debatesim-clear-button" 
                  onClick={() => setDebateTopic("")}
                  title="Clear input"
                >
                  ❌
                </button>
              )}
            </div>
            
            <button 
              className="debatesim-start-button" 
              onClick={handleStartDebate}
              disabled={!mode || !debateTopic.trim()}
            >
              <PlayCircle size={20} />
              Start Debate
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* History Sidebar */}
      <div className={`debatesim-history-sidebar ${showHistorySidebar ? 'debatesim-expanded' : ''}`}>
        <h2>Debate History</h2>
        <ul className="debatesim-history-list">
          {history.length > 0 ? (
            history.map((item) => (
              <li
                key={item.id}
                className="debatesim-history-item"
                onClick={() => setSelectedHistory(item)}
                title="Click to view full transcript"
              >
                <div className="debatesim-history-title">{item.topic || "Untitled Topic"}</div>
                <div className="debatesim-history-meta">
                  <span className={`debatesim-history-type ${getActivityTypeClass(item)}`}>
                    {getActivityTypeDisplay(item)}
                  </span>
                  <span className="debatesim-history-date">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
              </li>
            ))
          ) : (
            <li className="debatesim-history-item" style={{ textAlign: 'center', color: '#94a3b8' }}>
              <Clock size={24} style={{ margin: '0 auto 0.5rem auto' }} />
              No history available
            </li>
          )}
        </ul>
        <button 
          className="debatesim-close-sidebar-button"
          onClick={() => setShowHistorySidebar(false)}
        >
          Close History
        </button>
      </div>

      {/* Modal to view selected history transcript */}
      {selectedHistory && (
        <div className="debatesim-history-modal">
          <div className="debatesim-modal-content">
            <div className="debatesim-modal-header">
              <button 
                className="debatesim-modal-header-share" 
                onClick={() => setShowShareModal(true)}
                title="Share this transcript"
              >
                <Share2 size={18} />
              </button>
              <h2>{selectedHistory.topic ? selectedHistory.topic : "Untitled Topic"}</h2>
              <button 
                className="debatesim-modal-header-close" 
                onClick={() => setSelectedHistory(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="debatesim-transcript-viewer">
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
            <div className="debatesim-modal-button-group">
              <button 
                className="debatesim-share-button" 
                onClick={() => setShowShareModal(true)}
              >
                <Share2 size={16} />
                Share
              </button>
              <button 
                className="debatesim-download-button" 
                onClick={handleDownloadPDF}
              >
                <Download size={16} />
                Download PDF
              </button>
              <button 
                className="debatesim-close-button" 
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
      <Footer />
    </div>
  );
}

export default DebateSim;