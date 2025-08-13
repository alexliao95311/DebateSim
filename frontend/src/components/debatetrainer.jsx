/* global DebateElo */

const { useState, useMemo, useEffect, useRef } = React;

const SPEECH_TYPES = [
  { id: 'constructive', name: 'Constructive' },
  { id: 'rebuttal', name: 'Rebuttal' },
  { id: 'summary', name: 'Summary' },
  { id: 'final_focus', name: 'Final Focus' },
];


}

window.DebateTrainer = { mountDebateTrainer };