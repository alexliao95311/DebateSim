import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { useLocation, useNavigate } from "react-router-dom";
import { generateAIResponse } from "../api";
import { saveTranscriptToUser } from "../firebase/saveTranscript"; // Import transcript-saving helper
import "./Debate.css"; 


const modelOptions = [
  "anthropic/claude-3.5-sonnet",
  "google/gemini-flash-1.5",
  "openai/gpt-4o-mini",
  "meta-llama/llama-3.3-70b-instruct",
  "mistralai/mistral-small-24b-instruct-2501"
];

function sanitizeUserInput(str) {
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function Debate() {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode, topic } = location.state || {};
  if (!mode || !topic) {
    navigate("/debatesim");
    return null;
  }

  // =================== State Variables ===================
  const [transcript, setTranscript] = useState("");
  const [round, setRound] = useState(1);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [judgeModel, setJudgeModel] = useState(modelOptions[4]);
  const [speechList, setSpeechList] = useState([]);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  // Debate Models
  const [proModel, setProModel] = useState(modelOptions[4]);
  const [conModel, setConModel] = useState(modelOptions[4]);
  const [singleAIModel, setSingleAIModel] = useState(modelOptions[4]);

  // Mode-Specific States
  const [aiSide, setAiSide] = useState("pro"); // For AI vs AI
  const [userSide, setUserSide] = useState("");  // For AI vs User
  const [userVsUserSide, setUserVsUserSide] = useState(""); // For User vs User
  const [firstSide, setFirstSide] = useState("pro"); // For choosing which side goes first

  // =================== Helper Functions ===================
  const appendDivider = (currentTranscript) =>
    currentTranscript.trim() !== ""
      ? currentTranscript + "\n<hr class='divider' />\n"
      : currentTranscript;

      const addSpeechBlock = (title, content, modelName) => {
        const newId = `speech-${speechList.length + 1}`;
        setSpeechList((prevList) => [...prevList, { id: newId, title }]);
        const isUserSpeech = title.toLowerCase().includes("(user");
        const safeContent = isUserSpeech ? sanitizeUserInput(content) : content;
        const maybeModel = (!isUserSpeech && modelName)
          ? `<p class="model-info">Model: ${modelName}</p>`
          : "";
          return `<div id="${newId}" class="speech-block"><h3>${title}:</h3>${maybeModel}${safeContent}</div>`;
      };

  const scrollToSpeech = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // =================== End Debate ===================
  // Now redirects to Judge.jsx with the debate transcript and other info.
  const handleEndDebate = async () => {
    setLoading(true);
    setError("");
    try {
      await saveTranscriptToUser(transcript);
      navigate("/judge", { state: { transcript, topic, mode, judgeModel } });
    } catch (err) {
      console.error("Error saving transcript:", err);
      setError("Failed to save transcript.");
    } finally {
      setLoading(false);
    }
  };

  // =================== MODE 1: AI vs AI ===================
  const maxRounds = 5;
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
    if (firstSide === "con" && side === "pro") {
      setLoading(true);
      try {
        let newTranscript = transcript;
        const conPrompt = `
          You are an AI debater on the Con side for topic: "${topic}".
          Provide an opening argument in favor of the Con position.
        `;
        const conResponse = await generateAIResponse("AI Debater (Con)", conPrompt, singleAIModel);
        newTranscript = appendDivider(newTranscript);
        newTranscript += addSpeechBlock("Con (AI)", conResponse, singleAIModel);
        setTranscript(newTranscript);
      } catch (err) {
        setError("Failed to fetch AI's Con opening argument.");
      } finally {
        setLoading(false);
      }
    } else if (firstSide === "pro" && side === "con") {
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
      const aiResponse = await generateAIResponse(`AI Debater (${aiSideLocal})`, prompt, singleAIModel);
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

  const handleChooseUserVsUserSide = (side) => {
    setUserVsUserSide(side);
  };

  // =================== Render JSX ===================
  return (
    <div className="debate-container">
      {/* Sidebar Toggle Button */}
      <button className="toggle-sidebar" onClick={() => setSidebarExpanded(!sidebarExpanded)}>
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

          {/* Model Selection */}
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
              </>
            )}
            {mode !== "user-vs-user" && (
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

          {/* Debate Transcript */}
          <ReactMarkdown rehypePlugins={[rehypeRaw]} className="markdown-renderer">
            {transcript}
          </ReactMarkdown>

          {/* Mode 1: AI vs AI */}
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

          {/* Mode 2: AI vs User */}
          {mode === "ai-vs-user" && (
            <>
              {!userSide && (
                <div className="ai-vs-user-order" style={{ marginBottom: "1rem" }}>
                  <label>
                    Who goes first?
                    <select value={firstSide} onChange={(e) => setFirstSide(e.target.value)}>
                      <option value="pro">Pro</option>
                      <option value="con">Con</option>
                    </select>
                  </label>
                  <button onClick={() => handleChooseSide("pro")} style={{ marginRight: "0.5rem" }}>
                    Argue Pro
                  </button>
                  <button onClick={() => handleChooseSide("con")}>
                    Argue Con
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
                    {firstSide === "pro" && userSide === "pro" && (
                      <button onClick={handleUserVsAISubmitAndEnd} disabled={loading || !userInput.trim()}>
                        Send & End (No AI Reply)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Mode 3: User vs User */}
          {mode === "user-vs-user" && (
            <>
              {!userVsUserSide && (
                <div style={{ marginBottom: "1rem" }}>
                  <label>
                    Who goes first? 
                  </label>
                  <br />
                  <button onClick={() => handleChooseUserVsUserSide("pro")} style={{ marginRight: "0.5rem" }}>
                    Pro
                  </button>
                  <button onClick={() => handleChooseUserVsUserSide("con")}>
                    Con
                  </button>
                </div>
              )}
              {userVsUserSide && (
                <div style={{ marginTop: "1rem" }}>
                  <p style={{ fontStyle: "italic" }}>
                    {userVsUserSide === "pro" ? "It's Pro's turn." : "It's Con's turn."}
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
            </>
          )}

          {/* Error & Loading Messages */}
          {error && <p style={{ color: "red" }}>{error}</p>}
          {loading && !error && <p>Loading AI response...</p>}

          {/* End Debate Button */}
          <button onClick={handleEndDebate} style={{ marginTop: "1rem" }} disabled={loading}>
            End Debate
          </button>
        </div>
      </div>
    </div>
  );
}

export default Debate;