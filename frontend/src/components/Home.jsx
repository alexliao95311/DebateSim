import React, { useState } from "react";

function Home({ setMode, setTopic }) {
  const [selectedMode, setSelectedMode] = useState("");
  const [debateTopic, setDebateTopic] = useState("");

  const handleStart = () => {
    if (!selectedMode || !debateTopic) {
      alert("Please select a mode and enter a topic.");
      return;
    }
    setMode(selectedMode);
    setTopic(debateTopic);
  };

  return (
    <div style={{ backgroundColor: "#fff", padding: "2rem", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      <h1>Welcome to Debate Simulator</h1>
      <h2>Select a Mode</h2>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <button
          style={
            selectedMode === "ai-vs-ai"
              ? { border: "4px solid #4a90e2" }
              : {}
          }
          onClick={() => setSelectedMode("ai-vs-ai")}
        >
          AI vs AI
        </button>
        <button
          style={
            selectedMode === "ai-vs-user"
              ? { border: "4px solid #4a90e2" }
              : {}
          }
          onClick={() => setSelectedMode("ai-vs-user")}
        >
          AI vs User
        </button>
        <button
          style={
            selectedMode === "user-vs-user"
              ? { border: "4px solid #4a90e2" }
              : {}
          }
          onClick={() => setSelectedMode("user-vs-user")}
        >
          User vs User
        </button>
      </div>
      <h2>Enter Debate Topic</h2>
      <input
        type="text"
        placeholder="What's the debate topic?"
        value={debateTopic}
        onChange={(e) => setDebateTopic(e.target.value)}
      />
      <button onClick={handleStart}>Start Debate</button>
    </div>
  );
}

export default Home;