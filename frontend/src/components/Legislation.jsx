import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import { saveTranscriptToUser } from '../firebase/saveTranscript';
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
          viewMode === "analyze" ? "Analyze" : "Debate"
        )}
      </button>
    </div>
  );
};
const Legislation = ({ user }) => {
  // View mode: "analyze" or "debate"
  const [viewMode, setViewMode] = useState("analyze");

  // Common states for file upload/link input
  const [pdfFile, setPdfFile] = useState(null);
  const [articleLink, setArticleLink] = useState('');
  const [error, setError] = useState('');
  const [loadingState, setLoadingState] = useState(false);

  // Analyze mode state
  const [analysisResult, setAnalysisResult] = useState('');
  const [selectedModel, setSelectedModel] = useState(modelOptions[0]);

  // Debate mode state
  const [debateTopic, setDebateTopic] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [debateMode, setDebateMode] = useState(''); // "ai-vs-ai", "ai-vs-user", "user-vs-user"
  const [history, setHistory] = useState([]);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [extractionSuccess, setExtractionSuccess] = useState(false);

  // Recommended bills state
  const [recommendedBills, setRecommendedBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [billsError, setBillsError] = useState('');
  const [processingBillId, setProcessingBillId] = useState(null);
  const [processingStage, setProcessingStage] = useState('');

  const billNameInputRef = useRef(null);
  const navigate = useNavigate();

  // Fetch debate history function
  const fetchHistory = async () => {
    console.log("fetchHistory called, user:", user);
    if (!user || user.isGuest) {
      console.log("User not available or is guest, skipping fetch");
      return;
    }
    try {
      const db = getFirestore();
      const transcriptsRef = collection(db, "users", user.uid, "transcripts");
      const q = query(transcriptsRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      console.log("Snapshot empty:", snapshot.empty, "Docs count:", snapshot.docs.length);
      if (!snapshot.empty) {
        const fetchedHistory = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log("Fetched history:", fetchedHistory);
        setHistory(fetchedHistory);
      } else {
        console.log("No history documents found");
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

  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setError('');
    } else {
      setError('Please upload a valid PDF file.');
    }
  };

  const handleLinkChange = (e) => {
    setArticleLink(e.target.value);
  };

  const handleDebateSubmit = async (e) => {
    e.preventDefault();
    if (!pdfFile && !articleLink) {
      setError('Please upload a PDF or provide a link to a legislative article.');
      return;
    }
    setError('');
    setLoadingState(true);

    const formData = new FormData();
    if (pdfFile) formData.append('file', pdfFile);

    try {
      if (viewMode === "analyze") {
        // Stage 1: Extracting text from PDF
        setProcessingStage('Extracting text from PDF...');
        
        formData.append('model', selectedModel);
        const res = await fetch(`${API_URL}/analyze-legislation`, {
          method: "POST",
          body: formData,
        });
        
        // Stage 2: AI analyzing
        setProcessingStage('Analyzing legislation with AI...');
        
        const data = await res.json();
        
        // Stage 3: Finalizing
        setProcessingStage('Finalizing analysis...');
        
        setAnalysisResult(data.analysis);
        
        // Save analysis to history
        if (user && !user.isGuest) {
          try {
            const billName = pdfFile?.name || 'Uploaded Bill';
            console.log("Saving analysis to history:", `Bill Analysis: ${billName}`);
            await saveTranscriptToUser(
              data.analysis,
              `Bill Analysis: ${billName}`,
              'analysis',
              'Analyze Bill'
            );
            // Refresh history after saving
            console.log("Analysis saved, refreshing history...");
            await fetchHistory();
          } catch (err) {
            console.error("Error saving analysis to history:", err);
          }
        }
      } else {
        // Stage 1: Extracting text
        setProcessingStage('Extracting text from PDF...');
        
        const res = await fetch(`${API_URL}/extract-text`, {
          method: "POST",
          body: formData,
        });
        
        // Stage 2: Processing
        setProcessingStage('Processing bill text for debate...');
        
        const data = await res.json();
        const text = data.text || '';
        const lines = text.trim().split('\n');
        // Find first non-empty line, or use default if all lines are empty
        let billName = "Unnamed Bill";
        for (const line of lines) {
          if (line.trim()) {
            billName = line.trim();
            break;
          }
        }
        
        // Stage 3: Setting up
        setProcessingStage('Setting up debate environment...');
        
        setDebateTopic(billName);
        setExtractedText(text);
        setExtractionSuccess(true);
      }
    } catch (err) {
      setError(`Error ${viewMode === "analyze" ? "analyzing" : "extracting"} the bill.`);
    }

    setLoadingState(false);
    setProcessingStage('');
  };

  const handleStartDebate = () => {
    if (!debateMode) {
      alert("Please select a debate mode before starting.");
      return;
    }
    
    // Check if bill name is empty and set a default if needed
    const finalBillName = debateTopic.trim() ? debateTopic : "Unnamed Bill";
    
    navigate("/debate", { 
      state: { 
        mode: 'bill-debate', 
        debateMode: debateMode,
        topic: finalBillName,
        description: extractedText 
      } 
    });
  };

  const handleLogout = () => {
    signOut(getAuth())
      .then(() => navigate('/login'))
      .catch(err => console.error("Logout error:", err));
  };

  const handleBillNameChange = (e) => {
    e.stopPropagation();
    setDebateTopic(e.target.value);
    // Make sure we don't lose the extracted text when bill name is emptied
    if (!e.target.value) {
      e.preventDefault(); // Prevent any default behavior
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') e.preventDefault();
  };

  const handleSelectRecommendedBill = async (bill) => {
    setProcessingBillId(bill.id);
    setError('');
    
    try {
      if (viewMode === "analyze") {
        // Stage 1: Extracting bill text
        setProcessingStage('Fetching full bill text from Congress.gov...');
        
        const response = await fetch(`${API_URL}/analyze-recommended-bill`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: bill.type,
            number: bill.number,
            model: selectedModel
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to analyze bill');
        }
        
        // Stage 2: AI is analyzing
        setProcessingStage('Analyzing legislation with AI...');
        
        const data = await response.json();
        
        // Stage 3: Completing
        setProcessingStage('Finalizing analysis...');
        
        setAnalysisResult(data.analysis);
        
        // Save analysis to history
        if (user && !user.isGuest) {
          try {
            console.log("Saving recommended bill analysis to history:", `Bill Analysis: ${bill.title}`);
            await saveTranscriptToUser(
              data.analysis,
              `Bill Analysis: ${bill.title}`,
              'analysis',
              'Analyze Bill'
            );
            // Refresh history after saving
            console.log("Recommended bill analysis saved, refreshing history...");
            await fetchHistory();
          } catch (err) {
            console.error("Error saving analysis to history:", err);
          }
        }
        
        // Scroll to analysis result
        setTimeout(() => {
          const analysisSection = document.querySelector('.analysis-result');
          if (analysisSection) {
            analysisSection.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
        
      } else {
        // Stage 1: Extracting bill text for debate
        setProcessingStage('Fetching full bill text from Congress.gov...');
        
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
          throw new Error('Failed to extract bill text');
        }
        
        // Stage 2: Processing text
        setProcessingStage('Processing bill text for debate...');
        
        const data = await response.json();
        
        // Stage 3: Setting up debate
        setProcessingStage('Setting up debate environment...');
        
        setDebateTopic(data.title);
        setExtractedText(data.text);
        setExtractionSuccess(true);
        
        // Scroll to the debate setup section
        setTimeout(() => {
          const debateSection = document.querySelector('.input-container');
          if (debateSection) {
            debateSection.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }
    } catch (err) {
      setError(`Error processing bill: ${err.message}`);
    } finally {
      setProcessingBillId(null);
      setProcessingStage('');
    }
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
                  onClick={() => {
                    if (viewMode === "debate") {
                      setDebateTopic(item.topic);
                    }
                    setShowHistorySidebar(false);
                  }}
                  title={viewMode === "debate" ? "Click to set as Bill Name" : "View activity details"}
                >
                  <div className="history-item">
                    <div className="history-title">{item.topic}</div>
                    <div className="history-meta">
                      <span className="history-type">{item.activityType || item.mode || 'Debate'}</span>
                      <span className="history-date">{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </li>
              )) : <li>No history available</li>}
            </ul>
            <button onClick={() => setShowHistorySidebar(false)}>Close</button>
          </div>
        )}
      </header>

      {/* Recommended Bills Section - Moved to top */}
      <div className="recommended-bills-section compact">
        <h2>Trending Congressional Bills</h2>
        
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
                viewMode={viewMode}
                onSelect={handleSelectRecommendedBill}
                isProcessing={processingBillId === bill.id}
                processingStage={processingBillId === bill.id ? processingStage : ''}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mode Toggle - Moved below recommended bills */}
      <div className="mode-toggle">
        <button
          type="button"
          className={`mode-button ${viewMode === "analyze" ? "active" : ""}`}
          onClick={() => setViewMode("analyze")}
        >
          Analyze Bill
        </button>
        <button
          type="button"
          className={`mode-button ${viewMode === "debate" ? "active" : ""}`}
          onClick={() => setViewMode("debate")}
        >
          Debate Bill
        </button>
      </div>

      {/* Unified Upload Form */}
      <div className="upload-container">
        <h2>
          {viewMode === "analyze"
            ? "Upload Legislative Article for Analysis"
            : "Upload Legislative Article for Debate"}
        </h2>
        <form onSubmit={handleDebateSubmit}>
          {viewMode === "analyze" && (
            <div className="form-group model-selection">
              <label htmlFor="modelSelect">Select AI Model for Analysis:</label>
              <div className="select-wrapper">
                <select
                  id="modelSelect"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                >
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div className="upload-row">
            <div className="upload-section">
              <input
                type="file"
                id="pdfUpload"
                accept="application/pdf"
                onChange={handlePdfUpload}
                style={{ display: 'none' }}
              />
              <label htmlFor="pdfUpload" className="upload-button">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Choose PDF file
              </label>
              {pdfFile && (
                <div className="selected-file">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  {pdfFile.name}
                </div>
              )}
            </div>
            
            <div className="or-divider">or</div>
            
            <div className="link-section">
              <input
                type="url"
                id="articleLink"
                value={articleLink}
                onChange={handleLinkChange}
                placeholder="https://example.com/article"
                className="link-input"
              />
            </div>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit">
            {viewMode === "analyze" ? "Submit Analysis" : "Extract Bill Text"}
          </button>
        </form>
        {loadingState && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <div className="loading-text">
              <div className="loading-main">
                {viewMode === "analyze"
                  ? "Analyzing bill, please wait..."
                  : "Extracting bill text for debate, please wait..."}
              </div>
              {processingStage && (
                <div className="loading-stage">{processingStage}</div>
              )}
            </div>
          </div>
        )}
        {viewMode === "debate" && extractionSuccess && (
          <div className="success-message">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>Text successfully extracted! You can now set up your debate.</span>
          </div>
        )}
      </div>

      <div className="main-content">
        {viewMode === "analyze" && analysisResult && (
          <div className="analysis-result markdown-content">
            <h3>Bill Analysis</h3>
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
        )}

        {(viewMode === "debate" && extractionSuccess) && (
          <>
            <h2>Debate Simulator</h2>
            <div className="input-container">
              <label htmlFor="billName">Bill Name:</label>
              <input
                type="text"
                id="billName"
                ref={billNameInputRef}
                value={debateTopic}
                onChange={handleBillNameChange}
                onKeyDown={handleKeyDown}
                onFocus={(e) => e.target.select()}
                style={{ width: "100%", padding: "0.8rem", fontSize: "1rem" }}
              />
            </div>
            <h2>Select a Debate Mode</h2>
            <div className="mode-buttons">
              <button
                type="button"
                className={debateMode === "ai-vs-ai" ? "selected-mode" : ""}
                onClick={() => setDebateMode("ai-vs-ai")}
              >
                AI vs AI
              </button>
              <button
                type="button"
                className={debateMode === "ai-vs-user" ? "selected-mode" : ""}
                onClick={() => setDebateMode("ai-vs-user")}
              >
                AI vs User
              </button>
              <button
                type="button"
                className={debateMode === "user-vs-user" ? "selected-mode" : ""}
                onClick={() => setDebateMode("user-vs-user")}
              >
                User vs User
              </button>
            </div>
            <button
              type="button"
              className="start-debate-button"
              onClick={handleStartDebate}
              disabled={!debateTopic.trim()}
            >
              Start Debate
            </button>
          </>
        )}
      </div>

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