// components/PublicTranscriptView.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { getSharedTranscript } from "../firebase/shareTranscript";
import LoadingSpinner from "./LoadingSpinner";
import "./PublicTranscriptView.css";

// Import grading components (inline to avoid dependency issues)
const CircularProgress = ({ percentage, size = 70, strokeWidth = 6, color = '#4a90e2' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="circular-progress" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          className="progress-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
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

const GradeItem = ({ label, percentage, description, tooltip, icon, category, isOverall = false }) => {
  const getGradeColor = (score) => {
    if (score >= 90) return '#28a745';
    if (score >= 70) return '#20c997';
    if (score >= 50) return '#ffc107';
    if (score >= 30) return '#fd7e14';
    return '#dc3545';
  };

  const gradeColor = getGradeColor(percentage);

  return (
    <div className={`grade-item ${category} ${isOverall ? 'overall' : ''}`}>
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
      {tooltip && (
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
              />
            );
          })}
      </div>
    </div>
  );
};

function PublicTranscriptView() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSharedTranscript = async () => {
      try {
        setLoading(true);
        const sharedTranscript = await getSharedTranscript(shareId);
        
        if (sharedTranscript) {
          setTranscript(sharedTranscript);
        } else {
          setError("This transcript is no longer available or the link is invalid.");
        }
      } catch (err) {
        console.error("Error fetching shared transcript:", err);
        setError("Failed to load the shared transcript. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    if (shareId) {
      fetchSharedTranscript();
    }
  }, [shareId]);

  const handleBackToHome = () => {
    navigate("/debatesim");
  };

  if (loading) {
    return (
      <div className="public-transcript-container">
        <header className="home-header">
          <div className="header-content">
            <div className="header-center">
              <h1 onClick={handleBackToHome} style={{ cursor: "pointer" }}>
                Debate Simulator
              </h1>
            </div>
            <div className="header-right">
              <button className="home-button" onClick={handleBackToHome}>
                Try DebateSim
              </button>
            </div>
          </div>
        </header>
        <div className="main-content">
          <LoadingSpinner message="Loading shared transcript..." />
        </div>
      </div>
    );
  }

  if (error || !transcript) {
    return (
      <div className="public-transcript-container">
        <header className="home-header">
          <div className="header-content">
            <div className="header-center">
              <h1 onClick={handleBackToHome} style={{ cursor: "pointer" }}>
                Debate Simulator
              </h1>
            </div>
            <div className="header-right">
              <button className="home-button" onClick={handleBackToHome}>
                Try DebateSim
              </button>
            </div>
          </div>
        </header>
        <div className="main-content">
          <div className="error-container">
            <h2>Transcript Not Found</h2>
            <p>{error || "The shared transcript you're looking for doesn't exist."}</p>
            <button className="home-button" onClick={handleBackToHome}>
              Go to DebateSim
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="public-transcript-container">
      {/* Header */}
      <header className="home-header">
        <div className="header-content">
          <div className="header-center">
            <h1 onClick={handleBackToHome} style={{ cursor: "pointer" }}>
              Debate Simulator
            </h1>
          </div>
          <div className="header-right">
            <button className="home-button" onClick={handleBackToHome}>
              Try DebateSim
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="main-content">
        <div className="transcript-header">
          <h1>Shared {transcript.activityType === 'Analyze Bill' ? 'Bill Analysis' : 'Debate Transcript'}</h1>
          <div className="transcript-meta">
            <span className="topic">{transcript.topic}</span>
            <span className="mode">{transcript.mode}</span>
            <span className="date">
              {new Date(transcript.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        
        {/* Show grading for bill analysis */}
        {transcript.grades && (
          <BillGradingSection grades={transcript.grades} />
        )}
        
        <div className="transcript-viewer">
          <div className="transcript-content">
            <ReactMarkdown
              rehypePlugins={[rehypeRaw]}
              components={{
                h1: ({node, ...props}) => <h1 className="transcript-heading-h1" {...props} />,
                h2: ({node, ...props}) => <h2 className="transcript-heading-h2" {...props} />,
                h3: ({node, ...props}) => <h3 className="transcript-heading-h3" {...props} />,
                h4: ({node, ...props}) => <h4 className="transcript-heading-h4" {...props} />,
                p: ({node, ...props}) => <p className="transcript-paragraph" {...props} />,
                ul: ({node, ...props}) => <ul className="transcript-list" {...props} />,
                ol: ({node, ...props}) => <ol className="transcript-numbered-list" {...props} />,
                li: ({node, ...props}) => <li className="transcript-list-item" {...props} />,
                strong: ({node, ...props}) => <strong className="transcript-strong" {...props} />,
                em: ({node, ...props}) => <em className="transcript-emphasis" {...props} />,
                hr: ({node, ...props}) => <hr className="transcript-divider" {...props} />
              }}
            >
              {transcript.transcript}
            </ReactMarkdown>
          </div>
        </div>
        
        {/* Footer */}
        <div className="transcript-footer">
          <p>
            This debate transcript was generated using{" "}
            <span className="debatesim-link" onClick={handleBackToHome}>
              DebateSim
            </span>
            {" "}— Try creating your own AI-powered debates!
          </p>
          <p className="shared-info">
            Shared on {new Date(transcript.sharedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}

export default PublicTranscriptView;