import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import "./Legislation.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
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

  // Debate mode state:
  // debateTopic holds the short title (bill name) which is editable.
  // extractedText holds the full extracted text (used in AI prompts).
  const [debateTopic, setDebateTopic] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [debateMode, setDebateMode] = useState(''); // "ai-vs-ai", "ai-vs-user", "user-vs-user"
  const [history, setHistory] = useState([]);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const billNameInputRef = useRef(null);
  const navigate = useNavigate();

  // Fetch debate history (like in DebateSim.jsx)
  useEffect(() => {
    async function fetchHistory() {
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
        }
      } catch (err) {
        console.error("Error fetching debate history:", err);
      }
    }
    if (viewMode === "debate") {
      fetchHistory();
    }
  }, [user, viewMode]);

  const handlePdfUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setError('');
    } else {
      setError('Please upload a valid PDF file.');
    }
  };

  const handleLinkChange = (event) => {
    setArticleLink(event.target.value);
  };

  // In debate mode, extract text then set:
  // - debateTopic: the bill name (first non-empty line)
  // - extractedText: the full extracted text (used in prompts)
  const handleDebateSubmit = async (event) => {
    event.preventDefault();
    if (!pdfFile && !articleLink) {
      setError('Please upload a PDF or provide a link to a legislative article.');
      return;
    }
    if (viewMode === "analyze") {
      // Analyze mode: use /analyze-legislation endpoint
      if (pdfFile) {
        setLoadingState(true);
        const formData = new FormData();
        formData.append('file', pdfFile);
        try {
          const response = await fetch(`${API_URL}/analyze-legislation`, {
            method: "POST",
            body: formData,
          });
          const data = await response.json();
          setAnalysisResult(data.analysis);
        } catch (err) {
          setError("Error analyzing the bill.");
        }
        setLoadingState(false);
      } else if (articleLink) {
        setError("Article link analysis is not supported yet.");
      }
    } else if (viewMode === "debate") {
      // Debate mode: extract text and then set:
      // - debateTopic: the bill name (first non-empty line)
      // - extractedText: the full extracted text (used in prompts)
      if (pdfFile) {
        setLoadingState(true);
        const formData = new FormData();
        formData.append('file', pdfFile);
        try {
          const response = await fetch(`${API_URL}/extract-text`, {
            method: "POST",
            body: formData,
          });
          const data = await response.json();
          console.log("Extracted text:", data.text);
          if (data.text && data.text.trim()) {
            const lines = data.text.trim().split('\n');
            const billName = lines.find(line => line.trim() !== '') || "Unnamed Bill";
            setDebateTopic(billName);
            setExtractedText(data.text);
          } else {
            setError("Failed to extract bill text.");
          }
        } catch (err) {
          setError("Error extracting bill text for debate.");
        }
        setLoadingState(false);
      } else if (articleLink) {
        setError("Article link debate is not supported yet.");
      }
    }
  };

  const handleStartDebate = () => {
    if (!debateMode) {
      alert("Please select a debate mode before starting.");
      return;
    }
    // Pass the short topic (bill name) and full extracted text to debate.jsx.
    navigate("/debate", { state: { mode: debateMode, topic: debateTopic, description: extractedText } });
  };

  const handleLogout = () => {
    signOut(getAuth())
      .then(() => navigate('/login'))
      .catch((err) => console.error("Logout error:", err));
  };

  // This function safely handles input changes for the bill name field
  const handleBillNameChange = (e) => {
    e.stopPropagation(); // Stop event from bubbling up
    setDebateTopic(e.target.value);
  };

  // Handle key down events separately to prevent form submit on Enter
  const handleKeyDown = (e) => {
    if (e.key === 'Backspace' && window.getSelection().toString() === debateTopic) {
      e.stopPropagation(); // Stop event propagation
      setDebateTopic(''); // Clear the debate topic
      return;
    }
    
    // Prevent Enter key from submitting any forms
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  return (
    <div className="legislation-container">
      <header className="home-header">
        <div className="header-content">
          <div className="header-left"></div>
          <div className="header-center">
            <h1 className="site-title" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
              Bill and Legislation Debate
            </h1>
          </div>
          <div className="header-right">
            <span className="username">{user?.displayName}</span>
            <button className="logout-button" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </header>

      {/* Mode Toggle for Legislation Page */}
      <div className="mode-toggle">
        <button onClick={() => setViewMode("analyze")} disabled={viewMode === "analyze"}>
          Analyze Bill
        </button>
        <button onClick={() => setViewMode("debate")} disabled={viewMode === "debate"}>
          Debate Bill
        </button>
      </div>

      <div className="main-content">
        {viewMode === "analyze" && (
          <>
            <h2>Upload Legislative Article for Analysis</h2>
            <form onSubmit={handleDebateSubmit}>
              <div className="form-group">
                <label htmlFor="pdfUpload">Upload PDF:</label>
                <input type="file" id="pdfUpload" accept="application/pdf" onChange={handlePdfUpload} />
              </div>
              <div className="form-group">
                <label htmlFor="articleLink">Or provide a link:</label>
                <input type="url" id="articleLink" value={articleLink} onChange={handleLinkChange} placeholder="https://example.com/article" />
              </div>
              {error && <p className="error-text">{error}</p>}
              <button type="submit">Submit</button>
            </form>
            {loadingState && <p>Analyzing bill, please wait...</p>}
            {analysisResult && (
              <div className="analysis-result">
                <h3>Bill Analysis</h3>
                <ReactMarkdown rehypePlugins={[rehypeRaw]} className="markdown-renderer">
                  {analysisResult}
                </ReactMarkdown>
              </div>
            )}
          </>
        )}

        {viewMode === "debate" && (
          <>
            <h2>Upload Legislative Article for Debate</h2>
            <form onSubmit={handleDebateSubmit}>
              <div className="form-group">
                <label htmlFor="pdfUpload">Upload PDF:</label>
                <input type="file" id="pdfUpload" accept="application/pdf" onChange={handlePdfUpload} />
              </div>
              <div className="form-group">
                <label htmlFor="articleLink">Or provide a link:</label>
                <input type="url" id="articleLink" value={articleLink} onChange={handleLinkChange} placeholder="https://example.com/article" />
              </div>
              {error && <p className="error-text">{error}</p>}
              <button type="submit">Extract Bill Text</button>
            </form>
            {loadingState && <p>Extracting bill text for debate, please wait...</p>}
            {debateTopic !== null && debateTopic !== undefined && (
              <>
                <h2>Debate Simulator</h2>
                {/* Isolated bill name input outside of any forms */}
                <div className="input-container">
                  <label htmlFor="billName">Bill Name:</label>
                  <input
                    type="text"
                    id="billName"
                    ref={billNameInputRef}
                    value={debateTopic}
                    onChange={handleBillNameChange}
                    onKeyDown={handleKeyDown}
                    onFocus={(e) => {
                      e.preventDefault();
                      e.target.select();
                    }}
                    style={{ width: "100%", padding: "0.8rem", fontSize: "1rem" }}
                  />
                </div>
                {/* Mode selection */}
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
                >
                  Start Debate
                </button>
              </>
            )}
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