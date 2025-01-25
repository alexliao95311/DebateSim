import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { generateAIResponse } from "../api";
import "./Debate.css"; // For text wrapping and styling

function Debate({ mode, topic, transcript, setTranscript, endDebate }) {
  // Common states
  const [round, setRound] = useState(1);      
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // For user-vs-AI: which side the user has chosen
  const [userSide, setUserSide] = useState(""); // "pro" or "con"

  // For AI-vs-AI: which side is next
  const [aiSide, setAiSide] = useState("pro");

  // For user-vs-user: track whose turn it is next ("pro" => User 1, "con" => User 2)
  const [userVsUserSide, setUserVsUserSide] = useState("pro");

  /**
   * ============================
   * MODE 2: USER vs AI
   * ============================
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
      // 1) User’s argument (Pro or Con)
      newTranscript += `\n### ${userSide === "pro" ? "Pro" : "Con"} (User):\n${userInput}`;
      setTranscript(newTranscript);
      setRound((prev) => prev + 1);
      setUserInput("");

      // 2) AI’s rebuttal (opposite side)
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
   * ============================
   * MODE 1: AI vs AI
   * ============================
   */
  const maxRounds = 3;

  const handleAIDebate = async () => {
    // If we've already done the maximum rounds, do nothing further
    if (round > maxRounds) {
      return;
    }

    setLoading(true);
    setError("");
    let newTranscript = transcript;

    try {
      // Get the last argument from transcript
      const lines = newTranscript.trim().split("\n");
      let lastArgument = "";
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim()) {
          lastArgument = lines[i].trim();
          break;
        }
      }

      if (aiSide === "pro") {
        // PRO’s turn
        const proPrompt = `
          Debate topic: "${topic}"
          Respond as PRO in Round ${round}.
          The opponent's last argument, if any, was:
          "${lastArgument}"
          
          Address the opponent's points and strengthen your PRO stance with evidence or references.
        `;
        const proResponse = await generateAIResponse("AI Debater (Pro)", proPrompt);
        
        newTranscript += `\n### AI Debater (Pro) - Round ${round}:\n${proResponse}\n`;
        setAiSide("con"); // Next turn is Con

      } else {
        // CON’s turn
        const conPrompt = `
          Debate topic: "${topic}"
          Respond as CON in Round ${round}.
          The opponent's last argument was:
          "${lastArgument}"

          Rebut the PRO's arguments with data, stats, or references to support the CON side.
        `;
        const conResponse = await generateAIResponse("AI Debater (Con)", conPrompt);

        newTranscript += `\n### AI Debater (Con) - Round ${round}:\n${conResponse}\n`;
        setAiSide("pro");
        setRound((prevRound) => prevRound + 1);

        // If this was the final Con turn of the final round, end debate
        if (round === maxRounds) {
          endDebate();
        }
      }
      setTranscript(newTranscript);

    } catch (err) {
      setError("Failed to fetch AI response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * ============================
   * MODE 3: USER vs USER
   * ============================
   * Pro = User 1 goes first => Con = User 2 goes next => and so on.
   * No enforced round limit here; they can click End Debate whenever they want.
   */
  const handleUserVsUser = () => {
    if (!userInput.trim()) return;

    let newTranscript = transcript;
    if (userVsUserSide === "pro") {
      // Pro turn
      newTranscript += `\n### Pro (User 1):\n${userInput.trim()}`;
      setUserVsUserSide("con"); // Next turn => Con
    } else {
      // Con turn
      newTranscript += `\n### Con (User 2):\n${userInput.trim()}`;
      setUserVsUserSide("pro"); // Next turn => Pro
    }

    setTranscript(newTranscript);
    setUserInput("");
    setError("");
  };

  return (
    <div style={{ backgroundColor: "#fff", padding: "2rem", borderRadius: "8px" }}>
      <h2>Debate Topic: {topic}</h2>

      <ReactMarkdown className="markdown-renderer">{transcript}</ReactMarkdown>

      {/* ================ AI vs AI ================ */}
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

      {/* ================ User vs AI ================ */}
      {mode === "ai-vs-user" && (
        <>
          {/* Let the user pick a side once */}
          {!userSide && (
            <div style={{ marginBottom: "1rem" }}>
              <button onClick={() => setUserSide("pro")} style={{ marginRight: "0.5rem" }}>
                Argue Pro
              </button>
              <button onClick={() => setUserSide("con")}>
                Argue Con
              </button>
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
              <button
                onClick={handleUserSubmit}
                disabled={loading || !userInput.trim()}
              >
                Send
              </button>
            </>
          )}
        </>
      )}

      {/* ================ User vs User ================ */}
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
              // Submit on Enter (unless Shift is pressed)
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

      {error && <p style={{ color: "red" }}>{error}</p>}
      {loading && <p>Loading AI response...</p>}

      {/* Single "End Debate" button calls judge */}
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