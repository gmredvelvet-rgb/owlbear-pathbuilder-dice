import { Dice } from "./Dice";

/**
 * The roll of a set of dice.
 * See `Dice` type for examples of usage
 */
export interface DiceRoll extends Dice {
  hidden?: boolean;
  /** What the roll is for, e.g. "Will" or "Longsword: To Hit" */
  label?: string;
  /** Character that made the roll */
  character?: string;
  /** Where the roll came from */
  source?: "pathbuilder" | "native-sheet" | "manual";
}
