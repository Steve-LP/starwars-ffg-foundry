import { rollFFGPool, sendRollToChat } from "./dice.js";
import { DEFAULT_SKILLS } from "./actor-sheet.js";

/**
 * Custom Actor class for Star Wars FFG Ruleset
 */
export class SWFFGActor extends Actor {
  /** @override */
  prepareData() {
    super.prepareData();
  }

  get dutyXp() {
    if (this.type !== "character") return 0;
    return (this.system.creation?.baseGroupDutyXp || 0) + (this.system.creation?.doubleDuty ? 10 : 0);
  }

  get maxAttributeXpAllowed() {
    if (this.type !== "character") return 0;
    return (this.system.creation?.startingXp || 0) + this.dutyXp;
  }

  get currentAttributeXpSpent() {
    if (this.type !== "character") return 0;
    let totalCost = 0;
    const characteristics = ["brawn", "agility", "intellect", "cunning", "willpower", "presence"];
    
    const currentChars = this._source.system.characteristics || {};
    const baseChars = this.system.creation?.baseCharacteristics || {};
    
    for (const charName of characteristics) {
      const baseVal = baseChars[charName] !== undefined ? baseChars[charName] : 2;
      const currentVal = currentChars[charName]?.value !== undefined ? currentChars[charName].value : baseVal;
      
      if (currentVal > baseVal) {
        for (let v = baseVal + 1; v <= currentVal; v++) {
          totalCost += v * 10;
        }
      }
    }
    return totalCost;
  }

  calculateSpentTalentXp() {
    if (this.type !== "character") return 0;
    let spent = 0;
    for (const item of this.items) {
      if (item.type === "talent") {
        const specName = item.system?.specialization?.toLowerCase() || "";
        const parentSpec = this.items.find(s => s.type === "specialization" && s.name.toLowerCase() === specName);
        const isSignatureAbility = parentSpec?.system?.classification === "signature-ability";

        const row = item.system?.row;
        if (row !== undefined && row !== null) {
          if (isSignatureAbility) {
            spent += (row <= 1) ? 10 : 15;
          } else {
            spent += (row + 1) * 5;
          }
        } else {
          const tier = item.system?.tier || 1;
          spent += tier * 5;
        }
      }
    }
    return spent;
  }

  calculateSpentSpecializationXp() {
    if (this.type !== "character") return 0;
    const specs = this.items.filter(item => item.type === "specialization");
    if (specs.length === 0) return 0;

    let totalCost = 0;

    // 1. Calculate regular specializations
    const regularSpecs = specs.filter(s => {
      const cls = s.system?.classification || "career";
      return ["career", "non-career", "universal"].includes(cls);
    });
    
    for (let i = 1; i < regularSpecs.length; i++) {
      const spec = regularSpecs[i];
      if (spec.system?.customXpCost !== null && spec.system?.customXpCost !== undefined) {
        totalCost += spec.system.customXpCost;
      } else {
        let cost = (i + 1) * 10;
        if (spec.system?.classification === "non-career") {
          cost += 10;
        }
        totalCost += cost;
      }
    }

    // 2. Calculate Force Powers and Signature Abilities
    const nonRegularSpecs = specs.filter(s => {
      const cls = s.system?.classification;
      return ["force-power", "signature-ability"].includes(cls);
    });

    for (const spec of nonRegularSpecs) {
      if (spec.system?.customXpCost !== null && spec.system?.customXpCost !== undefined) {
        totalCost += spec.system.customXpCost;
      } else {
        const cls = spec.system.classification;
        totalCost += (cls === "signature-ability") ? 30 : 10;
      }
    }

    return totalCost;
  }

  canAffordSpecialization(specItemData) {
    if (this.type !== "character") return true;
    const isGM = game.user?.isGM || false;
    if (isGM) return true;

    const classification = specItemData?.system?.classification || "career";
    let cost = 0;

    if (specItemData?.system?.customXpCost !== null && specItemData?.system?.customXpCost !== undefined) {
      cost = specItemData.system.customXpCost;
    } else if (classification === "force-power") {
      cost = 10;
    } else if (classification === "signature-ability") {
      cost = 30;
    } else {
      const specs = this.items.filter(item => {
        const cls = item.system?.classification || "career";
        return ["career", "non-career", "universal"].includes(cls);
      });
      const nextIndex = specs.length;
      if (nextIndex === 0) return true;

      cost = (nextIndex + 1) * 10;
      if (classification === "non-career") {
        cost += 10;
      }
    }

    return this.totalAvailableXp >= cost;
  }

  getSkillFreeRanks(item) {
    if (!item) return 0;
    if (this.type !== "character") return item.system.freeRanks || 0;
    const nameLower = item.name.toLowerCase();
    if (this.derivedSkills?.[nameLower]) {
      return this.derivedSkills[nameLower].freeRanks;
    }
    const baseFreeRanks = item._source?.system?.freeRanks ?? item.system?.freeRanks ?? 0;
    
    let careerBonus = 0;
    const freeCareer = this.system.creation?.ledger?.freeCareerSkills || this.system.creation?.freeCareerSkills || [];
    if (freeCareer.some(s => s.toLowerCase() === nameLower)) {
      careerBonus = 1;
    }
    
    let specBonus = 0;
    const freeSpec = this.system.creation?.ledger?.freeSpecializationSkills || this.system.creation?.freeSpecializationSkills || [];
    if (freeSpec.some(s => s.toLowerCase() === nameLower)) {
      specBonus = 1;
    }
    
    return Math.min(2, baseFreeRanks + careerBonus + specBonus);
  }

