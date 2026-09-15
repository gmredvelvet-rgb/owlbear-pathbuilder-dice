import { test } from "node:test";
import assert from "node:assert/strict";

import {
  formatRequest,
  isBridgeMessage,
  parseDiceExpression,
  requestFromDump,
  requestFromHistory,
} from "../src/pathbuilder/protocol.ts";
import {
  abilityModifier,
  extractExportId,
  multipleAttackPenalty,
  parseExport,
  summarize,
} from "../src/pathbuilder/character.ts";

test("parseDiceExpression handles plain and bracketed dice", () => {
  assert.deepEqual(parseDiceExpression("1d20+9"), { dice: [{ count: 1, sides: 20 }], bonus: 9 });
  assert.deepEqual(parseDiceExpression("1[d20] + 7"), { dice: [{ count: 1, sides: 20 }], bonus: 7 });
  assert.deepEqual(parseDiceExpression("2d8 + 1d8 + 1d6 − 1"), {
    dice: [
      { count: 3, sides: 8 },
      { count: 1, sides: 6 },
    ],
    bonus: -1,
  });
  assert.equal(parseDiceExpression("Total: 18"), null);
  assert.equal(parseDiceExpression("1d7+2"), null);
});

test("requestFromDump maps Pathbuilder's structured roll event", () => {
  const attack = requestFromDump(
    { rollDiceDump: [{ numDice: 1, diceSize: 20 }], rollBonus: 11, type: "weaponAttack", title: "Longsword", status: "pending" },
    "Valeros"
  );
  assert.equal(attack?.label, "Longsword: To Hit");
  assert.equal(attack?.character, "Valeros");
  assert.deepEqual(attack?.dice, [{ count: 1, sides: 20, doubled: undefined }]);
  assert.equal(attack?.bonus, 11);

  const crit = requestFromDump({
    rollDiceDump: [
      { numDice: 2, diceSize: 8, extraCritDice: false },
      { numDice: 1, diceSize: 10, extraCritDice: true },
    ],
    rollBonus: 4,
    type: "weaponDamageCritical",
    title: "Longsword",
  });
  assert.equal(crit?.label, "Longsword: Critical");
  assert.deepEqual(crit?.dice, [
    { count: 2, sides: 8, doubled: true },
    { count: 1, sides: 10, doubled: undefined },
  ]);

  assert.equal(requestFromDump({ rollDiceDump: [] }), null);
});

test("requestFromHistory reads the dice tray title and summary", () => {
  const fromTray = requestFromHistory({ title: "Fortitude", summary: "1d20+7", text: "Fortitude\nRoll: 1d20+7 = 19" });
  assert.equal(fromTray?.label, "Fortitude");
  assert.equal(fromTray?.bonus, 7);
  assert.equal(fromTray?.externalTotal, 19);

  const textOnly = requestFromHistory({ text: "10:42 PM Stealth\n Total: 1[d20]+12 = 25" });
  assert.equal(textOnly?.label, "Stealth");
  assert.deepEqual(textOnly?.dice, [{ count: 1, sides: 20 }]);
  assert.equal(textOnly?.bonus, 12);
  assert.equal(textOnly?.externalTotal, 25);

  assert.equal(requestFromHistory({ text: "nothing to roll" }), null);
});

test("formatRequest", () => {
  assert.equal(formatRequest({ dice: [{ count: 1, sides: 20 }], bonus: 9 }), "1d20 + 9");
  assert.equal(formatRequest({ dice: [{ count: 2, sides: 8, doubled: true }], bonus: -1 }), "(2d8)×2 - 1");
  assert.equal(formatRequest({ dice: [{ count: 1, sides: 6 }], bonus: 0 }), "1d6");
});

test("isBridgeMessage", () => {
  assert.equal(isBridgeMessage({ source: "pb-obr-bridge", kind: "hello", version: "1" }), true);
  assert.equal(isBridgeMessage({ source: "other", kind: "hello" }), false);
  assert.equal(isBridgeMessage(null), false);
});

const build = {
  success: true,
  build: {
    name: "Valeros",
    class: "Fighter",
    ancestry: "Human",
    level: 5,
    keyability: "str",
    abilities: { str: 18, dex: 14, con: 14, int: 10, wis: 12, cha: 10 },
    attributes: { ancestryhp: 8, classhp: 10, bonushp: 0, bonushpPerLevel: 0, speed: 25, speedBonus: 0 },
    proficiencies: {
      classDC: 2, perception: 4, fortitude: 4, reflex: 4, will: 2,
      athletics: 4, acrobatics: 2, intimidation: 2, arcana: 0,
    },
    mods: { Athletics: { "Item Bonus": 1 } },
    lores: [["Warfare", 2]],
    weapons: [
      { name: "Longsword", display: "+1 Striking Longsword", die: "d8", str: "striking", attack: 15, damageBonus: 4, damageType: "S", extraDamage: [] },
      { name: "Dagger", display: "Dagger", die: "d4", str: "", attack: 13, damageBonus: 4, damageType: "P", extraDamage: ["1d6 Fire"] },
    ],
    armor: [{ name: "Full Plate", res: "resilient", worn: true }],
    acTotal: { acTotal: 23 },
    spellCasters: [],
  },
};

test("summarize computes PF2e statistics", () => {
  const c = summarize(parseExport(JSON.stringify(build)));
  assert.equal(c.name, "Valeros");
  assert.equal(c.hp, 8 + 5 * (10 + 2));
  assert.equal(c.ac, 23);
  assert.equal(c.classDC, 10 + 4 + 7);
  assert.equal(c.perception.modifier, 1 + 9);
  const [fort, reflex, will] = c.saves;
  assert.equal(fort.modifier, 2 + 9 + 1, "fortitude includes resilient rune");
  assert.equal(reflex.modifier, 2 + 9 + 1);
  assert.equal(will.modifier, 1 + 7 + 1);
  const athletics = c.skills.find((s) => s.key === "athletics")!;
  assert.equal(athletics.modifier, 4 + 9 + 1, "athletics includes item bonus");
  const arcana = c.skills.find((s) => s.key === "arcana")!;
  assert.equal(arcana.modifier, 0, "untrained adds no level");
  assert.equal(c.lores[0].label, "Warfare Lore");
  assert.equal(c.lores[0].modifier, 0 + 7);
  assert.deepEqual(c.strikes[0].damage, [{ count: 2, sides: 8 }]);
  assert.equal(c.strikes[0].agile, false);
  assert.equal(c.strikes[1].agile, true);
  assert.deepEqual(c.strikes[1].damage, [
    { count: 1, sides: 4 },
    { count: 1, sides: 6 },
  ]);
});

test("helpers", () => {
  assert.equal(abilityModifier(18), 4);
  assert.equal(abilityModifier(9), -1);
  assert.equal(abilityModifier(3), 3, "values in modifier range are kept");
  assert.equal(multipleAttackPenalty(0, false), 0);
  assert.equal(multipleAttackPenalty(1, false), -5);
  assert.equal(multipleAttackPenalty(2, true), -8);
  assert.equal(extractExportId("123456"), "123456");
  assert.equal(extractExportId("https://pathbuilder2e.com/json.php?id=98765"), "98765");
  assert.equal(extractExportId("hello"), null);
  assert.throws(() => parseExport({ success: false, error: "nope" }), /nope/);
});
