import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import { saveTranscriptToUser } from '../firebase/saveTranscript';
import "./Legislation.css";
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import ShareModal from "./ShareModal";
import PDFGenerator from "../utils/pdfGenerator";
import UserDropdown from "./UserDropdown";
import EnhancedVoiceOutput from './EnhancedVoiceOutput';
import EnhancedAnalysisTTS, { TTSProvider, HeaderPlayButton } from './EnhancedAnalysisTTS';
import { TTS_CONFIG, getVoiceForContext } from '../config/tts';
import { MessageSquare, Code, Share2, X, Download } from 'lucide-react';
import Footer from "./Footer";
import UserProfileService from '../utils/userProfileService';

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const modelOptions = [
  "openai/gpt-4o-mini", 
  "meta-llama/llama-3.3-70b-instruct", 
  "google/gemini-2.0-flash-001",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o-mini-search-preview"
];

// Debate format options
const debateFormats = [
  {
    id: "default",
    title: "Default Format",
    description: "Standard academic debate format with structured opening statements, rebuttals, and closing arguments",
    tags: ["Academic", "Structured"]
  },
  {
    id: "public-forum",
    title: "Public Forum",
    description: "Accessible format focused on current events and real-world issues, emphasizing clear communication",
    tags: ["Accessible", "Current Events"]
  }
  ,
  {
    id: "lincoln-douglas",
    title: "LD Debate",
    description: "Philosophical debate format with value premise, criterion, and contentions. 6-speech structure.",
    tags: ["Philosophy", "Framework", "LD"]
  }
];

// Persona options for debates
const personas = [
  {
    id: "default",
    name: "Default AI",
    description: "Standard debate style",
    image: "/images/ai.jpg"
  },
  {
    id: "trump",
    name: "Donald Trump",
    description: "Bold, confident rhetoric with superlatives",
    image: "/images/trump.jpeg"
  },
  {
    id: "harris",
    name: "Kamala Harris", 
    description: "Prosecutorial, structured, evidence-focused",
    image: "/images/harris.webp"
  },
  {
    id: "musk",
    name: "Elon Musk",
    description: "Analytical, engineering-focused, first principles",
    image: "/images/elon.jpg"
  },
  {
    id: "drake",
    name: "Drake",
    description: "Smooth, introspective Toronto style",
    image: "/images/drake.jpg"
  }
];

// Profile Status Indicator Component
const ProfileStatusIndicator = ({ user }) => {
  const [profileStatus, setProfileStatus] = useState({
    hasProfile: false,
    isLoading: true,
    profileData: null
  });

  useEffect(() => {
    const checkProfileStatus = async () => {
      try {
        const profile = await UserProfileService.getUserProfile(user);
        const hasProfile = UserProfileService.hasProfileData(profile);
        setProfileStatus({
          hasProfile,
          isLoading: false,
          profileData: profile
        });
      } catch (err) {
        console.error('Error checking profile status:', err);
        setProfileStatus({
          hasProfile: false,
          isLoading: false,
          profileData: null
        });
      }
    };

    checkProfileStatus();
  }, [user]);

  if (profileStatus.isLoading) {
    return (
      <div className="profile-status-indicator loading">
        <span className="status-icon">⏳</span>
        <span className="status-text">Checking profile...</span>
      </div>
    );
  }

  if (profileStatus.hasProfile) {
    return (
      <div className="profile-status-indicator has-profile">
        <div className="status-content">
          <span className="status-text">Profile configured - will include personalized "Impacts on You" section</span>
          <button
            className="profile-settings-link"
            onClick={() => window.open('/settings', '_blank')}
          >
            View/Edit Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-status-indicator no-profile">
      <div className="status-content">
        <span className="status-text">No profile configured - analysis will be general</span>
        <button
          className="profile-settings-link"
          onClick={() => window.open('/settings', '_blank')}
        >
          Set Up Profile for Personalized Analysis
        </button>
      </div>
    </div>
  );
};

// Custom H2 Section Renderer Component
const H2SectionRenderer = ({ analysisText }) => {
  // Function to extract text content from H2 section until next H2
  const extractH2SectionText = (fullText, h2HeaderText) => {
    const lines = fullText.split('\n');
    const startIndex = lines.findIndex(line => 
      line.startsWith('## ') && line.toLowerCase().includes(h2HeaderText.toLowerCase())
    );
    
    if (startIndex === -1) return '';
    
    // Find next H2 header or end of text
    let endIndex = lines.length;
    for (let i = startIndex + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) {
        endIndex = i;
        break;
      }
    }
    
    // Extract content from start to end (excluding the header itself for TTS)
    return lines.slice(startIndex + 1, endIndex).join('\n').trim();
  };

  // Parse the analysis text to find all H2 sections
  const lines = analysisText.split('\n');
  const h2Sections = [];
  
  lines.forEach((line, index) => {
    if (line.startsWith('## ')) {
      const headerText = line.replace('## ', '');
      const sectionText = extractH2SectionText(analysisText, headerText);
      h2Sections.push({
        header: headerText,
        fullSectionText: sectionText,
        lineIndex: index
      });
    }
  });

  // Render all sections with proper content separation
  const renderAnalysisWithTTSButtons = () => {
    const elements = [];
    
    h2Sections.forEach((section, index) => {
      // Add divider line before each section (except the first)
      if (index > 0) {
        elements.push(<hr key={`divider-${index}`} className="section-divider" />);
      }
      
      // Add H2 header with TTS button
      elements.push(
        <div key={`header-${index}`} className="analysis-heading-container">
          <h2 className="analysis-heading">
            {section.header}
          </h2>
          <div style={{ display: 'none', marginLeft: '8px', verticalAlign: 'middle' }}>
            <EnhancedVoiceOutput
              text={section.fullSectionText}
              showLabel={false}
              buttonStyle="compact"
              context="analysis"
              useGoogleTTS={true}
              ttsApiUrl={TTS_CONFIG.apiUrl}
              title={`Play ${section.header} section`}
            />
          </div>
        </div>
      );
      
      // Add section content directly rendered as markdown
      if (section.fullSectionText && section.fullSectionText.trim()) {
        elements.push(
          <ReactMarkdown 
            key={`content-${index}`}
            rehypePlugins={[rehypeRaw]} 
            className="markdown-renderer"
            components={{
              h1: ({node, children, ...props}) => (
                <h1 className="analysis-heading" {...props}>{children}</h1>
              ),
              h2: ({node, children, ...props}) => (
                <h2 className="analysis-heading" {...props}>{children}</h2>
              ),
              h3: ({node, children, ...props}) => (
                <h3 className="analysis-heading" {...props}>{children}</h3>
              ),
              h4: ({node, children, ...props}) => (
                <h4 className="analysis-heading" {...props}>{children}</h4>
              ),
              p: ({node, ...props}) => <p className="analysis-paragraph" {...props} />,
              ul: ({node, ...props}) => <ul className="analysis-list" {...props} />,
              ol: ({node, ...props}) => <ol className="analysis-numbered-list" {...props} />,
              // Handle unknown tags like <doc> by rendering as div
              doc: ({node, children, ...props}) => <div {...props}>{children}</div>
            }}
          >
            {section.fullSectionText}
          </ReactMarkdown>
        );
      }
    });
    
    return elements;
  };

  return (
    <div className="h2-sections-container">
      {renderAnalysisWithTTSButtons()}
    </div>
  );
};

// NEW: Page Loading Component for initial render
const PageLoader = ({ isLoading }) => {
  if (!isLoading) return null;
  
  return (
    <div className="page-loader">
      <div className="page-loader-content">
        <div className="page-loader-spinner"></div>
        <div className="page-loader-text">Loading Bill Analysis Platform...</div>
      </div>
    </div>
  );
};

// Progress Bar Component for Streaming
const ProgressBar = ({ step, total, message }) => {
  const percentage = total > 0 ? (step / total) * 100 : 0;
  
  return (
    <div className="progress-container">
      <div className="progress-message">{message}</div>
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <div className="progress-text">
        Step {step} of {total}
      </div>
    </div>
  );
};

// Circular Progress Component
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

// Grade Item Component with Tooltip
const GradeItem = ({ label, percentage, description, tooltip, icon, category, isOverall = false }) => {
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
      {tooltip && (
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
              />
            );
          })}
      </div>
    </div>
  );
};

// BillCard component for better organization
const BillCard = ({ bill, viewMode, onSelect, isProcessing = false, processingStage = '' }) => {
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isDescriptionLong, setIsDescriptionLong] = useState(false);
  
  useEffect(() => {
    // Check if description is longer than 120 characters (lower threshold for meaningful read more)
    setIsDescriptionLong(bill.description.length > 120);
  }, [bill.description]);
  
  const truncatedDescription = bill.description.length > 120 
    ? bill.description.substring(0, 120) + "..."
    : bill.description;

  // Generate correct bill URL (Congress.gov for federal, LegiScan/state for state bills)
  const getBillTypeUrl = (type) => {
    if (!type) return 'bill';
    switch(type.toUpperCase()) {
      case 'HR': return 'house-bill';
      case 'S': return 'senate-bill';
      case 'HJRES': return 'house-joint-resolution';
      case 'SJRES': return 'senate-joint-resolution';
      case 'HCONRES': return 'house-concurrent-resolution';
      case 'SCONRES': return 'senate-concurrent-resolution';
      case 'HRES': return 'house-resolution';
      case 'SRES': return 'senate-resolution';
      default: return 'bill';
    }
  };

  // Use bill.url (state bills) or construct Congress.gov URL (federal bills)
  const billUrl = bill.url || (bill.type && bill.number
    ? `https://www.congress.gov/bill/119th-congress/${getBillTypeUrl(bill.type)}/${bill.number}`
    : null);

  const billLinkTitle = bill.url ? "View on LegiScan" : "View on Congress.gov";

  return (
    <div className="bill-card compact">
      <div className="bill-header-row">
        <div className="bill-code-line">
          <span className="bill-type">
            {bill.type ? `${bill.type} ${bill.number}` : (bill.number || `Bill ${bill.id}`)}
          </span>
        </div>
        {billUrl && (
          <a
            href={billUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="congress-link"
            title={billLinkTitle}
          >
            View Full Text
          </a>
        )}
      </div>
      <div className="bill-status-line">
        <span className="bill-status">{bill.lastAction}</span>
      </div>
      <h3 className="bill-title">{bill.title}</h3>
      {bill.sponsor && <p className="bill-sponsor">Sponsored by {bill.sponsor}</p>}
      <div className="bill-description-container">
        <p className="bill-description">
          {showFullDescription ? bill.description : truncatedDescription}
        </p>
        {isDescriptionLong && (
          <button 
            className="read-more-button"
            onClick={() => setShowFullDescription(!showFullDescription)}
          >
            {showFullDescription ? "Read Less" : "Read More"}
          </button>
        )}
      </div>
      <button 
        className="select-bill-button"
        onClick={() => onSelect(bill)}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <div className="processing-container">
            <div className="button-spinner"></div>
            <div className="processing-text">
              <div className="processing-main">Processing...</div>
              {processingStage && (
                <div className="processing-stage">{processingStage}</div>
              )}
            </div>
          </div>
        ) : (
          "Select"
        )}
      </button>
    </div>
  );
};

// Add this new component after the imports and before the main Legislation component
const InfoNote = ({ message, expanded, onToggle }) => {
  return (
    <div className="info-note">
      <div className="info-note-content">
        <span className="info-note-message">{message}</span>
        <button 
          className="info-toggle-btn"
          onClick={onToggle}
          aria-label={expanded ? "Hide explanation" : "Show explanation"}
        >
          {expanded ? "−" : "?"}
        </button>
      </div>
      {expanded && (
        <div className="info-note-explanation">
          <p>
            Congress.gov updates new bills periodically, but many bills are still in the drafting phase. 
            Lawmakers continue to refine and revise the text before it's officially published and made 
            available for analysis. This is a normal part of the legislative process.
          </p>
        </div>
      )}
    </div>
  );
};

