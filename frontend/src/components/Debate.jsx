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
      return messages.filter(m =>
        m.speaker === "AI Debater Pro" || m.speaker === "AI Debater Con"
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
      if (msg.speaker === "AI Debater Pro" || msg.speaker === "AI Debater Con") {
        title = speechTypeLabel
          ? `${msg.speaker} - ${speechTypeLabel} (Round ${roundNum}/${maxRounds})`
          : `${msg.speaker} - Round ${roundNum}/${maxRounds}`;
      } else if (msg.speaker.includes("(AI)")) {
        // For User vs AI mode, add round info for AI responses
        title = speechTypeLabel
          ? `${msg.speaker} - ${speechTypeLabel}`
          : `${msg.speaker} - Round ${roundNum}`;
      } else if (msg.speaker.includes("(User)")) {
        // For User vs AI mode, add round info for user responses
        title = speechTypeLabel
          ? `${msg.speaker} - ${speechTypeLabel}`
          : `${msg.speaker} - Round ${roundNum}`;
      } else if (msg.speaker.includes("Pro (User)") || msg.speaker.includes("Con (User)")) {
        // For User vs User mode, add round info
        title = speechTypeLabel
          ? `${msg.speaker} - ${speechTypeLabel}`
          : `${msg.speaker} - Round ${roundNum}`;
      } else if (msg.speaker.includes("Judge")) {
        // For judge feedback, don't add round number
        title = msg.speaker;
      } else {
        // For any other speaker, add round number
        title = speechTypeLabel
          ? `${msg.speaker} - ${speechTypeLabel} (Round ${roundNum})`
          : `${msg.speaker} - Round ${roundNum}`;
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

          proPrompt = `
You are competing in a Lincoln-Douglas debate on: "${topic}"

BILL CONTEXT:
${actualDescription}

SPEECH TYPE: ${speechType} (${timeLimit} - ${minWords}-${wordLimit} words)

${speechNum === 1 ? `
=== AFFIRMATIVE CONSTRUCTIVE REQUIREMENTS ===

FRAMEWORK (Required):
- Present your VALUE PREMISE (what should be most valued in this debate)
- Present your VALUE CRITERION (how we measure/achieve your value)
- Explain why your framework should be preferred

CONTENTIONS (Required):
- Present 2-3 main contentions supporting the resolution
- Each contention should have:
  * Clear claim/thesis
  * Strong evidence and reasoning
  * Connection to your value framework
  * Real-world examples/impacts

STRUCTURE:
1. Value Premise and Criterion (150-200 words)
2. Framework Justification (100-150 words)
3. Contention 1 with evidence (200-250 words)
4. Contention 2 with evidence (200-250 words)
5. Contention 3 with evidence (150-200 words)
6. Summary linking back to framework (100 words)

CRITICAL: Your response must be exactly ${minWords}-${wordLimit} words. Count your words carefully.` :

speechNum === 3 ? `
=== 1ST AFFIRMATIVE REBUTTAL REQUIREMENTS ===

DEFENSE (First Half):
- Respond to Negative attacks on your framework
- Defend your value premise and criterion
- Extend your strongest contentions with new evidence
- Clarify any misrepresented arguments

OFFENSE (Second Half):
- Attack the Negative's framework if weak
- Point out contradictions in their case
- Extend impacts from your contentions
- Show why you're winning key framework debates

STRATEGY:
- Spend ~300 words on defense, ~300 words on offense
- Prioritize framework debates - they determine the round
- Don't drop major arguments or concede framework
- Set up voting issues for 2AR

CRITICAL: Your response must be exactly ${minWords}-${wordLimit} words. Count your words carefully.` :

speechNum === 5 ? `
=== 2ND AFFIRMATIVE REBUTTAL REQUIREMENTS ===

CRYSTALLIZATION:
- Identify 2-3 key voting issues that win you the round
- Explain why you win the framework debate
- Show how your impacts matter more under your framework
- Address any critical Negative arguments still standing

FINAL APPEAL:
- Make your strongest philosophical/moral arguments
- Demonstrate why affirming the resolution is imperative
- Connect your arguments to real-world significance
- End with compelling reason to vote Affirmative

STRUCTURE:
1. Framework summary (100 words)
2. Voting Issue #1 (100 words)
3. Voting Issue #2 (100 words)
4. Voting Issue #3 (if needed, 75 words)
5. Final impact/appeal (75 words)

CRITICAL: This is your final speech. Make it count. ${minWords}-${wordLimit} words exactly.` : ''}
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
          
          proPrompt = `
You are competing in a Public Forum debate on: "${topic}"

BILL CONTEXT:
${truncatedDescription || "No specific bill context provided."}

FULL DEBATE TRANSCRIPT SO FAR:
${fullTranscript}

CURRENT SPEECH: PRO ${speechType} (${timeLimit})
YOUR ROLE: PRO (supporting the topic)

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

${getPersonaPrompt(proPersona)}
`;
        } else {
          // Default 5-round format
          const isOpening = messageList.length === 0;
          proPrompt = `
You are an AI debater in a 5-round structured debate on: "${topic}"

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
        aiResponse = await generateAIResponse("AI Debater Pro", proPrompt, proModel, actualDescription, fullTranscript, currentRound, getPersonaName(proPersona), debateFormat, pfSpeakingOrder);
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
        appendMessage(proDisplayName, cleanedResponse, proModel);
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
=== NEGATIVE CONSTRUCTIVE REQUIREMENTS ===

FRAMEWORK ATTACK (First Priority):
- Attack their value premise as inappropriate for this resolution
- Prove your framework is superior for evaluating this debate
- Show why their criterion fails or is outweighed

YOUR FRAMEWORK:
- Present your VALUE PREMISE (what should be prioritized)
- Present your VALUE CRITERION (how we achieve/measure it)
- Justify why your framework is better than theirs

CONTENTIONS (Required):
- Present 2-3 contentions negating the resolution
- Each contention should:
  * Attack a key Affirmative argument
  * Present independent reasons to reject resolution
  * Connect to your value framework
  * Include strong evidence and examples

STRUCTURE:
1. Framework attack and defense (300-350 words)
2. Contention 1 with evidence (250-300 words)
3. Contention 2 with evidence (250-300 words)
4. Contention 3 with evidence (200-250 words)
5. Summary of why Negative wins (100 words)

CRITICAL: Your response must be exactly ${minWords}-${wordLimit} words. Count your words carefully.` :

speechNum === 4 ? `
=== NEGATIVE REBUTTAL REQUIREMENTS ===

FRAMEWORK CRYSTALLIZATION:
- Extend why your framework should be preferred
- Respond to any Affirmative framework attacks
- Show you're winning the framework debate

CONTENTION EXTENSION:
- Extend your strongest contentions from NC
- Add new evidence and analysis
- Respond to 1AR attacks on your case

AFFIRMATIVE TAKEOUTS:
- Attack their weakest contentions from AC
- Show why their impacts don't matter under your framework
- Point out arguments they dropped in 1AR

STRATEGIC FOCUS:
- This is your last constructive speech
- Set up clear voting issues for the judge
- Make it difficult for 2AR to recover
- Emphasize framework and your strongest arguments

STRUCTURE:
1. Framework extension (200-250 words)
2. Extend best contentions (300-350 words)
3. Attack Aff case (250-300 words)
4. Voting issues preview (100-150 words)

CRITICAL: Your response must be exactly ${minWords}-${wordLimit} words. Count your words carefully.` : ''}
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

BILL CONTEXT:
${truncatedDescription || "No specific bill context provided."}

FULL DEBATE TRANSCRIPT SO FAR:
${fullTranscript}

CURRENT SPEECH: CON ${speechType} (${timeLimit})
YOUR ROLE: CON (opposing the topic)

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

${getPersonaPrompt(conPersona)}
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
        aiResponse = await generateAIResponse("AI Debater Con", conPrompt, conModel, actualDescription, fullTranscript, currentRound, getPersonaName(conPersona), debateFormat, pfSpeakingOrder);
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
        appendMessage(conDisplayName, cleanedResponse, conModel);
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
      console.log(`🔍 DEBUG [handleChooseSide]: ===== AI OPENING GENERATION =====`);
      console.log(`🔍 DEBUG [handleChooseSide]: firstSide = "${firstSide}"`);
      console.log(`🔍 DEBUG [handleChooseSide]: user selected side = "${side}"`);
      console.log(`🔍 DEBUG [handleChooseSide]: debateFormat = "${debateFormat}"`);
      console.log(`🔍 DEBUG [handleChooseSide]: pfSpeakingOrder = "${pfSpeakingOrder}"`);

      if (firstSide === "con" && side === "pro") {
        // AI goes first as Con, user will be Pro
        console.log(`🔍 DEBUG [handleChooseSide]: AI will open as CON, user is PRO`);
        let conPrompt;
        if (debateFormat === "public-forum" || debateFormat === "lincoln-douglas") {
          // Use minimal prompt - backend will apply format-specific template
          conPrompt = `Debate on: "${topic}". Your role: CON (opening speaker).`;
          console.log(`🔍 DEBUG [handleChooseSide]: Using minimal prompt for ${debateFormat}`);
          console.log(`🔍 DEBUG [handleChooseSide]: conPrompt = "${conPrompt}"`);
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
        console.log(`  - model: "${singleAIModel}"`);
        console.log(`  - round_num: 1`);
        console.log(`  - persona: "${getPersonaName(aiPersona)}"`);
        console.log(`  - debate_format: "${debateFormat}"`);
        console.log(`  - speaking_order: "${pfSpeakingOrder}"`);
        const conResponse = await generateAIResponse("AI Debater (Con)", conPrompt, singleAIModel, actualDescription, "", 1, getPersonaName(aiPersona), debateFormat, pfSpeakingOrder);
        const aiDisplayName = aiPersona !== "default" ?
          `Con (AI - ${getPersonaName(aiPersona)})` :
          "Con (AI)";
        appendMessage(aiDisplayName, conResponse, singleAIModel);
      } else if (firstSide === "pro" && side === "con") {
        // AI goes first as Pro, user will be Con
        console.log(`🔍 DEBUG [handleChooseSide]: AI will open as PRO, user is CON`);
        let proPrompt;
        if (debateFormat === "public-forum" || debateFormat === "lincoln-douglas") {
          // Use minimal prompt - backend will apply format-specific template
          proPrompt = `Debate on: "${topic}". Your role: PRO (opening speaker).`;
          console.log(`🔍 DEBUG [handleChooseSide]: Using minimal prompt for ${debateFormat}`);
          console.log(`🔍 DEBUG [handleChooseSide]: proPrompt = "${proPrompt}"`);
        } else {
          proPrompt = `
             Debate topic: "${topic}"
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
        console.log(`  - model: "${singleAIModel}"`);
        console.log(`  - round_num: 1`);
        console.log(`  - persona: "${getPersonaName(aiPersona)}"`);
        console.log(`  - debate_format: "${debateFormat}"`);
        console.log(`  - speaking_order: "${pfSpeakingOrder}"`);
        const proResponse = await generateAIResponse("AI Debater (Pro)", proPrompt, singleAIModel, actualDescription, "", 1, getPersonaName(aiPersona), debateFormat, pfSpeakingOrder);
        const aiDisplayName = aiPersona !== "default" ?
          `Pro (AI - ${getPersonaName(aiPersona)})` :
          "Pro (AI)";
        appendMessage(aiDisplayName, proResponse, singleAIModel);
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
      // Calculate round BEFORE appending message, since state updates are async
      // messageList.length = current speeches
      // +1 = user message we're about to add
      // +1 = AI message we're about to generate
      const currentSpeeches = messageList.length;
      const userSpeechNumber = currentSpeeches + 1;
      const aiSpeechNumber = currentSpeeches + 2;
      const userRound = Math.ceil(userSpeechNumber / 2);
      const aiRound = Math.ceil(aiSpeechNumber / 2);

      console.log(`🔍 DEBUG [User vs AI]: Current speeches: ${currentSpeeches}, User speech #${userSpeechNumber} (Round ${userRound}), AI speech #${aiSpeechNumber} (Round ${aiRound})`);

      appendMessage(
        userSide === "pro" ? "Pro (User)" : "Con (User)",
        userInput,
        null,  // no model for user
        userRound  // pass calculated round
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

      console.log(`🔍 DEBUG [User vs AI]: ===== PROMPT GENERATION START =====`);
      console.log(`🔍 DEBUG [User vs AI]: debateFormat = "${debateFormat}"`);
      console.log(`🔍 DEBUG [User vs AI]: aiSideLocal = "${aiSideLocal}"`);
      console.log(`🔍 DEBUG [User vs AI]: userSide = "${userSide}"`);
      console.log(`🔍 DEBUG [User vs AI]: pfSpeakingOrder = "${pfSpeakingOrder}"`);

      // Use the same prompt building logic as AI vs AI mode
      // This ensures PF/LD formats are respected in User vs AI mode
      let aiPrompt;

      // For Public Forum and Lincoln-Douglas, use short prompts and let backend templates handle it
      // The backend will see debate_format parameter and use the appropriate template
      // This is simpler and ensures consistency with AI vs AI mode
      if (debateFormat === "public-forum" || debateFormat === "lincoln-douglas") {
        // Pass a minimal prompt - the backend will use the format-specific template based on debate_format
        aiPrompt = `Debate on: "${topic}". Your role: ${aiSideLocal}.`;
        console.log(`🔍 DEBUG [User vs AI]: Using minimal prompt for ${debateFormat} format`);
        console.log(`🔍 DEBUG [User vs AI]: aiPrompt = "${aiPrompt}"`);
      } else {
        console.log(`🔍 DEBUG [User vs AI]: Using default 5-round format prompt`);

        // Default 5-round format - use the existing logic
        const aiHasSpoken = messageList.some(msg => msg.speaker.includes(aiSideLocal));
        const isOpening = !aiHasSpoken;

        aiPrompt = `
You are an AI debater in a structured debate on: "${topic}"

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
      console.log(`  - model: "${singleAIModel}"`);
      console.log(`  - actualDescription length: ${actualDescription?.length || 0}`);
      console.log(`  - round_num: ${aiRound}`);
      console.log(`  - persona: "${getPersonaName(aiPersona)}"`);
      console.log(`  - debate_format: "${debateFormat}"`);
      console.log(`  - speaking_order: "${pfSpeakingOrder}"`);

      const aiResponse = await generateAIResponse(`AI Debater (${aiSideLocal})`, aiPrompt, singleAIModel, actualDescription, fullTranscriptForAI, aiRound, getPersonaName(aiPersona), debateFormat, pfSpeakingOrder);
      const aiDisplayName = aiPersona !== "default" ?
        `${aiSideLocal} (AI - ${getPersonaName(aiPersona)})` :
        `${aiSideLocal} (AI)`;
      appendMessage(aiDisplayName, aiResponse, singleAIModel, aiRound);
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
      {/* DEBUG: Visual indicator */}
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: '#ff6b6b',
        color: 'white',
        padding: '10px 15px',
        borderRadius: '8px',
        zIndex: 9999,
        fontSize: '12px',
        fontWeight: 'bold',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        fontFamily: 'monospace'
      }}>
        🔍 DEBUG MODE<br/>
        Format: <span style={{color: '#ffeb3b'}}>{debateFormat || 'default'}</span><br/>
        Mode: {actualMode}<br/>
        PF Order: {pfSpeakingOrder}
      </div>

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
                <>
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
                </>
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
                {model && <div className="debate-model-info">Model: {model}</div>}

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
                      if (loading) return "Generating Response...";

                      const limitReached = debateFormat === "lincoln-douglas" ? aiSpeeches >= 5 : aiSpeeches >= (maxRounds * 2);
                      if (limitReached) return "Round Limit Reached";
                      
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

                        return `Generate ${speechName} (${totalSpeeches + 1}/5)`;
                      } else if (debateFormat === "public-forum") {
                        const totalSpeeches = aiSpeeches;
                        let displayRound;
                        if (totalSpeeches <= 1) displayRound = 1;
                        else if (totalSpeeches <= 3) displayRound = 2;
                        else if (totalSpeeches <= 5) displayRound = 3;
                        else if (totalSpeeches <= 7) displayRound = 4;
                        else displayRound = 4; // Should never reach here due to disable logic

                        return aiSide === "pro"
                          ? `Generate Pro Round ${displayRound}/${maxRounds}`
                          : `Generate Con Round ${displayRound}/${maxRounds}`;
                      } else {
                        return aiSide === "pro"
                          ? `Generate Pro Round ${currentRound}/${maxRounds}`
                          : `Generate Con Round ${currentRound}/${maxRounds}`;
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
                    Auto-Generate All Rounds
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
                  Stop Auto-Generation
                </button>
              )}
            </div>
          )}
          {debateFormat === "public-forum" && actualMode === "ai-vs-ai" && !pfOrderSelected && (
            <div className="ai-vs-user-setup">
              <div className="setup-header">
                <h3>Public Forum Debate Setup</h3>
                <button 
                  className="info-button"
                  onClick={() => setShowPfInfo(true)}
                  title="More information about Public Forum debate format"
                >
                  ?
                </button>
              </div>
              <p style={{ color: '#fff' }}>Choose the speaking order for all 4 rounds</p>
              <div className="order-selection">
                <label>Speaking Order</label>
                <div className="order-buttons">
                  <button
                    className={`order-button ${pfSpeakingOrder === 'pro-first' ? 'selected' : ''}`}
                    onClick={() => setPfSpeakingOrder('pro-first')}
                  >
                    PRO speaks first in each round
                  </button>
                  <button
                    className={`order-button ${pfSpeakingOrder === 'con-first' ? 'selected' : ''}`}
                    onClick={() => setPfSpeakingOrder('con-first')}
                  >
                    CON speaks first in each round
                  </button>
                </div>
              </div>

              <div className="confirm-section">
                <button
                  className="confirm-button"
                  onClick={() => setPfOrderSelected(true)}
                >
                  Start Public Forum Debate
                </button>
              </div>
            </div>
          )}
          {debateFormat === "lincoln-douglas" && actualMode === "ai-vs-ai" && !ldOrderSelected && (
                      <div className="ai-vs-user-setup">
                        <div className="setup-header">
                          <h3>Lincoln-Douglas Debate Setup</h3>
                          <button
                            className="info-button"
                            onClick={() => setShowLdInfo(true)}
                            title="More information about Lincoln-Douglas debate format"
                          >
                            ?
                          </button>
                        </div>
                        <p style={{ color: '#fff' }}>
                          In LD, the Affirmative always starts: AC → NC → 1AR → NR → 2AR.
                        </p>

                        <div className="confirm-section">
                          <button
                            className="confirm-button"
                            onClick={() => setLdOrderSelected(true)}
                          >
                            Start Lincoln-Douglas Debate
                          </button>
                        </div>
                      </div>
                    )}

          {/* Lincoln-Douglas Info Popup */}
          {showLdInfo && (
            <div className="popup-overlay" onClick={() => setShowLdInfo(false)}>
              <div className="popup-content" onClick={(e) => e.stopPropagation()}>
                <div className="popup-header">
                  <h3>Lincoln-Douglas Debate Format</h3>
                  <button
                    className="close-button"
                    onClick={() => setShowLdInfo(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="popup-body">
                  <p style={{ color: 'white', marginBottom: '0.75rem' }}>
                    <strong>Speaking Order:</strong> Affirmative always speaks first (AC → NC → 1AR → NR → 2AR).
                  </p>
                  <h4>Structure (5 Speeches):</h4>
                  <div className="round-structure">
                    <div className="round-item">
                      <strong>1. Affirmative Constructive (AC):</strong> 6 minutes
                      <p>Present value framework and 2-3 contentions supporting the resolution</p>
                    </div>
                    <div className="round-item">
                      <strong>2. Negative Constructive (NC):</strong> 7 minutes
                      <p>Attack Affirmative framework, present Negative framework and contentions</p>
                    </div>
                    <div className="round-item">
                      <strong>3. 1st Affirmative Rebuttal (1AR):</strong> 4 minutes
                      <p>Defend Affirmative case and attack Negative arguments</p>
                    </div>
                    <div className="round-item">
                      <strong>4. Negative Rebuttal (NR):</strong> 6 minutes
                      <p>Final Negative speech - extend case and respond to 1AR</p>
                    </div>
                    <div className="round-item">
                      <strong>5. 2nd Affirmative Rebuttal (2AR):</strong> 3 minutes
                      <p>Final Affirmative speech - crystallize voting issues and make final appeal</p>
                    </div>
                  </div>
                  <h4>Key Features:</h4>
                  <ul>
                    <li><strong>Philosophical Focus:</strong> Emphasis on value frameworks and moral reasoning</li>
                    <li><strong>Individual Competition:</strong> One debater per side (unlike team formats)</li>
                    <li><strong>Framework Debate:</strong> Value premise and criterion determine how arguments are evaluated</li>
                  </ul>
                  <p style={{ fontSize: '0.9em', fontStyle: 'italic', marginTop: '1rem', color: 'white' }}>
                    <strong>Note:</strong> Traditional Lincoln-Douglas debate includes cross-examination periods, but these are not currently supported in this implementation.
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
                  <h3>Public Forum Debate Format</h3>
                  <button 
                    className="close-button"
                    onClick={() => setShowPfInfo(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="popup-body">
                  <h4>Structure (4 Rounds):</h4>
                  <div className="round-structure">
                    <div className="round-item">
                      <strong>Round 1:</strong> Constructive Speeches
                      <p>Each side presents their main arguments and evidence. 4 minutes. </p>
                    </div>
                    <div className="round-item">
                      <strong>Round 2:</strong> Rebuttal Speeches
                      <p>Each side responds to the opponent's arguments. 4 minutes. </p>
                    </div>
                    <div className="round-item">
                      <strong>Round 3:</strong> Summary Speeches
                      <p>Each side summarizes key points and refutes opponent. 3 minutes. </p>
                    </div>
                    <div className="round-item">
                      <strong>Round 4:</strong> Final Focus Speeches
                      <p>Each side makes their strongest closing argument. 2 minutes.</p>
                    </div>
                  </div>
                  <div className="format-details">
                    <h4>Key Features:</h4>
                    <ul>
                      <li>Cross-examination periods between speeches (coming soon)</li>
                      <li>Emphasis on logical reasoning and evidence</li>
                      <li>Focus on current events and policy issues</li>
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
                  <h3>Setup Your Debate</h3>
                  <p style={{ color: '#fff' }}>
                    {debateFormat === 'lincoln-douglas'
                      ? 'Choose your SIDE. In LD, the Affirmative (Pro) always starts.'
                      : 'Choose your SIDE and SPEAKING ORDER'}
                  </p>
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

                  {debateFormat !== 'lincoln-douglas' && (
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
                  )}

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

                  {debateFormat === 'lincoln-douglas' ? (
                    <p style={{ color: '#fff' }}>In LD, the Affirmative (Pro) always starts.</p>
                  ) : (
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
                  )}

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