// components/PublicTranscriptView.jsx
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { getSharedTranscript } from "../firebase/shareTranscript";
import LoadingSpinner from "./LoadingSpinner";
import EnhancedVoiceOutput from './EnhancedVoiceOutput';
import { TTS_CONFIG, getVoiceForContext } from '../config/tts';
import "./PublicTranscriptView.css";
import "./Legislation.css"; // For grading section styles

// Speech Sidebar Component for Public Transcript View
const PublicSpeechSidebar = ({ speechList, scrollToSpeech, sidebarExpanded, setSidebarExpanded, transcript }) => {
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
            >
              <div className="sidebar-item-content">
                <span 
                  className="sidebar-text"
                  onClick={() => scrollToSpeech(item.id)}
                >
                  {item.title}
                </span>
                {/* TTS button for individual speech */}
                <div className="sidebar-tts-control">
                  <EnhancedVoiceOutput
                    text={extractSpeechText(transcript, item)}
                    buttonStyle="compact"
                    showLabel={false}
                    useGoogleTTS={true}
                    ttsApiUrl={TTS_CONFIG.apiUrl}
                    defaultVoice={getVoiceForContext('general').voice}
                    context="general"
                  />
                </div>
              </div>
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
      if (line.startsWith('## ')) {
        const speaker = line.replace('## ', '').trim();
        const sameSpeekerCount = speeches.filter(s => s.speaker === speaker).length;
        const roundNum = sameSpeekerCount + 1;
        let title = `${speaker} - Round ${roundNum}`;
        speeches.push({
          id: `speech-${speechIndex}`,
          title: title,
          speaker: speaker,
          round: roundNum,
          startLine: lineIndex
        });
        speechIndex++;
      }
    });
    
    return speeches;
  };

  const extractSpeechText = (transcriptText, speechItem) => {
    if (!transcriptText || !speechItem) return '';
    
    const lines = transcriptText.split('\n');
    const speechLines = [];
    let isInSpeech = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('## ')) {
        if (isInSpeech) break;
        const speaker = line.replace('## ', '').trim();
        const sameSpeakerCount = lines.slice(0, i + 1).filter(l => l.startsWith('## ') && l.replace('## ','').trim() === speaker).length;
        if (speaker === speechItem.speaker && sameSpeakerCount === speechItem.round) isInSpeech = true;
      } else if (isInSpeech) {
        speechLines.push(line);
      }
    }
    
    return speechLines.join('\n').trim();
  };

  const scrollToSpeech = (speechId) => {
    setTimeout(() => {
      const element = document.getElementById(speechId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
        element.style.backgroundColor = 'rgba(74, 144, 226, 0.1)';
        setTimeout(() => element.style.backgroundColor = '', 2000);
      }
    }, 200);
  };

  const processTranscriptContent = (transcriptText, speechList) => {
    if (!transcriptText || !speechList.length) return transcriptText;
    
    const lines = transcriptText.split('\n');
    let speechIndex = 0;
    const processedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('## ')) {
        const speaker = line.replace('## ', '').trim();
        const speech = speechList[speechIndex];
        if (speech && speech.speaker === speaker) {
          const newHeader = `## ${speech.title}`;
          processedLines.push(newHeader);
          speechIndex++;
        } else {
          processedLines.push(line);
        }
      } else {
        processedLines.push(line);
      }
    }
    
    return processedLines.join('\n');
  };

  useEffect(() => {
    const fetchSharedTranscript = async () => {
      try {
        setLoading(true);
        const sharedTranscript = await getSharedTranscript(shareId);
        
        if (sharedTranscript) {
          setTranscript(sharedTranscript);
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

    if (shareId) fetchSharedTranscript();
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
      <button className="back-to-home" onClick={handleBackToHome}>
        Try DebateSim
      </button>

      {transcript && transcript.activityType !== 'Analyze Bill' && speechList.length > 0 && (
        <PublicSpeechSidebar 
          speechList={speechList}
          scrollToSpeech={scrollToSpeech}
          sidebarExpanded={sidebarExpanded}
          setSidebarExpanded={setSidebarExpanded}
          transcript={transcript.transcript}
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
          
          {transcript.activityType === 'Analyze Bill' && transcript.grades && (
            <div className="grading-stage-container grading-loaded" style={{ marginBottom: '2rem' }}>
              <BillGradingSection grades={transcript.grades} />
            </div>
          )}

          <div className="transcript-content">
            <ReactMarkdown
              rehypePlugins={[rehypeRaw]}
              components={{
                h1: ({node, ...props}) => <h1 className="markdown-h1" {...props} />,
                h2: ({ node, ...props }) => {
                  const headerText = React.Children.toArray(props.children).map(c => c.toString()).join('');
                  let headerId;
                  if (processedHeadersRef.current.has(headerText)) {
                    headerId = processedHeadersRef.current.get(headerText);
                  } else {
                    const matchingSpeech = speechList.find(s => s.title === headerText);
                    headerId = matchingSpeech
                      ? matchingSpeech.id
                      : `header-${headerText.replace(/[^a-zA-Z0-9]/g,'-').toLowerCase()}`;
                    processedHeadersRef.current.set(headerText, headerId);
                  }
                  return (
                    <div className="markdown-h2-wrapper">
                      <EnhancedVoiceOutput
                        text={transcript.transcript}
                        showLabel={false}
                        buttonStyle="compact"
                        context="general"
                        useGoogleTTS={true}
                        ttsApiUrl={TTS_CONFIG.apiUrl}
                        defaultVoice={getVoiceForContext('general').voice}
                      />
                      <h2 className="markdown-h2" id={headerId} {...props} />
                    </div>
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
              {processTranscriptContent(transcript.transcript, speechList)}
            </ReactMarkdown>
          </div>
          
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
