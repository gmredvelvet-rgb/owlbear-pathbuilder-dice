/**
 * Messages shared by the dice tray, the sheet popover and the companion
 * browser extension. This file has no runtime imports so it can be unit
 * tested with `node --test`.
 */

export type DieSides = 4 | 6 | 8 | 10 | 12 | 20 | 100;

export interface DiceTerm {
  count: number;
  sides: DieSides;
  /** Double this term's value (critical hit damage) */
  doubled?: boolean;
  /** Roll `count` dice and keep one (fortune / misfortune) */
  keep?: "highest" | "lowest";
}

/** A request for the tray to roll dice */
export interface RollRequest {
  id: string;
  label: string;
  character?: string;
  dice: DiceTerm[];
  bonus: number;
  hidden?: boolean;
  source: "pathbuilder" | "native-sheet" | "manual";
  /** The total Pathbuilder calculated, when known */
  externalTotal?: number;
}

/** Broadcast to the room when a labelled roll finishes */
export interface RollResult {
  id: string;
  player: string;
  playerColor?: string;
  character?: string;
  label: string;
  total: number;
  /** Human readable breakdown, e.g. "1d20 (17) + 9" */
  breakdown: string;
  /** "nat20" / "nat1" when the roll is a single kept d20 */
  natural?: "nat20" | "nat1";
  hidden?: boolean;
  at: number;
}

/** Messages posted by the companion extension from inside Pathbuilder */
export const BRIDGE_SOURCE = "pb-obr-bridge";
export const PATHBUILDER_ORIGINS = [
  "https://pathbuilder2e.com",
  "https://www.pathbuilder2e.com",
];

export type BridgeMessage =
  | { source: typeof BRIDGE_SOURCE; kind: "hello"; version: string; character?: string }
  | {
      source: typeof BRIDGE_SOURCE;
      kind: "dump";
      character?: string;
      data: PathbuilderRollDump;
    }
  | {
      source: typeof BRIDGE_SOURCE;
      kind: "history";
      character?: string;
      title?: string;
      summary?: string;
      text: string;
    };

/** Shape of Pathbuilder's own `window.postMessage` roll event */
export interface PathbuilderRollDump {
  rollDiceDump: { numDice: number; diceSize: number; extraCritDice?: boolean }[];
  rollBonus?: number;
  type?: string;
  title?: string;
  status?: string;
  total?: number;
}

export function isBridgeMessage(value: unknown): value is BridgeMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { source?: unknown }).source === BRIDGE_SOURCE &&
    typeof (value as { kind?: unknown }).kind === "string"
  );
}

const VALID_SIDES = [4, 6, 8, 10, 12, 20, 100];

function toSides(value: number): DieSides | null {
  return VALID_SIDES.includes(value) ? (value as DieSides) : null;
}

