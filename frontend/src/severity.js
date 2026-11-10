// Client-side mirror of the server's severity rules. Used ONLY for the live
// preview on the report form. The server's result is final.

const BASE = { FIRE: 30, ROAD: 20, MEDICAL: 20, FLOOD: 25, COLLAPSE: 35, OTHER: 10 };
const BASE_LABEL = {
  FIRE: 'Fire',
  ROAD: 'Road accident',
  MEDICAL: 'Medical',
  FLOOD: 'Flood',
  COLLAPSE: 'Collapse',
  OTHER: 'Other',
};

const CRITICAL_WORDS = [
  'trapped',
  'unconscious',
  'not breathing',
  'explosion',
  'collapsed',
  'spreading',
  'heavy bleeding',
  'gas leak',
  'child',
  'drowning',
];
const CRITICAL_EACH = 25;
const CRITICAL_MAX = 40;

const SERIOUS_WORDS = ['injured', 'smoke', 'rising water', 'stuck', 'elderly', 'burn', 'fracture', 'blocked'];
const SERIOUS_EACH = 10;
const SERIOUS_MAX = 20;

const LIFE_THREAT = ['trapped', 'explosion', 'not breathing'];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Match at a word start so "children" counts for "child" and "burning" for "burn".
const has = (text, word) => new RegExp(`\\b${escape(word)}`, 'i').test(text);

function peoplePoints(n) {
  if (n > 50) return 40;
  if (n >= 21) return 30;
  if (n >= 6) return 20;
  if (n >= 2) return 10;
  return 0;
}

export function levelFor(score) {
  if (score < 30) return 'Low';
  if (score < 55) return 'Medium';
  if (score < 80) return 'High';
  return 'Critical';
}

function addKeywords(text, words, each, max, reasons) {
  let used = 0;
  for (const w of words) {
    if (!has(text, w)) continue;
    const give = Math.min(each, max - used);
    reasons.push(give > 0 ? `“${w}” +${give}` : `“${w}” (capped)`);
    used += give;
  }
  return used;
}

/**
 * @param {string} categoryCode  FIRE | ROAD | MEDICAL | FLOOD | COLLAPSE | OTHER
 * @param {number} people        people affected
 * @param {string} text          title + description
 * @returns {{level: string, score: number, reasons: string[]}}
 */
export function computeSeverity(categoryCode, people, text) {
  const code = String(categoryCode || 'OTHER').toUpperCase();
  const reasons = [];
  let score = 0;

  const base = BASE[code] ?? BASE.OTHER;
  reasons.push(`${BASE_LABEL[code] || 'Other'} base +${base}`);
  score += base;

  const n = Math.max(0, Math.floor(Number(people) || 0));
  const pp = peoplePoints(n);
  if (pp) {
    reasons.push(`${n} people +${pp}`);
    score += pp;
  }

  const t = String(text || '');
  score += addKeywords(t, CRITICAL_WORDS, CRITICAL_EACH, CRITICAL_MAX, reasons);
  score += addKeywords(t, SERIOUS_WORDS, SERIOUS_EACH, SERIOUS_MAX, reasons);

  score = Math.min(100, score);
  let level = levelFor(score);

  if (n >= 5 && LIFE_THREAT.some((w) => has(t, w)) && level !== 'Critical') {
    level = 'Critical';
    reasons.push('5+ people & life threat → Critical');
  }

  return { level, score, reasons };
}