  calculateSpentSkillXp() {
    if (this.type !== "character") return 0;
    let spent = 0;
    const isCreationMode = this.system.creation?.isCreationMode === true;
    
    if (isCreationMode) {
      const upgrades = this.system.creation?.ledger?.upgrades?.skills || {};
      for (const [sNameLower, upgradeVal] of Object.entries(upgrades)) {
        if (upgradeVal > 0 && this.derivedSkills?.[sNameLower]) {
          const freeRanks = this.derivedSkills[sNameLower].freeRanks;
          const isCareer = this.derivedSkills[sNameLower].career;
          const finalRank = freeRanks + upgradeVal;
          for (let r = freeRanks + 1; r <= finalRank; r++) {
            spent += isCareer ? (r * 5) : ((r * 5) + 5);
          }
        }
      }
    } else {
      for (const item of this.items) {
        if (item.type === "skill") {
          const val = item.system?.value || 0;
          const freeRanks = this.getSkillFreeRanks(item);
          const isCareer = item.system?.career || false;
          if (val > freeRanks) {
            for (let r = freeRanks + 1; r <= val; r++) {
              spent += isCareer ? (r * 5) : ((r * 5) + 5);
            }
          }
        }
      }
    }
    return spent;
  }

  get totalAvailableXp() {
    if (this.type !== "character") return 0;
    const total = (this.system.creation?.startingXp || 0) + this.dutyXp + (this.system.xp?.earned || 0);
    return total - this.currentAttributeXpSpent - this.calculateSpentTalentXp() - this.calculateSpentSpecializationXp() - this.calculateSpentSkillXp();
  }

  async buyAttribute(attributeName) {
    if (this.type !== "character") return;
    const isGM = game.user?.isGM || false;
    const isCreationMode = this.system.creation?.isCreationMode === true;

    // Get current raw value of the attribute
    const currentRawChars = this._source.system.characteristics || {};
    const baseChars = this.system.creation?.baseCharacteristics || {};
    const baseVal = baseChars[attributeName] !== undefined ? baseChars[attributeName] : 2;
    
    // In creation mode, the value comes from species base + ledger upgrades
    const species = this.system.creation?.speciesSnapshot;
    const speciesBaseVal = species ? (species.characteristics?.[attributeName]?.value ?? species.characteristics?.[attributeName] ?? 2) : 2;
    const currentUpgrades = this.system.creation?.ledger?.upgrades?.characteristics?.[attributeName] || 0;
    const currentRawValue = isCreationMode ? (speciesBaseVal + currentUpgrades) : (currentRawChars[attributeName]?.value !== undefined ? currentRawChars[attributeName].value : baseVal);

    const cost = (currentRawValue + 1) * 10;
    const currentAvailable = this.system.xp?.available || 0;

    const isSandbox = this.system.creation?.sandboxMode || false;

    if (!isSandbox) {
      if (!isCreationMode) {
        if (!isGM) {
          ui.notifications?.error("Attribute können nach der Charaktererstellung nicht mehr mit XP gesteigert werden!");
          return;
        }
      }
      if (this.totalAvailableXp < cost) {
        ui.notifications?.warn(`Nicht genug XP vorhanden! (Kosten: ${cost} XP, Verfügbar: ${this.totalAvailableXp} XP)`);
        return;
      }
      if (this.currentAttributeXpSpent + cost > this.maxAttributeXpAllowed) {
        ui.notifications?.warn(`Das Spezies-Limit für Attribute (${this.maxAttributeXpAllowed} XP) wurde erreicht!`);
        return;
      }
      if (isCreationMode && currentRawValue >= 5) {
        ui.notifications?.warn(`Während der Charaktererstellung dürfen Attribute nicht über Wert 5 gesteigert werden!`);
        return;
      }
    }

    if (isCreationMode) {
      // Creation Mode: Update ledger upgrades. Suppress log.
      await this.update({
        [`system.creation.ledger.upgrades.characteristics.${attributeName}`]: currentUpgrades + 1
      });
      ui.notifications?.info(`${attributeName.toUpperCase()} auf ${currentRawValue + 1} gesteigert.`);
    } else {
      // In-game/GM override: Update standard attribute field in database. Perform log.
      const newAvailable = Math.max(0, currentAvailable - cost);
      await this.update({
        [`system.characteristics.${attributeName}.value`]: currentRawValue + 1,
        "system.xp.available": newAvailable
      }, {
        xpLogDescription: `Attribut gesteigert: ${attributeName.toUpperCase()} von ${currentRawValue} auf ${currentRawValue + 1} (-${cost} XP)`
      });
      ui.notifications?.info(`${attributeName.toUpperCase()} auf ${currentRawValue + 1} gesteigert für ${cost} XP.`);
    }
  }

  async decreaseAttribute(attributeName) {
    if (this.type !== "character") return;
    const isGM = game.user?.isGM || false;
    const isCreationMode = this.system.creation?.isCreationMode === true;

    const currentRawChars = this._source.system.characteristics || {};
    const baseChars = this.system.creation?.baseCharacteristics || {};
    const baseVal = baseChars[attributeName] !== undefined ? baseChars[attributeName] : 2;

    const species = this.system.creation?.speciesSnapshot;
    const speciesBaseVal = species ? (species.characteristics?.[attributeName]?.value ?? species.characteristics?.[attributeName] ?? 2) : 2;
    const currentUpgrades = this.system.creation?.ledger?.upgrades?.characteristics?.[attributeName] || 0;
    const currentRawValue = isCreationMode ? (speciesBaseVal + currentUpgrades) : (currentRawChars[attributeName]?.value !== undefined ? currentRawChars[attributeName].value : baseVal);

    if (isCreationMode) {
      if (currentUpgrades <= 0) {
        ui.notifications?.warn(`Kann ${attributeName.toUpperCase()} nicht unter den Basiswert von ${speciesBaseVal} senken!`);
        return;
      }
      await this.update({
        [`system.creation.ledger.upgrades.characteristics.${attributeName}`]: currentUpgrades - 1
      });
      ui.notifications?.info(`${attributeName.toUpperCase()} auf ${currentRawValue - 1} gesenkt.`);
    } else {
      if (currentRawValue <= baseVal) {
        ui.notifications?.warn(`Kann ${attributeName.toUpperCase()} nicht unter den Basiswert von ${baseVal} senken!`);
        return;
      }
      if (!isGM) {
        ui.notifications?.error("Attribute können nach der Charaktererstellung nicht mehr verändert werden!");
        return;
      }
      const refund = currentRawValue * 10;
      const currentAvailable = this.system.xp?.available || 0;
      const newAvailable = currentAvailable + refund;

      await this.update({
        [`system.characteristics.${attributeName}.value`]: currentRawValue - 1,
        "system.xp.available": newAvailable
      }, {
        xpLogDescription: `Attribut gesenkt: ${attributeName.toUpperCase()} von ${currentRawValue} auf ${currentRawValue - 1} (+${refund} XP erstattet)`
      });
      ui.notifications?.info(`${attributeName.toUpperCase()} auf ${currentRawValue - 1} gesenkt. ${refund} XP erstattet.`);
    }
  }

