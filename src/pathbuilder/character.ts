/**
 * Pathbuilder 2e JSON export → rollable character statistics.
 * No runtime imports so it can be unit tested with `node --test`.
 */
import type { DiceTerm, DieSides } from "./protocol";

type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export interface PathbuilderBuild {
  name: string;
  class: string;
  ancestry?: string;
  heritage?: string;
  background?: string;
  level: number;
  keyability?: string;
  abilities: Record<AbilityKey, number> & Record<string, unknown>;
  attributes?: {
    ancestryhp?: number;
    classhp?: number;
    bonushp?: number;
    bonushpPerLevel?: number;
    speed?: number;
    speedBonus?: number;
  };
  proficiencies?: Record<string, number | undefined>;
  mods?: Record<string, Record<string, number>>;
  lores?: Array<[string, number, ...unknown[]]>;
  weapons?: Array<{
    name?: string;
    display?: string;
    die?: string;
    str?: string;
    attack?: number;
    damageBonus?: number;
    damageType?: string;
    extraDamage?: string[];
    increasedDice?: boolean;
  }>;
  armor?: Array<{ name?: string; res?: string; worn?: boolean }>;
  acTotal?: { acTotal?: number };
  spellCasters?: Array<{
    name?: string;
    magicTradition?: string;
    ability?: string;
    proficiency?: number;
    innate?: boolean;
  }>;
}

export interface CheckStat {
  key: string;
  label: string;
  modifier: number;
  rank: number;
}

export interface StrikeStat {
  key: string;
  name: string;
  attack: number;
  agile: boolean;
  damage: DiceTerm[];
  damageBonus: number;
  damageType: string;
}

export interface SpellStat {
  key: string;
  label: string;
  attack: number;
  dc: number;
}

export interface CharacterSummary {
  name: string;
  subtitle: string;
  level: number;
  hp: number;
  ac: number | null;
  speed: number;
  classDC: number | null;
  abilities: Record<AbilityKey, number>;
  perception: CheckStat;
  saves: CheckStat[];
  skills: CheckStat[];
  lores: CheckStat[];
  strikes: StrikeStat[];
  spells: SpellStat[];
}

export const SKILLS: [string, string, AbilityKey][] = [
  ["acrobatics", "Acrobatics", "dex"],
  ["arcana", "Arcana", "int"],
  ["athletics", "Athletics", "str"],
  ["crafting", "Crafting", "int"],
  ["deception", "Deception", "cha"],
  ["diplomacy", "Diplomacy", "cha"],
  ["intimidation", "Intimidation", "cha"],
  ["medicine", "Medicine", "wis"],
  ["nature", "Nature", "wis"],
  ["occultism", "Occultism", "int"],
  ["performance", "Performance", "cha"],
  ["religion", "Religion", "wis"],
  ["society", "Society", "int"],
  ["stealth", "Stealth", "dex"],
  ["survival", "Survival", "wis"],
  ["thievery", "Thievery", "dex"],
];

const SAVES: [string, string, AbilityKey][] = [
  ["fortitude", "Fortitude", "con"],
  ["reflex", "Reflex", "dex"],
  ["will", "Will", "wis"],
];

const RESILIENT: Record<string, number> = {
  resilient: 1,
  greaterResilient: 2,
  majorResilient: 3,
};

const STRIKING: Record<string, number> = {
  striking: 2,
  greaterStriking: 3,
  majorStriking: 4,
};