const Legislation = ({ user }) => {
  // NEW: Initial page loading state
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isContentReady, setIsContentReady] = useState(false);
  const [componentsLoaded, setComponentsLoaded] = useState({
    header: false,
    bills: false,
    steps: false,
    footer: false
  });

  // 3-Step Process State
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedBill, setSelectedBill] = useState(null);
  const [billSource, setBillSource] = useState(''); // 'recommended' or 'upload'
  const [actionType, setActionType] = useState(''); // 'analyze' or 'debate'
  const [extractedBillData, setExtractedBillData] = useState(null);
  const [extractedPdfText, setExtractedPdfText] = useState(null); // Cache for PDF text
  const [billSections, setBillSections] = useState([]); // Extracted sections from PDF
  const [selectedSections, setSelectedSections] = useState([]); // User-selected sections for analysis
  const [analyzeWholeBill, setAnalyzeWholeBill] = useState(true); // Whether to analyze whole bill or sections
  const [sectionSearchTerm, setSectionSearchTerm] = useState(''); // Search term for filtering sections

  // Common states
  const [error, setError] = useState('');
  const [loadingState, setLoadingState] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [progressStep, setProgressStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(4);
  
  // Info note state
  const [showInfoNote, setShowInfoNote] = useState(false);
  const [infoNoteExpanded, setInfoNoteExpanded] = useState(false);

  // Analysis state
  const [analysisResult, setAnalysisResult] = useState('');
  const [analysisGrades, setAnalysisGrades] = useState(null);
  const [selectedModel, setSelectedModel] = useState(modelOptions[0]);

  // Debate state
  const [debateTopic, setDebateTopic] = useState('');
  const [debateMode, setDebateMode] = useState('');
  const [debateFormat, setDebateFormat] = useState('');
  const [proPersona, setProPersona] = useState('');
  const [conPersona, setConPersona] = useState('');
  const [aiPersona, setAiPersona] = useState('');
  
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAnalysisShareModal, setShowAnalysisShareModal] = useState(false);
  const [showBillPrefixInfo, setShowBillPrefixInfo] = useState(false);
  const [showFederalBillInfo, setShowFederalBillInfo] = useState(false);

  // Jurisdiction and state bills state
  const [jurisdiction, setJurisdiction] = useState('federal'); // 'federal' or 'state'
  const [selectedState, setSelectedState] = useState(''); // Two-letter state code
  const [statesList, setStatesList] = useState([]);
  const [stateBills, setStateBills] = useState([]);
  const [allStateBills, setAllStateBills] = useState([]); // Store all bills before filtering
  const [stateBillTypes, setStateBillTypes] = useState([]); // Available bill types for current state
  const [selectedBillType, setSelectedBillType] = useState('all'); // Filter by bill type

  // California Propositions state
  const [caPropositions, setCaPropositions] = useState([]);
  const [showPropositions, setShowPropositions] = useState(false); // Toggle between bills and props

  // Recommended bills state
  const [recommendedBills, setRecommendedBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [billsError, setBillsError] = useState('');

  const billNameInputRef = useRef(null);
  const resultsRef = useRef(null);
  const navigate = useNavigate();


   // Enhanced initial page loading sequence with improved timing
  useLayoutEffect(() => {
    // Prevent scroll and hide scrollbar during loading
    document.body.style.overflow = 'hidden';
    document.documentElement.style.scrollBehavior = 'auto';
    
    // Immediate scroll reset without animation
    window.scrollTo(0, 0);
    
    // Enhanced staged component loading with optimal timing
    const loadComponents = async () => {
      // Header loads first - critical above-the-fold content
      await new Promise(resolve => setTimeout(resolve, 150));
      setComponentsLoaded(prev => ({ ...prev, header: true }));
      
      // Bills section loads - main content area
      await new Promise(resolve => setTimeout(resolve, 250));
      setComponentsLoaded(prev => ({ ...prev, bills: true }));
      
      // Steps section loads - interactive elements
      await new Promise(resolve => setTimeout(resolve, 200));
      setComponentsLoaded(prev => ({ ...prev, steps: true }));
      
      // Footer loads last - non-critical content
      await new Promise(resolve => setTimeout(resolve, 150));
      setComponentsLoaded(prev => ({ ...prev, footer: true }));
      
      // All content ready - trigger final animations
      await new Promise(resolve => setTimeout(resolve, 200));
      setIsContentReady(true);
      
      // Brief pause before removing loader for smooth transition
      await new Promise(resolve => setTimeout(resolve, 400));
      setIsPageLoading(false);
      
      // Re-enable scrolling and smooth scroll behavior
      setTimeout(() => {
        document.body.style.overflow = 'auto';
        document.documentElement.style.scrollBehavior = 'smooth';
      }, 100);
    };
    
    loadComponents();
    
    // Cleanup function
    return () => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.scrollBehavior = 'smooth';
    };
  }, []);

  // Fetch states list on mount
  useEffect(() => {
    async function fetchStates() {
      try {
        const response = await fetch(`${API_URL}/states`);
        if (!response.ok) {
          throw new Error('Failed to fetch states list');
        }
        const data = await response.json();
        setStatesList(data.states || []);
      } catch (err) {
        console.error("Error fetching states:", err);
      }
    }
    fetchStates();
  }, []);

   // Fetch recommended bills from Congress.gov API (after initial loading)
  useEffect(() => {
    if (!componentsLoaded.bills) return;
    async function fetchRecommendedBills() {
      setBillsLoading(true);
      setBillsError('');
      try {
        // Note: In production, you would store the API key securely in environment variables
        // For now, we'll use a demo endpoint or mock data
        const response = await fetch(`${API_URL}/recommended-bills`);
        if (!response.ok) {
          throw new Error('Failed to fetch recommended bills');
        }
        const data = await response.json();
        setRecommendedBills(data.bills || []);
      } catch (err) {
        console.error("Error fetching recommended bills:", err);
        let errorMessage = "Unable to load recommended bills";
        
        if (err.message.includes("CONGRESS_API_KEY")) {
          errorMessage = "Congress.gov API key is required. Please check your configuration.";
        } else if (err.message.includes("500")) {
          errorMessage = "Congress.gov API is currently unavailable. Please try again later.";
        } else {
          errorMessage = `Failed to load bills: ${err.message}`;
        }
        
        setBillsError(errorMessage);
        setRecommendedBills([]);
      } finally {
        setBillsLoading(false);
      }
    }
    fetchRecommendedBills();
  }, [componentsLoaded.bills]);


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
        navigate('/login');
      })
      .catch(err => console.error("Logout error:", err));
  };

  // Fetch state bills when state is selected
  useEffect(() => {
    if (jurisdiction === 'state' && selectedState && componentsLoaded.bills) {
      async function fetchStateBills() {
        setBillsLoading(true);
        setBillsError('');
        setSelectedBillType('all'); // Reset filter when changing states
        try {
          const response = await fetch(`${API_URL}/state-bills/${selectedState}`);
          if (!response.ok) {
            throw new Error('Failed to fetch state bills');
          }
          const data = await response.json();
          const bills = data.bills || [];

          // Store all bills
          setAllStateBills(bills);

          // Extract unique bill types from bill numbers (e.g., "SB 123" -> "SB", "AB 456" -> "AB")
          const billTypesSet = new Set();
          bills.forEach(bill => {
            const match = bill.number.match(/^([A-Z]+)/);
            if (match) {
              billTypesSet.add(match[1]);
            }
          });

          // Sort bill types alphabetically
          const sortedTypes = Array.from(billTypesSet).sort();
          setStateBillTypes(sortedTypes);

          // Show all bills initially
          setStateBills(bills);
        } catch (err) {
          console.error("Error fetching state bills:", err);
          let errorMessage = "Unable to load state bills";

          if (err.message.includes("503")) {
            errorMessage = "LegiScan API key is required. Please check your configuration.";
          } else {
            errorMessage = `Failed to load bills: ${err.message}`;
          }

          setBillsError(errorMessage);
          setStateBills([]);
          setAllStateBills([]);
          setStateBillTypes([]);
        } finally {
          setBillsLoading(false);
        }
      }
      fetchStateBills();
    }
  }, [jurisdiction, selectedState, componentsLoaded.bills]);

  // Filter state bills when bill type filter changes
  useEffect(() => {
    if (selectedBillType === 'all') {
      setStateBills(allStateBills);
    } else {
      const filtered = allStateBills.filter(bill =>
        bill.number.startsWith(selectedBillType)
      );
      setStateBills(filtered);
    }
  }, [selectedBillType, allStateBills]);

  // Fetch CA propositions when California is selected
  useEffect(() => {
    if (jurisdiction === 'state' && selectedState === 'CA' && componentsLoaded.bills) {
      async function fetchCAPropositions() {
        try {
          const response = await fetch(`${API_URL}/ca-propositions`);
          if (!response.ok) {
            throw new Error('Failed to fetch propositions');
          }
          const data = await response.json();
          setCaPropositions(data.propositions || []);
        } catch (err) {
          console.error("Error fetching CA propositions:", err);
          // Silently fail - propositions are optional
          setCaPropositions([]);
        }
      }
      fetchCAPropositions();
    } else {
      // Clear propositions when leaving CA
      setCaPropositions([]);
      setShowPropositions(false);
    }
  }, [jurisdiction, selectedState, componentsLoaded.bills]);

  // Step 1: Handle bill selection from recommended bills (lazy loading)
  const handleSelectRecommendedBill = (bill) => {
    console.log('🔄 Selecting recommended bill:', bill.title);
    setSelectedBill(bill);
    setBillSource('recommended');
    setExtractedBillData(null); // Clear previous data

    // Reset section-related state
    console.log('🗑️ Clearing previous bill sections and selections');
    setBillSections([]); // Clear previous sections
    setSelectedSections([]); // Clear selected sections
    setAnalyzeWholeBill(true); // Reset to analyze whole bill
    setSectionSearchTerm(''); // Clear search term

    // Auto-fill debate topic with bill name
    const billName = `${bill.type} ${bill.number} - ${bill.title}`;
    setDebateTopic(billName);

    setCurrentStep(2);
    setError('');
    clearInfoNote(); // Clear any previous info notes
  };

  // Handle state bill selection
  const handleSelectStateBill = (bill) => {
    console.log('🔄 Selecting state bill:', bill.title);
    setSelectedBill(bill);
    setBillSource('state');
    setExtractedBillData(null); // Clear previous data

    // Reset section-related state
    console.log('🗑️ Clearing previous bill sections and selections');
    setBillSections([]); // Clear previous sections
    setSelectedSections([]); // Clear selected sections
    setAnalyzeWholeBill(true); // Reset to analyze whole bill
    setSectionSearchTerm(''); // Clear search term

    // Auto-fill debate topic with bill name
    const billName = `${bill.number} - ${bill.title}`;
    setDebateTopic(billName);

    setCurrentStep(2);
    setError('');
    clearInfoNote(); // Clear any previous info notes
  };

  // Handle CA proposition selection
  const handleSelectCAProposition = (prop) => {
    console.log('🔄 Selecting CA proposition:', prop.title);
    setSelectedBill(prop);
    setBillSource('proposition');
    setExtractedBillData(null);

    // Reset section-related state
    console.log('🗑️ Clearing previous bill sections and selections');
    setBillSections([]);
    setSelectedSections([]);
    setAnalyzeWholeBill(true);
    setSectionSearchTerm('');

    // Auto-fill debate topic with proposition name
    const propName = `${prop.number} - ${prop.title}`;
    setDebateTopic(propName);

    setCurrentStep(2);
    setError('');
    clearInfoNote();
  };
  
  // Extract recommended bill text when needed
  const extractRecommendedBillText = async (bill) => {
    if (extractedBillData) {
      console.log('📋 Using cached bill data, text length:', extractedBillData.text?.length || 0);
      return extractedBillData.text; // Return cached text only
    }

    setProcessingStage('Extracting bill text from Congress.gov...');

    console.log('🔗 Fetching bill text from API for:', {
      type: bill.type,
      number: bill.number,
      congress: bill.congress || 119,
      title: bill.title
    });

    const response = await fetch(`${API_URL}/extract-recommended-bill-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: bill.type,
        number: bill.number,
        congress: bill.congress || 119,
        title: bill.title
      }),
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('No published text is available for this bill yet. The bill may still be in draft form or pending publication on Congress.gov.');
      } else {
        const errorData = await response.text();
        throw new Error(`Failed to extract bill text: ${response.status} ${response.statusText}`);
      }
    }
    
    const data = await response.json();

    console.log('📄 API Response received:', {
      hasText: !!data.text,
      textLength: data.text?.length || 0,
      textPreview: data.text?.substring(0, 200) + '...',
      title: data.title
    });

    // Check if bill text is unavailable
    if (data.text && data.text.includes('Bill Text Unavailable')) {
      console.log('⚠️ Bill text marked as unavailable');
      throw new Error('This bill\'s text is not yet available from Congress.gov. You can try again later or upload a PDF version if available.');
    }

    // Check if we got suspiciously short text (might be just preamble)
    if (data.text && data.text.length < 2000) {
      console.log('⚠️ Received suspiciously short text, might be incomplete:', data.text.length, 'characters');
      console.log('📝 Short text content:', data.text);
    }

    // Cache the extracted bill data
    const billData = {
      text: data.text,
      title: data.title || bill.title,
      billCode: `${bill.type} ${bill.number}`
    };

    console.log('💾 Caching bill data, final text length:', billData.text?.length || 0);
    setExtractedBillData(billData);
    return billData.text;
  };

  // Extract state bill text when needed
  const extractStateBillText = async (bill) => {
    if (extractedBillData) {
      console.log('📋 Using cached state bill data, text length:', extractedBillData.text?.length || 0);
      return extractedBillData.text;
    }

    setProcessingStage('Extracting bill text from LegiScan...');

    console.log('🔗 Fetching state bill text from API for:', {
      bill_id: bill.id,
      title: bill.title
    });

    const response = await fetch(`${API_URL}/extract-state-bill-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bill_id: bill.id
      }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('No published text is available for this bill yet. The bill may still be in draft form or pending publication.');
      } else if (response.status === 503) {
        throw new Error('LegiScan API is not available. Please check your API key configuration.');
      } else {
        const errorData = await response.text();
        throw new Error(`Failed to extract bill text: ${response.status} ${response.statusText}`);
      }
    }

    const data = await response.json();

    console.log('📄 API Response received:', {
      hasText: !!data.text,
      textLength: data.text?.length || 0,
      textPreview: data.text?.substring(0, 200) + '...',
      title: data.title
    });

    // Cache the extracted bill data
    const billData = {
      text: data.text,
      title: data.title || bill.title,
      billCode: bill.number
    };

    console.log('💾 Caching state bill data, final text length:', billData.text?.length || 0);
    setExtractedBillData(billData);
    return billData.text;
  };

  // Extract CA proposition text when needed
  const extractCAPropositionText = async (prop) => {
    if (extractedBillData) {
      console.log('📋 Using cached proposition data, text length:', extractedBillData.text?.length || 0);
      return extractedBillData.text;
    }

    setProcessingStage('Extracting proposition text from CA Secretary of State...');

    console.log('🔗 Fetching CA proposition text from API for:', {
      prop_id: prop.id,
      title: prop.title
    });

    const response = await fetch(`${API_URL}/extract-ca-proposition-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prop_id: prop.id
      }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('No text available for this proposition yet. The proposition may still be in draft form or pending publication.');
      } else if (response.status === 503) {
        throw new Error('Propositions service is not available. Please try again later.');
      } else {
        throw new Error(`Failed to extract proposition text: ${response.status} ${response.statusText}`);
      }
    }

    const data = await response.json();

    console.log('📄 API Response received:', {
      hasText: !!data.text,
      textLength: data.text?.length || 0,
      textPreview: data.text?.substring(0, 200) + '...',
      title: data.title
    });

    // Cache the extracted proposition data
    const propData = {
      text: data.text,
      title: data.title,
      billCode: `Prop ${data.number}`
    };

    console.log('💾 Caching proposition data, final text length:', propData.text?.length || 0);
    setExtractedBillData(propData);
    return propData.text;
  };

  // Extract PDF text when needed
  const extractPdfText = async (file) => {
    if (extractedPdfText) {
      return extractedPdfText; // Return cached text
    }
    
    setProcessingStage('Extracting text from PDF...');
    
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_URL}/extract-text`, {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Failed to extract text from PDF');
    }
    
    const data = await response.json();
    
    // Cache the extracted text
    setExtractedPdfText(data.text);

    // Extract sections from the text
    console.log('📄 PDF uploaded, extracting sections from text...');
    const sections = extractSectionsFromText(data.text);
    console.log('💾 Setting bill sections in state, count:', sections.length);
    setBillSections(sections);

    return data.text;
  };

  // Extract sections from text by directly parsing section markers
  const extractSectionsFromText = (text) => {
    console.log('🔧 Direct section extraction called');
    console.log('📊 Input text type:', typeof text);
    console.log('📊 Input text length:', text?.length || 0);
    console.log('📊 Input text preview:', text.substring(0, 100));

    if (!text) {
      console.log('⚠️ No text provided to extractSectionsFromText');
      return [];
    }

    if (typeof text !== 'string') {
      console.error('❌ Text is not a string, type:', typeof text, 'value:', text);
      return [];
    }

    console.log('🚀 Starting direct section extraction...');

    // Extract sections directly from the text using SEC. markers
    // Pattern matches section headers like: SEC. 1. SHORT TITLE
    // Captures: SEC/SECTION, number, and TITLE (uppercase words until sentence starts)
    const sectionPattern = /(?:^|\n)SEC(?:TION)?\.?\s+(\d+[A-Z]?)\.\s+([A-Z][A-Z\s\-,()&'.]+?)(?=\s+[A-Z][a-z][a-z]|\s*\n|$)/gi;
    const sections = [];
    const matches = [...text.matchAll(sectionPattern)];

    console.log(`📋 Found ${matches.length} section headers using pattern matching`);

    if (matches.length === 0) {
      console.log('⚠️ No sections found, falling back to full text');
      return [{
        id: 'full-bill',
        number: 'Full Bill',
        title: 'Full Bill Text',
        type: 'full',
        content: text.substring(0, 10000) + (text.length > 10000 ? '...' : '')
      }];
    }

    // Helper function to convert title to sentence case
    const toSentenceCase = (str) => {
      return str.toLowerCase().replace(/(^\w|\.\s+\w)/g, (letter) => letter.toUpperCase());
    };

    // Extract content for each section
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const sectionNumber = match[1]; // Just the number like "1"
      let sectionTitle = match[2].trim(); // Title like "SHORT TITLE" or "CONTINUING APPROPRIATIONS FOR..."

      // Convert title to sentence case and ensure it ends with a period
      sectionTitle = toSentenceCase(sectionTitle);
      if (!sectionTitle.endsWith('.')) {
        sectionTitle += '.';
      }

      // Find where this section header ends and content begins
      const headerEnd = match.index + match[0].length;
      const nextSectionStart = i < matches.length - 1 ? matches[i + 1].index : text.length;

      // Extract the content between this section header and the next section
      const sectionContent = text.substring(headerEnd, nextSectionStart).trim();

      const section = {
        id: `section-${i}`,
        number: sectionNumber,
        title: `SEC. ${sectionNumber}. ${sectionTitle}`,
        type: 'section',
        content: sectionContent
      };

      console.log('✅ Extracted section:', {
        number: section.number,
        title: section.title.substring(0, 60) + '...',
        contentLength: section.content.length
      });

      sections.push(section);
    }

    console.log('✅ Section extraction completed!');
    console.log('📊 Final sections count:', sections.length);

    if (sections.length > 0) {
      console.log('📏 Content length range:', {
        min: Math.min(...sections.map(s => s.content.length)),
        max: Math.max(...sections.map(s => s.content.length)),
        avg: Math.round(sections.reduce((sum, s) => sum + s.content.length, 0) / sections.length)
      });
    }

    return sections;
  };

  // Extract section list from table of contents
  function extractTOCSections(text) {
    console.log('📋 Extracting sections from table of contents...');

    // Find the table of contents section
    const tocStart = text.search(/TABLE\s+OF\s+CONTENTS|CONTENTS/i);
    if (tocStart === -1) {
      console.log('❌ No table of contents found');
      return [];
    }

    // Find where the actual bill content starts (after TOC)
    // Look for the first substantial section implementation
    const sectionImplPattern = /SEC\.\s+(\d+[A-Z]?)\.\s+[A-Z][A-Z\s\-,()&.]+\.\s*\([a-z]\)/gi;
    const sectionImpl = sectionImplPattern.exec(text.substring(tocStart + 1000));

    let tocEnd = text.length;
    if (sectionImpl) {
      tocEnd = tocStart + 1000 + sectionImpl.index;
      console.log('📋 Found bill implementation start at position:', tocEnd);
    } else {
      // Fallback to original markers
      const billStartMarkers = [
        /SEC\.\s+1001\.\s+[A-Z]/i,
        /SEC\.\s+1\.\s+[A-Z]/i,
        /TITLE\s+[IVX]+\s*--.*SEC\.\s+\d+/i
      ];

      for (const marker of billStartMarkers) {
        const match = text.substring(tocStart + 100).search(marker);
        if (match !== -1) {
          const actualPos = tocStart + 100 + match;
          if (actualPos < tocEnd) {
            tocEnd = actualPos;
          }
        }
      }
    }

    const tocText = text.substring(tocStart, tocEnd);
    console.log('📋 TOC text length:', tocText.length);

    // Extract section entries from TOC
    const sectionPattern = /Sec\.\s+(\d+[A-Z]?)\.\s+(.+?)(?=\n|Sec\.\s+\d+|\.|\s+\d+\s*$|$)/gi;
    const sections = [];
    let match;

    while ((match = sectionPattern.exec(tocText)) !== null) {
      const sectionNumber = match[1].trim();
      let sectionTitle = match[2].trim();

      // Clean up the title
      sectionTitle = sectionTitle.replace(/\s+/g, ' ');
      sectionTitle = sectionTitle.replace(/\.$/, ''); // Remove trailing period

      // Skip if this looks like a page number or other non-section content
      if (sectionTitle.length < 5 || /^\d+$/.test(sectionTitle)) {
        continue;
      }

      const section = {
        number: sectionNumber,
        title: `SEC. ${sectionNumber}. ${sectionTitle.toUpperCase()}.`,
        originalTitle: sectionTitle
      };

      console.log('📋 TOC entry:', section.number, '-', section.originalTitle);
      sections.push(section);
    }

    console.log('📋 Extracted', sections.length, 'sections from TOC');
    return sections;
  }

  // Find a specific section in the full document text
  function findSectionInText(text, tocSection, allTocSections) {
    const sectionNumber = tocSection.number;

    // Create multiple search patterns for this section
    const searchPatterns = [
      // Most common: "SEC. 1001. TITLE."
      new RegExp(`SEC\\.?\\s+${sectionNumber}\\.\\s+[A-Z][A-Z\\s\\-,()&.]+\\.`, 'gi'),
      // Alternative: "SECTION 1001. TITLE."
      new RegExp(`SECTION\\s+${sectionNumber}\\.\\s+[A-Z][A-Z\\s\\-,()&.]+\\.`, 'gi'),
      // Simple: "SEC. 1001."
      new RegExp(`SEC\\.?\\s+${sectionNumber}\\.`, 'gi'),
      // Even simpler: just the number pattern at word boundary
      new RegExp(`\\bSEC(?:TION)?\\.?\\s+${sectionNumber}\\b`, 'gi')
    ];

    let bestMatch = null;
    let bestScore = 0;

    // Try each pattern
    for (let i = 0; i < searchPatterns.length; i++) {
      const pattern = searchPatterns[i];
      const matches = [...text.matchAll(pattern)];

      for (const match of matches) {
        const position = match.index;
        const matchText = match[0];

        // Score this match based on various criteria
        let score = 0;

        // Prefer matches that are not in the TOC area (first 10% of document)
        if (position > text.length * 0.1) score += 10;

        // Prefer matches with full titles over just numbers
        if (matchText.length > 10) score += 5;

        // Prefer exact pattern matches (lower index = more specific pattern)
        score += (4 - i);

        // Check if this match has legislative content after it (subsections, amendments, etc.)
        const contentAfter = text.substring(position, position + 500);
        if (/\([a-z]\)/.test(contentAfter)) score += 5; // Has subsections
        if (/is amended|striking|inserting|adding/.test(contentAfter)) score += 3; // Legislative language

        if (score > bestScore) {
          bestScore = score;
          bestMatch = { position, matchText, score };
        }
      }
    }

    if (!bestMatch) {
      console.log('❌ No match found for section', sectionNumber);
      return null;
    }

    // Find the end of this section by looking for the next section
    const currentIndex = allTocSections.findIndex(s => s.number === sectionNumber);
    let endPosition = text.length;

    // Look for the next section in the TOC list
    for (let i = currentIndex + 1; i < allTocSections.length; i++) {
      const nextSection = allTocSections[i];
      const nextPattern = new RegExp(`SEC\\.?\\s+${nextSection.number}\\.`, 'gi');

      // Reset regex lastIndex to avoid issues
      nextPattern.lastIndex = 0;
      const nextMatch = nextPattern.exec(text.substring(bestMatch.position + 100));

      if (nextMatch) {
        endPosition = bestMatch.position + 100 + nextMatch.index;
        break;
      }
    }

    // Extract the content
    let content = text.substring(bestMatch.position, endPosition).trim();

    // Limit very long sections
    if (content.length > 15000) {
      content = content.substring(0, 15000) + '...';
    }

    console.log('✅ Extracted section', sectionNumber, 'from position', bestMatch.position, 'to', endPosition, 'length:', content.length);

    return content;
  }

  // Get bill title for context
  const getBillTitle = () => {
    if (billSource === 'recommended' || billSource === 'link' || billSource === 'state') {
      return selectedBill?.title || 'Unknown Bill';
    } else if (billSource === 'proposition') {
      return `Proposition ${selectedBill?.number} - ${selectedBill?.shortTitle || selectedBill?.title}`;
    } else if (billSource === 'upload') {
      return selectedBill?.name?.replace('.pdf', '') || 'Uploaded Bill';
    }
    return 'Unknown Bill';
  };

  // Get text from selected sections with bill context
  const getSelectedSectionsText = () => {
    const billTitle = getBillTitle();
    const billHeader = `BILL TITLE: ${billTitle}\n\n`;
    const billText = billSource === 'upload' ? extractedPdfText : extractedBillData?.text;

    console.log('📋 getSelectedSectionsText called:', {
      selectedSectionsCount: selectedSections.length,
      selectedSectionIds: selectedSections,
      billSectionsCount: billSections.length,
      billSectionIds: billSections.map(s => s.id)
    });

    if (selectedSections.length === 0) {
      console.log('⚠️ No sections selected, using full bill text');
      return billHeader + (billText || ''); // Fallback to full text if no sections selected
    }

    const selectedSectionObjects = billSections.filter(section =>
      selectedSections.includes(section.id)
    );

    console.log('📄 Selected section objects:', {
      count: selectedSectionObjects.length,
      sections: selectedSectionObjects.map(s => ({
        id: s.id,
        title: s.title,
        contentLength: s.content?.length || 0,
        contentPreview: s.content?.substring(0, 200) + '...'
      }))
    });

    // Debug each selected section individually
    selectedSectionObjects.forEach((section, index) => {
      console.log(`🔍 Selected section ${index + 1}:`, {
        id: section.id,
        number: section.number,
        title: section.title,
        type: section.type,
        contentLength: section.content?.length || 0,
        contentFirstChars: section.content?.substring(0, 100),
        contentLastChars: section.content?.slice(-100)
      });
    });

    const sectionsText = selectedSectionObjects
      .map(section => section.content)
      .join('\n\n---\n\n');

    console.log('📝 Final sections text length:', sectionsText.length);
    console.log('📝 Final sections text preview:', sectionsText.substring(0, 200) + '...');

    return billHeader + sectionsText;
  };

  // Filter sections based on search term
  const getFilteredSections = () => {
    if (!sectionSearchTerm.trim()) {
      return billSections;
    }

    const searchTerm = sectionSearchTerm.toLowerCase();
    return billSections.filter(section =>
      section.title.toLowerCase().includes(searchTerm) ||
      section.content.toLowerCase().includes(searchTerm) ||
      section.type.toLowerCase().includes(searchTerm) ||
      section.number.toLowerCase().includes(searchTerm)
    );
  };

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
    if (item.activityType === 'Analyze Bill') return 'legislation-type-analyze';
    if (item.activityType === 'Debate Bill' || item.mode === 'bill-debate') return 'legislation-type-bill-debate';
    if (item.activityType === 'Debate Topic') return 'legislation-type-topic-debate';
    if (item.mode === 'ai-vs-ai') return 'legislation-type-ai-vs-ai';
    if (item.mode === 'ai-vs-user') return 'legislation-type-ai-vs-user';
    if (item.mode === 'user-vs-user') return 'legislation-type-user-vs-user';
    return 'legislation-type-default';
  };

  // Handle PDF upload for Step 1
  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('PDF file size must be less than 10MB.');
        return;
      }
      
      setSelectedBill(file);
      setBillSource('upload');
      setExtractedPdfText(null); // Clear previous cached text
      console.log('🗑️ Clearing previous bill sections');
      setBillSections([]); // Clear previous sections
      setSelectedSections([]); // Clear selected sections
      setAnalyzeWholeBill(true); // Reset to analyze whole bill
      setSectionSearchTerm(''); // Clear search term

      // Auto-fill debate topic with file name
      const fileName = file.name.replace('.pdf', '');
      setDebateTopic(fileName);

      setCurrentStep(2);
      setError('');
      clearInfoNote(); // Clear any previous info notes
    } else {
      setError('Please upload a valid PDF file.');
    }
  };

  // Step 2: Handle action selection
  const handleActionSelection = (action) => {
    setActionType(action);

    // Auto-fill debate topic when entering debate mode (if not already filled)
    if (action === 'debate' && selectedBill && !debateTopic) {
      let billName = '';
      if (billSource === 'recommended' || billSource === 'link') {
        billName = `${selectedBill.type} ${selectedBill.number} - ${selectedBill.title}`;
      } else if (billSource === 'state' || billSource === 'proposition') {
        billName = `${selectedBill.number} - ${selectedBill.title}`;
      } else if (billSource === 'upload') {
        billName = selectedBill.name.replace('.pdf', '');
      }
      setDebateTopic(billName);
    }

    // Auto-extract PDF text and sections when entering analyze mode with uploaded PDF
    if (action === 'analyze' && billSource === 'upload' && selectedBill && !extractedPdfText) {
      extractPdfText(selectedBill).catch(error => {
        console.error('Failed to extract PDF text:', error);
        setError('Failed to extract text from PDF. Please try again.');
      });
    }

    clearInfoNote(); // Clear any info notes when changing action
    setCurrentStep(3);
  };

   // Enhanced smooth scroll with easing and viewport awareness
  const smoothScrollToResults = () => {
    if (resultsRef.current) {
      const headerHeight = 80; // Account for fixed header
      const extraPadding = 20; // Additional padding for better visual spacing
      const targetPosition = resultsRef.current.offsetTop - headerHeight - extraPadding;
      
      // Check if we need to scroll at all
      const currentScroll = window.pageYOffset;
      const viewportHeight = window.innerHeight;
      const elementTop = resultsRef.current.offsetTop;
      const elementHeight = resultsRef.current.offsetHeight;
      
      // Only scroll if the element is not fully visible
      if (elementTop < currentScroll + headerHeight || 
          elementTop + elementHeight > currentScroll + viewportHeight) {
        
        // Use requestAnimationFrame for smoother animation
        const startPosition = currentScroll;
        const distance = targetPosition - startPosition;
        const duration = Math.min(800, Math.abs(distance) * 1.5); // Adaptive duration
        let startTime = null;
        
        const easeInOutQuart = (t) => {
          return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t;
        };
        
        const animation = (currentTime) => {
          if (startTime === null) startTime = currentTime;
          const timeElapsed = currentTime - startTime;
          const progress = Math.min(timeElapsed / duration, 1);
          
          const easedProgress = easeInOutQuart(progress);
          const currentPosition = startPosition + (distance * easedProgress);
          
          window.scrollTo(0, currentPosition);
          
          if (progress < 1) {
            requestAnimationFrame(animation);
          }
        };
        
        requestAnimationFrame(animation);
      }
    }
  };

  // Enhanced staged analysis results reveal function with professional animations
  const stageAnalysisResults = async (analysis, grades, title) => {
    // Reset all staged states
    setShowGradingSection(false);
    setShowAnalysisText(false);
    setShowBillTextSection(false);
    setGradingSectionLoaded(false);
    setAnalysisContentReady(false);
    
    // Set the data first (hidden)
    setAnalysisResult(analysis);
    if (grades) {
      setAnalysisGrades(grades);
    }
    
    // Wait a moment before starting animations to prevent flash
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Stage 1: Show grading section with smooth entrance
    setShowGradingSection(true);
    
    // Enhanced smooth scroll to results area with easing
    setTimeout(() => {
      smoothScrollToResults();
    }, 400);
    
    // Stage 1.5: Mark grading as loaded for staggered card animations
    setTimeout(() => {
      setGradingSectionLoaded(true);
    }, 700);
    
    // Stage 2: Show analysis text with fade-in after grading is settled
    setTimeout(() => {
      setShowAnalysisText(true);
    }, 1600);
    
    // Stage 2.5: Mark analysis content as ready for final polish
    setTimeout(() => {
      setAnalysisContentReady(true);
    }, 2000);
    
    // Save to history after all UI animations complete
    setTimeout(async () => {
      if (user && !user.isGuest) {
        try {
          await saveTranscriptToUser(
            analysis,
            title,
            'analysis',
            'Analyze Bill',
            grades,
            selectedModel
          );
        } catch (err) {
          console.error("Error saving analysis to history:", err);
        }
      }
    }, 2400);
  };

  // Step 3: Handle analysis execution with progress updates
  const handleAnalyzeExecution = async () => {
    clearInfoNote(); // Clear any info notes when starting analysis
    setLoadingState(true);
    setError('');
    setProgressStep(0);
    setTotalSteps(3);

    // Get user profile data for personalized analysis
    let userProfile = null;
    try {
      userProfile = await UserProfileService.getUserProfile(user);
    } catch (err) {
      console.error('Error loading user profile for analysis:', err);
    }
    
    try {
      if (billSource === 'state') {
        // Step 1: Extract state bill text if not already cached
        setProcessingStage('Fetching bill text from LegiScan...');
        setProgressStep(1);

        const billData = await extractStateBillText(selectedBill);

        // Step 2: Analyze legislation using selected sections
        setProcessingStage('Analyzing legislation with AI...');
        setProgressStep(2);

        const response = await fetch(`${API_URL}/analyze-legislation-text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: analyzeWholeBill ? `BILL TITLE: ${getBillTitle()}\n\n${extractedBillData?.text}` : getSelectedSectionsText(),
            model: selectedModel,
            sections: analyzeWholeBill ? null : selectedSections,
            userProfile: userProfile
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();

          // Handle specific error cases
          if (response.status === 404) {
            throw new Error('No published text is available for this bill yet. The bill may still be in draft form or pending publication on Congress.gov.');
          } else if (response.status === 413) {
            throw new Error('File too large. Please upload a PDF smaller than 50MB.');
          } else if (response.status === 400) {
            throw new Error('Invalid file format. Please upload a valid PDF file.');
          } else {
            throw new Error(`Analysis failed: ${response.status} ${response.statusText}. ${errorData || 'Please try again.'}`);
          }
        }

        const data = await response.json();

        // Step 3: Finalizing
        setProcessingStage('Finalizing analysis and grades...');
        setProgressStep(3);

        // Stage results
        await stageAnalysisResults(data.analysis, data.grades, `Bill Analysis: ${getBillTitle()}`);

      } else if (billSource === 'proposition') {
        // Step 1: Extract CA proposition text if not already cached
        setProcessingStage('Fetching proposition text from CA Secretary of State...');
        setProgressStep(1);

        const propData = await extractCAPropositionText(selectedBill);

        // Step 2: Analyze proposition
        setProcessingStage('Analyzing proposition with AI...');
        setProgressStep(2);

        const response = await fetch(`${API_URL}/analyze-legislation-text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: analyzeWholeBill ? `PROPOSITION TITLE: ${getBillTitle()}\n\n${extractedBillData?.text}` : getSelectedSectionsText(),
            model: selectedModel,
            sections: analyzeWholeBill ? null : selectedSections,
            userProfile: userProfile
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Analysis failed: ${response.status} ${response.statusText}. ${errorData || 'Please try again.'}`);
        }

        const data = await response.json();

        // Step 3: Finalizing
        setProcessingStage('Finalizing analysis and grades...');
        setProgressStep(3);

        // Stage results
        await stageAnalysisResults(data.analysis, data.grades, `Proposition Analysis: ${getBillTitle()}`);

      } else if (billSource === 'recommended' || billSource === 'link') {
        // Step 1: Extract federal bill text if not already cached
        setProcessingStage('Fetching bill text from Congress.gov...');
        setProgressStep(1);

        const billData = await extractRecommendedBillText(selectedBill);

        // Step 2: Analyze legislation using selected sections
        setProcessingStage('Analyzing legislation with AI...');
        setProgressStep(2);

        const response = await fetch(`${API_URL}/analyze-legislation-text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: analyzeWholeBill ? `BILL TITLE: ${getBillTitle()}\n\n${extractedBillData?.text}` : getSelectedSectionsText(),
            model: selectedModel,
            sections: analyzeWholeBill ? null : selectedSections,
            userProfile: userProfile
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();

          // Handle specific error cases
          if (response.status === 404) {
            throw new Error('No published text is available for this bill yet. The bill may still be in draft form or pending publication on Congress.gov.');
          } else if (response.status === 413) {
            throw new Error('File too large. Please upload a PDF smaller than 50MB.');
          } else if (response.status === 400) {
            throw new Error('Invalid file format. Please upload a valid PDF file.');
          } else {
            throw new Error(`Analysis failed: ${response.status} ${response.statusText}. ${errorData || 'Please try again.'}`);
          }
        }

        const data = await response.json();

        // Step 3: Finalizing
        setProcessingStage('Finalizing analysis and grades...');
        setProgressStep(3);

        // Stage results
        await stageAnalysisResults(data.analysis, data.grades, `Bill Analysis: ${getBillTitle()}`);

      } else {
        // Handle uploaded PDF analysis - use cached text if available
        let analysisData;
        
        if (extractedPdfText) {
          // Use cached text
          setProcessingStage('Using cached PDF text...');
          setProgressStep(1);
          
          setProcessingStage('Analyzing legislation with AI...');
          setProgressStep(2);
          
          const response = await fetch(`${API_URL}/analyze-legislation-text`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: analyzeWholeBill ? `BILL TITLE: ${getBillTitle()}\n\n${billSource === 'upload' ? extractedPdfText : extractedBillData?.text}` : getSelectedSectionsText(),
              model: selectedModel,
              sections: analyzeWholeBill ? null : selectedSections,
              userProfile: userProfile
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Analysis failed: ${response.status} ${response.statusText}. ${errorData || 'Please try again.'}`);
          }
          
          analysisData = await response.json();
          
          setProcessingStage('Finalizing results...');
          setProgressStep(3);
          
        } else {
          // Extract and analyze PDF
          setProcessingStage('Processing PDF file...');
          setProgressStep(1);
          
          const formData = new FormData();
          formData.append('file', selectedBill);
          formData.append('model', selectedModel);
          if (userProfile) {
            formData.append('userProfile', JSON.stringify(userProfile));
          }
          
          setProcessingStage('Analyzing legislation with AI...');
          setProgressStep(2);
          
          const response = await fetch(`${API_URL}/analyze-legislation`, {
            method: "POST",
            body: formData,
          });
          
          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Analysis failed: ${response.status} ${response.statusText}. ${errorData || 'Please try again.'}`);
          }
          
          analysisData = await response.json();
          
          setProcessingStage('Finalizing results...');
          setProgressStep(3);
          
          // Cache extracted text for future use
          if (analysisData.extractedText) {
            setExtractedPdfText(analysisData.extractedText);
          }
        }
        
        // Stage results
        await stageAnalysisResults(analysisData.analysis, analysisData.grades, `Bill Analysis: ${getBillTitle()}`);
      }
      
    } catch (err) {
      handleError(err);
    } finally {
      setLoadingState(false);
      setProcessingStage('');
      setProgressStep(0);
    }
  };

  // Step 3: Handle debate setup
  const handleDebateExecution = async () => {
    if (!debateTopic.trim() || !debateMode) {
      setError('Please enter a debate topic and select a debate mode.');
      return;
    }
    
    clearInfoNote(); // Clear any info notes when starting debate

    const billText = (billSource === 'recommended' || billSource === 'link' || billSource === 'state' || billSource === 'proposition') ? extractedBillData?.text : null;
    const billTitle = (billSource === 'recommended' || billSource === 'link' || billSource === 'state' || billSource === 'proposition') ? extractedBillData?.title : debateTopic;
    
    if (billSource === 'upload') {
      // For uploaded PDFs, extract text first
      setLoadingState(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedBill);
        
        setProcessingStage('Extracting text from PDF...');
        
        const response = await fetch(`${API_URL}/extract-text`, {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Failed to extract text');
        }
        
        const data = await response.json();
        
        // Navigate to debate with extracted text
        const billTitle = selectedBill.name || debateTopic;
        
        console.log('Navigating to debate with PDF bill text length:', data.text.length);
        console.log('Bill title:', billTitle);
        
        navigate('/debate', {
          state: {
            mode: 'bill-debate',
            topic: debateTopic,
            billText: data.text,
            billTitle: billTitle,
            debateMode: debateMode,
            debateFormat: debateFormat,
            proPersona: proPersona,
            conPersona: conPersona,
            aiPersona: aiPersona
          }
        });
        
      } catch (err) {
        handleError(err);
        setLoadingState(false);
        return;
      }
    } else if ((billSource === 'recommended' || billSource === 'link' || billSource === 'state' || billSource === 'proposition') && selectedBill) {
      // For recommended/state/proposition bills, extract text first
      setLoadingState(true);
      try {
        setProcessingStage(
          billSource === 'state' ? 'Extracting bill text from LegiScan...' :
          billSource === 'proposition' ? 'Extracting proposition text from CA SOS...' :
          'Extracting bill text from Congress.gov...'
        );

        const endpoint = billSource === 'state'
          ? `${API_URL}/extract-state-bill-text`
          : billSource === 'proposition'
          ? `${API_URL}/extract-ca-proposition-text`
          : `${API_URL}/extract-recommended-bill-text`;

        const bodyData = billSource === 'state'
          ? { bill_id: selectedBill.id }
          : billSource === 'proposition'
          ? { prop_id: selectedBill.id }
          : {
              type: selectedBill.type,
              number: selectedBill.number,
              congress: selectedBill.congress || 119,
              title: selectedBill.title
            };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(bodyData),
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('No published text is available for this bill yet. The bill may still be in draft form or pending publication on Congress.gov.');
          } else {
            throw new Error('Failed to extract bill text');
          }
        }
        
        const data = await response.json();
        
        console.log('Navigating to debate with recommended bill text length:', data.text.length);
        console.log('Bill title:', data.title);
        
        navigate('/debate', {
          state: {
            mode: 'bill-debate',
            topic: debateTopic,
            billText: data.text,
            billTitle: data.title,
            debateMode: debateMode,
            debateFormat: debateFormat,
            proPersona: proPersona,
            conPersona: conPersona,
            aiPersona: aiPersona
          }
        });
        
        setLoadingState(false);
        
      } catch (err) {
        handleError(err);
        setLoadingState(false);
        return;
      }
    } else {
      // For other cases or if no bill is selected, treat as topic debate
      console.log('Navigating to topic debate mode');
      
      navigate('/debate', {
        state: {
          mode: 'bill-debate',
          topic: debateTopic,
          billText: '',
          billTitle: debateTopic,
          debateMode: debateMode,
          debateFormat: debateFormat,
          proPersona: proPersona,
          conPersona: conPersona,
          aiPersona: aiPersona
        }
      });
    }
  };

  // Helper function to handle errors and show info note for specific cases
  const handleError = (err) => {
    const errorMessage = err.message;
    if (errorMessage.includes('No published text is available for this bill yet') || 
        errorMessage.includes('Bill Text Unavailable')) {
      setShowInfoNote(true);
      setError('');
    } else {
      setError(`Error analyzing bill: ${errorMessage}`);
      setShowInfoNote(false);
    }
  };

  // Clear info note when selecting a new bill or changing state
  const clearInfoNote = () => {
    setShowInfoNote(false);
    setInfoNoteExpanded(false);
  };

  // Step navigation functions that also clear info notes
  const goToStep = (step) => {
    setCurrentStep(step);
    clearInfoNote();
  };

  // Reset the entire flow
  const resetFlow = () => {
    setCurrentStep(1);
    setSelectedBill(null);
    setBillSource('');
    setActionType('');
    setExtractedBillData(null);
    setExtractedPdfText(null); // Clear cached PDF text
    setAnalysisResult('');
    setAnalysisGrades(null);
    setDebateTopic('');
    setDebateMode('');
    setDebateFormat('');
    setProPersona('');
    setConPersona('');
    setAiPersona('');
    setError('');
    setLoadingState(false);
    setProcessingStage('');
    setProgressStep(0);
    
    // Clear bill link state
    setBillLink('');
    setLinkParsedBill(null);
    setShowLinkConfirmation(false);
    setLinkLoading(false);
    setLinkError('');
    
    // Reset staged loading states
    setShowGradingSection(false);
    setShowAnalysisText(false);
    setShowBillTextSection(false);
    setGradingSectionLoaded(false);
    setAnalysisContentReady(false);
    
    // Reset info note state
    setShowInfoNote(false);
    setInfoNoteExpanded(false);
  };

  // Check if debate configuration is complete
  const isDebateConfigComplete = () => {
    if (!debateTopic.trim() || !debateMode || !debateFormat) return false;
    
    if (debateMode === 'ai-vs-ai') {
      return proPersona && conPersona;
    } else if (debateMode === 'ai-vs-user') {
      return aiPersona;
    } else if (debateMode === 'user-vs-user') {
      return true; // No personas needed
    }
    
    return false;
  };

  // Handle sharing current analysis - simplified like Judge.jsx
  const handleShareAnalysis = () => {
    if (!analysisResult) return;
    setShowAnalysisShareModal(true);
  };

  const handleDownloadAnalysisPDF = () => {
    if (!analysisResult) return;

    try {
      const billTitle = getBillTitle();
      const analysisType = billSource === 'proposition' ? 'Proposition Analysis' : 'Bill Analysis';

      PDFGenerator.generateAnalysisPDF({
        topic: `${analysisType}: ${billTitle}`,
        content: analysisResult,
        grades: analysisGrades,
        model: selectedModel,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to generate analysis PDF:", err);
    }
  };



  // Bill link functionality state
  const [billLink, setBillLink] = useState("");
  const [linkParsedBill, setLinkParsedBill] = useState(null);
  const [showLinkConfirmation, setShowLinkConfirmation] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState("");

  // Congress.gov URL parser function
  const parseCongressUrl = (url) => {
    try {
      // Handle various Congress.gov URL formats
      const patterns = [
        // Standard format: https://www.congress.gov/bill/119th-congress/house-bill/1234
        /congress\.gov\/bill\/(\d+)th-congress\/(house-bill|senate-bill)\/(\d+)/i,
        // Short format: https://www.congress.gov/bill/119th-congress/hr/1234
        /congress\.gov\/bill\/(\d+)th-congress\/(hr|s|hjres|sjres)\/(\d+)/i,
        // Alternative format with different ordering
        /congress\.gov\/(\d+)\/bills?\/(hr|s|hjres|sjres)(\d+)/i
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          const congress = parseInt(match[1]);
          let billType = match[2].toLowerCase();
          const number = match[3];

          // Normalize bill type
          if (billType === 'house-bill') billType = 'hr';
          if (billType === 'senate-bill') billType = 's';

          return {
            congress,
            type: billType.toUpperCase(),
            number,
            url: url
          };
        }
      }

      throw new Error('Invalid Congress.gov URL format');
    } catch (error) {
      throw new Error(`Could not parse URL: ${error.message}`);
    }
  };

  // LegiScan URL parser function
  const parseLegiScanUrl = (url) => {
    try {
      // Handle various LegiScan URL formats
      // Updated patterns to handle optional session suffixes (like /X1) and all bill number formats
      const patterns = [
        // Standard format: https://legiscan.com/CA/bill/AB123/2025 or https://legiscan.com/CO/bill/HB1001/2025/X1
        /legiscan\.com\/([A-Z]{2})\/bill\/([A-Z]+\d+)\/(\d+)(?:\/[A-Z0-9]+)?/i,
        // Text format with ID: https://legiscan.com/CA/text/SB336/id/3117223
        /legiscan\.com\/([A-Z]{2})\/text\/([A-Z]+\d+)\/id\/\d+/i,
        // Text format: https://legiscan.com/CA/text/AB123/2025
        /legiscan\.com\/([A-Z]{2})\/text\/([A-Z]+\d+)\/(\d+)(?:\/[A-Z0-9]+)?/i,
        // Drafts format: https://legiscan.com/CA/drafts/AB123/2025
        /legiscan\.com\/([A-Z]{2})\/drafts\/([A-Z]+\d+)\/(\d+)(?:\/[A-Z0-9]+)?/i,
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          const state = match[1].toUpperCase();
          const billNumber = match[2].toUpperCase();
          const year = match[3] || null; // Year might not be present in ID-based URLs

          return {
            state,
            billNumber,
            year,
            url: url
          };
        }
      }

      throw new Error('Invalid LegiScan URL format. Expected format: legiscan.com/STATE/bill/BILLNUMBER/YEAR or legiscan.com/STATE/text/BILLNUMBER/id/ID');
    } catch (error) {
      throw new Error(`Could not parse URL: ${error.message}`);
    }
  };

  // Handle bill link submission
  const handleBillLinkSubmit = async () => {
    if (!billLink.trim()) {
      setLinkError("Please enter a Congress.gov or LegiScan URL");
      return;
    }

    setLinkLoading(true);
    setLinkError("");

    try {
      // Detect URL type and parse accordingly
      const isLegiScan = billLink.includes('legiscan.com');
      const isCongress = billLink.includes('congress.gov');

      if (!isLegiScan && !isCongress) {
        throw new Error('Please enter a valid Congress.gov or LegiScan URL');
      }

      let parsedBill;
      let response;
      let billData;

      if (isLegiScan) {
        // Parse LegiScan URL
        parsedBill = parseLegiScanUrl(billLink);

        // Fetch bill information from backend
        response = await fetch(`${API_URL}/extract-state-bill-from-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            state: parsedBill.state,
            bill_number: parsedBill.billNumber,
            year: parsedBill.year,
            url: parsedBill.url
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage = errorData?.detail || `Failed to fetch state bill information: ${response.status} ${response.statusText}`;
          throw new Error(errorMessage);
        }

        billData = await response.json();

        // Store the parsed bill data and show confirmation
        setLinkParsedBill({
          ...parsedBill,
          title: billData.title,
          number: billData.number,
          description: billData.description || billData.title,
          sponsor: billData.sponsor || "Unknown",
          status: billData.status || "Unknown",
          lastAction: billData.lastAction || "",
          lastActionDate: billData.lastActionDate || "",
          stateLink: billData.stateLink || "",
          id: billData.id,
          isStateBill: true
        });

      } else {
        // Parse Congress.gov URL
        parsedBill = parseCongressUrl(billLink);

        // Fetch bill information from backend
        response = await fetch(`${API_URL}/extract-bill-from-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            congress: parsedBill.congress,
            type: parsedBill.type,
            number: parsedBill.number,
            url: parsedBill.url
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch federal bill information: ${response.status} ${response.statusText}`);
        }

        billData = await response.json();

        // Store the parsed bill data and show confirmation
        setLinkParsedBill({
          ...parsedBill,
          title: billData.title,
          description: billData.description || billData.title,
          sponsor: billData.sponsor || "Unknown",
          congress: parsedBill.congress,
          isStateBill: false
        });
      }

      setShowLinkConfirmation(true);
      setLinkLoading(false);

    } catch (error) {
      console.error("Bill link error:", error);
      setLinkError(error.message);
      setLinkLoading(false);
    }
  };

  // Handle bill link confirmation
  const handleBillLinkConfirm = () => {
    if (linkParsedBill) {
      console.log('🔄 Confirming link bill:', linkParsedBill.title);
      setSelectedBill(linkParsedBill);

      // Set appropriate bill source based on whether it's a state or federal bill
      if (linkParsedBill.isStateBill) {
        setBillSource('state');
        console.log('📜 Set bill source to state');
      } else {
        setBillSource('link');
        console.log('🏛️ Set bill source to federal link');
      }

      // Reset section-related state
      console.log('🗑️ Clearing previous bill sections and selections');
      setBillSections([]); // Clear previous sections
      setSelectedSections([]); // Clear selected sections
      setAnalyzeWholeBill(true); // Reset to analyze whole bill
      setSectionSearchTerm(''); // Clear search term
      setExtractedBillData(null); // Clear previous extracted data

      // Auto-fill debate topic with bill name
      let billName;
      if (linkParsedBill.isStateBill) {
        billName = `${linkParsedBill.number} - ${linkParsedBill.title}`;
      } else {
        billName = `${linkParsedBill.type} ${linkParsedBill.number} - ${linkParsedBill.title}`;
      }
      setDebateTopic(billName);

      setShowLinkConfirmation(false);
      setBillLink("");
      setLinkParsedBill(null);
      setCurrentStep(2); // Move to step 2
    }
  };
  // Handle bill link cancellation
  const handleBillLinkCancel = () => {
    setShowLinkConfirmation(false);
    setLinkParsedBill(null);
    setLinkError("");
  };

  const [showGradingSection, setShowGradingSection] = useState(false);
  const [showAnalysisText, setShowAnalysisText] = useState(false);
  const [showFullBillText, setShowFullBillText] = useState(false);
  const [showBillTextSection, setShowBillTextSection] = useState(false);
  const [gradingSectionLoaded, setGradingSectionLoaded] = useState(false);
  const [analysisContentReady, setAnalysisContentReady] = useState(false);

  useEffect(() => {
    if (!isContentReady) return;

    const observerOptions = {
      threshold: 0.15,
      rootMargin: '0px 0px -30px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          // Add staggered animation delay for multiple elements
          const siblings = Array.from(entry.target.parentNode?.children || []);
          const index = siblings.indexOf(entry.target);
          if (index >= 0) {
            entry.target.style.animationDelay = `${index * 0.1}s`;
          }
        }
      });
    }, observerOptions);

    // Improved element selection with more specific targeting
    const elementsToObserve = document.querySelectorAll(
      '.bill-card:not(.in-view), .step-content:not(.in-view), .grade-item:not(.in-view)'
    );
    
    elementsToObserve.forEach((el) => {
      // Add a slight delay to prevent immediate triggering
      setTimeout(() => observer.observe(el), 100);
    });

    return () => {
      observer.disconnect();
    };
  }, [isContentReady]);

  return (
    <>
      {/* NEW: Page Loader */}
      <PageLoader isLoading={isPageLoading} />
      
      <div className={`legislation-container ${isContentReady ? 'content-loaded' : 'content-loading'}`}>
        {/* Header with fade-in animation */}
        <header className={`legislation-header ${componentsLoaded.header ? 'component-visible' : 'component-hidden'}`}>
          <div className="legislation-header-content">
            <div className="legislation-header-left">
              {/* Empty space for alignment */}
            </div>

            {/* CENTER SECTION: Title */}
            <div className="legislation-header-center" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1
            }}>
              <h1 className="legislation-site-title" onClick={() => navigate("/")}>
                <span className="legislation-title-full">Bill and Legislation Debate</span>
                <span className="legislation-title-mobile">Bill Debate</span>
              </h1>
            </div>

            {/* RIGHT SECTION: User + Logout */}
            <div className="legislation-header-right">
              <UserDropdown user={user} onLogout={handleLogout} className="legislation-user-dropdown" />
            </div>
          </div>


        
        
        {/* Bill Link Confirmation Modal */}
        {showLinkConfirmation && linkParsedBill && (
          <div className="bill-link-modal">
            <div className="bill-link-modal-content">
              <div className="bill-link-modal-header">
                <h2>Confirm Bill Selection</h2>
                <button className="bill-link-modal-close" onClick={handleBillLinkCancel}>
                  ❌
                </button>
              </div>
              
              <div className="bill-link-modal-body">
                <p>Is this the bill you want to use?</p>
                
                <div style={{
                  backgroundColor: "#f8f9fa",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  padding: "1rem",
                  marginBottom: "1.5rem"
                }}>
                  <h3 style={{ margin: "0 0 0.5rem 0", color: "#000000" }}>
                    {linkParsedBill.isStateBill
                      ? `${linkParsedBill.number} - ${linkParsedBill.state}`
                      : `${linkParsedBill.type} ${linkParsedBill.number} - ${linkParsedBill.congress}th Congress`
                    }
                  </h3>
                  <p style={{ margin: "0 0 0.5rem 0", fontWeight: "bold", color: "#000000" }}>
                    {linkParsedBill.title}
                  </p>
                  {linkParsedBill.sponsor && (
                    <p style={{ margin: "0", color: "#000000", fontSize: "0.9rem" }}>
                      Sponsor: {linkParsedBill.sponsor}
                    </p>
                  )}
                </div>
                
                <div className="modal-button-group">
                  <button 
                    className="upload-btn"
                    onClick={handleBillLinkConfirm}
                    style={{ 
                      backgroundColor: "#4a90e2", 
                      color: "white", 
                      marginRight: "1rem" 
                    }}
                  >
                    ✓ Yes, Use This Bill
                  </button>
                  <button 
                    className="close-button"
                    onClick={handleBillLinkCancel}
                    style={{ 
                      backgroundColor: "#6c757d", 
                      color: "white" 
                    }}
                  >
                    ❌
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main content wrapper for centering */}
      <div className="legislation-main-content">
        {/* 3-Step Process UI with fade-in animation */}
        <div className={`legislation-step-by-step-container ${componentsLoaded.steps ? 'component-visible' : 'component-hidden'}`}>
          {/* Progress Indicator */}
          <div className="legislation-progress-steps">
            <div className={`legislation-step ${currentStep >= 1 ? 'active' : ''}`}>
              <div className="legislation-step-number">1</div>
              <div className="legislation-step-label">Select Bill</div>
            </div>
            <div className="legislation-step-arrow">→</div>
            <div className={`legislation-step ${currentStep >= 2 ? 'active' : ''}`}>
              <div className="legislation-step-number">2</div>
              <div className="legislation-step-label">Choose Action</div>
            </div>
            <div className="legislation-step-arrow">→</div>
            <div className={`legislation-step ${currentStep >= 3 ? 'active' : ''}`}>
              <div className="legislation-step-number">3</div>
              <div className="legislation-step-label">Configure & Execute</div>
            </div>
          </div>

        {/* Step Content */}
        <div className="legislation-step-content">
          {/* Step 1: Select Bill */}
          {currentStep === 1 && (
            <div className="step-one">
              <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <h2 style={{ textAlign: 'center' }}>Step 1: Choose a Bill</h2>
                <button
                  onClick={() => jurisdiction === 'state' ? setShowBillPrefixInfo(true) : setShowFederalBillInfo(true)}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(71, 85, 105, 0.5)',
                    backgroundColor: 'rgba(30, 41, 59, 0.8)',
                    color: 'rgba(255, 255, 255, 0.89)',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                  title={jurisdiction === 'state' ? "Learn about state bill prefixes" : "Learn about federal bill types"}
                >
                  ℹ️ Bill Types
                </button>
              </div>

              {/* Jurisdiction Selector */}
              <div className="jurisdiction-selector" style={{
                marginBottom: "1.5rem",
                padding: "1rem",
                backgroundColor: "rgba(30, 41, 59, 0.6)",
                borderRadius: "8px",
                border: "1px solid rgba(71, 85, 105, 0.3)"
              }}>
                <label style={{
                  display: "block",
                  marginBottom: "0.75rem",
                  color: "rgba(255, 255, 255, 0.89)",
                  fontWeight: "600"
                }}>
                  Choose Bill Source:
                </label>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
                  <button
                    className={`jurisdiction-btn ${jurisdiction === 'federal' ? 'active' : ''}`}
                    onClick={() => {
                      setJurisdiction('federal');
                      setSelectedState('');
                      setStateBills([]);
                    }}
                    style={{
                      padding: "0.75rem 1.5rem",
                      borderRadius: "6px",
                      border: jurisdiction === 'federal' ? "2px solid #007bff" : "2px solid rgba(71, 85, 105, 0.5)",
                      backgroundColor: jurisdiction === 'federal' ? "rgba(0, 123, 255, 0.2)" : "rgba(30, 41, 59, 0.8)",
                      color: "rgba(255, 255, 255, 0.89)",
                      cursor: "pointer",
                      fontWeight: jurisdiction === 'federal' ? "600" : "normal",
                      transition: "all 0.2s"
                    }}
                  >
                    Federal Bills
                  </button>
                  <button
                    className={`jurisdiction-btn ${jurisdiction === 'state' ? 'active' : ''}`}
                    onClick={() => setJurisdiction('state')}
                    style={{
                      padding: "0.75rem 1.5rem",
                      borderRadius: "6px",
                      border: jurisdiction === 'state' ? "2px solid #007bff" : "2px solid rgba(71, 85, 105, 0.5)",
                      backgroundColor: jurisdiction === 'state' ? "rgba(0, 123, 255, 0.2)" : "rgba(30, 41, 59, 0.8)",
                      color: "rgba(255, 255, 255, 0.89)",
                      cursor: "pointer",
                      fontWeight: jurisdiction === 'state' ? "600" : "normal",
                      transition: "all 0.2s"
                    }}
                  >
                    State Bills
                  </button>

                  {jurisdiction === 'state' && (
                    <>
                      <select
                        value={selectedState}
                        onChange={(e) => setSelectedState(e.target.value)}
                        style={{
                          padding: "0.75rem",
                          borderRadius: "6px",
                          border: "1px solid rgba(71, 85, 105, 0.5)",
                          backgroundColor: "rgba(30, 41, 59, 0.8)",
                          color: "rgba(255, 255, 255, 0.89)",
                          cursor: "pointer",
                          minWidth: "200px"
                        }}
                      >
                        <option value="">Select a State...</option>
                        {statesList.map((state) => (
                          <option key={state.code} value={state.code}>
                            {state.name}
                          </option>
                        ))}
                      </select>

                      {/* Bill Type Filter - only show when state is selected and bills are loaded */}
                      {selectedState && stateBillTypes.length > 0 && (
                        <select
                          value={selectedBillType}
                          onChange={(e) => setSelectedBillType(e.target.value)}
                          style={{
                            padding: "0.75rem",
                            borderRadius: "6px",
                            border: "1px solid rgba(71, 85, 105, 0.5)",
                            backgroundColor: "rgba(30, 41, 59, 0.8)",
                            color: "rgba(255, 255, 255, 0.89)",
                            cursor: "pointer",
                            minWidth: "150px"
                          }}
                        >
                          <option value="all">All Types ({allStateBills.length})</option>
                          {stateBillTypes.map((type) => {
                            const count = allStateBills.filter(b => b.number.startsWith(type)).length;
                            return (
                              <option key={type} value={type}>
                                {type} ({count})
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Bills Section with fade-in animation */}
              <div className={`bills-section ${componentsLoaded.bills ? 'component-visible' : 'component-hidden'}`}>
                  <>
                    <h3>{jurisdiction === 'federal' ? 'Trending Congressional Bills' : `${statesList.find(s => s.code === selectedState)?.name || 'State'} Bills`}</h3>
                    
                    {billsLoading && (
                      <div className="bills-loading">
                        <div className="bills-skeleton-container">
                          {[...Array(5)].map((_, index) => (
                            <div key={index} className="bill-skeleton-card">
                              <div className="skeleton-header">
                                <div className="skeleton-bill-type"></div>
                                <div className="skeleton-link"></div>
                              </div>
                              <div className="skeleton-status"></div>
                              <div className="skeleton-title"></div>
                              <div className="skeleton-sponsor"></div>
                              <div className="skeleton-description">
                                <div className="skeleton-line long"></div>
                                <div className="skeleton-line medium"></div>
                                <div className="skeleton-line short"></div>
                              </div>
                              <div className="skeleton-button"></div>
                            </div>
                          ))}
                        </div>
                        <div className="bills-loading-text">
                          <div className="loading-spinner"></div>
                          <p>Loading current bills from Congress...</p>
                        </div>
                      </div>
                    )}
                    
                    {billsError && (
                      <div className="bills-error">
                        <p>{billsError}</p>
                      </div>
                    )}
                    
                    {!billsLoading && !billsError && jurisdiction === 'federal' && recommendedBills.length > 0 && (
                      <div className={`bills-horizontal-scroll ${billsLoading ? 'searching' : ''}`}>
                        {recommendedBills.map((bill, index) => (
                          <div
                            key={bill.id}
                            className="bill-card-wrapper"
                            style={{
                              animationDelay: `${index * 100}ms`,
                              opacity: componentsLoaded.bills ? 1 : 0,
                              transform: componentsLoaded.bills ? 'translateY(0)' : 'translateY(20px)',
                              transition: 'opacity 0.6s ease, transform 0.6s ease'
                            }}
                          >
                            <BillCard
                              bill={bill}
                              onSelect={handleSelectRecommendedBill}
                              isProcessing={loadingState && selectedBill?.id === bill.id}
                              processingStage={loadingState && selectedBill?.id === bill.id ? processingStage : ''}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {!billsLoading && !billsError && jurisdiction === 'state' && selectedState && stateBills.length > 0 && (
                      <>
                        {/* California Propositions Tab */}
                        {selectedState === 'CA' && caPropositions.length > 0 && (
                          <div style={{ marginTop: '1rem' }}>
                            {/* Tab Switcher */}
                            <div style={{
                              display: 'flex',
                              gap: '0.5rem',
                              marginBottom: '1rem',
                              borderBottom: '2px solid rgba(71, 85, 105, 0.3)',
                              paddingBottom: '0.5rem'
                            }}>
                              <button
                                onClick={() => setShowPropositions(false)}
                                style={{
                                  padding: '0.5rem 1.5rem',
                                  background: !showPropositions ? 'rgba(0, 123, 255, 0.2)' : 'transparent',
                                  border: 'none',
                                  borderBottom: !showPropositions ? '3px solid #007bff' : '3px solid transparent',
                                  color: 'rgba(255, 255, 255, 0.89)',
                                  fontWeight: !showPropositions ? '600' : 'normal',
                                  cursor: 'pointer',
                                  fontSize: '1rem'
                                }}
                              >
                                State Bills ({stateBills.length})
                              </button>
                              <button
                                onClick={() => setShowPropositions(true)}
                                style={{
                                  padding: '0.5rem 1.5rem',
                                  background: showPropositions ? 'rgba(0, 123, 255, 0.2)' : 'transparent',
                                  border: 'none',
                                  borderBottom: showPropositions ? '3px solid #007bff' : '3px solid transparent',
                                  color: 'rgba(255, 255, 255, 0.89)',
                                  fontWeight: showPropositions ? '600' : 'normal',
                                  cursor: 'pointer',
                                  fontSize: '1rem'
                                }}
                              >
                                Ballot Propositions ({caPropositions.length})
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Show Bills or Propositions based on tab */}
                        {(!showPropositions || selectedState !== 'CA') ? (
                          <div className={`bills-horizontal-scroll ${billsLoading ? 'searching' : ''}`}>
                            {stateBills.map((bill, index) => (
                              <div
                                key={bill.id}
                                className="bill-card-wrapper"
                                style={{
                                  animationDelay: `${index * 100}ms`,
                                  opacity: componentsLoaded.bills ? 1 : 0,
                                  transform: componentsLoaded.bills ? 'translateY(0)' : 'translateY(20px)',
                                  transition: 'opacity 0.6s ease, transform 0.6s ease'
                                }}
                              >
                                <BillCard
                                  bill={bill}
                                  onSelect={handleSelectStateBill}
                                  isProcessing={loadingState && selectedBill?.id === bill.id}
                                  processingStage={loadingState && selectedBill?.id === bill.id ? processingStage : ''}
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className={`bills-horizontal-scroll ${billsLoading ? 'searching' : ''}`}>
                            {caPropositions.map((prop, index) => (
                              <div
                                key={prop.id}
                                className="bill-card-wrapper"
                                style={{
                                  animationDelay: `${index * 100}ms`,
                                  opacity: 1,
                                  transform: 'translateY(0)',
                                  transition: 'opacity 0.6s ease, transform 0.6s ease'
                                }}
                              >
                                <BillCard
                                  bill={prop}
                                  onSelect={handleSelectCAProposition}
                                  isProcessing={loadingState && selectedBill?.id === prop.id}
                                  processingStage={loadingState && selectedBill?.id === prop.id ? processingStage : ''}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {jurisdiction === 'state' && !selectedState && !billsLoading && (
                      <div style={{
                        padding: "2rem",
                        textAlign: "center",
                        backgroundColor: "rgba(30, 41, 59, 0.6)",
                        borderRadius: "8px",
                        border: "1px solid rgba(71, 85, 105, 0.3)"
                      }}>
                        <p style={{ color: "rgba(255, 255, 255, 0.7)", margin: 0 }}>
                          Please select a state above to view state bills
                        </p>
                      </div>
                    )}
                  </>
              </div>

              {/* Upload Section */}
              <div className="upload-section">
                <input
                  type="file"
                  id="pdfUpload"
                  accept="application/pdf"
                  onChange={handlePdfUpload}
                  style={{ display: 'none' }}
                />
                <label htmlFor="pdfUpload" className="upload-btn">
                  Upload PDF
                </label>
                <span className="or-text">or</span>
                <div className="congress-link" style={{ display: "flex", gap: "0.5rem", alignItems: "center", flex: 1 }}>
                  <input
                    type="url"
                    value={billLink}
                    onChange={(e) => setBillLink(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleBillLinkSubmit();
                      }
                    }}
                    placeholder="Enter bill URL (Congress.gov or LegiScan, e.g., https://legiscan.com/CA/bill/AB123/2025)"
                    className="link-input"
                    style={{ flex: 1 }}
                    disabled={linkLoading}
                  />
                  <button
                    onClick={handleBillLinkSubmit}
                    disabled={linkLoading || !billLink.trim()}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: linkLoading || !billLink.trim() ? "#ccc" : "#4a90e2",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: linkLoading || !billLink.trim() ? "not-allowed" : "pointer",
                      fontSize: "0.9rem",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {linkLoading ? "Loading..." : "Add Bill"}
                  </button>
                </div>
              </div>

              {linkError && (
                <div style={{
                  color: "#dc3545",
                  fontSize: "0.9rem",
                  marginTop: "0.5rem",
                  padding: "0.5rem",
                  backgroundColor: "#f8d7da",
                  border: "1px solid #f5c6cb",
                  borderRadius: "4px",
                  position: "relative",
                  paddingRight: "2rem"
                }}>
                  {linkError}
                  <button
                    onClick={() => setLinkError("")}
                    style={{
                      position: "absolute",
                      top: "0.5rem",
                      right: "0.5rem",
                      background: "transparent",
                      border: "none",
                      color: "#721c24",
                      fontSize: "1.2rem",
                      cursor: "pointer",
                      padding: "0",
                      lineHeight: "1",
                      fontWeight: "bold",
                      width: "20px",
                      height: "20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                    aria-label="Close error message"
                  >
                    ×
                  </button>
                </div>
              )}

              <div style={{
                fontSize: "0.85rem",
                color: "#6c757d",
                marginTop: "0.5rem",
                fontStyle: "italic"
              }}>
                Note: LegiScan tracks bills from active legislative sessions. Some 2025 sessions may not have started yet or may not be fully available.
              </div>

              {error && <p className="error-text">{error}</p>}
              {showInfoNote && (
                <InfoNote 
                  message="No published text is available for this bill yet. The bill may still be in draft form or pending publication on Congress.gov."
                  expanded={infoNoteExpanded}
                  onToggle={() => setInfoNoteExpanded(!infoNoteExpanded)}
                />
              )}
              
              {loadingState && (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <div className="loading-text">
                    <div className="loading-main">Processing bill...</div>
                    {processingStage && (
                      <div className="loading-stage">
                        <ProgressBar 
                          step={progressStep} 
                          total={totalSteps} 
                          message={processingStage} 
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Choose Action */}
          {currentStep === 2 && (
            <div className="step-two">
              {/* Selected Bill Display */}
              <div className="selected-bill-display">
                <div className="selected-bill-header">
                  <h3>
                    {billSource === 'recommended' ? (
                      `Selected Bill: ${selectedBill.type} ${selectedBill.number} - ${selectedBill.title}`
                    ) : billSource === 'link' ? (
                      `Selected Bill: ${selectedBill.type} ${selectedBill.number} - ${selectedBill.title}`
                    ) : billSource === 'state' ? (
                      `Selected Bill: ${selectedBill.number} - ${selectedBill.title}`
                    ) : billSource === 'proposition' ? (
                      `Selected Proposition: ${selectedBill.number} - ${selectedBill.shortTitle || selectedBill.title}`
                    ) : (
                      `Selected Bill: 📄 ${selectedBill.name}`
                    )}
                  </h3>
                </div>
              </div>

              <h2>Step 2: What would you like to do?</h2>
              <p className="step-description">Choose how you want to work with the selected bill</p>
              
              <div className="action-cards">
                <div 
                  className={`action-card ${actionType === 'analyze' ? 'selected' : ''}`}
                  onClick={() => handleActionSelection('analyze')}
                >
                  <div className="action-icon">🔍</div>
                  <h3>Analyze Bill</h3>
                  <p>Get AI-powered analysis of the bill's content, implications, and key provisions</p>
                </div>
                
                <div 
                  className={`action-card ${actionType === 'debate' ? 'selected' : ''}`}
                  onClick={() => handleActionSelection('debate')}
                >
                  <div className="action-icon">⚖️</div>
                  <h3>Debate Bill</h3>
                  <p>Set up a structured debate about the bill with AI opponents or other users</p>
                </div>
              </div>

              <div className="step-navigation">
                <button className="nav-button back" onClick={() => goToStep(1)}>
                  ← Back
                </button>
                <button 
                  className="nav-button next" 
                  onClick={() => goToStep(3)}
                  disabled={!actionType}
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Configure & Execute */}
          {currentStep === 3 && (
            <div className="step-three">
              {/* Selected Bill Display */}
              <div className="selected-bill-display">
                <div className="selected-bill-header">
                  <h3>
                    {billSource === 'recommended' ? (
                      `Selected Bill: ${selectedBill.type} ${selectedBill.number} - ${selectedBill.title}`
                    ) : billSource === 'link' ? (
                      `Selected Bill: ${selectedBill.type} ${selectedBill.number} - ${selectedBill.title}`
                    ) : billSource === 'state' ? (
                      `Selected Bill: ${selectedBill.number} - ${selectedBill.title}`
                    ) : billSource === 'proposition' ? (
                      `Selected Proposition: ${selectedBill.number} - ${selectedBill.shortTitle || selectedBill.title}`
                    ) : (
                      `Selected Bill: 📄 ${selectedBill.name}`
                    )}
                  </h3>
                </div>
              </div>

              <div className="action-display">
                <h3>Action: {actionType === 'analyze' ? 'Analyze Bill' : 'Debate Bill'}</h3>
              </div>

              {actionType === 'analyze' && (
                <div className="analyze-config">
                  <h2>Step 3: Configure Analysis</h2>
                  <div className="config-section">
                    <div className="model-selection">
                      <label className="model-label">
                        Select AI Model
                      </label>
                      <select 
                        className="model-dropdown"
                        value={selectedModel} 
                        onChange={(e) => setSelectedModel(e.target.value)}
                      >
                        {modelOptions.map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                      <p className="model-description">
                        Choose the AI model that will analyze your bill. Different models may provide varying perspectives and analysis depth.
                      </p>
                    </div>

                    <div className="profile-status-section">
                      <label className="model-label">
                        Personalized Analysis
                      </label>
                      <ProfileStatusIndicator user={user} />
                    </div>

                    <div className="section-selection">
                        <label className="section-label">
                          Choose What to Analyze
                        </label>

                        <div className="analysis-scope-options">
                          <div className="scope-option">
                            <input
                              type="radio"
                              id="analyze-whole-bill"
                              name="analysis-scope"
                              checked={analyzeWholeBill}
                              onChange={() => {
                                setAnalyzeWholeBill(true);
                                setSelectedSections([]);
                              }}
                            />
                            <label htmlFor="analyze-whole-bill">
                              <strong>Analyze Whole Bill</strong>
                              <span className="option-description">Analyze the entire bill document</span>
                            </label>
                          </div>

                          <div className="scope-option">
                            <input
                              type="radio"
                              id="analyze-sections"
                              name="analysis-scope"
                              checked={!analyzeWholeBill}
                              onChange={async () => {
                                setAnalyzeWholeBill(false);
                                console.log('🔍 Section selection mode activated');
                                console.log('📊 Debug - billSource:', billSource);

                                let billText = billSource === 'upload' ? extractedPdfText : extractedBillData?.text;
                                console.log('📊 Debug - initial billText length:', billText?.length || 0);
                                console.log('📊 Debug - existing billSections count:', billSections.length);

                                // For uploaded PDFs, extract text if not available
                                if (billSource === 'upload' && !billText && selectedBill) {
                                  console.log('🔄 PDF text not available, extracting from file...');
                                  try {
                                    billText = await extractPdfText(selectedBill);
                                    console.log('✅ PDF text extracted, type:', typeof billText, 'length:', billText?.length || 0);
                                  } catch (error) {
                                    console.error('❌ Failed to extract PDF text:', error);
                                    return;
                                  }
                                }

                                // For recommended/link/state/proposition bills, extract text if not available
                                if ((billSource === 'recommended' || billSource === 'link' || billSource === 'state' || billSource === 'proposition') && !billText && selectedBill) {
                                  console.log('🔄 Bill text not available, extracting from API...');
                                  try {
                                    if (billSource === 'state') {
                                      billText = await extractStateBillText(selectedBill);
                                    } else if (billSource === 'proposition') {
                                      billText = await extractCAPropositionText(selectedBill);
                                    } else {
                                      billText = await extractRecommendedBillText(selectedBill);
                                    }
                                    console.log('✅ Bill text extracted, type:', typeof billText, 'length:', billText?.length || 0);
                                  } catch (error) {
                                    console.error('❌ Failed to extract bill text:', error);
                                    return;
                                  }
                                }

                                // Auto-extract sections if not already done
                                if (billSections.length === 0 && billText) {
                                  console.log('🚀 Auto-extracting sections from bill text...');
                                  const sections = extractSectionsFromText(billText);
                                  console.log('✅ Auto-extracted sections count:', sections.length);
                                  console.log('💾 Setting bill sections in state (auto-extract)');
                                  setBillSections(sections);
                                } else if (!billText) {
                                  console.log('⚠️ No bill text available for section extraction');
                                } else {
                                  console.log('ℹ️ Sections already extracted, count:', billSections.length);
                                }
                              }}
                            />
                            <label htmlFor="analyze-sections">
                              <strong>Analyze Specific Sections</strong>
                              <span className="option-description">Choose specific sections to analyze</span>
                            </label>
                          </div>
                        </div>

                        {!analyzeWholeBill && (
                          <div className="sections-list">
                            {billSections.length === 0 && (billSource === 'upload' ? extractedPdfText : selectedBill) && (
                              <button
                                className="extract-sections-btn"
                                onClick={async () => {
                                  console.log('🔧 Manual section extraction triggered');
                                  console.log('📊 Debug - billSource:', billSource);

                                  let billText = billSource === 'upload' ? extractedPdfText : extractedBillData?.text;
                                  console.log('📊 Debug - initial billText length:', billText?.length || 0);

                                  // For uploaded PDFs, extract text if not available
                                  if (billSource === 'upload' && !billText && selectedBill) {
                                    console.log('🔄 PDF text not available, extracting from file...');
                                    try {
                                      billText = await extractPdfText(selectedBill);
                                      console.log('✅ PDF text extracted, type:', typeof billText, 'length:', billText?.length || 0);
                                    } catch (error) {
                                      console.error('❌ Failed to extract PDF text:', error);
                                      return;
                                    }
                                  }

                                  // For recommended/link/state/proposition bills, extract text if not available
                                  if ((billSource === 'recommended' || billSource === 'link' || billSource === 'state' || billSource === 'proposition') && !billText && selectedBill) {
                                    console.log('🔄 Bill text not available, extracting from API...');
                                    try {
                                      if (billSource === 'state') {
                                        billText = await extractStateBillText(selectedBill);
                                      } else if (billSource === 'proposition') {
                                        billText = await extractCAPropositionText(selectedBill);
                                      } else {
                                        billText = await extractRecommendedBillText(selectedBill);
                                      }
                                      console.log('✅ Bill text extracted, type:', typeof billText, 'length:', billText?.length || 0);
                                    } catch (error) {
                                      console.error('❌ Failed to extract bill text:', error);
                                      return;
                                    }
                                  }

                                  if (billText) {
                                    console.log('🚀 Extracting sections from bill text...');
                                    const sections = extractSectionsFromText(billText);
                                    console.log('✅ Manual extraction completed, sections count:', sections.length);
                                    console.log('💾 Setting bill sections in state (manual extract)');
                                    setBillSections(sections);
                                  } else {
                                    console.log('❌ No bill text available for extraction');
                                  }
                                }}
                              >
                                Extract Sections from Bill
                              </button>
                            )}

                            {billSections.length > 0 && (
                              <>
                                <div className="sections-header">
                                  <span>Select sections to analyze:</span>
                                  <div className="select-actions">
                                    <button
                                      className="select-all-btn"
                                      onClick={() => {
                                        const filteredSections = getFilteredSections();
                                        const allFilteredIds = filteredSections.map(s => s.id);
                                        const newSelected = [...new Set([...selectedSections, ...allFilteredIds])];
                                        setSelectedSections(newSelected);
                                      }}
                                    >
                                      Select All
                                    </button>
                                    <button
                                      className="select-none-btn"
                                      onClick={() => {
                                        if (sectionSearchTerm) {
                                          const filteredSections = getFilteredSections();
                                          const filteredIds = filteredSections.map(s => s.id);
                                          setSelectedSections(selectedSections.filter(id => !filteredIds.includes(id)));
                                        } else {
                                          setSelectedSections([]);
                                        }
                                      }}
                                    >
                                      Deselect All
                                    </button>
                                  </div>
                                </div>

                                <div className="section-search">
                                  <input
                                    type="text"
                                    className="section-search-input"
                                    placeholder="Search sections by title, content, type, or number..."
                                    value={sectionSearchTerm}
                                    onChange={(e) => setSectionSearchTerm(e.target.value)}
                                  />
                                  {sectionSearchTerm && (
                                    <button
                                      className="clear-search-btn"
                                      onClick={() => setSectionSearchTerm('')}
                                      title="Clear search"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>

                                {getFilteredSections().length > 0 ? (
                                  <div className="sections-grid">
                                    {getFilteredSections().map((section) => (
                                      <div key={section.id} className="section-item">
                                        <label className="section-checkbox">
                                          <input
                                            type="checkbox"
                                            checked={selectedSections.includes(section.id)}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedSections([...selectedSections, section.id]);
                                              } else {
                                                setSelectedSections(selectedSections.filter(id => id !== section.id));
                                              }
                                            }}
                                          />
                                          <div className="section-info">
                                            <div className="section-title">{section.title}</div>
                                            <div className="section-type">{section.type}</div>
                                            <div className="section-preview">
                                              {section.content.substring(0, 100)}...
                                            </div>
                                          </div>
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="no-search-results">
                                    {sectionSearchTerm ?
                                      `No sections found matching "${sectionSearchTerm}"` :
                                      'No sections available'
                                    }
                                  </div>
                                )}
                              </>
                            )}

                            {billSections.length === 0 && !(billSource === 'upload' ? extractedPdfText : selectedBill) && (
                              <div className="no-sections-message">
                                Loading bill sections...
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                  </div>

                  {!analyzeWholeBill && selectedSections.length === 0 && (
                    <div className="validation-message">
                      Please select at least one section to analyze, or choose "Analyze Whole Bill" option.
                    </div>
                  )}

                  <div className="button-group">
                    <button className="nav-button back" onClick={() => goToStep(2)}>
                      ← Back
                    </button>
                    <button
                      className="nav-button execute"
                      onClick={handleAnalyzeExecution}
                      disabled={loadingState || (!analyzeWholeBill && selectedSections.length === 0)}
                    >
                      {loadingState ? 'Analyzing...' : 'Start Analysis'}
                    </button>
                  </div>
                </div>
              )}

              {actionType === 'debate' && (
                <div className="debate-config">
                  <h2>Step 3: Configure Debate</h2>
                  
                  {/* Bill Name Section */}
                  <div className="config-section">
                    <div className="debate-topic-section">
                      <label className="debate-label">
                        Bill Name for Debate
                      </label>
                      <input
                        type="text"
                        className="debate-topic-input"
                        value={debateTopic}
                        onChange={(e) => setDebateTopic(e.target.value)}
                        placeholder="Enter debate topic name"
                      />
                      <p className="input-description">
                        This will be the topic displayed during the debate session.
                      </p>
                    </div>
                  </div>

                  {/* Debate Mode Selection */}
                  <div className="config-section">
                    <div className="debate-mode-section">
                      <label className="debate-label">
                        Select Debate Mode
                      </label>
                      <div className="debate-mode-cards">
                        {[
                          { mode: 'ai-vs-ai', label: 'AI vs AI', desc: 'Watch two AIs debate', icon: '🤖' },
                          { mode: 'ai-vs-user', label: 'AI vs User', desc: 'Debate against AI', icon: '🧠' },
                          { mode: 'user-vs-user', label: 'User vs User', desc: 'Debate with friend', icon: '👥' }
                        ].map(({ mode, label, desc, icon }) => (
                          <div 
                            key={mode}
                            className={`debate-mode-card ${debateMode === mode ? 'selected' : ''}`}
                            onClick={() => setDebateMode(mode)}
                          >
                            <div className="mode-icon">{icon}</div>
                            <div className="mode-content">
                              <strong className="mode-title">{label}</strong>
                              <span className="mode-description">{desc}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mode-description-text">
                        Choose how you want to conduct the debate about this bill.
                      </p>
                    </div>
                  </div>

                  {/* Debate Format Selection */}
                  {debateMode && (
                    <div className="config-section">
                      <div className="debate-format-section">
                        <label className="debate-label">
                          Select Debate Format
                        </label>
                        <div className="debate-format-cards">
                          {debateFormats.map((formatOption) => (
                            <div 
                              key={formatOption.id}
                              className={`debate-format-card ${debateFormat === formatOption.id ? 'selected' : ''}`}
                              onClick={() => setDebateFormat(formatOption.id)}
                            >
                              <div className="format-content">
                                <h4 className="format-title">{formatOption.title}</h4>
                                <p className="format-description">{formatOption.description}</p>
                                <div className="format-tags">
                                  {formatOption.tags.map((tag, index) => (
                                    <span key={index} className="format-tag">{tag}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="format-description-text">
                          Choose the structure and style of your debate.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Persona Selection */}
                  {debateMode && debateFormat && (debateMode === 'ai-vs-ai' || debateMode === 'ai-vs-user') && (
                    <div className="config-section">
                      <div className="debate-persona-section">
                        <label className="debate-label">
                          Select AI Personas
                        </label>
                        <p className="persona-description-text">
                          {debateMode === 'ai-vs-ai' 
                            ? 'Choose personas for both Pro and Con sides of the debate.'
                            : 'Choose a persona for the AI opponent.'
                          }
                        </p>
                        
                        <div className="debate-persona-cards">
                          {personas.map((persona) => (
                            <div 
                              key={persona.id}
                              className={`debate-persona-card ${
                                (debateMode === 'ai-vs-ai' && (proPersona === persona.id || conPersona === persona.id)) ||
                                (debateMode === 'ai-vs-user' && aiPersona === persona.id) ? 'selected' : ''
                              }`}
                            >
                              <div className="persona-photo">
                                <img 
                                  src={persona.image} 
                                  alt={persona.name}
                                  className="persona-image"
                                />
                              </div>
                              <div className="persona-info">
                                <h4 className="persona-name">{persona.name}</h4>
                                <p className="persona-description">{persona.description}</p>
                                
                                {debateMode === 'ai-vs-ai' && (
                                  <div className="persona-buttons">
                                    <button 
                                      className={`persona-select-btn ${proPersona === persona.id ? 'selected' : ''}`}
                                      onClick={() => setProPersona(persona.id)}
                                    >
                                      {proPersona === persona.id ? '✓ Pro Side' : 'Select Pro'}
                                    </button>
                                    <button 
                                      className={`persona-select-btn ${conPersona === persona.id ? 'selected' : ''}`}
                                      onClick={() => setConPersona(persona.id)}
                                    >
                                      {conPersona === persona.id ? '✓ Con Side' : 'Select Con'}
                                    </button>
                                  </div>
                                )}
                                
                                {debateMode === 'ai-vs-user' && (
                                  <button 
                                    className={`persona-select-btn ${aiPersona === persona.id ? 'selected' : ''}`}
                                    onClick={() => setAiPersona(persona.id)}
                                  >
                                    {aiPersona === persona.id ? '✓ Selected' : 'Select AI'}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="button-group">
                    <button className="nav-button back" onClick={() => goToStep(2)}>
                      ← Back
                    </button>
                    <button 
                      className="nav-button next"
                      onClick={handleDebateExecution}
                      disabled={!isDebateConfigComplete()}
                    >
                      Start Debate
                    </button>
                  </div>
                </div>
              )}

              {loadingState && (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <div className="loading-text">
                    <div className="loading-main">
                      {actionType === 'analyze' ? 'Analyzing bill...' : 'Processing bill...'}
                    </div>
                    {processingStage && (
                      <div className="loading-stage">
                        <ProgressBar 
                          step={progressStep} 
                          total={totalSteps} 
                          message={processingStage} 
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {error && <p className="error-text">{error}</p>}
              {showInfoNote && (
                <InfoNote 
                  message="No published text is available for this bill yet. The bill may still be in draft form or pending publication on Congress.gov."
                  expanded={infoNoteExpanded}
                  onToggle={() => setInfoNoteExpanded(!infoNoteExpanded)}
                />
              )}
            </div>
          )}
          
          
          {/* Results Section with Staged Loading */}
          {analysisResult && (
            <div 
              ref={resultsRef}
              className={`results-section ${showGradingSection ? 'results-visible' : 'results-hidden'} ${analysisContentReady ? 'content-ready' : ''}`}
            >
              <div className="results-header" style={{
                opacity: showGradingSection ? 1 : 0,
                transition: 'opacity 0.5s ease-in-out'
              }}>
                <div className="results-header-top">
                  <h2>Analysis Results</h2>
                </div>
                <div className="results-actions">
                  <button 
                    className="share-analysis-btn" 
                    onClick={handleShareAnalysis}
                    style={{
                      opacity: 1,
                      pointerEvents: 'auto'
                    }}
                  >
                    Share Analysis
                  </button>
                  <button 
                    className="download-analysis-btn" 
                    onClick={handleDownloadAnalysisPDF}
                    style={{
                      opacity: 1,
                      pointerEvents: 'auto'
                    }}
                  >
                    Download PDF
                  </button>                 
                  <button 
                    className="new-analysis-btn" 
                    onClick={resetFlow}
                    style={{
                      opacity: analysisContentReady ? 1 : 0.5,
                      pointerEvents: analysisContentReady ? 'auto' : 'none'
                    }}
                  >
                    Start New Analysis
                  </button>
                </div>
              </div>
              
              {/* Show grading section for bill analysis */}
              {analysisGrades && (
                <div className="grading-stage-container grading-loaded" style={{ marginBottom: '2rem' }}>
                  <BillGradingSection grades={analysisGrades} />
                </div>
              )}
              
              {/* Analysis Text Section - Enhanced with TTS */}
              {showAnalysisText && (
                <TTSProvider analysisText={analysisResult}>
                  <div style={{ marginTop: '2rem' }}>
                    {/* Custom H2 Section Component */}
                    <H2SectionRenderer
                      analysisText={`## Detailed Analysis\n\n${analysisResult}`}
                    />

                    {/* Show Bill Text Section */}
                    <div style={{ marginTop: '3rem' }}>
                      <div className="expandable-section">
                        <button
                          className="expand-toggle-btn"
                          onClick={() => setShowBillTextSection(!showBillTextSection)}
                          style={{
                            background: 'none',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            padding: '8px 16px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            marginBottom: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <span style={{
                            transform: showBillTextSection ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                            fontSize: '12px'
                          }}>
                            ▶
                          </span>
                          {showBillTextSection ? 'Hide' : 'Show'} Bill Text
                        </button>

                        {showBillTextSection && (
                          <H2SectionRenderer
                            analysisText={`## Show Bill Text\n\n${analyzeWholeBill ?
                              `**Bill Title:** ${getBillTitle()}\n\n${(billSource === 'upload' ? extractedPdfText : extractedBillData?.text) || 'No bill text available.'}` :
                              getSelectedSectionsText() || 'No sections selected.'
                            }`}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </TTSProvider>
              )}
              
              
              {/* Action buttons at the bottom - only show when everything is ready */}
              {analysisContentReady && (
                <div 
                  className="analysis-bottom-actions"
                  style={{
                    opacity: analysisContentReady ? 1 : 0,
                    transition: 'opacity 0.5s ease-in-out 0.5s'
                  }}
                >
                  <button className="share-analysis-btn-large" onClick={handleShareAnalysis}>
                    Share This Analysis
                  </button>
                  <button className="download-analysis-btn-large" onClick={handleDownloadAnalysisPDF}>
                    Download PDF Report
                  </button>
                </div>
              )}
            </div>
          )}
           </div>
        </div>


        {/* Footer with fade-in animation */}
        <div className={`footer-wrapper ${componentsLoaded.footer ? 'component-visible' : 'component-hidden'}`}>
          <Footer />
        </div>
      </div>

      {/* Share Modal for Current Analysis - Outside container for proper centering */}
      {showAnalysisShareModal && analysisResult && (
        <ShareModal
          isOpen={showAnalysisShareModal}
          onClose={() => setShowAnalysisShareModal(false)}
          transcript={{
            transcript: analysisResult,
            topic: selectedBill ? (
              billSource === 'proposition'
                ? `Proposition Analysis: ${getBillTitle()}`
                : `Bill Analysis: ${getBillTitle()}`
            ) : 'Bill Analysis',
            mode: 'analysis',
            activityType: billSource === 'proposition' ? 'Analyze Proposition' : 'Analyze Bill',
            grades: analysisGrades,
            model: selectedModel,
            createdAt: new Date().toISOString()
          }}
          transcriptId={null}
        />
      )}

      {/* Federal Bill Info Modal */}
      {showFederalBillInfo && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowFederalBillInfo(false)}
        >
          <div
            style={{
              backgroundColor: 'rgba(30, 41, 59, 0.95)',
              padding: '2rem',
              borderRadius: '12px',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflow: 'auto',
              border: '1px solid rgba(71, 85, 105, 0.5)',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: 'rgba(255, 255, 255, 0.95)', fontSize: '1.5rem' }}>
                Federal Bill Types — Quick Guide
              </h3>
              <button
                onClick={() => setShowFederalBillInfo(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.25rem'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ color: 'rgba(255, 255, 255, 0.85)', lineHeight: '1.6' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(71, 85, 105, 0.5)' }}>
                    <th style={{ textAlign: 'left', padding: '0.75rem', color: 'rgba(255, 255, 255, 0.95)' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', color: 'rgba(255, 255, 255, 0.95)' }}>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>HR</td>
                    <td style={{ padding: '0.75rem' }}>House Bill — legislation originating in the House of Representatives</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>S</td>
                    <td style={{ padding: '0.75rem' }}>Senate Bill — legislation originating in the Senate</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>HJ Res</td>
                    <td style={{ padding: '0.75rem' }}>House Joint Resolution — requires Presidential signature, used for constitutional amendments</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>SJ Res</td>
                    <td style={{ padding: '0.75rem' }}>Senate Joint Resolution — same as HJ Res but originates in Senate</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>H Con Res</td>
                    <td style={{ padding: '0.75rem' }}>House Concurrent Resolution — expresses congressional opinion, no Presidential signature</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>S Con Res</td>
                    <td style={{ padding: '0.75rem' }}>Senate Concurrent Resolution — same as H Con Res but originates in Senate</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>H Res</td>
                    <td style={{ padding: '0.75rem' }}>House Simple Resolution — House rules, opinions, matters affecting only the House</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>S Res</td>
                    <td style={{ padding: '0.75rem' }}>Senate Simple Resolution — Senate rules, opinions, matters affecting only the Senate</td>
                  </tr>
                </tbody>
              </table>

              <div style={{
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                padding: '1rem',
                borderRadius: '6px',
                border: '1px solid rgba(0, 123, 255, 0.3)',
                marginBottom: '1rem'
              }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>
                  <strong>Bills</strong> (HR, S) become law when passed by both chambers and signed by the President
                </p>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>
                  <strong>Joint Resolutions</strong> have the same force as bills, often used for constitutional amendments
                </p>
                <p style={{ margin: 0, fontSize: '0.95rem' }}>
                  <strong>Resolutions</strong> (Simple & Concurrent) express opinions but don't become law
                </p>
              </div>

              <button
                onClick={() => setShowFederalBillInfo(false)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#007bff',
                  color: 'white',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* State Bill Prefix Info Modal */}
      {showBillPrefixInfo && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowBillPrefixInfo(false)}
        >
          <div
            style={{
              backgroundColor: 'rgba(30, 41, 59, 0.95)',
              padding: '2rem',
              borderRadius: '12px',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflow: 'auto',
              border: '1px solid rgba(71, 85, 105, 0.5)',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: 'rgba(255, 255, 255, 0.95)', fontSize: '1.5rem' }}>
                State Bill Prefixes — Quick Guide
              </h3>
              <button
                onClick={() => setShowBillPrefixInfo(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.25rem'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ color: 'rgba(255, 255, 255, 0.85)', lineHeight: '1.6' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(71, 85, 105, 0.5)' }}>
                    <th style={{ textAlign: 'left', padding: '0.75rem', color: 'rgba(255, 255, 255, 0.95)' }}>Prefix</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', color: 'rgba(255, 255, 255, 0.95)' }}>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>HB / SB</td>
                    <td style={{ padding: '0.75rem' }}>House / Senate Bill (standard state format)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>AB / SB</td>
                    <td style={{ padding: '0.75rem' }}>Assembly / Senate Bill (CA, NV, NY, WI)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>HJR / SJR</td>
                    <td style={{ padding: '0.75rem' }}>Joint Resolution — proposes amendments or petitions Congress</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>HCR / SCR</td>
                    <td style={{ padding: '0.75rem' }}>Concurrent Resolution — expresses legislature's intent</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>HR / SR</td>
                    <td style={{ padding: '0.75rem' }}>Simple Resolution — one chamber only</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>ACA / SCA</td>
                    <td style={{ padding: '0.75rem' }}>Constitutional Amendment (CA only → becomes a proposition)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>LB</td>
                    <td style={{ padding: '0.75rem' }}>Legislative Bill (Nebraska, unicameral)</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>HF / SF</td>
                    <td style={{ padding: '0.75rem' }}>House / Senate File (Iowa, Minnesota)</td>
                  </tr>
                </tbody>
              </table>

              <div style={{
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                padding: '1rem',
                borderRadius: '6px',
                border: '1px solid rgba(0, 123, 255, 0.3)',
                marginBottom: '1rem'
              }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>
                  <strong>Special sessions</strong> add an "X" (e.g. ABX1 10)
                </p>
                <p style={{ margin: 0, fontSize: '0.95rem' }}>
                  Only <strong>bills</strong> (AB/HB/SB) become law; amendments go to voters; resolutions are symbolic
                </p>
              </div>

              <button
                onClick={() => setShowBillPrefixInfo(false)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#007bff',
                  color: 'white',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </>
  );
};

export default Legislation;
