import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import { generateAIResponse, getAIJudgeFeedback } from "../api";
import { saveTranscriptToUser } from "../firebase/saveTranscript";
import LoadingSpinner from "./LoadingSpinner";
import HistorySidebar from "./HistorySidebar";
import VoiceInput from './VoiceInput';
import SimpleFileUpload from "./SimpleFileUpload";
import { 
  Gavel, 
  MessageSquare, 
  Download, 
  Share2, 
  ArrowLeft, 
  Volume2, 
  VolumeX,
  History,
  User,
  LogOut,
  Menu,
  ChevronDown,
  Award,
  Target,
  Users,
  Bot,
  Zap,
  TrendingUp,
  Star
} from "lucide-react";
import "./DebateTrainer.css";

// Import ELO system
import { EloLadder } from "../utils/debatetrainerelo";

const SPEECH_TYPES = [
  { id: 'constructive', name: 'Constructive' },
  { id: 'rebuttal', name: 'Rebuttal' },
  { id: 'summary', name: 'Summary' },
  { id: 'final_focus', name: 'Final Focus' },
];

const PROMPT_PRESETS = [
  {
    id: 'coach-strict-1800',
    name: 'Coach (Strict) — 1800',
    baseRating: 1800,
    system: `You are a seasoned debate coach. Provide rigorous, actionable feedback. Be precise and concise. Focus on logical structure, evidence, impacts, weighing, and strategy. Use bullets and numbered lists. Demand warrants.`,
    critiqueTone: 'strict',
  },
  {
    id: 'coach-supportive-1650',
    name: 'Coach (Supportive) — 1650',
    baseRating: 1650,
    system: `You are a supportive debate coach. Encourage and guide. Provide specific suggestions with examples. Prioritize clarity, persuasion, and comparative weighing.`,
    critiqueTone: 'supportive',
  },
  {
    id: 'spar-bot-balanced-1500',
    name: 'Spar Bot (Balanced) — 1500',
    baseRating: 1500,
    system: `You are a balanced debate sparring partner. Argue with reasonable quality, make clear claims, warrants, and impacts. Value clash and weighing.`,
    sparStyle: 'balanced',
  },
  {
    id: 'spar-bot-agg-1700',
    name: 'Spar Bot (Aggressive) — 1700',
    baseRating: 1700,
    system: `You are an aggressive debate sparring partner. Press concessions, extend offense, collapse persuasively, and weigh efficiently.`,
    sparStyle: 'aggressive',
  },
  {
    id: 'spar-bot-beginner-1200',
    name: 'Spar Bot (Beginner) — 1200',
    baseRating: 1200,
    system: `You are a beginner sparring partner. Make simple arguments and occasionally miss key weighing.`,
    sparStyle: 'beginner',
  },
];

const MODEL_OPTIONS = [
  "openai/gpt-5-mini",
  "meta-llama/llama-3.3-70b-instruct",
  "google/gemini-2.0-flash-001",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o-mini",
  "openai/gpt-4o-mini-search-preview"
];

const UNIVERSAL_FEEDBACK_RUBRIC = `Score each 1-5 and justify briefly.
- Clarity: Was structure and signposting clear?
- Warranting: Were claims backed by reasoning/evidence?
- Weighing: Did they compare on magnitude, probability, timeframe, reversibility?
- Responsiveness: Did they front-line and answer opposing arguments directly?
- Delivery: Pace, tone, emphasis; avoid filler; persuasive style.
Provide:
1) Top 3 prioritized fixes (concrete, actionable)
2) Two exemplar lines they could say next time
3) One-sentence overall verdict`;

