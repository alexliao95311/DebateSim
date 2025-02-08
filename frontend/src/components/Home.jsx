import React, { useState, useEffect, useRef } from "react";
import "./Home.css";

function Home({ setMode, setTopic }) {
  const [selectedMode, setSelectedMode] = useState("");
  const [debateTopic, setDebateTopic] = useState("AI does more good than harm");
  const [history, setHistory] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  // Load saved topics from localStorage when the component mounts.
  useEffect(() => {
    try {
      const storedHistory = JSON.parse(localStorage.getItem("debateHistory"));
      if (storedHistory && Array.isArray(storedHistory)) {
        setHistory(storedHistory);
        console.log("Loaded debateHistory:", storedHistory);
      } else {
        console.log("No debateHistory found in localStorage.");
      }
    } catch (err) {
      console.error("Error loading debateHistory from localStorage:", err);
    }
  }, []);

  // Save topics to localStorage whenever history changes.
  useEffect(() => {
    localStorage.setItem("debateHistory", JSON.stringify(history));
    console.log("Updated debateHistory in localStorage:", history);
  }, [history]);

  const handleStart = () => {
    // Ensure both a mode and a debate topic are provided.
    if (!selectedMode || !debateTopic) {
      alert("Please select a mode and enter a topic.");
      return;
    }

    // If the current debateTopic is not already in history, add it.
    if (!history.includes(debateTopic)) {
      setHistory((prevHistory) => {
        const newHistory = [...prevHistory, debateTopic];
        console.log(`Added "${debateTopic}" to history:`, newHistory);
        return newHistory;
      });
    } else {
      console.log(`"${debateTopic}" already exists in history.`);
    }

    setMode(selectedMode);
    setTopic(debateTopic);
  };

  return (
    <div className="home-container">
      <h1>Welcome to Debate Simulator</h1>
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
            {history.map((topic, index) => (
              <li
                key={index}
                onMouseDown={() => {
                  setDebateTopic(topic);
                  setShowSuggestions(false);
                }}
              >
                {topic}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button onClick={handleStart}>Start Debate</button>
    </div>
  );
}

export default Home;