  async buySkillRank(skillName, skillChar, skillCat) {
    if (this.type !== "character") return;
    const isGM = game.user?.isGM || false;
    const isCreationMode = this.system.creation?.isCreationMode === true;

    // Make sure skill item exists
    const skillItem = this.items.find(i => i.type === "skill" && i.name.toLowerCase() === skillName.toLowerCase());
    
    // In creation mode, the base rank is the free starting ranks, upgraded ranks are in the ledger
    const freeRanks = this.derivedSkills?.[skillName.toLowerCase()]?.freeRanks || 0;
    const currentUpgrades = this.system.creation?.ledger?.upgrades?.skills?.[skillName] || 0;
    const currentRank = isCreationMode ? (freeRanks + currentUpgrades) : (skillItem?.system?.value || 0);
    const isCareer = isCreationMode ? (this.derivedSkills?.[skillName.toLowerCase()]?.career || false) : (skillItem?.system?.career || false);

    const nextRank = currentRank + 1;
    const cost = isCareer ? (nextRank * 5) : ((nextRank * 5) + 5);
    const currentAvailable = this.system.xp?.available || 0;

    const isSandbox = this.system.creation?.sandboxMode || false;

    if (!isSandbox) {
      if (!isCreationMode) {
        if (!isGM) {
          ui.notifications?.error("Fertigkeiten können nach der Charaktererstellung hier nicht gesteigert werden!");
          return;
        }
      }
      if (this.totalAvailableXp < cost) {
        ui.notifications?.warn(`Nicht genug XP vorhanden! (Kosten: ${cost} XP, Verfügbar: ${this.totalAvailableXp} XP)`);
        return;
      }
      if (isCreationMode && currentRank >= 2) {
        ui.notifications?.warn(`Während der Charaktererstellung dürfen Fertigkeiten nicht über Rang 2 gesteigert werden!`);
        return;
      }
    }

    if (isCreationMode) {
      // Creation Mode: Ensure item exists first
      if (!skillItem) {
        await this.createEmbeddedDocuments("Item", [{
          name: skillName,
          type: "skill",
          system: { value: 0, characteristic: skillChar, category: skillCat, career: false, freeRanks: 0 }
        }]);
      }
      // Update ledger upgrade in DB. Suppress log.
      await this.update({
        [`system.creation.ledger.upgrades.skills.${skillName}`]: currentUpgrades + 1
      });
      ui.notifications?.info(`Rang ${nextRank} in ${skillName} erworben.`);
    } else {
      // In-game: Update item value and actor xp available. Perform log.
      const newAvailable = Math.max(0, currentAvailable - cost);
      await this.update({
        "system.xp.available": newAvailable
      }, {
        xpLogDescription: `Rang erworben: ${skillName} von ${currentRank} auf ${nextRank} (-${cost} XP)`
      });

      if (skillItem) {
        await skillItem.update({ "system.value": nextRank });
      } else {
        await this.createEmbeddedDocuments("Item", [{
          name: skillName,
          type: "skill",
          system: { value: 1, characteristic: skillChar, category: skillCat, career: false }
        }]);
      }
      ui.notifications?.info(`Rang ${nextRank} in ${skillName} gekauft für ${cost} XP.`);
    }
  }

  async decreaseSkillRank(skillName) {
    if (this.type !== "character") return;
    const isGM = game.user?.isGM || false;
    const isCreationMode = this.system.creation?.isCreationMode === true;

    const skillItem = this.items.find(i => i.type === "skill" && i.name.toLowerCase() === skillName.toLowerCase());
    
    const freeRanks = this.derivedSkills?.[skillName.toLowerCase()]?.freeRanks || 0;
    const currentUpgrades = this.system.creation?.ledger?.upgrades?.skills?.[skillName] || 0;
    const currentRank = isCreationMode ? (freeRanks + currentUpgrades) : (skillItem?.system?.value || 0);

    if (isCreationMode) {
      if (currentUpgrades <= 0) {
        ui.notifications?.warn(`Kann ${skillName} nicht unter den Startwert von ${freeRanks} senken!`);
        return;
      }
      await this.update({
        [`system.creation.ledger.upgrades.skills.${skillName}`]: currentUpgrades - 1
      });
      ui.notifications?.info(`Rang ${currentRank - 1} in ${skillName} verringert.`);
    } else {
      if (currentRank <= freeRanks) {
        ui.notifications?.warn(`Kann ${skillName} nicht unter den Startwert von ${freeRanks} senken!`);
        return;
      }
      if (!isGM) {
        ui.notifications?.error("Fertigkeiten können nach der Charaktererstellung hier nicht verändert werden!");
        return;
      }
      const isCareer = skillItem?.system?.career || false;
      const refund = isCareer ? (currentRank * 5) : ((currentRank * 5) + 5);
      const currentAvailable = this.system.xp?.available || 0;
      const newAvailable = currentAvailable + refund;

      await this.update({
        "system.xp.available": newAvailable
      }, {
        xpLogDescription: `Rang zurückgesetzt: ${skillName} von ${currentRank} auf ${currentRank - 1} (+${refund} XP erstattet)`
      });

      if (skillItem) {
        await skillItem.update({ "system.value": currentRank - 1 });
      }
      ui.notifications?.info(`Rang ${currentRank} in ${skillName} zurückgesetzt. ${refund} XP erstattet.`);
    }
  }

  async toggleSandboxMode() {
    if (this.type !== "character") return;
    if (!game.user?.isGM) return;

    const currentSandbox = this.system.creation?.sandboxMode || false;
    const newSandbox = !currentSandbox;

    await this.update({
      "system.creation.sandboxMode": newSandbox
    }, {
      xpLogDescription: `GM Sandbox-Modus ${newSandbox ? "AKTIVIERT" : "DEAKTIVIERT"} (Validierungsregeln umgangen)`
    });
    ui.notifications?.info(`GM Sandbox-Modus ${newSandbox ? "aktiviert" : "deaktiviert"}.`);
  }

