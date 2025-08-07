// components/PublicTranscriptView.jsx
import React, { useState, useEffect, useRef } from "react";
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
  const processedHeadersRef = useRef(new Map());

  // Reset processed headers when speechList changes
  useEffect(() => {
    processedHeadersRef.current = new Map();
  }, [speechList]);

  // Generate speech list from transcript
  const generateSpeechList = (transcriptText) => {
    if (!transcriptText) return [];
    
    const speeches = [];
    const lines = transcriptText.split('\n');
    let speechIndex = 0;
    
    lines.forEach((line, lineIndex) => {
      // Look for headers (## Speaker Name)
      if (line.startsWith('## ')) {
        const speaker = line.replace('## ', '').trim();
        
        // Don't skip duplicates - each occurrence should be a separate speech
        // Calculate round number based on speaker occurrences
        const sameSpeekerCount = speeches.filter(s => s.speaker === speaker).length;
        const roundNum = sameSpeekerCount + 1;
        
        // Add round information to the title
        let title = speaker;
        
        // Add round information for ALL speeches
        if (speaker === "AI Debater Pro" || speaker === "AI Debater Con") {
          title = `${speaker} - Round ${roundNum}/5`;
        } else if (speaker.includes("(AI)")) {
          // For User vs AI mode, add round info for AI responses
          title = `${speaker} - Round ${roundNum}`;
        } else if (speaker.includes("(User)")) {
          // For User vs AI mode, add round info for user responses
          title = `${speaker} - Round ${roundNum}`;
        } else if (speaker.includes("Pro (User)") || speaker.includes("Con (User)")) {
          // For User vs User mode, add round info
          title = `${speaker} - Round ${roundNum}`;
        } else if (speaker.includes("Judge")) {
          // For judge feedback, don't add round number
          title = speaker;
        } else {
          // For any other speaker, add round number
          title = `${speaker} - Round ${roundNum}`;
        }
        
        const speechItem = {
          id: `speech-${speechIndex}`,
          title: title,
          speaker: speaker,
          round: roundNum,
          startLine: lineIndex
        };
        
        speeches.push(speechItem);
        speechIndex++;
      }
    });
    
    return speeches;
  };

  // Scroll to specific speech
  const scrollToSpeech = (speechId) => {
    // Add a delay to ensure the DOM is updated
    setTimeout(() => {
      const element = document.getElementById(speechId);
      
      if (element) {
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        });
        
        // Add a visual highlight to confirm the scroll worked
        element.style.backgroundColor = 'rgba(74, 144, 226, 0.1)';
        setTimeout(() => {
          element.style.backgroundColor = '';
        }, 2000);
      }
    }, 200);
  };

  // Process transcript to show proper headers with round numbers
  const processTranscriptContent = (transcriptText, speechList) => {
    if (!transcriptText || !speechList.length) return transcriptText;
    
    const lines = transcriptText.split('\n');
    let speechIndex = 0;
    const processedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('## ')) {
        const speaker = line.replace('## ', '').trim();
        
        // Find the corresponding speech in the speech list
        const speech = speechList[speechIndex];
        if (speech && speech.speaker === speaker) {
          // Replace the simple header with the full title including round number
          const newHeader = `## ${speech.title}`;
          processedLines.push(newHeader);
          speechIndex++;
        } else {
          processedLines.push(line); // Keep original line if no matching speech
        }
      } else {
        processedLines.push(line); // Keep non-header lines
      }
    }
    
    const processedText = processedLines.join('\n');
    return processedText;
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
                    const headerText = props.children;
                    
                    // Check if we've already assigned an ID to this exact header text
                    if (processedHeadersRef.current.has(headerText)) {
                      const existingId = processedHeadersRef.current.get(headerText);
                      return (
                        <h2 
                          className="markdown-h2" 
                          id={existingId}
                          {...props} 
                        />
                      );
                    }
                    
                    // Find the speech that matches this header text exactly
                    const matchingSpeech = speechList.find(speech => speech.title === headerText);
                    
                    if (matchingSpeech) {
                      processedHeadersRef.current.set(headerText, matchingSpeech.id);
                      
                      return (
                        <h2 
                          className="markdown-h2" 
                          id={matchingSpeech.id}
                          {...props} 
                        />
                      );
                    } else {
                      // Fallback for headers that don't have corresponding speeches
                      const fallbackId = `header-${headerText.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
                      processedHeadersRef.current.set(headerText, fallbackId);
                      
                      return (
                        <h2 
                          className="markdown-h2" 
                          id={fallbackId}
                          {...props} 
                        />
                      );
                    }
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
                {processTranscriptContent(transcript.transcript, speechList)}
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