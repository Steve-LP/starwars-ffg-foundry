/**
 * Dice So Nice! 3D Narrative Dice Integration for Star Wars FFG
 *
 * Dice So Nice resolves the term class of every preset via
 * CONFIG.Dice.terms[<denomination>], so each FFG die needs a registered DiceTerm.
 * Foundry core already owns "c" (Coin), "d" (Die) and "f" (FateDie), which Dice So Nice
 * also ships presets for — the FFG dice therefore use non-colliding denominations.
 */

const SYSTEM_ID = "starwars-ffg-scratch";

/** Internal die type -> denomination, face count and preset appearance. */
const FFG_DICE = {
  ability: {
    denomination: "a", faces: 8, colorset: "swffg-green",
    labels: ["", "s", "s", "s\ns", "a", "a", "s\na", "a\na"]
  },
  difficulty: {
    denomination: "i", faces: 8, colorset: "swffg-purple",
    labels: ["", "f", "f\nf", "t", "t", "t", "t\nt", "f\nt"]
  },
  proficiency: {
    denomination: "p", faces: 12, colorset: "swffg-yellow",
    labels: ["", "s", "s", "s\ns", "s\ns", "a", "s\na", "s\na", "s\na", "a\na", "a\na", "x"]
  },
  challenge: {
    denomination: "r", faces: 12, colorset: "swffg-red",
    labels: ["", "f", "f", "f\nf", "f\nf", "t", "t", "f\nt", "f\nt", "t\nt", "t\nt", "y"]
  },
  force: {
    denomination: "w", faces: 12, colorset: "swffg-white",
    labels: ["\nz", "\nz", "\nz", "\nz", "\nz", "\nz", "z\nz", "\nZ", "\nZ", "Z\nZ", "Z\nZ", "Z\nZ"]
  },
  boost: {
    denomination: "b", faces: 6, colorset: "swffg-blue",
    labels: ["", "", "s", "s  \n  a", "a  \n  a", "a"]
  },
  setback: {
    denomination: "s", faces: 6, colorset: "swffg-black",
    labels: ["", "", "f", "f", "t", "t"]
  }
};

const COLORSETS = [
  { name: "swffg-yellow", description: "SWFFG Yellow", foreground: "#000000", background: "#e1aa12" },
  { name: "swffg-blue", description: "SWFFG Blue", foreground: "#000000", background: "#5789aa" },
  { name: "swffg-red", description: "SWFFG Red", foreground: "#ffffff", background: "#7c151e" },
  { name: "swffg-green", description: "SWFFG Green", foreground: "#000000", background: "#127e12" },
  { name: "swffg-purple", description: "SWFFG Purple", foreground: "#ffffff", background: "#6d1287" },
  { name: "swffg-black", description: "SWFFG Black", foreground: "#ffffff", background: "#212121" },
  { name: "swffg-white", description: "SWFFG White", foreground: "#000000", background: "#ffffff" }
];

/**
 * Dice So Nice type id for an internal die type ("ability" -> "da").
 * @param {string} dieType
 * @returns {string|null}
 */
export function getDsnType(dieType) {
  const def = FFG_DICE[dieType];
  return def ? `d${def.denomination}` : null;
}

/**
 * Register one DiceTerm per FFG die in CONFIG.Dice.terms. Call during "init".
 */
export function registerFFGDiceTerms() {
  const Die = foundry.dice.terms.Die;
  for (const [dieType, def] of Object.entries(FFG_DICE)) {
    const existing = CONFIG.Dice.terms[def.denomination];
    if (existing && !existing.SWFFG_DIE) {
      console.warn(`SWFFG | [DiceSoNice] Denomination "${def.denomination}" already taken by ${existing.name}, skipping ${dieType}`);
      continue;
    }
    const DieClass = class extends Die {
      static DENOMINATION = def.denomination;
      static SWFFG_DIE = true;
      constructor(termData = {}) {
        super({ ...termData, faces: def.faces });
      }
    };
    const className = `${dieType.charAt(0).toUpperCase()}${dieType.slice(1)}Die`;
    Object.defineProperty(DieClass, "name", { value: className });
    CONFIG.Dice.terms[def.denomination] = DieClass;
  }
  console.debug("SWFFG | [DiceSoNice] FFG dice terms registered");
}

/**
 * Register system, presets and colorsets with Dice So Nice.
 * @param {object} dice3d  The Dice So Nice API passed to the "diceSoNiceReady" hook
 */
export function registerDiceSoNice(dice3d) {
  dice3d.addSystem({ id: SYSTEM_ID, name: "Star Wars FFG" }, "preferred");

  for (const colorset of COLORSETS) {
    dice3d.addColorset({ category: "Star Wars FFG", outline: "none", texture: "none", ...colorset });
  }

  for (const [dieType, def] of Object.entries(FFG_DICE)) {
    if (CONFIG.Dice.terms[def.denomination]?.SWFFG_DIE !== true) continue;
    dice3d.addDicePreset({
      type: getDsnType(dieType),
      labels: def.labels,
      font: "SWRPG-Symbol-Regular",
      colorset: def.colorset,
      system: SYSTEM_ID
    }, `d${def.faces}`);
  }

  console.info("SWFFG | [DiceSoNice] 3D dice presets registered");
}

/**
 * Animate an already evaluated FFG roll with Dice So Nice. No-op without the module.
 * @param {Array<{type: string, index: number}>} rolls  rolledDice from rollFFGPool()
 */
export async function showFFGRoll(rolls) {
  if (!game.dice3d) return;
  const dice = [];
  for (const roll of rolls) {
    const type = getDsnType(roll.type);
    if (!type) continue;
    // DsN faces are 1-indexed, rollFFGPool indices are 0-indexed
    dice.push({ type, result: roll.index + 1, resultLabel: roll.index + 1, vectors: [], options: {} });
  }
  if (dice.length) await game.dice3d.show({ throws: [{ dice }] }, game.user, true);
}
