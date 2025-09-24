import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import ShareModal from "./ShareModal";
import PDFGenerator from "../utils/pdfGenerator";
import UserDropdown from "./UserDropdown";
import {
  History as HistoryIcon,
  Clock,
  MessageSquare,
  Search,
  Filter,
  X,
  Download,
  Share2,
  ArrowLeft
} from "lucide-react";
import "./Home.css"; // Reuse existing styles
import "./HistorySidebar.css"; // For the modal styles
import "./Legislation.css"; // For grading section styles
import Footer from "./Footer.jsx";
import { useNavigate } from "react-router-dom";

// Circular Progress Component for grading display
const CircularProgress = ({ percentage, size = 80, strokeWidth = 8, color = '#4a90e2' }) => {
  const radius = (size - strokeWidth) / 2;
  const strokeDasharray = 2 * Math.PI * radius;
  const strokeDashoffset = strokeDasharray - (percentage / 100) * strokeDasharray;

  return (
    <div className="circular-progress" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke="#e2e8f0"
          fill="transparent"
        />
        <circle
          className="progress-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          style={{ stroke: color }}
        />
      </svg>
      <div className="progress-text" style={{ color }}>
        {Math.round(percentage)}%
      </div>
    </div>
  );
};

// Grade Item Component
const GradeItem = ({ label, percentage, description, tooltip, icon, category, isOverall = false, showTooltip = true }) => {
  const getGradeClass = (score) => {
    if (score >= 90) return 'grade-excellent';
    if (score >= 70) return 'grade-good';
    if (score >= 50) return 'grade-fair';
    if (score >= 30) return 'grade-poor';
    return 'grade-very-poor';
  };

  const getGradeColor = (score) => {
    if (score >= 90) return '#28a745';
    if (score >= 70) return '#20c997';
    if (score >= 50) return '#ffc107';
    if (score >= 30) return '#fd7e14';
    return '#dc3545';
  };

  const gradeClass = getGradeClass(percentage);
  const gradeColor = getGradeColor(percentage);

  return (
    <div className={`grade-item ${gradeClass} ${category} ${isOverall ? 'overall' : ''}`}>
      <div className="grade-header">
        <span className="grade-icon">{icon}</span>
        <div className="grade-label">{label}</div>
      </div>
      <CircularProgress
        percentage={percentage}
        size={isOverall ? 90 : 90}
        strokeWidth={isOverall ? 8 : 8}
        color={gradeColor}
      />
      <div className="grade-description">{description}</div>
      {tooltip && showTooltip && (
        <div className="tooltip">
          {tooltip}
        </div>
      )}
    </div>
  );
};

// Bill Grading Section Component
const BillGradingSection = ({ grades }) => {
  const gradingCriteria = {
    economicImpact: {
      label: 'Economic Impact',
      description: 'Fiscal responsibility & benefits',
      tooltip: 'Economic benefits and fiscal impact',
      icon: '💰',
      category: 'moderate',
      order: 1
    },
    publicBenefit: {
      label: 'Public Benefit',
      description: 'Benefits to citizens',
      tooltip: 'Addresses public needs effectively',
      icon: '👥',
      category: 'positive',
      order: 2
    },
    feasibility: {
      label: 'Implementation Feasibility',
      description: 'Practicality of execution',
      tooltip: 'Can be realistically implemented',
      icon: '🛠',
      category: 'caution',
      order: 3
    },
    legalSoundness: {
      label: 'Legal Soundness',
      description: 'Constitutional compliance',
      tooltip: 'Constitutional and legal compliance',
      icon: '⚖️',
      category: 'positive',
      order: 4
    },
    effectiveness: {
      label: 'Goal Effectiveness',
      description: 'Achievement of stated objectives',
      tooltip: 'Achieves stated objectives well',
      icon: '🎯',
      category: 'moderate',
      order: 5
    },
    overall: {
      label: 'Overall Rating',
      description: 'Comprehensive assessment',
      tooltip: 'Weighted average of all criteria',
      icon: '📊',
      category: 'overall',
      order: 6
    }
  };

  return (
    <div className="grading-section">
      <div className="grading-header">
        <h2>Bill Analysis Grades</h2>
        <div className="grading-subtitle">Comprehensive evaluation based on key criteria</div>
      </div>

      <div className="grading-grid">
        {Object.entries(gradingCriteria)
          .sort(([,a], [,b]) => a.order - b.order)
          .map(([key, criteria]) => {
            const isOverall = key === 'overall';
            const percentage = grades[key] || 0;

            return (
              <GradeItem
                key={key}
                label={criteria.label}
                percentage={percentage}
                description={criteria.description}
                tooltip={criteria.tooltip}
                icon={criteria.icon}
                category={criteria.category}
                isOverall={isOverall}
                showTooltip={false}
              />
            );
          })}
      </div>
    </div>
  );
};

