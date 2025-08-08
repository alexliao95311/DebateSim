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
import HistorySidebar from "./HistorySidebar";
import VoiceOutput from './VoiceOutput';
import { MessageSquare, Code, Share2, X, Download, History, User, LogOut, ChevronDown, Menu } from 'lucide-react';
import Footer from "./Footer";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const modelOptions = [
  "openai/gpt-4o", 
  "meta-llama/llama-3.3-70b-instruct", 
  "google/gemini-2.0-flash-001",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o-mini",
  "openai/gpt-4o-mini-search-preview"
];

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

  // Generate correct Congress.gov URL
  const getBillTypeUrl = (type) => {
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
  
  const congressUrl = `https://www.congress.gov/bill/119th-congress/${getBillTypeUrl(bill.type)}/${bill.number}`;

  return (
    <div className="bill-card compact">
      <div className="bill-header-row">
        <div className="bill-code-line">
          <span className="bill-type">{bill.type} {bill.number}</span>
        </div>
        <a 
          href={congressUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="congress-link"
          title="View on Congress.gov"
        >
          View Full Text
        </a>
      </div>
      <div className="bill-status-line">
        <span className="bill-status">{bill.lastAction}</span>
      </div>
      <h3 className="bill-title">{bill.title}</h3>
      <p className="bill-sponsor">Sponsored by {bill.sponsor}</p>
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

  // Common states
  const [error, setError] = useState('');
  const [loadingState, setLoadingState] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [progressStep, setProgressStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(4);

  // Analysis state
  const [analysisResult, setAnalysisResult] = useState('');
  const [analysisGrades, setAnalysisGrades] = useState(null);
  const [selectedModel, setSelectedModel] = useState(modelOptions[0]);

  // Debate state
  const [debateTopic, setDebateTopic] = useState('');
  const [debateMode, setDebateMode] = useState('');
  
  // History state
  const [history, setHistory] = useState([]);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAnalysisShareModal, setShowAnalysisShareModal] = useState(false);
  const [showMobileDropdown, setShowMobileDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Recommended bills state
  const [recommendedBills, setRecommendedBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [billsError, setBillsError] = useState('');

  const billNameInputRef = useRef(null);
  const resultsRef = useRef(null);
  const navigate = useNavigate();

  // Fetch debate history function
  const fetchHistory = async () => {
    if (!user || user.isGuest) return;
    try {
      const db = getFirestore();
      const transcriptsRef = collection(db, "users", user.uid, "transcripts");
      const q = query(transcriptsRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const fetchedHistory = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setHistory(fetchedHistory);
      } else {
        setHistory([]); // Explicitly set empty array
      }
    } catch (err) {
      console.error("Error fetching debate history:", err);
    }
  };

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

  // Fetch debate history on component mount (after loading)
  useEffect(() => {
     if (isContentReady) {
      fetchHistory();
    }
  }, [user, isContentReady]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowMobileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
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

  // Step 1: Handle bill selection from recommended bills (lazy loading)
  const handleSelectRecommendedBill = (bill) => {
    setSelectedBill(bill);
    setBillSource('recommended');
    setExtractedBillData(null); // Clear previous data
    setCurrentStep(2);
    setError('');
  };
  
  // Extract recommended bill text when needed
  const extractRecommendedBillText = async (bill) => {
    if (extractedBillData) {
      return extractedBillData; // Return cached data
    }
    
    setProcessingStage('Extracting bill text from Congress.gov...');
    
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
    
    // Check if bill text is unavailable
    if (data.text && data.text.includes('Bill Text Unavailable')) {
      throw new Error('This bill\'s text is not yet available from Congress.gov. You can try again later or upload a PDF version if available.');
    }
    
    // Cache the extracted bill data
    const billData = {
      text: data.text,
      title: data.title || bill.title,
      billCode: `${bill.type} ${bill.number}`
    };
    
    setExtractedBillData(billData);
    return billData;
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
    return data.text;
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
      setCurrentStep(2);
      setError('');
    } else {
      setError('Please upload a valid PDF file.');
    }
  };

  // Step 2: Handle action selection
  const handleActionSelection = (action) => {
    setActionType(action);
    
    // Auto-fill debate topic when entering debate mode
    if (action === 'debate' && selectedBill) {
      let billName = '';
      if (billSource === 'recommended') {
        billName = `${selectedBill.type} ${selectedBill.number} - ${selectedBill.title}`;
      } else {
        billName = selectedBill.name.replace('.pdf', '');
      }
      setDebateTopic(billName);
    }
    
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
          await fetchHistory();
        } catch (err) {
          console.error("Error saving analysis to history:", err);
        }
      }
    }, 2400);
  };

  // Step 3: Handle analysis execution with progress updates
  const handleAnalyzeExecution = async () => {
    setLoadingState(true);
    setError('');
    setProgressStep(0);
    setTotalSteps(3);
    
    try {
      if (billSource === 'recommended' || billSource === 'link') {
        // Step 1: Extract bill text if not already cached
        setProcessingStage('Fetching bill text from Congress.gov...');
        setProgressStep(1);
        
        const billData = await extractRecommendedBillText(selectedBill);
        
        // Step 2: Analyze legislation
        setProcessingStage('Analyzing legislation with AI...');
        setProgressStep(2);
        
        const response = await fetch(`${API_URL}/analyze-recommended-bill`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: selectedBill.type,
            number: selectedBill.number,
            congress: selectedBill.congress || 119,
            model: selectedModel
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
        await stageAnalysisResults(data.analysis, data.grades, `Bill Analysis: ${selectedBill.title}`);
        
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
              text: extractedPdfText,
              model: selectedModel
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
        await stageAnalysisResults(analysisData.analysis, analysisData.grades, `Bill Analysis: ${selectedBill.name}`);
      }
      
    } catch (err) {
      setError(`Error analyzing bill: ${err.message}`);
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
    
    const billText = (billSource === 'recommended' || billSource === 'link') ? extractedBillData?.text : null;
    const billTitle = (billSource === 'recommended' || billSource === 'link') ? extractedBillData?.title : debateTopic;
    
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
            debateMode: debateMode
          }
        });
        
      } catch (err) {
        setError(`Error extracting text: ${err.message}`);
        setLoadingState(false);
        return;
      }
    } else if ((billSource === 'recommended' || billSource === 'link') && selectedBill) {
      // For recommended bills, extract text first
      setLoadingState(true);
      try {
        setProcessingStage('Extracting bill text from Congress.gov...');
        
        const response = await fetch(`${API_URL}/extract-recommended-bill-text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: selectedBill.type,
            number: selectedBill.number,
            congress: selectedBill.congress || 119,
            title: selectedBill.title
          }),
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
            debateMode: debateMode
          }
        });
        
        setLoadingState(false);
        
      } catch (err) {
        setError(`Error extracting bill text: ${err.message}`);
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
          debateMode: debateMode
        }
      });
    }
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
    setGradingSectionLoaded(false);
    setAnalysisContentReady(false);
  };

  // Handle sharing current analysis - simplified like Judge.jsx
  const handleShareAnalysis = () => {
    if (!analysisResult) return;
    setShowAnalysisShareModal(true);
  };

  const handleDownloadAnalysisPDF = () => {
    if (!analysisResult) return;
    
    try {
      const billTitle = billSource === 'recommended' || billSource === 'link' ? 
        selectedBill.title : 
        selectedBill.name?.replace('.pdf', '') || 'Bill Analysis';

      PDFGenerator.generateAnalysisPDF({
        topic: `Bill Analysis: ${billTitle}`,
        content: analysisResult,
        grades: analysisGrades,
        model: selectedModel,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to generate analysis PDF:", err);
    }
  };


  const [searchQuery, setSearchQuery] = useState("");
  const [filteredBills, setFilteredBills] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [liveSearchLoading, setLiveSearchLoading] = useState(false);
  const [searchAbortController, setSearchAbortController] = useState(null);

  // Bill link functionality state
  const [billLink, setBillLink] = useState("");
  const [linkParsedBill, setLinkParsedBill] = useState(null);
  const [showLinkConfirmation, setShowLinkConfirmation] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    setFilteredBills(recommendedBills);
  }, [recommendedBills]);

  // Real-time search suggestions with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim() && searchQuery.trim().length >= 2) {
        generateSuggestions(searchQuery);
      } else {
        setSearchSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Live search with debouncing - update bills view as user types
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Cancel previous search if still running
      if (searchAbortController) {
        searchAbortController.abort();
      }

      if (searchQuery.trim() && searchQuery.trim().length >= 2) {
        const controller = new AbortController();
        setSearchAbortController(controller);
        setLiveSearchLoading(true);
        
        performSearch(searchQuery, controller.signal)
          .finally(() => {
            setLiveSearchLoading(false);
            setSearchAbortController(null);
          });
      } else if (searchQuery.trim().length === 0) {
        // Clear search when input is empty
        setIsSearchMode(false);
        setSearchResults([]);
        setFilteredBills(recommendedBills);
        setShowSuggestions(false);
        setSearchError("");
        setLiveSearchLoading(false);
      }
    }, 500); // 500ms debounce for live search (slightly longer to avoid too many API calls)

    return () => {
      clearTimeout(timeoutId);
      // Cancel any pending search when component unmounts or query changes
      if (searchAbortController) {
        searchAbortController.abort();
      }
    };
  }, [searchQuery, recommendedBills]);

  const performSearch = async (query, abortSignal = null) => {
    if (!query.trim()) {
      setIsSearchMode(false);
      setSearchResults([]);
      setFilteredBills(recommendedBills);
      setShowSuggestions(false);
      return;
    }

    setSearchLoading(true);
    setSearchError("");
    setIsSearchMode(true);
    setShowSuggestions(false);
    
    try {
      const fetchOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: query.trim(),
          limit: 15 // Reduced limit for faster search
        }),
      };

      if (abortSignal) {
        fetchOptions.signal = abortSignal;
      }

      const response = await fetch(`${API_URL}/search-bills`, fetchOptions);

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.bills && Array.isArray(data.bills)) {
        setSearchResults(data.bills);
        setFilteredBills(data.bills);
        
        // Log search success
        console.log(`Found ${data.bills.length} bills for query: "${query}"`);
      } else {
        setSearchResults([]);
        setFilteredBills([]);
        console.log(`No bills found for query: "${query}"`);
      }
      
    } catch (err) {
      // Don't show error for aborted requests
      if (err.name === 'AbortError') {
        console.log("Search aborted:", query);
        return;
      }
      
      console.error("Search error:", err);
      let errorMessage = "Search failed";
      
      if (err.message.includes("CONGRESS_API_KEY")) {
        errorMessage = "Congress.gov API key is required for bill search. Please check your configuration.";
      } else if (err.message.includes("500")) {
        errorMessage = "Congress.gov API is currently unavailable. Please try again later.";
      } else if (err.message.includes("404")) {
        errorMessage = "No bills found for your search query.";
      } else {
        errorMessage = `Search failed: ${err.message}`;
      }
      
      setSearchError(errorMessage);
      setSearchResults([]);
      setFilteredBills([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const generateSuggestions = async (query) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/search-suggestions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: query.trim(),
          limit: 5
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.suggestions && Array.isArray(data.suggestions)) {
          setSearchSuggestions(data.suggestions);
          setShowSuggestions(data.suggestions.length > 0);
        }
      }
    } catch (err) {
      console.error("Suggestions error:", err);
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      // Clear debounce and search immediately
      performSearch(searchQuery);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    performSearch(suggestion);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setIsSearchMode(false);
    setFilteredBills(recommendedBills);
    setShowSuggestions(false);
    setSearchError("");
  };

  // Keyboard navigation for suggestions
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchSubmit();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Show suggestions when typing
    if (value.trim().length >= 2) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
    
    // Clear search error when user starts typing
    if (searchError) {
      setSearchError("");
    }
  };

  const handleSearchInputFocus = () => {
    if (searchQuery.trim().length >= 2 && searchSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleSearchInputBlur = () => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => {
      setShowSuggestions(false);
    }, 300);
  };

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

  // Handle bill link submission
  const handleBillLinkSubmit = async () => {
    if (!billLink.trim()) {
      setLinkError("Please enter a Congress.gov URL");
      return;
    }

    setLinkLoading(true);
    setLinkError("");

    try {
      // Parse the URL
      const parsedBill = parseCongressUrl(billLink);
      
      // Fetch bill information from backend
      const response = await fetch(`${API_URL}/extract-bill-from-url`, {
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
        throw new Error(`Failed to fetch bill information: ${response.status} ${response.statusText}`);
      }

      const billData = await response.json();
      
      // Store the parsed bill data and show confirmation
      setLinkParsedBill({
        ...parsedBill,
        title: billData.title,
        description: billData.description || billData.title,
        sponsor: billData.sponsor || "Unknown",
        congress: parsedBill.congress
      });
      
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
      setSelectedBill(linkParsedBill);
      setBillSource('link');
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
      
      <div className={`legislation-container ${showHistorySidebar ? 'legislation-sidebar-open' : ''} ${isContentReady ? 'content-loaded' : 'content-loading'}`}>
        {/* Header with fade-in animation */}
        <header className={`legislation-header ${componentsLoaded.header ? 'component-visible' : 'component-hidden'}`}>
          <div className="legislation-header-content">
            {/* LEFT SECTION: History Button */}
            <div className="legislation-header-left">
              <button
                className="legislation-history-button"
                onClick={() => setShowHistorySidebar(!showHistorySidebar)}
              >
                <History size={16} />
                <span>History</span>
              </button>
            </div>

            {/* CENTER SECTION: Title */}
            <div className="legislation-header-center">
              <h1 className="legislation-site-title" onClick={() => navigate("/")}>
                <span className="legislation-title-full">Bill and Legislation Debate</span>
                <span className="legislation-title-mobile">Bill Debate</span>
              </h1>
            </div>

            {/* RIGHT SECTION: User + Logout */}
            <div className="legislation-header-right">
              {/* Desktop user section */}
              <div className="legislation-user-section legislation-desktop-user">
                <div className="legislation-user-info">
                  <User size={18} />
                  <span className="legislation-username">{user?.displayName}</span>
                </div>
                <button className="legislation-logout-button" onClick={handleLogout}>
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>

              {/* Mobile dropdown */}
              <div className="legislation-mobile-dropdown-container" ref={dropdownRef}>
                <button
                  className="legislation-mobile-dropdown-trigger"
                  onClick={() => setShowMobileDropdown(!showMobileDropdown)}
                >
                  <Menu size={18} />
                  <ChevronDown size={16} className={`legislation-dropdown-arrow ${showMobileDropdown ? 'rotated' : ''}`} />
                </button>

                {showMobileDropdown && (
                  <div className="legislation-mobile-dropdown-menu">
                    <div className="legislation-dropdown-user-info">
                      <User size={16} />
                      <span>{user?.displayName}</span>
                    </div>
                    <button
                      className="legislation-dropdown-option"
                      onClick={() => {
                        setShowHistorySidebar(!showHistorySidebar);
                        setShowMobileDropdown(false);
                      }}
                    >
                      <History size={16} />
                      <span>History</span>
                    </button>
                    <button
                      className="legislation-dropdown-option legislation-dropdown-logout"
                      onClick={() => {
                        handleLogout();
                        setShowMobileDropdown(false);
                      }}
                    >
                      <LogOut size={16} />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
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
                    {linkParsedBill.type} {linkParsedBill.number} - {linkParsedBill.congress}th Congress
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
                    ❌ Cancel
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
              <h2>Step 1: Choose a Bill</h2>
              
              {/* Bills Section with fade-in animation */}
              <div className={`bills-section ${componentsLoaded.bills ? 'component-visible' : 'component-hidden'}`}>
                {!isSearchMode && (
                  <>
                    <h3>📋 Trending Congressional Bills</h3>
                    
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
                    
                    {!billsLoading && !billsError && recommendedBills.length > 0 && (
                      <div className={`bills-horizontal-scroll ${liveSearchLoading ? 'searching' : ''}`}>
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
                  </>
                )}
                
                {isSearchMode && (
                  <>
                    <h3>🔍 Search Results</h3>
                    
                    {searchLoading && (
                      <div className="search-loading" style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        padding: "2rem",
                        backgroundColor: "rgba(30, 41, 59, 0.6)",
                        borderRadius: "8px",
                        border: "1px solid rgba(71, 85, 105, 0.3)",
                        margin: "1rem 0"
                      }}>
                        <div className="loading-spinner" style={{
                          width: "2rem",
                          height: "2rem",
                          border: "3px solid #e9ecef",
                          borderTop: "3px solid #007bff",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                          marginBottom: "1rem"
                        }}></div>
                        <p style={{ margin: 0, color: "rgba(255, 255, 255, 0.89)" }}>Searching Congress.gov for bills...</p>
                        <small style={{ color: "rgba(255, 255, 255, 0.89)", marginTop: "0.5rem" }}>
                          This may take a few seconds
                        </small>
                      </div>
                    )}
                    
                    {searchError && (
                      <div className="search-error" style={{
                        padding: "1rem",
                        backgroundColor: "#f8d7da",
                        border: "1px solid #f5c6cb",
                        borderRadius: "8px",
                        margin: "1rem 0"
                      }}>
                        <div style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: "0.5rem",
                          marginBottom: "0.5rem"
                        }}>
                          <span style={{ color: "#721c24", fontSize: "1.2rem" }}>⚠️</span>
                          <strong style={{ color: "#721c24" }}>Search Error</strong>
                        </div>
                        <p style={{ margin: 0, color: "#721c24" }}>{searchError}</p>
                        <button 
                          onClick={() => performSearch(searchQuery)}
                          style={{
                            marginTop: "0.75rem",
                            padding: "0.5rem 1rem",
                            backgroundColor: "#dc3545",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                            transition: "background-color 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = "#c82333";
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = "#dc3545";
                          }}
                        >
                          Try Again
                        </button>
                      </div>
                    )}
                    
                    {!searchLoading && !searchError && filteredBills.length > 0 && (
                      <>
                        <div style={{
                          backgroundColor: "rgba(30, 41, 59, 0.6)",
                          border: "1px solid rgba(71, 85, 105, 0.3)",
                          borderRadius: "4px",
                          padding: "0.75rem",
                          marginBottom: "1rem",
                          fontSize: "0.9rem",
                          color: "rgba(255, 255, 255, 0.89)"
                        }}>
                          💡 <strong>Search Tips:</strong> Try bill numbers (e.g., "HR 1234"), topics (e.g., "healthcare"), 
                          or sponsor names for better results.
                        </div>
                        
                        <div className={`bills-horizontal-scroll ${liveSearchLoading ? 'searching' : ''}`}>
                          {filteredBills.map((bill) => (
                            <BillCard 
                              key={bill.id} 
                              bill={bill} 
                              onSelect={handleSelectRecommendedBill}
                              isProcessing={loadingState && selectedBill?.id === bill.id}
                              processingStage={loadingState && selectedBill?.id === bill.id ? processingStage : ''}
                            />
                          ))}
                        </div>
                      </>
                    )}
                    
                    {!searchLoading && !searchError && filteredBills.length === 0 && searchQuery && (
                      <div style={{
                        textAlign: "center",
                        padding: "2rem",
                        backgroundColor: "rgba(30, 41, 59, 0.6)",
                        borderRadius: "8px",
                        border: "2px dashed rgba(71, 85, 105, 0.3)"
                      }}>
                        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔍</div>
                        <h4 style={{ margin: "0 0 0.5rem 0", color: "rgba(255, 255, 255, 0.89)" }}>
                          No bills found for "{searchQuery}"
                        </h4>
                        <p style={{ margin: "0 0 1rem 0", color: "rgba(255, 255, 255, 0.89)" }}>
                          Try different keywords, check spelling, or browse trending bills below.
                        </p>
                        <div style={{ 
                          display: "flex", 
                          gap: "0.5rem", 
                          justifyContent: "center",
                          flexWrap: "wrap"
                        }}>
                          <button
                            onClick={handleClearSearch}
                            style={{
                              padding: "0.5rem 1rem",
                              backgroundColor: "#007bff",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "0.9rem"
                            }}
                          >
                            Browse Trending Bills
                          </button>
                          <button
                            onClick={() => {
                              setSearchQuery("healthcare");
                              performSearch("healthcare");
                            }}
                            style={{
                              padding: "0.5rem 1rem",
                              backgroundColor: "#28a745",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "0.9rem"
                            }}
                          >
                            Try "Healthcare"
                          </button>
                          <button
                            onClick={() => {
                              setSearchQuery("infrastructure");
                              performSearch("infrastructure");
                            }}
                            style={{
                              padding: "0.5rem 1rem",
                              backgroundColor: "#17a2b8",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "0.9rem"
                            }}
                          >
                            Try "Infrastructure"
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
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
                    placeholder="Enter Congress.gov bill link (e.g., https://www.congress.gov/bill/119th-congress/house-bill/1234)"
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
                {linkError && (
                  <div style={{
                    color: "#dc3545",
                    fontSize: "0.9rem",
                    marginTop: "0.5rem",
                    padding: "0.5rem",
                    backgroundColor: "#f8d7da",
                    border: "1px solid #f5c6cb",
                    borderRadius: "4px"
                  }}>
                    {linkError}
                  </div>
                )}
              </div>
              
              <div className="search-container" style={{ position: "relative", marginBottom: "1rem" }}>
                  <div className="search-wrapper" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={handleSearchInputChange}
                        onFocus={handleSearchInputFocus}
                        onBlur={handleSearchInputBlur}
                        onKeyDown={handleSearchKeyDown}
                        placeholder="Start typing to search bills live (e.g., 'HR 1234', 'healthcare', 'climate')..."
                        className={`search-bar ${liveSearchLoading ? 'live-searching' : ''}`}
                        style={{
                          width: "100%",
                          padding: "0.75rem 2.5rem 0.75rem 1rem",
                          border: "1px solid #ddd",
                          borderRadius: "8px",
                          fontSize: "1rem",
                          outline: "none",
                          transition: "border-color 0.2s, box-shadow 0.2s",
                        }}
                      />
                      
                      {/* Search Icon / Loading Indicator */}
                      <div style={{
                        position: "absolute",
                        right: "0.75rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#666",
                        pointerEvents: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem"
                      }}>
                        {liveSearchLoading ? (
                          <div className="live-search-spinner"></div>
                        ) : (
                          "🔍"
                        )}
                      </div>
                      
                      {/* Search Suggestions Dropdown */}
                      {showSuggestions && searchSuggestions.length > 0 && (
                        <div className="suggestions-dropdown" style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          backgroundColor: "white",
                          border: "1px solid #ddd",
                          borderTop: "none",
                          borderRadius: "0 0 8px 8px",
                          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                          zIndex: 1000,
                          maxHeight: "200px",
                          overflowY: "auto"
                        }}>
                          {searchSuggestions.map((suggestion, index) => (
                            <div
                              key={index}
                              onClick={() => handleSuggestionClick(suggestion)}
                              style={{
                                padding: "0.75rem 1rem",
                                cursor: "pointer",
                                borderBottom: index < searchSuggestions.length - 1 ? "1px solid #eee" : "none",
                                transition: "background-color 0.2s"
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = "#f8f9fa";
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = "white";
                              }}
                            >
                              <span style={{ color: "#495057" }}>{suggestion}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={handleSearchSubmit}
                      disabled={searchLoading || liveSearchLoading || !searchQuery.trim()}
                      style={{
                        padding: "0.75rem 1.5rem",
                        backgroundColor: (searchLoading || liveSearchLoading || !searchQuery.trim()) ? "#ccc" : "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: (searchLoading || liveSearchLoading || !searchQuery.trim()) ? "not-allowed" : "pointer",
                        fontSize: "1rem",
                        fontWeight: "500",
                        minWidth: "80px",
                        transition: "all 0.2s"
                      }}
                    >
                      {searchLoading || liveSearchLoading ? "..." : "Search"}
                    </button>
                    
                    {(isSearchMode || searchQuery) && (
                      <button
                        onClick={handleClearSearch}
                        style={{
                          padding: "0.75rem",
                          backgroundColor: "#6c757d",
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontSize: "1rem",
                          transition: "all 0.2s"
                        }}
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  
                  {/* Live Search Help Text */}
                  {!isSearchMode && !liveSearchLoading && searchQuery.trim().length === 0 && (
                    <div style={{
                      marginTop: "0.5rem",
                      padding: "0.5rem",
                      backgroundColor: "rgba(30, 41, 59, 0.6)",
                      border: "1px solid rgba(71, 85, 105, 0.3)",
                      borderRadius: "4px",
                      fontSize: "0.85rem",
                      color: "rgba(255, 255, 255, 0.89)",
                      textAlign: "center",
                      fontStyle: "italic"
                    }}>
                      💡 Start typing above to search bills in real-time. Results update automatically as you type!
                    </div>
                  )}
                  
                  {/* Search Status */}
                  {(isSearchMode || liveSearchLoading) && !searchLoading && !searchError && (
                    <div style={{
                      marginTop: "0.5rem",
                      padding: "0.5rem",
                      backgroundColor: liveSearchLoading ? "#fff3cd" : "rgba(30, 41, 59, 0.6)",
                      border: `1px solid ${liveSearchLoading ? "#ffeaa7" : "rgba(71, 85, 105, 0.3)"}`,
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                      color: liveSearchLoading ? "#856404" : "rgba(255, 255, 255, 0.89)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem"
                    }}>
                      {liveSearchLoading && (
                        <div className="live-search-status-spinner"></div>
                      )}
                      {liveSearchLoading ? (
                        `Searching for "${searchQuery}"...`
                      ) : (
                        filteredBills.length === 0 
                          ? `No bills found for "${searchQuery}". Try different keywords or check spelling.`
                          : `Found ${filteredBills.length} bill${filteredBills.length === 1 ? '' : 's'} for "${searchQuery}"`
                      )}
                    </div>
                  )}
                </div>

              {error && <p className="error-text">{error}</p>}
              
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
                <h3>
                  {billSource === 'recommended' ? (
                    `Selected Bill: ${selectedBill.type} ${selectedBill.number} - ${selectedBill.title}`
                  ) : billSource === 'link' ? (
                    `Selected Bill: ${selectedBill.type} ${selectedBill.number} - ${selectedBill.title}`
                  ) : (
                    `Selected Bill: 📄 ${selectedBill.name}`
                  )}
                </h3>
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
                <button className="nav-button back" onClick={() => setCurrentStep(1)}>
                  ← Back
                </button>
                <button 
                  className="nav-button next" 
                  onClick={() => setCurrentStep(3)}
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
                <h3>
                  {billSource === 'recommended' ? (
                    `Selected Bill: ${selectedBill.type} ${selectedBill.number} - ${selectedBill.title}`
                  ) : billSource === 'link' ? (
                    `Selected Bill: ${selectedBill.type} ${selectedBill.number} - ${selectedBill.title}`
                  ) : (
                    `Selected Bill: 📄 ${selectedBill.name}`
                  )}
                </h3>
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
                        <span className="label-icon">🤖</span>
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
                  </div>
                  
                  <div className="button-group">
                    <button className="nav-button back" onClick={() => setCurrentStep(2)}>
                      ← Back
                    </button>
                    <button 
                      className="nav-button execute"
                      onClick={handleAnalyzeExecution}
                      disabled={loadingState}
                    >
                      {loadingState ? 'Analyzing...' : 'Start Analysis'}
                    </button>
                  </div>
                </div>
              )}

              {actionType === 'debate' && (
                <div className="debate-config">
                  <h2>Step 3: Configure Debate</h2>
                  <div className="config-section">
                    <div className="debate-topic-section">
                      <label className="debate-label">
                        <span className="label-icon">📝</span>
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
                    
                    <div className="debate-mode-section">
                      <label className="debate-label">
                        <span className="label-icon">⚔️</span>
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
                  
                  <div className="button-group">
                    <button className="nav-button back" onClick={() => setCurrentStep(2)}>
                      ← Back
                    </button>
                    <button 
                      className="nav-button execute"
                      onClick={handleDebateExecution}
                      disabled={!debateTopic.trim() || !debateMode}
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
                  <div className="analysis-voice-controls">
                    <VoiceOutput 
                      text={analysisResult}
                      buttonStyle="default"
                      showLabel={true}
                      onSpeechStart={() => console.log('Started playing analysis')}
                      onSpeechEnd={() => console.log('Finished playing analysis')}
                      onSpeechError={(error) => console.error('Analysis speech error:', error)}
                    />
                  </div>
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
                    📤 Share Analysis
                  </button>
                  <button 
                    className="download-analysis-btn" 
                    onClick={handleDownloadAnalysisPDF}
                    style={{
                      opacity: 1,
                      pointerEvents: 'auto'
                    }}
                  >
                    📄 Download PDF
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
              
              {/* Analysis Text Section - Simplified */}
              {showAnalysisText && (
                <ReactMarkdown 
                  rehypePlugins={[rehypeRaw]} 
                  className="markdown-renderer"
                  style={{
                    marginTop: '2rem'
                  }}
                  components={{
                    h1: ({node, ...props}) => <h1 className="analysis-heading" {...props} />,
                    h2: ({node, ...props}) => <h2 className="analysis-heading" {...props} />,
                    h3: ({node, ...props}) => <h3 className="analysis-heading" {...props} />,
                    h4: ({node, ...props}) => <h4 className="analysis-heading" {...props} />,
                    p: ({node, ...props}) => <p className="analysis-paragraph" {...props} />,
                    ul: ({node, ...props}) => <ul className="analysis-list" {...props} />,
                    ol: ({node, ...props}) => <ol className="analysis-numbered-list" {...props} />
                  }}
                >
                  {`## Detailed Analysis\n\n${analysisResult}`}
                </ReactMarkdown>
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
                    📤 Share This Analysis
                  </button>
                  <button className="download-analysis-btn-large" onClick={handleDownloadAnalysisPDF}>
                    📄 Download PDF Report
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
              billSource === 'recommended' ? 
                `Bill Analysis: ${selectedBill.title}` : 
                `Bill Analysis: ${selectedBill.name}`
            ) : 'Bill Analysis',
            mode: 'analysis',
            activityType: 'Analyze Bill',
            grades: analysisGrades,
            model: selectedModel,
            createdAt: new Date().toISOString()
          }}
          transcriptId={null}
        />
      )}

      <HistorySidebar 
        user={user}
        history={history}
        showHistorySidebar={showHistorySidebar}
        setShowHistorySidebar={setShowHistorySidebar}
        componentPrefix="legislation"
      />
      </div>
    </>
  );
};

export default Legislation;
