import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import "./Legislation.css";
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

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

  // Debate mode state
  const [debateTopic, setDebateTopic] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [debateMode, setDebateMode] = useState(''); // "ai-vs-ai", "ai-vs-user", "user-vs-user"
  const [history, setHistory] = useState([]);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);

  const billNameInputRef = useRef(null);
  const navigate = useNavigate();

  // Fetch debate history
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
    fetchHistory();
  }, [user]);

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
        const res = await fetch(`${API_URL}/analyze-legislation`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        setAnalysisResult(data.analysis);
      } else {
        const res = await fetch(`${API_URL}/extract-text`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        const text = data.text || '';
        const lines = text.trim().split('\n');
        const billName = lines.find(line => line.trim() !== '') || "Unnamed Bill";
        setDebateTopic(billName);
        setExtractedText(text);
      }
    } catch (err) {
      setError(`Error ${viewMode === "analyze" ? "analyzing" : "extracting"} the bill.`);
    }

    setLoadingState(false);
  };

  const handleStartDebate = () => {
    if (!debateMode) {
      alert("Please select a debate mode before starting.");
      return;
    }
    navigate("/debate", { state: { mode: debateMode, topic: debateTopic, description: extractedText } });
  };

  const handleLogout = () => {
    signOut(getAuth())
      .then(() => navigate('/login'))
      .catch(err => console.error("Logout error:", err));
  };

  const handleBillNameChange = (e) => {
    e.stopPropagation();
    setDebateTopic(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') e.preventDefault();
  };

  return (
    <div className="legislation-container">
      <header className="home-header">
        <div className="header-content">
          <div className="header-left">
            {viewMode === "debate" && (
              <button
                className="history-button"
                onClick={() => setShowHistorySidebar(!showHistorySidebar)}
              >
                History
              </button>
            )}
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
        {viewMode === "debate" && showHistorySidebar && (
          <div className="history-sidebar">
            <h2>Debate History</h2>
            <ul>
              {history.length ? history.map(item => (
                <li
                  key={item.id}
                  onClick={() => {
                    setDebateTopic(item.topic);
                    setShowHistorySidebar(false);
                  }}
                  title="Click to set as Bill Name"
                >
                  {item.topic} – {new Date(item.createdAt).toLocaleDateString()}
                </li>
              )) : <li>No history available</li>}
            </ul>
            <button onClick={() => setShowHistorySidebar(false)}>Close</button>
          </div>
        )}
      </header>

      {/* Mode Toggle */}
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
          <div className="form-group">
            <label htmlFor="pdfUpload">Upload PDF:</label>
            <input
              type="file"
              id="pdfUpload"
              accept="application/pdf"
              onChange={handlePdfUpload}
            />
            {pdfFile && <p>Selected file: {pdfFile.name}</p>}
          </div>
          <div className="form-group">
            <label htmlFor="articleLink">Or provide a link:</label>
            <input
              type="url"
              id="articleLink"
              value={articleLink}
              onChange={handleLinkChange}
              placeholder="https://example.com/article"
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit">
            {viewMode === "analyze" ? "Submit Analysis" : "Extract Bill Text"}
          </button>
        </form>
        {loadingState && (
          <p>
            {viewMode === "analyze"
              ? "Analyzing bill, please wait..."
              : "Extracting bill text for debate, please wait..."}
          </p>
        )}
      </div>

      <div className="main-content">
        {viewMode === "analyze" && analysisResult && (
          <div className="analysis-result">
            <h3>Bill Analysis</h3>
            <ReactMarkdown rehypePlugins={[rehypeRaw]} className="markdown-renderer">
              {analysisResult}
            </ReactMarkdown>
          </div>
        )}

        {viewMode === "debate" && debateTopic && (
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