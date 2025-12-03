import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { useNavigate } from "react-router-dom";
import UserDropdown from "./UserDropdown";
import Footer from "./Footer.jsx";
import VoiceInput from "./VoiceInput";
import { analyzeSpeechEfficiency, generateAIResponse } from "../api";
import { Bot, UserCheck, Users, Award, ChevronRight, ArrowLeft } from "lucide-react";
import { useTranslation } from "../utils/translations";
import languagePreferenceService from "../services/languagePreferenceService";
import "./debatetrainer.css";

// Helper function to get language instructions for prompts
function getLanguageInstructions(languageCode) {
  if (languageCode === 'zh') {
    return `
**LANGUAGE REQUIREMENT:**
- You MUST respond entirely in Mandarin Chinese (中文).
- All your debate arguments, rebuttals, and responses must be written in Chinese.
- Use proper Chinese grammar, vocabulary, and sentence structure.
- Maintain the same debate quality and argumentation standards as you would in English.
- If you reference English terms or proper nouns, you may include them in parentheses for clarity, but the main content must be in Chinese.
`;
  }
  return ''; // No language instructions needed for English
}

function DebateTrainer({ user, onLogout }) {
  const navigate = useNavigate();
  const { t, currentLanguage } = useTranslation();
  // Setup state
  const [mode, setMode] = useState(""); // "ai-vs-user" or "user-vs-user"
  const [debateFormat, setDebateFormat] = useState(""); // "public-forum"
  const [debateTopic, setDebateTopic] = useState("");
  const [topicConfirmed, setTopicConfirmed] = useState(false); // Track if topic step is complete
  const [userSide, setUserSide] = useState(""); // "pro" or "con"
  const [pfSpeakingOrder, setPfSpeakingOrder] = useState(""); // "pro-first" or "con-first"
  const [setupComplete, setSetupComplete] = useState(false);

  // Debate state
  const [messageList, setMessageList] = useState([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [currentSpeechText, setCurrentSpeechText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedbackList, setFeedbackList] = useState([]); // Array of all feedbacks
  const [gettingFeedback, setGettingFeedback] = useState(false);

  // Refs for scrolling
  const speechRefs = useRef([]);
  const feedbackRefs = useRef([]);
  
  // Sidebar state
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  // Use useMemo to recalculate modes and formats when language changes
  const modes = React.useMemo(() => [
    {
      id: "ai-vs-user",
      title: t('trainer.mode.aiVsUser.title'),
      description: t('trainer.mode.aiVsUser.description'),
      icon: <UserCheck size={48} />,
      tags: [t('trainer.mode.tags.practice'), t('trainer.mode.tags.feedback')],
      color: "from-green-500 to-teal-600"
    },
    {
      id: "user-vs-user",
      title: t('trainer.mode.userVsUser.title'),
      description: t('trainer.mode.userVsUser.description'),
      icon: <Users size={48} />,
      tags: [t('trainer.mode.tags.collaborative'), t('trainer.mode.tags.feedback')],
      color: "from-orange-500 to-red-600"
    }
  ], [currentLanguage]); // Only depend on currentLanguage, t is derived from it

  const formats = React.useMemo(() => [
    {
      id: "public-forum",
      title: t('trainer.format.publicForum.title'),
      description: t('trainer.format.publicForum.description'),
      icon: <Award size={48} />,
      tags: [t('trainer.format.tags.rounds'), t('trainer.format.tags.structured')],
      color: "from-emerald-500 to-green-600"
    }
  ], [currentLanguage]); // Only depend on currentLanguage, t is derived from it

  // Get current speech type for Public Forum
  const getCurrentSpeechType = (speechNum) => {
    if (debateFormat !== "public-forum") return "";
    if (speechNum <= 2) return t('trainer.constructive');
    if (speechNum <= 4) return t('trainer.rebuttal');
    if (speechNum <= 6) return t('trainer.summary');
    return t('trainer.finalFocus');
  };

  // Get current round number
  const getCurrentRoundNumber = () => {
    if (debateFormat === "public-forum") {
      return Math.ceil((messageList.length + 1) / 2);
    }
    return currentRound;
  };

  // Check if debate is complete
  const isDebateComplete = () => {
    if (debateFormat === "public-forum") {
      return messageList.length >= 8; // 4 rounds * 2 speakers
    }
    return false;
  };

  // Create speech list for sidebar (similar to Debate.jsx format)
  const speechList = messageList.map((msg, idx) => ({
    id: `speech-${idx}`,
    title: `${msg.speaker === "Pro" ? t('trainer.pro') : t('trainer.con')} - ${t('trainer.round')} ${msg.round} • ${msg.speechType || t('trainer.constructive')}`
  }));

  // Scroll to a specific speech (adapted for 2 scrollable divs)
  const scrollToSpeech = (id) => {
    // Extract index from id (format: "speech-0", "speech-1", etc.)
    const index = parseInt(id.replace("speech-", ""));
    const msg = messageList[index];
    if (!msg) return;

    // Scroll to speech in transcript panel
    setTimeout(() => {
      if (speechRefs.current[index]) {
        // Get the scrollable container (trainer-transcript)
        const transcriptContainer = speechRefs.current[index].closest('.trainer-transcript');
        if (transcriptContainer) {
          // Calculate position relative to the scrollable container
          const elementRect = speechRefs.current[index].getBoundingClientRect();
          const containerRect = transcriptContainer.getBoundingClientRect();
          const scrollPosition = transcriptContainer.scrollTop + (elementRect.top - containerRect.top);
          
          // Scroll to the top of the element (header)
          transcriptContainer.scrollTo({
            top: scrollPosition,
            behavior: "smooth"
          });
        } else {
          // Fallback to scrollIntoView if container not found
          speechRefs.current[index].scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }

      // Check if this is a user speech (has feedback)
      const isUserSpeech = mode === "user-vs-user" || 
        (mode === "ai-vs-user" && msg.speaker === (userSide === "pro" ? "Pro" : "Con"));
      
      // Find corresponding feedback index
      if (isUserSpeech) {
        // Find feedback that matches this speech by speaker, round, and speechType
        const feedbackIndex = feedbackList.findIndex(fb => 
          fb.speaker === msg.speaker && 
          fb.round === msg.round && 
          fb.speechType === msg.speechType
        );
        if (feedbackIndex !== -1 && feedbackRefs.current[feedbackIndex]) {
          // Get the scrollable container (trainer-feedback-content)
          const feedbackContainer = feedbackRefs.current[feedbackIndex].closest('.trainer-feedback-content');
          if (feedbackContainer) {
            // Calculate position relative to the scrollable container
            const elementRect = feedbackRefs.current[feedbackIndex].getBoundingClientRect();
            const containerRect = feedbackContainer.getBoundingClientRect();
            const scrollPosition = feedbackContainer.scrollTop + (elementRect.top - containerRect.top);
            
            // Scroll to the top of the feedback element (header)
            feedbackContainer.scrollTo({
              top: scrollPosition,
              behavior: "smooth"
            });
          } else {
            // Fallback to scrollIntoView if container not found
            feedbackRefs.current[feedbackIndex].scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      }
    }, 100);
  };

  // Handle voice input
  const handleVoiceFinalChunk = (chunk) => {
    setCurrentSpeechText((prev) => (prev ? prev + " " : "") + chunk);
  };

  // Get feedback on a speech
  const getSpeechFeedback = async (speechText, roundNum, speechType, speechNumber) => {
    if (!speechText.trim()) return null;
    setGettingFeedback(true);
    try {
      const model = "openai/gpt-4o-mini";
      const out = await analyzeSpeechEfficiency(speechText, { 
        model,
        debate_format: debateFormat,
        round_num: roundNum,
        speech_type: speechType,
        speech_number: speechNumber
      });
      return out || "";
    } catch (e) {
      console.error("[Trainer] Feedback error:", e);
      return null;
    } finally {
      setGettingFeedback(false);
    }
  };

  // Submit user speech - simplified logic
  const handleSubmitSpeech = async () => {
    if (!currentSpeechText.trim() || loading || isDebateComplete()) return;

    const speechText = currentSpeechText.trim();
    setLoading(true);
    setError("");

    try {
      // Determine speaker and speech number
      const nextSpeechNumber = messageList.length + 1;
      let speaker;
      
      if (mode === "user-vs-user") {
        // Alternate based on speaking order
        const isProTurn = (pfSpeakingOrder === "pro-first")
          ? (nextSpeechNumber % 2 === 1)
          : (nextSpeechNumber % 2 === 0);
        speaker = isProTurn ? "Pro" : "Con";
      } else {
        // AI vs User - use selected side
        speaker = userSide === "pro" ? "Pro" : "Con";
      }
      
      const roundNum = getCurrentRoundNumber();
      const speechType = getCurrentSpeechType(nextSpeechNumber);
      
      const newMessage = {
        speaker,
        text: speechText,
        round: roundNum,
        speechType: speechType
      };
      
      // Add message to list and get updated count
      const updatedCount = messageList.length + 1;
      setMessageList(prev => [...prev, newMessage]);
      setCurrentSpeechText("");

      // Get feedback on this speech (async, don't wait)
      getSpeechFeedback(speechText, roundNum, speechType, nextSpeechNumber).then(feedbackText => {
        if (feedbackText) {
          const newFeedback = {
            speech: speechText,
            feedback: feedbackText,
            speaker,
            round: roundNum,
            speechType: speechType
          };
          setFeedbackList(prev => [...prev, newFeedback]);
        }
      });

      // If AI vs User and not complete, get AI response after user speech
      if (mode === "ai-vs-user" && updatedCount < 8) {
        // After user speaks, check if next speech is AI's turn
        const nextSpeechAfterUser = updatedCount + 1; // This is the speech number after user's speech
        const isProTurnNext = (pfSpeakingOrder === "pro-first")
          ? (nextSpeechAfterUser % 2 === 1) // Pro speaks on odd speeches (1, 3, 5, 7)
          : (nextSpeechAfterUser % 2 === 0); // Pro speaks on even speeches (2, 4, 6, 8)
        
        // If next turn is not user's side, it's AI's turn
        const isAITurn = (userSide === "pro" && !isProTurnNext) || (userSide === "con" && isProTurnNext);
        
        if (isAITurn) {
          await handleAIResponse();
        }
      }
    } catch (e) {
      console.error("[Trainer] Submit error:", e);
      setError(e?.message || "Failed to submit speech.");
    } finally {
      setLoading(false);
    }
  };

  // Handle AI opponent response - simplified
  const handleAIResponse = async () => {
    if (mode !== "ai-vs-user" || isDebateComplete()) return;

    setLoading(true);
    try {
      const aiSide = userSide === "pro" ? "Con" : "Pro";
      const nextSpeechNum = messageList.length + 1;
      const roundNum = getCurrentRoundNumber();
      const speechType = getCurrentSpeechType(nextSpeechNum);
      
      const fullTranscript = messageList
        .map(({ speaker, text }) => `## ${speaker}\n${text}`)
        .join("\n\n---\n\n");

      const currentLanguage = languagePreferenceService.getCurrentLanguage();
      const languageInstructions = getLanguageInstructions(currentLanguage);

      const prompt = `You are ${aiSide} in a Public Forum debate on "${debateTopic}".

${languageInstructions}

FULL DEBATE TRANSCRIPT SO FAR:
${fullTranscript}

CURRENT ROUND: ${roundNum} of 4
YOUR ROLE: ${aiSide}
SPEECH TYPE: ${speechType}

${speechType === "Constructive" ? "Present your constructive case with 2 contentions." :
  speechType === "Rebuttal" ? "Rebuttal: Attack opponent's case and defend yours." :
  speechType === "Summary" ? "Summary: Extend your strongest arguments and weigh." :
  "Final Focus: Crystallize your key voting issues."}

Keep it concise and structured.`;

      const aiText = await generateAIResponse(
        aiSide,
        prompt,
        "openai/gpt-4o-mini",
        "",
        fullTranscript,
        roundNum,
        "default",
        "public-forum",
        pfSpeakingOrder
      );

      const aiMessage = {
        speaker: aiSide,
        text: aiText,
        round: roundNum,
        speechType: speechType
      };
      
      // Add AI message to list
      setMessageList(prev => [...prev, aiMessage]);
    } catch (e) {
      console.error("[Trainer] AI response error:", e);
      setError("Failed to get AI response.");
    } finally {
      setLoading(false);
    }
  };

  // Start debate
  const handleStartDebate = () => {
    if (!mode || !debateFormat) {
      setError(t('trainer.error.completeSetup'));
      return;
    }
    
    // Check topic
    if (mode === "user-vs-user") {
      if (!debateTopic.trim()) {
        setError(t('trainer.error.enterTopic'));
        return;
      }
    } else if (mode === "ai-vs-user") {
      if (!topicConfirmed || !debateTopic.trim()) {
        setError(t('trainer.error.enterTopic'));
        return;
      }
    }
    
    // For AI vs User, need side and order
    if (mode === "ai-vs-user" && (!userSide || !pfSpeakingOrder)) {
      setError(t('trainer.error.selectSideOrder'));
      return;
    }
    
    // For User vs User, set defaults if not set
    if (mode === "user-vs-user") {
      if (!userSide) setUserSide("pro");
      if (!pfSpeakingOrder) setPfSpeakingOrder("pro-first");
    }
    
    setSetupComplete(true);
    setError("");

    // If AI vs User and AI goes first, get AI response
    if (mode === "ai-vs-user") {
      const isProFirst = pfSpeakingOrder === "pro-first";
      const aiGoesFirst = (userSide === "pro" && !isProFirst) || (userSide === "con" && isProFirst);
      if (aiGoesFirst) {
        setTimeout(() => handleAIResponse(), 500);
      }
    }
  };

  // Reset to setup
  const handleReset = () => {
    setSetupComplete(false);
    setMessageList([]);
    setCurrentRound(1);
    setCurrentSpeechText("");
    setFeedbackList([]);
    setError("");
    setTopicConfirmed(false);
    setDebateTopic("");
    setUserSide("");
    setPfSpeakingOrder("");
  };

  // Setup UI
  if (!setupComplete) {
    return (
      <div className="debate-trainer-container">
        <header className="debate-trainer-header">
          <div className="debate-trainer-header-content">
            <div className="debate-trainer-header-left"></div>
            <div className="debate-trainer-header-center" style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, cursor: "pointer" }}>
              <h1 className="debate-trainer-site-title" onClick={() => navigate("/")}>{t('trainer.title')}</h1>
            </div>
            <div className="debate-trainer-header-right">
              <UserDropdown user={user} onLogout={onLogout} className="debate-trainer-user-dropdown" />
            </div>
          </div>
        </header>

        <div className="debate-trainer-main">
          <div className="debate-trainer-card">
            <h2>{t('trainer.practiceSetup')}</h2>
            <p>{t('trainer.configureSession')}</p>

            {/* Mode Selection */}
            {!mode && (
              <div className="trainer-setup-section">
                <h3 className="trainer-setup-title">{t('trainer.selectMode')}</h3>
                <div className="trainer-mode-grid">
                  {modes.map((m) => (
                    <div
                      key={m.id}
                      className={`trainer-mode-card ${mode === m.id ? "selected" : ""}`}
                      onClick={() => setMode(m.id)}
                    >
                      <div className="trainer-mode-icon">{m.icon}</div>
                      <h4>{m.title}</h4>
                      <p>{m.description}</p>
                      <div className="trainer-mode-tags">
                        {m.tags.map((tag, i) => (
                          <span key={i} className="trainer-mode-tag">{tag}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Format Selection */}
            {mode && !debateFormat && (
              <div className="trainer-setup-section">
                <button className="trainer-back-btn" onClick={() => setMode("")}>
                  <ArrowLeft size={16} /> {t('trainer.back')}
                </button>
                <h3 className="trainer-setup-title">{t('trainer.selectFormat')}</h3>
                <div className="trainer-mode-grid">
                  {formats.map((f) => (
                    <div
                      key={f.id}
                      className={`trainer-mode-card ${debateFormat === f.id ? "selected" : ""}`}
                      onClick={() => setDebateFormat(f.id)}
                    >
                      <div className="trainer-mode-icon">{f.icon}</div>
                      <h4>{f.title}</h4>
                      <p>{f.description}</p>
                      <div className="trainer-mode-tags">
                        {f.tags.map((tag, i) => (
                          <span key={i} className="trainer-mode-tag">{tag}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Topic Input */}
            {mode && debateFormat && !topicConfirmed && (
              <div className="trainer-setup-section">
                <button className="trainer-back-btn" onClick={() => {
                  setDebateFormat("");
                  setTopicConfirmed(false);
                  setDebateTopic("");
                }}>
                  <ArrowLeft size={16} /> {t('trainer.back')}
                </button>
                <h3 className="trainer-setup-title">{t('trainer.enterTopic')}</h3>
                <div className="trainer-topic-input">
                  <input
                    type="text"
                    value={debateTopic}
                    onChange={(e) => setDebateTopic(e.target.value)}
                    placeholder={t('trainer.topicPlaceholder')}
                    className="trainer-input"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && debateTopic.trim()) {
                        if (mode === "user-vs-user") {
                          handleStartDebate();
                        } else {
                          setTopicConfirmed(true);
                        }
                      }
                    }}
                  />
                  {mode === "user-vs-user" ? (
                    <button
                      className="trainer-btn primary"
                      onClick={handleStartDebate}
                      disabled={!debateTopic.trim()}
                    >
                      {t('trainer.startPractice')}
                    </button>
                  ) : (
                    <button
                      className="trainer-btn primary"
                      onClick={() => {
                        if (debateTopic.trim()) {
                          setTopicConfirmed(true);
                        }
                      }}
                      disabled={!debateTopic.trim()}
                    >
                      {t('trainer.continue')}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Side & Order Selection (AI vs User only) */}
            {mode === "ai-vs-user" && debateFormat && topicConfirmed && !setupComplete && (
              <div className="trainer-setup-section">
                <button className="trainer-back-btn" onClick={() => setTopicConfirmed(false)}>
                  <ArrowLeft size={16} /> {t('trainer.back')}
                </button>
                <h3 className="trainer-setup-title">{t('trainer.chooseSideOrder')}</h3>
                
                <div style={{ marginBottom: "2rem" }}>
                  <h4 style={{ color: "#f1f5f9", marginBottom: "1rem", fontSize: "1.1rem" }}>{t('trainer.yourSide')}</h4>
                  <div className="trainer-side-selection">
                    <button
                      className={`trainer-side-btn ${userSide === "pro" ? "selected" : ""}`}
                      onClick={() => setUserSide("pro")}
                    >
                      {t('trainer.proAffirmative')}
                    </button>
                    <button
                      className={`trainer-side-btn ${userSide === "con" ? "selected" : ""}`}
                      onClick={() => setUserSide("con")}
                    >
                      {t('trainer.conNegative')}
                    </button>
                  </div>
                </div>

                {userSide && (
                  <div style={{ marginBottom: "2rem" }}>
                    <h4 style={{ color: "#f1f5f9", marginBottom: "1rem", fontSize: "1.1rem" }}>{t('trainer.speakingOrder')}</h4>
                    <div className="trainer-order-selection">
                      <button
                        className={`trainer-order-btn ${pfSpeakingOrder === "pro-first" ? "selected" : ""}`}
                        onClick={() => setPfSpeakingOrder("pro-first")}
                      >
                        {t('trainer.proSpeaksFirst')}
                      </button>
                      <button
                        className={`trainer-order-btn ${pfSpeakingOrder === "con-first" ? "selected" : ""}`}
                        onClick={() => setPfSpeakingOrder("con-first")}
                      >
                        {t('trainer.conSpeaksFirst')}
                      </button>
                    </div>
                  </div>
                )}

                {userSide && pfSpeakingOrder && (
                  <div style={{ display: "flex", justifyContent: "center", marginTop: "2rem" }}>
                    <button
                      className="trainer-btn primary"
                      onClick={handleStartDebate}
                    >
                      {t('trainer.startPractice')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {error && <div className="speech-feedback-error">{error}</div>}
          </div>
        </div>

        <Footer />
      </div>
    );
  }

  // Debate Practice UI
  return (
    <div className={`debate-trainer-container ${sidebarExpanded ? 'sidebar-open' : ''}`}>
      <header className="debate-trainer-header">
        <div className="debate-trainer-header-content">
          <div className="debate-trainer-header-left"></div>
          <div className="debate-trainer-header-center" style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, cursor: "pointer" }}>
            <h1 className="debate-trainer-site-title" onClick={() => navigate("/")}>{t('trainer.title')}</h1>
          </div>
          <div className="debate-trainer-header-right">
            <UserDropdown user={user} onLogout={onLogout} className="debate-trainer-user-dropdown" />
          </div>
        </div>
      </header>

      {/* Speech Sidebar - Fixed position like Debate.jsx */}
      <button 
        className="toggle-sidebar" 
        onClick={() => setSidebarExpanded(!sidebarExpanded)}
      >
        {sidebarExpanded ? t('trainer.hideSpeeches') : t('trainer.showSpeeches')}
      </button>
      
      <div className={`debate-sidebar ${sidebarExpanded ? "expanded" : ""}`}>
        <h3 className="sidebar-title">{t('trainer.speeches')}</h3>
        <ul className="sidebar-list">
          {speechList.length === 0 ? (
            <li className="sidebar-item">
              <span className="sidebar-text">{t('trainer.noSpeechesYet')}</span>
            </li>
          ) : (
            speechList.map((item) => (
              <li 
                key={item.id} 
                className="sidebar-item"
                onClick={() => {
                  scrollToSpeech(item.id);
                  setSidebarExpanded(false);
                }}
              >
                <span className="sidebar-text">{item.title}</span>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="debate-trainer-main">
        {/* Debate Info - Centered Above */}
        <div className="trainer-debate-info-container">
          <div className="trainer-debate-info">
            <h3>{debateTopic}</h3>
            <div className="trainer-debate-meta">
              <span>{t('trainer.format')}: {debateFormat === "public-forum" ? t('trainer.publicForum') : ""}</span>
              <span>{t('trainer.round')}: {getCurrentRoundNumber()}/4</span>
              {mode === "ai-vs-user" && <span>{t('trainer.you')}: {userSide === "pro" ? t('trainer.pro') : t('trainer.con')}</span>}
            </div>
          </div>
        </div>

        {/* Speech Input - Centered, below title */}
        {!isDebateComplete() && (
          <div className="trainer-speech-input-container">
            <div className="trainer-speech-input-compact">
              <div className="trainer-speech-input-header-compact">
                <label>
                  {mode === "user-vs-user" 
                    ? `${(messageList.length % 2 === 0 && pfSpeakingOrder === "pro-first") || (messageList.length % 2 === 1 && pfSpeakingOrder === "con-first") ? t('trainer.pro') : t('trainer.con')} - ${getCurrentSpeechType(messageList.length + 1)} (${t('trainer.round')} ${getCurrentRoundNumber()})`
                    : `${userSide === "pro" ? t('trainer.pro') : t('trainer.con')} - ${getCurrentSpeechType(messageList.length + 1)} (${t('trainer.round')} ${getCurrentRoundNumber()})`
                  }
                </label>
                {loading && mode === "ai-vs-user" && (
                  <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>{t('trainer.aiResponding')}</span>
                )}
              </div>
              <div className="trainer-voice-input-wrapper">
                <VoiceInput
                  onTranscript={handleVoiceFinalChunk}
                  placeholder={t('trainer.clickToSpeak')}
                  disabled={loading}
                />
              </div>
              <div className="trainer-speech-input-row">
                <textarea
                  className="trainer-speech-textarea-compact"
                  rows={3}
                  value={currentSpeechText}
                  onChange={(e) => setCurrentSpeechText(e.target.value)}
                  placeholder={t('trainer.typeSpeech')}
                  disabled={loading}
                />
                <button
                  className="trainer-btn primary"
                  onClick={handleSubmitSpeech}
                  disabled={loading || !currentSpeechText.trim() || gettingFeedback}
                >
                  {loading ? "..." : gettingFeedback ? "..." : t('trainer.submit')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="trainer-debate-layout">
          {/* Left: Transcript */}
          <div className="trainer-transcript-panel">
            <div className="trainer-transcript">
              {messageList.length === 0 ? (
                <div className="trainer-transcript-empty">{t('trainer.debateWillStart')}</div>
              ) : (
                <>
                  {messageList.map((msg, idx) => {
                    const isUserMessage = mode === "user-vs-user" || (mode === "ai-vs-user" && msg.speaker === (userSide === "pro" ? "Pro" : "Con"));
                    return (
                      <div 
                        key={idx} 
                        id={`speech-${idx}`}
                        ref={el => speechRefs.current[idx] = el}
                        className={`trainer-message ${isUserMessage ? "user-message" : "ai-message"}`}
                      >
                        {isUserMessage && (
                          <div className="trainer-message-header">
                            <h2 className="trainer-message-title">
                              {msg.speaker === "Pro" ? t('trainer.pro') : t('trainer.con')} – {t('trainer.round')} {msg.round}/4 {debateFormat === "public-forum" ? `(${t('trainer.publicForum')})` : ""}
                            </h2>
                          </div>
                        )}
                        <div className="trainer-message-content">
                          <ReactMarkdown
                            rehypePlugins={[rehypeRaw]}
                            components={{
                              h1: ({ node, ...props }) => <h1 className="trainer-markdown-h1" {...props} />,
                              h2: ({ node, ...props }) => <h2 className="trainer-markdown-h2" {...props} />,
                              h3: ({ node, ...props }) => <h3 className="trainer-markdown-h3" {...props} />,
                              p: ({ node, ...props }) => <p className="trainer-markdown-p" {...props} />,
                            }}
                          >
                            {msg.text}
                          </ReactMarkdown>
                        </div>
                      </div>
                    );
                  })}
                  {/* AI Loading Indicator */}
                  {loading && mode === "ai-vs-user" && !isDebateComplete() && (
                    <div className="trainer-message ai-message trainer-message-loading">
                      <div className="trainer-message-header">
                        <h2 className="trainer-message-title">
                          {userSide === "pro" ? t('trainer.con') : t('trainer.pro')} – {t('trainer.round')} {getCurrentRoundNumber()}/4 {debateFormat === "public-forum" ? `(${t('trainer.publicForum')})` : ""}
                        </h2>
                      </div>
                      <div className="trainer-message-content">
                        <div className="trainer-loading-indicator">
                          <div className="trainer-spinner"></div>
                          <p>{t('trainer.aiGenerating')}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right: Feedback Panel */}
          <div className="trainer-feedback-panel">
            <h3>{t('trainer.speechFeedback')}</h3>
            <div className="trainer-feedback-content">
              {gettingFeedback && (
                <div className="trainer-feedback-loading">
                  <div className="trainer-loading-indicator">
                    <div className="trainer-spinner"></div>
                    <p>{t('trainer.generatingFeedback')}</p>
                  </div>
                </div>
              )}
              {feedbackList.length === 0 && !gettingFeedback ? (
                <div className="trainer-feedback-empty">
                  <p>{t('trainer.submitForFeedback')}</p>
                </div>
              ) : (
                feedbackList.map((feedback, idx) => (
                  <div 
                    key={idx} 
                    ref={el => feedbackRefs.current[idx] = el}
                    className="trainer-feedback-item"
                  >
                    <div className="trainer-feedback-header">
                      <strong>{feedback.speaker === "Pro" ? t('trainer.pro') : t('trainer.con')} - {t('trainer.round')} {feedback.round} • {feedback.speechType}</strong>
                    </div>
                    <ReactMarkdown
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        h1: ({ node, ...props }) => <h1 className="trainer-markdown-h1" {...props} />,
                        h2: ({ node, ...props }) => <h2 className="trainer-section-header" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="trainer-markdown-h3" {...props} />,
                        h4: ({ node, ...props }) => <h4 className="trainer-markdown-h4" {...props} />,
                        p: ({ node, ...props }) => <p className="trainer-markdown-p" {...props} />,
                        ul: ({ node, ...props }) => <ul className="trainer-markdown-ul" {...props} />,
                        ol: ({ node, ...props }) => <ol className="trainer-markdown-ol" {...props} />,
                        li: ({ node, ...props }) => <li className="trainer-markdown-li" {...props} />,
                        strong: ({ node, ...props }) => <strong className="trainer-markdown-strong" {...props} />,
                        em: ({ node, ...props }) => <em className="trainer-markdown-em" {...props} />,
                      }}
                    >
                      {feedback.feedback.replace(/^==\s*(.+?)\s*==$/gm, '## $1')}
                    </ReactMarkdown>
                    {idx < feedbackList.length - 1 && <div className="trainer-feedback-divider"></div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>


        {isDebateComplete() && (
          <div className="trainer-debate-complete-container">
            <div className="trainer-debate-complete">
              <h3>{t('trainer.debateComplete')}</h3>
              <p>{t('trainer.reviewFeedback')}</p>
              <button className="trainer-btn" onClick={handleReset}>
                {t('trainer.startNewPractice')}
              </button>
            </div>
          </div>
        )}

        {error && <div className="speech-feedback-error">{error}</div>}
      </div>

      <Footer />
    </div>
  );
}

export default DebateTrainer;