  async resetToCreationMode() {
    if (this.type !== "character") return;
    const confirmReset = confirm("Möchtest du den Charakter komplett auf die Standardwerte zurücksetzen? Dadurch werden auch Spezies, Karriere, Spezialisierungen und alle erworbenen Fertigkeiten/Talente gelöscht.");
    if (!confirmReset) return;

    // Delete all specialization, talent, and other items
    const itemsToDelete = this.items.filter(i => ["specialization", "talent", "forcepower", "signatureability"].includes(i.type)).map(i => i.id);
    if (itemsToDelete.length > 0) {
      await this.deleteEmbeddedDocuments("Item", itemsToDelete);
    }

    // Reset skill items back to value 0, freeRanks 0, career false in database
    const skillUpdates = [];
    for (const item of this.items) {
      if (item.type === "skill") {
        skillUpdates.push({
          _id: item.id,
          "system.value": 0,
          "system.freeRanks": 0,
          "system.career": false
        });
      }
    }
    if (skillUpdates.length > 0) {
      await this.updateEmbeddedDocuments("Item", skillUpdates);
    }

    const updates = {
      "system.creation.isCreationMode": true,
      "system.creation.sandboxMode": false,
      "system.creation.careerSkills": [],
      "system.creation.freeCareerSkills": [],
      "system.creation.specializationSkills": [],
      "system.creation.freeSpecializationSkills": [],
      "system.biography.species": "",
      "system.biography.career": "",
      "system.biography.specialization": "",
      "system.biography.specialAbilities": "",
      "system.characteristics.brawn.value": 2,
      "system.characteristics.agility.value": 2,
      "system.characteristics.intellect.value": 2,
      "system.characteristics.cunning.value": 2,
      "system.characteristics.willpower.value": 2,
      "system.characteristics.presence.value": 2,
      "system.creation.baseCharacteristics": {
        brawn: 2, agility: 2, intellect: 2, cunning: 2, willpower: 2, presence: 2
      },
      "system.stats.wounds.base": 10,
      "system.stats.strain.base": 10,
      "system.stats.wounds.max": 10,
      "system.stats.strain.max": 10,
      "system.creation.startingXp": 0,
      "system.xp.available": 0,
      "system.xp.total": 0,
      "system.xp.earned": 0,
      "system.xp.log": [],
      
      // Clean up snapshots and ledger
      "system.creation.speciesSnapshot": null,
      "system.creation.careerSnapshot": null,
      "system.creation.specializationSnapshot": null,
      "system.creation.ledger": {
        speciesSkillChoice: "",
        freeCareerSkills: [],
        freeSpecializationSkills: [],
        upgrades: {
          characteristics: { brawn: 0, agility: 0, intellect: 0, cunning: 0, willpower: 0, presence: 0 },
          skills: {},
          talents: [],
          specializations: []
        }
      }
    };

    await this.update(updates, {
      xpLogDescription: "Charakter vollständig zurückgesetzt (Full-Reset auf Standardwerte)"
    });
    
    ui.notifications?.info("Charakter erfolgreich auf Standardwerte zurückgesetzt.");
  }

