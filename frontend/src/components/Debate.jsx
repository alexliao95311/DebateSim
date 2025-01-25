import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { generateAIResponse } from "../api";
import "./Debate.css";

function Debate({ mode, topic, transcript, setTranscript, endDebate }) {
  /**
   * ========================================================
   * COMMON STATE
   * ========================================================
   */
  const [round, setRound] = useState(1);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * ========================================================
   * MODE 2 (USER vs AI) STATE
   * ========================================================
   */
  // "pro" (user goes first) or "con" (AI goes first)
  const [userSide, setUserSide] = useState(""); 

  /**
   * ========================================================
   * MODE 1 (AI vs AI) STATE
   * ========================================================
   */
  const [aiSide, setAiSide] = useState("pro");
  const maxRounds = 3; // total rounds for AI-vs-AI

  /**
   * ========================================================
   * MODE 3 (USER vs USER) STATE
   * ========================================================
   */
  const [userVsUserSide, setUserVsUserSide] = useState("pro");

  /**
   * ========================================================
   * HANDLERS
   * ========================================================
   */

  /**
   * ========== MODE 2: USER vs AI ==========
   * On side selection:
   * - If user picks "Pro", do nothing initially (user will speak first).
   * - If user picks "Con", generate AI's opening "Pro" argument immediately.
   */
  const handleChooseSide = async (side) => {
    setUserSide(side);
    setError("");

    // If user chooses "Con", AI (Pro) speaks first automatically
    if (side === "con") {
      setLoading(true);
      try {
        let newTranscript = transcript;
        const proPrompt = `
          You are an AI debater playing the Pro side on the topic: "${topic}".
          Provide an opening statement in favor of the Pro position.
        `;
        const proResponse = await generateAIResponse("AI Debater (Pro)", proPrompt);
        newTranscript += `\n### Pro (AI):\n${proResponse}`;
        setTranscript(newTranscript);
      } catch (err) {
        setError("Failed to fetch AI's initial Pro argument. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  /**
   * USER's turn to send an argument or rebuttal (Mode 2).
   * The side depends on userSide:
   *  - If userSide === "pro", user is Pro, AI is Con.
   *  - If userSide === "con", user is Con, AI is Pro.
   */
  const handleUserVsAISubmit = async () => {
    if (!userSide) {
      setError("Please choose Pro or Con before proceeding.");
      return;
    }
    if (!userInput.trim()) return;

    setLoading(true);
    setError("");
    try {
      // 1) Append user's argument
      let newTranscript = transcript;
      const userLabel = userSide === "pro" ? "Pro (User)" : "Con (User)";
      newTranscript += `\n### ${userLabel}:\n${userInput}`;
      setTranscript(newTranscript);

      // Clear user's input
      setUserInput("");
      setRound((prev) => prev + 1);

      // 2) AI’s rebuttal
      const aiSideLocal = userSide === "pro" ? "Con" : "Pro";
      const prompt = `
        You are an AI debater playing the ${aiSideLocal} side on the topic: "${topic}".
        The user just said:
        "${userInput}"

        Please respond with a rebuttal focusing on ${aiSideLocal} arguments.
        Use stats or references to strengthen your position.
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
   * ========== MODE 1: AI vs AI ==========
   */
  const handleAIDebate = async () => {
    if (round > maxRounds) return; // already maxed out

    setLoading(true);
    setError("");

    try {
      let newTranscript = transcript;
      // Grab the last argument from the transcript
      const lines = newTranscript.trim().split("\n");
      let lastArgument = "";
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim()) {
          lastArgument = lines[i].trim();
          break;
        }
      }

      if (aiSide === "pro") {
        // PRO's turn
        const proPrompt = `
          Debate topic: "${topic}"
          Respond as PRO in Round ${round}.
          The opponent's last argument, if any, was: "${lastArgument}"
          Address their points and strengthen your PRO stance with evidence.
        `;
        const proResponse = await generateAIResponse("AI Debater (Pro)", proPrompt);
        newTranscript += `\n### AI Debater (Pro) - Round ${round}:\n${proResponse}\n`;
        setAiSide("con");
        setTranscript(newTranscript);

      } else {
        // CON's turn
        const conPrompt = `
          Debate topic: "${topic}"
          Respond as CON in Round ${round}.
          The opponent's last argument was: "${lastArgument}"
          Rebut the PRO arguments with references and data to support CON.
        `;
        const conResponse = await generateAIResponse("AI Debater (Con)", conPrompt);
        newTranscript += `\n### AI Debater (Con) - Round ${round}:\n${conResponse}\n`;
        setAiSide("pro");
        setTranscript(newTranscript);

        // Increase round after Con's turn
        setRound((prevRound) => prevRound + 1);

        // If final round reached
        if (round === maxRounds) {
          endDebate();
        }
      }
    } catch (err) {
      setError("Failed to fetch AI response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * ========== MODE 3: USER vs USER ==========
   * Toggle between Pro(User1) and Con(User2) automatically.
   */
  const handleUserVsUser = () => {
    if (!userInput.trim()) return;
    let newTranscript = transcript;

    if (userVsUserSide === "pro") {
      newTranscript += `\n### Pro (User 1):\n${userInput.trim()}`;
      setUserVsUserSide("con");
    } else {
      newTranscript += `\n### Con (User 2):\n${userInput.trim()}`;
      setUserVsUserSide("pro");
    }

    setTranscript(newTranscript);
    setUserInput("");
    setError("");
  };

  /**
   * ========================================================
   * RENDER
   * ========================================================
   */
  return (
    <div style={{ backgroundColor: "#fff", padding: "2rem", borderRadius: "8px" }}>
      <h2>Debate Topic: {topic}</h2>
      <ReactMarkdown className="markdown-renderer">{transcript}</ReactMarkdown>

      {/* ============== MODE 1: AI vs AI ============== */}
      {mode === "ai-vs-ai" && (
        <div style={{ marginTop: "1rem" }}>
          <button
            onClick={handleAIDebate}
            disabled={loading || round > maxRounds}
          >
            {loading
              ? "Loading..."
              : round > maxRounds
              ? "Debate Finished"
              : aiSide === "pro"
              ? `Generate Pro Round ${round}`
              : `Generate Con Round ${round}`
            }
          </button>
        </div>
      )}

      {/* ============== MODE 2: USER vs AI ============== */}
      {mode === "ai-vs-user" && (
        <>
          {/* If the user hasn't chosen a side yet, show the side-selection buttons */}
          {!userSide && (
            <div style={{ marginBottom: "1rem" }}>
              <button
                onClick={() => handleChooseSide("pro")}
                style={{ marginRight: "0.5rem" }}
              >
                Argue Pro (User First)
              </button>
              <button onClick={() => handleChooseSide("con")}>
                Argue Con (AI First)
              </button>
            </div>
          )}

          {/* Once a side is chosen, show text area for the user’s next argument */}
          {userSide && (
            <div style={{ marginTop: "1rem" }}>
              <textarea
                placeholder={`Enter your ${userSide === "pro" ? "Pro" : "Con"} argument`}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                rows={4}
                style={{ width: "100%", resize: "vertical" }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !loading &&
                    userInput.trim().length > 0
                  ) {
                    e.preventDefault();
                    handleUserVsAISubmit();
                  }
                }}
              />
              <button
                onClick={handleUserVsAISubmit}
                disabled={loading || !userInput.trim()}
              >
                {loading ? "Loading..." : "Send"}
              </button>
            </div>
          )}
        </>
      )}

      {/* ============== MODE 3: USER vs USER ============== */}
      {mode === "user-vs-user" && (
        <div style={{ marginTop: "1rem" }}>
          <p style={{ fontStyle: "italic" }}>
            {userVsUserSide === "pro"
              ? "It's Pro's turn (User 1)."
              : "It's Con's turn (User 2)."}
          </p>
          <textarea
            placeholder={`Enter your ${userVsUserSide === "pro" ? "Pro" : "Con"} argument`}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            rows={4}
            style={{ width: "100%", resize: "vertical" }}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !loading &&
                userInput.trim().length > 0
              ) {
                e.preventDefault();
                handleUserVsUser();
              }
            }}
          />
          <button
            onClick={handleUserVsUser}
            disabled={loading || !userInput.trim()}
          >
            Send ({userVsUserSide === "pro" ? "Pro" : "Con"})
          </button>
        </div>
      )}

      {/* ============== Display errors, loading, and End Debate ============== */}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {loading && !error && <p>Loading AI response...</p>}

      <button
        onClick={endDebate}
        style={{ marginTop: "1rem" }}
        disabled={loading}
      >
        End Debate
      </button>
    </div>
  );
}

export default Debate;