import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { generateAIResponse } from "../api";
import "./Debate.css"; // For text wrapping and styling

function Debate({ mode, topic, transcript, setTranscript, endDebate }) {
  const [round, setRound] = useState(1);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userSide, setUserSide] = useState(""); // "pro" or "con"

  /**
   * A state that tracks whose turn it is in AI-vs-AI:
   * "pro" => next click will produce a PRO message
   * "con" => next click will produce a CON message
   */
  const [aiSide, setAiSide] = useState("pro");

  /**
   * --------------------------
   * Mode 2 (User vs AI) Logic
   * --------------------------
   */
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
      // --- User’s turn ---
      newTranscript += `\n### ${userSide === "pro" ? "Pro" : "Con"} (User):\n${userInput}`;
      setTranscript(newTranscript);
      setRound((prev) => prev + 1);
      setUserInput("");

      // --- AI’s turn ---
      const aiSideLocal = userSide === "pro" ? "Con" : "Pro";
      const prompt = `
        You are an AI debater playing the ${aiSideLocal} side on the topic: "${topic}".
        The user just said:
        "${userInput}"

        Please respond with a rebuttal focusing on ${aiSideLocal} arguments.
        Use statistics or references (hypothetical or real) whenever possible to strengthen your position.
      `;
      const response = await generateAIResponse(`AI Debater (${aiSideLocal})`, prompt);

      newTranscript += `\n### ${aiSideLocal} (AI):\n${response}`;
      setTranscript(newTranscript);
      setRound((prev) => prev + 1);

    } catch (err) {
      setError("Failed to fetch AI response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * -------------------------
   * Mode 1 (AI vs AI) Logic
   * -------------------------
   * We alternate between PRO and CON each time the user clicks the button:
   * - Pro goes first => round 1, side = "pro".
   * - Next click => Con responds to Pro for round 1, side = "con".
   * - Next click => Pro for round 2, side = "pro".
   * - Next click => Con for round 2, side = "con".
   * ...
   * After a Con message is submitted, we increment "round".
   */
  const handleAIDebate = async () => {
    // You can customize maxRounds as desired
    const maxRounds = 3; 
    if (round > maxRounds) {
      alert("Debate ended. No more rounds.");
      endDebate();
      return;
    }

    setLoading(true);
    setError("");
    let newTranscript = transcript;

    try {
      // We want each new message to respond specifically to the previous argument from the opponent
      // So let's grab the *last argument* in the transcript. If there's none (i.e., first message), just do a standard opener.
      const lines = newTranscript.trim().split("\n");
      let lastArgument = "";

      // Find the last argument block (ignoring empty lines)
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim()) {
          lastArgument = lines[i].trim();
          break;
        }
      }

      if (aiSide === "pro") {
        // --- Pro's turn ---
        const proPrompt = `
          Here is the debate topic: "${topic}".
          Respond as the PRO side in Round ${round}.

          Previous statement from your opponent (Con), if any, was:
          "${lastArgument}"

          Make sure to address the opponent's arguments (if any),
          and provide statistics or references (real or hypothetical)
          to strengthen your PRO position.
        `;
        const proResponse = await generateAIResponse("AI Debater (Pro)", proPrompt);

        newTranscript += `\n### AI Debater (Pro) - Round ${round}:\n${proResponse}\n`;
        setAiSide("con"); // Next click => Con
      } else {
        // --- Con's turn ---
        const conPrompt = `
          Here is the debate topic: "${topic}".
          Respond as the CON side in Round ${round}.

          The previous statement from your opponent (Pro) was:
          "${lastArgument}"

          Please rebut the Pro arguments specifically,
          and include data, stats, or references to support your CON stance.
        `;
        const conResponse = await generateAIResponse("AI Debater (Con)", conPrompt);

        newTranscript += `\n### AI Debater (Con) - Round ${round}:\n${conResponse}\n`;
        setAiSide("pro");
        setRound(round + 1); // We only increment the round after Con responds
      }

      setTranscript(newTranscript);
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

      {/* ------------- AI vs AI Mode ------------- */}
      {mode === "ai-vs-ai" && (
        <div style={{ marginTop: "1rem" }}>
          <button onClick={handleAIDebate} disabled={loading}>
            {loading
              ? "Loading..."
              : round === 1 && aiSide === "pro"
              ? "Start Debate (Pro Round 1)"
              : aiSide === "pro"
              ? `Generate Pro Round ${round}`
              : `Generate Con Round ${round}`
            }
          </button>
        </div>
      )}

      {/* ------------- AI vs User Mode ------------- */}
      {mode === "ai-vs-user" && (
        <>
          {!userSide && (
            <div style={{ marginBottom: "1rem" }}>
              <button onClick={() => setUserSide("pro")} style={{ marginRight: "0.5rem" }}>
                Argue Pro
              </button>
              <button onClick={() => setUserSide("con")}>Argue Con</button>
            </div>
          )}

          {userSide && (
            <>
              <textarea
                placeholder="Enter your argument"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                rows={4}
                style={{ width: "100%", resize: "vertical" }}
                onKeyDown={(e) => {
                  // Submit on Enter (unless Shift is pressed)
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !loading &&
                    userInput.trim().length > 0
                  ) {
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
        </>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}
      {loading && <p>Loading AI response...</p>}

      <button onClick={endDebate} style={{ marginTop: "1rem" }} disabled={loading}>
        End Debate
      </button>
    </div>
  );
}

export default Debate;