import React, { useState, useEffect, useRef } from "react";
import { getAuth, signOut } from "firebase/auth";
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import { auth } from "../firebase/firebaseConfig";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import "./Home.css";

function Home({ setMode, setTopic, user, onLogout }) {
  const [selectedMode, setSelectedMode] = useState("");
  const [debateTopic, setDebateTopic] = useState("AI does more good than harm");
  const [history, setHistory] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const inputRef = useRef(null);

  // Fetch saved transcripts from Firestore when the sidebar is opened,
  // ordered with most recent at the top.
  useEffect(() => {
    async function fetchHistory() {
      if (!user || user.isGuest) return; // Skip history for guest users.
      try {
        const db = getFirestore();
        const transcriptsRef = collection(db, "users", user.uid, "transcripts");
        const q = query(transcriptsRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const fetchedHistory = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setHistory(fetchedHistory);
        console.log("Fetched debate history from Firestore:", fetchedHistory);
      } catch (err) {
        console.error("Error fetching debate history:", err);
      }
    }
    if (showHistorySidebar) {
      fetchHistory();
    }
  }, [showHistorySidebar, user]);

  // Optional: Also load suggestions from localStorage if desired.
  useEffect(() => {
    try {
      const storedSuggestions = JSON.parse(localStorage.getItem("debateHistory"));
      if (storedSuggestions && Array.isArray(storedSuggestions)) {
        console.log("Loaded debate suggestions from localStorage:", storedSuggestions);
      } else {
        console.log("No debate suggestions found in localStorage.");
      }
    } catch (err) {
      console.error("Error loading debate suggestions from localStorage:", err);
    }
  }, []);

  const handleStart = () => {
    if (!selectedMode || !debateTopic) {
      alert("Please select a mode and enter a topic.");
      return;
    }
    setMode(selectedMode);
    setTopic(debateTopic);
  };

  const handleLogout = () => {
    signOut(getAuth())
      .then(() => {
        onLogout();
      })
      .catch((err) => console.error("Logout error:", err));
  };

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="header-content">
          {/* History toggle button in the top left */}
          <button
            className="history-toggle"
            onClick={() => setShowHistorySidebar(!showHistorySidebar)}
          >
            History
          </button>
          <h1>DebateSim</h1>
          <div className="user-section">
            <span className="username">{user?.displayName}</span>
            <button className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="home-content">
        <h1 className="welcome-message">Welcome, {user?.displayName}</h1>
        <h2>Select a Mode</h2>
        <div className="mode-buttons">
          <button
            style={selectedMode === "ai-vs-ai" ? { border: "4px solid #4a90e2" } : {}}
            onClick={() => setSelectedMode("ai-vs-ai")}
          >
            AI vs AI
          </button>
          <button
            style={selectedMode === "ai-vs-user" ? { border: "4px solid #4a90e2" } : {}}
            onClick={() => setSelectedMode("ai-vs-user")}
          >
            AI vs User
          </button>
          <button
            style={selectedMode === "user-vs-user" ? { border: "4px solid #4a90e2" } : {}}
            onClick={() => setSelectedMode("user-vs-user")}
          >
            User vs User
          </button>
        </div>

        <h2>Enter Debate Topic</h2>
        <div className="input-container">
          <input
            ref={inputRef}
            type="text"
            placeholder="What's the debate topic?"
            value={debateTopic}
            onChange={(e) => setDebateTopic(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
          />
          {debateTopic && (
            <button className="clear-button" onClick={() => setDebateTopic("")}>
              &#x2715;
            </button>
          )}
          {showSuggestions && history.length > 0 && (
            <ul className="suggestions-list">
              {history.map((item) => (
                <li
                  key={item.id}
                  onMouseDown={() => {
                    setDebateTopic(item.topic);
                    setShowSuggestions(false);
                  }}
                >
                  {item.topic}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <button onClick={handleStart}>Start Debate</button>

      {/* History Sidebar (without a close X) */}
      {showHistorySidebar && (
        <div className="history-sidebar">
          <h2>Debate History</h2>
          <ul>
            {history.length > 0 ? (
              history.map((item) => (
                <li
                  key={item.id}
                  onClick={() => {
                    setSelectedTranscript(item);
                    setShowHistorySidebar(false);
                  }}
                >
                  {item.topic}{" "}
                  {item.createdAt && `- ${new Date(item.createdAt).toLocaleDateString()}`}
                </li>
              ))
            ) : (
              <li>No history available</li>
            )}
          </ul>
          <button onClick={() => setShowHistorySidebar(false)}>Close</button>
        </div>
      )}

      {/* History Modal: Display saved transcript when an item is selected */}
      {selectedTranscript && (
        <div className="history-modal">
          <div className="modal-content">
            <button
              className="modal-close"
              onClick={() => setSelectedTranscript(null)}
            >
              &#x2715;
            </button>
            <h2>{selectedTranscript.topic}</h2>
            <div className="transcript-viewer">
              <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                {selectedTranscript.transcript}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-content">
          <a
            href="https://github.com/alexliao95311/DebateSim"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
          >
            <svg className="github-icon" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M12,0.5C5.65,0.5,0.5,5.65,0.5,12c0,5.08,3.29,9.39,7.85,10.93
                c0.57,0.1,0.78-0.25,0.78-0.56c0-0.28-0.01-1.02-0.02-2c-3.19,0.69-3.86-1.54-3.86-1.54
                c-0.52-1.33-1.27-1.69-1.27-1.69c-1.04-0.71,0.08-0.7,0.08-0.7c1.15,0.08,1.75,1.18,1.75,1.18
                c1.02,1.75,2.68,1.24,3.33,0.95c0.1-0.74,0.4-1.24,0.73-1.52c-2.55-0.29-5.23-1.28-5.23-5.7
                c0-1.26,0.45-2.29,1.18-3.1c-0.12-0.29-0.51-1.46,0.11-3.04c0,0,0.96-0.31,3.15,1.18
                c0.91-0.25,1.88-0.38,2.85-0.38c0.97,0,1.94,0.13,2.85,0.38
                c2.19-1.49,3.15-1.18,3.15-1.18
                c0.62,1.58,0.23,2.75,0.11,3.04c0.73,0.81,1.18,1.84,1.18,3.1
                c0,4.43-2.69,5.41-5.25,5.69
                c0.41,0.36,0.77,1.1,0.77,2.22c0,1.6-0.01,2.89-0.01,3.29c0,0.31,0.21,0.67,0.79,0.56
                C20.71,21.39,24,17.08,24,12C24,5.65,18.85,0.5,12,0.5z"
              />
            </svg>
            GitHub
          </a>
          <span>&copy; {new Date().getFullYear()} DebateSim. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}

export default Home;