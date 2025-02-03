import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { generateAIResponse } from "../api";
import "./Debate.css";

function Debate({ mode, topic, transcript, setTranscript, endDebate }) {
  /**
   * ================== COMMON STATE ==================
   */
  const [round, setRound] = useState(1);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * =============== MODE 2 (USER vs AI) ===============
   */
  const [userSide, setUserSide] = useState(""); // "pro" or "con"

  /**
   * =============== MODE 1 (AI vs AI) ===============
   */
  const [aiSide, setAiSide] = useState("pro");
  const maxRounds = 5; // For AI vs AI

  /**
   * =============== MODE 3 (USER vs USER) ===============
   */
  const [userVsUserSide, setUserVsUserSide] = useState("pro");

  /**
   * ===================== MODE 2 LOGIC =====================
   */

  /**
   * Once user picks "Pro" or "Con":
   *  - If "Pro": user speaks first.
   *  - If "Con": AI (Pro) does an opening statement before user goes.
   */
  const handleChooseSide = async (side) => {
    setUserSide(side);
    setError("");

    // If user wants to be "Con," let the AI open as Pro
    if (side === "con") {
      setLoading(true);
      try {
        let newTranscript = transcript;
        const proPrompt = `
          You are an AI debater on the Pro side for topic: "${topic}".
          Provide an opening argument in favor of the Pro position.
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
   * User’s standard “Send” in Mode 2.
   * Appends user’s argument -> calls AI for the counterargument.
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
      // 1) Add user's argument to transcript
      let newTranscript = transcript;
      const userLabel = userSide === "pro" ? "Pro (User)" : "Con (User)";
      newTranscript += `\n### ${userLabel}:\n${userInput}`;
      setTranscript(newTranscript);

      setUserInput("");
      setRound((prev) => prev + 1);

      // 2) AI’s rebuttal
      const aiSideLocal = userSide === "pro" ? "Con" : "Pro";
      const prompt = `
        You are an AI debater on the ${aiSideLocal} side, topic: "${topic}".
        The user just said: "${userInput}"
        Provide a rebuttal from the ${aiSideLocal} perspective, citing evidence if possible.
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
   * NEW: “Send & End” for when user is Con (skips AI’s next response).
   */
  const handleUserVsAISubmitAndEnd = async () => {
    if (!userSide) {
      setError("Please choose Pro or Con before proceeding.");
      return;
    }
    if (!userInput.trim()) return;

    setLoading(true);
    setError("");

    try {
      // 1) Append user's argument (Con side)
      let newTranscript = transcript;
      const userLabel = userSide === "pro" ? "Pro (User)" : "Con (User)";
      newTranscript += `\n### ${userLabel}:\n${userInput}`;
      setTranscript(newTranscript);

      // 2) Clear input and increment round
      setUserInput("");
      setRound((prev) => prev + 1);

      // 3) End debate immediately (no AI rebuttal)
      endDebate();

    } catch (err) {
      setError("Failed to send argument. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * ===================== MODE 1 LOGIC (AI vs AI) =====================
   */
  const handleAIDebate = async () => {
    if (round > maxRounds) return;

    setLoading(true);
    setError("");

    try {
      let newTranscript = transcript;
      // Get last argument from transcript
      const lines = newTranscript.trim().split("\n");
      let lastArgument = "";
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim()) {
          lastArgument = lines[i].trim();
          break;
        }
      }

      if (aiSide === "pro") {
        const proPrompt = `
          Debate topic: "${topic}"
          Respond as PRO in Round ${round}.
          Opponent's last argument: "${lastArgument}"
          Rebut and strengthen PRO stance.
        `;
        const proResponse = await generateAIResponse("AI Debater (Pro)", proPrompt);
        newTranscript += `\n### AI Debater (Pro) - Round ${round}:\n${proResponse}\n`;
        setAiSide("con");
        setTranscript(newTranscript);

      } else {
        const conPrompt = `
          Debate topic: "${topic}"
          Respond as CON in Round ${round}.
          Opponent's last argument: "${lastArgument}"
          Rebut and strengthen CON stance.
        `;
        const conResponse = await generateAIResponse("AI Debater (Con)", conPrompt);
        newTranscript += `\n### AI Debater (Con) - Round ${round}:\n${conResponse}\n`;
        setAiSide("pro");
        setTranscript(newTranscript);

        setRound((prev) => prev + 1);
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
   * ===================== MODE 3 LOGIC (USER vs USER) =====================
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
   * ===================== RENDER =====================
   */
  return (
    <div className="debate-container">
      <div className="debate-content">
        <h2>Debate Topic: {topic}</h2>
        <ReactMarkdown className="markdown-renderer">{transcript}</ReactMarkdown>

        {/* MODE 1: AI vs AI */}
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

        {/* MODE 2: USER vs AI */}
        {mode === "ai-vs-user" && (
          <>
            {!userSide && (
              <div style={{ marginBottom: "1rem" }}>
                <button onClick={() => handleChooseSide("pro")} style={{ marginRight: "0.5rem" }}>
                  Argue Pro (User First)
                </button>
                <button onClick={() => handleChooseSide("con")}>
                  Argue Con (AI First)
                </button>
              </div>
            )}

            {/* Once a side is chosen, show the user input + “Send” buttons */}
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
                <div style={{ marginTop: "0.5rem" }}>
                  {/* Normal "Send" => user argument + AI response */}
                  <button
                    onClick={handleUserVsAISubmit}
                    disabled={loading || !userInput.trim()}
                    style={{ marginRight: "1rem" }}
                  >
                    {loading ? "Loading..." : "Send & Get AI Reply"}
                  </button>

                  {/* Show "Send & End" ONLY if userSide === "con" */}
                  {userSide === "con" && (
                    <button
                      onClick={handleUserVsAISubmitAndEnd}
                      disabled={loading || !userInput.trim()}
                    >
                      Send & End (No AI Reply)
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* MODE 3: USER vs USER */}
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

        {error && <p style={{ color: "red" }}>{error}</p>}
        {loading && !error && <p>Loading AI response...</p>}

        {/* Universal "End Debate" button, always available */}
        <button
          onClick={endDebate}
          style={{ marginTop: "1rem" }}
          disabled={loading}
        >
          End Debate
        </button>
      </div>
    </div>
  );
}

export default Debate;