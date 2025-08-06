import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { useLocation, useNavigate } from "react-router-dom";
import { generateAIResponse } from "../api";
import { saveTranscriptToUser } from "../firebase/saveTranscript";
import LoadingSpinner from "./LoadingSpinner";
import DebateSidebar from "./DebateSidebar";
import SimpleFileUpload from "./SimpleFileUpload";
import VoiceInput from './VoiceInput';
import { Code, MessageSquare, Download, Share2, ArrowLeft, Volume2, VolumeX } from "lucide-react";
import "./Debate.css"; 

const modelOptions = [
  "openai/gpt-4o",
  "meta-llama/llama-3.3-70b-instruct",
  "google/gemini-2.0-flash-001",
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

  // Each message: { speaker: string, text: string, model?: string, round?: number }
  const [messageList, setMessageList] = useState([]);
  const [currentRound, setCurrentRound] = useState(1);
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
  const [autoMode, setAutoMode] = useState(false);
  const [autoTimer, setAutoTimer] = useState(null);

  // Handler for the back to home button
  const handleBackToHome = () => {
    navigate("/");
  };

  // Reset scroll position on component mount
  useEffect(() => {
    // Force scroll reset with slight delay to ensure it works after navigation
    const scrollTimer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, 0);
    
    return () => clearTimeout(scrollTimer);
  }, []);

  // Cleanup auto timer on unmount
  useEffect(() => {
    return () => {
      if (autoTimer) {
        clearTimeout(autoTimer);
      }
    };
  }, [autoTimer]);

  // Auto-continue when loading finishes in auto mode
  useEffect(() => {
    // Check if we should continue auto-generation
    // We want 5 complete rounds (10 total speeches: 5 Pro + 5 Con)
    const aiSpeeches = messageList.filter(m => m.speaker === "AI Debater Pro" || m.speaker === "AI Debater Con").length;
    const shouldContinue = aiSpeeches < (maxRounds * 2); // 10 speeches total for 5 rounds
    
    if (autoMode && !loading && messageList.length > 0 && shouldContinue) {
      // Clear any existing timer
      if (autoTimer) {
        clearTimeout(autoTimer);
      }
      
      const timer = setTimeout(() => {
        handleAIDebate();
      }, 3000); // 3 second delay for reading
      setAutoTimer(timer);
    } else if (autoMode && !shouldContinue) {
      // Auto-generation complete, stop auto mode
      setAutoMode(false);
    }
  }, [loading, autoMode, messageList.length]);

  const startAutoDebate = () => {
    setAutoMode(true);
    handleAIDebate();
  };

  const stopAutoDebate = () => {
    setAutoMode(false);
    if (autoTimer) {
      clearTimeout(autoTimer);
      setAutoTimer(null);
    }
  };

  // Append a new message object to messageList
  const appendMessage = (speaker, text, modelName = null) => {
    setMessageList(prev => [
      ...prev,
      { speaker, text: text.trim(), model: modelName, round: currentRound },
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
    console.log(`Attempting to scroll to speech: ${id}`);
    
    // Add a longer delay to ensure the DOM is fully updated
    setTimeout(() => {
      const el = document.getElementById(id);
      console.log(`Found element for ${id}:`, el);
      
      if (el) {
        // Ensure the element is visible and scrollable
        el.scrollIntoView({ 
          behavior: "smooth", 
          block: "start",
          inline: "nearest"
        });
        console.log(`Successfully scrolled to ${id}`);
        
        // Add a visual highlight to confirm the scroll worked
        el.style.backgroundColor = 'rgba(74, 144, 226, 0.1)';
        setTimeout(() => {
          el.style.backgroundColor = '';
        }, 2000);
      } else {
        console.warn(`Element with id ${id} not found`);
        // List all speech elements for debugging
        const allSpeechElements = document.querySelectorAll('[id^="speech-"]');
        console.log('Available speech elements:', Array.from(allSpeechElements).map(el => el.id));
        
        // Try to find the element by partial match
        const partialMatch = Array.from(allSpeechElements).find(el => el.id.includes(id.split('-')[1]));
        if (partialMatch) {
          console.log(`Found partial match: ${partialMatch.id}`);
          partialMatch.scrollIntoView({ 
            behavior: "smooth", 
            block: "start",
            inline: "nearest"
          });
        }
      }
    }, 200); // Increased delay to 200ms
  };

  // Update speechList whenever messageList changes
  useEffect(() => {
    const newSpeechList = messageList.map((msg, index) => {
      let title = msg.speaker;
      
      // Calculate round number more accurately
      const roundNum = msg.round || Math.ceil((index + 1) / 2);
      
      // Add round information for ALL speeches
      if (msg.speaker === "AI Debater Pro" || msg.speaker === "AI Debater Con") {
        title = `${msg.speaker} - Round ${roundNum}/5`;
      } else if (msg.speaker.includes("(AI)")) {
        // For User vs AI mode, add round info for AI responses
        title = `${msg.speaker} - Round ${roundNum}`;
      } else if (msg.speaker.includes("(User)")) {
        // For User vs AI mode, add round info for user responses
        title = `${msg.speaker} - Round ${roundNum}`;
      } else if (msg.speaker.includes("Pro (User)") || msg.speaker.includes("Con (User)")) {
        // For User vs User mode, add round info
        title = `${msg.speaker} - Round ${roundNum}`;
      } else if (msg.speaker.includes("Judge")) {
        // For judge feedback, don't add round number
        title = msg.speaker;
      } else {
        // For any other speaker, add round number
        title = `${msg.speaker} - Round ${roundNum}`;
      }
      
      const speechItem = {
        id: `speech-${index}`,
        title: title,
        speaker: msg.speaker,
        round: roundNum,
        index: index
      };
      
      // Debug logging
      console.log(`Speech ${index}:`, speechItem);
      
      return speechItem;
    });
    
    console.log('Updated speech list:', newSpeechList);
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
    // Check if we have completed all speeches (5 rounds = 10 speeches)
    const aiSpeeches = messageList.filter(m => m.speaker === "AI Debater Pro" || m.speaker === "AI Debater Con").length;
    if (aiSpeeches >= (maxRounds * 2)) return;
    setLoading(true);
    setError("");
    try {
      // Get the full debate transcript so far
      const fullTranscript = messageList
        .map(({ speaker, text, model }) => {
          const modelInfo = model ? `*Model: ${model}*\n\n` : "";
          return `## ${speaker}\n${modelInfo}${text}`;
        })
        .join("\n\n---\n\n");

      // Get last message text for immediate rebuttal
      const lastMessage = messageList.length > 0
        ? messageList[messageList.length - 1]
        : null;
      const lastArgument = lastMessage ? lastMessage.text : "";

      const truncatedDescription = description?.length > 3000
        ? `${description.substring(0, 3000)}... (bill text continues)`
        : description;

      let aiResponse;
      if (aiSide === "pro") {
        const isOpening = messageList.length === 0;
        const proPrompt = `
You are an AI debater in a 5-round public forum debate on: "${topic}"

BILL CONTEXT:
${truncatedDescription || "No specific bill context provided."}

FULL DEBATE TRANSCRIPT SO FAR:
${fullTranscript}

CURRENT ROUND: ${currentRound} of ${maxRounds}
YOUR ROLE: PRO (supporting the topic)

${isOpening ? 
  "This is your opening statement. Present a strong opening argument in favor of the topic." :
  `MANDATORY REBUTTAL: You must begin by directly addressing and rebutting specific points from the opponent's most recent argument: "${lastArgument}"
  
  Quote their exact words and explain why they are wrong or flawed. Then present your own arguments.`
}

CRITICAL FORMATTING INSTRUCTIONS:
- NEVER write "AI Debater Pro" or any speaker name in your response
- NEVER write "Round X/Y" or any round information in your response  
- NEVER include headers, titles, or speaker identification
- Start your response immediately with argument content (no preamble)
- Your response will be displayed under a header that already identifies you

CONTENT REQUIREMENTS:
${isOpening ? 
  "- Present a strong opening argument in favor of the topic" :
  "- MANDATORY: Begin by directly addressing and rebutting specific points from the opponent's argument above. Quote their exact words and explain why they are wrong."
}
- Present 2-3 strong arguments supporting the PRO position
- Use specific evidence, examples, or logical reasoning
- Keep your response concise (max 500 words)
- Be persuasive but respectful
- End with a strong concluding statement

IMPORTANT: If this is not the opening statement, you MUST include a rebuttal of the opponent's last argument before presenting your own points.
           `;
        aiResponse = await generateAIResponse("AI Debater Pro", proPrompt, proModel, actualDescription);
        // Remove any headers the AI might have generated (aggressive cleaning)
        let cleanedResponse = aiResponse
          .replace(/^AI Debater Pro.*?\n/gi, '')
          .replace(/^AI Debater Pro.*?–.*?\n/gi, '')
          .replace(/^AI Debater Pro.*?-.*?\n/gi, '')
          .replace(/^.*?Round \d+\/\d+.*?\n/gi, '')
          .replace(/^.*?Round.*?\n/gi, '')
          .trim();
        // If response starts with a number (like "1. "), it's likely clean
        if (!cleanedResponse.match(/^(\d+\.|[A-Z])/)) {
          cleanedResponse = aiResponse.split('\n').slice(1).join('\n').trim();
        }
        appendMessage("AI Debater Pro", cleanedResponse, proModel);
        setAiSide("con");
      } else {
        const isOpening = messageList.length === 0;
        const conPrompt = `
You are an AI debater in a 5-round public forum debate on: "${topic}"

BILL CONTEXT:
${truncatedDescription || "No specific bill context provided."}

FULL DEBATE TRANSCRIPT SO FAR:
${fullTranscript}

CURRENT ROUND: ${currentRound} of ${maxRounds}
YOUR ROLE: CON (opposing the topic)

${isOpening ? 
  "This is your opening statement. Present a strong opening argument against the topic." :
  `MANDATORY REBUTTAL: You must begin by directly addressing and rebutting specific points from the opponent's most recent argument: "${lastArgument}"
  
  Quote their exact words and explain why they are wrong or flawed. Then present your own arguments.`
}

CRITICAL FORMATTING INSTRUCTIONS:
- NEVER write "AI Debater Con" or any speaker name in your response
- NEVER write "Round X/Y" or any round information in your response  
- NEVER include headers, titles, or speaker identification
- Start your response immediately with argument content (no preamble)
- Your response will be displayed under a header that already identifies you

CONTENT REQUIREMENTS:
${isOpening ? 
  "- Present a strong opening argument against the topic" :
  "- MANDATORY: Begin by directly addressing and rebutting specific points from the opponent's argument above. Quote their exact words and explain why they are wrong."
}
- Present 2-3 strong arguments supporting the CON position
- Use specific evidence, examples, or logical reasoning
- Keep your response concise (max 500 words)
- Be persuasive but respectful
- End with a strong concluding statement

IMPORTANT: If this is not the opening statement, you MUST include a rebuttal of the opponent's last argument before presenting your own points.
           `;
        aiResponse = await generateAIResponse("AI Debater Con", conPrompt, conModel, actualDescription);
        // Remove any headers the AI might have generated (aggressive cleaning)
        let cleanedResponse = aiResponse
          .replace(/^AI Debater Con.*?\n/gi, '')
          .replace(/^AI Debater.*?Con.*?–.*?\n/gi, '')
          .replace(/^AI Debater.*?Con.*?-.*?\n/gi, '')
          .replace(/^.*?Round \d+\/\d+.*?\n/gi, '')
          .replace(/^.*?Round.*?\n/gi, '')
          .trim();
        // If response starts with a number (like "1. "), it's likely clean
        if (!cleanedResponse.match(/^(\d+\.|[A-Z])/)) {
          cleanedResponse = aiResponse.split('\n').slice(1).join('\n').trim();
        }
        appendMessage("AI Debater Con", cleanedResponse, conModel);
        setAiSide("pro");
        setCurrentRound(prev => prev + 1);
      }
    } catch (err) {
      console.error("Error in AI debate:", err);
      setError("Failed to generate AI response.");
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

      // Get the full debate transcript so far
      const fullTranscript = messageList
        .map(({ speaker, text, model }) => {
          const modelInfo = model ? `*Model: ${model}*\n\n` : "";
          return `## ${speaker}\n${modelInfo}${text}`;
        })
        .join("\n\n---\n\n");

      const truncatedDescription = description?.length > 3000
        ? `${description.substring(0, 3000)}... (bill text continues)`
        : description;

      const aiSideLocal = userSide === "pro" ? "Con" : "Pro";
      const isOpening = messageList.length === 0;

      const prompt = `
You are an AI debater in a public forum debate on: "${topic}"

BILL CONTEXT:
${truncatedDescription || "No specific bill context provided."}

FULL DEBATE TRANSCRIPT SO FAR:
${fullTranscript}

YOUR ROLE: ${aiSideLocal.toUpperCase()} (opposing the user's ${userSide.toUpperCase()} position)

${isOpening ? 
  "This is your opening statement. Present a strong opening argument against the topic." :
  `MANDATORY REBUTTAL: The user just argued for the ${userSide.toUpperCase()} side. You must begin by directly addressing and rebutting specific points from their argument: "${userInput}"
  
  Quote their exact words and explain why they are wrong or flawed. Then present your own arguments.`
}

CRITICAL FORMATTING INSTRUCTIONS:
- NEVER write "AI Debater" or any speaker name in your response
- NEVER include headers, titles, or speaker identification
- Start your response immediately with argument content (no preamble)
- Your response will be displayed under a header that already identifies you

CONTENT REQUIREMENTS:
${isOpening ? 
  "- Present a strong opening argument against the topic" :
  "- MANDATORY: Begin by directly addressing and rebutting specific points from the user's argument above. Quote their exact words and explain why they are wrong."
}
- Present 1-2 strong counterarguments supporting the ${aiSideLocal.toUpperCase()} position
- Use specific evidence, examples, or logical reasoning
- Keep your response concise (max 400 words)
- Be persuasive but respectful
- End with a strong concluding statement

IMPORTANT: If this is not the opening statement, you MUST include a rebuttal of the user's argument before presenting your own points.
         `;

      const aiResponse = await generateAIResponse(`AI Debater (${aiSideLocal})`, prompt, singleAIModel, actualDescription);
      appendMessage(`${aiSideLocal} (AI)`, aiResponse, singleAIModel);
      setCurrentRound(prev => prev + 1);
    } catch (err) {
      console.error("Error in User vs AI debate:", err);
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
      // Add the user's message to the messageList
      appendMessage(
        userSide === "pro" ? "Pro (User)" : "Con (User)",
        userInput
      );
      
      // Clear the input
      setUserInput("");
      setCurrentRound(prev => prev + 1);
      
      // Build transcript with the current messageList plus the new user message
      const userMessage = {
        speaker: userSide === "pro" ? "Pro (User)" : "Con (User)",
        text: userInput.trim(),
        round: currentRound
      };
      
      const finalTranscript = [...messageList, userMessage]
        .map(({ speaker, text, model }) => {
          const modelInfo = model ? `*Model: ${model}*\n\n` : "";
          return `## ${speaker}\n${modelInfo}${text}`;
        })
        .join("\n\n---\n\n");
      
      // Navigate to judge with the complete transcript
      navigate("/judge", { 
        state: { 
          transcript: finalTranscript, 
          topic, 
          mode: isBillDebate ? 'bill-debate' : actualMode, 
          judgeModel 
        } 
      });
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
          {/* This debate-model-selection div is now hidden in user-vs-user mode */}
          {actualMode !== "user-vs-user" && (
            <div className="debate-model-selection">
              {actualMode === "ai-vs-ai" && (
                <>
                  <label className="debate-model-label">
                    Pro Model:
                    <select className="debate-model-select" value={proModel} onChange={(e) => setProModel(e.target.value)}>
                      {modelOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="debate-model-label">
                    Con Model:
                    <select className="debate-model-select" value={conModel} onChange={(e) => setConModel(e.target.value)}>
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
                <label className="debate-model-label">
                  AI Model:
                  <select className="debate-model-select" value={singleAIModel} onChange={(e) => setSingleAIModel(e.target.value)}>
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="debate-model-label">
                Judge Model:
                <select className="debate-model-select" value={judgeModel} onChange={(e) => setJudgeModel(e.target.value)}>
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
        {messageList.map(({ speaker, text, model }, i) => {
          const speechItem = speechList[i];
          const speechTitle = speechItem?.title || speaker;
          const speechId = `speech-${i}`;
          
          return (
            <div key={i} className="debate-speech-block" id={speechId}>
              <h3 className="debate-speech-title">{speechTitle}</h3>
              {model && <div className="debate-model-info">Model: {model}</div>}
              <div className="debate-speech-content">
                <ReactMarkdown
                  components={{
                    h1: ({node, ...props}) => <h1 className="debate-markdown-h1" {...props} />,
                    h2: ({node, ...props}) => <h2 className="debate-markdown-h2" {...props} />,
                    h3: ({node, ...props}) => <h3 className="debate-markdown-h3" {...props} />,
                    h4: ({node, ...props}) => <h4 className="debate-markdown-h4" {...props} />,
                    p: ({node, ...props}) => <p className="debate-markdown-p" {...props} />,
                    ul: ({node, ...props}) => <ul className="debate-markdown-ul" {...props} />,
                    ol: ({node, ...props}) => <ol className="debate-markdown-ol" {...props} />,
                    li: ({node, ...props}) => <li className="debate-markdown-li" {...props} />,
                    strong: ({node, ...props}) => <strong className="debate-markdown-strong" {...props} />,
                    em: ({node, ...props}) => <em className="debate-markdown-em" {...props} />,
                    hr: ({node, ...props}) => <hr className="debate-markdown-hr" {...props} />
                  }}
                >
                  {text}
                </ReactMarkdown>
              </div>
            </div>
          );
        })}
          {actualMode === "ai-vs-ai" && (
            <div style={{ marginTop: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
              {!autoMode ? (
                <>
                  <button 
                    onClick={handleAIDebate} 
                    disabled={loading || (() => {
                      const aiSpeeches = messageList.filter(m => m.speaker === "AI Debater Pro" || m.speaker === "AI Debater Con").length;
                      return aiSpeeches >= (maxRounds * 2);
                    })()}
                    style={{
                      background: "#4a90e2",
                      color: "white",
                      border: "none",
                      padding: "0.75rem 1.5rem",
                      borderRadius: "6px",
                      cursor: loading || (() => {
                        const aiSpeeches = messageList.filter(m => m.speaker === "AI Debater Pro" || m.speaker === "AI Debater Con").length;
                        return aiSpeeches >= (maxRounds * 2);
                      })() ? "not-allowed" : "pointer",
                      opacity: loading || (() => {
                        const aiSpeeches = messageList.filter(m => m.speaker === "AI Debater Pro" || m.speaker === "AI Debater Con").length;
                        return aiSpeeches >= (maxRounds * 2);
                      })() ? 0.6 : 1
                    }}
                  >
                    {(() => {
                      const aiSpeeches = messageList.filter(m => m.speaker === "AI Debater Pro" || m.speaker === "AI Debater Con").length;
                      if (loading) return "Generating Response...";
                      if (aiSpeeches >= (maxRounds * 2)) return "All Rounds Complete";
                      return aiSide === "pro"
                        ? `Generate Pro Round ${currentRound}/${maxRounds}`
                        : `Generate Con Round ${currentRound}/${maxRounds}`;
                    })()}
                  </button>
                  <button 
                    onClick={startAutoDebate} 
                    disabled={loading || (() => {
                      const aiSpeeches = messageList.filter(m => m.speaker === "AI Debater Pro" || m.speaker === "AI Debater Con").length;
                      return aiSpeeches >= (maxRounds * 2);
                    })()}
                    style={{
                      background: "#28a745",
                      color: "white",
                      border: "none",
                      padding: "0.75rem 1.5rem",
                      borderRadius: "6px",
                      cursor: loading || (() => {
                        const aiSpeeches = messageList.filter(m => m.speaker === "AI Debater Pro" || m.speaker === "AI Debater Con").length;
                        return aiSpeeches >= (maxRounds * 2);
                      })() ? "not-allowed" : "pointer",
                      opacity: loading || (() => {
                        const aiSpeeches = messageList.filter(m => m.speaker === "AI Debater Pro" || m.speaker === "AI Debater Con").length;
                        return aiSpeeches >= (maxRounds * 2);
                      })() ? 0.6 : 1
                    }}
                  >
                    🚀 Auto-Generate All Rounds
                  </button>
                </>
              ) : (
                <button 
                  onClick={stopAutoDebate}
                  style={{
                    background: "#dc3545",
                    color: "white",
                    border: "none",
                    padding: "0.75rem 1.5rem",
                    borderRadius: "6px",
                    cursor: "pointer"
                  }}
                >
                  ⏸️ Stop Auto-Generation
                </button>
              )}
            </div>
          )}
          {actualMode === "ai-vs-user" && (
            <>
              {!userSide && (
                <div className="ai-vs-user-setup">
                  <h3>Setup Your Debate</h3>
                  <p style={{ color: '#fff' }}>Choose your SIDE and SPEAKING ORDER</p>
                  <div className="side-selection-cards">
                    <div 
                      className={`side-card ${selectedSide === 'pro' ? 'selected' : ''}`}
                      onClick={() => setSelectedSide("pro")}
                    >
                      <h4>Argue PRO</h4>
                      <p>Support the topic</p>
                      <p className="speaking-order">
                        You will go {firstSide === 'pro' ? 'FIRST' : 'SECOND'}
                      </p>
                    </div>
                    
                    <div 
                      className={`side-card ${selectedSide === 'con' ? 'selected' : ''}`}
                      onClick={() => setSelectedSide("con")}
                    >
                      <h4>Argue CON</h4>
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
                  
                  <div className="debate-model-selection" style={{ marginBottom: "1rem" }}>
                    <label className="debate-model-label">
                      AI Opponent Model:
                      <select className="debate-model-select" value={singleAIModel} onChange={(e) => setSingleAIModel(e.target.value)}>
                        {modelOptions.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  
                  <SimpleFileUpload 
                    onTextExtracted={(text) => setUserInput(text)}
                    disabled={loading}
                  />
                  
                  <VoiceInput 
                    onTranscript={(text) => setUserInput(text)}
                    disabled={loading}
                    placeholder={`Speak your ${userSide === "pro" ? "Pro" : "Con"} argument`}
                  />
                  
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
                  
                  <div className="debate-model-selection" style={{ marginBottom: "1.5rem" }}>
                    <label className="debate-model-label">
                      Judge Model:
                      <select className="debate-model-select" value={judgeModel} onChange={(e) => setJudgeModel(e.target.value)}>
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
                  <p style={{ marginBottom: "1rem", color: "#fff" }}>
                    Current turn: <strong>
                      {userVsUserSide === "pro" ? userVsUserSetup.proUser : userVsUserSetup.conUser}
                    </strong> ({userVsUserSide.toUpperCase()})
                  </p>
                  
                  <SimpleFileUpload 
                    onTextExtracted={(text) => setUserInput(text)}
                    disabled={loading}
                  />
                  
                  <VoiceInput 
                    onTranscript={(text) => setUserInput(text)}
                    disabled={loading}
                    placeholder={`Speak your ${userVsUserSide === "pro" ? "Pro" : "Con"} argument`}
                  />
                  
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
      
      <footer className="bottom-text">
        <div className="footer-links">
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSf_bXEj_AJSyY17WA779h-ESk4om3QmPFT4sdyce7wcnwBr7Q/viewform?usp=sharing&ouid=109634392449391866526"
            target="_blank"
            rel="noopener noreferrer"
            className="feedback-link"
          >
            <MessageSquare size={16} />
            Give Feedback
          </a>
          <a
            href="https://github.com/alexliao95311/DebateSim"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
          >
            <Code size={16} />
            GitHub
          </a>
        </div>
        <span className="copyright">&copy; {new Date().getFullYear()} DebateSim. All rights reserved.</span>
      </footer>
    </div>
  );
}

export default Debate;