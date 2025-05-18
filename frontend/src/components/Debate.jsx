import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { useLocation, useNavigate } from "react-router-dom";
import { generateAIResponse } from "../api";
import { saveTranscriptToUser } from "../firebase/saveTranscript";
import "./Debate.css"; 

const modelOptions = [
  "deepseek/deepseek-prover-v2:free", 
  "meta-llama/llama-3-8b-instruct:free", 
  "google/gemini-2.0-flash-exp:free",
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

  // Use separate states for the full transcript (for saving and AI prompts)
  // and the visible transcript (for display).
  const [fullTranscript, setFullTranscript] = useState("");
  const [displayTranscript, setDisplayTranscript] = useState("");
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

  // Helper: Append a divider if needed.
  const appendDivider = (current) =>
    current.trim() !== "" ? current + "\n<hr class='divider' />\n" : current;

  // addSpeechBlock creates a new speech block and updates the speechList.
  // Note: We add every block to the speechList, but we'll filter out "Bill Description" in the sidebar.
  const addSpeechBlock = (title, content, modelName) => {
    const newId = `speech-${Date.now()}-${Math.random()}`;
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
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // On mount, add the Bill Description to the full transcript only.
  useEffect(() => {
    if (description && fullTranscript.trim() === "") {
      const initialBlock = addSpeechBlock("Bill Description", description, null);
      setFullTranscript(initialBlock);
      // Do not update displayTranscript so the bill description stays hidden.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description]);

  // End Debate: Save fullTranscript (which includes the bill description) and navigate.
  const handleEndDebate = async (finalTranscript = fullTranscript) => {
    setLoading(true);
    setError("");
    try {
      await saveTranscriptToUser(finalTranscript);
      navigate("/judge", { state: { transcript: finalTranscript, topic, mode, judgeModel } });
    } catch (err) {
      console.error("Error saving transcript:", err);
      setError("Failed to save transcript.");
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
      let newFull = fullTranscript.trim();
      let newDisplay = displayTranscript.trim();
      
      // Get the entire previous speech block instead of just the last line
      const lastSpeechMatch = newDisplay.match(/<div id="[^"]*" class="speech-block">[\s\S]*?<\/div>/);
      const lastArgument = lastSpeechMatch ? lastSpeechMatch[0] : "";
      
      // Limit the size of the bill description by summarizing if it's too long
      const truncatedDescription = description?.length > 3000 ? 
        `${description.substring(0, 3000)}... (bill text continues)` : 
        description;
      
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
        
        const proResponse = await generateAIResponse("AI Debater (Pro)", proPrompt, proModel);
        const block = addSpeechBlock(`AI Debater (Pro) - Round ${round}/${maxRounds}`, proResponse, proModel);
        newFull = appendDivider(newFull) + block;
        newDisplay = appendDivider(newDisplay) + block;
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
        
        const conResponse = await generateAIResponse("AI Debater (Con)", conPrompt, conModel);
        const block = addSpeechBlock(`AI Debater (Con) - Round ${round}/${maxRounds}`, conResponse, conModel);
        newFull = appendDivider(newFull) + block;
        newDisplay = appendDivider(newDisplay) + block;
        setAiSide("pro");
        setRound((prev) => prev + 1);
        if (round === maxRounds) {
          await handleEndDebate(newFull);
          return;
        }
      }
      setFullTranscript(newFull);
      setDisplayTranscript(newDisplay);
    } catch (err) {
      setError("Failed to fetch AI response for AI vs AI mode.");
    } finally {
      setLoading(false);
    }
  };

  // Update handleChooseSide
  const handleChooseSide = async (side) => {
    setUserSide(side);
    setError("");
    
    // Limit the size of the bill description by summarizing if it's too long
    const truncatedDescription = description?.length > 3000 ? 
      `${description.substring(0, 3000)}... (bill text continues)` : 
      description;
    
    if (firstSide === "con" && side === "pro") {
      setLoading(true);
      try {
        let newFull = fullTranscript;
        let newDisplay = displayTranscript;
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
        const block = addSpeechBlock("Con (AI)", conResponse, singleAIModel);
        newFull = appendDivider(newFull) + block;
        newDisplay = appendDivider(newDisplay) + block;
        setFullTranscript(newFull);
        setDisplayTranscript(newDisplay);
      } catch (err) {
        setError("Failed to fetch AI's Con opening argument.");
      } finally {
        setLoading(false);
      }
    } else if (firstSide === "pro" && side === "con") {
      setLoading(true);
      try {
        let newFull = fullTranscript;
        let newDisplay = displayTranscript;
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
        const block = addSpeechBlock("Pro (AI)", proResponse, singleAIModel);
        newFull = appendDivider(newFull) + block;
        newDisplay = appendDivider(newDisplay) + block;
        setFullTranscript(newFull);
        setDisplayTranscript(newDisplay);
      } catch (err) {
        setError("Failed to fetch AI's Pro opening argument.");
      } finally {
        setLoading(false);
      }
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
      let newFull = fullTranscript;
      let newDisplay = displayTranscript;
      const userLabel = userSide === "pro" ? "Pro (User)" : "Con (User)";
      const block = addSpeechBlock(userLabel, userInput);
      newFull = appendDivider(newFull) + block;
      newDisplay = appendDivider(newDisplay) + block;
      setFullTranscript(newFull);
      setDisplayTranscript(newDisplay);
      setUserInput("");
      setRound((prev) => prev + 1);
      
      // Limit the size of the bill description
      const truncatedDescription = description?.length > 3000 ? 
        `${description.substring(0, 3000)}... (bill text continues)` : 
        description;
      
      const aiSideLocal = userSide === "pro" ? "Con" : "Pro";
      
      // Get the full debate context (last 3 exchanges maximum)
      const lastExchanges = newDisplay.split("<hr class='divider' />").slice(-3).join("\n");
      
      const prompt = `
        Debate topic: "${topic}"
        Bill description: "${truncatedDescription}"
        Recent exchanges: 
        ${lastExchanges}
        
        The user just argued for the ${userSide.toUpperCase()} side.
        
        Instructions:
        1. You are on the ${aiSideLocal.toUpperCase()} side
        2. Directly rebut the user's key points
        3. Present 1-2 strong counterarguments
        4. Keep your response concise (max 400 words)
        5. Be persuasive but respectful
      `;
      
      const aiResponse = await generateAIResponse(`AI Debater (${aiSideLocal})`, prompt, singleAIModel);
      const block2 = addSpeechBlock(`${aiSideLocal} (AI)`, aiResponse, singleAIModel);
      newFull = appendDivider(newFull) + block2;
      newDisplay = appendDivider(newDisplay) + block2;
      setFullTranscript(newFull);
      setDisplayTranscript(newDisplay);
      setRound((prev) => prev + 1);
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
      let newFull = fullTranscript;
      let newDisplay = displayTranscript;
      const userLabel = userSide === "pro" ? "Pro (User)" : "Con (User)";
      const block = addSpeechBlock(userLabel, userInput);
      newFull = appendDivider(newFull) + block;
      newDisplay = appendDivider(newDisplay) + block;
      setFullTranscript(newFull);
      setDisplayTranscript(newDisplay);
      setUserInput("");
      setRound((prev) => prev + 1);
      await handleEndDebate(newFull);
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
    let newFull = fullTranscript;
    let newDisplay = displayTranscript;
    const block = addSpeechBlock("User vs User", userInput.trim());
    newFull = appendDivider(newFull) + block;
    newDisplay = appendDivider(newDisplay) + block;
    setFullTranscript(newFull);
    setDisplayTranscript(newDisplay);
    setUserInput("");
    setError("");
  };

  const handleChooseUserVsUserSide = (side) => {
    setUserVsUserSide(side);
  };

  return (
    <div className="debate-container">
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
          <ReactMarkdown rehypePlugins={[rehypeRaw]} className="markdown-renderer">
            {displayTranscript}
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
          {error && <p style={{ color: "red" }}>{error}</p>}
          {loading && !error && <p>Loading AI response...</p>}
          <button
            onClick={() => handleEndDebate()}
            style={{ marginTop: "1rem" }}
            disabled={loading || fullTranscript.trim().length === 0}
          >
            End Debate
          </button>
        </div>
      </div>
    </div>
  );
}

export default Debate;