function DebateTrainer({ user }) {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [showMobileDropdown, setShowMobileDropdown] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const dropdownRef = useRef(null);

  // ELO System
  const [eloLadder] = useState(() => new EloLadder(
    PROMPT_PRESETS.filter(p => p.id.startsWith('spar-bot')).map((p, idx) => ({ 
      id: p.id, 
      name: p.name, 
      rating: p.baseRating 
    }))
  ));

  // Training Mode States
  const [mode, setMode] = useState(''); // 'feedback', 'sparring'
  const [speechType, setSpeechType] = useState('constructive');
  const [topic, setTopic] = useState('Should governments implement universal basic income?');
  const [caseSide, setCaseSide] = useState('pro');
  const [speechText, setSpeechText] = useState('');
  const [coachPresetId, setCoachPresetId] = useState('coach-strict-1800');
  const [critique, setCritique] = useState('');
  const [tips, setTips] = useState('');
  const [revision, setRevision] = useState('');
  const [reviewHistory, setReviewHistory] = useState([]);

  // Sparring Mode States
  const [activeMatch, setActiveMatch] = useState(null);
  const [myElo, setMyElo] = useState(1500);
  const [kFactor, setKFactor] = useState(24);
  const [userInput, setUserInput] = useState('');

  // Common States
  const [model, setModel] = useState(MODEL_OPTIONS[0]);
  const [format, setFormat] = useState('Public Forum');
  const [feedbackTiming, setFeedbackTiming] = useState('per_speech');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Immediate scroll reset using useLayoutEffect
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // Animation trigger
  useEffect(() => {
    const animationTimer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(animationTimer);
  }, []);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowMobileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch debate history on load
  useEffect(() => {
    async function fetchHistory() {
      if (!user || user.isGuest) return;
      try {
        // This would fetch DebateTrainer specific history
        // For now, we'll use empty array
        setHistory([]);
      } catch (err) {
        console.error("Error fetching debate trainer history:", err);
      }
    }
    fetchHistory();
  }, [user]);

  // Ensure "me" is registered in ladder
  useEffect(() => {
    eloLadder.addBot('me', 'You', myElo);
  }, [eloLadder, myElo]);

  const handleBackToHome = () => {
    navigate("/");
  };

  const handleLogout = () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    navigate("/");
  };

  const bots = eloLadder.listBots();
  const coachOptions = PROMPT_PRESETS.filter(p => p.id.startsWith('coach'));

  function formatDirectives() {
    if (format === 'Public Forum') {
      return 'Use PF terminology (constructive, rebuttal, summary, final focus). Emphasize weighing and comparative impacts.';
    }
    if (format === 'Congress') {
      return 'Use Congressional debate style. Reference legislators, policy specifics, and constituent impacts. Maintain decorum; evidence-driven warrants.';
    }
    return 'Use standard competitive debate norms. Be direct, structured, and emphasize claim–warrant–impact and weighing.';
  }

  function buildCritiquePrompt() {
    const preset = coachOptions.find(p => p.id === coachPresetId);
    const role = SPEECH_TYPES.find(s => s.id === speechType)?.name || 'Speech';
    return `System:\n${preset.system}\n\nDebate format: ${format}. ${formatDirectives()}\n\nTask: Provide universal-rubric feedback on a ${role} for the ${caseSide.toUpperCase()} side on the topic: "${topic}".\n${UNIVERSAL_FEEDBACK_RUBRIC}\n\nThen provide:\n- 3 prioritized, actionable fixes with examples\n- A short improved rewrite of one problematic section\n- A 3-point checklist for the next ${role}\n\nStudent Speech:\n${speechText}`;
  }

  function buildTipsPrompt() {
    const preset = coachOptions.find(p => p.id === coachPresetId);
    const role = SPEECH_TYPES.find(s => s.id === speechType)?.name || 'Speech';
    return `System:\n${preset.system}\n\nDebate format: ${format}. ${formatDirectives()}\n\nTask: Provide targeted training drills and heuristics to improve ${role} performance on ${caseSide.toUpperCase()} for topic "${topic}" based on the provided speech. Include:\n- Weakness-focused drills (with steps and timing)\n- Heuristics for weighing and collapse\n- Rebuttal grouping and frontlining guidance\n- Style/clarity tips\n\nStudent Speech:\n${speechText}`;
  }

  function buildSparOpening(botPreset, side) {
    const styleDirective = botPreset.sparStyle === 'aggressive'
      ? 'Be assertive. Press concessions, extend offense, collapse persuasively, and weigh efficiently.'
      : botPreset.sparStyle === 'beginner'
      ? 'Keep arguments simpler and fewer. Sometimes miss a weighing step, but remain coherent.'
      : 'Be balanced, organized, and evidence-driven with solid weighing.';
    return `System:\n${botPreset.system}\n\nDebate format: ${format}. ${formatDirectives()}\nRole: ${side.toUpperCase()}\nStyle: ${botPreset.sparStyle}. ${styleDirective}\n\nTask: Deliver a single ${side === 'pro' ? 'Constructive (Pro)' : 'Constructive (Con)'} on topic: "${topic}" with 2-3 contentions, explicit claims, warrants, and impact calculus. Label clearly. Keep it concise and persuasive.`;
  }

  function buildSparFollowup(botPreset) {
    const styleDirective = botPreset.sparStyle === 'aggressive'
      ? 'Prioritize turns/offense; press drops; weigh magnitude/probability/timeframe.'
      : botPreset.sparStyle === 'beginner'
      ? 'Give straightforward responses; may miss some weighing; remain civil.'
      : 'Provide grouped responses, rebuild attacked positions, and comparative weighing.';
    return `System:\n${botPreset.system}\n\nDebate format: ${format}. ${formatDirectives()}\nStyle: ${botPreset.sparStyle}. ${styleDirective}\n\nOpponent said: "${lastUserSpeech()}"\nTask: Respond with grouped, line-by-line answers, rebuild any attacked positions, and add weighing. Be concise. No fluff.`;
  }

  async function callModel(prompt, debaterLabel = 'Coach') {
    const response = await generateAIResponse(debaterLabel, prompt, model);
    return response;
  }

  async function handleCritique() {
    setError('');
    setLoading(true);
    try {
      const prompt = buildCritiquePrompt();
      const out = await callModel(prompt, 'Coach Critique');
      setCritique(out);
      setReviewHistory((h) => [{ type: 'critique', ts: Date.now(), content: out }, ...h]);
    } catch (e) {
      console.error(e);
      setError('Failed to fetch critique. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleTips() {
    setError('');
    setLoading(true);
    try {
      const prompt = buildTipsPrompt();
      const out = await callModel(prompt, 'Coach Tips');
      setTips(out);
      setReviewHistory((h) => [{ type: 'tips', ts: Date.now(), content: out }, ...h]);
    } catch (e) {
      console.error(e);
      setError('Failed to fetch tips.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReviseAndReview() {
    if (!revision.trim()) return;
    setError('');
    setLoading(true);
    try {
      const preset = coachOptions.find(p => p.id === coachPresetId);
      const role = SPEECH_TYPES.find(s => s.id === speechType)?.name || 'Speech';
      const prompt = `System:\n${preset.system}\n\nTask: Review the student's revised ${role}. Provide delta-focused feedback: what improved, what still breaks, and 3 concrete next edits.\n\nOriginal:\n${speechText}\n\nRevised:\n${revision}`;
      const out = await callModel(prompt, 'Coach Revision');
      setReviewHistory((h) => [{ type: 'revise', ts: Date.now(), content: out }, ...h]);
    } catch (e) {
      console.error(e);
      setError('Failed to review revision.');
    } finally {
      setLoading(false);
    }
  }

  function startMatch(bot) {
    setActiveMatch({
      botId: bot.id,
      bot,
      transcript: [],
      mySide: caseSide,
      status: 'setup',
    });
    setTimeout(() => {
      beginRound();
      try { document.getElementById('dt-composer-input')?.focus(); } catch {}
    }, 0);
  }

  async function botSpeaks(opening = false) {
    if (!activeMatch) return;
    const botPreset = PROMPT_PRESETS.find(p => p.id === activeMatch.botId) || PROMPT_PRESETS[2];
    const prompt = opening ? buildSparOpening(botPreset, activeMatch.mySide === 'pro' ? 'con' : 'pro') : buildSparFollowup(botPreset);
    try {
      setLoading(true);
      const text = await callModel(prompt, activeMatch.bot.name);
      setActiveMatch((m) => ({ ...m, transcript: [...m.transcript, { speaker: 'bot', text }] }));
    } catch (e) {
      console.error(e);
      setError('Bot failed to respond.');
    } finally {
      setLoading(false);
    }
  }

  async function meSpeaks(text) {
    if (!activeMatch || !text.trim()) return;
    setActiveMatch((m) => ({ ...m, transcript: [...m.transcript, { speaker: 'me', text }] }));
  }

  async function beginRound() {
    if (!activeMatch) return;
    setActiveMatch((m) => ({ ...m, status: 'live', transcript: [] }));
    await botSpeaks(true);
  }

  function concludeRound(won) {
    if (!activeMatch) return;
    const updated = eloLadder.recordMatch('me', activeMatch.botId, won ? 1 : 0, kFactor);
    setMyElo(updated.a ? updated.a.rating : myElo);
    setActiveMatch((m) => ({ ...m, status: won ? 'won' : 'lost' }));
  }

  function lastUserSpeech() {
    const t = activeMatch?.transcript || [];
    for (let i = t.length - 1; i >= 0; i--) if (t[i].speaker === 'me') return t[i].text;
    return '';
  }

  const modes = [
    {
      id: "feedback",
      title: "Speech Feedback",
      description: "Get detailed feedback on your speeches with personalized coaching",
      icon: <Target size={48} />,
      tags: ["Feedback", "Learning"],
      color: "from-blue-500 to-purple-600"
    },
    {
      id: "sparring",
      title: "AI Sparring",
      description: "Practice against AI opponents with different skill levels",
      icon: <Bot size={48} />,
      tags: ["Practice", "ELO"],
      color: "from-green-500 to-teal-600"
    }
  ];

  return (
    <div className={`debate-trainer-container ${showHistorySidebar ? 'debate-trainer-sidebar-open' : ''}`}>
      <header className="debate-trainer-header">
        <div className="debate-trainer-header-content">
          <div className="debate-trainer-header-left">
            <button className="back-to-home" onClick={handleBackToHome}>
              <ArrowLeft size={18} />
              Back to Home
            </button>
            <button
              className="debate-trainer-history-button"
              onClick={() => setShowHistorySidebar(!showHistorySidebar)}
            >
              <History size={18} />
              <span>History</span>
            </button>
          </div>

          <div className="debate-trainer-header-center">
            <h1 className="debate-trainer-site-title">Debate Trainer</h1>
          </div>

          <div className="debate-trainer-header-right">
            <div className="debate-trainer-user-section debate-trainer-desktop-user">
              <div className="debate-trainer-user-info">
                <User size={18} />
                <span>{user?.displayName}</span>
              </div>
              <button className="debate-trainer-logout-button" onClick={handleLogout}>
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>

            <div className="debate-trainer-mobile-dropdown-container" ref={dropdownRef}>
              <button
                className="debate-trainer-mobile-dropdown-trigger"
                onClick={() => setShowMobileDropdown(!showMobileDropdown)}
              >
                <Menu size={18} />
                <ChevronDown size={16} className={`debate-trainer-dropdown-arrow ${showMobileDropdown ? 'rotated' : ''}`} />
              </button>

              {showMobileDropdown && (
                <div className="debate-trainer-mobile-dropdown-menu">
                  <div className="debate-trainer-dropdown-user-info">
                    <User size={16} />
                    <span>{user?.displayName}</span>
                  </div>
                  <button
                    className="debate-trainer-dropdown-option"
                    onClick={() => {
                      setShowHistorySidebar(!showHistorySidebar);
                      setShowMobileDropdown(false);
                    }}
                  >
                    <History size={16} />
                    <span>History</span>
                  </button>
                  <button
                    className="debate-trainer-dropdown-option debate-trainer-dropdown-logout"
                    onClick={() => {
                      handleLogout();
                      setShowMobileDropdown(false);
                    }}
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
            </div>
          )}
            </div>
          </div>
        </div>
      </header>

      <div className="debate-trainer-main-content">
        <div className={`debate-trainer-hero-section ${isVisible ? 'debate-trainer-visible' : ''}`}>
          <h1 className="debate-trainer-welcome-message">
            Welcome to Debate Trainer, <span className="debate-trainer-username-highlight">{user?.displayName}</span>
          </h1>
          <p className="debate-trainer-hero-subtitle">
            Sharpen your debate skills with AI-powered training and personalized feedback
          </p>
        </div>

        {/* Mode Selection */}
        {!mode && (
          <div className={`debate-trainer-section ${isVisible ? 'debate-trainer-visible' : ''}`}>
            <h2 className="debate-trainer-section-title">Choose Training Mode</h2>
            <div className="debate-trainer-mode-grid">
              {modes.map((modeOption, index) => (
                <div
                  key={modeOption.id}
                  className={`debate-trainer-mode-card`}
                  onClick={() => setMode(modeOption.id)}
                  style={{ animationDelay: `${0.3 + index * 0.1}s` }}
                >
                  <div className="debate-trainer-mode-icon">
                    {modeOption.icon}
            </div>
                  <h3 className="debate-trainer-mode-title">{modeOption.title}</h3>
                  <p className="debate-trainer-mode-description">{modeOption.description}</p>
                  <div className="debate-trainer-mode-tags">
                    {modeOption.tags.map((tag, tagIndex) => (
                      <span key={tagIndex} className="debate-trainer-mode-tag">
                        {tag}
                      </span>
                    ))}
            </div>
              </div>
              ))}
            </div>
          </div>
        )}

        {/* Speech Feedback Mode */}
        {mode === 'feedback' && (
          <div className="debate-trainer-feedback-mode">
            <div className="debate-trainer-section">
              <div className="debate-trainer-section-header">
                <h2 className="debate-trainer-section-title">Speech Feedback</h2>
                <button 
                  className="debate-trainer-back-button"
                  onClick={() => setMode('')}
                >
                  ← Back to Modes
                </button>
              </div>

              <div className="debate-trainer-controls">
                <div className="debate-trainer-control-group">
                  <label>Model:</label>
                  <select value={model} onChange={(e) => setModel(e.target.value)}>
                    {MODEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="debate-trainer-control-group">
                  <label>Format:</label>
                  <select value={format} onChange={(e) => setFormat(e.target.value)}>
                    {['Public Forum','Congress','Normal'].map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div className="debate-trainer-form">
                <div className="debate-trainer-form-row">
                  <div className="debate-trainer-form-group">
                    <label>Speech Type:</label>
                    <select value={speechType} onChange={(e) => setSpeechType(e.target.value)}>
                      {SPEECH_TYPES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="debate-trainer-form-group">
                    <label>Side:</label>
                    <select value={caseSide} onChange={(e) => setCaseSide(e.target.value)}>
                      <option value="pro">Pro / Affirmative</option>
                      <option value="con">Con / Negative</option>
                    </select>
                  </div>
                </div>

                <div className="debate-trainer-form-group">
                  <label>Topic:</label>
                  <input 
                    type="text"
                    value={topic} 
                    onChange={(e) => setTopic(e.target.value)} 
                    placeholder="Enter debate topic"
                  />
                </div>

                <div className="debate-trainer-form-group">
                  <label>Your Speech:</label>
                  <textarea 
                    value={speechText} 
                    onChange={(e) => setSpeechText(e.target.value)} 
                    placeholder="Paste or write your speech here..."
                    rows={6}
                  />
                </div>

                <div className="debate-trainer-form-group">
                  <label>Coach Style:</label>
                  <select value={coachPresetId} onChange={(e) => setCoachPresetId(e.target.value)}>
            {coachOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

                <div className="debate-trainer-actions">
                  <button 
                    className="debate-trainer-btn primary" 
                    disabled={loading || !speechText.trim()} 
                    onClick={handleCritique}
                  >
                    Get Feedback
                  </button>
                  <button 
                    className="debate-trainer-btn" 
                    disabled={loading || !speechText.trim()} 
                    onClick={handleTips}
                  >
                    Get Tips & Drills
                  </button>
            </div>
          </div>

              {critique && (
                <div className="debate-trainer-feedback-section">
                  <h3>Feedback</h3>
                  <div className="debate-trainer-feedback-content">
                    <pre>{critique}</pre>
          </div>
        </div>
        )}

              {tips && (
                <div className="debate-trainer-feedback-section">
                  <h3>Tips & Drills</h3>
                  <div className="debate-trainer-feedback-content">
                    <pre>{tips}</pre>
            </div>
                    </div>
              )}

              {revision && (
                <div className="debate-trainer-form">
                  <div className="debate-trainer-form-group">
                    <label>Your Revision:</label>
                    <textarea 
                      value={revision} 
                      onChange={(e) => setRevision(e.target.value)} 
                      placeholder="Make edits here and request another review"
                      rows={4}
                    />
                  </div>
                  <button 
                    className="debate-trainer-btn" 
                    onClick={handleReviseAndReview}
                  >
                    Review Revision
                  </button>
                </div>
              )}

              {reviewHistory.length > 0 && (
                <div className="debate-trainer-history-section">
                  <h3>Review History</h3>
                  <div className="debate-trainer-history-content">
                    {reviewHistory.map((r, idx) => (
                      <div key={idx} className="debate-trainer-history-item">
                        <div className="debate-trainer-history-header">
                          <span className="debate-trainer-history-type">{r.type}</span>
                          <span className="debate-trainer-history-time">{new Date(r.ts).toLocaleString()}</span>
                        </div>
                        <pre>{r.content}</pre>
                  </div>
                ))}
              </div>
            </div>
        )}
      </div>
          </div>
        )}

        {/* AI Sparring Mode */}
        {mode === 'sparring' && (
          <div className="debate-trainer-sparring-mode">
            <div className="debate-trainer-section">
              <div className="debate-trainer-section-header">
                <h2 className="debate-trainer-section-title">AI Sparring Arena</h2>
                <button 
                  className="debate-trainer-back-button"
                  onClick={() => setMode('')}
                >
                  ← Back to Modes
                </button>
              </div>

              <div className="debate-trainer-sparring-controls">
                <div className="debate-trainer-elo-display">
                  <span>Your Elo: <strong>{myElo}</strong></span>
                  <span>K-Factor: 
                    <select value={kFactor} onChange={(e) => setKFactor(Number(e.target.value))}>
                      {[16, 24, 32, 40].map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </span>
            </div>
              </div>

              <div className="debate-trainer-bot-grid">
                <h3>Available Opponents</h3>
                <div className="debate-trainer-bots">
                  {bots.map((bot) => (
                    <div key={bot.id} className="debate-trainer-bot-card" onClick={() => startMatch(bot)}>
                      <div className="debate-trainer-bot-name">{bot.name}</div>
                      <div className="debate-trainer-bot-stats">
                        <span className="debate-trainer-bot-elo">Elo {bot.rating}</span>
                        <span className="debate-trainer-bot-record">{bot.wins}W/{bot.losses}L</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {activeMatch && (
                <div className="debate-trainer-active-match">
                  <h3>Live Match vs {activeMatch.bot.name}</h3>
                  <div className="debate-trainer-match-status">Status: {activeMatch.status}</div>
                  
                  {activeMatch.status === 'setup' && (
                    <button className="debate-trainer-btn primary" onClick={beginRound}>
                      Begin Round
                    </button>
                  )}

                {activeMatch.status === 'live' && (
                    <div className="debate-trainer-match-content">
                      <div className="debate-trainer-transcript">
                        {activeMatch.transcript.map((t, i) => (
                          <div key={i} className="debate-trainer-message">
                            <div className="debate-trainer-message-header">
                              {t.speaker === 'me' ? 'You' : 'Bot'}
                            </div>
                            <div className="debate-trainer-message-content">
                              {t.text}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="debate-trainer-input-section">
                        <textarea 
                          id="dt-composer-input"
                          value={userInput} 
                          onChange={(e) => setUserInput(e.target.value)} 
                          placeholder="Your response..."
                          rows={3}
                        />
                        <button 
                          className="debate-trainer-btn primary"
                          onClick={async () => {
                            await meSpeaks(userInput);
                            setUserInput('');
                    await botSpeaks(false);
                          }}
                        >
                          Send
                        </button>
                      </div>

                      <div className="debate-trainer-match-actions">
                        <button 
                          className="debate-trainer-btn success" 
                          onClick={() => concludeRound(true)}
                        >
                          Conclude: You Win
                        </button>
                        <button 
                          className="debate-trainer-btn danger" 
                          onClick={() => concludeRound(false)}
                        >
                          Conclude: You Lose
                        </button>
                      </div>
                  </div>
                )}

                {['won', 'lost'].includes(activeMatch.status) && (
                    <div className="debate-trainer-match-result">
                      Match concluded. Your Elo: {myElo}
              </div>
            )}
          </div>
        )}
          </div>
        </div>
      )}

        {error && <div className="debate-trainer-error">{error}</div>}
        {loading && <LoadingSpinner message="Generating AI response" />}
      </div>

      <HistorySidebar 
        user={user}
        history={history}
        showHistorySidebar={showHistorySidebar}
        setShowHistorySidebar={setShowHistorySidebar}
        componentPrefix="debate-trainer"
      />
    </div>
  );
}

export default DebateTrainer;