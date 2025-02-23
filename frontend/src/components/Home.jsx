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

      {/* Bottom Text */}
        <div className="bottom-text">
        <a
          href="https://github.com/alexliao95311/DebateSim"
          target="_blank"
          rel="noopener noreferrer"
          className="github-link"
        >
          GitHub
        </a>
        <span>&copy; {new Date().getFullYear()} DebateSim. All rights reserved. Easter Egg</span>
      </div>
    </div>
  );
}

export default Home;