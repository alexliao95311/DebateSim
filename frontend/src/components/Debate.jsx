import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { generateAIResponse } from "../api";
import "./Debate.css";

function Debate({ mode, topic, transcript, setTranscript, endDebate }) {
  // Common State
  const [round, setRound] = useState(1);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Mode-specific States
  const [userSide, setUserSide] = useState(""); // "pro" or "con" for user vs AI
  const [aiSide, setAiSide] = useState("pro"); // for AI vs AI
  const maxRounds = 5;
  const [userVsUserSide, setUserVsUserSide] = useState("pro"); // for user vs user

  // New state to hold speech block headers for sidebar navigation.
  // Each entry: { id: "speech-#", title: "Pro (AI)" }
  const [speechList, setSpeechList] = useState([]);

  // Helper: Append a divider if needed.
  const appendDivider = (currentTranscript) =>
    currentTranscript.trim() !== ""
      ? currentTranscript + `<hr class="divider" />`
      : currentTranscript;

  // Helper: Generate a new speech block and update the speechList.
  const addSpeechBlock = (title, content) => {
    const newId = `speech-${speechList.length + 1}`;
    // Update speechList state using a functional update.
    setSpeechList((prevList) => [...prevList, { id: newId, title }]);
    return `<div id="${newId}" class="speech-block"><h3>${title}:</h3><p>${content}</p></div>`;
  };

  // Helper: Scroll to a speech block by its ID.
  const scrollToSpeech = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // MODE 2: User vs AI Logic
  const handleChooseSide = async (side) => {
    setUserSide(side);
    setError("");
    // If user chooses "Con", let the AI open as Pro.
    if (side === "con") {
      setLoading(true);
      try {
        let newTranscript = transcript;
        const proPrompt = `
          You are an AI debater on the Pro side for topic: "${topic}".
          Provide an opening argument in favor of the Pro position.
        `;
        const proResponse = await generateAIResponse("AI Debater (Pro)", proPrompt);
        newTranscript = appendDivider(newTranscript);
        newTranscript += addSpeechBlock("Pro (AI)", proResponse);
        setTranscript(newTranscript);
      } catch (err) {
        setError("Failed to fetch AI's initial Pro argument. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleUserVsAISubmit = async () => {
    if (!userSide) {
      setError("Please choose Pro or Con before proceeding.");
      return;
    }
    if (!userInput.trim()) return;

    setLoading(true);
    setError("");

    try {
      // Append the user's argument.
      let newTranscript = transcript;
      const userLabel = userSide === "pro" ? "Pro (User)" : "Con (User)";
      newTranscript = appendDivider(newTranscript);
      newTranscript += addSpeechBlock(userLabel, userInput);
      setTranscript(newTranscript);
      setUserInput("");
      setRound((prev) => prev + 1);

      // Append the AI’s rebuttal.
      const aiSideLocal = userSide === "pro" ? "Con" : "Pro";
      const prompt = `
        You are an AI debater on the ${aiSideLocal} side, topic: "${topic}".
        The user just said: "${userInput}"
        Provide a rebuttal from the ${aiSideLocal} perspective, citing evidence if possible.
      `;
      const response = await generateAIResponse(`AI Debater (${aiSideLocal})`, prompt);
      newTranscript = appendDivider(newTranscript);
      newTranscript += addSpeechBlock(`${aiSideLocal} (AI)`, response);
      setTranscript(newTranscript);
      setRound((prev) => prev + 1);
    } catch (err) {
      setError("Failed to fetch AI response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUserVsAISubmitAndEnd = async () => {
    if (!userSide) {
      setError("Please choose Pro or Con before proceeding.");
      return;
    }
    if (!userInput.trim()) return;

    setLoading(true);
    setError("");

    try {
      let newTranscript = transcript;
      const userLabel = userSide === "pro" ? "Pro (User)" : "Con (User)";
      newTranscript = appendDivider(newTranscript);
      newTranscript += addSpeechBlock(userLabel, userInput);
      setTranscript(newTranscript);
      setUserInput("");
      setRound((prev) => prev + 1);
      endDebate();
    } catch (err) {
      setError("Failed to send argument. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // MODE 1: AI vs AI Logic
  const handleAIDebate = async () => {
    if (round > maxRounds) return;

    setLoading(true);
    setError("");

    try {
      let newTranscript = transcript;
      // Retrieve last argument from transcript (for context).
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
        newTranscript = appendDivider(newTranscript);
        newTranscript += addSpeechBlock(`AI Debater (Pro) - Round ${round}/${maxRounds}`, proResponse);
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
        newTranscript = appendDivider(newTranscript);
        newTranscript += addSpeechBlock(`AI Debater (Con) - Round ${round}/${maxRounds}`, conResponse);
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

  // MODE 3: User vs User Logic
  const handleUserVsUser = () => {
    if (!userInput.trim()) return;

    let newTranscript = transcript;
    newTranscript = appendDivider(newTranscript);
    if (userVsUserSide === "pro") {
      newTranscript += addSpeechBlock("Pro (User 1)", userInput.trim());
      setUserVsUserSide("con");
    } else {
      newTranscript += addSpeechBlock("Con (User 2)", userInput.trim());
      setUserVsUserSide("pro");
    }
    setTranscript(newTranscript);
    setUserInput("");
    setError("");
  };

  return (
    <div className="debate-container">
      <div className="debate-wrapper">
        {/* Sidebar Navigation */}
        <div className="sidebar">
          <h3>Speeches</h3>
          <ul>
            {speechList.map((item) => (
              <li key={item.id} onClick={() => scrollToSpeech(item.id)}>
                {item.title}
              </li>
            ))}
          </ul>
        </div>

        {/* Main Debate Content */}
        <div className="debate-content">
          <h2 className="debate-topic-header">Debate Topic: {topic}</h2>
          <ReactMarkdown rehypePlugins={[rehypeRaw]} className="markdown-renderer">
            {transcript}
          </ReactMarkdown>

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
                  ? `Generate Pro Round ${round}/${maxRounds}`
                  : `Generate Con Round ${round}/${maxRounds}`}
              </button>
            </div>
          )}

          {/* MODE 2: USER vs AI */}
          {mode === "ai-vs-user" && (
            <>
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
                    <button
                      onClick={handleUserVsAISubmit}
                      disabled={loading || !userInput.trim()}
                      style={{ marginRight: "1rem" }}
                    >
                      {loading ? "Loading..." : "Send & Get AI Reply"}
                    </button>
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

          {/* Universal End Debate Button */}
          <button onClick={endDebate} style={{ marginTop: "1rem" }} disabled={loading}>
            End Debate
          </button>
        </div>
      </div>
    </div>
  );
}

export default Debate;