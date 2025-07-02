import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import { saveTranscriptToUser } from '../firebase/saveTranscript';
import { jsPDF } from "jspdf";
import "./Legislation.css";
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const modelOptions = [
  "qwen/qwq-32b:free", 
  "meta-llama/llama-3.3-70b-instruct", 
  "google/gemini-2.0-flash-001",
  "deepseek/deepseek-r1-0528:free",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o-mini",
  "openai/gpt-4o-mini-search-preview"
];

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
  // 3-Step Process State
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedBill, setSelectedBill] = useState(null);
  const [billSource, setBillSource] = useState(''); // 'recommended' or 'upload'
  const [actionType, setActionType] = useState(''); // 'analyze' or 'debate'
  const [extractedBillData, setExtractedBillData] = useState(null);

  // Common states
  const [error, setError] = useState('');
  const [loadingState, setLoadingState] = useState(false);
  const [processingStage, setProcessingStage] = useState('');

  // Analysis state
  const [analysisResult, setAnalysisResult] = useState('');
  const [selectedModel, setSelectedModel] = useState(modelOptions[0]);

  // Debate state
  const [debateTopic, setDebateTopic] = useState('');
  const [debateMode, setDebateMode] = useState('');
  
  // History state
  const [history, setHistory] = useState([]);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [pdfError, setPdfError] = useState("");

  // Recommended bills state
  const [recommendedBills, setRecommendedBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [billsError, setBillsError] = useState('');

  const billNameInputRef = useRef(null);
  const pdfContentRef = useRef(null);
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

  // Fetch debate history on component mount
  useEffect(() => {
    fetchHistory();
  }, [user]);

  const handleDownloadPDF = () => {
    if (!selectedHistory) return;
    
    setPdfError("");
    try {
      const element = pdfContentRef.current;
      if (!element) {
        throw new Error("PDF content element not found");
      }

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "letter",
      });

      const margins = [72, 36, 72, 36];

      pdf.setFontSize(12);

      pdf.html(element, {
        callback: (pdfInstance) => {
          const totalPages = pdfInstance.internal.getNumberOfPages();
          for (let i = 1; i <= totalPages; i++) {
            pdfInstance.setPage(i);
            pdfInstance.setFontSize(10);
            pdfInstance.setTextColor(150);
            const pageWidth = pdfInstance.internal.pageSize.getWidth();
            const pageHeight = pdfInstance.internal.pageSize.getHeight();
            pdfInstance.text(
              `Page ${i} of ${totalPages}`,
              pageWidth - margins[1],
              pageHeight - 18,
              { align: "right" }
            );
          }
          const fileName = selectedHistory.topic 
            ? `${selectedHistory.topic.replace(/[^a-z0-9]/gi, '_')}_transcript.pdf`
            : `activity_transcript_${Date.now()}.pdf`;
          pdfInstance.save(fileName);
        },
        margin: margins,
        autoPaging: "text",
        break: {
          avoid: "li, p, h2, h3",
        },
        html2canvas: {
          scale: 0.75,
          windowWidth: 540,
          useCORS: true,
        },
      });
    } catch (err) {
      setPdfError("Failed to generate PDF. Please try again.");
      console.error("PDF generation error:", err);
    }
  };

  // Fetch recommended bills from Congress.gov API
  useEffect(() => {
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
        setBillsError('Unable to load recommended bills. Please try again later.');
        // Set mock data for development
        setRecommendedBills([
          {
            id: 'hr1234',
            title: 'American Innovation and Manufacturing Act',
            type: 'HR',
            number: '1234',
            sponsor: 'Rep. Smith (D-CA)',
            lastAction: 'Passed House',
            description: 'A bill to promote innovation in American manufacturing and strengthen domestic supply chains.'
          },
          {
            id: 's5678',
            title: 'Climate Resilience Infrastructure Act',
            type: 'S',
            number: '5678',
            sponsor: 'Sen. Johnson (R-TX)',
            lastAction: 'Committee Review',
            description: 'Legislation to improve infrastructure resilience to climate change impacts.'
          },
          {
            id: 'hr9999',
            title: 'Digital Privacy Protection Act',
            type: 'HR',
            number: '9999',
            sponsor: 'Rep. Williams (D-NY)',
            lastAction: 'Introduced',
            description: 'A comprehensive bill to protect consumer data privacy and regulate data collection practices.'
          }
        ]);
      } finally {
        setBillsLoading(false);
      }
    }
    fetchRecommendedBills();
  }, []);


  const handleLogout = () => {
    signOut(getAuth())
      .then(() => navigate('/login'))
      .catch(err => console.error("Logout error:", err));
  };

  // Step 1: Handle bill selection from recommended bills
  const handleSelectRecommendedBill = async (bill) => {
    setSelectedBill(bill);
    setBillSource('recommended');
    setLoadingState(true);
    setError('');
    
    try {
      // Extract the bill text immediately when selected
      setProcessingStage('Extracting bill text from Congress.gov...');
      
      const response = await fetch(`${API_URL}/extract-recommended-bill-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: bill.type,
          number: bill.number,
          title: bill.title
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to extract bill text: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Check if bill text is unavailable
      if (data.text && data.text.includes('Bill Text Unavailable')) {
        setError('This bill\'s text is not yet available from Congress.gov. You can try again later or upload a PDF version if available.');
        return;
      }
      
      // Store the extracted bill data
      setExtractedBillData({
        text: data.text,
        title: data.title || bill.title,
        billCode: `${bill.type} ${bill.number}`
      });
      
      setProcessingStage('Bill text extracted successfully!');
      
      // Move to step 2
      setTimeout(() => {
        setCurrentStep(2);
      }, 1000);
      
    } catch (err) {
      setError(`Error extracting bill text: ${err.message}`);
    } finally {
      setLoadingState(false);
      setProcessingStage('');
    }
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
    if (item.activityType === 'Analyze Bill') return 'type-analyze';
    if (item.activityType === 'Debate Bill' || item.mode === 'bill-debate') return 'type-bill-debate';
    if (item.activityType === 'Debate Topic') return 'type-topic-debate';
    if (item.mode === 'ai-vs-ai') return 'type-ai-vs-ai';
    if (item.mode === 'ai-vs-user') return 'type-ai-vs-user';
    if (item.mode === 'user-vs-user') return 'type-user-vs-user';
    return 'type-default';
  };

  // Handle PDF upload for Step 1
  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedBill(file);
      setBillSource('upload');
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

  // Step 3: Handle analysis execution
  const handleAnalyzeExecution = async () => {
    setLoadingState(true);
    setError('');
    
    try {
      if (billSource === 'recommended') {
        // Use the extracted bill data for recommended bills
        setProcessingStage('Analyzing legislation with AI...');
        
        const response = await fetch(`${API_URL}/analyze-recommended-bill`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: selectedBill.type,
            number: selectedBill.number,
            model: selectedModel
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Analysis failed: ${response.status} ${response.statusText}. ${errorData || 'Please try again.'}`);
        }
        
        const data = await response.json();
        setAnalysisResult(data.analysis);
        
        // Save analysis to history
        if (user && !user.isGuest) {
          try {
            await saveTranscriptToUser(
              data.analysis,
              `Bill Analysis: ${selectedBill.title}`,
              'analysis',
              'Analyze Bill'
            );
            await fetchHistory();
          } catch (err) {
            console.error("Error saving analysis to history:", err);
          }
        }
        
      } else {
        // Handle uploaded PDF analysis
        const formData = new FormData();
        formData.append('file', selectedBill);
        formData.append('model', selectedModel);
        
        setProcessingStage('Extracting text from PDF...');
        
        const response = await fetch(`${API_URL}/analyze-legislation`, {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Analysis failed: ${response.status} ${response.statusText}. ${errorData || 'Please try again.'}`);
        }
        
        const data = await response.json();
        setAnalysisResult(data.analysis);
        
        // Save analysis to history
        if (user && !user.isGuest) {
          try {
            await saveTranscriptToUser(
              data.analysis,
              `Bill Analysis: ${selectedBill.name}`,
              'analysis',
              'Analyze Bill'
            );
            await fetchHistory();
          } catch (err) {
            console.error("Error saving analysis to history:", err);
          }
        }
      }
      
    } catch (err) {
      setError(`Error analyzing bill: ${err.message}`);
    } finally {
      setLoadingState(false);
      setProcessingStage('');
    }
  };

  // Step 3: Handle debate setup
  const handleDebateExecution = async () => {
    if (!debateTopic.trim() || !debateMode) {
      setError('Please enter a debate topic and select a debate mode.');
      return;
    }
    
    const billText = billSource === 'recommended' ? extractedBillData?.text : null;
    const billTitle = billSource === 'recommended' ? extractedBillData?.title : debateTopic;
    
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
    } else {
      // For recommended bills, use pre-extracted text
      const billText = extractedBillData?.text || '';
      const billTitle = extractedBillData?.title || debateTopic;
      
      console.log('Navigating to debate with bill text length:', billText.length);
      console.log('Bill title:', billTitle);
      
      navigate('/debate', {
        state: {
          mode: 'bill-debate',
          topic: debateTopic,
          billText: billText,
          billTitle: billTitle,
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
    setAnalysisResult('');
    setDebateTopic('');
    setDebateMode('');
    setError('');
  };

  return (
    <div className="legislation-container">
      <header className="home-header">
        <div className="header-content">
          <div className="header-left">
            <button
              className="history-button"
              onClick={() => setShowHistorySidebar(!showHistorySidebar)}
            >
              History
            </button>
          </div>
          <div className="header-center">
            <h1 className="site-title" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
              Bill and Legislation Debate
            </h1>
          </div>
          <div className="header-right">
            <span className="username">{user?.displayName}</span>
            <button className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
        {showHistorySidebar && (
          <div className={`history-sidebar ${showHistorySidebar ? 'expanded' : ''}`}>
            <h2>Activity History</h2>
            <ul>
              {history.length ? history.map(item => (
                <li
                  key={item.id}
                  onClick={() => setSelectedHistory(item)}
                  title="Click to view full transcript"
                >
                  <div className="history-item">
                    <div className="history-title">{item.topic}</div>
                    <div className="history-meta">
                      <span className={`history-type ${getActivityTypeClass(item)}`}>
                        {getActivityTypeDisplay(item)}
                      </span>
                      <span className="history-date">{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </li>
              )) : <li>No history available</li>}
            </ul>
            <button onClick={() => setShowHistorySidebar(false)}>Close</button>
          </div>
        )}

        {/* Modal to view selected history transcript */}
        {selectedHistory && (
          <div className="history-modal">
            <div className="modal-content">
              <button className="modal-close" onClick={() => setSelectedHistory(null)}>
                &times;
              </button>
              <h2>{selectedHistory.topic || "Untitled Activity"}</h2>
              <div className="transcript-viewer">
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
              </div>
              
              {/* Error message and download button */}
              {pdfError && <p className="error-text">{pdfError}</p>}
              <div className="modal-button-group">
                <button 
                  className="download-button" 
                  onClick={handleDownloadPDF}
                >
                  Download as PDF
                </button>
                <button 
                  className="close-button" 
                  onClick={() => setSelectedHistory(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* 3-Step Process UI */}
      <div className="step-by-step-container">
        {/* Progress Indicator */}
        <div className="progress-steps">
          <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>
            <div className="step-number">1</div>
            <div className="step-label">Select Bill</div>
          </div>
          <div className="step-arrow">→</div>
          <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">Choose Action</div>
          </div>
          <div className="step-arrow">→</div>
          <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <div className="step-label">Configure & Execute</div>
          </div>
        </div>

        {/* Step Content */}
        <div className="step-content">
          {/* Step 1: Select Bill */}
          {currentStep === 1 && (
            <div className="step-one">
              <h2>Step 1: Choose a Bill</h2>
              
              {/* Recommended Bills Section */}
              <div className="recommended-bills-section">
                <h3>📋 Trending Congressional Bills</h3>
                
                {billsLoading && (
                  <div className="bills-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading current bills from Congress...</p>
                  </div>
                )}
                
                {billsError && (
                  <div className="bills-error">
                    <p>{billsError}</p>
                  </div>
                )}
                
                {!billsLoading && !billsError && recommendedBills.length > 0 && (
                  <div className="bills-horizontal-scroll">
                    {recommendedBills.map((bill) => (
                      <BillCard 
                        key={bill.id} 
                        bill={bill} 
                        onSelect={handleSelectRecommendedBill}
                        isProcessing={loadingState && selectedBill?.id === bill.id}
                        processingStage={loadingState && selectedBill?.id === bill.id ? processingStage : ''}
                      />
                    ))}
                  </div>
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
                <input
                  type="url"
                  placeholder="Enter bill link"
                  className="link-input"
                />
              </div>

              {error && <p className="error-text">{error}</p>}
              
              {loadingState && (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <div className="loading-text">
                    <div className="loading-main">Processing bill...</div>
                    {processingStage && (
                      <div className="loading-stage">{processingStage}</div>
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
                      <div className="loading-stage">{processingStage}</div>
                    )}
                  </div>
                </div>
              )}

              {error && <p className="error-text">{error}</p>}
            </div>
          )}
          {/* Results Section */}
          {analysisResult && (
            <div className="results-section">
              <div className="results-header">
                <h2>Analysis Results</h2>
                <button className="new-analysis-btn" onClick={resetFlow}>
                  Start New Analysis
                </button>
              </div>
              <div className="analysis-result markdown-content">
                <ReactMarkdown 
                  rehypePlugins={[rehypeRaw]} 
                  className="markdown-renderer"
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
                  {analysisResult}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>

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
              {selectedHistory.activityType || "Activity"} Transcript
            </h1>
            <hr />
            <h2 style={{ fontSize: "16pt" }}>
              Topic: {selectedHistory.topic || "Untitled Activity"}
            </h2>
            {selectedHistory.mode && (
              <p style={{ fontSize: "12pt", color: "#666" }}>
                Mode: {selectedHistory.mode}
              </p>
            )}
            {selectedHistory.activityType && (
              <p style={{ fontSize: "12pt", color: "#666" }}>
                Activity Type: {selectedHistory.activityType}
              </p>
            )}
            <p style={{ fontSize: "10pt", color: "#999" }}>
              Created: {new Date(selectedHistory.createdAt).toLocaleString()}
            </p>
            <hr />
            <div dangerouslySetInnerHTML={{ __html: selectedHistory.transcript || "No content available." }} />
          </div>
        </div>
      )}

      <footer className="bottom-text">
        <a
          href="https://github.com/alexliao95311/DebateSim"
          target="_blank"
          rel="noopener noreferrer"
          className="github-link"
        >
          GitHub
        </a>
        <span>&copy; {new Date().getFullYear()} DebateSim. All rights reserved.</span>
      </footer>
    </div>
  );
};

export default Legislation;