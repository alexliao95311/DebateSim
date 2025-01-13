import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { generateAIResponse } from "../api";
import "./Debate.css"; // For text wrapping and styling

function Debate({ mode, topic, transcript, setTranscript, endDebate }) {
  const [round, setRound] = useState(1);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false); // Loading state for async operations
  const [error, setError] = useState(""); // Error handling
  const [userSide, setUserSide] = useState(""); // "pro" or "con"

  const handleUserSubmit = async () => {
    if (!userSide) {
      setError("Please choose Pro or Con before proceeding.");
      return;
    }
    if (!userInput.trim()) return;

    setLoading(true);
    setError("");
    let newTranscript = transcript;

    try {
      // User’s turn
      newTranscript += `\n### ${userSide === "pro" ? "Pro" : "Con"} (User):\n${userInput}`;
      setTranscript(newTranscript);
      setRound((prev) => prev + 1);
      setUserInput("");

      // AI’s turn
      const aiSide = userSide === "pro" ? "Con" : "Pro";
      const prompt = `
        You are an AI debater playing the ${aiSide} side on the topic: "${topic}".
        The user just said:
        "${userInput}"
        Please rebut or address the user's points directly, focusing on ${aiSide} arguments.
      `;

      const response = await generateAIResponse(`AI Debater (${aiSide})`, prompt);
      newTranscript += `\n### ${aiSide} (AI):\n${response}`;
      setTranscript(newTranscript);
      setRound((prev) => prev + 1);

    } catch (err) {
      setError("Failed to fetch AI response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#fff", padding: "2rem", borderRadius: "8px" }}>
      <h2>Debate Topic: {topic}</h2>
      <ReactMarkdown className="markdown-renderer">{transcript}</ReactMarkdown>

      {mode === "ai-vs-user" && !userSide && (
        <div style={{ marginBottom: "1rem" }}>
          <button onClick={() => setUserSide("pro")} style={{ marginRight: "0.5rem" }}>
            Argue Pro
          </button>
          <button onClick={() => setUserSide("con")}>Argue Con</button>
        </div>
      )}

      {mode === "ai-vs-user" && userSide && (
        <>
          <textarea
            placeholder="Enter your argument"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            rows={4}
            style={{ width: "100%", resize: "vertical" }}
            onKeyDown={(e) => {
              // Submit on Enter (unless the user holds Shift to insert a new line)
              if (e.key === "Enter" && !e.shiftKey && !loading && userInput.trim().length > 0) {
                e.preventDefault();
                handleUserSubmit();
              }
            }}
          />
          <button onClick={handleUserSubmit} disabled={loading || !userInput.trim()}>
            Send
          </button>
        </>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}
      {loading && <p>Loading AI response...</p>}

      <button onClick={endDebate} style={{ marginTop: "1rem" }}>
        End Debate
      </button>
    </div>
  );
}

export default Debate;