  async lockCreation() {
    if (this.type !== "character") return;
    
    // 1. Verify validations
    const validation = this.system.creation?.validation;
    const isGM = game.user?.isGM || false;
    if (!validation?.lockAllowed && !isGM) {
      ui.notifications?.error("Charaktererstellung kann nicht gesperrt werden. Nicht alle Bedingungen sind erfüllt.");
      return;
    }

    const timestamp = new Date().toLocaleString("de-DE");
    const userName = game.user?.name || game.users.get(game.userId)?.name || "Unbekannt";
    const logEntries = [];

    // Start tracking available XP starting from the total baseline
    const startingXp = this.system.creation?.startingXp || 0;
    let currentLogAvailable = startingXp + this.dutyXp + (this.system.xp?.earned || 0);
    const totalXp = currentLogAvailable;

    const addLogEntry = (desc, cost) => {
      const prevAvailable = currentLogAvailable;
      currentLogAvailable -= cost;
      logEntries.push({
        timestamp,
        user: userName,
        change: `-${cost}`,
        positive: false,
        description: desc,
        prevAvailable: prevAvailable,
        prevTotal: totalXp,
        available: currentLogAvailable,
        total: totalXp
      });
    };

    // Gather derived values before we clear ledger
    const derivedBrawn = this.system.characteristics.brawn.value;
    const derivedAgility = this.system.characteristics.agility.value;
    const derivedIntellect = this.system.characteristics.intellect.value;
    const derivedCunning = this.system.characteristics.cunning.value;
    const derivedWillpower = this.system.characteristics.willpower.value;
    const derivedPresence = this.system.characteristics.presence.value;

    const baseChars = this.system.creation?.baseCharacteristics || { brawn: 2, agility: 2, intellect: 2, cunning: 2, willpower: 2, presence: 2 };

    // 1. Attribute net upgrades logging
    for (const char of ["brawn", "agility", "intellect", "cunning", "willpower", "presence"]) {
      const baseVal = baseChars[char] ?? 2;
      const currentVal = this.system.characteristics[char].value;
      if (currentVal > baseVal) {
        let cost = 0;
        for (let v = baseVal + 1; v <= currentVal; v++) {
          cost += v * 10;
        }
        addLogEntry(`Attribut gesteigert: ${char.toUpperCase()} von ${baseVal} auf ${currentVal} (-${cost} XP)`, cost);
      }
    }

    // 2. Skill net upgrades logging
    for (const item of this.items) {
      if (item.type === "skill") {
        const derived = this.derivedSkills?.[item.name.toLowerCase()];
        if (derived && derived.value > derived.freeRanks) {
          const isCareer = derived.career;
          let cost = 0;
          for (let r = derived.freeRanks + 1; r <= derived.value; r++) {
            cost += isCareer ? (r * 5) : ((r * 5) + 5);
          }
          addLogEntry(`Rang erworben: ${item.name} von ${derived.freeRanks} auf ${derived.value} (-${cost} XP)`, cost);
        }
      }
    }

    // 3. Specialization net upgrades logging
    const specs = this.items.filter(item => item.type === "specialization");
    const regularSpecs = specs.filter(s => {
      const cls = s.system?.classification || "career";
      return ["career", "non-career", "universal"].includes(cls);
    });
    for (let i = 1; i < regularSpecs.length; i++) {
      const spec = regularSpecs[i];
      let cost = 0;
      if (spec.system?.customXpCost !== null && spec.system?.customXpCost !== undefined) {
        cost = spec.system.customXpCost;
      } else {
        cost = (i + 1) * 10;
        if (spec.system?.classification === "non-career") {
          cost += 10;
        }
      }
      addLogEntry(`Spezialisierung erworben: ${spec.name} (-${cost} XP)`, cost);
    }
    const nonRegularSpecs = specs.filter(s => {
      const cls = s.system?.classification;
      return ["force-power", "signature-ability"].includes(cls);
    });
    for (const spec of nonRegularSpecs) {
      let cost = 0;
      if (spec.system?.customXpCost !== null && spec.system?.customXpCost !== undefined) {
        cost = spec.system.customXpCost;
      } else {
        const cls = spec.system.classification;
        cost = (cls === "signature-ability") ? 30 : 10;
      }
      addLogEntry(`Spezialisierungsbaum erworben: ${spec.name} (-${cost} XP)`, cost);
    }

    // 4. Talent net upgrades logging
    for (const item of this.items) {
      if (item.type === "talent") {
        const specName = item.system?.specialization?.toLowerCase() || "";
        const parentSpec = this.items.find(s => s.type === "specialization" && s.name.toLowerCase() === specName);
        const isSignatureAbility = parentSpec?.system?.classification === "signature-ability";
        const row = item.system?.row;
        let cost = 0;
        if (row !== undefined && row !== null) {
          cost = isSignatureAbility ? ((row <= 1) ? 10 : 15) : ((row + 1) * 5);
        } else {
          cost = (item.system?.tier || 1) * 5;
        }
        addLogEntry(`Talent erworben: ${item.name} (-${cost} XP)`, cost);
      }
    }

    if (logEntries.length === 0) {
      logEntries.push({
        timestamp,
        user: userName,
        change: "0",
        positive: false,
        description: "Charaktererstellung abgeschlossen (Bogen gesperrt)",
        prevAvailable: currentLogAvailable,
        prevTotal: totalXp,
        available: currentLogAvailable,
        total: totalXp
      });
    }

    const finalLog = Array.from(this.system.xp?.log || []);
    finalLog.push(...logEntries);
    if (finalLog.length > 50) {
      finalLog.splice(0, finalLog.length - 50);
    }

    // Commit the derived freeRanks and value to the DB items permanently
    const skillUpdates = [];
    for (const item of this.items) {
      if (item.type === "skill") {
        const derived = this.derivedSkills?.[item.name.toLowerCase()];
        if (derived) {
          skillUpdates.push({
            _id: item.id,
            "system.freeRanks": derived.freeRanks,
            "system.value": derived.value,
            "system.career": derived.career
          });
        }
      }
    }
    if (skillUpdates.length > 0) {
      await this.updateEmbeddedDocuments("Item", skillUpdates);
    }

    // Prepare character base characteristics update
    const finalCharacteristics = {
      "system.characteristics.brawn.value": derivedBrawn,
      "system.characteristics.agility.value": derivedAgility,
      "system.characteristics.intellect.value": derivedIntellect,
      "system.characteristics.cunning.value": derivedCunning,
      "system.characteristics.willpower.value": derivedWillpower,
      "system.characteristics.presence.value": derivedPresence
    };

    // Commit the actor updates: lock creation mode, set characteristics, clean snapshots/ledger, and write final log
    await this.update({
      ...finalCharacteristics,
      "system.stats.wounds.base": this.system.stats.wounds.base,
      "system.stats.strain.base": this.system.stats.strain.base,
      "system.stats.wounds.max": this.system.stats.wounds.max,
      "system.stats.strain.max": this.system.stats.strain.max,
      "system.creation.isCreationMode": false,
      "system.creation.sandboxMode": false,
      "system.xp.available": this.system.xp.available,
      "system.xp.total": this.system.xp.total,
      "system.xp.log": finalLog,
      
      // Clean up snapshots and ledger fields from the database
      "system.creation.speciesSnapshot": null,
      "system.creation.careerSnapshot": null,
      "system.creation.specializationSnapshot": null,
      "system.creation.ledger": {
        speciesSkillChoice: "",
        freeCareerSkills: [],
        freeSpecializationSkills: [],
        upgrades: {
          characteristics: { brawn: 0, agility: 0, intellect: 0, cunning: 0, willpower: 0, presence: 0 },
          skills: {},
          talents: [],
          specializations: []
        }
      }
    });

    ui.notifications?.info("Charaktererstellung abgeschlossen. Bogen gesperrt.");
  }

