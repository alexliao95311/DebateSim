import React, { useState } from "react";
import { getAIResponse } from "../api";

function Debate({ mode, topic, setTranscript, endDebate }) {
  const [transcript, setLocalTranscript] = useState("");
  const [roundCount, setRoundCount] = useState(1);
  const [userInput, setUserInput] = useState("");

  const handleAIResponse = async (debater, prompt) => {
    const response = await getAIResponse(debater, prompt);
    setLocalTranscript((prev) => prev + `\n${debater}: ${response}`);
    return response;
  };

  const handleNextRound = async () => {
    if (mode === "ai-vs-ai") {
      const proResponse = await handleAIResponse("AI Debater 1 (Pro)", `Argue in favor of '${topic}'`);
      const conResponse = await handleAIResponse("AI Debater 2 (Con)", `Respond to: ${proResponse}`);
    } else if (mode === "ai-vs-user") {
      if (roundCount % 2 === 1) {
        const response = await handleAIResponse("AI Debater", `Argue against '${userInput}'`);
        setLocalTranscript((prev) => prev + `\nUser: ${userInput}\nAI Debater: ${response}`);
      }
    } else if (mode === "user-vs-user") {
      setLocalTranscript((prev) => prev + `\nUser 1: ${userInput}`);
    }
    setRoundCount((prev) => prev + 1);
    setUserInput("");
  };

  return (
    <div>
      <h2>Topic: {topic}</h2>
      <pre>{transcript}</pre>
      <input
        type="text"
        placeholder="Enter your argument"
        value={userInput}
        onChange={(e) => setUserInput(e.target.value)}
      />
      <button onClick={handleNextRound}>Next Round</button>
      <button onClick={endDebate}>End Debate</button>
    </div>
  );
}

export default Debate;