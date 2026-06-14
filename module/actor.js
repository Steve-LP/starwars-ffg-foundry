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
    let maxEncumbranceBonus = 0;
    
    let characteristicMods = {
      brawn: 0,
      agility: 0,
      intellect: 0,
      cunning: 0,
      willpower: 0,
      presence: 0
    };

    for (const item of this.items) {
      if (item.system?.equipped && item.system?.modifiers) {
        inventoryWoundsMod += item.system.modifiers.wounds || 0;
        inventoryStrainMod += item.system.modifiers.strain || 0;
        inventorySoakMod += item.system.modifiers.soak || 0;
        maxEncumbranceBonus += item.system.modifiers.encumbrance || 0;

        // Parse characteristic modifiers (e.g. "brawn:1, agility:-1")
        const charModStr = item.system.modifiers.characteristics || "";
        if (charModStr) {
          const parts = charModStr.split(",");
          for (const part of parts) {
            const [charName, valStr] = part.split(":").map(p => p.trim().toLowerCase());
            if (charName && valStr && characteristicMods[charName] !== undefined) {
              const modVal = parseInt(valStr);
              if (!isNaN(modVal)) {
                characteristicMods[charName] += modVal;
              }
            }
          }
        }
      }
    }

    // Apply characteristic modifiers, clamping values between 1 and 6
    for (const [charName, modVal] of Object.entries(characteristicMods)) {
      if (modVal !== 0 && system.characteristics[charName]) {
        const baseVal = system.characteristics[charName].value || 1;
        system.characteristics[charName].value = Math.max(1, Math.min(6, baseVal + modVal));
      }
    }

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

    // Calculate carried encumbrance
    let carriedEncumbrance = 0;
    for (const item of this.items) {
      if (item.type === "weapon" || item.type === "armor" || item.type === "gear") {
        const enc = item.system.encumbrance || 0;
        const qty = item.system.quantity !== undefined ? (item.system.quantity || 0) : 1;
        if (item.type === "armor" && item.system.equipped) {
          carriedEncumbrance += Math.max(0, enc - 3) * qty;
        } else {
          carriedEncumbrance += enc * qty;
        }
      }
    }

    system.stats.encumbrance = {
      value: carriedEncumbrance,
      max: 5 + (system.characteristics.brawn.value || 0) + maxEncumbranceBonus
    };
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
        const userName = game.users.get(user)?.name || game.user?.name || "Unbekannt";
        
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

  /**
   * Recalculates career skills for the character based on current specs, base career, and talents.
   */
  async recalculateCareerSkills() {
    if (this.type !== "character") return;
    
    const activeCareerSkills = new Set();
    const remainingSpecs = this.items.filter(i => i.type === "specialization");
    const careerName = this.system.biography?.career || "";

    // 1. Add career skills from specializations
    for (const spec of remainingSpecs) {
      const skills = (spec.system?.careerSkills || "").split(",").map(s => s.trim().toLowerCase());
      for (const s of skills) {
        if (s) activeCareerSkills.add(s);
      }
    }

    // 2. Add career skills from base career
    if (careerName) {
      const careerPack = game.packs.get("starwars-ffg-scratch.careers");
      const careerIndex = careerPack ? await careerPack.getIndex({ fields: ["system.careerSkills"] }) : [];
      const careerDoc = careerIndex.find(c => c.name.toLowerCase() === careerName.toLowerCase());
      if (careerDoc) {
        const skills = (careerDoc.system?.careerSkills || "").split(",").map(s => s.trim().toLowerCase());
        for (const s of skills) {
          if (s) activeCareerSkills.add(s);
        }
      }
    }

    // 3. Add career skills unlocked by purchased talents
    const ownedTalents = this.items.filter(t => t.type === "talent");
    for (const talent of ownedTalents) {
      const unlocks = (talent.system?.careerSkillsUnlocks || "").split(",").map(s => s.trim().toLowerCase());
      for (const s of unlocks) {
        if (s) activeCareerSkills.add(s);
      }
    }

    // 4. Update the skills items on the actor
    const currentSkills = this.items.filter(i => i.type === "skill");
    const updates = [];
    
    for (const skill of currentSkills) {
      const isStillCareer = activeCareerSkills.has(skill.name.toLowerCase());
      if (skill.system.career !== isStillCareer) {
        updates.push({
          _id: skill.id,
          "system.career": isStillCareer
        });
      }
    }

    if (updates.length > 0) {
      await this.updateEmbeddedDocuments("Item", updates);
    }
  }

  /** @override */
  _onCreateEmbeddedDocuments(embeddedName, documents, result, options, userId) {
    super._onCreateEmbeddedDocuments(embeddedName, documents, result, options, userId);
    if (userId === game.user.id && (embeddedName === "Item")) {
      const hasSpecOrTalent = documents.some(d => d.type === "specialization" || d.type === "talent");
      if (hasSpecOrTalent) {
        this.recalculateCareerSkills();
      }
    }
  }

  /** @override */
  _onDeleteEmbeddedDocuments(embeddedName, documents, result, options, userId) {
    super._onDeleteEmbeddedDocuments(embeddedName, documents, result, options, userId);
    if (userId === game.user.id && (embeddedName === "Item")) {
      const hasSpecOrTalent = documents.some(d => d.type === "specialization" || d.type === "talent");
      if (hasSpecOrTalent) {
        this.recalculateCareerSkills();
      }
    }
  }

  /** @override */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    if (userId === game.user.id && changed.system?.biography?.career !== undefined) {
      this.recalculateCareerSkills();
    }
  }
}
