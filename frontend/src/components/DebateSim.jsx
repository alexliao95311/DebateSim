import React, { useState, useEffect, useRef } from "react";
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import { auth } from "../firebase/firebaseConfig";
import { signOut, getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "./DebateSim.css";

function DebateSim({ user }) {
  const [mode, setMode] = useState("");
  const [debateTopic, setDebateTopic] = useState("AI does more good than harm");
  const [history, setHistory] = useState([]);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  // Fetch history on load
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

  const handleStartDebate = () => {
    if (!mode) {
      alert("Please select a debate mode before starting.");
      return;
    }
    // NEW: Check if debate topic is blank
    if (!debateTopic.trim()) {
      alert("Please enter a debate topic.");
      return;
    }
    navigate("/debate", { state: { mode, topic: debateTopic } });
  };

  const handleLogout = () => {
    signOut(getAuth())
      .then(() => {
        navigate("/");
      })
      .catch((err) => console.error("Logout error:", err));
  };

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="header-content">
          {/* LEFT SECTION: History Button */}
          <div className="header-left">
            <button
              className="history-button"
              onClick={() => setShowHistorySidebar(!showHistorySidebar)}
            >
              History
            </button>
          </div>

          {/* CENTER SECTION: Title */}
          <div className="header-center">
            <h1 onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
              Debate Simulator
            </h1>
          </div>

          {/* RIGHT SECTION: User + Logout */}
          <div className="header-right">
            <div className="user-section">
              <span className="username">{user?.displayName}</span>
              <button className="logout-button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="main-content">
        <h1 className="welcome-message">Welcome, {user?.displayName}</h1>
        <h2>Select a Debate Mode</h2>
        <div className="mode-buttons">
          <button
            className={mode === "ai-vs-ai" ? "selected-mode" : ""}
            onClick={() => setMode("ai-vs-ai")}
          >
            AI vs AI
          </button>
          <button
            className={mode === "ai-vs-user" ? "selected-mode" : ""}
            onClick={() => setMode("ai-vs-user")}
          >
            AI vs User
          </button>
          <button
            className={mode === "user-vs-user" ? "selected-mode" : ""}
            onClick={() => setMode("user-vs-user")}
          >
            User vs User
          </button>
        </div>

        <h2>Enter Debate Topic</h2>
        <div className="input-container">
          <input
            ref={inputRef}
            type="text"
            placeholder="Enter a debate topic..."
            value={debateTopic}
            onChange={(e) => setDebateTopic(e.target.value)}
          />
          {debateTopic && (
            <button className="clear-button" onClick={() => setDebateTopic("")}>
              &times;
            </button>
          )}
        </div>

        <button className="start-debate-button" onClick={handleStartDebate}>
          Start Debate
        </button>
      </div>

      {showHistorySidebar && (
        <div className="history-sidebar">
          <h2>Debate History</h2>
          <ul>
            {history.length > 0 ? (
              history.map((item) => (
                <li key={item.id} onClick={() => setDebateTopic(item.topic)}>
                  {item.topic} - {new Date(item.createdAt).toLocaleDateString()}
                </li>
              ))
            ) : (
              <li>No history available</li>
            )}
          </ul>
          <button onClick={() => setShowHistorySidebar(false)}>Close</button>
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
}

export default DebateSim;