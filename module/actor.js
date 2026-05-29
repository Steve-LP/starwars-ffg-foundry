import { rollFFGPool, sendRollToChat } from "./dice.js";

/**
 * Custom Actor class for Star Wars FFG Ruleset
 */
export class SWFFGActor extends Actor {
  /** @override */
  prepareData() {
    super.prepareData();
  }

  /** @override */
  prepareDerivedData() {
    const actorData = this;
    const system = actorData.system;

    // Default calculations for Soak, defense, wounds, strain
    // Soak = Brawn + soak from armor/items
    let armorSoak = 0;
    let armorMeleeDefence = 0;
    let armorRangedDefence = 0;

    // Loop items to find equipped armor
    for (const item of this.items) {
      if (item.type === "armor" && item.system.equipped) {
        armorSoak += item.system.soak || 0;
        armorMeleeDefence = Math.max(armorMeleeDefence, item.system.defence || 0);
        armorRangedDefence = Math.max(armorRangedDefence, item.system.defence || 0);
      }
    }

    system.stats.soak.value = (system.characteristics.brawn.value || 0) + armorSoak;
    system.stats.defence.melee = armorMeleeDefence;
    system.stats.defence.ranged = armorRangedDefence;
  }

  /**
   * Helper to execute a skill roll
   * @param {string} skillId - The skill identifier
   * @param {Object} skillData - The skill definition (rank, characteristic, etc.)
   */
  async rollSkill(skillId, skillData, options = {}) {
    const charName = skillData.characteristic;
    const charValue = this.system.characteristics[charName]?.value || 0;
    const skillRank = skillData.value || 0;

    // In Star Wars FFG:
    // Ability Dice (Green) = Math.abs(Characteristic - Skill Rank)
    // Proficiency Dice (Yellow) = Math.min(Characteristic, Skill Rank)
    const greenCount = Math.abs(charValue - skillRank);
    const yellowCount = Math.min(charValue, skillRank);

    const pool = {
      ability: greenCount,
      proficiency: yellowCount,
      boost: options.boost || 0,
      difficulty: options.difficulty || 0,
      challenge: options.challenge || 0,
      setback: options.setback || 0,
      force: options.force || 0
    };

    const rollResult = rollFFGPool(pool);
    const label = `${this.name} rolls ${skillData.label || skillId} (${charName.toUpperCase()})`;
    await sendRollToChat(this, rollResult, label);
  }
}
