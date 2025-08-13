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

  // need to integrate openapi calls
  async function callModel(prompt) {
    // Deterministic-ish placeholder for now
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



}

window.DebateTrainer = { mountDebateTrainer };