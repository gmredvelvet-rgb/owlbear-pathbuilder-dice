# Notice

This project is a modified version of **Owlbear Rodeo Dice**
(https://github.com/owlbear-rodeo/dice), Copyright Owlbear Rodeo, licensed under
the GNU General Public License v3.0. The exact upstream commit is recorded in
`.upstream-commit`.

Changes from upstream (September 2026):

- Own plugin namespace (`com.thegmstudio.pathbuilder-dice`) so it can run next to the official Dice.
- External roll requests with labels, critical multipliers and fortune/misfortune (`src/pathbuilder/`).
- Character sheet popover with Pathbuilder 2e iframe, native Pathbuilder JSON sheet, roll log and settings (`src/sheet/`).
- Room notifications and optional Discord webhook for finished rolls.
- Companion browser extension (`companion/`).
- Build-time manifest with absolute URLs, new branding and icons.

Pathbuilder 2e is a product of its respective author. Pathfinder is a trademark of
Paizo Inc. This project is not affiliated with Pathbuilder 2e, Paizo or Owlbear Rodeo.
