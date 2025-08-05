// components/ShareModal.jsx
import React, { useState, useEffect } from "react";
import { shareTranscript, unshareTranscript } from "../firebase/shareTranscript";
import { marked } from 'marked';
import PDFGenerator from "../utils/pdfGenerator";
import "./ShareModal.css";
import "./Legislation.css"; // For grading section styles

// Circular Progress Component for grading display
const CircularProgress = ({ percentage, size = 60, strokeWidth = 6, color = '#4a90e2' }) => {
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
const GradeItem = ({ label, percentage, description, tooltip, icon, category, isOverall = false, showTooltip = false }) => {
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
        size={isOverall ? 70 : 60}
        strokeWidth={isOverall ? 6 : 5}
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

function ShareModal({ isOpen, onClose, transcript, transcriptId }) {
  const [shareUrl, setShareUrl] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [pdfError, setPdfError] = useState("");

  // Reset share URL when transcript changes
  useEffect(() => {
    if (transcript?.shareId) {
      setShareUrl(`${window.location.origin}/shared/${transcript.shareId}`);
    } else {
      setShareUrl("");
    }
    // Reset other states when transcript changes
    setError("");
    setCopySuccess(false);
    setPdfError("");
  }, [transcript?.id, transcript?.shareId]);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Clear temporary states when modal closes
      setError("");
      setCopySuccess(false);
      setPdfError("");
      setIsSharing(false);
    }
  }, [isOpen]);

  const handleShare = async () => {
    setIsSharing(true);
    setError("");
    
    try {
      const result = await shareTranscript(transcriptId, transcript);
      setShareUrl(result.shareUrl);
    } catch (err) {
      if (err.message && err.message.includes("too old or corrupted")) {
        setError(err.message);
      } else if (err.message && err.message.includes("logged in")) {
          setError("You must be logged in to share transcripts.");
      } else {
        setError("Failed to share transcript. Please try again.");
      }
      console.error("Share error:", err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleUnshare = async () => {
    setIsSharing(true);
    setError("");
    
    try {
      await unshareTranscript(transcriptId, transcript.shareId);
      setShareUrl("");
    } catch (err) {
      if (err.message && err.message.includes("too old or corrupted")) {
        setError(err.message);
      } else if (err.message && err.message.includes("logged in")) {
          setError("You must be logged in to unshare transcripts.");
      } else {
        setError("Failed to unshare transcript. Please try again.");
      }
      console.error("Unshare error:", err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };



  const handleDownloadPDF = () => {
    if (!transcript) return;
    
    setPdfError("");
    try {
      const pdfData = {
        topic: transcript.topic || "Activity Transcript",
        transcript: transcript.transcript || "No content available.",
        mode: transcript.mode,
        activityType: transcript.activityType,
        model: transcript.model,
        createdAt: transcript.createdAt
      };

      // check which type
      if (transcript.activityType === 'Analyze Bill') {
        PDFGenerator.generateAnalysisPDF({
          topic: transcript.topic,
          content: transcript.transcript,
          grades: transcript.grades,
          model: transcript.model,
          createdAt: transcript.createdAt
        });
      } else {
        PDFGenerator.generateDebatePDF(pdfData);
      }     
    } catch (err) {
      setPdfError("Failed to generate PDF. Please try again.");
      console.error("PDF generation error:", err);
    }
  };

  if (!isOpen || !transcript) return null;

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <h3>Share Debate Transcript</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="share-modal-body">
          <div className="transcript-preview">
            <h4>{transcript.topic}</h4>
            <p className="transcript-meta centered">
              {transcript.mode} • {new Date(transcript.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* Debug info for ShareModal */}
          <div style={{ 
            color: 'white', 
            background: 'rgba(255,0,0,0.2)', 
            padding: '0.5rem', 
            borderRadius: '4px', 
            marginBottom: '1rem',
            fontSize: '0.8rem'
          }}>
            <p>DEBUG ShareModal:</p>
            <p>Activity Type: {transcript.activityType}</p>
            <p>Has grades: {transcript.grades ? 'Yes' : 'No'}</p>
            <p>Grades keys: {transcript.grades ? Object.keys(transcript.grades).join(', ') : 'None'}</p>
            <p>Should show grading: {(transcript.grades && transcript.activityType === 'Analyze Bill') ? 'YES' : 'NO'}</p>
          </div>

          {/* Show grading for bill analysis */}
          {transcript.grades && transcript.activityType === 'Analyze Bill' && (
            <div className="grading-stage-container grading-loaded" style={{ marginBottom: '1.5rem' }}>
              <BillGradingSection grades={transcript.grades} />
            </div>
          )}
          
          {/* Fallback: Try to show grading even without activityType check */}
          {transcript.grades && !transcript.activityType && (
            <div style={{ color: 'yellow', marginBottom: '1rem' }}>
              <p>Found grades but no activityType - showing anyway:</p>
              <div className="grading-stage-container grading-loaded">
                <BillGradingSection grades={transcript.grades} />
              </div>
            </div>
          )}

          {error && <p className="error-message">{error}</p>}
          {pdfError && <p className="error-message">{pdfError}</p>}

          {/* PDF Download Section */}
          <div className="download-section">
            <h4>Download Options</h4>
            <button 
              className="download-button pdf"
              onClick={handleDownloadPDF}
            >
              📄 Download as PDF
            </button>
          </div>

          {!shareUrl ? (
            <div className="share-actions">
              <h4>Online Sharing</h4>
              <p>Share this transcript publicly so others can view it with a link.</p>
              <button 
                className="share-button primary"
                onClick={handleShare}
                disabled={isSharing}
              >
                {isSharing ? "Creating Share Link..." : "Create Share Link"}
              </button>
            </div>
          ) : (
            <div className="share-actions">
              <h4>Online Sharing</h4>
              <p>This transcript is now publicly shareable:</p>
              
              <div className="share-link-container">
                <input 
                  type="text" 
                  value={shareUrl} 
                  readOnly 
                  className="share-link-input"
                />
                <button 
                  className="copy-button"
                  onClick={handleCopyLink}
                >
                  {copySuccess ? "Copied!" : "Copy"}
                </button>
              </div>


            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ShareModal;
