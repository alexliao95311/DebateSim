import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { getFirestore, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import ShareModal from "./ShareModal";
import PDFGenerator from "../utils/pdfGenerator";
import UserDropdown from "./UserDropdown";
import { useTranslation } from '../utils/translations';
import {
  History as HistoryIcon,
  Clock,
  MessageSquare,
  Search,
  Filter,
  X,
  Download,
  Share2,
  Trophy,
  Users
} from "lucide-react";
import "./Home.css";
import "./HistorySidebar.css";
import Footer from "./Footer.jsx";
import { useNavigate } from "react-router-dom";

function SimulatedDebateHistory({ user, onLogout }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterModel, setFilterModel] = useState("all");
  const [showShareModal, setShowShareModal] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const pdfContentRef = useRef(null);

  // Immediate scroll reset
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // Fetch simulated debate history from Firebase
  useEffect(() => {
    const fetchSimulatedDebates = async () => {
      try {
        const db = getFirestore();
        const debatesRef = collection(db, "simulatedDebates");
        const q = query(debatesRef, orderBy("createdAt", "desc"), limit(100));
        const querySnapshot = await getDocs(q);

        const debatesData = [];
        querySnapshot.forEach((doc) => {
          debatesData.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        setHistory(debatesData);
        setFilteredHistory(debatesData);
      } catch (error) {
        console.error("Error fetching simulated debates:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSimulatedDebates();
  }, []);

  // Filter and search history
  useEffect(() => {
    let filtered = history;

    // Filter by model
    if (filterModel !== "all") {
      filtered = filtered.filter(item =>
        item.model1?.includes(filterModel) || item.model2?.includes(filterModel)
      );
    }

    // Search by topic
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.topic?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredHistory(filtered);
  }, [history, searchTerm, filterModel]);

  const getWinnerBadge = (item) => {
    if (!item.winner) return null;

    const getBadgeStyle = (winner) => {
      if (winner === 'model1') return { bg: '#dcfce7', color: '#166534', text: 'Pro Wins' };
      if (winner === 'model2') return { bg: '#fee2e2', color: '#991b1b', text: 'Con Wins' };
      return { bg: '#fef3c7', color: '#92400e', text: 'Draw' };
    };

    const style = getBadgeStyle(item.winner);
    return (
      <span style={{
        backgroundColor: style.bg,
        color: style.color,
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '0.85rem',
        fontWeight: '500',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <Trophy size={14} />
        {style.text}
      </span>
    );
  };

  const formatModelName = (model) => {
    if (!model) return '';
    return model.replace('openai/', '').replace('meta-llama/', '').replace('google/', '').replace('anthropic/', '');
  };

  const handleHistoryItemClick = (item) => {
    setSelectedHistory(item);
  };

  const handleDownloadPDF = () => {
    if (!selectedHistory) return;

    setPdfError("");
    try {
      const pdfData = {
        topic: selectedHistory.topic || "Simulated Debate Transcript",
        transcript: selectedHistory.transcript || "No transcript available.",
        mode: selectedHistory.mode || 'ai-vs-ai',
        activityType: 'Simulated Debate',
        model: `${formatModelName(selectedHistory.model1)} vs ${formatModelName(selectedHistory.model2)}`,
        createdAt: selectedHistory.createdAt?.toDate ? selectedHistory.createdAt.toDate().toISOString() : selectedHistory.createdAt,
        judgeModel: selectedHistory.judge_model,
        winner: selectedHistory.winner
      };

      PDFGenerator.generateDebatePDF(pdfData);
    } catch (err) {
      setPdfError("Failed to generate PDF");
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
        <div className="loading-text">Loading simulated debates...</div>
      </div>
    );
  }

  return (
    <div className="home-container">
      {/* Header */}
      <header className="home-header">
        <div className="home-header-content">
          <div className="home-header-left">
            {/* Empty space for alignment */}
          </div>

          <div className="home-header-center" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            flex: 1,
            cursor: 'pointer'
          }}
          onClick={() => navigate('/')}
          >
            <Trophy size={28} style={{ color: '#f59e0b' }} />
            <h1 className="home-site-title">Simulated Debate History</h1>
          </div>

          <div className="home-header-right">
            <UserDropdown user={user} onLogout={onLogout} className="home-user-dropdown" />
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
              placeholder="Search debates by topic..."
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
              value={filterModel}
              onChange={(e) => setFilterModel(e.target.value)}
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
              <option value="all">All Models</option>
              <option value="gpt">GPT</option>
              <option value="claude">Claude</option>
              <option value="gemini">Gemini</option>
              <option value="llama">Llama</option>
              <option value="grok">Grok</option>
            </select>
          </div>
        </div>

        {/* History Grid */}
        <div className="history-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
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
                    {item.topic || "Untitled Debate"}
                  </h3>
                  <MessageSquare size={20} style={{ color: '#94a3b8', flexShrink: 0, marginLeft: '8px' }} />
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '0.75rem',
                  pointerEvents: 'none'
                }}>
                  <Users size={16} style={{ color: '#94a3b8' }} />
                  <span style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                    {formatModelName(item.model1)} ({Math.round(item.model1_elo || 1500)}) vs {formatModelName(item.model2)} ({Math.round(item.model2_elo || 1500)})
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  pointerEvents: 'none'
                }}>
                  {getWinnerBadge(item)}

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#94a3b8',
                    fontSize: '0.9rem',
                    pointerEvents: 'none'
                  }}>
                    <Clock size={16} />
                    <span>
                      {item.createdAt?.toDate
                        ? item.createdAt.toDate().toLocaleDateString()
                        : 'Unknown date'}
                    </span>
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
                No simulated debates found
              </h3>
              <p style={{ margin: 0 }}>
                {searchTerm || filterModel !== "all"
                  ? "Try adjusting your search or filters"
                  : "Simulated debates will appear here after they're run"
                }
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Debate Modal */}
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
              <h2>{selectedHistory.topic || "Untitled Debate"}</h2>
              <button
                className="history-modal-header-close"
                onClick={() => setSelectedHistory(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Debate Info */}
            <div style={{
              backgroundColor: 'rgba(30, 41, 59, 0.8)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.5rem',
              border: '1px solid #374151'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#94a3b8' }}>Pro Model:</span>
                <span style={{ color: '#f1f5f9', fontWeight: '500' }}>
                  {formatModelName(selectedHistory.model1)} (ELO: {Math.round(selectedHistory.model1_elo || 1500)})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#94a3b8' }}>Con Model:</span>
                <span style={{ color: '#f1f5f9', fontWeight: '500' }}>
                  {formatModelName(selectedHistory.model2)} (ELO: {Math.round(selectedHistory.model2_elo || 1500)})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#94a3b8' }}>Judge:</span>
                <span style={{ color: '#f1f5f9', fontWeight: '500' }}>
                  {formatModelName(selectedHistory.judge_model)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Result:</span>
                <span>{getWinnerBadge(selectedHistory)}</span>
              </div>
            </div>

            <div className="history-transcript-viewer">
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
                {selectedHistory.transcript || "No transcript available."}
              </ReactMarkdown>

              {/* Judge Feedback */}
              {selectedHistory.judge_feedback && (
                <>
                  <hr className="divider" />
                  <h2 className="debate-heading-h2">Judge's Evaluation</h2>
                  <ReactMarkdown
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      p: ({node, ...props}) => <p className="debate-paragraph" {...props} />,
                      strong: ({node, ...props}) => <strong className="debate-strong" {...props} />,
                    }}
                  >
                    {selectedHistory.judge_feedback}
                  </ReactMarkdown>
                </>
              )}
            </div>

            {/* Error message and buttons */}
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
          isSimulatedDebate={true}
        />
      )}

      {/* Custom styles */}
      <style>{`
        .history-controls input::placeholder {
          color: #6b7280;
        }
        .history-controls select option {
          background-color: #1e293b;
          color: #f1f5f9;
        }

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

export default SimulatedDebateHistory;
