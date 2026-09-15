import { generateDiceId } from "../helpers/generateDiceId";
import { useDiceControlsStore } from "../controls/store";
import { Dice } from "../types/Dice";
import { DiceRoll } from "../types/DiceRoll";
import { DiceStyle } from "../types/DiceStyle";
import { DiceType } from "../types/DiceType";
import { Die } from "../types/Die";
import { DiceTerm, RollRequest } from "./protocol";

/** Use the style the player picked in the tray for each die type */
function getStyle(type: DiceType): DiceStyle {
  const { diceSet } = useDiceControlsStore.getState();
  return (
    diceSet.dice.find((die) => die.type === type)?.style ||
    diceSet.dice[0]?.style ||
    "GALAXY"
  );
}

function makeDie(sides: DiceTerm["sides"]): Die | Dice {
  if (sides === 100) {
    // A d100 is rolled as a percentile die plus a d10
    return {
      dice: [
        { id: generateDiceId(), style: getStyle("D100"), type: "D100" },
        { id: generateDiceId(), style: getStyle("D10"), type: "D10" },
      ],
    };
  }
  const type = `D${sides}` as DiceType;
  return { id: generateDiceId(), style: getStyle(type), type };
}

function termToDice(term: DiceTerm): Die | Dice {
  const dice: (Die | Dice)[] = [];
  for (let i = 0; i < term.count; i++) {
    dice.push(makeDie(term.sides));
  }
  const group: Dice = { dice };
  if (term.keep) {
    group.combination = term.keep === "highest" ? "HIGHEST" : "LOWEST";
  }
  if (term.doubled) {
    group.multiplier = 2;
  }
  // Avoid needless nesting for a single plain die
  if (dice.length === 1 && !term.keep && !term.doubled) {
    return dice[0];
  }
  return group;
}

export function requestToDiceRoll(
  request: RollRequest,
  forceHidden: boolean
): DiceRoll {
  return {
    dice: request.dice.map(termToDice),
    bonus: request.bonus || undefined,
    hidden: request.hidden || forceHidden || undefined,
    label: request.label,
    character: request.character,
    source: request.source,
  };
}