let requestCounter = 0;
export function newRequestId() {
  requestCounter++;
  return `${Date.now().toString(36)}-${requestCounter}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

const DUMP_TYPE_SUFFIX: Record<string, string> = {
  weaponAttack: "To Hit",
  weaponDamage: "Damage",
  weaponDamageCritical: "Critical",
};

/** Convert Pathbuilder's structured roll event to a roll request */
export function requestFromDump(
  data: PathbuilderRollDump,
  character?: string
): RollRequest | null {
  if (!Array.isArray(data.rollDiceDump)) {
    return null;
  }
  const critical = data.type === "weaponDamageCritical";
  const dice: DiceTerm[] = [];
  for (const entry of data.rollDiceDump) {
    const sides = toSides(Number(entry.diceSize));
    const count = Math.floor(Number(entry.numDice));
    if (!sides || !(count > 0)) {
      continue;
    }
    // Extra crit dice (e.g. deadly/fatal) are added, not doubled
    const doubled = critical && entry.extraCritDice !== true ? true : undefined;
    dice.push({ count, sides, doubled });
  }
  const bonus = Number(data.rollBonus) || 0;
  if (dice.length === 0 && bonus === 0) {
    return null;
  }
  const suffix = data.type ? DUMP_TYPE_SUFFIX[data.type] : undefined;
  const title = (data.title || "Roll").trim();
  return {
    id: newRequestId(),
    label: suffix ? `${title}: ${suffix}` : title,
    character,
    dice: mergeTerms(dice),
    bonus,
    source: "pathbuilder",
    externalTotal: typeof data.total === "number" ? data.total : undefined,
  };
}

/** Combine terms with the same die and flags ("1d8 + 1d8" → "2d8") */
function mergeTerms(terms: DiceTerm[]) {
  const merged: DiceTerm[] = [];
  for (const term of terms) {
    const existing = merged.find(
      (m) => m.sides === term.sides && m.doubled === term.doubled && !m.keep && !term.keep
    );
    if (existing) {
      existing.count += term.count;
    } else {
      merged.push({ ...term });
    }
  }
  return merged;
}

/**
 * Parse a dice expression such as "1d20+9", "2d8 + 1d6 - 1" or "1[d20]+7".
 * Returns null when the text contains no dice.
 */
export function parseDiceExpression(
  text: string
): { dice: DiceTerm[]; bonus: number } | null {
  const cleaned = text
    .replace(/\[d/gi, "d")
    .replace(/[\[\]]/g, "")
    .replace(/[−–]/g, "-");
  const tokenRe = /([+-]?)\s*(\d*)\s*d\s*(\d+)|([+-])\s*(\d+)(?!\s*d)/gi;
  const dice: DiceTerm[] = [];
  let bonus = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(cleaned))) {
    if (match[3] !== undefined) {
      const sides = toSides(Number(match[3]));
      const count = match[2] ? Number(match[2]) : 1;
      if (!sides || count <= 0 || count > 50) {
        continue;
      }
      dice.push({ count, sides });
    } else if (match[5] !== undefined) {
      const value = Number(match[5]);
      bonus += match[4] === "-" ? -value : value;
    }
  }
  if (dice.length === 0) {
    return null;
  }
  return { dice: mergeTerms(dice), bonus };
}

/**
 * Convert a Pathbuilder dice history entry to a roll request.
 * Uses the dice tray title/summary when available and falls back to the
 * history text, e.g. "Fortitude\nRoll: 1d20+7 = 19".
 */
export function requestFromHistory(msg: {
  title?: string;
  summary?: string;
  text: string;
  character?: string;
}): RollRequest | null {
  const text = msg.text.replace(/\r/g, "");
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // The equation is the part before "=" on the first line holding dice
  let parsed: { dice: DiceTerm[]; bonus: number } | null = null;
  let externalTotal: number | undefined;
  const candidates = [msg.summary || "", ...lines];
  for (const candidate of candidates) {
    const withoutTotal = candidate.split("=")[0];
    const afterColon = withoutTotal.includes(":")
      ? withoutTotal.slice(withoutTotal.lastIndexOf(":") + 1)
      : withoutTotal;
    parsed = parseDiceExpression(afterColon) || parseDiceExpression(withoutTotal);
    if (parsed) {
      const totalMatch = candidate.match(/=\s*(-?\d+)\s*$/);
      if (totalMatch) {
        externalTotal = Number(totalMatch[1]);
      }
      break;
    }
  }
  if (!parsed) {
    return null;
  }
  if (externalTotal === undefined) {
    const totals = [...text.matchAll(/=\s*(-?\d+)\s*$/gm)];
    const totalMatch = totals.at(-1) || text.match(/total\s*:?\s*(-?\d+)\s*$/im);
    if (totalMatch) {
      externalTotal = Number(totalMatch[1]);
    }
  }

  let label = (msg.title || "").trim();
  if (!label) {
    const first = lines[0] || "Roll";
    // Strip a leading time stamp and a trailing equation
    label = first
      .replace(/^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM|a\. ?m\.|p\. ?m\.)?\s*/i, "")
      .replace(/\s*(roll|total)?\s*:\s*[^:]*\d*d\d+.*$/i, "")
      .trim();
    if (!label || /\d*d\d+/i.test(label)) {
      label = "Roll";
    }
  }
  return {
    id: newRequestId(),
    label,
    character: msg.character,
    dice: parsed.dice,
    bonus: parsed.bonus,
    source: "pathbuilder",
    externalTotal,
  };
}

/** "1d20 + 2d6 + 4" */
export function formatRequest(request: Pick<RollRequest, "dice" | "bonus">) {
  const parts = request.dice.map((term) => {
    const base = term.keep
      ? `${term.count}d${term.sides}${term.keep === "highest" ? "kh" : "kl"}`
      : `${term.count}d${term.sides}`;
    return term.doubled ? `(${base})×2` : base;
  });
  let text = parts.join(" + ");
  if (request.bonus) {
    const sign = request.bonus < 0 ? "-" : "+";
    text = text ? `${text} ${sign} ${Math.abs(request.bonus)}` : `${request.bonus}`;
  }
  return text;
}
