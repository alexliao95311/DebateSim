import React, { useState } from "react";
import { generateAIResponse } from "../api";

function Debate({ mode, topic, transcript, setTranscript, endDebate }) {
  const [round, setRound] = useState(1);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false); // Loading state for async operations
  const [error, setError] = useState(""); // Error handling

  const handleNextRound = async () => {
    if (round > 6) {
      alert("Debate ended. No more rounds.");
      endDebate();
      return;
    }

    setLoading(true);
    setError(""); // Clear previous errors

    try {
      let newTranscript = transcript;

      if (mode === "ai-vs-ai") {
        const pro = await generateAIResponse("AI Debater 1 (Pro)", `Argue in favor of: ${topic}`);
        const con = await generateAIResponse("AI Debater 2 (Con)", `Respond to: ${pro}`);
        newTranscript += `\nRound ${round}:\nPro: ${pro}\nCon: ${con}`;
      } else if (mode === "ai-vs-user") {
        if (round % 2 !== 0) {
          const response = await generateAIResponse("AI Debater", `Respond to: ${userInput}`);
          newTranscript += `\nRound ${round}:\nUser: ${userInput}\nAI: ${response}`;
        }
      } else if (mode === "user-vs-user") {
        newTranscript += `\nRound ${round}:\nUser 1: ${userInput}`;
      }

      setTranscript(newTranscript);
      setRound(round + 1);
      setUserInput(""); // Clear input
    } catch (err) {
      setError("Failed to fetch AI response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Debate Topic: {topic}</h2>
      <h3>Round {round}</h3>
      <pre>{transcript}</pre>

      {mode !== "ai-vs-ai" && (
        <input
          type="text"
          placeholder="Enter your argument"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
        />
      )}
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      <button onClick={handleNextRound} disabled={loading}>
        Next Round
      </button>
      <button onClick={endDebate} disabled={loading}>
        End Debate
      </button>
    </div>
  );
}

export default Debate;