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



}

window.DebateTrainer = { mountDebateTrainer };