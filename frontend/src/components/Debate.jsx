import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import EnhancedVoiceOutput from './EnhancedVoiceOutput';
import { TTS_CONFIG, getVoiceForContext } from '../config/tts';
import languagePreferenceService from '../services/languagePreferenceService';
import { useTranslation } from '../utils/translations';

const modelOptions = [
  "openai/gpt-4o-mini",
  "meta-llama/llama-3.3-70b-instruct",
  "google/gemini-2.0-flash-001",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o-mini-search-preview"
];


function sanitizeUserInput(str) {
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getPersonaName(persona) {
  const personaMap = {
    "default": "Default AI",
    "trump": "Donald Trump",
    "harris": "Kamala Harris", 
    "musk": "Elon Musk",
    "drake": "Drake"
  };
  return personaMap[persona] || "Default AI";
}

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

function getPersonaPrompt(persona) {
  switch (persona) {
    case "trump":
      return `
SPEAKING STYLE: Bold, confident, repetitive rhetoric with superlatives and simple language.

REQUIRED LANGUAGE PATTERNS:
- Start with: "Look," "Listen," "You know what?" "Let me tell you"
- Use frequently: "believe me," "tremendous," "incredible," "the best," "like you wouldn't believe"
- Superlatives: "the greatest," "the worst," "nobody's ever seen anything like it"
- Repetition: "It's true, it's true, it's very true"
- End with: "okay?" "believe me"
- Personal references: "I've made incredible deals," "I know more about X than anyone"
- Indirect attacks: "some people say," "a lot of people are saying"
- Simple, direct sentences with bold claims
- Words: "disaster," "catastrophe," "phenomenal," "fantastic," "winners," "billions," "millions"

Adopt this rhetorical style completely for your debate response.`;

    case "harris":
      return `
SPEAKING STYLE: Prosecutorial, structured, evidence-focused with emphatic delivery.

REQUIRED LANGUAGE PATTERNS:
- Start with: "Let me be very clear," "The reality is," "Here's the thing"
- Use frequently: "What we know to be true," "We must speak truth," "We cannot be deterred"
- Direct challenges: "That is simply not accurate," "I think you're confused about the facts"
- Structure: "First, Second, Third" - like court cases
- Evidence focus: "The data shows," "The facts are clear"
- Rhetorical questions: "Are we really going to accept that?"
- Experience references: "As a prosecutor," "In my time as Attorney General"
- Pause phrases: "And let me pause there..." "And THAT is why..."
- Values language: "our democracy," "our values," "our future," "The American people deserve"
- Challenge language: "false choice," "that's a false premise"

Adopt this prosecutorial speaking style completely for your debate response.`;

    case "musk":
      return `
SPEAKING STYLE: Analytical, engineering-focused, with technical tangents and first principles thinking.

REQUIRED LANGUAGE PATTERNS:
- Start with: "Well," "I mean," "Obviously," "The thing is"
- Technical focus: "From a physics standpoint," "If you think about it fundamentally"
- Thinking aloud: "So if you consider... no wait, actually..."
- Confidence phrases: "To be totally frank," "I think probably," "I'm fairly confident that"
- Self-correction: "Actually, let me rephrase that"
- First principles: "If you go back to first principles"
- Engineering perspective: "It's really just an optimization problem"
- Math focus: "If you do the math," "The numbers don't lie"
- Direct assessment: "That's obviously wrong," "That makes no sense"
- Technical vocabulary: "optimize," "efficiency," "sustainable," "exponential," "asymptotic"
- Physics references: "laws of physics," "thermodynamics," "mass production"
- Solution focus: practical implementation and rapid iteration

Adopt this analytical engineering communication style completely for your debate response.`;

    case "drake":
      return `
SPEAKING STYLE: Smooth, introspective Toronto style with confidence, vulnerability, and authenticity themes.

REQUIRED LANGUAGE PATTERNS:
- Start with: "You know what I'm saying," "For real," "At the end of the day"
- Honesty phrases: "I'm just being honest," "Real talk," "No cap," "That's facts"
- Common starters: "Listen," "Look," "I mean," "The thing is"
- Experience references: "I've been through," "I understand," "I know firsthand"
- Journey themes: "Started from the bottom," "came a long way"
- Loyalty language: "I ride for my people," "family first," "trust issues"
- Success terms: "grinding," "hustle," "blessed," "grateful"
- Toronto references: "the 6," "my city," "where I'm from shaped me"
- Authenticity: "keeping it 100," "being real," "staying true"
- Vulnerability: "I'll be honest," "opening up," "showing love"
- Key vocabulary: "blessed," "grateful," "energy," "vibes," "passionate," "real ones," "day ones"
- Storytelling: "Let me tell you about..." "Life taught me..."

Adopt this smooth Toronto communication style completely for your debate response.`;

    default:
      return "";
  }
}

function Debate() {
  // Retrieve debate parameters: short topic (bill name) and full description.
  const { mode, debateMode, topic, description, billText, billTitle, selectedModel, debateFormat, proPersona: initialProPersona, conPersona: initialConPersona, aiPersona: initialAiPersona } = useLocation().state || {};
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Helper function to count AI speeches for all formats
  const countAISpeeches = (messages) => {
    if (debateFormat === "public-forum") {
      return messages.filter(m =>
        (m.speaker.includes("Pro (AI)") || m.speaker.includes("Pro (") && m.speaker.includes(") -")) ||
        (m.speaker.includes("Con (AI)") || m.speaker.includes("Con (") && m.speaker.includes(") -"))
      ).length;
    } else if (debateFormat === "lincoln-douglas") {
      return messages.filter(m =>
        (m.speaker.includes("Affirmative (AI)") || m.speaker.includes("Affirmative (") && m.speaker.includes(") -")) ||
        (m.speaker.includes("Negative (AI)") || m.speaker.includes("Negative (") && m.speaker.includes(") -"))
      ).length;
    } else {
      // Default 5-round format - match AI speakers with or without persona names
      return messages.filter(m =>
        m.speaker.includes("AI Debater Pro") || m.speaker.includes("AI Debater Con")
      ).length;
    }
  };

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
  
  // Custom model states - track whether using suggested or custom model
  const [proModelType, setProModelType] = useState("suggested"); // "suggested" or "custom"
  const [conModelType, setConModelType] = useState("suggested");
  const [singleAIModelType, setSingleAIModelType] = useState("suggested");
  const [judgeModelType, setJudgeModelType] = useState("suggested");
  
  // Custom model input values
  const [proModelCustom, setProModelCustom] = useState("");
  const [conModelCustom, setConModelCustom] = useState("");
  const [singleAIModelCustom, setSingleAIModelCustom] = useState("");
  const [judgeModelCustom, setJudgeModelCustom] = useState("");
  
  // Persona states (received from navigation)
  const proPersona = initialProPersona || "default";
  const conPersona = initialConPersona || "default";
  const aiPersona = initialAiPersona || "default";
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
  
  // Public Forum speaking order state
  const [pfSpeakingOrder, setPfSpeakingOrder] = useState("pro-first");
  const [pfOrderSelected, setPfOrderSelected] = useState(false);
  const [showPfInfo, setShowPfInfo] = useState(false);

  // Lincoln-Douglas info/confirm state (order selection removed; Aff always starts)
  const [ldOrderSelected, setLdOrderSelected] = useState(false);
  const [showLdInfo, setShowLdInfo] = useState(false);

  // Helper functions to get actual model values
  const getProModel = () => proModelType === "custom" ? proModelCustom : proModel;
  const getConModel = () => conModelType === "custom" ? conModelCustom : conModel;
  const getSingleAIModel = () => singleAIModelType === "custom" ? singleAIModelCustom : singleAIModel;
  const getJudgeModel = () => judgeModelType === "custom" ? judgeModelCustom : judgeModel;

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
    const maxRounds = debateFormat === "public-forum" ? 4 : debateFormat === "lincoln-douglas" ? 5 : 5;
    const aiSpeeches = countAISpeeches(messageList);
    const shouldContinue = debateFormat === "lincoln-douglas" ? aiSpeeches < 5 : aiSpeeches < (maxRounds * 2); // 5 speeches for LD, 8 for PF, 10 for regular

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
  }, [loading, autoMode, messageList.length, debateFormat]);

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
  const appendMessage = (speaker, text, modelName = null, roundOverride = null) => {
    setMessageList(prev => [
      ...prev,
      { speaker, text: text.trim(), model: modelName, round: roundOverride || currentRound },
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

  // Check if debate is complete based on format
  const isDebateComplete = () => {
    const totalSpeeches = messageList.length;
    if (debateFormat === "lincoln-douglas") {
      return totalSpeeches >= 5;
    } else if (debateFormat === "public-forum") {
      return totalSpeeches >= 8; // 4 rounds * 2 speakers
    }
    return totalSpeeches >= (maxRounds * 2); // Default: 5 rounds * 2 speakers = 10
  };

  // Check if user can still input in User vs AI or User vs User mode
  const canUserInput = () => {
    // For User vs AI mode
    if (actualMode === "ai-vs-user") {
      const totalSpeeches = messageList.length;

      // Check if debate is complete
      if (isDebateComplete()) return false;

      // For Lincoln-Douglas: specific turn-based logic
      if (debateFormat === "lincoln-douglas") {
        const isUserAff = userSide === "pro"; // Pro = Affirmative
        // Aff speaks in rounds 1, 3, 5 (odd rounds)
        // Neg speaks in rounds 2, 4 (even rounds)
        const nextRound = totalSpeeches + 1;
        const isAffTurn = nextRound % 2 === 1; // Odd rounds are Aff's turn

        // User can input if it's their turn
        if (isUserAff) {
          return isAffTurn; // User can input in rounds 1, 3, 5
        } else {
          return !isAffTurn; // User can input in rounds 2, 4
        }
      }

      // For Public Forum: check speaking order
      if (debateFormat === "public-forum") {
        const nextSpeechNumber = totalSpeeches + 1;
        const isProTurn = (pfSpeakingOrder === "pro-first")
          ? (nextSpeechNumber % 2 === 1) // Pro speaks on odd speeches (1, 3, 5, 7)
          : (nextSpeechNumber % 2 === 0); // Pro speaks on even speeches (2, 4, 6, 8)

        const isUserPro = userSide === "pro";
        return isUserPro === isProTurn; // User can input if it's their turn
      }

      // For other formats, allow input until max rounds
      return totalSpeeches < (maxRounds * 2);
    }

    // For User vs User mode - just check if debate is complete
    if (actualMode === "user-vs-user") {
      return !isDebateComplete();
    }

    // For other modes (ai-vs-ai), always return true
    return true;
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

      // Determine speech type for PF/LD formats
      let speechTypeLabel = "";
      if (debateFormat === "public-forum") {
        // PF has 4 rounds: Constructive, Rebuttal, Summary, Final Focus
        // Each round has 2 speeches
        const totalSpeeches = index + 1;
        if (totalSpeeches <= 2) speechTypeLabel = "CONSTRUCTIVE";
        else if (totalSpeeches <= 4) speechTypeLabel = "REBUTTAL";
        else if (totalSpeeches <= 6) speechTypeLabel = "SUMMARY";
        else if (totalSpeeches <= 8) speechTypeLabel = "FINAL FOCUS";
      } else if (debateFormat === "lincoln-douglas") {
        // LD has specific speech names based on order
        const totalSpeeches = index + 1;
        if (totalSpeeches === 1) speechTypeLabel = "AC";
        else if (totalSpeeches === 2) speechTypeLabel = "NC";
        else if (totalSpeeches === 3) speechTypeLabel = "1AR";
        else if (totalSpeeches === 4) speechTypeLabel = "NR";
        else if (totalSpeeches === 5) speechTypeLabel = "2AR";
      }

      // Add round information for ALL speeches
      // Check if speaker name already contains speech type labels (AC, NC, 1AR, NR, 2AR, CONSTRUCTIVE, REBUTTAL, SUMMARY, FINAL FOCUS)
      const alreadyHasLabel = msg.speaker.includes(" - AC") || msg.speaker.includes(" - NC") ||
                               msg.speaker.includes(" - 1AR") || msg.speaker.includes(" - NR") ||
                               msg.speaker.includes(" - 2AR") || msg.speaker.includes(" - CONSTRUCTIVE") ||
                               msg.speaker.includes(" - REBUTTAL") || msg.speaker.includes(" - SUMMARY") ||
                               msg.speaker.includes(" - FINAL FOCUS");

      if (alreadyHasLabel) {
        // Speaker name already has the label, use as-is
        title = msg.speaker;
      } else if (msg.speaker === "AI Debater Pro" || msg.speaker === "AI Debater Con") {
        const roundLabel = t('debate.round');
        title = speechTypeLabel
          ? `${msg.speaker} - ${speechTypeLabel} (${roundLabel} ${roundNum}/${maxRounds})`
          : `${msg.speaker} - ${roundLabel} ${roundNum}/${maxRounds}`;
      } else if (msg.speaker.includes("(AI)")) {
        // For User vs AI mode, add round info for AI responses
        const roundLabel = t('debate.round');
        title = speechTypeLabel
          ? `${msg.speaker} - ${speechTypeLabel}`
          : `${msg.speaker} - ${roundLabel} ${roundNum}`;
      } else if (msg.speaker.includes("(User)")) {
        // For User vs AI mode, add round info for user responses
        const roundLabel = t('debate.round');
        title = speechTypeLabel
          ? `${msg.speaker} - ${speechTypeLabel}`
          : `${msg.speaker} - ${roundLabel} ${roundNum}`;
      } else if ((msg.speaker.startsWith("PRO (") || msg.speaker.startsWith("CON (")) &&
                 (msg.speaker.includes("Pro (User)") || msg.speaker.includes("Con (User)") ||
                  actualMode === "user-vs-user")) {
        // For User vs User mode, translate PRO/CON and Round for display
        // Extract username from speaker label (format: "PRO (username)" or "CON (username)")
        const match = msg.speaker.match(/^(PRO|CON) \((.+)\)$/);
        if (match) {
          const side = match[1]; // "PRO" or "CON"
          const username = match[2];
          const translatedSide = side === "PRO" ? t('debate.pro') : t('debate.con');
          const translatedSpeaker = `${translatedSide} (${username})`;
          
          // For User vs User mode, don't add round number for PF/LD (speech type is sufficient)
          // For other formats, add round number
          if (debateFormat === "public-forum" || debateFormat === "lincoln-douglas") {
            title = speechTypeLabel
              ? `${translatedSpeaker} - ${speechTypeLabel}`
              : `${translatedSpeaker}`;
          } else {
            const roundLabel = t('debate.round');
            title = speechTypeLabel
              ? `${translatedSpeaker} - ${speechTypeLabel} (${roundLabel} ${roundNum})`
              : `${translatedSpeaker} - ${roundLabel} ${roundNum}`;
          }
        } else {
          // Fallback to original behavior if format doesn't match
          if (debateFormat === "public-forum" || debateFormat === "lincoln-douglas") {
            title = speechTypeLabel
              ? `${msg.speaker} - ${speechTypeLabel}`
              : `${msg.speaker}`;
          } else {
            const roundLabel = t('debate.round');
            title = speechTypeLabel
              ? `${msg.speaker} - ${speechTypeLabel} (${roundLabel} ${roundNum})`
              : `${msg.speaker} - ${roundLabel} ${roundNum}`;
          }
        }
      } else if (msg.speaker.includes("Judge")) {
        // For judge feedback, don't add round number
        title = msg.speaker;
      } else {
        // For any other speaker, add round number
        const roundLabel = t('debate.round');
        title = speechTypeLabel
          ? `${msg.speaker} - ${speechTypeLabel} (${roundLabel} ${roundNum})`
          : `${msg.speaker} - ${roundLabel} ${roundNum}`;
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
      navigate("/judge", { state: { transcript: finalTranscript, topic, mode: isBillDebate ? 'bill-debate' : actualMode, judgeModel: getJudgeModel() } });
    } catch (err) {
      console.error("Error ending debate:", err);
      setError(t('error.failedToEnd'));
    } finally {
      setLoading(false);
    }
  };

  const maxRounds = debateFormat === "public-forum" ? 4 : debateFormat === "lincoln-douglas" ? 5 : 5;
  const handleAIDebate = async () => {
    // Check if we have completed all speeches (5 speeches for LD, 8 for PF, 10 for regular)
    const aiSpeeches = countAISpeeches(messageList);
    if (debateFormat === "lincoln-douglas" ? aiSpeeches >= 5 : aiSpeeches >= (maxRounds * 2)) return;
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
        let proPrompt;

        if (debateFormat === "lincoln-douglas") {
          // Lincoln-Douglas format with 5 speeches (no cross-examination)
          // 1. AC (6min/~900 words), 2. NC (7min/~1050 words), 3. 1AR (4min/~600 words), 4. NR (6min/~900 words), 5. 2AR (3min/~450 words)
          const totalSpeeches = messageList.filter(m => m.speaker.includes("Affirmative") || m.speaker.includes("Negative")).length;

          // Determine current speech number (1-5)
          let speechNum = totalSpeeches + 1;
          if (speechNum > 5) return; // All speeches complete

          let speechType, wordLimit, timeLimit, minWords, isAffirmativeTurn;

          if (speechNum === 1) { // Affirmative Constructive (AC)
            speechType = "AFFIRMATIVE CONSTRUCTIVE";
            wordLimit = 900;
            minWords = 800;
            timeLimit = "6 minutes";
            isAffirmativeTurn = true;
          } else if (speechNum === 2) { // Negative Constructive (NC)
            speechType = "NEGATIVE CONSTRUCTIVE";
            wordLimit = 1050;
            minWords = 950;
            timeLimit = "7 minutes";
            isAffirmativeTurn = false;
          } else if (speechNum === 3) { // 1st Affirmative Rebuttal (1AR)
            speechType = "1ST AFFIRMATIVE REBUTTAL";
            wordLimit = 600;
            minWords = 500;
            timeLimit = "4 minutes";
            isAffirmativeTurn = true;
          } else if (speechNum === 4) { // Negative Rebuttal (NR)
            speechType = "NEGATIVE REBUTTAL";
            wordLimit = 900;
            minWords = 800;
            timeLimit = "6 minutes";
            isAffirmativeTurn = false;
          } else if (speechNum === 5) { // 2nd Affirmative Rebuttal (2AR)
            speechType = "2ND AFFIRMATIVE REBUTTAL";
            wordLimit = 450;
            minWords = 350;
            timeLimit = "3 minutes";
            isAffirmativeTurn = true;
          }

          // Skip if it's not Pro's turn (we handle Affirmative as Pro)
          if (!isAffirmativeTurn) {
            // Switch to Con (Negative) instead
            setAiSide("con");
            return;
          }

          const currentLanguage = languagePreferenceService.getCurrentLanguage();
          const languageInstructions = getLanguageInstructions(currentLanguage);
          
          proPrompt = `
You are competing in a Lincoln-Douglas debate on: "${topic}"

${languageInstructions}

BILL CONTEXT:
${actualDescription}

SPEECH TYPE: ${speechType} (${timeLimit} - ${minWords}-${wordLimit} words)

${speechNum === 1 ? `
=== FIRST AFFIRMATIVE CONSTRUCTIVE (1AC) - 6 MINUTES ===

This is your prewritten case. Present it clearly and confidently.

PART 1: FRAMEWORK (200-250 words)
- VALUE PREMISE: State what should be most valued in this debate (e.g., Justice, Morality, Util, Human Dignity)
- VALUE CRITERION: Explain how we achieve/measure your value (e.g., Protecting Rights, Maximizing Welfare, Kant's Categorical Imperative)
- JUSTIFICATION: Explain why your framework is the best lens to evaluate this resolution

PART 2: CONTENTIONS (600-650 words total)
Present 2-3 contentions that support the resolution and link to your framework:

CONTENTION 1 (250-300 words):
- Clear thesis statement
- Evidence and warrants (explain why evidence matters)
- Link to framework (how this contention upholds your value)
- Impact (real-world significance)

CONTENTION 2 (250-300 words):
- Clear thesis statement
- Evidence and warrants
- Link to framework
- Impact

CONTENTION 3 (optional, 150-200 words):
- Clear thesis statement
- Evidence and warrants
- Link to framework
- Impact

PART 3: CONCLUSION (50-100 words)
- Restate your value framework
- Preview why affirming the resolution is imperative

CRITICAL: This is a CONSTRUCTIVE speech only. Do NOT address opponent arguments (they haven't spoken yet). Your response must be exactly ${minWords}-${wordLimit} words.` :

speechNum === 3 ? `
=== FIRST AFFIRMATIVE REBUTTAL (1AR) - 4 MINUTES ===

This is the HARDEST speech in LD. You must cover the entire 7-minute NC in just 4 minutes. Be efficient.

PART 1: REBUILD YOUR CASE (~2 minutes / 250-300 words)

FRAMEWORK DEFENSE:
- Respond to their framework attacks
- Extend why your value/criterion should be preferred
- Show you're winning the framework debate

CONTENTION EXTENSIONS:
- Extend your strongest 1-2 contentions from AC
- Respond to their attacks on your contentions
- Add new evidence if possible
- Explain why your impacts still matter

PART 2: ATTACK THEIR CASE (~2 minutes / 250-300 words)

THEIR FRAMEWORK:
- Contest their value premise/criterion if weak
- Show inconsistencies or flaws

THEIR CONTENTIONS:
- Attack their weakest contentions
- Show why their impacts don't matter under your framework
- Point out dropped arguments or weak warrants

CRITICAL STRATEGY:
- Any argument NOT addressed in 1AR is "dropped" and CANNOT be brought back in 2AR
- Prioritize the most important arguments
- Be efficient - signpost clearly ("On their framework...", "On Contention 1...")
- Set up voting issues for 2AR

Your response must be exactly ${minWords}-${wordLimit} words. This speech determines the round - make every word count.` :

speechNum === 5 ? `
=== SECOND AFFIRMATIVE REBUTTAL (2AR) - 3 MINUTES ===

This is your FINAL speech. The Negative does NOT get a 3NR to reply. Crystallize the round and give voting issues.

STRICT RULES:
- NO NEW ARGUMENTS - Only extend arguments from 1AR
- Judges apply the strictest standard of "newness" to 2AR
- Any argument not in 1AR is FORBIDDEN in 2AR

STRUCTURE:

PART 1: FRAMEWORK (75-100 words)
- Extend why you win the framework debate
- Explain why your value/criterion should be preferred
- Show the judge how to evaluate the round

PART 2: VOTING ISSUES (250-300 words)
Give 2-3 clear reasons why the Affirmative wins:

VOTING ISSUE #1 (100-120 words):
- State the argument clearly
- Explain why you're winning this point
- Show why it's a reason to vote Aff

VOTING ISSUE #2 (100-120 words):
- State the argument clearly
- Explain why you're winning this point
- Show why it's a reason to vote Aff

VOTING ISSUE #3 (optional, 50-80 words):
- Additional reason to vote Aff if needed

PART 3: FINAL APPEAL (50-75 words)
- Respond briefly to the 2NR's key argument
- Emphasize your strongest impact
- Give a compelling reason to affirm the resolution
- End with confidence and clarity

CRITICAL: This is your last chance. Make every second count. Crystallize why you win. ${minWords}-${wordLimit} words exactly.` : ''}

${getPersonaPrompt(proPersona)}

FORMATTING:
- Start immediately with speech content
- Never include speaker name or round information
- Display will show: "Affirmative (AI) - ${speechType}"
          `;
        } else if (debateFormat === "public-forum") {
          // Public Forum format with 4 rounds: Constructive, Rebuttal, Summary, Final Focus
          const totalSpeeches = messageList.filter(m => m.speaker.includes("Pro") || m.speaker.includes("Con")).length;
          const proSpeeches = messageList.filter(m => m.speaker.includes("Pro")).length;
          
          // Determine speech type based on total number of speeches
          // Speech 1&2: Constructive, Speech 3&4: Rebuttal, Speech 5&6: Summary, Speech 7&8: Final Focus
          let speechTypeIndex;
          if (totalSpeeches <= 1) speechTypeIndex = 1; // Constructive round
          else if (totalSpeeches <= 3) speechTypeIndex = 2; // Rebuttal round  
          else if (totalSpeeches <= 5) speechTypeIndex = 3; // Summary round
          else if (totalSpeeches <= 7) speechTypeIndex = 4; // Final Focus round (speeches 6&7&8)
          else return; // No more speeches allowed after 8 total speeches (4 rounds complete)
          
          const roundNumber = speechTypeIndex;
          const isFirstSpeaker = (pfSpeakingOrder === "pro-first");
          
          let speechType, wordLimit, timeLimit, minWords;
          if (roundNumber === 1) {
            speechType = "CONSTRUCTIVE";
            wordLimit = 600;
            minWords = 550;
            timeLimit = "4 minutes";
          } else if (roundNumber === 2) {
            speechType = "REBUTTAL";
            wordLimit = 600;
            minWords = 550;
            timeLimit = "4 minutes";
          } else if (roundNumber === 3) {
            speechType = "SUMMARY";
            wordLimit = 450;
            minWords = 400;
            timeLimit = "3 minutes";
          } else {
            speechType = "FINAL FOCUS";
            wordLimit = 300;
            minWords = 250;
            timeLimit = "2 minutes";
          }
          
          console.log(`🔍 DEBUG: Pro Speech - Total speeches: ${totalSpeeches}, Speech type index: ${speechTypeIndex}, Round: ${roundNumber}, Speech Type: ${speechType}`);
          
          const currentLanguage = languagePreferenceService.getCurrentLanguage();
          const languageInstructions = getLanguageInstructions(currentLanguage);
          
          proPrompt = `
You are competing in a Public Forum debate on: "${topic}"

${languageInstructions}

YOUR ROLE: PRO (supporting the topic)

${getPersonaPrompt(proPersona)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 ABSOLUTE PRIORITY - READ THIS FIRST 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOU ARE REQUIRED TO USE THE SPEAKING STYLE SPECIFIED ABOVE IN EVERY SINGLE SENTENCE.

This is NOT optional. This is NOT a suggestion. The structural requirements below must be fulfilled WHILE MAINTAINING THE PERSONA STYLE.

Example: If you're speaking as Trump, you would say:
- "Look, let me tell you about healthcare, okay? It's a disaster, a total disaster, believe me."
- NOT: "The current healthcare landscape is plagued by inefficiencies."

Every argument, every piece of evidence, every transition MUST use the persona's language patterns. Do NOT write in formal academic style. Write as the CHARACTER would speak.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BILL CONTEXT:
${truncatedDescription || "No specific bill context provided."}

FULL DEBATE TRANSCRIPT SO FAR:
${fullTranscript}

CURRENT SPEECH: PRO ${speechType} (${timeLimit})

CRITICAL WORD COUNT REQUIREMENT: 
- MINIMUM ${minWords} words, MAXIMUM ${wordLimit} words
- Your response WILL BE REJECTED if under ${minWords} words OR over ${wordLimit} words
- This is a ${timeLimit} speech - STAY WITHIN ${wordLimit} words (150 words per minute)
- Write substantial, detailed arguments within the strict word limit

${roundNumber === 1 ? `
=== PRO CONSTRUCTIVE SPEECH REQUIREMENTS ===

MANDATORY STRUCTURE - Follow EXACTLY:

1. BRIEF INTRODUCTION (30-50 words):
   - State your side and the resolution
   - Preview your two contentions

2. CONTENTION 1: [Insert compelling title] (250-300 words):
   
   A. UNIQUENESS (80-100 words):
   - Explain the current problem/status quo failure in detail
   - Provide specific statistics, examples, or evidence
   - Explain why this problem persists now
   
   B. LINK (80-100 words):
   - Explain HOW the topic/resolution solves this problem
   - Provide the mechanism/causal chain
   - Include multiple pathways if possible
   
   C. IMPACT (80-100 words):
   - Explain the specific benefits that result
   - Include magnitude (how many people affected)
   - Include timeframe (when benefits occur)
   - Include probability (likelihood of success)

3. CONTENTION 2: [Insert compelling title] (250-300 words):
   
   Follow same A-B-C structure as Contention 1
   
4. CONCLUSION (50-70 words):
   - Tie contentions together with value framework
   - Strong closing statement

EXAMPLE STRUCTURE:
"We affirm the resolution. Today we present two contentions...

Contention 1: Economic Growth
A. Uniqueness: Currently, the economy faces stagnation with GDP growth at only 1.2%... [detailed explanation with evidence]
B. Link: The resolution creates economic growth through three mechanisms... [detailed causal chain]  
C. Impact: This generates $500 billion in economic activity, affecting 2 million jobs... [specific impacts]

Contention 2: [Title]
[Same A-B-C structure]

In conclusion, we affirm because..."

CRITICAL: Your response must be exactly ${minWords}-${wordLimit} words. Count your words carefully. Responses over ${wordLimit} words or under ${minWords} words will be rejected.` :

roundNumber === 2 ? `
=== PRO REBUTTAL SPEECH REQUIREMENTS ===

${totalSpeeches <= 3 ? `MANDATORY STRUCTURE - Line-by-line refutation ONLY:

For EACH of opponent's contentions, provide systematic refutation:

CONTENTION 1: [Quote opponent's title]

1. UNIQUENESS ATTACKS (labeled "NU"):
   - "NU: [Opponent's uniqueness claim is wrong because...]"
   - Provide counter-evidence that problem doesn't exist
   - Show trend is improving, not worsening
   - Must be 80-120 words of detailed refutation

2. LINK ATTACKS (labeled "DL" - De-Link):
   - "DL: [Opponent's link is wrong because...]" 
   - Explain why their solution doesn't solve
   - Show alternative causes or barriers
   - Must be 80-120 words of detailed refutation

3. IMPACT ATTACKS (labeled "No Impact"):
   - "No Impact: [Opponent's impact is wrong because...]"
   - Challenge magnitude, timeframe, or probability
   - Provide counter-evidence
   - Must be 80-120 words of detailed refutation

4. TURNS (labeled "T"):
   - "T: [Their plan actually makes things worse because...]"
   - Explain how their solution backfires
   - Must be 60-100 words

CONTENTION 2: [Quote opponent's title]
[Repeat same structure: NU, DL, No Impact, T]

REQUIREMENTS:
- Quote opponent's exact words before refuting
- Label every attack (NU, DL, No Impact, T)  
- Provide evidence for each refutation
- Be systematic and thorough
- Do NOT defend your own case - pure offense only` 

: `SECOND REBUTTAL (1AR) - Frontline AND Respond:

STRUCTURE:
1. FRONTLINES (50% of speech - 275-300 words):
   Defend your case against their attacks:
   - Address their strongest attacks on your contentions
   - Provide new evidence or analysis
   - Explain why their refutations fail
   - Extend your impacts: "Even post-refutation, we still win [X] because..."

2. RESPONSES TO THEIR CASE (50% of speech - 275-300 words):
   Continue attacking their contentions:
   - Extend your best attacks from their 1NR
   - Add new refutations if time permits
   - Use labels: "NU, DL, No Impact, T"
   - Include comparative weighing

SPLIT MANAGEMENT: Divide time roughly equally between defense and offense. Prioritize your strongest arguments and their weakest points.`}` :

roundNumber === 3 ? `
=== PRO SUMMARY SPEECH REQUIREMENTS ===

MANDATORY STRUCTURE:

1. STRATEGIC COLLAPSE (50-80 words):
   - "We're collapsing to our strongest argument: Contention [X]"
   - Explain why this argument is most important
   
2. EXTEND CHOSEN CONTENTION (150-180 words):
   - Briefly re-explain the UQ/Link/Impact
   - Address opponent's attacks from their rebuttal
   - Explain why your responses succeed
   
3. FRONTLINE/DEFENSE (100-120 words):
   - Answer opponent's specific NU/DL/Impact attacks
   - Provide new evidence or analysis
   - Explain why attacks fail
   
4. OFFENSIVE REFUTATION (80-100 words):
   - Extend your best attacks on opponent's case
   - Add new analysis from rebuttal speech
   
5. WEIGHING ANALYSIS (100-150 words):
   - Explicitly state weighing mechanism: "We outweigh on [magnitude/timeframe/probability]"
   - Compare your impact to opponent's impact
   - Warrant why your impact comes first
   - Use phrases: "We outweigh because..." "Even if they win..."
   
WEIGHING EXAMPLE:
"We outweigh on magnitude. Even if opponent wins their economic argument affecting 100,000 people, our environmental impact affects 50 million people globally. Prefer magnitude because a policy that helps more people creates greater net benefit. Additionally, we outweigh on timeframe - our benefits occur immediately while theirs take decades to materialize."

CRITICAL: Your response must be exactly ${minWords}-${wordLimit} words. This is a ${timeLimit} speech. Count your words carefully. Responses over ${wordLimit} words or under ${minWords} words will be rejected.` :

`
=== PRO FINAL FOCUS REQUIREMENTS ===

MANDATORY STRUCTURE:

1. ARGUMENT SELECTION (30-50 words):
   - Choose ONE contention to focus on
   - "In this final focus, we're extending our [X] argument"
   
2. BRIEF EXTENSION (80-100 words):
   - Quickly re-explain UQ/Link/Impact
   - Address 1-2 key opponent attacks
   - Keep this section brief
   
3. WEIGHING CRYSTALLIZATION (150-200 words):
   - Respond to opponent's weighing from their summary
   - Explain why your weighing mechanism is superior
   - Use comparative language: "prefer," "outweighs," "comes first"
   - Provide warrants for your weighing
   - This should be 70% of your speech
   
WEIGHING EXAMPLE:
"Opponent argues we should prefer timeframe, but magnitude is the superior weighing mechanism. First, certainty of impact matters more than speed - saving 50 million lives certainly outweighs potentially helping 100,000 people quickly. Second, even on timeframe, our benefits begin within months while opponent's economic effects require years of implementation. Third, prefer scope - our global impact creates positive precedent worldwide while opponent's benefits remain localized."

4. FINAL APPEAL (30-50 words):
   - Strong closing statement
   - Clear voting rationale
   
RESTRICTIONS:
- NO new arguments allowed
- Focus only on crystallizing existing arguments
- Focus only on crystallizing existing arguments
- CRITICAL: Your response must be exactly ${minWords}-${wordLimit} words. This is a ${timeLimit} speech. Count your words carefully.`}

CRITICAL REQUIREMENTS:
- STRICT WORD LIMIT: ${minWords}-${wordLimit} words (responses under ${minWords} words OR over ${wordLimit} words will be rejected)
- Write detailed, substantive arguments with specific evidence
- Quote opponents exactly before refuting
- Label all attacks in rebuttals (NU, DL, No Impact, T)
- Follow the exact structure outlined above
- Use accessible language for general audiences

FORMATTING:
- Start immediately with speech content
- Never include speaker name or round information
- Display will show: "Pro (AI) - ${speechType}"
- Remember to use the speaking style specified at the beginning throughout your entire response
`;
        } else {
          // Default 5-round format
          const isOpening = messageList.length === 0;
          const currentLanguage = languagePreferenceService.getCurrentLanguage();
          const languageInstructions = getLanguageInstructions(currentLanguage);
          
          proPrompt = `
You are an AI debater in a 5-round structured debate on: "${topic}"

${languageInstructions}

BILL CONTEXT:
${truncatedDescription || "No specific bill context provided."}

FULL DEBATE TRANSCRIPT SO FAR:
${fullTranscript}

CURRENT ROUND: ${currentRound} of ${maxRounds}
YOUR ROLE: PRO (supporting the topic)

SPEECH ${messageList.length + 1} - PRO ${isOpening ? 'CONSTRUCTIVE' : 'REBUTTAL + FRONTLINE'}:
${isOpening ?
            `RIGID FORMAT REQUIREMENT:
• Present exactly 3 main arguments in favor of the topic
• Label them clearly as: 1. [Argument Title], 2. [Argument Title], 3. [Argument Title]  
• These will be your ONLY contentions for the entire debate
• Build each argument with evidence, reasoning, and impact
• Do NOT address opponent arguments (they haven't spoken yet)
• Do NOT include any "PART 1" or "PART 2" sections - just present your 3 arguments
• Do NOT mention frontlining, rebutting, or attacking - just build your case` :
            `RIGID FORMAT REQUIREMENT:
PART 1 - FRONTLINE YOUR CASE (defend your 3 original arguments):
• Rebuild Pro Argument 1 against Con's attacks from their previous speech
• Rebuild Pro Argument 2 against Con's attacks from their previous speech
• Rebuild Pro Argument 3 against Con's attacks from their previous speech

PART 2 - CONTINUE ATTACKING CON'S CASE:
• Further refute Con Argument 1 with new analysis/evidence
• Further refute Con Argument 2 with new analysis/evidence  
• Further refute Con Argument 3 with new analysis/evidence

${messageList.length >= 6 ? 'PART 3 - WEIGHING & EXTENSIONS: Add comparative weighing, extend your strongest arguments, crystallize key clash points' : ''}`
          }

CRITICAL FORMATTING INSTRUCTIONS:
- NEVER write "AI Debater Pro" or any speaker name in your response
- NEVER write "Round X/Y" or any round information in your response  
- NEVER include headers, titles, or speaker identification
- Start your response immediately with argument content (no preamble)
- Your response will be displayed under a header that already identifies you

CONTENT REQUIREMENTS:
- STAY STRICTLY ON THE DEBATE TOPIC: "${topic}"
- Follow the RIGID FORMAT exactly as specified above
- Use clear structural markers (PART 1, PART 2, etc.)
- Address arguments by their specific titles/content
- Quote opponent's exact words when refuting
- Provide evidence, reasoning, and impact for all points
- DO NOT discuss unrelated topics like paper airplanes, coffee, or anything else

${getPersonaPrompt(proPersona)}
- Use specific evidence, examples, or logical reasoning
- Keep your response concise (max 500 words)
- Be persuasive but respectful
- End with a strong concluding statement

IMPORTANT: If this is not the opening statement, you MUST include a rebuttal of the opponent's last argument before presenting your own points.
           `;
        }
        console.log(`DEBUG: Pro Prompt Preview: ${proPrompt.substring(0, 200)}...`);
        // For Lincoln-Douglas, pass speechNum as the round number (each speech is its own round)
        // For other formats, use currentRound
        const roundToPass = debateFormat === "lincoln-douglas"
          ? messageList.filter(m => m.speaker.includes("Affirmative") || m.speaker.includes("Negative")).length + 1
          : currentRound;
        aiResponse = await generateAIResponse("AI Debater Pro", proPrompt, getProModel(), actualDescription, fullTranscript, roundToPass, getPersonaName(proPersona), debateFormat, pfSpeakingOrder);
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
        let proDisplayName;
        if (debateFormat === "lincoln-douglas") {
          const totalSpeeches = messageList.filter(m => m.speaker.includes("Affirmative") || m.speaker.includes("Negative")).length;
          let speechNum = totalSpeeches + 1;

          let speechType;
          if (speechNum === 1) speechType = "AC"; // Affirmative Constructive
          else if (speechNum === 3) speechType = "1AR"; // 1st Affirmative Rebuttal
          else if (speechNum === 5) speechType = "2AR"; // 2nd Affirmative Rebuttal

          proDisplayName = proPersona !== "default" ?
            `Affirmative (${getPersonaName(proPersona)}) - ${speechType}` :
            `Affirmative (AI) - ${speechType}`;
        } else if (debateFormat === "public-forum") {
          const totalSpeeches = messageList.filter(m => m.speaker.includes("Pro") || m.speaker.includes("Con")).length;

          // Determine speech type based on total number of speeches
          let speechTypeIndex;
          if (totalSpeeches <= 1) speechTypeIndex = 1; // Constructive round
          else if (totalSpeeches <= 3) speechTypeIndex = 2; // Rebuttal round
          else if (totalSpeeches <= 5) speechTypeIndex = 3; // Summary round
          else if (totalSpeeches <= 7) speechTypeIndex = 4; // Final Focus round (speeches 6&7&8)
          else return; // No more speeches allowed after 8 total speeches (4 rounds complete)

          let speechType;
          if (speechTypeIndex === 1) speechType = "CONSTRUCTIVE";
          else if (speechTypeIndex === 2) speechType = "REBUTTAL";
          else if (speechTypeIndex === 3) speechType = "SUMMARY";
          else speechType = "FINAL FOCUS";

          proDisplayName = proPersona !== "default" ?
            `Pro (${getPersonaName(proPersona)}) - ${speechType}` :
            `Pro (AI) - ${speechType}`;
        } else {
          proDisplayName = proPersona !== "default" ?
            `AI Debater Pro (${getPersonaName(proPersona)})` :
            "AI Debater Pro";
        }
        appendMessage(proDisplayName, cleanedResponse, getProModel());
        setAiSide("con");
      } else {
        let conPrompt;

        if (debateFormat === "lincoln-douglas") {
          // Lincoln-Douglas format for Negative
          const totalSpeeches = messageList.filter(m => m.speaker.includes("Affirmative") || m.speaker.includes("Negative")).length;

          // Determine current speech number (1-5)
          let speechNum = totalSpeeches + 1;
          if (speechNum > 5) return; // All speeches complete

          let speechType, wordLimit, timeLimit, minWords, isNegativeTurn;

          if (speechNum === 1) { // Affirmative Constructive (AC)
            isNegativeTurn = false;
          } else if (speechNum === 2) { // Negative Constructive (NC)
            speechType = "NEGATIVE CONSTRUCTIVE";
            wordLimit = 1050;
            minWords = 950;
            timeLimit = "7 minutes";
            isNegativeTurn = true;
          } else if (speechNum === 3) { // 1st Affirmative Rebuttal (1AR)
            isNegativeTurn = false;
          } else if (speechNum === 4) { // Negative Rebuttal (NR)
            speechType = "NEGATIVE REBUTTAL";
            wordLimit = 900;
            minWords = 800;
            timeLimit = "6 minutes";
            isNegativeTurn = true;
          } else if (speechNum === 5) { // 2nd Affirmative Rebuttal (2AR)
            isNegativeTurn = false;
          }

          // Skip if it's not Negative's turn
          if (!isNegativeTurn) {
            // Switch back to Affirmative
            setAiSide("pro");
            return;
          }

          conPrompt = `
You are competing in a Lincoln-Douglas debate on: "${topic}"

BILL CONTEXT:
${actualDescription}

SPEECH TYPE: ${speechType} (${timeLimit} - ${minWords}-${wordLimit} words)

${speechNum === 2 ? `
=== FIRST NEGATIVE CONSTRUCTIVE (1NC/NC) - 7 MINUTES ===

You have TWO jobs in this speech: (1) Present your OWN case, and (2) Attack the Affirmative's case.

PART 1: YOUR FRAMEWORK (250-300 words)

ATTACK THEIR FRAMEWORK:
- Explain why their value premise is inappropriate for this resolution
- Show why their criterion fails or doesn't achieve their value
- Point out contradictions or weaknesses

YOUR FRAMEWORK:
- VALUE PREMISE: State what should be valued in this debate
- VALUE CRITERION: Explain how we achieve/measure your value
- JUSTIFY: Explain why your framework is superior to theirs

PART 2: YOUR CONTENTIONS (400-450 words)

Present 2-3 contentions that NEGATE the resolution:

CONTENTION 1 (200-225 words):
- Clear thesis negating the resolution
- Evidence and warrants
- Link to YOUR framework
- Impact (why this matters)

CONTENTION 2 (200-225 words):
- Clear thesis negating the resolution
- Evidence and warrants
- Link to YOUR framework
- Impact

CONTENTION 3 (optional, if traditional debate):
- Additional contention if needed

PART 3: ATTACK AFFIRMATIVE CASE (300-350 words)

THEIR CONTENTIONS:
- Attack their strongest contentions
- Point out weak evidence, flawed warrants, or false impacts
- Show why their arguments don't link to their framework
- Use offense (show why they're wrong) AND defense (minimize their impacts)

CRITICAL: In traditional LD, you present Framework + Contentions first, THEN attack their case. In circuit LD, you might read "off-case" positions (Kritiks, Counterplans, Disads). Your response must be ${minWords}-${wordLimit} words.` :

speechNum === 4 ? `
=== SECOND NEGATIVE REBUTTAL (2NR/NR) - 6 MINUTES ===

This is your FINAL speech. You must defeat the 1AR, rebuild your case, and crystallize the round for the judge.

STRATEGIC PRIORITY: Often, debaters "collapse" down to 1-2 core positions rather than trying to cover everything. Focus on your BEST arguments.

PART 1: FRAMEWORK (150-200 words)
- Extend why your framework should be preferred
- Respond to their 1AR framework attacks
- Show you're winning the framework debate
- Explain how the judge should evaluate the round under YOUR framework

PART 2: REBUILD YOUR CASE (300-350 words)

EXTEND YOUR STRONGEST CONTENTIONS:
- Choose your 1-2 best contentions from NC
- Respond to 1AR attacks on these contentions
- Add new evidence and analysis if possible
- Explain why these contentions still stand strong
- Show why your impacts matter more

PART 3: ATTACK THEIR CASE (300-350 words)

DEFEAT THE 1AR:
- Attack their strongest contentions from AC
- Show why their impacts don't matter under your framework
- Point out arguments they dropped in 1AR (these are conceded!)
- Consolidate to 2-3 core attacks rather than spreading yourself thin

PART 4: VOTING ISSUES (100-150 words)
- Preview 2-3 reasons why Negative wins
- Make it difficult for 2AR to recover
- Emphasize your strongest arguments

CRITICAL RULES:
- NO NEW ARGUMENTS - if it wasn't in the 1NC, it can't be in the 2NR (except answering new 1AR arguments)
- This is your last speech - make every word count
- Your response must be ${minWords}-${wordLimit} words exactly.` : ''}

${getPersonaPrompt(conPersona)}

FORMATTING:
- Start immediately with speech content
- Never include speaker name or round information
- Display will show: "Negative (AI) - ${speechType}"
          `;
        } else if (debateFormat === "public-forum") {
          // Public Forum format for Con
          const totalSpeeches = messageList.filter(m => m.speaker.includes("Pro") || m.speaker.includes("Con")).length;
          const conSpeeches = messageList.filter(m => m.speaker.includes("Con")).length;
          
          // Determine speech type based on total number of speeches
          // Speech 1&2: Constructive, Speech 3&4: Rebuttal, Speech 5&6: Summary, Speech 7&8: Final Focus  
          let speechTypeIndex;
          if (totalSpeeches <= 1) speechTypeIndex = 1; // Constructive round
          else if (totalSpeeches <= 3) speechTypeIndex = 2; // Rebuttal round
          else if (totalSpeeches <= 5) speechTypeIndex = 3; // Summary round
          else if (totalSpeeches <= 7) speechTypeIndex = 4; // Final Focus round (speeches 6&7&8)
          else return; // No more speeches allowed after 8 total speeches (4 rounds complete)
          
          const roundNumber = speechTypeIndex;
          const isFirstSpeaker = (pfSpeakingOrder === "con-first");
          
          let speechType, wordLimit, timeLimit, minWords;
          if (roundNumber === 1) {
            speechType = "CONSTRUCTIVE";
            wordLimit = 600;
            minWords = 550;
            timeLimit = "4 minutes";
          } else if (roundNumber === 2) {
            speechType = "REBUTTAL";
            wordLimit = 600;
            minWords = 550;
            timeLimit = "4 minutes";
          } else if (roundNumber === 3) {
            speechType = "SUMMARY";
            wordLimit = 450;
            minWords = 400;
            timeLimit = "3 minutes";
          } else {
            speechType = "FINAL FOCUS";
            wordLimit = 300;
            minWords = 250;
            timeLimit = "2 minutes";
          }
          
          console.log(`DEBUG: Con Speech - Total speeches: ${totalSpeeches}, Speech type index: ${speechTypeIndex}, Round: ${roundNumber}, Speech Type: ${speechType}`);
          
          conPrompt = `
You are competing in a Public Forum debate on: "${topic}"

YOUR ROLE: CON (opposing the topic)

${getPersonaPrompt(conPersona)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 ABSOLUTE PRIORITY - READ THIS FIRST 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOU ARE REQUIRED TO USE THE SPEAKING STYLE SPECIFIED ABOVE IN EVERY SINGLE SENTENCE.

This is NOT optional. This is NOT a suggestion. The structural requirements below must be fulfilled WHILE MAINTAINING THE PERSONA STYLE.

Example: If you're speaking as Harris, you would say:
- "Let me be clear - what we know to be true is that AI presents serious challenges."
- NOT: "The current technological landscape presents various challenges."

Every argument, every piece of evidence, every transition MUST use the persona's language patterns. Do NOT write in formal academic style. Write as the CHARACTER would speak.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BILL CONTEXT:
${truncatedDescription || "No specific bill context provided."}

FULL DEBATE TRANSCRIPT SO FAR:
${fullTranscript}

CURRENT SPEECH: CON ${speechType} (${timeLimit})

CRITICAL WORD COUNT REQUIREMENT: 
- MINIMUM ${minWords} words, MAXIMUM ${wordLimit} words
- Your response WILL BE REJECTED if under ${minWords} words OR over ${wordLimit} words
- This is a ${timeLimit} speech - STAY WITHIN ${wordLimit} words (150 words per minute)
- Write substantial, detailed arguments within the strict word limit

${roundNumber === 1 ? `
=== CON CONSTRUCTIVE SPEECH REQUIREMENTS ===

MANDATORY STRUCTURE - Follow EXACTLY:

1. BRIEF INTRODUCTION (30-50 words):
   - State your side and opposition to the resolution
   - Preview your two contentions

2. CONTENTION 1: [Insert compelling title] (250-300 words):
   
   A. UNIQUENESS (80-100 words):
   - Explain why the current situation is good/stable
   - Provide specific statistics, examples, or evidence
   - Show why status quo is working/improving
   
   B. LINK (80-100 words):
   - Explain HOW the topic/resolution disrupts this stability
   - Provide the harm mechanism/causal chain
   - Include multiple pathways of harm if possible
   
   C. IMPACT (80-100 words):
   - Explain the specific negative outcomes that result
   - Include magnitude (how many people harmed)
   - Include timeframe (when harms occur)
   - Include probability (likelihood of harm)

3. CONTENTION 2: [Insert compelling title] (250-300 words):
   
   Follow same A-B-C structure as Contention 1
   
4. CONCLUSION (50-70 words):
   - Tie contentions together with value framework
   - Strong closing statement

EXAMPLE STRUCTURE:
"We negate the resolution. Today we present two contentions...

Contention 1: Economic Destruction
A. Uniqueness: Currently, our economy is in a period of stable growth with unemployment at historic lows... [detailed explanation with evidence]
B. Link: The resolution destroys this stability through three mechanisms... [detailed causal chain]  
C. Impact: This causes $2 trillion in economic losses, affecting 5 million jobs... [specific harms]

Contention 2: [Title]
[Same A-B-C structure]

In conclusion, we negate because..."

CRITICAL: Your response must be exactly ${minWords}-${wordLimit} words. Count your words carefully. Responses over ${wordLimit} words or under ${minWords} words will be rejected.` :

roundNumber === 2 ? `
=== CON REBUTTAL SPEECH REQUIREMENTS ===

${totalSpeeches <= 3 ? `MANDATORY STRUCTURE - Line-by-line refutation ONLY:

For EACH of opponent's contentions, provide systematic refutation:

CONTENTION 1: [Quote opponent's title]

1. UNIQUENESS ATTACKS (labeled "NU"):
   - "NU: [Opponent's uniqueness claim is wrong because...]"
   - Provide counter-evidence that problem doesn't exist
   - Show trend is improving, not worsening
   - Must be 80-120 words of detailed refutation

2. LINK ATTACKS (labeled "DL" - De-Link):
   - "DL: [Opponent's link is wrong because...]" 
   - Explain why their solution doesn't solve
   - Show alternative causes or barriers
   - Must be 80-120 words of detailed refutation

3. IMPACT ATTACKS (labeled "No Impact"):
   - "No Impact: [Opponent's impact is wrong because...]"
   - Challenge magnitude, timeframe, or probability
   - Provide counter-evidence
   - Must be 80-120 words of detailed refutation

4. TURNS (labeled "T"):
   - "T: [Their plan actually makes things worse because...]"
   - Explain how their solution backfires
   - Must be 60-100 words

CONTENTION 2: [Quote opponent's title]
[Repeat same structure: NU, DL, No Impact, T]

REQUIREMENTS:
- Quote opponent's exact words before refuting
- Label every attack (NU, DL, No Impact, T)  
- Be systematic and thorough
- Do NOT defend your own case - pure offense only` 

: `SECOND REBUTTAL (2NC) - Frontline AND Respond:

STRUCTURE:
1. FRONTLINES (50% of speech - 275-300 words):
   Defend your case against their attacks:
   - Address their strongest attacks on your contentions
   - Provide new evidence or analysis
   - Explain why their refutations fail
   - Extend your impacts: "Even post-refutation, we still win [X] because..."

2. RESPONSES TO THEIR CASE (50% of speech - 275-300 words):
   Continue attacking their contentions:
   - Extend your best attacks from their 1NC
   - Add new refutations if time permits
   - Use labels: "NU, DL, No Impact, T"
   - Include comparative weighing

SPLIT MANAGEMENT: Divide time roughly equally between defense and offense. Prioritize your strongest arguments and their weakest points.`}

CRITICAL: Your response must be exactly ${minWords}-${wordLimit} words. Count your words carefully. Responses over ${wordLimit} words or under ${minWords} words will be rejected.` :

roundNumber === 3 ? `
=== CON SUMMARY SPEECH REQUIREMENTS ===

MANDATORY STRUCTURE:

1. STRATEGIC COLLAPSE (50-80 words):
   - "We're collapsing to our strongest argument: Contention [X]"
   - Explain why this argument is most important
   
2. EXTEND CHOSEN CONTENTION (150-180 words):
   - Briefly re-explain the UQ/Link/Impact
   - Address opponent's attacks from their rebuttal
   - Explain why your responses succeed
   
3. FRONTLINE/DEFENSE (100-120 words):
   - Answer opponent's specific NU/DL/Impact attacks
   - Provide new evidence or analysis
   - Explain why attacks fail
   
4. OFFENSIVE REFUTATION (80-100 words):
   - Extend your best attacks on opponent's case
   - Add new analysis from rebuttal speech
   
5. WEIGHING ANALYSIS (100-150 words):
   - Explicitly state weighing mechanism: "We outweigh on [magnitude/timeframe/probability]"
   - Compare your impact to opponent's impact
   - Warrant why your impact comes first
   - Use phrases: "We outweigh because..." "Even if they win..."
   
WEIGHING EXAMPLE:
"We outweigh on certainty. Even if opponent wins their environmental argument affecting millions theoretically, our economic harm affecting 100,000 people is guaranteed and immediate. Prefer certainty because speculative benefits cannot justify concrete costs. Additionally, we outweigh on timeframe - our harms begin immediately while their benefits require decades of uncertain implementation."

CRITICAL: Your response must be exactly ${minWords}-${wordLimit} words. This is a ${timeLimit} speech. Count your words carefully. Responses over ${wordLimit} words or under ${minWords} words will be rejected.` :

`
=== CON FINAL FOCUS REQUIREMENTS ===

MANDATORY STRUCTURE:

1. ARGUMENT SELECTION (30-50 words):
   - Choose ONE contention to focus on
   - "In this final focus, we're extending our [X] argument"
   
2. BRIEF EXTENSION (80-100 words):
   - Quickly re-explain UQ/Link/Impact
   - Address 1-2 key opponent attacks
   - Keep this section brief
   
3. WEIGHING CRYSTALLIZATION (150-200 words):
   - Respond to opponent's weighing from their summary
   - Explain why your weighing mechanism is superior
   - Use comparative language: "prefer," "outweighs," "comes first"
   - Provide warrants for your weighing
   - This should be 70% of your speech
   
WEIGHING EXAMPLE:
"Opponent argues we should prefer magnitude, but certainty is the superior weighing mechanism. First, concrete harms outweigh speculative benefits - our economic damage is guaranteed while opponent's environmental benefits are uncertain. Second, even on magnitude, our economic impact creates ripple effects affecting millions indirectly. Third, prefer timeframe - our immediate harms require urgent prevention while opponent's distant benefits allow time for alternative solutions."

4. FINAL APPEAL (30-50 words):
   - Strong closing statement
   - Clear voting rationale
   
RESTRICTIONS:
- NO new arguments allowed
- Focus only on crystallizing existing arguments
- CRITICAL: Your response must be exactly ${minWords}-${wordLimit} words. This is a ${timeLimit} speech. Count your words carefully.`}

CRITICAL REQUIREMENTS:
- STRICT WORD LIMIT: ${minWords}-${wordLimit} words (responses under ${minWords} words OR over ${wordLimit} words will be rejected)
- Write detailed, substantive arguments with specific evidence
- Quote opponents exactly before refuting
- Label all attacks in rebuttals (NU, DL, No Impact, T)
- Follow the exact structure outlined above
- Use accessible language for general audiences

FORMATTING:
- Start immediately with speech content
- Never include speaker name or round information
- Display will show: "Con (AI) - ${speechType}"
- Remember to use the speaking style specified at the beginning throughout your entire response
`;
        } else {
          // Default 5-round format
          const conHasSpoken = messageList.some(msg => msg.speaker.includes("Con"));
          const isOpening = !conHasSpoken;
          conPrompt = `
You are an AI debater in a 5-round structured debate on: "${topic}"

BILL CONTEXT:
${truncatedDescription || "No specific bill context provided."}

FULL DEBATE TRANSCRIPT SO FAR:
${fullTranscript}

CURRENT ROUND: ${currentRound} of ${maxRounds}
YOUR ROLE: CON (opposing the topic)

SPEECH ${messageList.length + 1} - CON ${isOpening ? 'CONSTRUCTIVE + REBUTTAL' : 'REBUTTAL + FRONTLINE'}:
${isOpening ?
            `RIGID FORMAT REQUIREMENT:
PART 1 - PRESENT YOUR CASE (3 arguments against the topic):
• 1. [Con Argument Title] - Build with evidence, reasoning, and impact
• 2. [Con Argument Title] - Build with evidence, reasoning, and impact  
• 3. [Con Argument Title] - Build with evidence, reasoning, and impact
These will be your ONLY contentions for the entire debate.

PART 2 - REFUTE PRO'S CASE (from Pro's previous speech):
• Address Pro's Argument 1: Quote their exact words, explain why it's wrong
• Address Pro's Argument 2: Quote their exact words, explain why it's wrong  
• Address Pro's Argument 3: Quote their exact words, explain why it's wrong` :
            `RIGID FORMAT REQUIREMENT:
PART 1 - FRONTLINE YOUR CASE (defend your 3 original arguments):
• Rebuild Con Argument 1 against Pro's attacks from their previous speech
• Rebuild Con Argument 2 against Pro's attacks from their previous speech
• Rebuild Con Argument 3 against Pro's attacks from their previous speech

PART 2 - CONTINUE ATTACKING PRO'S CASE:
• Further refute Pro Argument 1 with new analysis/evidence
• Further refute Pro Argument 2 with new analysis/evidence
• Further refute Pro Argument 3 with new analysis/evidence

${messageList.length >= 7 ? 'PART 3 - WEIGHING & EXTENSIONS: Add comparative weighing, extend your strongest arguments, crystallize key clash points' : ''}`
          }

CRITICAL FORMATTING INSTRUCTIONS:
- NEVER write "AI Debater Con" or any speaker name in your response
- NEVER write "Round X/Y" or any round information in your response  
- NEVER include headers, titles, or speaker identification
- Start your response immediately with argument content (no preamble)
- Your response will be displayed under a header that already identifies you

CONTENT REQUIREMENTS:
- STAY STRICTLY ON THE DEBATE TOPIC: "${topic}"
- Follow the RIGID FORMAT exactly as specified above
- Use clear structural markers (PART 1, PART 2, etc.)
- Address arguments by their specific titles/content
- Quote opponent's exact words when refuting
- Provide evidence, reasoning, and impact for all points
- DO NOT discuss unrelated topics like paper airplanes, coffee, or anything else

${getPersonaPrompt(conPersona)}
- Use specific evidence, examples, or logical reasoning
- Keep your response concise (max 500 words)
- Be persuasive but respectful
- End with a strong concluding statement

IMPORTANT: If this is not the opening statement, you MUST include a rebuttal of the opponent's last argument before presenting your own points.
           `;
        }
        console.log(`🔍 DEBUG: Con Prompt Preview: ${conPrompt.substring(0, 200)}...`);
        // For Lincoln-Douglas, pass speechNum as the round number (each speech is its own round)
        // For other formats, use currentRound
        const roundToPass = debateFormat === "lincoln-douglas"
          ? messageList.filter(m => m.speaker.includes("Affirmative") || m.speaker.includes("Negative")).length + 1
          : currentRound;
        aiResponse = await generateAIResponse("AI Debater Con", conPrompt, getConModel(), actualDescription, fullTranscript, roundToPass, getPersonaName(conPersona), debateFormat, pfSpeakingOrder);
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
        let conDisplayName;
        if (debateFormat === "lincoln-douglas") {
          const totalSpeeches = messageList.filter(m => m.speaker.includes("Affirmative") || m.speaker.includes("Negative")).length;
          let speechNum = totalSpeeches + 1;

          let speechType;
          if (speechNum === 2) speechType = "NC"; // Negative Constructive
          else if (speechNum === 4) speechType = "NR"; // Negative Rebuttal

          conDisplayName = conPersona !== "default" ?
            `Negative (${getPersonaName(conPersona)}) - ${speechType}` :
            `Negative (AI) - ${speechType}`;
        } else if (debateFormat === "public-forum") {
          const totalSpeeches = messageList.filter(m => m.speaker.includes("Pro") || m.speaker.includes("Con")).length;

          // Determine speech type based on total number of speeches
          let speechTypeIndex;
          if (totalSpeeches <= 1) speechTypeIndex = 1; // Constructive round
          else if (totalSpeeches <= 3) speechTypeIndex = 2; // Rebuttal round
          else if (totalSpeeches <= 5) speechTypeIndex = 3; // Summary round
          else if (totalSpeeches <= 7) speechTypeIndex = 4; // Final Focus round (speeches 6&7&8)
          else return; // No more speeches allowed after 8 total speeches (4 rounds complete)

          let speechType;
          if (speechTypeIndex === 1) speechType = "CONSTRUCTIVE";
          else if (speechTypeIndex === 2) speechType = "REBUTTAL";
          else if (speechTypeIndex === 3) speechType = "SUMMARY";
          else speechType = "FINAL FOCUS";

          conDisplayName = conPersona !== "default" ?
            `Con (${getPersonaName(conPersona)}) - ${speechType}` :
            `Con (AI) - ${speechType}`;
        } else {
          conDisplayName = conPersona !== "default" ?
            `AI Debater Con (${getPersonaName(conPersona)})` :
            "AI Debater Con";
        }
        appendMessage(conDisplayName, cleanedResponse, getConModel());
        setAiSide("pro");
        setCurrentRound(prev => prev + 1);
      }
    } catch (err) {
      console.error("Error in AI debate:", err);
      setError(t('error.failedToGenerate'));
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
      console.log(`🔍 DEBUG [handleChooseSide]: ===== AI OPENING GENERATION =====`);
      console.log(`🔍 DEBUG [handleChooseSide]: firstSide = "${firstSide}"`);
      console.log(`🔍 DEBUG [handleChooseSide]: user selected side = "${side}"`);
      console.log(`🔍 DEBUG [handleChooseSide]: debateFormat = "${debateFormat}"`);
      console.log(`🔍 DEBUG [handleChooseSide]: pfSpeakingOrder = "${pfSpeakingOrder}"`);

      if (firstSide === "con" && side === "pro") {
        // AI goes first as Con, user will be Pro
        console.log(`🔍 DEBUG [handleChooseSide]: AI will open as CON, user is PRO`);
        let conPrompt;
        if (debateFormat === "public-forum") {
          // Build detailed PF prompt with persona (same as when AI goes second)
          conPrompt = `You are competing in a Public Forum debate on: "${topic}"

YOUR ROLE: CON (opposing the topic)

${getPersonaPrompt(aiPersona)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 ABSOLUTE PRIORITY - READ THIS FIRST 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOU ARE REQUIRED TO USE THE SPEAKING STYLE SPECIFIED ABOVE IN EVERY SINGLE SENTENCE.

This is NOT optional. This is NOT a suggestion. The debate requirements below must be fulfilled WHILE MAINTAINING THE PERSONA STYLE.

Example: If you're Trump, say "Look, AI is incredible, believe me!" NOT "AI presents significant opportunities."
Example: If you're Harris, say "Let me be clear - the data shows..." NOT "The data indicates..."

Every argument, every piece of evidence, every transition MUST use the persona's language patterns. Do NOT write in formal academic style. Write as the CHARACTER would speak.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BILL CONTEXT:
${truncatedDescription || "No specific bill context provided."}

CURRENT SPEECH: CON CONSTRUCTIVE (Opening speech)

=== CONSTRUCTIVE SPEECH REQUIREMENTS ===

MANDATORY STRUCTURE (in your character's voice):

1. BRIEF INTRODUCTION (30-50 words):
   - State your side using your character's style
   - Preview your two contentions

2. CONTENTION 1: [Compelling title] (200-250 words):
   A. UNIQUENESS: Explain the current problem in your character's voice
   B. LINK: Show how your side solves it using your speaking style
   C. IMPACT: Explain the benefits in your character's language

3. CONTENTION 2: [Compelling title] (200-250 words):
   A. UNIQUENESS: Current situation explained in character
   B. LINK: Solution mechanism in your voice
   C. IMPACT: Real-world benefits using your style

4. CONCLUSION (30-50 words in character)

FORMATTING:
- Start immediately with speech content
- Never include speaker name or round information
- Remember to use the speaking style specified at the beginning throughout your entire response
- USE THE PERSONA STYLE in every sentence
`;
          console.log(`🔍 DEBUG [handleChooseSide]: Built detailed PF prompt with persona`);
        } else if (debateFormat === "lincoln-douglas") {
          // Build detailed LD prompt with persona
          conPrompt = `You are competing in a Lincoln-Douglas debate on: "${topic}"

YOUR ROLE: NEGATIVE (negating the resolution)

${getPersonaPrompt(aiPersona)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 ABSOLUTE PRIORITY - READ THIS FIRST 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOU ARE REQUIRED TO USE THE SPEAKING STYLE SPECIFIED ABOVE IN EVERY SINGLE SENTENCE.

Example: If you're Trump, say "Look, justice is simple, okay? Believe me!" NOT "Justice requires careful consideration."

Every argument MUST use the persona's language patterns. Write as the CHARACTER would speak.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BILL CONTEXT:
${truncatedDescription || "No specific bill context provided."}

SPEECH TYPE: NEGATIVE CONSTRUCTIVE (Opening speech)

Present your framework (Value/Criterion) and 2-3 contentions against the resolution, all in your character's voice.
`;
          console.log(`🔍 DEBUG [handleChooseSide]: Built detailed LD prompt with persona`);
        } else {
          conPrompt = `
             Debate topic: "${topic}"
             Bill description: "${truncatedDescription}"
             Your role: Opening speaker for the CON side

             ${getPersonaPrompt(aiPersona)}

             Instructions:
             1. Provide an opening argument against the topic
             2. Present 2-3 strong arguments for the CON position
             3. Keep your response concise (max 400 words)
             4. Be persuasive and clear
             5. End with a strong statement
           `;
        }
        console.log(`🔍 DEBUG [handleChooseSide]: Calling generateAIResponse with:`);
        console.log(`  - debater: "AI Debater (Con)"`);
        console.log(`  - model: "${getSingleAIModel()}"`);
        console.log(`  - round_num: 1`);
        console.log(`  - persona: "${getPersonaName(aiPersona)}"`);
        console.log(`  - debate_format: "${debateFormat}"`);
        console.log(`  - speaking_order: "${pfSpeakingOrder}"`);
        const conResponse = await generateAIResponse("AI Debater (Con)", conPrompt, getSingleAIModel(), actualDescription, "", 1, getPersonaName(aiPersona), debateFormat, pfSpeakingOrder);
        const aiDisplayName = aiPersona !== "default" ?
          `Con (AI - ${getPersonaName(aiPersona)})` :
          "Con (AI)";
        appendMessage(aiDisplayName, conResponse, getSingleAIModel());
      } else if (firstSide === "pro" && side === "con") {
        // AI goes first as Pro, user will be Con
        console.log(`🔍 DEBUG [handleChooseSide]: AI will open as PRO, user is CON`);
        const currentLanguage = languagePreferenceService.getCurrentLanguage();
        const languageInstructions = getLanguageInstructions(currentLanguage);
        
        let proPrompt;
        if (debateFormat === "public-forum") {
          // Build detailed PF prompt with persona (same as when AI goes second)
          proPrompt = `You are competing in a Public Forum debate on: "${topic}"

${languageInstructions}

YOUR ROLE: PRO (supporting the topic)

${getPersonaPrompt(aiPersona)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 ABSOLUTE PRIORITY - READ THIS FIRST 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOU ARE REQUIRED TO USE THE SPEAKING STYLE SPECIFIED ABOVE IN EVERY SINGLE SENTENCE.

This is NOT optional. This is NOT a suggestion. The debate requirements below must be fulfilled WHILE MAINTAINING THE PERSONA STYLE.

Example: If you're Trump, say "Look, AI is incredible, believe me!" NOT "AI presents significant opportunities."
Example: If you're Harris, say "Let me be clear - the data shows..." NOT "The data indicates..."

Every argument, every piece of evidence, every transition MUST use the persona's language patterns. Do NOT write in formal academic style. Write as the CHARACTER would speak.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BILL CONTEXT:
${truncatedDescription || "No specific bill context provided."}

CURRENT SPEECH: PRO CONSTRUCTIVE (Opening speech)

=== CONSTRUCTIVE SPEECH REQUIREMENTS ===

MANDATORY STRUCTURE (in your character's voice):

1. BRIEF INTRODUCTION (30-50 words):
   - State your side using your character's style
   - Preview your two contentions

2. CONTENTION 1: [Compelling title] (200-250 words):
   A. UNIQUENESS: Explain the current problem in your character's voice
   B. LINK: Show how your side solves it using your speaking style
   C. IMPACT: Explain the benefits in your character's language

3. CONTENTION 2: [Compelling title] (200-250 words):
   A. UNIQUENESS: Current situation explained in character
   B. LINK: Solution mechanism in your voice
   C. IMPACT: Real-world benefits using your style

4. CONCLUSION (30-50 words in character)

FORMATTING:
- Start immediately with speech content
- Never include speaker name or round information
- Remember to use the speaking style specified at the beginning throughout your entire response
- USE THE PERSONA STYLE in every sentence
`;
          console.log(`🔍 DEBUG [handleChooseSide]: Built detailed PF prompt with persona`);
        } else if (debateFormat === "lincoln-douglas") {
          // Build detailed LD prompt with persona
          proPrompt = `You are competing in a Lincoln-Douglas debate on: "${topic}"

${languageInstructions}

YOUR ROLE: AFFIRMATIVE (affirming the resolution)

${getPersonaPrompt(aiPersona)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 ABSOLUTE PRIORITY - READ THIS FIRST 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOU ARE REQUIRED TO USE THE SPEAKING STYLE SPECIFIED ABOVE IN EVERY SINGLE SENTENCE.

Example: If you're Trump, say "Look, justice is simple, okay? Believe me!" NOT "Justice requires careful consideration."

Every argument MUST use the persona's language patterns. Write as the CHARACTER would speak.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BILL CONTEXT:
${truncatedDescription || "No specific bill context provided."}

SPEECH TYPE: AFFIRMATIVE CONSTRUCTIVE (Opening speech)

Present your framework (Value/Criterion) and 2-3 contentions supporting the resolution, all in your character's voice.
`;
          console.log(`🔍 DEBUG [handleChooseSide]: Built detailed LD prompt with persona`);
        } else {
          proPrompt = `
             Debate topic: "${topic}"
             
${languageInstructions}
             
             Bill description: "${truncatedDescription}"
             Your role: Opening speaker for the PRO side

             ${getPersonaPrompt(aiPersona)}

             Instructions:
             1. Provide an opening argument in favor of the topic
             2. Present 2-3 strong arguments for the PRO position
             3. Keep your response concise (max 400 words)
             4. Be persuasive and clear
             5. End with a strong statement
           `;
        }
        console.log(`🔍 DEBUG [handleChooseSide]: Calling generateAIResponse with:`);
        console.log(`  - debater: "AI Debater (Pro)"`);
        console.log(`  - model: "${getSingleAIModel()}"`);
        console.log(`  - round_num: 1`);
        console.log(`  - persona: "${getPersonaName(aiPersona)}"`);
        console.log(`  - debate_format: "${debateFormat}"`);
        console.log(`  - speaking_order: "${pfSpeakingOrder}"`);
        const proResponse = await generateAIResponse("AI Debater (Pro)", proPrompt, getSingleAIModel(), actualDescription, "", 1, getPersonaName(aiPersona), debateFormat, pfSpeakingOrder);
        const aiDisplayName = aiPersona !== "default" ?
          `Pro (AI - ${getPersonaName(aiPersona)})` :
          "Pro (AI)";
        appendMessage(aiDisplayName, proResponse, getSingleAIModel());
      }
    } catch (err) {
      setError(t('error.failedToFetchOpening'));
    } finally {
      setLoading(false);
    }
  };

  const handleUserVsAISubmit = async () => {
    if (!userInput.trim()) {
      alert(t('error.inputBlank'));
      return;
    }
    if (!userSide) {
      setError(t('error.chooseSide'));
      return;
    }
    // Check if debate is complete
    if (!canUserInput()) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Calculate round BEFORE appending message, since state updates are async
      // messageList.length = current speeches
      // +1 = user message we're about to add
      // +1 = AI message we're about to generate
      const currentSpeeches = messageList.length;
      const userSpeechNumber = currentSpeeches + 1;
      const aiSpeechNumber = currentSpeeches + 2;

      // For Lincoln-Douglas, each speech is its own round (1 speaker per round)
      // For other formats, 2 speakers per round
      let userRound, aiRound;
      if (debateFormat === "lincoln-douglas") {
        userRound = userSpeechNumber;  // Speech 1 = Round 1, Speech 2 = Round 2, etc.
        aiRound = aiSpeechNumber;
      } else {
        userRound = Math.ceil(userSpeechNumber / 2);  // 2 speeches per round
        aiRound = Math.ceil(aiSpeechNumber / 2);
      }

      console.log(`🔍 DEBUG [User vs AI]: Current speeches: ${currentSpeeches}, User speech #${userSpeechNumber} (Round ${userRound}), AI speech #${aiSpeechNumber} (Round ${aiRound})`);

      appendMessage(
        userSide === "pro" ? "Pro (User)" : "Con (User)",
        userInput,
        null,  // no model for user
        userRound  // pass calculated round
      );
      setUserInput("");

      // Check if user just submitted the final speech - don't generate AI response
      if (debateFormat === "lincoln-douglas" && userSpeechNumber === 5) {
        console.log(`🔍 DEBUG [User vs AI]: User submitted 2AR (final speech). Debate complete.`);
        setLoading(false);
        return; // Don't generate AI response after final speech
      }

      // For Public Forum, check if user submitted the final speech (8th speech)
      if (debateFormat === "public-forum" && userSpeechNumber === 8) {
        console.log(`🔍 DEBUG [User vs AI]: User submitted final speech (8/8). Debate complete.`);
        setLoading(false);
        return; // Don't generate AI response after final speech
      }

      // For other formats, check if user submitted the final speech
      if (debateFormat !== "lincoln-douglas" && debateFormat !== "public-forum" && userSpeechNumber === (maxRounds * 2)) {
        console.log(`🔍 DEBUG [User vs AI]: User submitted final speech. Debate complete.`);
        setLoading(false);
        return; // Don't generate AI response after final speech
      }

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

      console.log(`🔍 DEBUG [User vs AI]: ===== PROMPT GENERATION START =====`);
      console.log(`🔍 DEBUG [User vs AI]: debateFormat = "${debateFormat}"`);
      console.log(`🔍 DEBUG [User vs AI]: aiSideLocal = "${aiSideLocal}"`);
      console.log(`🔍 DEBUG [User vs AI]: userSide = "${userSide}"`);
      console.log(`🔍 DEBUG [User vs AI]: pfSpeakingOrder = "${pfSpeakingOrder}"`);

      // Use the same prompt building logic as AI vs AI mode
      // This ensures PF/LD formats are respected in User vs AI mode
      let aiPrompt;

      // For Public Forum and Lincoln-Douglas, build full prompts with persona
      // This ensures personas work correctly in User vs AI mode
      if (debateFormat === "public-forum" || debateFormat === "lincoln-douglas") {
        console.log(`🔍 DEBUG [User vs AI]: Building full ${debateFormat} prompt with persona`);

        // Determine which side AI is on
        const aiIsProOrAff = aiSideLocal.toLowerCase() === "pro";
        const currentPersona = aiIsProOrAff ? proPersona : conPersona;

        // Build format-specific prompt with persona
        if (debateFormat === "public-forum") {
          // Public Forum prompts for User vs AI
          const pfRoundType = aiSpeechNumber <= 2 ? "CONSTRUCTIVE" :
                             aiSpeechNumber <= 4 ? "REBUTTAL" :
                             aiSpeechNumber <= 6 ? "SUMMARY" : "FINAL FOCUS";

          const currentLanguage = languagePreferenceService.getCurrentLanguage();
          const languageInstructions = getLanguageInstructions(currentLanguage);
          
          aiPrompt = `You are competing in a Public Forum debate on: "${topic}"

${languageInstructions}

YOUR ROLE: ${aiSideLocal.toUpperCase()} (debating against the user's ${userSide.toUpperCase()} position)

${getPersonaPrompt(currentPersona)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 ABSOLUTE PRIORITY - READ THIS FIRST 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOU ARE REQUIRED TO USE THE SPEAKING STYLE SPECIFIED ABOVE IN EVERY SINGLE SENTENCE.

This is NOT optional. This is NOT a suggestion. The debate requirements below must be fulfilled WHILE MAINTAINING THE PERSONA STYLE.

Example: If you're Trump, say "Look, AI is incredible, believe me!" NOT "AI presents significant opportunities."
Example: If you're Harris, say "Let me be clear - the data shows..." NOT "The data indicates..."

Every argument, every piece of evidence, every transition MUST use the persona's language patterns. Do NOT write in formal academic style. Write as the CHARACTER would speak.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BILL CONTEXT:
${truncatedDescription || "No specific bill context provided."}

FULL DEBATE TRANSCRIPT SO FAR:
${fullTranscript}

CURRENT SPEECH: ${aiSideLocal.toUpperCase()} ${pfRoundType}

${pfRoundType === "CONSTRUCTIVE" ? `
=== CONSTRUCTIVE SPEECH REQUIREMENTS ===

MANDATORY STRUCTURE (in your character's voice):

1. BRIEF INTRODUCTION (30-50 words):
   - State your side using your character's style
   - Preview your two contentions

2. CONTENTION 1: [Compelling title] (200-250 words):
   A. UNIQUENESS: Explain the current problem in your character's voice
   B. LINK: Show how your side solves it using your speaking style
   C. IMPACT: Explain the benefits in your character's language

3. CONTENTION 2: [Compelling title] (200-250 words):
   A. UNIQUENESS: Current situation explained in character
   B. LINK: Solution mechanism in your voice
   C. IMPACT: Real-world benefits using your style

4. CONCLUSION (30-50 words in character)
` : pfRoundType === "REBUTTAL" ? `
=== REBUTTAL SPEECH REQUIREMENTS ===

STRUCTURE (maintain character throughout):

1. BRIEF SIGNPOST (20-30 words in your voice)

2. ATTACK USER'S CASE (200-250 words in character):
   - Refute their Contention 1 using your style
   - Refute their Contention 2 in your voice

3. REBUILD YOUR CASE (150-200 words in character):
   - Defend your contentions using your speaking style
   - Extend your impacts in your voice
` : pfRoundType === "SUMMARY" ? `
=== SUMMARY SPEECH REQUIREMENTS ===

STRUCTURE (in character):

1. FRAME THE DEBATE (50-75 words in your voice)
2. EXTEND YOUR CASE (150-175 words using your style)
3. COLLAPSE USER'S ARGUMENTS (150-175 words in character)
4. WEIGHING (50-75 words in your voice)
` : `
=== FINAL FOCUS REQUIREMENTS ===

STRUCTURE (in character):

1. VOTING ISSUES (200-250 words in your voice):
   - 2-3 clear reasons to vote for your side
   - Use your character's speaking style throughout
`}

FORMATTING:
- Start immediately with speech content
- Never include speaker name or round information
- Your response will be displayed with proper identification
- Remember to use the speaking style specified at the beginning throughout your entire response

CRITICAL:
- Directly respond to the user's arguments from their last speech
- Quote their specific points when refuting
- Build on the debate that has occurred - don't just repeat previous speeches
- Keep your response clear and accessible (max 500 words)
- USE THE PERSONA STYLE in every sentence
`;
        } else {
          // Lincoln-Douglas prompts for User vs AI
          const ldSpeechType = aiSpeechNumber === 1 ? "AFFIRMATIVE CONSTRUCTIVE" :
                              aiSpeechNumber === 2 ? "NEGATIVE CONSTRUCTIVE" :
                              aiSpeechNumber === 3 ? "FIRST AFFIRMATIVE REBUTTAL" :
                              aiSpeechNumber === 4 ? "NEGATIVE REBUTTAL" :
                              "SECOND AFFIRMATIVE REBUTTAL";

          const isConstructive = aiSpeechNumber <= 2;

          const currentLanguage = languagePreferenceService.getCurrentLanguage();
          const languageInstructions = getLanguageInstructions(currentLanguage);
          
          aiPrompt = `You are competing in a Lincoln-Douglas debate on: "${topic}"

${languageInstructions}

YOUR ROLE: ${aiSideLocal.toUpperCase() === "PRO" ? "AFFIRMATIVE" : "NEGATIVE"} (debating against the user's ${userSide.toUpperCase()} position)

${getPersonaPrompt(currentPersona)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 ABSOLUTE PRIORITY - READ THIS FIRST 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOU ARE REQUIRED TO USE THE SPEAKING STYLE SPECIFIED ABOVE IN EVERY SINGLE SENTENCE.

This is NOT optional. This is NOT a suggestion. The debate requirements below must be fulfilled WHILE MAINTAINING THE PERSONA STYLE.

Example: If you're Trump, say "Look, justice is simple, okay? Believe me!" NOT "Justice requires careful consideration."
Example: If you're Musk, say "From a first principles standpoint..." NOT "Philosophically speaking..."

Every argument, every piece of evidence, every transition MUST use the persona's language patterns. Do NOT write in formal academic style. Write as the CHARACTER would speak.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BILL CONTEXT:
${truncatedDescription || "No specific bill context provided."}

FULL DEBATE TRANSCRIPT SO FAR:
${fullTranscript}

SPEECH TYPE: ${ldSpeechType}

LINCOLN-DOUGLAS REQUIREMENTS:
- Build arguments around ethical values and moral principles
- ${isConstructive ? 'Establish your Value Premise and Value Criterion' : 'Extend your framework and contentions'}
- Use philosophical arguments and logical reasoning
- ${isConstructive ? 'Present 2-3 main contentions' : 'Attack opponent\'s framework and contentions'}
- Link all arguments to your value framework
- ${!isConstructive ? 'Focus on key clash points and voting issues' : 'Build your philosophical case clearly'}

FORMATTING:
- Start immediately with speech content
- Never include speaker name or round information
- Your response will be displayed with proper identification
- Remember to use the speaking style specified at the beginning throughout your entire response

CRITICAL:
- Directly respond to the user's arguments from their last speech
- Quote their specific points when refuting
- ${!isConstructive ? 'Focus on extending your strongest arguments' : 'Present your case with clear framework and contentions'}
- Keep your response substantive but clear (max 600 words)
- USE THE PERSONA STYLE in every sentence
`;
        }
        console.log(`🔍 DEBUG [User vs AI]: Built ${debateFormat} prompt with ${currentPersona} persona`);
      } else {
        console.log(`🔍 DEBUG [User vs AI]: Using default 5-round format prompt`);

        // Default 5-round format - use the existing logic
        const aiHasSpoken = messageList.some(msg => msg.speaker.includes(aiSideLocal));
        const isOpening = !aiHasSpoken;

        const currentLanguage = languagePreferenceService.getCurrentLanguage();
        const languageInstructions = getLanguageInstructions(currentLanguage);
        
        aiPrompt = `
You are an AI debater in a structured debate on: "${topic}"

${languageInstructions}

BILL CONTEXT:
${truncatedDescription || "No specific bill context provided."}

FULL DEBATE TRANSCRIPT SO FAR:
${fullTranscript}

YOUR ROLE: ${aiSideLocal.toUpperCase()} (opposing the user's ${userSide.toUpperCase()} position)

RIGID DEBATE FORMAT:
${isOpening && messageList.length === 1 ?
          `AI CONSTRUCTIVE + REBUTTAL:
RIGID FORMAT REQUIREMENT:
PART 1 - PRESENT YOUR CASE (3 arguments for ${aiSideLocal.toUpperCase()}):
• 1. [${aiSideLocal} Argument Title] - Build with evidence, reasoning, and impact
• 2. [${aiSideLocal} Argument Title] - Build with evidence, reasoning, and impact
• 3. [${aiSideLocal} Argument Title] - Build with evidence, reasoning, and impact
These will be your ONLY contentions for the entire debate.

PART 2 - REFUTE USER'S CASE (from their previous speech):
• Address User's Argument 1: Quote their exact words, explain why it's wrong
• Address User's Argument 2: Quote their exact words, explain why it's wrong
• Address User's Argument 3: Quote their exact words, explain why it's wrong` :
          isOpening ?
          `AI CONSTRUCTIVE:
RIGID FORMAT REQUIREMENT:
• Present exactly 3 main arguments for the ${aiSideLocal.toUpperCase()} position
• Label them clearly as: 1. [Argument Title], 2. [Argument Title], 3. [Argument Title]
• These will be your ONLY contentions for the entire debate
• Build each argument with evidence, reasoning, and impact
• Do NOT address user arguments (they haven't spoken yet)` :
          `AI REBUTTAL + FRONTLINE:
RIGID FORMAT REQUIREMENT:
PART 1 - FRONTLINE YOUR CASE (defend your 3 original arguments):
• Rebuild ${aiSideLocal} Argument 1 against User's attacks from their previous speech
• Rebuild ${aiSideLocal} Argument 2 against User's attacks from their previous speech
• Rebuild ${aiSideLocal} Argument 3 against User's attacks from their previous speech

PART 2 - CONTINUE ATTACKING USER'S CASE:
• Further refute User Argument 1 with new analysis/evidence
• Further refute User Argument 2 with new analysis/evidence
• Further refute User Argument 3 with new analysis/evidence

${messageList.length >= 6 ? 'PART 3 - WEIGHING & EXTENSIONS: Add comparative weighing, extend your strongest arguments, crystallize key clash points' : ''}`
        }

CRITICAL FORMATTING INSTRUCTIONS:
- NEVER write "AI Debater" or any speaker name in your response
- NEVER include headers, titles, or speaker identification
- Start your response immediately with argument content (no preamble)
- Your response will be displayed under a header that already identifies you

CONTENT REQUIREMENTS:
- STAY STRICTLY ON THE DEBATE TOPIC: "${topic}"
- Follow the RIGID FORMAT exactly as specified above
- Use clear structural markers (PART 1, PART 2, etc.)
- Address arguments by their specific titles/content
- Quote user's exact words when refuting
- Provide evidence, reasoning, and impact for all points
- DO NOT discuss unrelated topics like paper airplanes, coffee, or anything else

**CRITICAL - RESPONSIVE DEBATE ENGAGEMENT:**
• **DO NOT simply restate your previous arguments** - you must EVOLVE your position based on opponent's responses
• **DIRECTLY QUOTE** specific words/phrases from opponent's last speech and explain why they're wrong
• **ADDRESS NEW POINTS** - if opponent raised new objections, you MUST respond to them specifically
• **BUILD ON THE CLASH** - identify where you and opponent disagree and explain why your view is superior
• **AVOID REPETITION** - each speech should add NEW analysis, evidence, or framing, not just repeat old points
• **SHOW PROGRESSION** - demonstrate you're listening and adapting, not reading from a script

${getPersonaPrompt(aiPersona)}
- Use specific evidence, examples, or logical reasoning
- Keep your response concise (max 400 words)
- Be persuasive but respectful
- End with a strong concluding statement

IMPORTANT: If this is not the opening statement, you MUST include a rebuttal of the user's argument before presenting your own points.
         `;
      }

      // Build the full transcript to send to the AI
      const updatedMessageList = [...messageList, {
        speaker: userSide === "pro" ? "Pro (User)" : "Con (User)",
        text: userInput,
        round: userRound
      }];

      const fullTranscriptForAI = updatedMessageList
        .map(({ speaker, text, model }) => {
          const modelInfo = model ? `*Model: ${model}*\n\n` : "";
          return `## ${speaker}\n${modelInfo}${text}`;
        })
        .join("\n\n---\n\n");

      // Additional safety checks for all formats
      if (debateFormat === "lincoln-douglas" && aiSpeechNumber > 5) {
        console.log(`🔍 DEBUG [User vs AI]: AI speech would exceed 5 speeches limit. Stopping.`);
        setLoading(false);
        return;
      }

      if (debateFormat === "public-forum" && aiSpeechNumber > 8) {
        console.log(`🔍 DEBUG [User vs AI]: AI speech would exceed 8 speeches limit. Stopping.`);
        setLoading(false);
        return;
      }

      if (debateFormat !== "lincoln-douglas" && debateFormat !== "public-forum" && aiSpeechNumber > (maxRounds * 2)) {
        console.log(`🔍 DEBUG [User vs AI]: AI speech would exceed ${maxRounds * 2} speeches limit. Stopping.`);
        setLoading(false);
        return;
      }

      console.log(`🔍 DEBUG [User vs AI]: ===== SENDING TO BACKEND =====`);
      console.log(`🔍 DEBUG [User vs AI]: Current speeches: ${currentSpeeches}, User speech #${userSpeechNumber} (Round ${userRound}), AI speech #${aiSpeechNumber} (Round ${aiRound})`);
      console.log(`🔍 DEBUG [User vs AI]: Full prompt being sent:`);
      console.log(`🔍 DEBUG [User vs AI]: ===== PROMPT START =====`);
      console.log(aiPrompt);
      console.log(`🔍 DEBUG [User vs AI]: ===== PROMPT END =====`);
      console.log(`🔍 DEBUG [User vs AI]: Full transcript to AI (${fullTranscriptForAI.length} chars)`);
      console.log(`🔍 DEBUG [User vs AI]: Transcript preview: ${fullTranscriptForAI.substring(0, 300)}...`);
      console.log(`🔍 DEBUG [User vs AI]: Parameters:`);
      console.log(`  - debater: "AI Debater (${aiSideLocal})"`);
      console.log(`  - model: "${getSingleAIModel()}"`);
      console.log(`  - actualDescription length: ${actualDescription?.length || 0}`);
      console.log(`  - round_num: ${aiRound}`);
      console.log(`  - persona: "${getPersonaName(aiPersona)}"`);
      console.log(`  - debate_format: "${debateFormat}"`);
      console.log(`  - speaking_order: "${pfSpeakingOrder}"`);

      const aiResponse = await generateAIResponse(`AI Debater (${aiSideLocal})`, aiPrompt, getSingleAIModel(), actualDescription, fullTranscriptForAI, aiRound, getPersonaName(aiPersona), debateFormat, pfSpeakingOrder);
      const aiDisplayName = aiPersona !== "default" ?
        `${aiSideLocal} (AI - ${getPersonaName(aiPersona)})` :
        `${aiSideLocal} (AI)`;
      appendMessage(aiDisplayName, aiResponse, getSingleAIModel(), aiRound);
      setCurrentRound(prev => prev + 1);
    } catch (err) {
      console.error("Error in User vs AI debate:", err);
      setError(t('error.failedToFetchRebuttal'));
    } finally {
      setLoading(false);
    }
  };

  const handleUserVsAISubmitAndEnd = async () => {
    if (!userInput.trim()) {
      alert(t('error.inputBlank'));
      return;
    }
    if (!userSide) {
      setError(t('error.chooseSide'));
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
          judgeModel: getJudgeModel()
        }
      });
    } catch (err) {
      setError(t('error.failedToSend'));
    } finally {
      setLoading(false);
    }
  };

  const handleUserVsUser = () => {
    if (!userInput.trim()) {
      alert(t('error.inputBlank'));
      return;
    }

    // Check if debate is complete
    if (!canUserInput()) {
      return;
    }

    const currentUserName = userVsUserSide === "pro" ? userVsUserSetup.proUser : userVsUserSetup.conUser;
    const speakerLabel = `${userVsUserSide.toUpperCase()} (${currentUserName})`;

    // Calculate correct round number based on format
    let roundNumber;
    const totalSpeeches = messageList.length + 1;

    if (debateFormat === "lincoln-douglas") {
      // LD: each speech is its own round (5 speeches = 5 rounds)
      roundNumber = totalSpeeches;
    } else if (debateFormat === "public-forum") {
      // PF: 2 speeches per round (8 speeches = 4 rounds)
      roundNumber = Math.ceil(totalSpeeches / 2);
    } else {
      // Default: 2 speeches per round
      roundNumber = Math.ceil(totalSpeeches / 2);
    }

    appendMessage(speakerLabel, userInput.trim(), null, roundNumber);
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
      setError(t('error.enterNames'));
      return;
    }
    setUserVsUserSetup(prev => ({ ...prev, confirmed: true }));
    // In LD, Affirmative (Pro) always starts; otherwise use selected first speaker
    if (debateFormat === 'lincoln-douglas') {
      setUserVsUserSide('pro');
    } else {
      setUserVsUserSide(userVsUserSetup.firstSpeaker);
    }
    setError("");
  };

  return (
    <div className={`debate-container ${sidebarExpanded ? 'sidebar-open' : ''}`}>
      {/* Back to Home button in the top right corner */}
      <button className="back-to-home" onClick={handleBackToHome}>
        {t('debate.backToHome')}
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
            <h2 className="debate-topic-header">{t('debate.topic')}: {topic}</h2>
            {actualDescription && (
              <button
                className="toggle-description"
                onClick={() => setDescriptionExpanded(!descriptionExpanded)}
              >
                {descriptionExpanded ? t('debate.hideBillText') : t('debate.showBillText')}
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
                  <div className="debate-model-selector-wrapper">
                    <label className="debate-model-label">
                      {t('debate.proModel')}:
                      <div className="debate-model-toggle-group">
                        <div className="debate-model-toggle-buttons">
                          <button
                            type="button"
                            className={`debate-model-toggle-btn ${proModelType === "suggested" ? "active" : ""}`}
                            onClick={() => setProModelType("suggested")}
                          >
                            Suggested Models
                          </button>
                          <button
                            type="button"
                            className={`debate-model-toggle-btn ${proModelType === "custom" ? "active" : ""}`}
                            onClick={() => setProModelType("custom")}
                          >
                            Custom Model
                          </button>
                        </div>
                        {proModelType === "suggested" ? (
                          <select className="debate-model-select" value={proModel} onChange={(e) => setProModel(e.target.value)}>
                            {modelOptions.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            className="debate-model-custom-input"
                            placeholder="e.g., openai/gpt-4o, anthropic/claude-3.5-sonnet"
                            value={proModelCustom}
                            onChange={(e) => setProModelCustom(e.target.value)}
                          />
                        )}
                      </div>
                    </label>
                  </div>
                  <div className="debate-model-selector-wrapper">
                    <label className="debate-model-label">
                      {t('debate.conModel')}:
                      <div className="debate-model-toggle-group">
                        <div className="debate-model-toggle-buttons">
                          <button
                            type="button"
                            className={`debate-model-toggle-btn ${conModelType === "suggested" ? "active" : ""}`}
                            onClick={() => setConModelType("suggested")}
                          >
                            Suggested Models
                          </button>
                          <button
                            type="button"
                            className={`debate-model-toggle-btn ${conModelType === "custom" ? "active" : ""}`}
                            onClick={() => setConModelType("custom")}
                          >
                            Custom Model
                          </button>
                        </div>
                        {conModelType === "suggested" ? (
                          <select className="debate-model-select" value={conModel} onChange={(e) => setConModel(e.target.value)}>
                            {modelOptions.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            className="debate-model-custom-input"
                            placeholder="e.g., openai/gpt-4o, anthropic/claude-3.5-sonnet"
                            value={conModelCustom}
                            onChange={(e) => setConModelCustom(e.target.value)}
                          />
                        )}
                      </div>
                    </label>
                  </div>
                </>
              )}
              {actualMode === "ai-vs-user" && (
                <>
                  <div className="debate-model-selector-wrapper">
                    <label className="debate-model-label">
                      {t('debate.aiModel')}:
                      <div className="debate-model-toggle-group">
                        <div className="debate-model-toggle-buttons">
                          <button
                            type="button"
                            className={`debate-model-toggle-btn ${singleAIModelType === "suggested" ? "active" : ""}`}
                            onClick={() => setSingleAIModelType("suggested")}
                          >
                            Suggested Models
                          </button>
                          <button
                            type="button"
                            className={`debate-model-toggle-btn ${singleAIModelType === "custom" ? "active" : ""}`}
                            onClick={() => setSingleAIModelType("custom")}
                          >
                            Custom Model
                          </button>
                        </div>
                        {singleAIModelType === "suggested" ? (
                          <select className="debate-model-select" value={singleAIModel} onChange={(e) => setSingleAIModel(e.target.value)}>
                            {modelOptions.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            className="debate-model-custom-input"
                            placeholder="e.g., openai/gpt-4o, anthropic/claude-3.5-sonnet"
                            value={singleAIModelCustom}
                            onChange={(e) => setSingleAIModelCustom(e.target.value)}
                          />
                        )}
                      </div>
                    </label>
                  </div>
                </>
              )}
              <div className="debate-model-selector-wrapper">
                <label className="debate-model-label">
                  {t('debate.judgeModel')}:
                  <div className="debate-model-toggle-group">
                    <div className="debate-model-toggle-buttons">
                      <button
                        type="button"
                        className={`debate-model-toggle-btn ${judgeModelType === "suggested" ? "active" : ""}`}
                        onClick={() => setJudgeModelType("suggested")}
                      >
                        Suggested Models
                      </button>
                      <button
                        type="button"
                        className={`debate-model-toggle-btn ${judgeModelType === "custom" ? "active" : ""}`}
                        onClick={() => setJudgeModelType("custom")}
                      >
                        Custom Model
                      </button>
                    </div>
                    {judgeModelType === "suggested" ? (
                      <select className="debate-model-select" value={judgeModel} onChange={(e) => setJudgeModel(e.target.value)}>
                        {modelOptions.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="debate-model-custom-input"
                        placeholder="e.g., openai/gpt-4o, anthropic/claude-3.5-sonnet"
                        value={judgeModelCustom}
                        onChange={(e) => setJudgeModelCustom(e.target.value)}
                      />
                    )}
                  </div>
                </label>
              </div>
            </div>
          )}
          {/* Render each speech as its own block */}
          {messageList.map(({ speaker, text, model }, i) => {
            const speechItem = speechList[i];
            const speechTitle = speechItem?.title || speaker;
            const speechId = `speech-${i}`;

            return (
              <div key={i} className="debate-speech-block relative" id={speechId}>
                <div className="debate-speech-header">
                  <h3 className="debate-speech-title">{speechTitle}</h3>
                  <div className="debate-speech-tts">
                    <EnhancedVoiceOutput
                      text={text}
                      useGoogleTTS={true}
                      ttsApiUrl={TTS_CONFIG.apiUrl}
                      buttonStyle="compact"
                      showLabel={false}
                      context="debate"
                      onSpeechStart={() => console.log(`Speech started for ${speaker}`)}
                      onSpeechEnd={() => console.log(`Speech ended for ${speaker}`)}
                      onSpeechError={(error) => console.error(`Speech error for ${speaker}:`, error)}
                    />
                  </div>
                </div>
                {model && <div className="debate-model-info">{t('debate.model')}: {model}</div>}

                <div className="debate-speech-content">
                  <ReactMarkdown
                    components={{
                      h1: ({ node, ...props }) => <h1 className="debate-markdown-h1" {...props} />,
                      h2: ({ node, ...props }) => <h2 className="debate-markdown-h2" {...props} />,
                      h3: ({ node, ...props }) => <h3 className="debate-markdown-h3" {...props} />,
                      h4: ({ node, ...props }) => <h4 className="debate-markdown-h4" {...props} />,
                      p: ({ node, ...props }) => <p className="debate-markdown-p" {...props} />,
                      ul: ({ node, ...props }) => <ul className="debate-markdown-ul" {...props} />,
                      ol: ({ node, ...props }) => <ol className="debate-markdown-ol" {...props} />,
                      li: ({ node, ...props }) => <li className="debate-markdown-li" {...props} />,
                      strong: ({ node, ...props }) => <strong className="debate-markdown-strong" {...props} />,
                      em: ({ node, ...props }) => <em className="debate-markdown-em" {...props} />,
                      hr: ({ node, ...props }) => <hr className="debate-markdown-hr" {...props} />
                    }}
                  >
                    {text}
                  </ReactMarkdown>
                </div>
              </div>
            );
          })}
          {actualMode === "ai-vs-ai" && (
            (debateFormat === "public-forum" && pfOrderSelected) ||
            (debateFormat === "lincoln-douglas" && ldOrderSelected) ||
            (debateFormat !== "public-forum" && debateFormat !== "lincoln-douglas")
          ) && (
            <div style={{ marginTop: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
              {!autoMode ? (
                <>
                  <button
                    onClick={handleAIDebate}
                    disabled={loading || (() => {
                      const aiSpeeches = countAISpeeches(messageList);
                      return debateFormat === "lincoln-douglas" ? aiSpeeches >= 5 : aiSpeeches >= (maxRounds * 2);
                    })()}
                    style={{
                      background: "#4a90e2",
                      color: "white",
                      border: "none",
                      padding: "0.75rem 1.5rem",
                      borderRadius: "6px",
                      cursor: loading || (() => {
                        const aiSpeeches = countAISpeeches(messageList);
                        return debateFormat === "lincoln-douglas" ? aiSpeeches >= 5 : aiSpeeches >= (maxRounds * 2);
                      })() ? "not-allowed" : "pointer",
                      opacity: loading || (() => {
                        const aiSpeeches = countAISpeeches(messageList);
                        return debateFormat === "lincoln-douglas" ? aiSpeeches >= 5 : aiSpeeches >= (maxRounds * 2);
                      })() ? 0.6 : 1
                    }}
                  >
                    {(() => {
                      const aiSpeeches = countAISpeeches(messageList);
                      if (loading) return t('debate.generating');

                      const limitReached = debateFormat === "lincoln-douglas" ? aiSpeeches >= 5 : aiSpeeches >= (maxRounds * 2);
                      if (limitReached) return t('debate.roundLimitReached');
                      
                      // Calculate the correct display for different formats
                      let buttonText;
                      if (debateFormat === "lincoln-douglas") {
                        const totalSpeeches = aiSpeeches;
                        let speechName = "";
                        if (totalSpeeches === 0) speechName = "AC";
                        else if (totalSpeeches === 1) speechName = "NC";
                        else if (totalSpeeches === 2) speechName = "1AR";
                        else if (totalSpeeches === 3) speechName = "NR";
                        else if (totalSpeeches === 4) speechName = "2AR";

                        return `${t('debate.generateSpeech')} ${speechName} (${totalSpeeches + 1}/5)`;
                      } else if (debateFormat === "public-forum") {
                        const totalSpeeches = aiSpeeches;
                        let displayRound;
                        if (totalSpeeches <= 1) displayRound = 1;
                        else if (totalSpeeches <= 3) displayRound = 2;
                        else if (totalSpeeches <= 5) displayRound = 3;
                        else if (totalSpeeches <= 7) displayRound = 4;
                        else displayRound = 4; // Should never reach here due to disable logic

                        return aiSide === "pro"
                          ? `${t('debate.generateProRound')} ${t('debate.round')} ${displayRound}/${maxRounds}`
                          : `${t('debate.generateConRound')} ${t('debate.round')} ${displayRound}/${maxRounds}`;
                      } else {
                        return aiSide === "pro"
                          ? `${t('debate.generateProRound')} ${t('debate.round')} ${currentRound}/${maxRounds}`
                          : `${t('debate.generateConRound')} ${t('debate.round')} ${currentRound}/${maxRounds}`;
                      }
                    })()}
                  </button>
                  <button
                    onClick={startAutoDebate}
                    disabled={loading || (() => {
                      const aiSpeeches = countAISpeeches(messageList);
                      return debateFormat === "lincoln-douglas" ? aiSpeeches >= 5 : aiSpeeches >= (maxRounds * 2);
                    })()}
                    style={{
                      background: "#28a745",
                      color: "white",
                      border: "none",
                      padding: "0.75rem 1.5rem",
                      borderRadius: "6px",
                      cursor: loading || (() => {
                        const aiSpeeches = countAISpeeches(messageList);
                        return debateFormat === "lincoln-douglas" ? aiSpeeches >= 5 : aiSpeeches >= (maxRounds * 2);
                      })() ? "not-allowed" : "pointer",
                      opacity: loading || (() => {
                        const aiSpeeches = countAISpeeches(messageList);
                        return debateFormat === "lincoln-douglas" ? aiSpeeches >= 5 : aiSpeeches >= (maxRounds * 2);
                      })() ? 0.6 : 1
                    }}
                  >
                    {t('debate.autoGenerate')}
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
                  {t('debate.stopAuto')}
                </button>
              )}
            </div>
          )}
          {debateFormat === "public-forum" && actualMode === "ai-vs-ai" && !pfOrderSelected && (
            <div className="ai-vs-user-setup">
              <div className="setup-header">
                <h3>{t('debate.publicForumSetup')}</h3>
                <button 
                  className="info-button"
                  onClick={() => setShowPfInfo(true)}
                  title="More information about Public Forum debate format"
                >
                  ?
                </button>
              </div>
              <p style={{ color: '#fff' }}>{t('debate.chooseSpeakingOrder')}</p>
              <div className="order-selection">
                <label>{t('debate.speakingOrder')}</label>
                <div className="order-buttons">
                  <button
                    className={`order-button ${pfSpeakingOrder === 'pro-first' ? 'selected' : ''}`}
                    onClick={() => setPfSpeakingOrder('pro-first')}
                  >
                    {t('debate.proSpeaksFirstRound')}
                  </button>
                  <button
                    className={`order-button ${pfSpeakingOrder === 'con-first' ? 'selected' : ''}`}
                    onClick={() => setPfSpeakingOrder('con-first')}
                  >
                    {t('debate.conSpeaksFirstRound')}
                  </button>
                </div>
              </div>

              <div className="confirm-section">
                <button
                  className="confirm-button"
                  onClick={() => setPfOrderSelected(true)}
                >
                  {t('debate.startPublicForum')}
                </button>
              </div>
            </div>
          )}
          {debateFormat === "lincoln-douglas" && actualMode === "ai-vs-ai" && !ldOrderSelected && (
                      <div className="ai-vs-user-setup">
                        <div className="setup-header">
                          <h3>{t('debate.lincolnDouglasSetup')}</h3>
                          <button
                            className="info-button"
                            onClick={() => setShowLdInfo(true)}
                            title="More information about Lincoln-Douglas debate format"
                          >
                            ?
                          </button>
                        </div>
                        <p style={{ color: '#fff' }}>
                          {t('debate.affirmativeStarts')}
                        </p>

                        <div className="confirm-section">
                          <button
                            className="confirm-button"
                            onClick={() => setLdOrderSelected(true)}
                          >
                            {t('debate.startLincolnDouglas')}
                          </button>
                        </div>
                      </div>
                    )}

          {/* Lincoln-Douglas Info Popup */}
          {showLdInfo && (
            <div className="popup-overlay" onClick={() => setShowLdInfo(false)}>
              <div className="popup-content" onClick={(e) => e.stopPropagation()}>
                <div className="popup-header">
                  <h3>{t('debate.format.ld.title')}</h3>
                  <button
                    className="close-button"
                    onClick={() => setShowLdInfo(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="popup-body">
                  <p style={{ color: 'white', marginBottom: '0.75rem' }}>
                    <strong>{t('debate.format.ld.speakingOrder')}</strong> {t('debate.format.ld.speakingOrderText')}
                  </p>
                  <h4>{t('debate.format.ld.structure')}</h4>
                  <div className="round-structure">
                    <div className="round-item">
                      <strong>{t('debate.format.ld.ac.title')}</strong> {t('debate.format.ld.ac.time')}
                      <p>{t('debate.format.ld.ac.desc')}</p>
                    </div>
                    <div className="round-item">
                      <strong>{t('debate.format.ld.nc.title')}</strong> {t('debate.format.ld.nc.time')}
                      <p>{t('debate.format.ld.nc.desc')}</p>
                    </div>
                    <div className="round-item">
                      <strong>{t('debate.format.ld.1ar.title')}</strong> {t('debate.format.ld.1ar.time')}
                      <p>{t('debate.format.ld.1ar.desc')}</p>
                    </div>
                    <div className="round-item">
                      <strong>{t('debate.format.ld.nr.title')}</strong> {t('debate.format.ld.nr.time')}
                      <p>{t('debate.format.ld.nr.desc')}</p>
                    </div>
                    <div className="round-item">
                      <strong>{t('debate.format.ld.2ar.title')}</strong> {t('debate.format.ld.2ar.time')}
                      <p>{t('debate.format.ld.2ar.desc')}</p>
                    </div>
                  </div>
                  <h4>{t('debate.format.ld.keyFeatures')}</h4>
                  <ul>
                    <li><strong>{t('debate.format.ld.feature1.title')}</strong> {t('debate.format.ld.feature1.desc')}</li>
                    <li><strong>{t('debate.format.ld.feature2.title')}</strong> {t('debate.format.ld.feature2.desc')}</li>
                    <li><strong>{t('debate.format.ld.feature3.title')}</strong> {t('debate.format.ld.feature3.desc')}</li>
                  </ul>
                  <p style={{ fontSize: '0.9em', fontStyle: 'italic', marginTop: '1rem', color: 'white' }}>
                    <strong>{t('debate.format.ld.note')}</strong> {t('debate.format.ld.noteText')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Public Forum Info Popup */}
          {showPfInfo && (
            <div className="popup-overlay" onClick={() => setShowPfInfo(false)}>
              <div className="popup-content" onClick={(e) => e.stopPropagation()}>
                <div className="popup-header">
                  <h3>{t('debate.format.pf.title')}</h3>
                  <button
                    className="close-button"
                    onClick={() => setShowPfInfo(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="popup-body">
                  <h4>{t('debate.format.pf.structure')}</h4>
                  <div className="round-structure">
                    <div className="round-item">
                      <strong>{t('debate.format.pf.round1.title')}</strong> {t('debate.format.pf.round1.name')}
                      <p>{t('debate.format.pf.round1.desc')}</p>
                    </div>
                    <div className="round-item">
                      <strong>{t('debate.format.pf.round2.title')}</strong> {t('debate.format.pf.round2.name')}
                      <p>{t('debate.format.pf.round2.desc')}</p>
                    </div>
                    <div className="round-item">
                      <strong>{t('debate.format.pf.round3.title')}</strong> {t('debate.format.pf.round3.name')}
                      <p>{t('debate.format.pf.round3.desc')}</p>
                    </div>
                    <div className="round-item">
                      <strong>{t('debate.format.pf.round4.title')}</strong> {t('debate.format.pf.round4.name')}
                      <p>{t('debate.format.pf.round4.desc')}</p>
                    </div>
                  </div>
                  <div className="format-details">
                    <h4>{t('debate.format.pf.keyFeatures')}</h4>
                    <ul>
                      <li>{t('debate.format.pf.feature1')}</li>
                      <li>{t('debate.format.pf.feature2')}</li>
                      <li>{t('debate.format.pf.feature3')}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {actualMode === "ai-vs-user" && (
            <>
              {!userSide && (
                <div className="ai-vs-user-setup">
                  <div className="setup-header">
                    <h3>{t('debate.setupDebate')}</h3>
                    <button
                      className="info-button"
                      onClick={() => debateFormat === 'public-forum' ? setShowPfInfo(true) : setShowLdInfo(true)}
                      title={`${t('debate.format.moreInfo')} ${debateFormat === 'public-forum' ? t('legislation.format.publicForum.title') : t('legislation.format.ld.title')} ${t('debate.format.debateFormat')}`}
                    >
                      ?
                    </button>
                  </div>
                  <p style={{ color: '#fff' }}>
                    {debateFormat === 'lincoln-douglas'
                      ? t('debate.chooseSideLD')
                      : t('debate.chooseSideOrder')}
                  </p>
                  <div className="side-selection-cards">
                    <div
                      className={`side-card ${selectedSide === 'pro' ? 'selected' : ''}`}
                      onClick={() => setSelectedSide("pro")}
                    >
                      <h4>{t('debate.arguePro')}</h4>
                      <p>{t('debate.supportTopic')}</p>
                      <p className="speaking-order">
                        {t('debate.youWillGo')} {firstSide === 'pro' ? t('debate.first') : t('debate.second')}
                      </p>
                    </div>

                    <div
                      className={`side-card ${selectedSide === 'con' ? 'selected' : ''}`}
                      onClick={() => setSelectedSide("con")}
                    >
                      <h4>{t('debate.argueCon')}</h4>
                      <p>{t('debate.opposeTopic')}</p>
                      <p className="speaking-order">
                        {t('debate.youWillGo')} {firstSide === 'con' ? t('debate.first') : t('debate.second')}
                      </p>
                    </div>
                  </div>

                  {debateFormat !== 'lincoln-douglas' && (
                    <div className="order-selection">
                      <label>{t('debate.speakingOrder')}</label>
                      <div className="order-buttons">
                        <button
                          className={`order-button ${firstSide === 'pro' ? 'selected' : ''}`}
                          onClick={() => setFirstSide('pro')}
                        >
                          {t('debate.proSpeaksFirst')}
                        </button>
                        <button
                          className={`order-button ${firstSide === 'con' ? 'selected' : ''}`}
                          onClick={() => setFirstSide('con')}
                        >
                          {t('debate.conSpeaksFirst')}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="confirm-section">
                    <button
                      className="confirm-button"
                      disabled={!selectedSide}
                      onClick={() => handleChooseSide(selectedSide)}
                    >
                      {selectedSide ? `${t('debate.startAs')} ${selectedSide.toUpperCase()}` : t('debate.selectPosition')}
                    </button>
                  </div>
                </div>
              )}
              {userSide && (
                <div className="ai-vs-user-setup">
                  <h3>{t('debate.debateAs')} {userSide.toUpperCase()} {t('debate.vsAI')}</h3>

                  <SimpleFileUpload
                    onTextExtracted={(text) => setUserInput(text)}
                    disabled={loading || !canUserInput()}
                  />

                  <VoiceInput
                    onTranscript={(text) => setUserInput(text)}
                    disabled={loading || !canUserInput()}
                    placeholder={`${t('debate.speakArgument')} ${userSide === "pro" ? t('debate.arguePro') : t('debate.argueCon')} ${t('debate.argument')}`}
                  />

                  <textarea
                    placeholder={`${t('debate.enterArgument')} ${userSide === "pro" ? t('debate.arguePro') : t('debate.argueCon')}`}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    rows={4}
                    disabled={!canUserInput()}
                    style={{ width: "100%", resize: "vertical", marginBottom: "1rem" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !loading && userInput.trim().length > 0 && canUserInput()) {
                        e.preventDefault();
                        handleUserVsAISubmit();
                      }
                    }}
                  />

                  <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
                    <button
                      onClick={handleUserVsAISubmit}
                      disabled={loading || !userInput.trim() || !canUserInput()}
                      style={{
                        background: "#4a90e2",
                        color: "white",
                        border: "none",
                        padding: "0.75rem 1.5rem",
                        borderRadius: "6px",
                        cursor: loading || !userInput.trim() || !canUserInput() ? "not-allowed" : "pointer",
                        opacity: loading || !userInput.trim() || !canUserInput() ? 0.6 : 1
                      }}
                    >
                      {loading ? t('debate.generating') : !canUserInput() ? t('debate.debateComplete') : t('debate.sendGetReply')}
                    </button>

                    {(firstSide === "con" && userSide === "pro") ||
                      (firstSide === "pro" && userSide === "con") ? (
                      <button
                        onClick={handleUserVsAISubmitAndEnd}
                        disabled={loading || !userInput.trim() || !canUserInput()}
                        style={{
                          background: "#6c757d",
                          color: "white",
                          border: "none",
                          padding: "0.75rem 1.5rem",
                          borderRadius: "6px",
                          cursor: loading || !userInput.trim() || !canUserInput() ? "not-allowed" : "pointer",
                          opacity: loading || !userInput.trim() || !canUserInput() ? 0.6 : 1
                        }}
                      >
                        {t('debate.sendEnd')}
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
                  <h3>{t('debate.setupUserVsUser')}</h3>

                  <div className="user-name-inputs">
                    <div className="name-input-group">
                      <label>{t('debate.proDebaterName')}</label>
                      <input
                        type="text"
                        placeholder={t('debate.enterProName')}
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
                      <label>{t('debate.conDebaterName')}</label>
                      <input
                        type="text"
                        placeholder={t('debate.enterConName')}
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

                  {debateFormat === 'lincoln-douglas' ? (
                    <p style={{ color: '#fff' }}>{t('debate.affirmativeStarts')}</p>
                  ) : (
                    <div className="order-selection">
                      <label>{t('debate.whoSpeaksFirst')}</label>
                      <div className="order-buttons">
                        <button
                          className={`order-button ${userVsUserSetup.firstSpeaker === 'pro' ? 'selected' : ''}`}
                          onClick={() => setUserVsUserSetup(prev => ({ ...prev, firstSpeaker: 'pro' }))}
                        >
                          {userVsUserSetup.proUser || t('debate.arguePro')} {t('debate.speaksFirst')}
                        </button>
                        <button
                          className={`order-button ${userVsUserSetup.firstSpeaker === 'con' ? 'selected' : ''}`}
                          onClick={() => setUserVsUserSetup(prev => ({ ...prev, firstSpeaker: 'con' }))}
                        >
                          {userVsUserSetup.conUser || t('debate.argueCon')} {t('debate.speaksFirst')}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="debate-model-selection" style={{ marginBottom: "1.5rem" }}>
                    <div className="debate-model-selector-wrapper">
                      <label className="debate-model-label">
                        {t('debate.judgeModel')}:
                        <div className="debate-model-toggle-group">
                          <div className="debate-model-toggle-buttons">
                            <button
                              type="button"
                              className={`debate-model-toggle-btn ${judgeModelType === "suggested" ? "active" : ""}`}
                              onClick={() => setJudgeModelType("suggested")}
                            >
                              Suggested Models
                            </button>
                            <button
                              type="button"
                              className={`debate-model-toggle-btn ${judgeModelType === "custom" ? "active" : ""}`}
                              onClick={() => setJudgeModelType("custom")}
                            >
                              Custom Model
                            </button>
                          </div>
                          {judgeModelType === "suggested" ? (
                            <select className="debate-model-select" value={judgeModel} onChange={(e) => setJudgeModel(e.target.value)}>
                              {modelOptions.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              className="debate-model-custom-input"
                              placeholder="e.g., openai/gpt-4o, anthropic/claude-3.5-sonnet"
                              value={judgeModelCustom}
                              onChange={(e) => setJudgeModelCustom(e.target.value)}
                            />
                          )}
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="confirm-section">
                    <button
                      className="confirm-button"
                      disabled={!userVsUserSetup.proUser.trim() || !userVsUserSetup.conUser.trim()}
                      onClick={handleUserVsUserConfirm}
                    >
                      {userVsUserSetup.proUser.trim() && userVsUserSetup.conUser.trim()
                        ? t('debate.startDebateBtn')
                        : t('debate.enterBothNames')
                      }
                    </button>
                  </div>
                </div>
              )}

              {userVsUserSetup.confirmed && (
                <div className="user-vs-user-setup">
                  <h3>{t('debate.userVsUser')}</h3>
                  <p style={{ marginBottom: "1rem", color: "#fff" }}>
                    {t('debate.currentTurn')}: <strong>
                      {userVsUserSide === "pro" ? userVsUserSetup.proUser : userVsUserSetup.conUser}
                    </strong> ({userVsUserSide.toUpperCase()})
                  </p>

                  <SimpleFileUpload
                    onTextExtracted={(text) => setUserInput(text)}
                    disabled={loading || !canUserInput()}
                  />

                  <VoiceInput
                    onTranscript={(text) => setUserInput(text)}
                    disabled={loading || !canUserInput()}
                    placeholder={`${t('debate.speakArgument')} ${userVsUserSide === "pro" ? t('debate.arguePro') : t('debate.argueCon')} ${t('debate.argument')}`}
                  />

                  <textarea
                    placeholder={`${t('debate.enterArgument')} ${userVsUserSide === "pro" ? t('debate.arguePro') : t('debate.argueCon')}`}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    rows={4}
                    disabled={!canUserInput()}
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
                      if (e.key === "Enter" && !e.shiftKey && !loading && userInput.trim().length > 0 && canUserInput()) {
                        e.preventDefault();
                        handleUserVsUser();
                      }
                    }}
                  />

                  <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
                    <button
                      onClick={handleUserVsUser}
                      disabled={loading || !userInput.trim() || !canUserInput()}
                      style={{
                        background: "#4a90e2",
                        color: "white",
                        border: "none",
                        padding: "0.75rem 1.5rem",
                        borderRadius: "6px",
                        cursor: loading || !userInput.trim() || !canUserInput() ? "not-allowed" : "pointer",
                        opacity: loading || !userInput.trim() || !canUserInput() ? 0.6 : 1,
                        fontSize: "1rem"
                      }}
                    >
                      {!canUserInput() ? t('debate.debateComplete') : `${t('debate.sendAs')} ${userVsUserSide === "pro" ? userVsUserSetup.proUser : userVsUserSetup.conUser}`}
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
                      {t('debate.restartSetup')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {error && <p style={{ color: "red" }}>{error}</p>}
          {loading && !error && (
            <LoadingSpinner
              message={t('debate.generatingAI')}
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
              {t('debate.endDebate')}
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
            {t('debate.giveFeedback')}
          </a>
          <a
            href="https://github.com/alexliao95311/DebateSim"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
          >
            <Code size={16} />
            {t('debate.github')}
          </a>
        </div>
        <span className="copyright">&copy; {new Date().getFullYear()} DebateSim. {t('debate.allRightsReserved')}</span>
      </footer>
    </div>
  );
}

export default Debate;