const AGILE_WEAPONS =
  /\b(dagger|shortsword|fist|kukri|sickle|starknife|main-gauche|light hammer|light mace|hatchet|sap|katar|claw|jaws?|horn|tail|talon|gauntlet|spiked gauntlet|throwing knife|kama|nunchaku|sai|wakizashi|tekko-kagi|filcher's fork|butterfly sword|dogslicer|gnome flickmace|hook claw|knuckle duster)\b/i;

/** Accept `{ success, build }`, the bare build, or a JSON string of either */
export function parseExport(input: unknown): PathbuilderBuild {
  let data = input;
  if (typeof data === "string") {
    data = JSON.parse(data);
  }
  if (typeof data !== "object" || data === null) {
    throw new Error("El JSON no contiene un personaje de Pathbuilder.");
  }
  const obj = data as { success?: boolean; build?: unknown; error?: string };
  if (obj.success === false) {
    throw new Error(obj.error || "Pathbuilder no encontró ese personaje.");
  }
  const build = (obj.build ?? data) as PathbuilderBuild;
  if (!build || typeof build.level !== "number" || typeof build.abilities !== "object") {
    throw new Error("El JSON no tiene el formato de exportación de Pathbuilder.");
  }
  return build;
}

/** Pathbuilder exports ability scores (e.g. 18); newer data may use modifiers */
export function abilityModifier(value: number) {
  if (Math.abs(value) <= 5) {
    return value;
  }
  return Math.floor((value - 10) / 2);
}

export function proficiencyBonus(rank: number | undefined, level: number) {
  return rank && rank > 0 ? rank + level : 0;
}

/** Sum of the typed bonuses Pathbuilder lists for a statistic */
function modBonus(build: PathbuilderBuild, label: string, only?: string) {
  const mods = build.mods?.[label] ?? build.mods?.[label.toLowerCase()];
  if (!mods) {
    return 0;
  }
  let total = 0;
  for (const [type, value] of Object.entries(mods)) {
    if (only && type !== only) continue;
    if (typeof value === "number") total += value;
  }
  return total;
}

function parseDie(die: string | undefined): DieSides | null {
  const sides = Number((die || "").replace(/^\d*d/i, ""));
  return [4, 6, 8, 10, 12, 20, 100].includes(sides) ? (sides as DieSides) : null;
}

function step(sides: DieSides): DieSides {
  const order: DieSides[] = [4, 6, 8, 10, 12];
  const i = order.indexOf(sides);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : sides;
}

export function isAgileWeapon(name: string) {
  return AGILE_WEAPONS.test(name);
}

export function summarize(build: PathbuilderBuild): CharacterSummary {
  const level = build.level;
  const abilities = {} as Record<AbilityKey, number>;
  for (const key of ["str", "dex", "con", "int", "wis", "cha"] as AbilityKey[]) {
    abilities[key] = abilityModifier(Number(build.abilities[key]) || 10);
  }
  const prof = build.proficiencies || {};

  const check = (key: string, label: string, ability: AbilityKey, extra = 0): CheckStat => ({
    key,
    label,
    rank: prof[key] || 0,
    modifier: abilities[ability] + proficiencyBonus(prof[key], level) + extra + modBonus(build, label),
  });

  const resilient = Math.max(
    0,
    ...(build.armor || []).filter((a) => a.worn !== false).map((a) => RESILIENT[a.res || ""] || 0)
  );
  const saves = SAVES.map(([key, label, ability]) => {
    // Item bonuses do not stack: the resilient rune replaces a smaller item bonus
    const itemFromMods = modBonus(build, label, "Item Bonus");
    const stat = check(key, label, ability);
    stat.modifier += Math.max(resilient, itemFromMods) - itemFromMods;
    return stat;
  });

  const lores = (build.lores || []).map(([name, rank]) => ({
    key: `lore:${name}`,
    label: `${name} Lore`,
    rank: Number(rank) || 0,
    modifier: abilities.int + proficiencyBonus(Number(rank), level) + modBonus(build, `${name} Lore`),
  }));

  const key = (build.keyability || "").toLowerCase() as AbilityKey;
  const classDC =
    prof.classDC && key in abilities ? 10 + abilities[key] + proficiencyBonus(prof.classDC, level) : null;

  const strikes: StrikeStat[] = (build.weapons || []).flatMap((weapon, index) => {
    const sides = parseDie(weapon.die);
    if (typeof weapon.attack !== "number" || !sides) {
      return [];
    }
    const name = weapon.display || weapon.name || `Weapon ${index + 1}`;
    const damage: DiceTerm[] = [
      {
        count: STRIKING[weapon.str || ""] || 1,
        sides: weapon.increasedDice ? step(sides) : sides,
      },
    ];
    for (const extra of weapon.extraDamage || []) {
      const match = extra.match(/(\d+)\s*d\s*(\d+)/i);
      const extraSides = match ? parseDie(`d${match[2]}`) : null;
      if (match && extraSides) {
        damage.push({ count: Number(match[1]), sides: extraSides });
      }
    }
    return [
      {
        key: `strike:${index}`,
        name,
        attack: weapon.attack,
        agile: isAgileWeapon(`${weapon.name} ${weapon.display}`),
        damage,
        damageBonus: weapon.damageBonus || 0,
        damageType: weapon.damageType || "",
      },
    ];
  });

  const spells: SpellStat[] = [];
  const seenSpell = new Set<string>();
  for (const caster of build.spellCasters || []) {
    const ability = (caster.ability || "").toLowerCase() as AbilityKey;
    if (!(ability in abilities) || !caster.proficiency) continue;
    const attack = abilities[ability] + proficiencyBonus(caster.proficiency, level);
    const id = `${caster.magicTradition}:${ability}:${attack}`;
    if (seenSpell.has(id)) continue;
    seenSpell.add(id);
    const tradition = caster.magicTradition
      ? caster.magicTradition[0].toUpperCase() + caster.magicTradition.slice(1)
      : caster.name || "Spell";
    spells.push({ key: `spell:${id}`, label: `${tradition} Spell Attack`, attack, dc: 10 + attack });
  }

  const attrs = build.attributes || {};
  const hp =
    (attrs.ancestryhp || 0) +
    (attrs.bonushp || 0) +
    level * ((attrs.classhp || 0) + abilities.con + (attrs.bonushpPerLevel || 0));

  return {
    name: build.name || "Sin nombre",
    subtitle: [build.ancestry, build.class, `Nivel ${level}`].filter(Boolean).join(" · "),
    level,
    hp,
    ac: build.acTotal?.acTotal ?? null,
    speed: (attrs.speed || 0) + (attrs.speedBonus || 0),
    classDC,
    abilities,
    perception: check("perception", "Perception", "wis"),
    saves,
    skills: SKILLS.map(([k, label, ability]) => check(k, label, ability)),
    lores,
    strikes,
    spells,
  };
}

/** Multiple attack penalty for the nth attack (0, 1, 2) */
export function multipleAttackPenalty(attackIndex: number, agile: boolean) {
  if (attackIndex <= 0) return 0;
  const step = agile ? 4 : 5;
  return -step * Math.min(attackIndex, 2);
}

/** Extract a numeric export id from "123456" or a Pathbuilder URL */
export function extractExportId(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{1,12}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/pathbuilder2e\.com\/.*[?&]id=(\d{1,12})/i);
  return match ? match[1] : null;
}
