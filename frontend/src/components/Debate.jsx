import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { useLocation, useNavigate } from "react-router-dom";
import { generateAIResponse } from "../api";
import { saveTranscriptToUser } from "../firebase/saveTranscript";
import LoadingSpinner from "./LoadingSpinner";
import DebateSidebar from "./DebateSidebar";
import "./Debate.css"; 

const modelOptions = [
  "openai/gpt-4o",
  "meta-llama/llama-3.3-70b-instruct",
  "google/gemini-2.0-flash-001",
  "deepseek/deepseek-r1-0528:free",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o-mini",
  "openai/gpt-4o-mini-search-preview"
];

function sanitizeUserInput(str) {
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function Debate() {
  // Retrieve debate parameters: short topic (bill name) and full description.
  const { mode, debateMode, topic, description, billText, billTitle, selectedModel } = useLocation().state || {};
  const navigate = useNavigate();
  
  // For bill debates, use billText as description if available
  // Truncate very large bill texts on frontend to prevent API errors
  let actualDescription = billText || description;
  if (actualDescription && actualDescription.length > 100000) {
    console.log(`Bill text very long (${actualDescription.length} chars), truncating for API safety`);
    actualDescription = actualDescription.substring(0, 90000) + "\n\n[NOTE: Bill text truncated due to length. Key sections preserved for debate context.]";
  }
  
  // Debug logging
  console.log('Debate component received:', { 
    mode, 
    debateMode, 
    topic, 
    billText: billText ? `${billText.length} chars` : 'none',
    billTitle,
    description: description ? `${description.length} chars` : 'none'
  });
  
  // Handle both old format (direct mode) and new format (bill-debate with debateMode)
  const actualMode = mode === 'bill-debate' ? debateMode : mode;
  const isBillDebate = mode === 'bill-debate';
  
  if (!actualMode || !topic) {
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
  const [userVsUserSetup, setUserVsUserSetup] = useState({
    proUser: "",
    conUser: "",
    firstSpeaker: "pro",
    confirmed: false
  });
  const [firstSide, setFirstSide] = useState("pro");
  const [selectedSide, setSelectedSide] = useState(""); // For confirmation step

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
      if (actualMode === "ai-vs-ai" && (msg.speaker === "AI Debater Pro" || msg.speaker === "AI Debater Con")) {
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
  }, [messageList, actualMode]);

  // Removed automatic bill description addition to messageList to prevent duplication
  // The bill description is now only shown in the toggle section

  const handleEndDebate = async () => {
    setLoading(true);
    setError("");
    try {
      const finalTranscript = buildPlainTranscript();
      navigate("/judge", { state: { transcript: finalTranscript, topic, mode: isBillDebate ? 'bill-debate' : actualMode, judgeModel } });
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
        aiResponse = await generateAIResponse("AI Debater Pro", proPrompt, proModel, actualDescription);
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
        aiResponse = await generateAIResponse("AI Debater (Con)", conPrompt, conModel, actualDescription);
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
        const conResponse = await generateAIResponse("AI Debater (Con)", conPrompt, singleAIModel, actualDescription);
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
        const proResponse = await generateAIResponse("AI Debater (Pro)", proPrompt, singleAIModel, actualDescription);
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

      const aiResponse = await generateAIResponse(`AI Debater (${aiSideLocal})`, prompt, singleAIModel, actualDescription);
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
    
    const currentUserName = userVsUserSide === "pro" ? userVsUserSetup.proUser : userVsUserSetup.conUser;
    const speakerLabel = `${userVsUserSide.toUpperCase()} (${currentUserName})`;
    
    appendMessage(speakerLabel, userInput.trim());
    setUserInput("");
    setError("");
    
    // Switch turns
    setUserVsUserSide(userVsUserSide === "pro" ? "con" : "pro");
  };

  const handleChooseUserVsUserSide = (side) => {
    setUserVsUserSide(side);
  };

  const handleUserVsUserConfirm = () => {
    if (!userVsUserSetup.proUser.trim() || !userVsUserSetup.conUser.trim()) {
      setError("Please enter names for both Pro and Con debaters.");
      return;
    }
    setUserVsUserSetup(prev => ({ ...prev, confirmed: true }));
    setUserVsUserSide(userVsUserSetup.firstSpeaker);
    setError("");
  };

  return (
    <div className={`debate-container ${sidebarExpanded ? 'sidebar-open' : ''}`}>
      {/* Back to Home button in the top right corner */}
      <button className="back-to-home" onClick={handleBackToHome}>
        Back to Home
      </button>

      <DebateSidebar 
        sidebarExpanded={sidebarExpanded}
        setSidebarExpanded={setSidebarExpanded}
        speechList={speechList}
        scrollToSpeech={scrollToSpeech}
      />
      <div className="debate-wrapper">
        <div className="debate-content">
          <div className="topic-header-section">
            <h2 className="debate-topic-header">Debate Topic: {topic}</h2>
            {actualDescription && (
              <button
                className="toggle-description"
                onClick={() => setDescriptionExpanded(!descriptionExpanded)}
              >
                {descriptionExpanded ? "Hide Bill Text" : "Show Bill Text"}
              </button>
            )}
          </div>
          {actualDescription && descriptionExpanded && (
            <div className="bill-description">
              <div className="description-content scrollable">
                <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                  {actualDescription}
                </ReactMarkdown>
              </div>
            </div>
          )}
          {/* This model-selection div is now hidden in user-vs-user mode */}
          {actualMode !== "user-vs-user" && (
            <div className="model-selection">
              {actualMode === "ai-vs-ai" && (
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
              {actualMode === "ai-vs-user" && (
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
            </div>
          )}
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
          {actualMode === "ai-vs-ai" && (
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
          {actualMode === "ai-vs-user" && (
            <>
              {!userSide && (
                <div className="ai-vs-user-setup">
                  <h3>Setup Your Debate</h3>
                  
                  <div className="side-selection-cards">
                    <div 
                      className={`side-card ${selectedSide === 'pro' ? 'selected' : ''}`}
                      onClick={() => setSelectedSide("pro")}
                    >
                      <h4>🟢 Argue PRO</h4>
                      <p>Support the topic</p>
                      <p className="speaking-order">
                        You will go {firstSide === 'pro' ? 'FIRST' : 'SECOND'}
                      </p>
                    </div>
                    
                    <div 
                      className={`side-card ${selectedSide === 'con' ? 'selected' : ''}`}
                      onClick={() => setSelectedSide("con")}
                    >
                      <h4>🔴 Argue CON</h4>
                      <p>Oppose the topic</p>
                      <p className="speaking-order">
                        You will go {firstSide === 'con' ? 'FIRST' : 'SECOND'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="order-selection">
                    <label>Speaking Order</label>
                    <div className="order-buttons">
                      <button 
                        className={`order-button ${firstSide === 'pro' ? 'selected' : ''}`}
                        onClick={() => setFirstSide('pro')}
                      >
                        PRO speaks first
                      </button>
                      <button 
                        className={`order-button ${firstSide === 'con' ? 'selected' : ''}`}
                        onClick={() => setFirstSide('con')}
                      >
                        CON speaks first
                      </button>
                    </div>
                  </div>
                  
                  <div className="confirm-section">
                    <button 
                      className="confirm-button"
                      disabled={!selectedSide}
                      onClick={() => handleChooseSide(selectedSide)}
                    >
                      {selectedSide ? `Start Debate as ${selectedSide.toUpperCase()}` : 'Select your position first'}
                    </button>
                  </div>
                </div>
              )}
              {userSide && (
                <div className="ai-vs-user-setup">
                  <h3>Debate as {userSide.toUpperCase()} vs AI</h3>
                  
                  <div className="model-selection" style={{ marginBottom: "1rem" }}>
                    <label>
                      AI Opponent Model:
                      <select value={singleAIModel} onChange={(e) => setSingleAIModel(e.target.value)}>
                        {modelOptions.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  
                  <textarea
                    placeholder={`Enter your ${userSide === "pro" ? "Pro" : "Con"} argument`}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    rows={4}
                    style={{ width: "100%", resize: "vertical", marginBottom: "1rem" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !loading && userInput.trim().length > 0) {
                        e.preventDefault();
                        handleUserVsAISubmit();
                      }
                    }}
                  />
                  
                  <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
                    <button 
                      onClick={handleUserVsAISubmit} 
                      disabled={loading || !userInput.trim()}
                      style={{
                        background: "#4a90e2",
                        color: "white",
                        border: "none",
                        padding: "0.75rem 1.5rem",
                        borderRadius: "6px",
                        cursor: loading || !userInput.trim() ? "not-allowed" : "pointer",
                        opacity: loading || !userInput.trim() ? 0.6 : 1
                      }}
                    >
                      {loading ? "Generating Response..." : "Send & Get AI Reply"}
                    </button>
                    
                    {(firstSide === "con" && userSide === "pro") ||
                     (firstSide === "pro" && userSide === "con") ? (
                      <button 
                        onClick={handleUserVsAISubmitAndEnd} 
                        disabled={loading || !userInput.trim()}
                        style={{
                          background: "#6c757d",
                          color: "white",
                          border: "none",
                          padding: "0.75rem 1.5rem",
                          borderRadius: "6px",
                          cursor: loading || !userInput.trim() ? "not-allowed" : "pointer",
                          opacity: loading || !userInput.trim() ? 0.6 : 1
                        }}
                      >
                        Send & End (No AI Reply)
                      </button>
                    ) : null}
                    
                  </div>
                </div>
              )}
            </>
          )}
          {actualMode === "user-vs-user" && (
            <>
              {!userVsUserSetup.confirmed && (
                <div className="ai-vs-user-setup">
                  <h3>Setup User vs User Debate</h3>
                  
                  <div className="user-name-inputs">
                    <div className="name-input-group">
                      <label>Pro Debater Name:</label>
                      <input
                        type="text"
                        placeholder="Enter Pro debater's name"
                        value={userVsUserSetup.proUser}
                        onChange={(e) => setUserVsUserSetup(prev => ({ ...prev, proUser: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          borderRadius: "6px",
                          border: "2px solid #e0e7ee",
                          fontSize: "1rem",
                          marginBottom: "1rem"
                        }}
                      />
                    </div>
                    
                    <div className="name-input-group">
                      <label>Con Debater Name:</label>
                      <input
                        type="text"
                        placeholder="Enter Con debater's name"
                        value={userVsUserSetup.conUser}
                        onChange={(e) => setUserVsUserSetup(prev => ({ ...prev, conUser: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          borderRadius: "6px",
                          border: "2px solid #e0e7ee",
                          fontSize: "1rem",
                          marginBottom: "1rem"
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="order-selection">
                    <label>Who speaks first?</label>
                    <div className="order-buttons">
                      <button 
                        className={`order-button ${userVsUserSetup.firstSpeaker === 'pro' ? 'selected' : ''}`}
                        onClick={() => setUserVsUserSetup(prev => ({ ...prev, firstSpeaker: 'pro' }))}
                      >
                        {userVsUserSetup.proUser || 'Pro'} speaks first
                      </button>
                      <button 
                        className={`order-button ${userVsUserSetup.firstSpeaker === 'con' ? 'selected' : ''}`}
                        onClick={() => setUserVsUserSetup(prev => ({ ...prev, firstSpeaker: 'con' }))}
                      >
                        {userVsUserSetup.conUser || 'Con'} speaks first
                      </button>
                    </div>
                  </div>
                  
                  <div className="model-selection" style={{ marginBottom: "1.5rem" }}>
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
                  </div>
                  
                  <div className="confirm-section">
                    <button 
                      className="confirm-button"
                      disabled={!userVsUserSetup.proUser.trim() || !userVsUserSetup.conUser.trim()}
                      onClick={handleUserVsUserConfirm}
                    >
                      {userVsUserSetup.proUser.trim() && userVsUserSetup.conUser.trim() 
                        ? 'Start Debate' 
                        : 'Enter both debater names first'
                      }
                    </button>
                  </div>
                </div>
              )}
              
              {userVsUserSetup.confirmed && (
                <div className="user-vs-user-setup">
                  <h3>User vs User Debate</h3>
                  <p style={{ marginBottom: "1rem", color: "#666" }}>
                    Current turn: <strong>
                      {userVsUserSide === "pro" ? userVsUserSetup.proUser : userVsUserSetup.conUser}
                    </strong> ({userVsUserSide.toUpperCase()})
                  </p>
                  <textarea
                    placeholder={`Enter your ${userVsUserSide === "pro" ? "Pro" : "Con"} argument`}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    rows={4}
                    style={{ 
                      width: "100%", 
                      resize: "vertical", 
                      marginBottom: "1rem",
                      padding: "0.75rem",
                      borderRadius: "6px",
                      border: "2px solid #e0e7ee",
                      fontSize: "1rem"
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !loading && userInput.trim().length > 0) {
                        e.preventDefault();
                        handleUserVsUser();
                      }
                    }}
                  />
                  
                  <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
                    <button 
                      onClick={handleUserVsUser} 
                      disabled={loading || !userInput.trim()}
                      style={{
                        background: "#4a90e2",
                        color: "white",
                        border: "none",
                        padding: "0.75rem 1.5rem",
                        borderRadius: "6px",
                        cursor: loading || !userInput.trim() ? "not-allowed" : "pointer",
                        opacity: loading || !userInput.trim() ? 0.6 : 1,
                        fontSize: "1rem"
                      }}
                    >
                      Send as {userVsUserSide === "pro" ? userVsUserSetup.proUser : userVsUserSetup.conUser}
                    </button>
                    
                    <button 
                      onClick={() => setUserVsUserSetup(prev => ({ ...prev, confirmed: false }))}
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        color: "white",
                        border: "1px solid #4a90e2",
                        padding: "0.75rem 1.5rem",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "1rem"
                      }}
                    >
                      Restart Setup
                    </button>
                  </div>
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
          <div className="end-debate-section">
            <button
              className="end-debate-btn"
              onClick={() => handleEndDebate()}
              disabled={loading || messageList.length === 0}
            >
              End Debate & Get Judgment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Debate;