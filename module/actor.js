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

    // Loop items to find relevant passive talents (Grit, Toughened, Enduring)
    let gritRanks = 0;
    let toughenedRanks = 0;
    let enduringRanks = 0;

    for (const item of this.items) {
      if (item.type === "talent") {
        const key = item.system?.key?.toLowerCase() || item.name.toLowerCase();
        if (key === "grit") {
          gritRanks += 1;
        } else if (key === "toughened") {
          toughenedRanks += 1;
        } else if (key === "enduring") {
          enduringRanks += 1;
        }
      }
    }

    // Loop items to find equipped item modifiers (cybernetics, mods, etc.)
    let inventoryWoundsMod = 0;
    let inventoryStrainMod = 0;
    let inventorySoakMod = 0;

    for (const item of this.items) {
      if (item.system?.equipped && item.system?.modifiers) {
        inventoryWoundsMod += item.system.modifiers.wounds || 0;
        inventoryStrainMod += item.system.modifiers.strain || 0;
        inventorySoakMod += item.system.modifiers.soak || 0;
      }
    }

    // Resolve base thresholds (fallback to current max minus talent/item bonuses for legacy actors)
    const baseWounds = system.stats.wounds.base || (system.stats.wounds.max - (toughenedRanks * 2) - inventoryWoundsMod) || 10;
    const baseStrain = system.stats.strain.base || (system.stats.strain.max - gritRanks - inventoryStrainMod) || 10;

    // If base wasn't set, persist it so it shows up in the UI properly
    if (!system.stats.wounds.base) system.stats.wounds.base = baseWounds;
    if (!system.stats.strain.base) system.stats.strain.base = baseStrain;

    // Derive final values
    system.stats.wounds.max = baseWounds + (toughenedRanks * 2) + inventoryWoundsMod;
    system.stats.strain.max = baseStrain + gritRanks + inventoryStrainMod;
    system.stats.soak.value = (system.characteristics.brawn.value || 0) + armorSoak + enduringRanks + inventorySoakMod;

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

  /** @override */
  async _preUpdate(changed, options, user) {
    await super._preUpdate(changed, options, user);

    const changedXp = changed.system?.xp;
    // Only character type actor templates contain the xp.log schema
    if (changedXp && this.type === "character") {
      const currentAvailable = this.system.xp?.available ?? 0;
      const currentTotal = this.system.xp?.total ?? 0;
      
      const newAvailable = changedXp.available !== undefined ? Number(changedXp.available) : currentAvailable;
      const newTotal = changedXp.total !== undefined ? Number(changedXp.total) : currentTotal;
      
      const diffAvailable = newAvailable - currentAvailable;
      const diffTotal = newTotal - currentTotal;
      
      if (diffAvailable !== 0 || diffTotal !== 0) {
        const timestamp = new Date().toLocaleString("de-DE");
        const userName = game.users.get(user)?.name || "Unbekannt";
        
        let desc = "";
        let changeVal = 0;
        
        if (diffAvailable !== 0 && diffTotal !== 0 && diffAvailable === diffTotal) {
          desc = "XP erhalten (Zuweisung durch GM/System)";
          changeVal = diffAvailable;
        } else if (diffAvailable !== 0) {
          desc = diffAvailable > 0 ? "XP erstattet / korrigiert" : "XP ausgegeben / korrigiert";
          changeVal = diffAvailable;
        } else if (diffTotal !== 0) {
          desc = "Maximales XP angepasst";
          changeVal = diffTotal;
        }
        
        if (options.xpLogDescription) {
          desc = options.xpLogDescription;
        }
        
        const currentLog = Array.from(this.system.xp?.log || []);
        currentLog.push({
          timestamp,
          user: userName,
          change: changeVal > 0 ? `+${changeVal}` : `${changeVal}`,
          positive: changeVal > 0,
          description: desc,
          prevAvailable: currentAvailable,
          prevTotal: currentTotal,
          available: newAvailable,
          total: newTotal
        });
        
        // Keep last 50 entries to avoid bloating
        if (currentLog.length > 50) currentLog.shift();
        
        if (!changed.system) changed.system = {};
        if (!changed.system.xp) changed.system.xp = {};
        changed.system.xp.log = currentLog;
      }
    }
  }
}