function History({ user, onLogout }) {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showShareModal, setShowShareModal] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const pdfContentRef = useRef(null);

  // Immediate scroll reset
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // Fetch history data
  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;

      try {
        const db = getFirestore();
        let historyData = [];

        if (user.displayName === "guest") {
          // For guest users, check if they have any stored history in localStorage
          const guestHistory = localStorage.getItem("guestHistory");
          if (guestHistory) {
            historyData = JSON.parse(guestHistory);
          }
        } else {
          // For authenticated users, fetch from Firestore
          const transcriptsRef = collection(db, "users", user.uid, "transcripts");
          const q = query(transcriptsRef, orderBy("createdAt", "desc"));
          const querySnapshot = await getDocs(q);

          querySnapshot.forEach((doc) => {
            historyData.push({
              id: doc.id,
              ...doc.data(),
            });
          });
        }

        setHistory(historyData);
        setFilteredHistory(historyData);
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  // Filter and search history
  useEffect(() => {
    let filtered = history;

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter(item => {
        const itemType = getActivityType(item);
        if (filterType === "bill") {
          // Only show Bill Debate, not Analyze Bill
          return itemType === 'Bill Debate';
        }
        return itemType.toLowerCase().includes(filterType.toLowerCase());
      });
    }

    // Search by topic
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.topic?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredHistory(filtered);
  }, [history, searchTerm, filterType]);

  // Helper functions for activity types (from HistorySidebar)
  const getActivityType = (item) => {
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
    if (item.activityType === 'Analyze Bill') return 'history-type-analyze';
    if (item.activityType === 'Debate Bill' || item.mode === 'bill-debate') return 'history-type-bill-debate';
    if (item.activityType === 'Debate Topic') return 'history-type-topic-debate';
    if (item.mode === 'ai-vs-ai') return 'history-type-ai-vs-ai';
    if (item.mode === 'ai-vs-user') return 'history-type-ai-vs-user';
    if (item.mode === 'user-vs-user') return 'history-type-user-vs-user';
    return 'history-type-default';
  };

  const handleHistoryItemClick = (item) => {
    setSelectedHistory(item);
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

  if (loading) {
    return (
      <div className="history-loading-container" style={{
        backgroundColor: '#ededed',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
      }}>
        <div className="loading-text">Loading history...</div>
      </div>
    );
  }

  return (
    <div className="home-container">
      {/* Header */}
      <header className="home-header">
        <div className="home-header-content">
          <div className="home-header-left">
            <button
              className="history-back-button"
              onClick={() => navigate("/")}
              title="Go to Home"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '8px 16px',
                backgroundColor: 'transparent',
                border: '2px solid #374151',
                borderRadius: '8px',
                color: '#f1f5f9',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#374151';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
              }}
            >
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
          </div>

          <div className="home-header-center" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            flex: 1
          }}>
            <HistoryIcon size={32} style={{ color: 'white' }} />
            <h1 className="home-title" style={{ margin: 0, color: 'white' }}>Activity History</h1>
          </div>

          <div className="home-header-right">
            <UserDropdown user={user} onLogout={onLogout} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="home-main">
        {/* Search and Filter Section */}
        <div className="history-controls" style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div className="search-container" style={{
            position: 'relative',
            flex: '1',
            minWidth: '250px'
          }}>
            <Search size={20} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8'
            }} />
            <input
              type="text"
              placeholder="Search by topic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 12px 12px 40px',
                border: '2px solid #374151',
                borderRadius: '12px',
                fontSize: '16px',
                backgroundColor: '#1e293b',
                color: '#f1f5f9',
                transition: 'border-color 0.2s'
              }}
            />
          </div>

          <div className="filter-container" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Filter size={20} style={{ color: '#94a3b8' }} />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                padding: '12px',
                border: '2px solid #374151',
                borderRadius: '12px',
                fontSize: '16px',
                backgroundColor: '#1e293b',
                color: '#f1f5f9',
                minWidth: '150px'
              }}
            >
              <option value="all">All Types</option>
              <option value="analyze">Analyze Bill</option>
              <option value="bill">Bill Debate</option>
              <option value="topic">Topic Debate</option>
              <option value="ai">AI Debates</option>
              <option value="user">User Debates</option>
            </select>
          </div>
        </div>

        {/* History Grid */}
        <div className="history-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {filteredHistory.length > 0 ? (
            filteredHistory.map((item) => (
              <div
                key={item.id}
                className="history-card"
                onClick={() => handleHistoryItemClick(item)}
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  border: '2px solid #374151',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                  color: 'white'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2d3748';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#1e293b';
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem'
                }}>
                  <h3 style={{
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: '#f1f5f9',
                    margin: 0,
                    lineHeight: '1.4',
                    flex: 1,
                    pointerEvents: 'none'
                  }}>
                    {item.topic || "Untitled Topic"}
                  </h3>
                  <MessageSquare size={20} style={{ color: '#94a3b8', flexShrink: 0, marginLeft: '8px' }} />
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  pointerEvents: 'none'
                }}>
                  <span className={`history-type-badge ${getActivityTypeClass(item)}`} style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: '500',
                    pointerEvents: 'none'
                  }}>
                    {getActivityType(item)}
                  </span>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#94a3b8',
                    fontSize: '0.9rem',
                    pointerEvents: 'none'
                  }}>
                    <Clock size={16} />
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '4rem 2rem',
              color: '#64748b'
            }}>
              <HistoryIcon size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#475569' }}>
                {searchTerm || filterType !== "all" ? "No matching history found" : "No history available"}
              </h3>
              <p style={{ margin: 0 }}>
                {searchTerm || filterType !== "all"
                  ? "Try adjusting your search or filter criteria"
                  : "Start a debate or analysis to see your activity here"
                }
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* History Modal */}
      {selectedHistory && (
        <div className="history-history-modal">
          <div className="history-modal-content">
            <div className="history-modal-header">
              <button
                className="history-modal-header-share"
                onClick={() => setShowShareModal(true)}
                title="Share this transcript"
              >
                <Share2 size={18} />
              </button>
              <h2>{selectedHistory.topic ? selectedHistory.topic : "Untitled Topic"}</h2>
              <button
                className="history-modal-header-close"
                onClick={() => setSelectedHistory(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="history-transcript-viewer">
              {/* Show grading section for bill analysis */}
              {selectedHistory.activityType === 'Analyze Bill' && selectedHistory.grades && (
                <div className="grading-stage-container grading-loaded" style={{
                  marginBottom: '2rem',
                  position: 'relative',
                  zIndex: 1,
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  borderRadius: '20px',
                  padding: '2rem'
                }}>
                  <BillGradingSection grades={selectedHistory.grades} />
                </div>
              )}

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
            <div className="history-modal-button-group">
              <button
                className="history-share-button"
                onClick={() => setShowShareModal(true)}
              >
                <Share2 size={16} />
                Share
              </button>
              <button
                className="history-download-button"
                onClick={handleDownloadPDF}
              >
                <Download size={16} />
                Download PDF
              </button>
              <button
                className="history-close-button"
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

      {/* Custom styles for history page */}
      <style>{`
        .history-controls input::placeholder {
          color: #6b7280;
        }
        .history-controls select option {
          background-color: #1e293b;
          color: #f1f5f9;
        }
        .history-type-analyze { background-color: #dbeafe; color: #1e40af; }
        .history-type-bill-debate { background-color: #fef3c7; color: #92400e; }
        .history-type-topic-debate { background-color: #d1fae5; color: #065f46; }
        .history-type-ai-vs-ai { background-color: #e0e7ff; color: #3730a3; }
        .history-type-ai-vs-user { background-color: #fce7f3; color: #be185d; }
        .history-type-user-vs-user { background-color: #f3e8ff; color: #6b21a8; }
        .history-type-default { background-color: #f1f5f9; color: #475569; }

        @media (max-width: 768px) {
          .history-grid {
            grid-template-columns: 1fr;
          }
          .history-controls {
            flex-direction: column;
            align-items: stretch;
          }
          .search-container {
            min-width: auto;
          }
        }
      `}</style>
    </div>
  );
}

export default History;