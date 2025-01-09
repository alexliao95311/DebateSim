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
    <div>
      <h1>Welcome to Debate Simulator</h1>
      <h2>Select a Mode:</h2>
      <button onClick={() => setSelectedMode("ai-vs-ai")}>AI vs AI</button>
      <button onClick={() => setSelectedMode("ai-vs-user")}>AI vs User</button>
      <button onClick={() => setSelectedMode("user-vs-user")}>User vs User</button>
      <h2>Enter Debate Topic:</h2>
      <input
        type="text"
        placeholder="Enter topic"
        value={debateTopic}
        onChange={(e) => setDebateTopic(e.target.value)}
      />
      <button onClick={handleStart}>Start Debate</button>
    </div>
  );
}

export default Home;