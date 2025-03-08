import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

import { generateAIResponse } from "../api";
import { saveTranscriptToUser } from "../firebase/saveTranscript"; // NEW: import our transcript saving helper
import "./Debate.css";

const modelOptions = [
  "anthropic/claude-3.5-sonnet",
  "google/gemini-flash-1.5",
  "openai/gpt-4o-mini",
  "meta-llama/llama-3.3-70b-instruct",
  "mistralai/mistral-small-24b-instruct-2501"
];

/** Escape < and > so user-supplied HTML doesn't break layout. */
function sanitizeUserInput(str) {
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function Debate({ mode, topic, transcript, setTranscript, endDebate, judgeModel, setJudgeModel }) {
  // Common state
  const [round, setRound] = useState(1);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Sidebar navigation
  const [speechList, setSpeechList] = useState([]);
  // NEW: Toggle sidebar state
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  // Max rounds for AI vs AI
  const maxRounds = 5;

  // Model selection for AI sides (judgeModel is now passed in via props)
  const [proModel, setProModel] = useState(modelOptions[4]);
  const [conModel, setConModel] = useState(modelOptions[4]);
  const [singleAIModel, setSingleAIModel] = useState(modelOptions[4]);

  // Mode-specific states
  const [aiSide, setAiSide] = useState("pro"); // Mode 1
  const [userSide, setUserSide] = useState(""); // Mode 2
  const [userVsUserSide, setUserVsUserSide] = useState("pro"); // Mode 3

  // Insert divider <hr> if transcript isn’t empty
  const appendDivider = (currentTranscript) =>
    currentTranscript.trim() !== ""
      ? currentTranscript + "\n<hr class='divider' />\n"
      : currentTranscript;

  /**
   * Create a speech block as raw HTML.
   */
  const addSpeechBlock = (title, content, modelName) => {
    const newId = `speech-${speechList.length + 1}`;
    setSpeechList((prevList) => [...prevList, { id: newId, title }]);

    const isUserSpeech = title.toLowerCase().includes("(user");
    const safeContent = isUserSpeech ? sanitizeUserInput(content) : content;

    const maybeModel = (!isUserSpeech && modelName)
      ? `<p class="model-info">Model: ${modelName}</p>`
      : "";

    return `
<div id="${newId}" class="speech-block">
  <h3>${title}:</h3>
  ${maybeModel}
  ${safeContent}
</div>
`;
  };

  const scrollToSpeech = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleEndDebate = async () => {
    setLoading(true);
    setError("");
    try {
      //await saveTranscriptToUser(transcript);
    } catch (err) {
      console.error("Error saving transcript:", err);
      setError("Failed to save transcript.");
    } finally {
      setLoading(false);
      endDebate();
    }
  };

  // =================== MODE 1: AI vs AI ===================
  const handleAIDebate = async () => {
    if (round > maxRounds) return;
    setLoading(true);
    setError("");

    try {
      let newTranscript = transcript.trim();
      const lines = newTranscript.split("\n");
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
        const proResponse = await generateAIResponse("AI Debater (Pro)", proPrompt, proModel);
        newTranscript = appendDivider(newTranscript);
        newTranscript += addSpeechBlock(
          `AI Debater (Pro) - Round ${round}/${maxRounds}`,
          proResponse,
          proModel
        );
        setAiSide("con");
      } else {
        const conPrompt = `
          Debate topic: "${topic}"
          Respond as CON in Round ${round}.
          Opponent's last argument: "${lastArgument}"
          Rebut and strengthen CON stance.
        `;
        const conResponse = await generateAIResponse("AI Debater (Con)", conPrompt, conModel);
        newTranscript = appendDivider(newTranscript);
        newTranscript += addSpeechBlock(
          `AI Debater (Con) - Round ${round}/${maxRounds}`,
          conResponse,
          conModel
        );
        setAiSide("pro");
        setRound((prev) => prev + 1);

        if (round === maxRounds) {
          await handleEndDebate();
          return;
        }
      }

      setTranscript(newTranscript);
    } catch (err) {
      setError("Failed to fetch AI response for AI vs AI mode.");
    } finally {
      setLoading(false);
    }
  };

  // =================== MODE 2: AI vs User ===================
  const handleChooseSide = async (side) => {
    setUserSide(side);
    setError("");

    if (side === "con") {
      setLoading(true);
      try {
        let newTranscript = transcript;
        const proPrompt = `
          You are an AI debater on the Pro side for topic: "${topic}".
          Provide an opening argument in favor of the Pro position.
        `;
        const proResponse = await generateAIResponse("AI Debater (Pro)", proPrompt, singleAIModel);
        newTranscript = appendDivider(newTranscript);
        newTranscript += addSpeechBlock("Pro (AI)", proResponse, singleAIModel);
        setTranscript(newTranscript);
      } catch (err) {
        setError("Failed to fetch AI's Pro opening argument.");
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
      let newTranscript = transcript;
      const userLabel = userSide === "pro" ? "Pro (User)" : "Con (User)";
      newTranscript = appendDivider(newTranscript);
      newTranscript += addSpeechBlock(userLabel, userInput);
      setTranscript(newTranscript);
      setUserInput("");
      setRound((prev) => prev + 1);

      const aiSideLocal = userSide === "pro" ? "Con" : "Pro";
      const prompt = `
        You are an AI debater on the ${aiSideLocal} side, topic: "${topic}".
        The user just said: "${userInput}"
        Provide a rebuttal from the ${aiSideLocal} perspective.
      `;
      const aiResponse = await generateAIResponse(
        `AI Debater (${aiSideLocal})`,
        prompt,
        singleAIModel
      );
      newTranscript = appendDivider(newTranscript);
      newTranscript += addSpeechBlock(`${aiSideLocal} (AI)`, aiResponse, singleAIModel);
      setTranscript(newTranscript);
      setRound((prev) => prev + 1);
    } catch (err) {
      setError("Failed to fetch AI rebuttal.");
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

      await handleEndDebate();
    } catch (err) {
      setError("Failed to send final user argument.");
    } finally {
      setLoading(false);
    }
  };

  // =================== MODE 3: User vs User ===================
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
      {/* Sidebar Toggle Button */}
      <button 
        className="toggle-sidebar" 
        onClick={() => setSidebarExpanded(!sidebarExpanded)}
      >
        {sidebarExpanded ? "Hide Speeches" : "Show Speeches"}
      </button>

      {/* Sidebar */}
      <div className={`sidebar ${sidebarExpanded ? "expanded" : ""}`}>
        <h3>Speeches</h3>
        <ul>
          {speechList.map((item) => (
            <li key={item.id} onClick={() => scrollToSpeech(item.id)}>
              {item.title}
            </li>
          ))}
        </ul>
      </div>

      <div className="debate-wrapper">
        <div className="debate-content">
          <h2 className="debate-topic-header">Debate Topic: {topic}</h2>

          {/* Model Selection and Debate Transcript... */}
          <div className="model-selection">
            {mode === "ai-vs-ai" && (
              <>
                <label>
                  Pro Model:
                  <select value={proModel} onChange={(e) => setProModel(e.target.value)}>
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Con Model:
                  <select value={conModel} onChange={(e) => setConModel(e.target.value)}>
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Judge Model:
                  <select value={judgeModel} onChange={(e) => setJudgeModel(e.target.value)}>
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            {mode === "ai-vs-user" && (
              <>
                <label>
                  AI Model:
                  <select value={singleAIModel} onChange={(e) => setSingleAIModel(e.target.value)}>
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Judge Model:
                  <select value={judgeModel} onChange={(e) => setJudgeModel(e.target.value)}>
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            {mode === "user-vs-user" && (
              <label>
                Judge Model:
                <select value={judgeModel} onChange={(e) => setJudgeModel(e.target.value)}>
                  {modelOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <ReactMarkdown rehypePlugins={[rehypeRaw]} className="markdown-renderer">
            {transcript}
          </ReactMarkdown>

          {mode === "ai-vs-ai" && (
            <div style={{ marginTop: "1rem" }}>
              <button onClick={handleAIDebate} disabled={loading || round > maxRounds}>
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
              {userSide && (
                <div style={{ marginTop: "1rem" }}>
                  <textarea
                    placeholder={`Enter your ${userSide === "pro" ? "Pro" : "Con"} argument`}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    rows={4}
                    style={{ width: "100%", resize: "vertical" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !loading && userInput.trim().length > 0) {
                        e.preventDefault();
                        handleUserVsAISubmit();
                      }
                    }}
                  />
                  <div style={{ marginTop: "0.5rem" }}>
                    <button onClick={handleUserVsAISubmit} disabled={loading || !userInput.trim()} style={{ marginRight: "1rem" }}>
                      {loading ? "Loading..." : "Send & Get AI Reply"}
                    </button>
                    {userSide === "con" && (
                      <button onClick={handleUserVsAISubmitAndEnd} disabled={loading || !userInput.trim()}>
                        Send & End (No AI Reply)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

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
                  if (e.key === "Enter" && !e.shiftKey && !loading && userInput.trim().length > 0) {
                    e.preventDefault();
                    handleUserVsUser();
                  }
                }}
              />
              <button onClick={handleUserVsUser} disabled={loading || !userInput.trim()}>
                Send ({userVsUserSide === "pro" ? "Pro" : "Con"})
              </button>
            </div>
          )}

          {error && <p style={{ color: "red" }}>{error}</p>}
          {loading && !error && <p>Loading AI response...</p>}

          <button onClick={handleEndDebate} style={{ marginTop: "1rem" }} disabled={loading}>
            End Debate
          </button>
        </div>
      </div>
    </div>
  );
}

export default Debate;