import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { generateAIResponse } from "../api";
import "./Debate.css"; // For text wrapping and styling

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
        // AI vs AI logic
        const pro = await generateAIResponse("AI Debater 1 (Pro)", `Argue in favor of: ${topic}`);
        const con = await generateAIResponse("AI Debater 2 (Con)", `Respond to: ${pro}`);
        newTranscript += `\n### Pro:\n${pro}\n\n### Con:\n${con}`;
      } else if (mode === "ai-vs-user") {
        // AI vs User logic
        if (round % 2 !== 0) {
          // User's turn
          newTranscript += `\n### User:\n${userInput}`;
        } else {
          // AI's turn
          const response = await generateAIResponse("AI Debater", `Respond to: ${userInput}`);
          newTranscript += `\n### AI:\n${response}`;
        }
      } else if (mode === "user-vs-user") {
        // User vs User logic
        newTranscript += `\n### User ${round % 2 === 1 ? "1" : "2"}:\n${userInput}`;
      }

      setTranscript(newTranscript); // Update the transcript
      setRound(round + 1); // Increment the round
      setUserInput(""); // Clear the input field
    } catch (err) {
      setError("Failed to fetch AI response. Please try again.");
    } finally {
      setLoading(false); // Reset the loading state
    }
  };

  return (
    <div>
      <h2>Debate Topic: {topic}</h2>
      <ReactMarkdown className="markdown-renderer">{transcript}</ReactMarkdown>

      {/* Input field for user arguments (only visible for AI vs User or User vs User) */}
      {mode !== "ai-vs-ai" && (
        <input
          type="text"
          placeholder="Enter your argument"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
        />
      )}

      {/* Loading and error feedback */}
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* Control buttons */}
      <button onClick={handleNextRound} disabled={loading}>
        {loading ? "Loading..." : "Next Round"}
      </button>
      <button onClick={endDebate} disabled={loading}>
        End Debate
      </button>
    </div>
  );
}

export default Debate;