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
import "./Legislation.css"; // For grading section styles

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
        size={isOverall ? 90 : 75}
        strokeWidth={isOverall ? 8 : 6}
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
      tooltip: 'Evaluates the bill\'s economic benefits, cost-effectiveness, and fiscal impact on government budgets and the economy.',
      icon: '💰',
      category: 'moderate',
      order: 1
    },
    publicBenefit: {
      label: 'Public Benefit',
      description: 'Benefits to citizens',
      tooltip: 'Assesses how much the bill addresses public needs and benefits different segments of the population.',
      icon: '👥',
      category: 'positive',
      order: 2
    },
    feasibility: {
      label: 'Implementation Feasibility',
      description: 'Practicality of execution',
      tooltip: 'Examines whether the bill can be realistically implemented with available resources and existing infrastructure.',
      icon: '🛠',
      category: 'caution',
      order: 3
    },
    legalSoundness: {
      label: 'Legal Soundness',
      description: 'Constitutional compliance',
      tooltip: 'Reviews the bill\'s compliance with constitutional principles and existing legal frameworks.',
      icon: '⚖️',
      category: 'positive',
      order: 4
    },
    effectiveness: {
      label: 'Goal Effectiveness',
      description: 'Achievement of stated objectives',
      tooltip: 'Measures how well the bill addresses its stated problems and achieves its intended objectives.',
      icon: '🎯',
      category: 'moderate',
      order: 5
    },
    overall: {
      label: 'Overall Rating',
      description: 'Comprehensive assessment',
      tooltip: 'A weighted average of all criteria with emphasis on effectiveness and public benefit.',
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
              {/* Show grading section for bill analysis */}
              {selectedHistory.activityType === 'Analyze Bill' && selectedHistory.grades && (
                <div style={{ marginBottom: '2rem' }}>
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