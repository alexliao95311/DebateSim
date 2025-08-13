/* global DebateElo */

const { useState, useMemo, useEffect, useRef } = React;

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

  const [model, setModel] = useState(window.OPENAI_MODEL || 'gpt-4o');
  const [apiKey, setApiKey] = useState(window.OPENAI_API_KEY || '');

  const bots = ladderRef.current.listBots();
  const coachOptions = PROMPT_PRESETS.filter(p => p.id.startsWith('coach'));

  function buildCritiquePrompt() {
    const preset = coachOptions.find(p => p.id === coachPresetId);
    const role = SPEECH_TYPES.find(s => s.id === speechType)?.name || 'Speech';
    return `System:\n${preset.system}\n\nTask: Critique a ${role} for a ${caseSide.toUpperCase()} case on the topic: "${topic}".\n1) Identify claims, warrants, impacts.\n2) Point out flaws (logic gaps, missing warrants, unclear links, impact calculus issues, weighing mistakes).\n3) Give prioritized, actionable fixes.\n4) Provide a concise improved version of 1 key section.\n5) End with a 3-point checklist for ${role}.\n\nSpeech:\n${speechText}`;
  }

  function buildTipsPrompt() {
    const preset = coachOptions.find(p => p.id === coachPresetId);
    const role = SPEECH_TYPES.find(s => s.id === speechType)?.name || 'Speech';
    return `System:\n${preset.system}\n\nTask: Provide targeted training drills and heuristics to improve ${role} performance on ${caseSide.toUpperCase()} for topic "${topic}" based on the provided speech. Include:\n- Weakness-focused drills (with steps and timing)\n- Heuristics for weighing and collapse\n- Rebuttal grouping and frontlining guidance\n- Style/clarity tips\n\nSpeech:\n${speechText}`;
  }

  function buildSparOpening(botPreset, side) {
    return `System:\n${botPreset.system}\n\nYou are debating ${side.toUpperCase()} on: "${topic}".\nGenerate a single ${side === 'pro' ? 'Constructive' : 'Constructive (Con)'} speech with 2-3 contentions, clear warrants, and impact calculus. Avoid fluff.`;
  }

  // Mock LLM call: replace with real API integration if available
  async function callModel(prompt) {
    // Prefer a backend proxy if available
    try {
      if (window.fetch) {
        const resp = await fetch('/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, model: window.OPENAI_MODEL || 'gpt-4o' }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.text) return data.text;
        }
      }
    } catch (e) {
      // fallthrough to direct
    }

    // Direct OpenAI API call if key is provided on window
    if (window.OPENAI_API_KEY) {
      try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: window.OPENAI_MODEL || 'gpt-4o',
            messages: [
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
          }),
        });
        const data = await resp.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) return text;
      } catch (err) {
        // ignore and fallback
      }
    }

    // Deterministic-ish placeholder fallback
    const hash = [...prompt].reduce((a, c) => (a + c.charCodeAt(0)) % 100000, 0);
    const sample = (seed, variants) => variants[seed % variants.length];
    const variant = sample(hash, [
      'Focus on internal link clarity and weighing between magnitude vs probability. Collapse earlier to your strongest contention and pre-empt common turns.',
      'You need cleaner signposting and to bundle independent responses into grouped answers. Extend warrants, not just taglines.',
      'Weigh across the round: show why your offense outweighs on scope and irreversibility. Address solvency constraints head-on.',
    ]);
    return `Model Feedback:\n${variant}\n\nChecklist:\n- Explicit claim, warrant, impact per argument\n- Do weighing in the body, not only at the end\n- Pre-empt frontline responses with blocks`;
  }

  async function handleCritique() {
    const prompt = buildCritiquePrompt();
    const out = await callModel(prompt);
    setCritique(out);
    setReviewHistory((h) => [{ type: 'critique', ts: Date.now(), content: out }, ...h]);
  }

  async function handleTips() {
    const prompt = buildTipsPrompt();
    const out = await callModel(prompt);
    setTips(out);
    setReviewHistory((h) => [{ type: 'tips', ts: Date.now(), content: out }, ...h]);
  }

  async function handleReviseAndReview() {
    if (!revision.trim()) return;
    const preset = coachOptions.find(p => p.id === coachPresetId);
    const role = SPEECH_TYPES.find(s => s.id === speechType)?.name || 'Speech';
    const prompt = `System:\n${preset.system}\n\nTask: Review the student's revised ${role}. Provide delta-focused feedback: what improved, what still breaks, and 3 concrete next edits.\n\nOriginal:\n${speechText}\n\nRevised:\n${revision}`;
    const out = await callModel(prompt);
    setReviewHistory((h) => [{ type: 'revise', ts: Date.now(), content: out }, ...h]);
  }

  function startMatch(bot) {
    setActiveMatch({
      botId: bot.id,
      bot,
      transcript: [],
      mySide: caseSide,
      status: 'setup',
    });
  }

  async function botSpeaks(opening = false) {
    if (!activeMatch) return;
    const botPreset = PROMPT_PRESETS.find(p => p.id === activeMatch.botId) || PROMPT_PRESETS[2];
    const prompt = opening ? buildSparOpening(botPreset, activeMatch.mySide === 'pro' ? 'con' : 'pro') : `Continue debate. Opponent said: "${lastUserSpeech()}". Respond with grouped line-by-line and weighing.`;
    const text = await callModel(prompt);
    setActiveMatch((m) => ({ ...m, transcript: [...m.transcript, { speaker: 'bot', text }] }));
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
  }

  // Ensure "me" is registered in ladder
  useEffect(() => {
    ladderRef.current.addBot('me', 'You', myElo);
  }, []);

  useEffect(() => {
    // Persist and expose for callModel
    try {
      if (apiKey) localStorage.setItem('OPENAI_API_KEY', apiKey);
      const storedKey = localStorage.getItem('OPENAI_API_KEY');
      if (!apiKey && storedKey) setApiKey(storedKey);
    } catch {}
    window.OPENAI_API_KEY = apiKey;
  }, [apiKey]);

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
          subtitle="Critique by speech type, drill tips, iterative review"
          right={(
            <div className="dt-chip-row">
              <span className="dt-tag">Coach</span>
              <div className="dt-chip">Model
                <select className="dt-select" style={{ width: 130, marginLeft: 8 }} value={model} onChange={(e) => setModel(e.target.value)}>
                  {['gpt-4o','gpt-4o-mini'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="dt-chip">Key
                <input
                  type="password"
                  className="dt-input"
                  style={{ width: 200, marginLeft: 8, padding: '6px 8px' }}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                />
              </div>
            </div>
          )}
        />
        <div className="dt-split">
          <Labeled label="Speech Type" hint="Choose which speech to get critiqued">
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
        <div style={{ height: 10 }} />
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
        <div className="dt-list" style={{ marginBottom: 12 }}>
          {bots.map((b) => <BotRow key={b.id} bot={b} onChallenge={startMatch} />)}
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
                  <ChatComposer onSend={async (text) => { await meSpeaks(text); await botSpeaks(false); }} />
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
    </div>
  );
}

function ChatComposer({ onSend }) {
  const [text, setText] = useState('');
  return (
    <div className="dt-row" style={{ marginTop: 8 }}>
      <textarea className="dt-textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="Your turn: respond with grouped, warranted answers and weighing." />
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
  const root = ReactDOM.createRoot(rootEl);
  root.render(<DebateTrainerApp />);
}

window.DebateTrainer = { mountDebateTrainer };