  /** @override */
  prepareDerivedData() {
    const actorData = this;
    const system = actorData.system;

    if (this.type !== "character") {
      super.prepareDerivedData();
      return;
    }

    const isCreationMode = system.creation?.isCreationMode === true;
    const isSandbox = system.creation?.sandboxMode === true;

    const parseSkillsList = (input) => {
      if (!input) return [];
      if (Array.isArray(input)) return input.map(s => s.trim().toLowerCase()).filter(s => s);
      if (typeof input === "string") return input.split(",").map(s => s.trim().toLowerCase()).filter(s => s);
      return [];
    };

    // 1. Initialize Baseline
    let brawn = 2;
    let agility = 2;
    let intellect = 2;
    let cunning = 2;
    let willpower = 2;
    let presence = 2;

    let baseWounds = 10;
    let baseStrain = 10;

    let startingXp = 0;

    const derivedSkills = {};
    for (const skill of DEFAULT_SKILLS) {
      derivedSkills[skill.name.toLowerCase()] = {
        name: skill.name,
        value: 0,
        career: false,
        freeRanks: 0,
        characteristic: skill.characteristic,
        category: skill.category
      };
    }

    if (!isCreationMode) {
      // Read final committed characteristics from DB
      brawn = system.characteristics?.brawn?.value ?? 2;
      agility = system.characteristics?.agility?.value ?? 2;
      intellect = system.characteristics?.intellect?.value ?? 2;
      cunning = system.characteristics?.cunning?.value ?? 2;
      willpower = system.characteristics?.willpower?.value ?? 2;
      presence = system.characteristics?.presence?.value ?? 2;

      baseWounds = system.stats?.wounds?.base ?? 10;
      baseStrain = system.stats?.strain?.base ?? 10;

      startingXp = system.creation?.startingXp ?? 0;

      // Read final committed skills from DB items
      for (const item of this.items) {
        if (item.type === "skill") {
          const nameKey = item.name.toLowerCase();
          if (derivedSkills[nameKey]) {
            derivedSkills[nameKey].value = item._source?.system?.value ?? item.system?.value ?? 0;
            derivedSkills[nameKey].freeRanks = item._source?.system?.freeRanks ?? item.system?.freeRanks ?? 0;
            derivedSkills[nameKey].career = item._source?.system?.career ?? item.system?.career ?? false;
          } else {
            derivedSkills[nameKey] = {
              name: item.name,
              value: item._source?.system?.value ?? item.system?.value ?? 0,
              freeRanks: item._source?.system?.freeRanks ?? item.system?.freeRanks ?? 0,
              career: item._source?.system?.career ?? item.system?.career ?? false,
              characteristic: item.system?.characteristic || "intellect",
              category: item.system?.category || "General"
            };
          }
        }
      }
    } else {
      // creationMode === true
      // 2. Apply Species Snapshot
      const species = system.creation?.speciesSnapshot;
      if (species) {
        brawn = species.characteristics?.brawn?.value ?? species.characteristics?.brawn ?? 2;
        agility = species.characteristics?.agility?.value ?? species.characteristics?.agility ?? 2;
        intellect = species.characteristics?.intellect?.value ?? species.characteristics?.intellect ?? 2;
        cunning = species.characteristics?.cunning?.value ?? species.characteristics?.cunning ?? 2;
        willpower = species.characteristics?.willpower?.value ?? species.characteristics?.willpower ?? 2;
        presence = species.characteristics?.presence?.value ?? species.characteristics?.presence ?? 2;

        baseWounds = species.wounds?.base ?? species.wounds ?? 10;
        baseStrain = species.strain?.base ?? species.strain ?? 10;

        startingXp = species.xp ?? 0;

        // Apply species starting skills (e.g. Charm:1)
        const speciesSkillsStr = species.modifiers?.skills || species.skills || "";
        if (speciesSkillsStr) {
          const skillsParts = speciesSkillsStr.split(",");
          for (const part of skillsParts) {
            const trimmed = part.trim();
            if (!trimmed) continue;
            const [sName, sValStr] = trimmed.split(":");
            const sNameLower = sName.trim().toLowerCase();
            const sVal = sValStr ? parseInt(sValStr.trim()) : 1;
            if (derivedSkills[sNameLower]) {
              derivedSkills[sNameLower].freeRanks += sVal;
            }
          }
        }

        // Choice-based species starting skill selection
        const choice = system.creation?.ledger?.speciesSkillChoice || system.creation?.speciesSkillChoice;
        if (choice) {
          const choiceLower = choice.trim().toLowerCase();
          if (derivedSkills[choiceLower]) {
            derivedSkills[choiceLower].freeRanks += 1;
          }
        }
      }

      // 3. Apply Career Snapshot
      const career = system.creation?.careerSnapshot;
      if (career) {
        const careerSkillsList = parseSkillsList(career.careerSkills || career.system?.careerSkills);
        for (const sName of careerSkillsList) {
          if (derivedSkills[sName]) {
            derivedSkills[sName].career = true;
          }
        }

        const freeCareerSkills = system.creation?.ledger?.freeCareerSkills || system.creation?.freeCareerSkills || [];
        for (const sName of freeCareerSkills) {
          const sNameLower = sName.toLowerCase();
          if (derivedSkills[sNameLower]) {
            derivedSkills[sNameLower].freeRanks += 1;
          }
        }
      }

      // 4. Apply Specialization Snapshot
      const spec = system.creation?.specializationSnapshot;
      if (spec) {
        const specSkillsList = parseSkillsList(spec.careerSkills || spec.system?.careerSkills);
        for (const sName of specSkillsList) {
          if (derivedSkills[sName]) {
            derivedSkills[sName].career = true;
          }
        }

        const freeSpecSkills = system.creation?.ledger?.freeSpecializationSkills || system.creation?.freeSpecializationSkills || [];
        for (const sName of freeSpecSkills) {
          const sNameLower = sName.toLowerCase();
          if (derivedSkills[sNameLower]) {
            derivedSkills[sNameLower].freeRanks += 1;
          }
        }
      }

      // Mark career skills from any specialization items currently on the actor
      for (const item of this.items) {
        if (item.type === "specialization") {
          const specSkillsList = parseSkillsList(item.system?.careerSkills);
          for (const sName of specSkillsList) {
            if (derivedSkills[sName]) {
              derivedSkills[sName].career = true;
            }
          }
        }
      }
    }

    // 5. Clamping Rule
    for (const sNameLower in derivedSkills) {
      derivedSkills[sNameLower].freeRanks = Math.min(2, derivedSkills[sNameLower].freeRanks);
      if (isCreationMode) {
        derivedSkills[sNameLower].value = derivedSkills[sNameLower].freeRanks;
      }
    }

    // 6. Apply XP Purchases (Ledger Upgrades)
    let spentAttributeXp = 0;
    const charNames = ["brawn", "agility", "intellect", "cunning", "willpower", "presence"];

    if (isCreationMode) {
      const baseChars = { brawn, agility, intellect, cunning, willpower, presence };
      const upgrades = system.creation?.ledger?.upgrades?.characteristics || {};
      for (const charName of charNames) {
        const baseVal = baseChars[charName];
        const upgradeVal = upgrades[charName] || 0;
        const finalVal = baseVal + upgradeVal;
        
        if (upgradeVal > 0) {
          for (let v = baseVal + 1; v <= finalVal; v++) {
            spentAttributeXp += v * 10;
          }
        }
        
        if (charName === "brawn") brawn = finalVal;
        else if (charName === "agility") agility = finalVal;
        else if (charName === "intellect") intellect = finalVal;
        else if (charName === "cunning") cunning = finalVal;
        else if (charName === "willpower") willpower = finalVal;
        else if (charName === "presence") presence = finalVal;
      }
    } else {
      // In-game attribute XP calculation
      const baseChars = system.creation?.baseCharacteristics || {};
      for (const charName of charNames) {
        const baseVal = baseChars[charName] !== undefined ? baseChars[charName] : 2;
        const finalVal = system.characteristics?.[charName]?.value ?? baseVal;
        if (finalVal > baseVal) {
          for (let v = baseVal + 1; v <= finalVal; v++) {
            spentAttributeXp += v * 10;
          }
        }
      }
    }

    // Now calculate spent skill XP
    let spentSkillXp = 0;
    if (isCreationMode) {
      const skillUpgrades = system.creation?.ledger?.upgrades?.skills || {};
      for (const [sNameLower, upgradeVal] of Object.entries(skillUpgrades)) {
        if (upgradeVal > 0 && derivedSkills[sNameLower]) {
          const freeRanks = derivedSkills[sNameLower].freeRanks;
          const isCareer = derivedSkills[sNameLower].career;
          const finalRank = freeRanks + upgradeVal;
          
          for (let r = freeRanks + 1; r <= finalRank; r++) {
            spentSkillXp += isCareer ? (r * 5) : ((r * 5) + 5);
          }
          derivedSkills[sNameLower].value = finalRank;
        }
      }
    } else {
      for (const key in derivedSkills) {
        const skill = derivedSkills[key];
        const freeRanks = skill.freeRanks;
        const finalRank = skill.value;
        const isCareer = skill.career;
        if (finalRank > freeRanks) {
          for (let r = freeRanks + 1; r <= finalRank; r++) {
            spentSkillXp += isCareer ? (r * 5) : ((r * 5) + 5);
          }
        }
      }
    }

    const spentTalentXp = this.calculateSpentTalentXp();
    const spentSpecializationXp = this.calculateSpentSpecializationXp();

    const totalSpentXp = spentAttributeXp + spentSkillXp + spentTalentXp + spentSpecializationXp;
    const totalXp = startingXp + this.dutyXp + (system.xp?.earned || 0);
    const availableXp = totalXp - totalSpentXp;

    // Set derived attributes
    system.characteristics.brawn.value = brawn;
    system.characteristics.agility.value = agility;
    system.characteristics.intellect.value = intellect;
    system.characteristics.cunning.value = cunning;
    system.characteristics.willpower.value = willpower;
    system.characteristics.presence.value = presence;

    system.xp.available = availableXp;
    system.xp.total = totalXp;

    // Expose derivedSkills on actor
    this.derivedSkills = derivedSkills;

    // Expose validation flags on actor system
    const freeCareerSkills = system.creation?.ledger?.freeCareerSkills || system.creation?.freeCareerSkills || [];
    const freeSpecSkills = system.creation?.ledger?.freeSpecializationSkills || system.creation?.freeSpecializationSkills || [];
    const hasSpecies = !!system.biography?.species;
    const hasCareer = !!system.biography?.career;
    const hasSpec = this.items.some(i => i.type === "specialization");
    const xpValid = availableXp >= 0;
    const skillsValid = freeCareerSkills.length === 4 && freeSpecSkills.length === 2;
    const attributesValid = spentAttributeXp <= (this.maxAttributeXpAllowed || 0);
    const lockAllowed = hasSpecies && hasCareer && hasSpec && skillsValid && xpValid && attributesValid;

    system.creation.validation = {
      xpValid,
      skillsValid,
      attributesValid,
      lockAllowed,
      missing: {
        species: !hasSpecies,
        career: !hasCareer,
        specialization: !hasSpec,
        freeCareerCount: freeCareerSkills.length,
        freeSpecCount: freeSpecSkills.length
      }
    };

    // Passive talents & item modifiers processing
    let gritRanks = 0;
    let toughenedRanks = 0;
    let enduringRanks = 0;
    let forceRatingTalents = 0;

    for (const item of this.items) {
      if (item.type === "talent") {
        const key = item.system?.key?.toLowerCase() || item.name.toLowerCase();
        if (key === "grit") {
          gritRanks += 1;
        } else if (key === "toughened") {
          toughenedRanks += 1;
        } else if (key === "enduring") {
          enduringRanks += 1;
        } else if (key === "force rating" || key === "forcerating") {
          forceRatingTalents += 1;
        }
      }
    }

    let baseForceRating = 0;
    for (const item of this.items) {
      if (item.type === "specialization") {
        if (item.system.classification === "force-power" || item.system.classification === "force-user") {
          baseForceRating = Math.max(baseForceRating, 1);
        }
        if (item.system.careerSkills?.toLowerCase().includes("force") || item.name.toLowerCase().includes("force")) {
          baseForceRating = Math.max(baseForceRating, 1);
        }
      }
    }

    const totalForceRating = baseForceRating + forceRatingTalents;
    if (system.stats.force) {
      system.stats.force.max = totalForceRating;
      if (system.stats.force.value === undefined || system.stats.force.value === null) {
        system.stats.force.value = totalForceRating;
      }
    }

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
      if (item.system?.equipped) {
        if (item.system.modifiers) {
          inventoryWoundsMod += item.system.modifiers.wounds || 0;
          inventoryStrainMod += item.system.modifiers.strain || 0;
          inventorySoakMod += item.system.modifiers.soak || 0;
          maxEncumbranceBonus += item.system.modifiers.encumbrance || 0;

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

        if (item.system.attachments && Array.isArray(item.system.attachments)) {
          for (const att of item.system.attachments) {
            const attSystem = att.system || {};
            if (attSystem.baseModifiers) {
              inventoryWoundsMod += attSystem.baseModifiers.wounds || 0;
              inventoryStrainMod += attSystem.baseModifiers.strain || 0;
              inventorySoakMod += attSystem.baseModifiers.soak || 0;
              maxEncumbranceBonus += attSystem.baseModifiers.encumbrance || 0;

              const charModStr = attSystem.baseModifiers.characteristics || "";
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

            const activeMods = (attSystem.mods || []).filter(m => m.active);
            for (const mod of activeMods) {
              if (mod.type === "stat") {
                if (mod.target === "wounds") inventoryWoundsMod += mod.value || 0;
                else if (mod.target === "strain") inventoryStrainMod += mod.value || 0;
                else if (mod.target === "soak") inventorySoakMod += mod.value || 0;
                else if (mod.target === "encumbrance") maxEncumbranceBonus += mod.value || 0;
              } else if (mod.type === "characteristic" && mod.target) {
                const charName = mod.target.trim().toLowerCase();
                if (characteristicMods[charName] !== undefined) {
                  characteristicMods[charName] += mod.value || 0;
                }
              }
            }
          }
        }
      }
    }

    for (const [charName, modVal] of Object.entries(characteristicMods)) {
      if (modVal !== 0 && system.characteristics[charName]) {
        const baseVal = system.characteristics[charName].value || 1;
        system.characteristics[charName].value = Math.max(1, Math.min(6, baseVal + modVal));
      }
    }

    let armorSoak = 0;
    let armorMeleeDefence = 0;
    let armorRangedDefence = 0;

    for (const item of this.items) {
      if (item.type === "armor" && item.system.equipped) {
        armorSoak += (item.derived?.soak ?? item.system.soak) || 0;
        armorMeleeDefence = Math.max(armorMeleeDefence, (item.derived?.defence ?? item.system.defence) || 0);
        armorRangedDefence = Math.max(armorRangedDefence, (item.derived?.defence ?? item.system.defence) || 0);
      }
    }

    // Set base wounds/strain
    if (!system.stats.wounds.base || isCreationMode) system.stats.wounds.base = baseWounds;
    if (!system.stats.strain.base || isCreationMode) system.stats.strain.base = baseStrain;

    system.stats.wounds.max = baseWounds + (toughenedRanks * 2) + inventoryWoundsMod;
    system.stats.strain.max = baseStrain + gritRanks + inventoryStrainMod;
    system.stats.soak.value = (system.characteristics.brawn.value || 0) + armorSoak + enduringRanks + inventorySoakMod;

    system.stats.defence.melee = armorMeleeDefence;
    system.stats.defence.ranged = armorRangedDefence;

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

    // Update in-memory skill items on the actor
    for (const item of this.items) {
      if (item.type === "skill") {
        const nameLower = item.name.toLowerCase();
        const derived = derivedSkills[nameLower];
        if (derived) {
          item.system.freeRanks = derived.freeRanks;
          item.system.value = derived.value;
          item.system.career = derived.career;
        }
      }
    }
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

    if (this.type !== "character") return;

    let changedXpAvailable = undefined;
    let changedXpTotal = undefined;

    if (changed.system?.xp?.available !== undefined) {
      changedXpAvailable = changed.system.xp.available;
    } else if (changed["system.xp.available"] !== undefined) {
      changedXpAvailable = changed["system.xp.available"];
    }

    if (changed.system?.xp?.total !== undefined) {
      changedXpTotal = changed.system.xp.total;
    } else if (changed["system.xp.total"] !== undefined) {
      changedXpTotal = changed["system.xp.total"];
    }

    if (changedXpAvailable !== undefined || changedXpTotal !== undefined) {
      const currentAvailable = this._source.system.xp?.available ?? 0;
      const currentTotal = this._source.system.xp?.total ?? 0;
      
      const newAvailable = changedXpAvailable !== undefined ? Number(changedXpAvailable) : currentAvailable;
      const newTotal = changedXpTotal !== undefined ? Number(changedXpTotal) : currentTotal;
      
      const diffAvailable = newAvailable - currentAvailable;
      const diffTotal = newTotal - currentTotal;
      
      if (diffAvailable !== 0 || diffTotal !== 0) {
        const isCreation = this.system.creation?.isCreationMode === true;
        const isLocking = (changed.system?.creation?.isCreationMode === false) || (changed["system.creation.isCreationMode"] === false);
        if (!isCreation || isLocking) {
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
          
          if (changed["system.xp.available"] !== undefined || changed["system.xp.total"] !== undefined) {
            changed["system.xp.log"] = currentLog;
          } else {
            if (!changed.system) changed.system = {};
            if (!changed.system.xp) changed.system.xp = {};
            changed.system.xp.log = currentLog;
          }
        }
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

    // 2. Add career skills from base career (using cache if available)
    const cachedCareerSkills = this.system.creation?.careerSkills || [];
    if (cachedCareerSkills.length > 0) {
      for (const s of cachedCareerSkills) {
        if (s) activeCareerSkills.add(s.toLowerCase());
      }
    } else if (careerName) {
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
      const wasCareer = skill.system.career;
      let newValue = skill.system.value;

      if (wasCareer && !isStillCareer) {
        newValue = this.getSkillFreeRanks(skill);
      }

      if (skill.system.career !== isStillCareer || skill.system.value !== newValue) {
        updates.push({
          _id: skill.id,
          "system.career": isStillCareer,
          "system.value": newValue
        });
      }
    }

    const prevAvailable = this._source.system.xp?.available || 0;

    if (updates.length > 0) {
      await this.updateEmbeddedDocuments("Item", updates);
    }

    const newAvailable = this.totalAvailableXp;
    if (newAvailable !== prevAvailable) {
      const diff = newAvailable - prevAvailable;
      let desc = diff > 0 ? `XP erstattet: +${diff} XP` : `XP ausgegeben: ${diff} XP`;
      if (updates.length > 0) {
        desc = diff > 0 
          ? `XP erstattet durch Zurücksetzen von Fertigkeitsrängen: +${diff} XP`
          : `XP angepasst durch Fertigkeits-Karrierestatus-Änderung: ${diff} XP`;
      }
      await this.update({
        "system.xp.available": newAvailable
      }, {
        xpLogDescription: desc
      });
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
    const careerChanged = (changed.system?.biography?.career !== undefined) || (changed["system.biography.career"] !== undefined);
    if (userId === game.user.id && careerChanged) {
      this.recalculateCareerSkills();
    }
  }
}
