// components/PublicTranscriptView.jsx
import React, { useState, useEffect, useRef, useMemo, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { getSharedTranscript } from "../firebase/shareTranscript";
import LoadingSpinner from "./LoadingSpinner";
import EnhancedVoiceOutput from './EnhancedVoiceOutput';
import { TTSProvider, HeaderPlayButton } from './EnhancedAnalysisTTS';
import { TTS_CONFIG, getVoiceForContext } from '../config/tts';
import { useTranslation } from '../utils/translations';
import "./PublicTranscriptView.css";
import "./Legislation.css"; // For grading section styles
import "./Debate.css"; // For debate speech header and TTS button styles
import AnalysisSidebar from "./AnalysisSidebar";

// Speech Sidebar Component for Public Transcript View
const PublicSpeechSidebar = ({ speechList, scrollToSpeech, sidebarExpanded, setSidebarExpanded, transcript, extractSpeechText }) => {
  const { t } = useTranslation();
  return (
    <>
      <button 
        className="toggle-sidebar" 
        onClick={() => setSidebarExpanded(!sidebarExpanded)}
      >
        {sidebarExpanded ? t('publicTranscript.hideSpeeches') : t('publicTranscript.showSpeeches')}
      </button>
      
      <div className={`debate-sidebar ${sidebarExpanded ? "expanded" : ""}`}>
        <h3 className="sidebar-title">{t('publicTranscript.speeches')}</h3>
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
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

// Stable TTS components to prevent re-renders
const TTSComponent = memo(({ speechText, context, headerId, headerText }) => (
  <EnhancedVoiceOutput
    key={`tts-${headerId}`}
    text={speechText}
    showLabel={false}
    buttonStyle="compact"
    context={context}
    useGoogleTTS={true}
    ttsApiUrl={TTS_CONFIG.apiUrl}
    onSpeechStart={() => console.log(`Speech started for ${headerText}`)}
    onSpeechEnd={() => console.log(`Speech ended for ${headerText}`)}
    onSpeechError={(error) => console.error(`Speech error for ${headerText}:`, error)}
  />
));

// Split content into speech blocks similar to Debate.jsx
const TranscriptContent = memo(({ transcript, speechList, extractSpeechText, analysisSectionList, sectionList }) => {
  const renderSpeechBlocks = () => {
    // For simulated debates, use simple markdown rendering without parsing
    if (transcript.activityType === 'Simulated Debate') {
      // Use sectionList if available to ensure IDs match sidebar
      const sectionMap = new Map();
      if (sectionList && sectionList.length > 0) {
        sectionList.forEach(section => {
          // Extract the header text from the section title
          sectionMap.set(section.title.toLowerCase().trim(), section.id);
        });
      }
      
      let h2Index = 0;
      return (
        <div className="transcript-content" style={{ color: '#f1f5f9' }}>
          <ReactMarkdown
            rehypePlugins={[rehypeRaw]}
            components={{
              h1: ({node, ...props}) => <h1 className="markdown-h1" {...props} style={{ color: '#f1f5f9' }} />,
              h2: ({node, ...props}) => {
                const headerText = typeof props.children === 'string' ? props.children : props.children?.join?.('') || '';
                // Try to find matching ID from section list, otherwise generate one
                const normalizedTitle = headerText.toLowerCase().trim();
                const sectionId = sectionMap.get(normalizedTitle) || 
                                 `simulated-debate-section-${h2Index}-${headerText.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                h2Index++;
                return <h2 id={sectionId} className="markdown-h2" {...props} style={{ color: '#f1f5f9' }} />;
              },
              h3: ({node, ...props}) => <h3 className="markdown-h3" {...props} style={{ color: '#f1f5f9' }} />,
              h4: ({node, ...props}) => <h4 className="markdown-h4" {...props} style={{ color: '#f1f5f9' }} />,
              p: ({node, ...props}) => <p className="markdown-p" {...props} style={{ color: '#f1f5f9' }} />,
              ul: ({node, ...props}) => <ul className="markdown-ul" {...props} />,
              ol: ({node, ...props}) => <ol className="markdown-ol" {...props} />,
              li: ({node, ...props}) => <li className="markdown-li" {...props} style={{ color: '#f1f5f9' }} />,
              strong: ({node, ...props}) => <strong className="markdown-strong" {...props} />,
              em: ({node, ...props}) => <em className="markdown-em" {...props} />,
            }}
          >
            {transcript.transcript}
          </ReactMarkdown>
        </div>
      );
    }

    if (!transcript.transcript || !speechList.length) {
      // For bill analysis, use TTS functionality
      if (transcript.activityType === 'Analyze Bill') {
        // Create a map of header text to section IDs for consistent ID generation
        const headerToIdMap = new Map();
        analysisSectionList.forEach((section) => {
          headerToIdMap.set(section.title.toLowerCase().trim(), section.id);
        });
        
        let h2Index = 0;
        
        return (
          <TTSProvider analysisText={transcript.transcript}>
            <div className="transcript-content">
              {/* Bill Analysis Content with Section TTS - Only H2 headers have play buttons */}
              <ReactMarkdown
                rehypePlugins={[rehypeRaw]}
                components={{
                  h1: ({node, ...props}) => <h1 className="markdown-h1" {...props} />,
                  h2: ({node, ...props}) => {
                    const headerText = typeof props.children === 'string' ? props.children : props.children?.join?.('') || '';
                    // Try to find matching ID from section list, otherwise generate one
                    const sectionId = headerToIdMap.get(headerText.toLowerCase().trim()) || 
                                     `analysis-section-${h2Index}-${headerText.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                    h2Index++;
                    return (
                      <div id={sectionId} className="analysis-heading-container">
                        <h2 className="markdown-h2" {...props}>
                          {props.children}
                          <HeaderPlayButton headerText={headerText} />
                        </h2>
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
                }}
              >
                {transcript.transcript}
              </ReactMarkdown>
            </div>
          </TTSProvider>
        );
      }
      
      // Fall back to simple ReactMarkdown rendering for other non-speech content
      return (
        <div className="transcript-content">
          <ReactMarkdown
            rehypePlugins={[rehypeRaw]}
            components={{
              h1: ({node, ...props}) => <h1 className="markdown-h1" {...props} />,
              h2: ({node, ...props}) => <h2 className="markdown-h2" {...props} />,
              h3: ({node, ...props}) => <h3 className="markdown-h3" {...props} />,
              h4: ({node, ...props}) => <h4 className="markdown-h4" {...props} />,
              p: ({node, ...props}) => <p className="markdown-p" {...props} />,
              ul: ({node, ...props}) => <ul className="markdown-ul" {...props} />,
              ol: ({node, ...props}) => <ol className="markdown-ol" {...props} />,
              li: ({node, ...props}) => <li className="markdown-li" {...props} />,
              strong: ({node, ...props}) => <strong className="markdown-strong" {...props} />,
              em: ({node, ...props}) => <em className="markdown-em" {...props} />,

            }}
          >
            {transcript.transcript}
          </ReactMarkdown>
        </div>
      );
    }

    const blocks = [];
    const lines = transcript.transcript.split('\n');
    let currentSpeechIndex = 0;
    let currentContent = [];
    let inSpeech = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('## ') || line.startsWith('# ')) {
        // Save previous content if any
        if (currentContent.length > 0) {
          blocks.push({
            type: 'content',
            content: currentContent.join('\n'),
            key: `content-${blocks.length}`
          });
          currentContent = [];
        }

        const fullHeader = line.replace(/^#+ /, '').trim();
        const speech = speechList[currentSpeechIndex];

        // Check if this matches current speech
        let isMatch = false;
        if (speech) {
          if (speech.isJudge) {
            // Match judge feedback
            isMatch = fullHeader === 'AI Judge Feedback' || fullHeader.match(/(AI Judge|Judge Feedback|Judge)/i);
          } else {
            // Extract speaker from header like "Pro (Round 1)" to match with speech.speaker "Pro"
            const headerMatch = fullHeader.match(/^(Pro|Con)\s*\(Round\s*(\d+)\)/i);
            if (headerMatch) {
              const headerSpeaker = headerMatch[1];
              const headerRound = parseInt(headerMatch[2]);
              isMatch = speech.speaker === headerSpeaker && speech.round === headerRound;
            }
          }
        }

        if (isMatch) {
          // This is a speech header - create speech block
          const speechText = extractSpeechText(transcript.transcript, speech);
          const context = speech.isJudge ? 'judge' : 'debate';
          
          blocks.push({
            type: 'speech',
            speech: speech,
            speechText: speechText,
            context: context,
            key: `speech-${currentSpeechIndex}`
          });
          
          currentSpeechIndex++;
          inSpeech = true;
        } else {
          // Non-speech header, add to content
          currentContent.push(line);
          inSpeech = false;
        }
      } else if (inSpeech) {
        // Skip speech content lines as they're handled by speech blocks
        continue;
      } else {
        // Regular content line
        currentContent.push(line);
      }
    }

    // Add remaining content
    if (currentContent.length > 0) {
      blocks.push({
        type: 'content',
        content: currentContent.join('\n'),
        key: `content-${blocks.length}`
      });
    }

    return (
      <div className="transcript-content">
        {blocks.map(block => {
          if (block.type === 'speech') {
            return (
              <div key={block.key} className="debate-speech-block relative" id={block.speech.id}>
                <div className="debate-speech-header">
                  <h3 className="debate-speech-title">{block.speech.title}</h3>
                  <div className="debate-speech-tts">
                    <TTSComponent
                      speechText={block.speechText}
                      context={block.context}
                      headerId={block.speech.id}
                      headerText={block.speech.title}
                    />
                  </div>
                </div>
                <div className="debate-speech-content">
                  <ReactMarkdown
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      h1: ({node, ...props}) => <h1 className="markdown-h1" {...props} />,
                      h2: ({node, ...props}) => <h2 className="markdown-h2" {...props} />,
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
                    {block.speechText}
                  </ReactMarkdown>
                </div>
              </div>
            );
          } else {
            return (
              <ReactMarkdown
                key={block.key}
                rehypePlugins={[rehypeRaw]}
                components={{
                  h1: ({node, ...props}) => <h1 className="markdown-h1" {...props} />,
                  h2: ({node, ...props}) => <h2 className="markdown-h2" {...props} />,
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
                {block.content}
              </ReactMarkdown>
            );
          }
        })}
      </div>
    );
  };

  return renderSpeechBlocks();
});

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
  const { t } = useTranslation();
  const gradingCriteria = {
    economicImpact: {
      label: t('legislation.grading.economicImpact'),
      description: t('legislation.grading.economicImpact'),
      tooltip: 'Economic benefits and fiscal impact',
      icon: '💰',
      category: 'moderate',
      order: 1
    },
    publicBenefit: {
      label: t('legislation.grading.publicBenefit'), 
      description: t('legislation.grading.publicBenefit'),
      tooltip: 'Addresses public needs effectively',
      icon: '👥',
      category: 'positive',
      order: 2
    },
    feasibility: {
      label: t('legislation.grading.feasibility'),
      description: t('legislation.grading.feasibility'),
      tooltip: 'Can be realistically implemented',
      icon: '🛠',
      category: 'caution',
      order: 3
    },
    legalSoundness: {
      label: t('legislation.grading.legalSoundness'),
      description: t('legislation.grading.legalSoundness'),
      tooltip: 'Constitutional and legal compliance',
      icon: '⚖️',
      category: 'positive',
      order: 4
    },
    effectiveness: {
      label: t('legislation.grading.effectiveness'),
      description: t('legislation.grading.effectiveness'),
      tooltip: 'Achieves stated objectives well',
      icon: '🎯',
      category: 'moderate',
      order: 5
    },
    overall: {
      label: t('legislation.grading.overall'),
      description: t('legislation.grading.overall'),
      tooltip: 'Weighted average of all criteria',
      icon: '📊',
      category: 'overall',
      order: 6
    }
  };

  return (
    <div className="grading-section">
      <div className="grading-header">
        <h2>{t('legislation.grading.title')}</h2>
        <div className="grading-subtitle">{t('legislation.grading.subtitle')}</div>
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
  const { t } = useTranslation();
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [speechList, setSpeechList] = useState([]);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  
  // Analysis sidebar state (only for bill analyses)
  const [analysisSidebarExpanded, setAnalysisSidebarExpanded] = useState(false);
  const [analysisSectionList, setAnalysisSectionList] = useState([]);
  
  // Simulated debate sidebar state
  const [simulatedDebateSectionList, setSimulatedDebateSectionList] = useState([]);

  // Generate speech list from transcript
  const generateSpeechList = (transcriptText) => {
    if (!transcriptText) return [];

    const speeches = [];
    const lines = transcriptText.split('\n');
    let speechIndex = 0;
    const processedLines = new Set(); // Track which lines we've already processed

    lines.forEach((line, lineIndex) => {
      // Check for both ## and # headers
      if (line.startsWith('## ') || line.startsWith('# ')) {
        // Skip if we've already processed this line
        if (processedLines.has(lineIndex)) {
          return;
        }
        processedLines.add(lineIndex);

        const fullHeader = line.replace(/^#+ /, '').trim();

        // Handle AI Judge feedback specially
        if (fullHeader === 'AI Judge Feedback' || fullHeader.match(/(AI Judge|Judge Feedback|Judge)/i)) {
          speeches.push({
            id: `speech-${speechIndex}`,
            title: 'AI Judge Feedback',
            speaker: fullHeader, // Keep original speaker name for matching
            originalSpeaker: fullHeader,
            round: null,
            startLine: lineIndex,
            isJudge: true
          });
          speechIndex++;
        } else {
          // Handle regular debate speeches
          // Extract speaker name from headers like "Pro (Round 1)" or "Con (Round 2)"
          const match = fullHeader.match(/^(Pro|Con)\s*\(Round\s*(\d+)\)/i);

          if (match) {
            const speaker = match[1]; // "Pro" or "Con"
            const roundNum = parseInt(match[2]);

            // Count total speeches to determine max rounds (for display like "Round 1/5")
            const totalRounds = Math.ceil(
              lines.filter(l =>
                (l.startsWith('## ') || l.startsWith('# ')) &&
                l.match(/^#+\s*(Pro|Con)\s*\(Round\s*\d+\)/i)
              ).length / 2
            );

            const title = `${speaker} – Round ${roundNum}/${totalRounds}`;

            speeches.push({
              id: `speech-${speechIndex}`,
              title: title,
              speaker: speaker,
              round: roundNum,
              startLine: lineIndex,
              isJudge: false
            });
            speechIndex++;
          }
          // Note: Removed fallback to avoid duplicates in simulated debates
        }
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

      if (line.startsWith('## ') || line.startsWith('# ')) {
        if (isInSpeech) break;
        const fullHeader = line.replace(/^#+ /, '').trim();

        if (speechItem.isJudge) {
          // For AI Judge, match any judge-related header or exact speaker match
          if (fullHeader.match(/(AI Judge|Judge Feedback|Judge)/i) || fullHeader === speechItem.speaker) {
            isInSpeech = true;
            // Skip the header line itself - don't add it to speechLines
            continue;
          }
        } else {
          // For regular speeches, extract speaker and round from header like "Pro (Round 1)"
          const match = fullHeader.match(/^(Pro|Con)\s*\(Round\s*(\d+)\)/i);
          if (match) {
            const speaker = match[1];
            const roundNum = parseInt(match[2]);
            if (speaker === speechItem.speaker && roundNum === speechItem.round) {
              isInSpeech = true;
              // Skip the header line itself - don't add it to speechLines
              continue;
            }
          } else {
            // Fallback for other formats - match by speaker and round count
            const sameSpeakerCount = lines.slice(0, i + 1).filter(l => {
              const h = l.replace(/^#+ /, '').trim();
              return (l.startsWith('## ') || l.startsWith('# ')) && h === fullHeader;
            }).length;
            if (fullHeader === speechItem.speaker && sameSpeakerCount === speechItem.round) {
              isInSpeech = true;
              // Skip the header line itself - don't add it to speechLines
              continue;
            }
          }
        }
      } else if (isInSpeech) {
        speechLines.push(line);
      }
    }

    return speechLines.join('\n').replace(/\*Model: [^\*]+\*/g, '').trim();
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

  // Extract H2 sections from analysis text for sidebar (only for bill analyses)
  const extractAnalysisSections = (analysisText) => {
    if (!analysisText) return [];
    
    const lines = analysisText.split('\n');
    const sections = [];
    
    lines.forEach((line, index) => {
      if (line.startsWith('## ')) {
        const headerText = line.replace('## ', '').trim();
        if (headerText) {
          const sectionId = `analysis-section-${sections.length}-${headerText.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
          sections.push({
            id: sectionId,
            title: headerText,
            index: sections.length
          });
        }
      }
    });
    
    return sections;
  };

  // Scroll to a specific analysis section
  const scrollToSection = (id) => {
    console.log(`Attempting to scroll to section: ${id}`);
    
    setTimeout(() => {
      const el = document.getElementById(id);
      console.log(`Found element for ${id}:`, el);

      if (el) {
        // Ensure the element is visible and scrollable
        el.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest"
        });
        console.log(`Successfully scrolled to ${id}`);

        // Add a visual highlight to confirm the scroll worked
        el.style.backgroundColor = 'rgba(74, 144, 226, 0.1)';
        setTimeout(() => {
          el.style.backgroundColor = '';
        }, 2000);
      } else {
        console.warn(`Element with id ${id} not found`);
      }
    }, 200);
  };

  // Extract speech sections for simulated debates
  const extractSimulatedDebateSections = (transcriptText, judgeFeedback) => {
    if (!transcriptText) return [];
    
    const lines = transcriptText.split('\n');
    const sections = [];
    let sectionIndex = 0;
    
    lines.forEach((line) => {
      if (line.startsWith('## ')) {
        const headerText = line.replace('## ', '').trim();
        if (headerText) {
          const sectionId = `simulated-debate-section-${sectionIndex}-${headerText.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
          sections.push({
            id: sectionId,
            title: headerText,
            index: sectionIndex
          });
          sectionIndex++;
        }
      }
    });
    
    // Add judge feedback section if it exists
    if (judgeFeedback) {
      const judgeSectionId = `simulated-debate-section-${sectionIndex}-judge-feedback`;
      sections.push({
        id: judgeSectionId,
        title: "Judge's Evaluation",
        index: sectionIndex
      });
    }
    
    return sections;
  };

  useEffect(() => {
    const fetchSharedTranscript = async () => {
      try {
        setLoading(true);
        const sharedTranscript = await getSharedTranscript(shareId);
        
        if (sharedTranscript) {
          setTranscript(sharedTranscript);
          // Only generate speech list for non-simulated, non-bill transcripts
          if (sharedTranscript.activityType !== 'Analyze Bill' && sharedTranscript.activityType !== 'Simulated Debate') {
            const speeches = generateSpeechList(sharedTranscript.transcript);
            setSpeechList(speeches);
          }
        } else {
          setError(t('publicTranscript.notFoundDesc'));
        }
      } catch (err) {
        console.error("Error fetching shared transcript:", err);
        setError(t('error.failedToGenerate'));
      } finally {
        setLoading(false);
      }
    };

    if (shareId) fetchSharedTranscript();
  }, [shareId]);

  // Update analysis section list when transcript changes (only for bill analyses)
  useEffect(() => {
    if (transcript && transcript.activityType === 'Analyze Bill' && transcript.transcript) {
      const sections = extractAnalysisSections(transcript.transcript);
      setAnalysisSectionList(sections);
    } else {
      setAnalysisSectionList([]);
    }
    
    // Update simulated debate section list
    if (transcript && transcript.activityType === 'Simulated Debate' && transcript.transcript) {
      const sections = extractSimulatedDebateSections(transcript.transcript, transcript.judge_feedback);
      setSimulatedDebateSectionList(sections);
    } else {
      setSimulatedDebateSectionList([]);
    }
  }, [transcript]);

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
                {t('publicTranscript.debateSimulator')}
              </h1>
            </div>
            <div className="public-header-right">
              <button className="public-home-button" onClick={handleBackToHome}>
                {t('publicTranscript.tryDebateSim')}
              </button>
            </div>
          </div>
        </header>
        <div className="public-main-content">
          <LoadingSpinner message={t('publicTranscript.loadingShared')} />
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
                {t('publicTranscript.debateSimulator')}
              </h1>
            </div>
            <div className="public-header-right">
              <button className="public-home-button" onClick={handleBackToHome}>
                {t('publicTranscript.tryDebateSim')}
              </button>
            </div>
          </div>
        </header>
        <div className="public-main-content">
          <div className="public-error-container">
            <h2 className="public-error-title">{t('publicTranscript.notFound')}</h2>
            <p className="public-error-text">{error || t('publicTranscript.notFoundDesc')}</p>
            <button className="public-home-button" onClick={handleBackToHome}>
              {t('publicTranscript.goToDebateSim')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`debate-container ${(sidebarExpanded || analysisSidebarExpanded) ? 'sidebar-open' : ''}`}>
      <button className="back-to-home" onClick={handleBackToHome}>
        {t('publicTranscript.tryDebateSim')}
      </button>

      {/* Debate sidebar - only for debate transcripts */}
      {transcript && transcript.activityType !== 'Analyze Bill' && speechList.length > 0 && (
        <PublicSpeechSidebar 
          speechList={speechList}
          scrollToSpeech={scrollToSpeech}
          sidebarExpanded={sidebarExpanded}
          setSidebarExpanded={setSidebarExpanded}
          transcript={transcript.transcript}
          extractSpeechText={extractSpeechText}
        />
      )}
      
      {/* Analysis sidebar - only for bill analyses */}
      {transcript && transcript.activityType === 'Analyze Bill' && analysisSectionList.length > 0 && (
        <AnalysisSidebar
          sidebarExpanded={analysisSidebarExpanded}
          setSidebarExpanded={setAnalysisSidebarExpanded}
          sectionList={analysisSectionList}
          scrollToSection={scrollToSection}
        />
      )}
      
      {/* Speeches sidebar - for simulated debates */}
      {transcript && transcript.activityType === 'Simulated Debate' && simulatedDebateSectionList.length > 0 && (
        <AnalysisSidebar
          sidebarExpanded={sidebarExpanded}
          setSidebarExpanded={setSidebarExpanded}
          sectionList={simulatedDebateSectionList}
          scrollToSection={scrollToSection}
        />
      )}
      
      <div className="debate-wrapper">
        <div className="debate-content">
          <div className="topic-header-section">
            <h2 className="debate-topic-header">
              {transcript.activityType === 'Analyze Bill' ? t('publicTranscript.sharedBillAnalysis') : t('publicTranscript.sharedDebateTranscript')}: {transcript.topic}
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

          {/* Debate Info - for simulated debates */}
          {transcript.activityType === 'Simulated Debate' && (transcript.model1 || transcript.model2) && (
            <div style={{
              backgroundColor: 'rgba(30, 41, 59, 0.8)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.5rem',
              border: '1px solid #374151'
            }}>
              {transcript.model1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#94a3b8' }}>Pro Model:</span>
                  <span style={{ color: '#f1f5f9', fontWeight: '500' }}>
                    {transcript.model1.replace(/^(openai|meta-llama|google|anthropic|x-ai)\//i, '')}
                    {transcript.model1_elo && ` (ELO: ${Math.round(transcript.model1_elo)})`}
                  </span>
                </div>
              )}
              {transcript.model2 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#94a3b8' }}>Con Model:</span>
                  <span style={{ color: '#f1f5f9', fontWeight: '500' }}>
                    {transcript.model2.replace(/^(openai|meta-llama|google|anthropic|x-ai)\//i, '')}
                    {transcript.model2_elo && ` (ELO: ${Math.round(transcript.model2_elo)})`}
                  </span>
                </div>
              )}
              {transcript.judge_model && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#94a3b8' }}>Judge:</span>
                  <span style={{ color: '#f1f5f9', fontWeight: '500' }}>
                    {transcript.judge_model.replace(/^(openai|meta-llama|google|anthropic|x-ai)\//i, '')}
                  </span>
                </div>
              )}
              {transcript.winner && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Result:</span>
                  <span style={{
                    backgroundColor: transcript.winner === 'model1' ? '#dcfce7' : (transcript.winner === 'model2' ? '#fee2e2' : '#fef3c7'),
                    color: transcript.winner === 'model1' ? '#166534' : (transcript.winner === 'model2' ? '#991b1b' : '#92400e'),
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: '500'
                  }}>
                    {transcript.winner === 'model1' ? 'Pro Wins' : (transcript.winner === 'model2' ? 'Con Wins' : 'Draw')}
                  </span>
                </div>
              )}
            </div>
          )}

          <TranscriptContent
            transcript={transcript}
            speechList={speechList}
            extractSpeechText={extractSpeechText}
            analysisSectionList={analysisSectionList}
            sectionList={simulatedDebateSectionList}
          />

          {/* Judge Feedback - for simulated debates */}
          {transcript.judge_feedback && (() => {
            // Calculate the correct index for judge feedback section
            const h2Count = transcript.transcript ? transcript.transcript.split('\n').filter(line => line.startsWith('## ')).length : 0;
            const judgeSectionId = `simulated-debate-section-${h2Count}-judge-feedback`;
            return (
              <>
                <hr className="divider" style={{ margin: '2rem 0', border: 'none', borderTop: '2px solid #374151' }} />
                <h2 
                  id={judgeSectionId}
                  className="markdown-h2" 
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: '600',
                    marginBottom: '1rem',
                    color: '#f1f5f9'
                  }}
                >
                  Judge's Evaluation
                </h2>
              <ReactMarkdown
                rehypePlugins={[rehypeRaw]}
                components={{
                  h1: ({node, ...props}) => <h1 className="markdown-h1" {...props} style={{ color: '#f1f5f9' }} />,
                  h2: ({node, ...props}) => <h2 className="markdown-h2" {...props} style={{ color: '#f1f5f9' }} />,
                  h3: ({node, ...props}) => <h3 className="markdown-h3" {...props} style={{ color: '#f1f5f9' }} />,
                  h4: ({node, ...props}) => <h4 className="markdown-h4" {...props} style={{ color: '#f1f5f9' }} />,
                  p: ({node, ...props}) => <p className="markdown-p" {...props} style={{ color: '#f1f5f9' }} />,
                  ul: ({node, ...props}) => <ul className="markdown-ul" {...props} />,
                  ol: ({node, ...props}) => <ol className="markdown-ol" {...props} />,
                  li: ({node, ...props}) => <li className="markdown-li" {...props} style={{ color: '#f1f5f9' }} />,
                  strong: ({node, ...props}) => <strong className="markdown-strong" {...props} />,
                  em: ({node, ...props}) => <em className="markdown-em" {...props} />,
                }}
              >
                {transcript.judge_feedback}
              </ReactMarkdown>
              </>
            );
          })()}

          <div className="public-transcript-footer">
            <p className="public-footer-text">
              {t('publicTranscript.footerText')}{" "}
              <span className="public-debatesim-link" onClick={handleBackToHome}>
                {t('publicTranscript.footerLink')}
              </span>
              {" "}{t('publicTranscript.footerSuffix')}
            </p>
            <p className="public-shared-info">
              {t('publicTranscript.sharedOn')} {new Date(transcript.sharedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PublicTranscriptView;