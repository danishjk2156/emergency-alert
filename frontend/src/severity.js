// Client-side mirror of backend/app/severity.py, used ONLY for the live preview
// on the report form. Same rules, same reason strings. The server's result is final.

const CATEGORY_BASE = { FIRE: 30, ROAD: 20, MEDICAL: 20, FLOOD: 25, COLLAPSE: 35, OTHER: 10 };
const CATEGORY_DISPLAY = {
  FIRE: 'Fire Emergency',
  ROAD: 'Road Accident',
  MEDICAL: 'Medical Emergency',
  FLOOD: 'Flood',
  COLLAPSE: 'Building Collapse',
  OTHER: 'Other Emergencies',
};

const CRITICAL_KEYWORDS = [
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
const SERIOUS_KEYWORDS = ['injured', 'smoke', 'rising water', 'stuck', 'elderly', 'burn', 'fracture', 'blocked'];
const HARD_OVERRIDE_KEYWORDS = ['not breathing', 'explosion', 'trapped'];

function peoplePoints(people) {
  if (people <= 1) return 0;
  if (people <= 5) return 10;
  if (people <= 20) return 20;
  if (people <= 50) return 30;
  return 40;
}

export function levelFor(score) {
  if (score < 30) return 'Low';
  if (score < 55) return 'Medium';
  if (score < 80) return 'High';
  return 'Critical';
}

function addKeywords(text, words, each, cap, kind, reasons) {
  let remaining = cap;
  let added = 0;
  for (const kw of words) {
    if (!text.includes(kw)) continue; // plain substring, case-insensitive (text is lower-cased)
    const pts = Math.min(each, remaining);
    if (pts > 0) {
      remaining -= pts;
      added += pts;
      reasons.push(`keyword '${kw}' +${pts}`);
    } else {
      reasons.push(`keyword '${kw}' (max ${kind} bonus reached)`);
    }
  }
  return added;
}

/**
 * @param {string} categoryCode FIRE | ROAD | MEDICAL | FLOOD | COLLAPSE | OTHER
 * @param {number} people       people affected
 * @param {string} text         title + description
 * @returns {{level: string, score: number, reasons: string[]}}
 */
export function computeSeverity(categoryCode, people, text) {
  const code = String(categoryCode || 'OTHER').trim().toUpperCase();
  const base = CATEGORY_BASE[code] ?? 10;
  const n = Math.max(0, Math.floor(Number(people) || 0));
  const lowered = String(text || '').toLowerCase();

  let score = base;
  const reasons = [`${CATEGORY_DISPLAY[code] || code} base +${base}`];

  const pp = peoplePoints(n);
  if (pp > 0) {
    score += pp;
    reasons.push(`${n} people affected +${pp}`);
  }

  score += addKeywords(lowered, CRITICAL_KEYWORDS, 25, 40, 'critical', reasons);
  score += addKeywords(lowered, SERIOUS_KEYWORDS, 10, 20, 'serious', reasons);
  score = Math.min(score, 100);

  let level = levelFor(score);
  if (n >= 5 && HARD_OVERRIDE_KEYWORDS.some((kw) => lowered.includes(kw))) {
    level = 'Critical';
    reasons.push('override: life-threat keyword with 5+ people');
  }

  return { level, score, reasons };
}
