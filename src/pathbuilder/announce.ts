import OBR from "@owlbear-rodeo/sdk";

import { getCombinedDiceValue } from "../helpers/getCombinedDiceValue";
import { Dice, isDice } from "../types/Dice";
import { DiceRoll } from "../types/DiceRoll";
import { isDie } from "../types/Die";
import { RollResult } from "./protocol";
import { RESULT_CHANNEL } from "./queue";
import { loadSettings } from "./settings";

function dieValue(type: string, value: number) {
  return value === 0 && type === "D10" ? 10 : value;
}

function describe(dice: Dice, values: Record<string, number>): string {
  const parts: string[] = [];
  for (const entry of dice.dice) {
    if (isDie(entry)) {
      parts.push(`${entry.type.toLowerCase()} (${dieValue(entry.type, values[entry.id])})`);
    } else if (isDice(entry)) {
      const inner = describe(entry, values);
      const keep =
        entry.combination === "HIGHEST" ? " kh" : entry.combination === "LOWEST" ? " kl" : "";
      const mult = entry.multiplier && entry.multiplier !== 1 ? `×${entry.multiplier}` : "";
      parts.push(`[${inner}]${keep}${mult}`);
    }
  }
  let text = parts.join(" + ");
  if (dice.bonus) {
    text += dice.bonus > 0 ? ` + ${dice.bonus}` : ` - ${Math.abs(dice.bonus)}`;
  }
  return text;
}

/** Natural 20 / 1 on the first d20 (or kept d20 group) of the roll */
function getNatural(roll: DiceRoll, values: Record<string, number>) {
  for (const entry of roll.dice) {
    let natural: number | null = null;
    if (isDie(entry) && entry.type === "D20") {
      natural = values[entry.id];
    } else if (
      isDice(entry) &&
      entry.dice.length > 0 &&
      entry.dice.every((d) => isDie(d) && d.type === "D20")
    ) {
      natural = getCombinedDiceValue({ dice: entry.dice, combination: entry.combination ?? "HIGHEST" }, values);
    }
    if (natural !== null) {
      return natural === 20 ? "nat20" : natural === 1 ? "nat1" : undefined;
    }
  }
  return undefined;
}

export async function buildResult(
  roll: DiceRoll,
  values: Record<string, number>,
  id: string
): Promise<RollResult | null> {
  const total = getCombinedDiceValue(roll, values);
  if (total === null) {
    return null;
  }
  return {
    id,
    player: await OBR.player.getName(),
    playerColor: await OBR.player.getColor(),
    character: roll.character,
    label: roll.label || "Roll",
    total,
    breakdown: describe(roll, values),
    natural: getNatural(roll, values),
    hidden: roll.hidden,
    at: Date.now(),
  };
}

export function formatResult(result: RollResult) {
  const who = result.character || result.player;
  const nat = result.natural === "nat20" ? " ✨ NAT 20" : result.natural === "nat1" ? " 💀 NAT 1" : "";
  return `${who} — ${result.label}: ${result.total}${nat}`;
}

/** Tell the room (or only this player for hidden rolls) and Discord */
export async function announceResult(result: RollResult) {
  await OBR.broadcast.sendMessage(RESULT_CHANNEL, result, {
    destination: result.hidden ? "LOCAL" : "ALL",
  });
  const { discordWebhook } = loadSettings();
  if (discordWebhook && !result.hidden) {
    const who = result.character || result.player;
    const nat = result.natural === "nat20" ? " ✨ **NAT 20**" : result.natural === "nat1" ? " 💀 **NAT 1**" : "";
    fetch(discordWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🎲 **[${who}]** ${result.label}: **${result.total}**${nat}\n\`${result.breakdown}\``,
      }),
    }).catch(() => {
      // Discord being unreachable must never break rolling
    });
  }
}
