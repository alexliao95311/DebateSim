import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { useLocation, useNavigate } from "react-router-dom";
import { generateAIResponse } from "../api";
import { saveTranscriptToUser } from "../firebase/saveTranscript";
import LoadingSpinner from "./LoadingSpinner";
import "./Debate.css"; 

const modelOptions = [
  "qwen/qwq-32b:free",
  "meta-llama/llama-3-8b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "deepseek/deepseek-r1-0528:free",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o-mini",
  "meta-llama/llama-3.3-70b-instruct",
  "openai/gpt-4o-mini-search-preview"
];

function sanitizeUserInput(str) {
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function Debate() {
  // Retrieve debate parameters: short topic (bill name) and full description.
  const { mode, topic, description } = useLocation().state || {};
  const navigate = useNavigate();
  if (!mode || !topic) {
    navigate("/debatesim");
    return null;
  }

  // Each message: { speaker: string, text: string, model?: string }
  const [messageList, setMessageList] = useState([]);
  const [round, setRound] = useState(1);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [judgeModel, setJudgeModel] = useState(modelOptions[0]);
  const [speechList, setSpeechList] = useState([]);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // Debate Models and mode-specific states.
  const [proModel, setProModel] = useState(modelOptions[0]);
  const [conModel, setConModel] = useState(modelOptions[0]);
  const [singleAIModel, setSingleAIModel] = useState(modelOptions[0]);
  const [aiSide, setAiSide] = useState("pro");
  const [userSide, setUserSide] = useState("");
  const [userVsUserSide, setUserVsUserSide] = useState("");
  const [firstSide, setFirstSide] = useState("pro");

  // Handler for the back to home button
  const handleBackToHome = () => {
    navigate("/debatesim");
  };

  // Append a new message object to messageList
  const appendMessage = (speaker, text, modelName = null) => {
    setMessageList(prev => [
      ...prev,
      { speaker, text: text.trim(), model: modelName },
    ]);
  };

  // Build a single Markdown transcript from messageList
  const buildPlainTranscript = () => {
    return messageList
      .map(({ speaker, text, model }) => {
        const modelInfo = model ? `*Model: ${model}*\n\n` : "";
        return `## ${speaker}\n${modelInfo}${text}`;
      })
      .join("\n\n---\n\n");
  };

  const scrollToSpeech = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Update speechList whenever messageList changes
  useEffect(() => {
    const newSpeechList = messageList.map((msg, index) => {
      let title = msg.speaker;
      
      // Add round information for AI debaters in AI vs AI mode
      if (mode === "ai-vs-ai" && (msg.speaker === "AI Debater Pro" || msg.speaker === "AI Debater Con")) {
        // Calculate which round this speech belongs to
        // Count previous AI speeches to determine round
        const previousAISpeeches = messageList.slice(0, index).filter(m => 
          m.speaker === "AI Debater Pro" || m.speaker === "AI Debater Con"
        ).length;
        const speechRound = Math.ceil((previousAISpeeches + 1) / 2);
        title = `${msg.speaker} - Round ${speechRound}/5`;
      }
      
      return {
        id: `speech-${index}`,
        title: title
      };
    });
    setSpeechList(newSpeechList);
  }, [messageList, mode]);

  useEffect(() => {
    if (description && messageList.length === 0) {
      // First message is the Bill Description
      appendMessage("Bill Description", description);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description]);

  const handleEndDebate = async () => {
    setLoading(true);
    setError("");
    try {
      const finalTranscript = buildPlainTranscript();
      navigate("/judge", { state: { transcript: finalTranscript, topic, mode, judgeModel } });
    } catch (err) {
      console.error("Error ending debate:", err);
      setError("Failed to end debate.");
    } finally {
      setLoading(false);
    }
  };

  const maxRounds = 5;
  const handleAIDebate = async () => {
    if (round > maxRounds) return;
    setLoading(true);
    setError("");
    try {
      // Get last message text
      const lastMessage = messageList.length > 0
        ? messageList[messageList.length - 1]
        : null;
      const lastArgument = lastMessage ? lastMessage.text : "";

      const truncatedDescription = description?.length > 3000
        ? `${description.substring(0, 3000)}... (bill text continues)`
        : description;

      let aiResponse;
      if (aiSide === "pro") {
        const proPrompt = `
             Debate topic: "${topic}"
             Bill description: "${truncatedDescription}"
             Round: ${round} of ${maxRounds}
             Your role: PRO
             Last argument: ${lastArgument ? "The opponent argued:" : "You're opening the debate."}
             ${lastArgument}

             Instructions:
             1. Directly rebut the opponent's key points if they've spoken
             2. Strengthen the PRO position with 2-3 clear arguments
             3. Keep your response concise (max 500 words)
             4. Be persuasive but respectful
             5. Conclude with a strong summary statement
           `;
        aiResponse = await generateAIResponse("AI Debater Pro", proPrompt, proModel);
        appendMessage("AI Debater Pro", aiResponse, proModel);
        setAiSide("con");
      } else {
        const conPrompt = `
             Debate topic: "${topic}"
             Bill description: "${truncatedDescription}"
             Round: ${round} of ${maxRounds}
             Your role: CON
             Last argument: ${lastArgument ? "The opponent argued:" : "You're opening the debate."}
             ${lastArgument}

             Instructions:
             1. Directly rebut the opponent's key points if they've spoken
             2. Strengthen the CON position with 2-3 clear arguments
             3. Keep your response concise (max 500 words)
             4. Be persuasive but respectful
             5. Conclude with a strong summary statement
           `;
        aiResponse = await generateAIResponse("AI Debater (Con)", conPrompt, conModel);
        appendMessage("AI Debater Con", aiResponse, conModel);
        setAiSide("pro");
        setRound(prev => prev + 1);
        if (round === maxRounds) {
          await handleEndDebate();
          return;
        }
      }
    } catch (err) {
      setError("Failed to fetch AI response for AI vs AI mode.");
    } finally {
      setLoading(false);
    }
  };

  const handleChooseSide = async (side) => {
    setUserSide(side);
    setError("");

    const truncatedDescription = description?.length > 3000
      ? `${description.substring(0, 3000)}... (bill text continues)`
      : description;

    setLoading(true);
    try {
      if (firstSide === "con" && side === "pro") {
        const conPrompt = `
             Debate topic: "${topic}"
             Bill description: "${truncatedDescription}"
             Your role: Opening speaker for the CON side

             Instructions:
             1. Provide an opening argument against the topic
             2. Present 2-3 strong arguments for the CON position
             3. Keep your response concise (max 400 words)
             4. Be persuasive and clear
             5. End with a strong statement
           `;
        const conResponse = await generateAIResponse("AI Debater (Con)", conPrompt, singleAIModel);
        appendMessage("Con (AI)", conResponse, singleAIModel);
      } else if (firstSide === "pro" && side === "con") {
        const proPrompt = `
             Debate topic: "${topic}"
             Bill description: "${truncatedDescription}"
             Your role: Opening speaker for the PRO side

             Instructions:
             1. Provide an opening argument in favor of the topic
             2. Present 2-3 strong arguments for the PRO position
             3. Keep your response concise (max 400 words)
             4. Be persuasive and clear
             5. End with a strong statement
           `;
        const proResponse = await generateAIResponse("AI Debater (Pro)", proPrompt, singleAIModel);
        appendMessage("Pro (AI)", proResponse, singleAIModel);
      }
    } catch (err) {
      setError(`Failed to fetch AI's ${side === "pro" ? "Pro" : "Con"} opening argument.`);
    } finally {
      setLoading(false);
    }
  };

  const handleUserVsAISubmit = async () => {
    if (!userInput.trim()) {
      alert("Input field cannot be blank. Please enter your argument.");
      return;
    }
    if (!userSide) {
      setError("Please choose Pro or Con before proceeding.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      appendMessage(
        userSide === "pro" ? "Pro (User)" : "Con (User)",
        userInput
      );
      setUserInput("");

      const recentMessages = messageList
        .slice(-3)
        .map(msg => `${msg.speaker}: ${msg.text}`)
        .join("\n");

      const truncatedDescription = description?.length > 3000
        ? `${description.substring(0, 3000)}... (bill text continues)`
        : description;

      const aiSideLocal = userSide === "pro" ? "Con" : "Pro";

      const prompt = `
           Debate topic: "${topic}"
           Bill description: "${truncatedDescription}"
           Recent exchanges:
           ${recentMessages}

           The user just argued for the ${userSide.toUpperCase()} side.

           Instructions:
           1. You are on the ${aiSideLocal.toUpperCase()} side
           2. Directly rebut the user's key points
           3. Present 1-2 strong counterarguments
           4. Keep your response concise (max 400 words)
           5. Be persuasive but respectful
         `;

      const aiResponse = await generateAIResponse(`AI Debater (${aiSideLocal})`, prompt, singleAIModel);
      appendMessage(`${aiSideLocal} (AI)`, aiResponse, singleAIModel);
      setRound(prev => prev + 1);
    } catch (err) {
      setError("Failed to fetch AI rebuttal.");
    } finally {
      setLoading(false);
    }
  };

  const handleUserVsAISubmitAndEnd = async () => {
    if (!userInput.trim()) {
      alert("Input field cannot be blank. Please enter your argument.");
      return;
    }
    if (!userSide) {
      setError("Please choose Pro or Con before proceeding.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      appendMessage(
        userSide === "pro" ? "Pro (User)" : "Con (User)",
        userInput
      );
      setUserInput("");
      setRound(prev => prev + 1);
      await handleEndDebate();
    } catch (err) {
      setError("Failed to send final user argument.");
    } finally {
      setLoading(false);
    }
  };

  const handleUserVsUser = () => {
    if (!userInput.trim()) {
      alert("Input field cannot be blank. Please enter your argument.");
      return;
    }
    appendMessage("User vs User", userInput.trim());
    setUserInput("");
    setError("");
  };

  const handleChooseUserVsUserSide = (side) => {
    setUserVsUserSide(side);
  };

  return (
    <div className={`debate-container ${sidebarExpanded ? 'sidebar-open' : ''}`}>
      {/* Back to Home button in the top right corner */}
      <button className="back-to-home" onClick={handleBackToHome}>
        Back to Home
      </button>

      <button className="toggle-sidebar" onClick={() => setSidebarExpanded(!sidebarExpanded)}>
        {sidebarExpanded ? "Hide Speeches" : "Show Speeches"}
      </button>
      <div className={`sidebar ${sidebarExpanded ? "expanded" : ""}`}>
        <h3>Speeches</h3>
        <ul>
          {speechList
            .filter((item) => item.title !== "Bill Description")
            .map((item) => (
              <li key={item.id} onClick={() => scrollToSpeech(item.id)}>
                {item.title}
              </li>
            ))}
        </ul>
      </div>
      <div className="debate-wrapper">
        <div className="debate-content">
          <h2 className="debate-topic-header">Debate Topic: {topic}</h2>
          {description && (
            <div className="bill-description">
              <button
                className="toggle-description"
                onClick={() => setDescriptionExpanded(!descriptionExpanded)}
              >
                {descriptionExpanded ? "Hide Bill Text" : "Show Bill Text"}
              </button>
              {descriptionExpanded && (
                <div className="description-content scrollable">
                  <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                    {description}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}
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
            {mode === "user-vs-ai" && (
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
        {/* Render each speech as its own block */}
        {messageList.map(({ speaker, text, model }, i) => (
          <div key={i} className="speech-block" id={`speech-${i}`}>
            <h3>{speaker}</h3>
            {model && <div className="model-info">Model: {model}</div>}
            <div className="speech-content">
              <ReactMarkdown
                components={{
                  h1: ({node, ...props}) => <h1 className="debate-heading-h1" {...props} />,
                  h2: ({node, ...props}) => <h2 className="debate-heading-h2" {...props} />,
                  h3: ({node, ...props}) => <h3 className="debate-heading-h3" {...props} />,
                  h4: ({node, ...props}) => <h4 className="debate-heading-h4" {...props} />,
                  p: ({node, ...props}) => <p className="debate-paragraph" {...props} />,
                  ul: ({node, ...props}) => <ul className="debate-list" {...props} />,
                  ol: ({node, ...props}) => <ol className="debate-numbered-list" {...props} />,
                  li: ({node, ...props}) => <li className="debate-list-item" {...props} />,
                  strong: ({node, ...props}) => <strong className="debate-strong" {...props} />,
                  em: ({node, ...props}) => <em className="debate-emphasis" {...props} />,
                  hr: ({node, ...props}) => <hr className="divider" {...props} />
                }}
              >
                {text}
              </ReactMarkdown>
            </div>
          </div>
        ))}
          {mode === "ai-vs-ai" && (
            <div style={{ marginTop: "1rem" }}>
              <button onClick={handleAIDebate} disabled={loading || round > maxRounds}>
                {loading
                  ? "Generating Response..."
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
                    {(firstSide === "con" && userSide === "pro") ||
                     (firstSide === "pro" && userSide === "con") ? (
                      <button onClick={handleUserVsAISubmitAndEnd} disabled={loading || !userInput.trim()} style={{ marginRight: "1rem" }}>
                        Send & End (No AI Reply)
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </>
          )}
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
                    style={{ width: "100%", resize: vertical }}
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
          {error && <p style={{ color: "red" }}>{error}</p>}
          {loading && !error && (
            <LoadingSpinner 
              message="Generating AI response" 
              showProgress={true}
              estimatedTime={45000}
            />
          )}
          <button
            onClick={() => handleEndDebate()}
            style={{ marginTop: "1rem" }}
            disabled={loading || messageList.length === 0}
          >
            End Debate
          </button>
        </div>
      </div>
    </div>
  );
}

export default Debate;