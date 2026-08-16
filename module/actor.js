import { rollFFGPool, sendRollToChat } from "./dice.js";
import { DEFAULT_SKILLS, CHOICE_SPECIES, normalizeSpeciesName } from "./actor-sheet.js";
import { TalentTreeUtils } from "./utils/talent-tree.js";

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
    const isCreationMode = this.system.creation?.isCreationMode === true;
    
    if (isCreationMode) {
      let totalCost = 0;
      const characteristics = ["brawn", "agility", "intellect", "cunning", "willpower", "presence"];
      const species = this.system.creation?.speciesSnapshot;
      const baseChars = this.system.creation?.baseCharacteristics || {};
      const upgrades = this.system.creation?.ledger?.upgrades?.characteristics || {};
      
      for (const charName of characteristics) {
        const speciesBaseVal = species ? (species.characteristics?.[charName]?.value ?? species.characteristics?.[charName] ?? 2) : (baseChars[charName] ?? 2);
        const upgradeVal = upgrades[charName] || 0;
        const finalVal = speciesBaseVal + upgradeVal;
        
        if (upgradeVal > 0) {
          for (let v = speciesBaseVal + 1; v <= finalVal; v++) {
            totalCost += v * 10;
          }
        }
      }
      return totalCost;
    } else {
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
      for (const [key, upgradeVal] of Object.entries(upgrades)) {
        const sNameLower = key.toLowerCase();
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
    if (this.system.creation?.isCreationMode === true) {
      const total = (this.system.creation?.startingXp || 0) + this.dutyXp;
      return total - this.currentAttributeXpSpent - this.calculateSpentTalentXp() - this.calculateSpentSpecializationXp() - this.calculateSpentSkillXp();
    }
    return this._source.system?.xp?.available ?? this.system.xp?.available ?? 0;
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
          return { success: false, message: "Attribute können nach der Charaktererstellung nicht mehr mit XP gesteigert werden!" };
        }
      }
      if (this.totalAvailableXp < cost) {
        return { success: false, message: `Nicht genug XP vorhanden! (Kosten: ${cost} XP, Verfügbar: ${this.totalAvailableXp} XP)` };
      }
      if (this.currentAttributeXpSpent + cost > this.maxAttributeXpAllowed) {
        return { success: false, message: `Das Spezies-Limit für Attribute (${this.maxAttributeXpAllowed} XP) wurde erreicht!` };
      }
      if (isCreationMode && currentRawValue >= 5) {
        return { success: false, message: `Während der Charaktererstellung dürfen Attribute nicht über Wert 5 gesteigert werden!` };
      }
    }

    if (isCreationMode) {
      // Creation Mode: Update ledger upgrades. Suppress log.
      await this.update({
        [`system.creation.ledger.upgrades.characteristics.${attributeName}`]: currentUpgrades + 1
      });
      return { success: true, message: `${attributeName.toUpperCase()} auf ${currentRawValue + 1} gesteigert.` };
    } else {
      // In-game/GM override: Update standard attribute field in database. Perform log.
      const newAvailable = Math.max(0, currentAvailable - cost);
      await this.update({
        [`system.characteristics.${attributeName}.value`]: currentRawValue + 1,
        "system.xp.available": newAvailable
      }, {
        xpLogDescription: `Attribut gesteigert: ${attributeName.toUpperCase()} von ${currentRawValue} auf ${currentRawValue + 1} (-${cost} XP)`
      });
      return { success: true, message: `${attributeName.toUpperCase()} auf ${currentRawValue + 1} gesteigert für ${cost} XP.` };
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
        return { success: false, message: `Kann ${attributeName.toUpperCase()} nicht unter den Basiswert von ${speciesBaseVal} senken!` };
      }
      await this.update({
        [`system.creation.ledger.upgrades.characteristics.${attributeName}`]: currentUpgrades - 1
      });
      return { success: true, message: `${attributeName.toUpperCase()} auf ${currentRawValue - 1} gesenkt.` };
    } else {
      if (currentRawValue <= baseVal) {
        return { success: false, message: `Kann ${attributeName.toUpperCase()} nicht unter den Basiswert von ${baseVal} senken!` };
      }
      if (!isGM) {
        return { success: false, message: "Attribute können nach der Charaktererstellung nicht mehr verändert werden!" };
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
      return { success: true, message: `${attributeName.toUpperCase()} auf ${currentRawValue - 1} gesenkt. ${refund} XP erstattet.` };
    }
  }

  /**
   * Returns the maximum allowed skill rank based on creation mode vs. play mode.
   * @returns {number} 2 during creation mode, 5 during regular play mode.
   */
  getMaxSkillRank() {
    if (this.system.creation?.sandboxMode === true) return 5;
    return this.system.creation?.isCreationMode === true ? 2 : 5;
  }

  async buySkillRank(skillName, skillChar, skillCat) {
    if (this.type !== "character") return { success: false, message: "Nur für Charaktere verfügbar." };
    const isCreationMode = this.system.creation?.isCreationMode === true;

    // Make sure skill item exists
    const skillItem = this.items.find(i => i.type === "skill" && i.name.toLowerCase() === skillName.toLowerCase());
    
    // In creation mode, the base rank is the free starting ranks, upgraded ranks are in the ledger
    const freeRanks = this.derivedSkills?.[skillName.toLowerCase()]?.freeRanks || 0;
    const ledgerKey = skillName.toLowerCase();
    const currentUpgrades = this.system.creation?.ledger?.upgrades?.skills?.[ledgerKey] || 0;
    const currentRank = isCreationMode ? (freeRanks + currentUpgrades) : (skillItem?.system?.value || 0);
    const isCareer = isCreationMode ? (this.derivedSkills?.[skillName.toLowerCase()]?.career || false) : (skillItem?.system?.career || false);

    const maxRank = this.getMaxSkillRank();
    const nextRank = currentRank + 1;
    const cost = isCareer ? (nextRank * 5) : ((nextRank * 5) + 5);
    const currentAvailable = this.system.xp?.available || 0;

    const isSandbox = this.system.creation?.sandboxMode || false;

    if (!isSandbox) {
      if (currentRank >= maxRank) {
        return { success: false, message: `Maximaler Rang (${maxRank}) bereits erreicht.` };
      }
      if (this.totalAvailableXp < cost) {
        return { success: false, message: `Nicht genug XP vorhanden! (Kosten: ${cost} XP, Verfügbar: ${this.totalAvailableXp} XP)` };
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
      return { success: true, message: `Rang ${nextRank} in ${skillName} erworben.`, data: { nextRank } };
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
      return { success: true, message: `Rang ${nextRank} in ${skillName} gekauft für ${cost} XP.`, data: { nextRank, cost } };
    }
  }

  async decreaseSkillRank(skillName) {
    if (this.type !== "character") return;
    const isGM = game.user?.isGM || false;
    const isCreationMode = this.system.creation?.isCreationMode === true;

    const skillItem = this.items.find(i => i.type === "skill" && i.name.toLowerCase() === skillName.toLowerCase());
    
    const freeRanks = this.derivedSkills?.[skillName.toLowerCase()]?.freeRanks || 0;
    const ledgerKey = skillName.toLowerCase();
    const currentUpgrades = this.system.creation?.ledger?.upgrades?.skills?.[ledgerKey] || 0;
    const currentRank = isCreationMode ? (freeRanks + currentUpgrades) : (skillItem?.system?.value || 0);

    if (isCreationMode) {
      if (currentUpgrades <= 0) {
        return { success: false, message: `Kann ${skillName} nicht unter den Startwert von ${freeRanks} senken!` };
      }
      const newUpgrades = foundry.utils.deepClone(this.system.creation?.ledger?.upgrades?.skills || {});
      if (currentUpgrades - 1 <= 0) {
        delete newUpgrades[ledgerKey];
      } else {
        newUpgrades[ledgerKey] = currentUpgrades - 1;
      }
      await this.update({
        [`system.creation.ledger.upgrades.skills`]: newUpgrades
      });
      return { success: true, message: `Rang ${currentRank - 1} in ${skillName} verringert.` };
    } else {
      if (currentRank <= freeRanks) {
        return { success: false, message: `Kann ${skillName} nicht unter den Startwert von ${freeRanks} senken!` };
      }
      if (!isGM) {
        return { success: false, message: "Nur der GM kann bereits bestätigte Käufe zurücknehmen." };
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
      return { success: true, message: `Rang ${currentRank} in ${skillName} zurückgesetzt. ${refund} XP erstattet.` };
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
    return { success: true, message: `GM Sandbox-Modus ${newSandbox ? "aktiviert" : "deaktiviert"}.`, data: { sandboxMode: newSandbox } };
  }

  /**
   * Vergibt XP an den Charakter (z. B. Session-XP). Nur für GMs außerhalb der Charaktererstellung.
   *
   * @param {number} amount - Positive Ganzzahl. Wird sowohl zu xp.available als auch xp.total addiert.
   * @returns {{ success: boolean, message: string, data?: { granted: number, newAvailable: number } }}
   *
   * @example
   * // Konsolentest (als GM, außerhalb Erstellung):
   * const result = await actor.grantXp(15);
   * console.log(result); // { success: true, message: "...", data: { granted: 15, newAvailable: 115 } }
   */
  async grantXp(amount) {
    if (this.type !== "character") {
      return { success: false, message: "grantXp ist nur für Charaktere verfügbar." };
    }

    if (!game.user?.isGM) {
      return { success: false, message: "grantXp darf nur vom GM aufgerufen werden." };
    }

    if (this.system.creation?.isCreationMode === true) {
      return { success: false, message: "grantXp ist nur außerhalb der Charaktererstellung verfügbar. Bitte zuerst den Wizard abschließen." };
    }

    // Validierung: amount muss eine positive Ganzzahl sein
    if (!Number.isInteger(amount) || amount <= 0) {
      return { success: false, message: `Ungültiger XP-Betrag: "${amount}". Bitte eine positive ganze Zahl angeben.` };
    }

    const currentAvailable = this.system.xp?.available ?? 0;
    const currentTotal = this.system.xp?.total ?? 0;
    const newAvailable = currentAvailable + amount;
    const newTotal = currentTotal + amount;

    await this.update({
      "system.xp.available": newAvailable,
      "system.xp.total": newTotal
    }, {
      xpLogDescription: `Session-XP erhalten: +${amount} XP (vergeben von ${game.user.name})`
    });

    console.info(`SWFFG | [grantXp] ${this.name}: +${amount} XP → verfügbar: ${newAvailable}, gesamt: ${newTotal}`);
    return {
      success: true,
      message: `${amount} XP an ${this.name} vergeben. Verfügbar: ${newAvailable} XP.`,
      data: { granted: amount, newAvailable, newTotal }
    };
  }

  /**
   * Setzt xp.available direkt auf einen neuen Wert (GM-Korrektur). Nur für GMs außerhalb der Charaktererstellung.
   * Ändert xp.total NICHT — das ist eine reine Verfügbarkeits-Korrektur, z. B. bei Datenfehler oder Regeländerung.
   *
   * @param {number} newValue  - Nicht-negative Ganzzahl.
   * @param {string} reason    - Pflichtfeld: Begründung für den XP-Log-Eintrag.
   * @returns {{ success: boolean, message: string, data?: { oldValue: number, newValue: number, reason: string } }}
   *
   * @example
   * // Konsolentest (als GM, außerhalb Erstellung):
   * const result = await actor.setXp(50, "Retroaktive Korrektur nach Regeländerung");
   * console.log(result); // { success: true, message: "...", data: { oldValue: 30, newValue: 50, reason: "..." } }
   */
  async setXp(newValue, reason) {
    if (this.type !== "character") {
      return { success: false, message: "setXp ist nur für Charaktere verfügbar." };
    }

    if (!game.user?.isGM) {
      return { success: false, message: "setXp darf nur vom GM aufgerufen werden." };
    }

    if (this.system.creation?.isCreationMode === true) {
      return { success: false, message: "setXp ist nur außerhalb der Charaktererstellung verfügbar. Bitte zuerst den Wizard abschließen." };
    }

    // Validierung: reason ist Pflichtfeld
    if (!reason || typeof reason !== "string" || reason.trim() === "") {
      return { success: false, message: "Bitte einen Grund für die Korrektur angeben." };
    }

    // Validierung: newValue muss eine nicht-negative Ganzzahl sein
    if (!Number.isInteger(newValue) || newValue < 0) {
      return { success: false, message: `Ungültiger XP-Wert: "${newValue}". Bitte eine nicht-negative ganze Zahl angeben.` };
    }

    // oldValue frisch aus der Collection lesen, nicht aus dem lokalen Snapshot.
    // Hintergrund: Foundry aktualisiert this.system erst nach dem Server-Socket-
    // Round-Trip. Wurde kurz zuvor z. B. grantXp() aufgerufen, liest this.system
    // noch den alten Stand — der Log-Eintrag wäre dann inhaltlich falsch.
    // game.actors.get(this.id) liefert die selbe Referenz, daher: _source lesen.
    // _source wird von Foundry synchron beim Update-Response befüllt, während
    // system ein berechnetes Getter-Proxy ist, das ggf. auf veraltete preparedData
    // zurückgreift.
    const liveActor = game.actors.get(this.id) ?? this;
    const oldValue = liveActor._source?.system?.xp?.available ?? liveActor.system.xp?.available ?? 0;
    const trimmedReason = reason.trim();

    await this.update({
      "system.xp.available": newValue
    }, {
      xpLogDescription: `GM-Korrektur: ${trimmedReason} (${oldValue} → ${newValue} XP)`
    });

    console.info(`SWFFG | [setXp] ${this.name}: ${oldValue} → ${newValue} XP | Grund: "${trimmedReason}"`);
    return {
      success: true,
      message: `XP von ${this.name} von ${oldValue} auf ${newValue} korrigiert.`,
      data: { oldValue, newValue, reason: trimmedReason }
    };
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
    
    return { success: true, message: "Charakter erfolgreich auf Standardwerte zurückgesetzt." };
  }

  async lockCreation() {
    if (this.type !== "character") return;
    
    // 1. Verify validations
    const validation = this.system.creation?.validation;
    const isGM = game.user?.isGM || false;
    if (!validation?.lockAllowed && !isGM) {
      return { success: false, message: "Charaktererstellung kann nicht gesperrt werden. Nicht alle Bedingungen sind erfüllt." };
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

    const species = this.system.creation?.speciesSnapshot;
    const ledgerUpgrades = this.system.creation?.ledger?.upgrades?.characteristics || {};
    const baseChars = this.system.creation?.baseCharacteristics || { brawn: 2, agility: 2, intellect: 2, cunning: 2, willpower: 2, presence: 2 };

    const getFinalChar = (char) => {
      const speciesBaseVal = species ? (species.characteristics?.[char]?.value ?? species.characteristics?.[char] ?? 2) : (baseChars[char] ?? 2);
      const upgradeVal = ledgerUpgrades[char] || 0;
      return Math.max(speciesBaseVal + upgradeVal, this.system.characteristics?.[char]?.value ?? 2);
    };

    // Gather derived values before we clear ledger
    const derivedBrawn = getFinalChar("brawn");
    const derivedAgility = getFinalChar("agility");
    const derivedIntellect = getFinalChar("intellect");
    const derivedCunning = getFinalChar("cunning");
    const derivedWillpower = getFinalChar("willpower");
    const derivedPresence = getFinalChar("presence");

    // 1. Attribute net upgrades logging
    for (const char of ["brawn", "agility", "intellect", "cunning", "willpower", "presence"]) {
      const baseVal = species ? (species.characteristics?.[char]?.value ?? species.characteristics?.[char] ?? 2) : (baseChars[char] ?? 2);
      const currentVal = getFinalChar(char);
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
    return { success: true, message: "Charaktererstellung abgeschlossen. Bogen gesperrt." };
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

    let startingXp = system.creation?.startingXp ?? 0;

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

        startingXp = species.xp ?? (system.creation?.startingXp ?? 0);

        // Apply species starting skills (e.g. Charm:1)
        const speciesSkillsStr = species.modifiers?.skills || species.skills || "";
        const speciesNameNorm = normalizeSpeciesName(species.name);
        const choiceOptions = CHOICE_SPECIES[speciesNameNorm];
        const choiceOptionsLower = choiceOptions ? choiceOptions.map(o => o.toLowerCase()) : [];

        if (speciesSkillsStr) {
          const skillsParts = speciesSkillsStr.split(",");
          for (const part of skillsParts) {
            const trimmed = part.trim();
            if (!trimmed) continue;
            const [sName, sValStr] = trimmed.split(":");
            const sNameLower = sName.trim().toLowerCase();
            const sVal = sValStr ? parseInt(sValStr.trim()) : 1;

            // If this skill is one of the choice options, skip applying it from default skills
            if (choiceOptionsLower.includes(sNameLower)) {
              continue;
            }

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
      for (const [key, upgradeVal] of Object.entries(skillUpgrades)) {
        const sNameLower = key.toLowerCase();
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

    // Set derived attributes
    system.characteristics.brawn.value = brawn;
    system.characteristics.agility.value = agility;
    system.characteristics.intellect.value = intellect;
    system.characteristics.cunning.value = cunning;
    system.characteristics.willpower.value = willpower;
    system.characteristics.presence.value = presence;

    if (isCreationMode) {
      const totalSpentXp = spentAttributeXp + spentSkillXp + spentTalentXp + spentSpecializationXp;
      const totalXp = startingXp + this.dutyXp;
      const availableXp = totalXp - totalSpentXp;
      system.xp.available = availableXp;
      system.xp.total = totalXp;
    } else {
      // In play mode, xp.available and xp.total are stored directly in the database
      system.xp.available = this._source.system?.xp?.available ?? system.xp?.available ?? 0;
      system.xp.total = this._source.system?.xp?.total ?? system.xp?.total ?? 0;
    }

    // Expose derivedSkills on actor
    this.derivedSkills = derivedSkills;

    // Expose validation flags on actor system
    const freeCareerSkills = system.creation?.ledger?.freeCareerSkills || system.creation?.freeCareerSkills || [];
    const freeSpecSkills = system.creation?.ledger?.freeSpecializationSkills || system.creation?.freeSpecializationSkills || [];
    const hasSpecies = !!system.biography?.species;
    const hasCareer = !!system.biography?.career;
    const hasSpec = this.items.some(i => i.type === "specialization");
    const xpValid = (system.xp.available ?? 0) >= 0;
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
    if (system.stats?.force) {
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

    if (system.stats) {
      if (system.stats.force) {
        system.stats.force.max = totalForceRating;
        if (system.stats.force.value === undefined || system.stats.force.value === null) {
          system.stats.force.value = totalForceRating;
        }
      }

      // Set base wounds/strain
      if (system.stats.wounds) {
        if (!system.stats.wounds.base || isCreationMode) system.stats.wounds.base = baseWounds;
        system.stats.wounds.max = baseWounds + (toughenedRanks * 2) + inventoryWoundsMod;
      }
      if (system.stats.strain) {
        if (!system.stats.strain.base || isCreationMode) system.stats.strain.base = baseStrain;
        system.stats.strain.max = baseStrain + gritRanks + inventoryStrainMod;
      }
      if (system.stats.soak) {
        system.stats.soak.value = (system.characteristics.brawn.value || 0) + armorSoak + enduringRanks + inventorySoakMod;
      }
      if (system.stats.defence) {
        system.stats.defence.melee = armorMeleeDefence;
        system.stats.defence.ranged = armorRangedDefence;
      }

      system.stats.encumbrance = {
        value: carriedEncumbrance,
        max: 5 + (system.characteristics.brawn.value || 0) + maxEncumbranceBonus
      };
    }

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

  // --- MVC Logic Methods (Creation / Advancement) ---

  /**
   * Checks if the character has spent any XP during creation (attributes, skills, or talents).
   * @returns {boolean} True if XP has been spent.
   */

  /**
   * Global reset for character creation purchases (attributes, skills, talents).
   * Refereed as Option 1 UX failsafe.
   */
  async resetCreationPurchases() {
    if (this.type !== "character") return { success: false, message: "Nur für Charaktere verfügbar." };
    if (!this.hasCreationPurchases()) return { success: true, message: "Nichts zurückzusetzen." };
    
    let refundedTalents = 0;
    let refundedSkills = 0;
    let refundedAttrs = 0;
    
    // 1. Refund Talents using deterministic topological sort
    const specSnapshot = this.system.creation?.specializationSnapshot;
    if (specSnapshot) {
      const specName = specSnapshot.name;
      // We need the rows from the specialization item itself
      const specItem = this.items.find(i => i.type === "specialization" && i.name === specName);
      if (specItem) {
        let rows = specItem.system.talentRows;
        
        let attempts = 0;
        let MAX_ATTEMPTS = this.items.filter(i => i.type === "talent").length * 2;
        
        while(true) {
          const refundOrder = TalentTreeUtils.getRefundOrder(specName, rows, this);
          if (!refundOrder || refundOrder.length === 0) break; // done
          
          attempts++;
          if (attempts > MAX_ATTEMPTS) {
             return { success: false, message: `Konnte nicht alle Talente erstatten. ${refundedTalents} Talente, ${refundedSkills} Skills, ${refundedAttrs} Attribute erstattet.` };
          }
          
          // Refund the safest one (the first one in the list)
          const target = refundOrder[0];
          const result = await this.refundTalent(target.id, target.cost, target.name, { logDescription: `Global Reset: ${target.name}` });
          if (result && result.success) {
            refundedTalents++;
          } else {
             // Failsafe break if refund failed
             break;
          }
        }
      }
    }
    
    // Also blindly delete any leftover talents if topological sort missed some (e.g. from other specs not handled)
    const allTalents = this.items.filter(i => i.type === "talent");
    if (allTalents.length > 0) {
      for (const t of allTalents) {
        const cost = t.system?.cost || 0;
        await this.refundTalent(t.id, cost, t.name, { logDescription: `Global Reset Leftover: ${t.name}` });
        refundedTalents++;
      }
    }

    // 2. Refund Skills
    const skillUpgrades = this.system.creation?.ledger?.upgrades?.skills || {};
    for (const [skillName, upgrades] of Object.entries(skillUpgrades)) {
      if (upgrades > 0) {
        // Decrease it 'upgrades' times
        for (let i = 0; i < upgrades; i++) {
          await this.decreaseSkillRank(skillName);
          refundedSkills++;
        }
      }
    }
    
    // 3. Refund Attributes
    const charUpgrades = this.system.creation?.ledger?.upgrades?.characteristics || {};
    for (const [charName, upgrades] of Object.entries(charUpgrades)) {
      if (upgrades > 0) {
        for (let i = 0; i < upgrades; i++) {
          await this.decreaseAttribute(charName);
          refundedAttrs++;
        }
      }
    }
    
    return { 
      success: true, 
      message: `Erfolgreich zurückgesetzt! ${refundedTalents} Talente, ${refundedSkills} Fertigkeitsränge und ${refundedAttrs} Attribute wurden erstattet.` 
    };
  }

  hasCreationPurchases() {
    if (this.type !== "character") return false;
    
    // Check characteristic upgrades
    const charUpgrades = this.system.creation?.ledger?.upgrades?.characteristics || {};
    for (const val of Object.values(charUpgrades)) {
      if (val > 0) return true;
    }
    
    // Check skill upgrades
    const skillUpgrades = this.system.creation?.ledger?.upgrades?.skills || {};
    for (const val of Object.values(skillUpgrades)) {
      if (val > 0) return true;
    }
    
    // Check talent purchases
    const hasTalents = this.items.some(i => i.type === "talent");
    if (hasTalents) return true;
    
    return false;
  }

  /**
   * Checks if a skill is considered a career skill for this actor.
   * Reuses the authoritative derivedSkills lookup.
   * @param {string} skillName
   * @returns {boolean} True if career skill, false otherwise.
   */
  isCareerSkill(skillName) {
    if (!skillName || typeof skillName !== "string") return false;
    const sNameLower = skillName.trim().toLowerCase();
    if (this.derivedSkills && this.derivedSkills[sNameLower] !== undefined) {
      return !!this.derivedSkills[sNameLower].career;
    }
    const skillItem = this.items.find(i => i.type === "skill" && i.name.trim().toLowerCase() === sNameLower);
    return !!(skillItem?.system?.career);
  }

  /**
   * Calculates skill rank details (current rank, max limit, next cost, refund cost).
   * @param {string} skillName
   */
  getSkillRankDetails(skillName) {
    if (!skillName || typeof skillName !== "string") return null;
    const nameLower = skillName.trim().toLowerCase();
    const isCreationMode = this.system.creation?.isCreationMode === true;
    const isSandbox = this.system.creation?.sandboxMode === true;

    const skillItem = this.items.find(i => i.type === "skill" && i.name.toLowerCase() === nameLower);
    const freeRanks = this.derivedSkills?.[nameLower]?.freeRanks || 0;
    const currentUpgrades = this.system.creation?.ledger?.upgrades?.skills?.[nameLower] || 0;
    const currentRank = isCreationMode ? (freeRanks + currentUpgrades) : (skillItem?.system?.value || 0);

    const isCareer = this.isCareerSkill(skillName);
    const maxRank = this.getMaxSkillRank();
    const isMax = currentRank >= maxRank;

    const nextRank = currentRank + 1;
    const nextCost = isMax ? null : (isCareer ? (nextRank * 5) : ((nextRank * 5) + 5));
    const refundCost = (currentUpgrades > 0 || (!isCreationMode && currentRank > freeRanks))
      ? (isCareer ? (currentRank * 5) : ((currentRank * 5) + 5))
      : null;

    return {
      currentRank,
      freeRanks,
      currentUpgrades,
      isCareer,
      nextCost,
      refundCost,
      isMax,
      maxRank
    };
  }

  /**
   * Read-only method to get next skill rank cost without mutating state.
   * @param {string} skillName
   * @returns {{ cost: number|null, nextRank: number, isMax: boolean }|null}
   */
  getNextSkillRankCost(skillName) {
    const details = this.getSkillRankDetails(skillName);
    if (!details) return null;
    return {
      cost: details.nextCost,
      nextRank: details.currentRank + 1,
      isMax: details.isMax
    };
  }

  async toggleFreeCareerSkill(skillName, checked) {
    if (this.type !== "character") return;
    const currentArray = Array.from(this.system.creation?.ledger?.freeCareerSkills || this.system.creation?.freeCareerSkills || []);
    if (checked) {
      if (currentArray.length >= 4) {
        return { success: false, message: "Du kannst maximal 4 freie Karriere-Fertigkeiten auswählen!" };
      }
      if (!currentArray.includes(skillName)) currentArray.push(skillName);
    } else {
      const idx = currentArray.indexOf(skillName);
      if (idx > -1) currentArray.splice(idx, 1);
    }
    return this.update({
      "system.creation.freeCareerSkills": currentArray,
      "system.creation.ledger.freeCareerSkills": currentArray
    });
  }

  async toggleFreeSpecializationSkill(skillName, checked) {
    if (this.type !== "character") return;
    const currentArray = Array.from(this.system.creation?.ledger?.freeSpecializationSkills || this.system.creation?.freeSpecializationSkills || []);
    if (checked) {
      if (currentArray.length >= 2) {
        return { success: false, message: "Du kannst maximal 2 freie Spezialisierungs-Fertigkeiten auswählen!" };
      }
      if (!currentArray.includes(skillName)) currentArray.push(skillName);
    } else {
      const idx = currentArray.indexOf(skillName);
      if (idx > -1) currentArray.splice(idx, 1);
    }
    return this.update({
      "system.creation.freeSpecializationSkills": currentArray,
      "system.creation.ledger.freeSpecializationSkills": currentArray
    });
  }

  async buyTalent(talentData, cost, options = {}) {
    if (this.type !== "character") return { success: false, message: "Nur für Charaktere verfügbar." };
    const availableXp = this.system.xp?.available || 0;
    if (availableXp < cost) {
      return { success: false, message: `Nicht genug XP, um ${talentData.name} zu kaufen! (Kosten: ${cost} XP, Verfügbar: ${availableXp} XP)` };
    }

    const newAvailable = availableXp - cost;
    await this.update(
      { "system.xp.available": newAvailable },
      { xpLogDescription: options.logDescription || `Kauf von Talent "${talentData.name}" (-${cost} XP)` }
    );
    await this.createEmbeddedDocuments("Item", [{
      name: talentData.name,
      type: "talent",
      img: "icons/svg/star-filled.svg",
      system: {
        key: talentData.key,
        activation: talentData.activation,
        description: talentData.description,
        specialization: talentData.specialization || "",
        row: (talentData.row !== undefined && talentData.row !== null && !isNaN(talentData.row)) ? Number(talentData.row) : -1,
        col: (talentData.col !== undefined && talentData.col !== null && !isNaN(talentData.col)) ? Number(talentData.col) : -1
      }
    }]);
    return { success: true, message: `Talent ${talentData.name} gekauft.` };
  }

  async refundTalent(talentId, cost, name, options = {}) {
    if (this.type !== "character") return { success: false, message: "Nur für Charaktere verfügbar." };
    const talentItem = this.items.get(talentId);
    if (!talentItem) return { success: false, message: "Talent nicht gefunden." };

    // Im Play-Modus: nur GM darf Talente erstatten
    const isCreationMode = this.system.creation?.isCreationMode === true;
    if (!isCreationMode && !game.user?.isGM) {
      return { success: false, message: "Nur der GM kann bereits bestätigte Käufe zurücknehmen." };
    }

    await this.deleteEmbeddedDocuments("Item", [talentId]);
    const availableXp = this.system.xp?.available || 0;
    const newAvailable = availableXp + cost;
    await this.update(
      { "system.xp.available": newAvailable },
      { xpLogDescription: options.logDescription || `Erstattung von Talent "${name}" (+${cost} XP)` }
    );
    return { success: true, message: `Talent ${name} erstattet.` };
  }

  async applySpecies(speciesData) {
    if (this.type !== "character") return;
    
    // Determine stats
    const chars = speciesData.system.characteristics || {};
    const getVal = (val) => {
      if (!val) return 2;
      if (val.value !== undefined) return val.value;
      if (typeof val === "number") return val;
      return 2;
    };
    const baseChars = {
      brawn: getVal(chars.brawn),
      agility: getVal(chars.agility),
      intellect: getVal(chars.intellect),
      cunning: getVal(chars.cunning),
      willpower: getVal(chars.willpower),
      presence: getVal(chars.presence)
    };

    const woundsBase = speciesData.system.wounds?.base ?? (typeof speciesData.system.wounds === "number" ? speciesData.system.wounds : 10);
    const strainBase = speciesData.system.strain?.base ?? (typeof speciesData.system.strain === "number" ? speciesData.system.strain : 10);
    const xpTotal = speciesData.system.xp ?? 100;
    let specialAbilitiesText = speciesData.system.specialAbilities || "";
    let skillMods = speciesData.system.modifiers?.skills || "";

    // Specific logic for species like Twi'lek is handled during prep or manually. 
    // Here we strictly follow the data provided.
    const speciesSnapshot = {
      name: speciesData.name,
      characteristics: baseChars,
      wounds: woundsBase,
      strain: strainBase,
      xp: xpTotal,
      modifiers: { skills: skillMods },
      specialAbilities: specialAbilitiesText
    };

    const updates = {
      "system.biography.species": speciesData.name,
      "system.biography.specialAbilities": specialAbilitiesText,
      "system.creation.speciesSnapshot": speciesSnapshot,
      "system.creation.startingXp": xpTotal,
      "system.creation.baseCharacteristics": baseChars,
      "system.xp.total": xpTotal,
      "system.xp.available": xpTotal,
      "system.stats.wounds.base": woundsBase + baseChars.brawn,
      "system.stats.wounds.max": woundsBase + baseChars.brawn,
      "system.stats.strain.base": strainBase + baseChars.willpower,
      "system.stats.strain.max": strainBase + baseChars.willpower
    };

    // Skills
    const currentSkills = this.items.filter(i => i.type === "skill");
    const skillsToEnsure = [];

    if (skillMods) {
      const parts = skillMods.split(",");
      for (const part of parts) {
        const [skillName] = part.split(":").map(p => p.trim());
        if (skillName && !skillsToEnsure.includes(skillName.toLowerCase())) {
          skillsToEnsure.push(skillName.toLowerCase());
        }
      }
    }
    
    const itemsToCreate = [];
    const itemsToUpdate = [];

    // In V14 we want to make sure the actor actually owns the skills provided by the species.
    for (const sNameLower of skillsToEnsure) {
      const existing = currentSkills.find(s => s.name.toLowerCase() === sNameLower);
      if (existing) {
        // If skill exists, we update its freeRanks directly on the item so it persists
        const currentRanks = existing.system.freeRanks || 0;
        itemsToUpdate.push({
          _id: existing.id,
          "system.freeRanks": currentRanks + 1
        });
      } else {
        // Find in default skills to get characteristic and category
        const defSkill = DEFAULT_SKILLS.find(s => s.name.toLowerCase() === sNameLower);
        if (defSkill) {
          itemsToCreate.push({
            name: defSkill.name,
            type: "skill",
            system: {
              value: 0,
              freeRanks: 1,
              career: false,
              characteristic: defSkill.characteristic,
              category: defSkill.category
            }
          });
        }
      }
    }

    if (itemsToCreate.length > 0) {
      await this.createEmbeddedDocuments("Item", itemsToCreate);
    }
    if (itemsToUpdate.length > 0) {
      await this.updateEmbeddedDocuments("Item", itemsToUpdate);
    }

    await this.update(updates);
    return { success: true, message: `Spezies ${speciesData.name} angewendet.` };
  }

  async removeSpecies() {
    if (this.type !== "character") return;
    
    // Cascading removes
    await this.removeCareer(false); // remove career but don't recalculate immediately
    
    const updates = {
      "system.biography.species": "",
      "system.biography.specialAbilities": "",
      "system.creation.speciesSnapshot": null,
      "system.creation.ledger.speciesSkillChoice": "",
      "system.creation.ledger.upgrades.characteristics": {
        brawn: 0, agility: 0, intellect: 0, cunning: 0, willpower: 0, presence: 0
      },
      "system.creation.ledger.upgrades.skills": {},
      "system.creation.startingXp": 0,
      "system.xp.total": 0,
      "system.xp.available": 0,
      "system.creation.baseCharacteristics": {
        brawn: 2, agility: 2, intellect: 2, cunning: 2, willpower: 2, presence: 2
      },
      "system.stats.wounds.base": 10,
      "system.stats.strain.base": 10,
      "system.stats.wounds.max": 10,
      "system.stats.strain.max": 10
    };
    await this.update(updates);
    return { success: true, message: `Spezies entfernt.` };
  }

  async applyCareer(careerData) {
    if (this.type !== "character") return;
    const skillListStr = careerData.system.careerSkills || "";
    const careerSkills = skillListStr.split(",").map(s => s.trim().toLowerCase()).filter(s => s);

    const careerSnapshot = {
      name: careerData.name,
      careerSkills: careerSkills,
      specializations: careerData.system.specializations || []
    };

    const currentSkills = this.items.filter(i => i.type === "skill");
    const itemsToCreate = [];

    // Ensure all career skills exist on the actor as items with value 0
    for (const sName of careerSkills) {
      const existing = currentSkills.find(s => s.name.toLowerCase() === sName);
      if (!existing) {
        const dSkill = DEFAULT_SKILLS.find(s => s.name.toLowerCase() === sName);
        if (dSkill) {
          itemsToCreate.push({
            name: dSkill.name,
            type: "skill",
            system: {
              value: 0,
              freeRanks: 0,
              career: false,
              characteristic: dSkill.characteristic,
              category: dSkill.category
            }
          });
        }
      }
    }

    if (itemsToCreate.length > 0) {
      await this.createEmbeddedDocuments("Item", itemsToCreate);
    }

    await this.update({
      "system.biography.career": careerData.name,
      "system.creation.careerSnapshot": careerSnapshot,
      "system.creation.freeCareerSkills": [],
      "system.creation.ledger.freeCareerSkills": []
    });
    return { success: true, message: `Karriere ${careerData.name} angewendet.` };
  }

  async removeCareer(shouldRecalculate = true) {
    if (this.type !== "character") return;
    
    // Cascading removes: remove starting specialization since it's tied to the career
    // MUST BE DONE FIRST to avoid race condition with ledger updates!
    const startingSpecName = this.system.biography?.specialization;
    if (startingSpecName) {
      const startingSpecItem = this.items.find(i => i.type === "specialization" && i.name === startingSpecName);
      if (startingSpecItem) {
        await this.removeSpecialization(startingSpecItem.id, true);
      }
    }

    // 1. Identify career skills from the career snapshot
    const careerSnapshot = this.system.creation?.careerSnapshot;
    let careerSkills = [];
    if (careerSnapshot && careerSnapshot.careerSkills) {
      careerSkills = careerSnapshot.careerSkills;
    }

    // 2. Reset ledger skill upgrades for these career skills
    const updates = {
      "system.biography.career": "",
      "system.creation.careerSnapshot": null,
      "system.creation.freeCareerSkills": [],
      "system.creation.ledger.freeCareerSkills": []
    };

    if (this.system.creation?.ledger?.upgrades?.skills) {
      const currentSkillUpgrades = foundry.utils.deepClone(this.system.creation.ledger.upgrades.skills);
      let changed = false;
      for (const skillName of careerSkills) {
        const keyMatch = Object.keys(currentSkillUpgrades).find(k => k.toLowerCase() === skillName);
        if (keyMatch && currentSkillUpgrades[keyMatch]) {
          currentSkillUpgrades[keyMatch] = 0;
          changed = true;
        }
      }
      if (changed) {
        updates["system.creation.ledger.upgrades.skills"] = currentSkillUpgrades;
      }
    }

    await this.update(updates);
    
    if (shouldRecalculate) await this.recalculateCareerSkills();
    return { success: true, message: `Karriere entfernt.` };
  }

  async applySpecialization(specData) {
    if (this.type !== "character") return;
    const hasSpec = this.items.some(i => i.type === "specialization" && i.name.toLowerCase() === specData.name.toLowerCase());
    if (!hasSpec) {
      if (!this.canAffordSpecialization(specData)) {
        return { success: false, message: `Nicht genug XP vorhanden, um die Spezialisierung "${specData.name}" zu erwerben!` };
      }
      await this.createEmbeddedDocuments("Item", [specData]);
    }

    const skillListStr = specData.system.careerSkills || "";
    const careerSkills = skillListStr.split(",").map(s => s.trim().toLowerCase()).filter(s => s);
    const specSnapshot = {
      name: specData.name,
      careerSkills: careerSkills
    };

    const currentSkills = this.items.filter(i => i.type === "skill");
    const itemsToCreate = [];

    // Ensure all career skills exist on the actor as items with value 0
    for (const sName of careerSkills) {
      const existing = currentSkills.find(s => s.name.toLowerCase() === sName);
      if (!existing) {
        const dSkill = DEFAULT_SKILLS.find(s => s.name.toLowerCase() === sName);
        if (dSkill) {
          itemsToCreate.push({
            name: dSkill.name,
            type: "skill",
            system: {
              value: 0,
              freeRanks: 0,
              career: false,
              characteristic: dSkill.characteristic,
              category: dSkill.category
            }
          });
        }
      }
    }

    if (itemsToCreate.length > 0) {
      await this.createEmbeddedDocuments("Item", itemsToCreate);
    }

    await this.update({ 
      "system.biography.specialization": specData.name,
      "system.creation.specializationSnapshot": specSnapshot,
      "system.creation.freeSpecializationSkills": [],
      "system.creation.ledger.freeSpecializationSkills": []
    });
    return { success: true, message: `Spezialisierung ${specData.name} angewendet.` };
  }

  async removeSpecialization(itemId, isStartingSpec) {
    if (this.type !== "character") return;
    const item = this.items.get(itemId);
    if (!item) return;

    const updates = {};
    
    // 1. Delete all talents that belong to this specialization
    const specNameLower = item.name.toLowerCase();
    const talentIdsToDelete = this.items
      .filter(i => i.type === "talent" && ((i.system.specialization || "").toLowerCase() === specNameLower || i.system.specialization === item.id))
      .map(i => i.id);
      
    // 2. Identify career skills of this specialization
    let specCareerSkills = [];
    if (item.system.careerSkills) {
      specCareerSkills = item.system.careerSkills.split(",").map(s => s.trim().toLowerCase()).filter(s => s);
    }
    
    // 3. Reset ledger skill upgrades for these skills
    if (this.system.creation?.ledger?.upgrades?.skills) {
      const currentSkillUpgrades = foundry.utils.deepClone(this.system.creation.ledger.upgrades.skills);
      let changed = false;
      for (const skillName of specCareerSkills) {
        const keyMatch = Object.keys(currentSkillUpgrades).find(k => k.toLowerCase() === skillName);
        if (keyMatch && currentSkillUpgrades[keyMatch]) {
          currentSkillUpgrades[keyMatch] = 0;
          changed = true;
        }
      }
      if (changed) {
        updates["system.creation.ledger.upgrades.skills"] = currentSkillUpgrades;
      }
    }

    if (isStartingSpec || this.system.biography?.specialization === item.name) {
      updates["system.biography.specialization"] = "";
      updates["system.creation.specializationSnapshot"] = null;
      updates["system.creation.freeSpecializationSkills"] = [];
      updates["system.creation.ledger.freeSpecializationSkills"] = [];
    }

    const idsToDelete = [itemId, ...talentIdsToDelete];
    await this.deleteEmbeddedDocuments("Item", idsToDelete);
    if (Object.keys(updates).length > 0) {
      await this.update(updates);
    }
    return { success: true, message: `Spezialisierung entfernt.` };
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

  /**
   * Helper function for the Character Builder Dialog to fetch specializations.
   * Returns curated specializations for a career, plus universal ones.
   * @param {string} careerKey - The key of the selected career.
   * @returns {Promise<{careerSpecs: Object[], universalSpecs: Object[], noCurationAvailable: boolean}>}
   */
  static async getSpecializationsForCareer(careerKey) {
    const specsPack = game.packs.get("starwars-ffg-scratch.specializations");
    const careersPack = game.packs.get("starwars-ffg-scratch.careers");
    
    let careerSpecs = [];
    let universalSpecs = [];
    let noCurationAvailable = true;

    if (!specsPack) return { careerSpecs, universalSpecs, noCurationAvailable };

    const specDocs = await specsPack.getDocuments();

    // Find the universal specializations
    for (const spec of specDocs) {
      if (spec.system.isUniversal) {
        universalSpecs.push(spec);
      }
    }

    // Try to find the career to get its linked specializations
    if (careerKey && careersPack) {
      const careerDocs = await careersPack.getDocuments();
      const career = careerDocs.find(c => (c.system.key || "").toLowerCase() === careerKey.toLowerCase());
      
      if (career && career.system.specializations && career.system.specializations.length > 0) {
        noCurationAvailable = false;
        const linkedKeys = career.system.specializations.map(k => k.toLowerCase());
        for (const spec of specDocs) {
          const sKey = (spec.system.key || "").toLowerCase();
          if (linkedKeys.includes(sKey)) {
            careerSpecs.push(spec);
          }
        }
      }
    }

    // Fallback: If no curation is available, return all non-universal specs as "career specs"
    if (noCurationAvailable) {
      careerSpecs = specDocs.filter(s => !s.system.isUniversal);
    }

    // Sort alphabetically
    careerSpecs.sort((a, b) => a.name.localeCompare(b.name));
    universalSpecs.sort((a, b) => a.name.localeCompare(b.name));

    return { careerSpecs, universalSpecs, noCurationAvailable };
  }
}
