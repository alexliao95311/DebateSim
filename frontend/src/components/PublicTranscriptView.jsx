// components/PublicTranscriptView.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { getSharedTranscript } from "../firebase/shareTranscript";
import LoadingSpinner from "./LoadingSpinner";
import "./PublicTranscriptView.css";
import "./Legislation.css"; // For grading section styles

// Speech Sidebar Component for Public Transcript View
const PublicSpeechSidebar = ({ speechList, scrollToSpeech, sidebarExpanded, setSidebarExpanded }) => {
  return (
    <>
      <button 
        className="toggle-sidebar" 
        onClick={() => setSidebarExpanded(!sidebarExpanded)}
      >
        {sidebarExpanded ? "Hide Speeches" : "Show Speeches"}
      </button>
      
      <div className={`debate-sidebar ${sidebarExpanded ? "expanded" : ""}`}>
        <h3 className="sidebar-title">Speeches</h3>
        <ul className="sidebar-list">
          {speechList.map((item) => (
            <li 
              key={item.id} 
              className="sidebar-item"
              onClick={() => scrollToSpeech(item.id)}
            >
              <span className="sidebar-text">{item.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

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
                showTooltip={true}
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
  const [speechList, setSpeechList] = useState([]);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  // Generate speech list from transcript
  const generateSpeechList = (transcriptText) => {
    if (!transcriptText) return [];
    
    const speeches = [];
    const lines = transcriptText.split('\n');
    let currentSpeech = null;
    let speechIndex = 0;
    
    lines.forEach((line, lineIndex) => {
      // Look for headers (## Speaker Name)
      if (line.startsWith('## ')) {
        const speaker = line.replace('## ', '').trim();
        if (currentSpeech) {
          speeches.push(currentSpeech);
        }
        currentSpeech = {
          id: `speech-${speechIndex}`,
          title: speaker,
          startLine: lineIndex
        };
        speechIndex++;
      }
    });
    
    // Add the last speech if there is one
    if (currentSpeech) {
      speeches.push(currentSpeech);
    }
    
    return speeches;
  };

  // Scroll to specific speech
  const scrollToSpeech = (speechId) => {
    const element = document.getElementById(speechId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    const fetchSharedTranscript = async () => {
      try {
        setLoading(true);
        const sharedTranscript = await getSharedTranscript(shareId);
        
        if (sharedTranscript) {
          setTranscript(sharedTranscript);
          // Generate speech list for debate transcripts
          if (sharedTranscript.activityType !== 'Analyze Bill') {
            const speeches = generateSpeechList(sharedTranscript.transcript);
            setSpeechList(speeches);
          }
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
    window.location.href = "https://debatesim.us";
  };

  if (loading) {
    return (
      <div className="public-transcript-container">
        <header className="public-home-header">
          <div className="public-header-content">
            <div className="public-header-center">
              <h1 className="public-site-title" onClick={handleBackToHome} style={{ cursor: "pointer" }}>
                Debate Simulator
              </h1>
            </div>
            <div className="public-header-right">
              <button className="public-home-button" onClick={handleBackToHome}>
                Try DebateSim
              </button>
            </div>
          </div>
        </header>
        <div className="public-main-content">
          <LoadingSpinner message="Loading shared transcript..." />
        </div>
      </div>
    );
  }

  if (error || !transcript) {
    return (
      <div className="public-transcript-container">
        <header className="public-home-header">
          <div className="public-header-content">
            <div className="public-header-center">
              <h1 className="public-site-title" onClick={handleBackToHome} style={{ cursor: "pointer" }}>
                Debate Simulator
              </h1>
            </div>
            <div className="public-header-right">
              <button className="public-home-button" onClick={handleBackToHome}>
                Try DebateSim
              </button>
            </div>
          </div>
        </header>
        <div className="public-main-content">
          <div className="public-error-container">
            <h2 className="public-error-title">Transcript Not Found</h2>
            <p className="public-error-text">{error || "The shared transcript you're looking for doesn't exist."}</p>
            <button className="public-home-button" onClick={handleBackToHome}>
              Go to DebateSim
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`debate-container ${sidebarExpanded ? 'sidebar-open' : ''}`}>
      {/* Try DebateSim button in the top right corner */}
      <button className="back-to-home" onClick={handleBackToHome}>
        Try DebateSim
      </button>

      {/* Speech Sidebar - only show for debate transcripts */}
      {transcript && transcript.activityType !== 'Analyze Bill' && speechList.length > 0 && (
        <PublicSpeechSidebar 
          speechList={speechList}
          scrollToSpeech={scrollToSpeech}
          sidebarExpanded={sidebarExpanded}
          setSidebarExpanded={setSidebarExpanded}
        />
      )}
      
      <div className="debate-wrapper">
        <div className="debate-content">
          <div className="topic-header-section">
            <h2 className="debate-topic-header">
              Shared {transcript.activityType === 'Analyze Bill' ? 'Bill Analysis' : 'Debate Transcript'}: {transcript.topic}
            </h2>
            <div className="public-transcript-meta">
              <span className="public-mode">{transcript.mode}</span>
              <span className="public-date">
                {new Date(transcript.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          {/* Show grading for bill analysis */}
          {transcript.activityType === 'Analyze Bill' && transcript.grades && (
            <div className="grading-stage-container grading-loaded" style={{ marginBottom: '2rem' }}>
              <BillGradingSection grades={transcript.grades} />
            </div>
          )}
          
          <div className="transcript-viewer">
            <div className="transcript-content">
              <ReactMarkdown
                rehypePlugins={[rehypeRaw]}
                components={{
                  h1: ({node, ...props}) => <h1 className="markdown-h1" {...props} />,
                  h2: ({node, ...props}) => {
                    // Add ID to h2 elements for speech navigation
                    const speechIndex = speechList.findIndex(speech => 
                      speech.title === props.children
                    );
                    const speechId = speechIndex >= 0 ? speechList[speechIndex].id : null;
                    
                    return (
                      <h2 
                        className="markdown-h2" 
                        id={speechId}
                        {...props} 
                      />
                    );
                  },
                  h3: ({node, ...props}) => <h3 className="markdown-h3" {...props} />,
                  h4: ({node, ...props}) => <h4 className="markdown-h4" {...props} />,
                  p: ({node, ...props}) => <p className="markdown-p" {...props} />,
                  ul: ({node, ...props}) => <ul className="markdown-ul" {...props} />,
                  ol: ({node, ...props}) => <ol className="markdown-ol" {...props} />,
                  li: ({node, ...props}) => <li className="markdown-li" {...props} />,
                  strong: ({node, ...props}) => <strong className="markdown-strong" {...props} />,
                  em: ({node, ...props}) => <em className="markdown-em" {...props} />,
                  hr: ({node, ...props}) => <hr className="markdown-hr" {...props} />
                }}
              >
                {transcript.transcript}
              </ReactMarkdown>
            </div>
          </div>
          
          {/* Footer */}
          <div className="public-transcript-footer">
            <p className="public-footer-text">
              This debate transcript was generated using{" "}
              <span className="public-debatesim-link" onClick={handleBackToHome}>
                DebateSim
              </span>
              {" "}— Try creating your own AI-powered debates!
            </p>
            <p className="public-shared-info">
              Shared on {new Date(transcript.sharedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PublicTranscriptView;