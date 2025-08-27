/* global DebateElo */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { generateAIResponse, getAIJudgeFeedback } from "../api";
import "./debatetrainer.css";

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

function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="dt-title" style={{ justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: 16 }}>{title}</div>
        {subtitle && <div className="dt-subtle" style={{ fontSize: 12 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

function Labeled({ label, children, hint }) {
  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div className="dt-inline-help" style={{ marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

function BotRow({ bot, onChallenge }) {
  return (
    <div className="dt-card dt-bot-row">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700 }}>{bot.name}</span>
          <span className="dt-tag">Games {bot.games}</span>
          <span className="dt-tag">W {bot.wins} / L {bot.losses}</span>
        </div>
        <div className="dt-subtle" style={{ marginTop: 6 }}>Elo <span className="dt-elo-badge">{bot.rating}</span></div>
      </div>
      <div>
        <button className="dt-btn primary" onClick={() => onChallenge(bot)}>Debate</button>
      </div>
    </div>
  );
}

function DebateTrainerApp() {
  const ladderRef = useRef(null);
  if (!ladderRef.current) {
    ladderRef.current = new DebateElo.EloLadder(
      PROMPT_PRESETS.filter(p => p.id.startsWith('spar-bot')).map((p, idx) => ({ id: p.id, name: p.name, rating: p.baseRating }))
    );
  }

  const [speechType, setSpeechType] = useState('constructive');
  const [topic, setTopic] = useState('Should governments implement universal basic income?');
  const [caseSide, setCaseSide] = useState('pro');
  const [speechText, setSpeechText] = useState('');
  const [coachPresetId, setCoachPresetId] = useState('coach-strict-1800');
  const [critique, setCritique] = useState('');
  const [tips, setTips] = useState('');
  const [revision, setRevision] = useState('');
  const [reviewHistory, setReviewHistory] = useState([]);

  const [activeMatch, setActiveMatch] = useState(null); // { botId, bot, transcript: [], mySide, status }
  const [myElo, setMyElo] = useState(1500);
  const [kFactor, setKFactor] = useState(24);

  const [model, setModel] = useState(MODEL_OPTIONS[0]);
  const [format, setFormat] = useState('Public Forum');
  const [feedbackTiming, setFeedbackTiming] = useState('per_speech');
  const [feedbackOnlyMode, setFeedbackOnlyMode] = useState(false);
  const [speechFeedbackList, setSpeechFeedbackList] = useState([]);
  const [finalFeedback, setFinalFeedback] = useState('');

  const bots = ladderRef.current.listBots();
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
      ? 'Be assertive. Press concessions, extend offense, collapse to strongest lines, and do sharp weighing.'
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

  // Real API call using our client utilities
  async function callModel(prompt, debaterLabel = 'Coach') {
    const response = await generateAIResponse(debaterLabel, prompt, model);
    return response;
  }

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    // Auto-begin and focus the live composer
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

  function buildMatchTranscriptMarkdown() {
    const t = activeMatch?.transcript || [];
    return t.map((m) => `## ${m.speaker === 'me' ? 'You' : 'Bot'}\n${m.text}`).join(`\n\n---\n\n`);
  }

  async function requestFinalFeedback() {
    try {
      setLoading(true);
      const transcript = buildMatchTranscriptMarkdown();
      const out = await getAIJudgeFeedback(transcript, model);
      setFinalFeedback(out);
    } catch (e) {
      console.error(e);
      setError('Failed to get final feedback.');
    } finally {
      setLoading(false);
    }
  }

  function lastUserSpeech() {
    const t = activeMatch?.transcript || [];
    for (let i = t.length - 1; i >= 0; i--) if (t[i].speaker === 'me') return t[i].text;
    return '';
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
    const updated = ladderRef.current.recordMatch('me', activeMatch.botId, won ? 1 : 0, kFactor);
    setMyElo(updated.a ? updated.a.rating : myElo);
    setActiveMatch((m) => ({ ...m, status: won ? 'won' : 'lost' }));
    if (feedbackTiming === 'end') {
      requestFinalFeedback();
    }
  }

  // Ensure "me" is registered in ladder
  useEffect(() => {
    ladderRef.current.addBot('me', 'You', myElo);
  }, []);

  // removed apiKey persistence/UI

  useEffect(() => {
    try {
      if (model) localStorage.setItem('OPENAI_MODEL', model);
      const storedModel = localStorage.getItem('OPENAI_MODEL');
      if (!model && storedModel) setModel(storedModel);
    } catch {}
    window.OPENAI_MODEL = model;
  }, [model]);

  return (
    <div className="dt-root">
      <div className="dt-pane">
        <SectionTitle
          title="Debate Trainer"
          subtitle="Choose format, get feedback, and spar against bots"
          right={(
            <div className="dt-chip-row">
              <div className="dt-chip">Model
                <select className="dt-select" style={{ width: 230, marginLeft: 8 }} value={model} onChange={(e) => setModel(e.target.value)}>
                  {MODEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {loading && <span className="dt-tag">Loading…</span>}
              {error && <span className="dt-tag" style={{ color: '#ef4444' }}>Error</span>}
            </div>
          )}
        />
        <div className="dt-split">
          <Labeled label="Format">
            <select className="dt-select" value={format} onChange={(e) => setFormat(e.target.value)}>
              {['Public Forum','Congress','Normal'].map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </Labeled>
          <Labeled label="Feedback Timing" hint="Show feedback after each speech or at the end">
            <select className="dt-select" value={feedbackTiming} onChange={(e) => setFeedbackTiming(e.target.value)}>
              <option value="per_speech">After each speech</option>
              <option value="end">All at the end</option>
            </select>
          </Labeled>
        </div>
        <div style={{ height: 8 }} />
        <div className="dt-row">
          <button className={`dt-btn ${!feedbackOnlyMode ? 'primary' : ''}`} onClick={() => setFeedbackOnlyMode(false)}>Full Trainer</button>
          <button className={`dt-btn ${feedbackOnlyMode ? 'primary' : ''}`} onClick={() => setFeedbackOnlyMode(true)}>Feedback Only</button>
        </div>
        <div style={{ height: 8 }} />
        {feedbackOnlyMode ? (
          <div className="dt-card">
            <div className="dt-split">
              <Labeled label="Speech Type">
                <select className="dt-select" value={speechType} onChange={(e) => setSpeechType(e.target.value)}>
                  {SPEECH_TYPES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Labeled>
              <Labeled label="Side">
                <select className="dt-select" value={caseSide} onChange={(e) => setCaseSide(e.target.value)}>
                  <option value="pro">Pro / Affirmative</option>
                  <option value="con">Con / Negative</option>
                </select>
              </Labeled>
            </div>
            <div style={{ height: 8 }} />
            <Labeled label="Paste Your Speech">
              <textarea className="dt-textarea" value={speechText} onChange={(e) => setSpeechText(e.target.value)} placeholder="Paste or write your speech here..." />
            </Labeled>
            <div className="dt-row" style={{ marginTop: 8 }}>
              <button className="dt-btn primary" disabled={loading || !speechText.trim()} onClick={handleCritique}>Get Feedback</button>
            </div>
            <div className="dt-divider" />
            <div className="dt-card">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Feedback</div>
              <div className="dt-scroll">
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{critique}</pre>
              </div>
            </div>
          </div>
        ) : (
          <></>
        )}
        <Labeled label="Topic">
          <input className="dt-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Resolution or motion" />
        </Labeled>
        <div style={{ height: 10 }} />
        <Labeled label="Your Speech">
          <textarea className="dt-textarea" value={speechText} onChange={(e) => setSpeechText(e.target.value)} placeholder="Paste or write your speech here..." />
        </Labeled>
        <div style={{ height: 10 }} />
        <div className="dt-row">
          <select className="dt-select" style={{ flex: 1 }} value={coachPresetId} onChange={(e) => setCoachPresetId(e.target.value)}>
            {coachOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="dt-btn primary" onClick={handleCritique}>Get Critique</button>
          <button className="dt-btn" onClick={handleTips}>Get Tips</button>
        </div>
        <div style={{ height: 10 }} />
        {!feedbackOnlyMode && (
        <div className="dt-split">
          <div className="dt-card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Critique</div>
            <div className="dt-scroll">
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{critique}</pre>
            </div>
          </div>
          <div className="dt-card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Tips & Drills</div>
            <div className="dt-scroll">
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{tips}</pre>
            </div>
          </div>
        </div>
        )}
        {!feedbackOnlyMode && (
          <>
            <div className="dt-divider" />
            <SectionTitle title="Revise and Review" subtitle="Paste a revision and get delta feedback" />
            <Labeled label="Your Revision">
              <textarea className="dt-textarea" value={revision} onChange={(e) => setRevision(e.target.value)} placeholder="Make edits here and request another review" />
            </Labeled>
            <div className="dt-row" style={{ marginTop: 8 }}>
              <button className="dt-btn" onClick={handleReviseAndReview}>Review Revision</button>
            </div>
            <div style={{ height: 10 }} />
            <div className="dt-card">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Continuous Review History</div>
              <div className="dt-scroll dt-list">
                {reviewHistory.length === 0 && <div className="dt-subtle">No reviews yet</div>}
                {reviewHistory.map((r, idx) => (
                  <div key={idx} className="dt-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span className="dt-tag">{r.type}</span>
                      <span className="dt-subtle">{new Date(r.ts).toLocaleString()}</span>
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{r.content}</pre>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="dt-pane">
        <SectionTitle title="Sparring Arena" subtitle="Debate AI opponents with ratings" right={<span className="dt-tag">Elo</span>} />
        <div className="dt-row" style={{ marginBottom: 8 }}>
          <div className="dt-chip">Your Elo: <span className="dt-elo-badge" style={{ marginLeft: 6 }}>{myElo}</span></div>
          <div className="dt-chip">K-Factor
            <select className="dt-select" style={{ width: 90, marginLeft: 8 }} value={kFactor} onChange={(e) => setKFactor(Number(e.target.value))}>
              {[16, 24, 32, 40].map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>
        <div className="dt-option-grid" style={{ marginBottom: 12 }}>
          {bots.map((b) => (
            <div key={b.id} className="dt-option-card" onClick={() => startMatch(b)}>
              <div className="dt-option-title">{b.name}</div>
              <div className="dt-option-meta">
                <span className="dt-tag">Elo {b.rating}</span>
                <span className="dt-tag">{b.wins}W/{b.losses}L</span>
              </div>
            </div>
          ))}
        </div>
        <div className="dt-divider" />
        <SectionTitle title="Live Match" subtitle="Line-by-line with weighing" />
        {!activeMatch && <div className="dt-subtle">Select an opponent to start.</div>}
        {activeMatch && (
          <div className="dt-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{activeMatch.bot.name}</div>
              <div className="dt-tag">{activeMatch.status}</div>
            </div>
            {activeMatch.status === 'setup' && (
              <div className="dt-row">
                <button className="dt-btn primary" onClick={beginRound}>Begin Round</button>
              </div>
            )}
            {activeMatch.status !== 'setup' && (
              <div>
                <div className="dt-scroll dt-list" style={{ maxHeight: 220 }}>
                  {activeMatch.transcript.map((t, i) => (
                    <div key={i} className="dt-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span className="dt-tag">{t.speaker === 'me' ? 'You' : 'Bot'}</span>
                      </div>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{t.text}</pre>
                    </div>
                  ))}
                </div>
                {activeMatch.status === 'live' && (
                  <ChatComposer onSend={async (text) => {
                    await meSpeaks(text);
                    if (feedbackTiming === 'per_speech') {
                      try {
                        const prompt = `System:\nYou are a debate coach. Provide universal-rubric feedback (clarity, warranting, weighing, responsiveness, delivery) for the following speech excerpt in ${format}. Topic: "${topic}". ${UNIVERSAL_FEEDBACK_RUBRIC}\n\nSpeech Excerpt:\n${text}`;
                        const out = await callModel(prompt, 'Coach Feedback');
                        setReviewHistory((h) => [{ type: 'per-speech', ts: Date.now(), content: out }, ...h]);
                      } catch (e) { console.error(e); }
                    }
                    await botSpeaks(false);
                  }} />
                )}
                {activeMatch.status === 'live' && (
                  <div className="dt-row" style={{ marginTop: 8 }}>
                    <button className="dt-btn" onClick={() => concludeRound(true)}>Conclude: You Win</button>
                    <button className="dt-btn warn" onClick={() => concludeRound(false)}>Conclude: You Lose</button>
                  </div>
                )}
                {['won', 'lost'].includes(activeMatch.status) && (
                  <div className="dt-subtle" style={{ marginTop: 8 }}>Match concluded. Adjusted ratings have been saved.</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {error && (
        <div className="dt-pane" style={{ marginTop: 12 }}>
          <div className="dt-card" style={{ borderColor: '#ef4444' }}>
            <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>Error</div>
            <div className="dt-subtle">{error}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatComposer({ onSend }) {
  const [text, setText] = useState('');
  return (
    <div className="dt-row" style={{ marginTop: 8 }}>
      <textarea id="dt-composer-input" className="dt-textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="Your turn: respond with grouped, warranted answers and weighing." />
      <div style={{ display: 'grid', alignContent: 'start' }}>
        <button className="dt-btn primary" onClick={() => { onSend(text); setText(''); }}>Send</button>
      </div>
    </div>
  );
}

// Mount on demand from the features row
function mountDebateTrainer() {
  const rootEl = document.getElementById('feature-panel');
  if (!rootEl) return;
  rootEl.style.display = 'block';
  const root = createRoot(rootEl);
  root.render(<DebateTrainerApp />);
}

window.DebateTrainer = { mountDebateTrainer };