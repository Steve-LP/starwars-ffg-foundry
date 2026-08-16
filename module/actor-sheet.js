import { CharacterBuilder } from "./applications/character-builder.js";
import { CANONICAL_SKILLS, normalizeSkillName, getSkillCharacteristic } from "./utils/skill-normalization.js";
import { TalentTreeUtils } from "./utils/talent-tree.js";
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export const DEFAULT_SKILLS = CANONICAL_SKILLS;

export const CHOICE_SPECIES = {
  "twilek": ["Charm", "Deception"],
  "devaronian": ["Survival", "Deception"],
  "weequay": ["Resilience", "Athletics"],
  "klatooinian": ["Brawl", "Ranged - Heavy", "Ranged - Light"]
};

export function normalizeSpeciesName(name) {
  if (!name) return "";
  return name.toLowerCase().replace(/['\s-]/g, "");
}

export class SWFFGActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["starwars-ffg", "sheet", "actor"],
    position: {
      width: 840,
      height: 720
    },
    window: {
      resizable: true
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false
    },
    actions: {
      openBuilder: SWFFGActorSheet.#onOpenBuilder,
      toggleEditMode: SWFFGActorSheet.#onToggleEditMode,
      openSpecialization: SWFFGActorSheet.#onOpenSpecialization
    }
  };

  static async #onOpenBuilder(event, target) {
    const builder = new CharacterBuilder({ actor: this.document });
    builder.render({ force: true });
  }

  static async #onOpenSpecialization(event, target) {
    const itemId = target.dataset.itemId;
    const item = itemId ? this.document.items.get(itemId) : this.document.items.find(i => i.type === "specialization");
    if (item) {
      item.sheet.render(true);
    } else {
      ui.notifications.warn("Spezialisierung nicht gefunden.");
    }
  }

  /**
   * Schaltet den Bearbeitungsmodus um. Rein client-seitiger Zustand —
   * wird NICHT persistiert, setzt sich bei jedem Render/Öffnen auf false zurück.
   */
  static async #onToggleEditMode(event, target) {
    this.editMode = !this.editMode;
    console.info(`SWFFG | [ActorSheet] Bearbeitungsmodus: ${this.editMode ? 'AN' : 'AUS'} (${this.document.name})`);
    this.render();
  }

  static PARTS = {
    sheet: {
      template: "systems/starwars-ffg-scratch/templates/actors/character-sheet.html",
      scrollable: [".sheet-body"]
    }
  };

  static TABS = {
    primary: {
      id: "primary",
      initial: "overview",
      tabs: [
        { id: "overview", label: "Übersicht" },
        { id: "inventory", label: "Inventory" },
        { id: "biography", label: "Biography" },
        { id: "xpLog", label: "XP Log" }
      ]
    }
  };

  tabGroups = {
    primary: "overview"
  };

  /**
   * Bearbeitungsmodus: IMMER false beim Öffnen/Rendern des Sheets.
   * Kein Persistieren am Actor — flüchtiger UI-Zustand, nur client-seitig.
   * Steuert ob Kauf- und Würfel-Buttons aktiv sind.
   */
  editMode = false;

  /**
   * Compatibility getter for this.actor in DocumentSheetV2
   */
  get actor() {
    return this.document;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.document;
    const actorData = this.document;
    context.isGM = game.user.isGM;
    // editMode: flüchtiger UI-Zustand, nicht aus Actor-Daten gelesen
    context.editMode = this.editMode;

    // Set up default skills if they don't exist
    context.skills = this._prepareSkills();
    console.log("SWFFG | Prepared context skills:", context.skills);
    context.tabs = this._prepareTabs("primary");
    context.weapons = [];
    context.armor = [];
    context.gear = [];
    context.talents = [];
    context.forcePowers = [];

    const rawTalents = [];

    // Categorize items
    for (let item of actorData.items) {
      if (item.type === "weapon") context.weapons.push(item);
      else if (item.type === "armor") context.armor.push(item);
      else if (item.type === "gear") context.gear.push(item);
      else if (item.type === "talent") rawTalents.push(item);
      else if (item.type === "forcePower") context.forcePowers.push(item);
    }

    // Enrich weapon items with normalized skill and resolved characteristics/ranks for attack rolls
    context.weapons = context.weapons.map(weapon => {
      const wObj = (typeof weapon.toObject === "function") ? weapon.toObject() : foundry.utils.deepClone(weapon);
      wObj._id = weapon.id || weapon._id;
      wObj.id = weapon.id || weapon._id;
      const rawSkill = weapon.system?.skill || "Ranged - Light";
      const normalizedSkill = normalizeSkillName(rawSkill);
      const skillData = context.skills[normalizedSkill] || {};
      wObj.derivedSkillName = normalizedSkill;
      wObj.derivedCharacteristic = skillData.characteristic || getSkillCharacteristic(normalizedSkill);
      wObj.derivedRank = skillData.value ?? 0;
      return wObj;
    });

    // Group raw talents by key for stacked display
    const groupedTalents = {};
    for (let talent of rawTalents) {
      const key = talent.system?.key?.toLowerCase() || talent.name.toLowerCase();
      if (!groupedTalents[key]) {
        groupedTalents[key] = {
          _id: talent.id,
          name: talent.name,
          system: {
            activation: talent.system?.activation || "Passive",
            tier: talent.system?.tier || 1,
            ranked: talent.system?.ranked || false,
            ranks: 0
          },
          ids: [talent.id]
        };
      } else {
        groupedTalents[key].ids.push(talent.id);
      }
      groupedTalents[key].system.ranks += 1;
    }
    context.talents = Object.values(groupedTalents);


    // Resolve Specializations and their Talent Trees
    const allSpecs = this.actor.items.filter(i => i.type === "specialization");
    const talentPack = game.packs.get("starwars-ffg-scratch.talents");
    const talentsIndex = talentPack ? await talentPack.getIndex({ fields: ["system.description", "system.activation", "system.ranked", "system.key"] }) : [];

    const resolvedSpecs = allSpecs.map(spec => {
      const specObj = spec.toObject();
      specObj.id = spec.id;
      console.log("SWFFG | Specialization object:", specObj);
      
      let rows = specObj.system.talentRows;
      if (typeof rows === "string") {
        try {
          rows = JSON.parse(rows);
        } catch (e) {
          rows = [];
        }
      }

      if (rows && Array.isArray(rows)) {
        specObj.system.talentRows = TalentTreeUtils.buildGrid(spec.name, rows, talentsIndex, this.actor);
      }
      return specObj;
    });

    // Categorize by classification
    context.specializations = resolvedSpecs.filter(s => !["force-power", "signature-ability"].includes(s.system.classification));
    context.forceSpecializations = resolvedSpecs.filter(s => s.system.classification === "force-power");
    context.signatureSpecializations = resolvedSpecs.filter(s => s.system.classification === "signature-ability");

    // Prepare characteristics with costs and affordance
    const availableXp = actorData.system.xp?.available || 0;
    const isCreation = actorData.system.creation?.isCreationMode !== false;
    
    context.isCreationMode = isCreation;
    context.isCreationOrGM = context.isGM || isCreation;
    context.lockFields = !context.isGM && !isCreation;
    
    context.characteristics = {};
    const baseChars = actorData.system.creation?.baseCharacteristics || {};
    for (const [key, char] of Object.entries(actorData.system.characteristics || {})) {
      const currentVal = char.value || 0;
      const baseVal = baseChars[key] !== undefined ? baseChars[key] : 2;
      const cost = (currentVal + 1) * 10;
      const isSandbox = actorData.system.creation?.sandboxMode || false;
      const canUpgrade = !actorData.system.creation?.isCreationMode || currentVal < 5;
      const canAfford = isSandbox || (
        canUpgrade && (
          context.isGM || (
            availableXp >= cost && 
            ((actorData.currentAttributeXpSpent || 0) + cost <= (actorData.maxAttributeXpAllowed || 0))
          )
        )
      );
      const isDecreasable = currentVal > baseVal;
      context.characteristics[key] = {
        value: currentVal,
        cost: cost,
        canAfford: canAfford,
        isDecreasable: isDecreasable
      };
    }

    // Prepare species starting skill choice options
    const speciesName = actorData.system.biography?.species || "";
    const speciesNameNorm = normalizeSpeciesName(speciesName);
    const choiceOptions = CHOICE_SPECIES[speciesNameNorm];
    if (choiceOptions && choiceOptions.length > 0) {
      context.speciesHasChoice = true;
      const currentChoice = (actorData.system.creation?.ledger?.speciesSkillChoice || "").trim().toLowerCase();
      context.speciesChoiceOptions = choiceOptions.map(opt => {
        return {
          value: opt,
          label: opt,
          selected: currentChoice === opt.toLowerCase()
        };
      });
    } else {
      context.speciesHasChoice = false;
    }

    const creationSpent = (actorData.currentAttributeXpSpent || 0) +
                          (actorData.calculateSpentTalentXp() || 0) +
                          (actorData.calculateSpentSpecializationXp() || 0) +
                          (actorData.calculateSpentSkillXp() || 0);
    const creationBudget = (actorData.system.creation?.startingXp || 0) + (actorData.dutyXp || 0);
    context.xpSpentInfo = `${creationSpent} / ${creationBudget} XP (Attribute: ${actorData.currentAttributeXpSpent || 0} / ${actorData.maxAttributeXpAllowed || 0} XP)`;

    const creation = actorData.system.creation || {};
    const freeCareerCount = (creation.freeCareerSkills || []).length;
    const freeSpecCount = (creation.freeSpecializationSkills || []).length;

    const hasSpecies = !!actorData.system.biography?.species;
    const hasCareer = !!actorData.system.biography?.career;
    const hasSpec = this.actor.items.some(i => i.type === "specialization");
    const has4FreeCareerSkills = freeCareerCount === 4;
    const has2FreeSpecSkills = freeSpecCount === 2;
    const hasNonNegativeXp = this.actor.totalAvailableXp >= 0;

    const isGM = game.user?.isGM || false;
    const canLockCreation = isGM || (hasSpecies && hasCareer && hasSpec && has4FreeCareerSkills && has2FreeSpecSkills && hasNonNegativeXp);

    const missingRequirements = [];
    if (!hasSpecies) missingRequirements.push("Spezies fehlt");
    if (!hasCareer) missingRequirements.push("Karriere fehlt");
    if (!hasSpec) missingRequirements.push("Spezialisierung fehlt");
    if (!has4FreeCareerSkills) missingRequirements.push(`Karriere-Fertigkeiten (${freeCareerCount}/4 gewählt)`);
    if (!has2FreeSpecSkills) missingRequirements.push(`Spezialisierungs-Fertigkeiten (${freeSpecCount}/2 gewählt)`);
    if (!hasNonNegativeXp) missingRequirements.push("XP im Minus");

    const isSandbox = actorData.system.creation?.sandboxMode || false;

    context.canLockCreation = canLockCreation;
    context.missingRequirementsText = missingRequirements.join(", ");
    context.freeCareerLimitReached = freeCareerCount >= 4;
    context.freeSpecLimitReached = freeSpecCount >= 2;
    context.showCareerToggles = isSandbox;

    return context;
  }

  _prepareSkills() {
    const currentSkills = this.actor.items.filter(i => i.type === "skill");
    
    // Parse skill modifiers from equipped items
    const skillModifiers = {};
    for (const item of this.actor.items) {
      if (item.system?.equipped) {
        // From base item modifiers
        if (item.system.modifiers) {
          const skillModStr = item.system.modifiers.skills || "";
          if (skillModStr) {
            const parts = skillModStr.split(",");
            for (const part of parts) {
              const [skillName, valStr] = part.split(":").map(p => p.trim().toLowerCase());
              if (skillName && valStr) {
                const modVal = parseInt(valStr);
                if (!isNaN(modVal)) {
                  skillModifiers[skillName] = (skillModifiers[skillName] || 0) + modVal;
                }
              }
            }
          }
        }

        // From attachments installed on equipped weapons/armor
        if (item.system.attachments && Array.isArray(item.system.attachments)) {
          for (const att of item.system.attachments) {
            // Base attachment skill modifiers
            if (att.baseModifiers?.skills) {
              const parts = att.baseModifiers.skills.split(",");
              for (const part of parts) {
                const [skillName, valStr] = part.split(":").map(p => p.trim().toLowerCase());
                if (skillName && valStr) {
                  const modVal = parseInt(valStr);
                  if (!isNaN(modVal)) {
                    skillModifiers[skillName] = (skillModifiers[skillName] || 0) + modVal;
                  }
                }
              }
            }

            // Unlocked active skill mods
            const activeMods = (att.mods || []).filter(m => m.active && m.type === "skill" && m.target);
            for (const mod of activeMods) {
              const skillName = mod.target.trim().toLowerCase();
              skillModifiers[skillName] = (skillModifiers[skillName] || 0) + (mod.value || 0);
            }
          }
        }
      }
    }

    const processedNames = new Set();
    const finalSkills = {};

    for (const skill of DEFAULT_SKILLS) {
      const nameLower = skill.name.toLowerCase();
      processedNames.add(nameLower);

      // Find matching item in actor items (for rank values)
      const actorSkill = currentSkills.find(s => s.name.toLowerCase() === nameLower);
      const baseRank = Math.max(0, actorSkill?.system.value || 0);
      const skillMod = skillModifiers[nameLower] || 0;
      const value = Math.max(0, baseRank + skillMod);

      const characteristic = skill.characteristic;
      const charValue = Math.max(0, this.actor.system.characteristics[characteristic]?.value || 0);

      const greenCount = Math.max(0, Math.abs(charValue - value));
      const yellowCount = Math.max(0, Math.min(charValue, value));

      const creation = this.actor.system.creation || {};
      const isSandbox = creation.sandboxMode || false;
      const careerSkills = creation.careerSnapshot?.careerSkills || creation.careerSkills || [];
      const specSkills = creation.specializationSnapshot?.careerSkills || creation.specializationSkills || [];
      const freeCareer = creation.ledger?.freeCareerSkills || creation.freeCareerSkills || [];
      const freeSpec = creation.ledger?.freeSpecializationSkills || creation.freeSpecializationSkills || [];

      const isCareerSource = careerSkills.some(s => s.toLowerCase() === nameLower);
      const isSpecSource = specSkills.some(s => s.toLowerCase() === nameLower);
      const freeCareerSelected = freeCareer.some(s => s.toLowerCase() === nameLower);
      const freeSpecSelected = freeSpec.some(s => s.toLowerCase() === nameLower);

      const isCareer = actorSkill?.system.career || isCareerSource || isSpecSource;
      const freeRanks = this.actor.getSkillFreeRanks(actorSkill || { name: skill.name, system: { freeRanks: 0 } });
      const nextRank = baseRank + 1;
      const cost = isCareer ? (nextRank * 5) : ((nextRank * 5) + 5);
      const isGM = game.user?.isGM || false;
      const maxRank = this.actor.getMaxSkillRank();
      const canUpgrade = baseRank < maxRank;
      const canAfford = isSandbox || (
        canUpgrade && (
          isGM || this.actor.totalAvailableXp >= cost
        )
      );
      const isDecreasable = baseRank > freeRanks;

      finalSkills[skill.name] = {
        name: skill.name,
        characteristic: skill.characteristic,
        category: skill.category,
        baseValue: baseRank,
        value: value,
        modifier: skillMod,
        career: isCareer,
        id: actorSkill?._id || null,
        cost: cost,
        canAfford: canAfford,
        isDecreasable: isDecreasable,
        isCareerSource: isCareerSource,
        isSpecSource: isSpecSource,
        freeCareerSelected: freeCareerSelected,
        freeSpecSelected: freeSpecSelected,
        dice: {
          green: Array(greenCount).fill(true),
          yellow: Array(yellowCount).fill(true)
        }
      };
    }

    // Append any custom unmatched skill items on the actor
    for (const actorSkill of currentSkills) {
      const skillNameLower = actorSkill.name.toLowerCase();
      if (processedNames.has(skillNameLower)) continue;

      const baseRank = Math.max(0, actorSkill.system.value || 0);
      const skillMod = skillModifiers[skillNameLower] || 0;
      const value = Math.max(0, baseRank + skillMod);

      const characteristic = actorSkill.system.characteristic || "intellect";
      const charValue = Math.max(0, this.actor.system.characteristics[characteristic]?.value || 0);

      const greenCount = Math.max(0, Math.abs(charValue - value));
      const yellowCount = Math.max(0, Math.min(charValue, value));

      const creation = this.actor.system.creation || {};
      const careerSkills = creation.careerSnapshot?.careerSkills || creation.careerSkills || [];
      const specSkills = creation.specializationSnapshot?.careerSkills || creation.specializationSkills || [];
      const freeCareer = creation.ledger?.freeCareerSkills || creation.freeCareerSkills || [];
      const freeSpec = creation.ledger?.freeSpecializationSkills || creation.freeSpecializationSkills || [];

      const isCareerSource = careerSkills.some(s => s.toLowerCase() === skillNameLower);
      const isSpecSource = specSkills.some(s => s.toLowerCase() === skillNameLower);
      const freeCareerSelected = freeCareer.some(s => s.toLowerCase() === skillNameLower);
      const freeSpecSelected = freeSpec.some(s => s.toLowerCase() === skillNameLower);

      const isCareer = actorSkill.system.career || isCareerSource || isSpecSource;
      const freeRanks = this.actor.getSkillFreeRanks(actorSkill);
      const nextRank = baseRank + 1;
      const cost = isCareer ? (nextRank * 5) : ((nextRank * 5) + 5);
      const isGM = game.user?.isGM || false;
      const isSandbox = this.actor.system.creation?.sandboxMode || false;
      const maxRankCustom = this.actor.getMaxSkillRank();
      const canUpgradeCustom = baseRank < maxRankCustom;
      const canAfford = isSandbox || (
        canUpgradeCustom && (
          isGM || this.actor.totalAvailableXp >= cost
        )
      );
      const isDecreasable = baseRank > freeRanks;

      finalSkills[actorSkill.name] = {
        name: actorSkill.name,
        characteristic: characteristic,
        category: actorSkill.system.category || "General",
        baseValue: baseRank,
        value: value,
        modifier: skillMod,
        career: isCareer,
        id: actorSkill._id,
        cost: cost,
        canAfford: canAfford,
        isDecreasable: isDecreasable,
        isCareerSource: isCareerSource,
        isSpecSource: isSpecSource,
        freeCareerSelected: freeCareerSelected,
        freeSpecSelected: freeSpecSelected,
        dice: {
          green: Array(greenCount).fill(true),
          yellow: Array(yellowCount).fill(true)
        }
      };
    }

    return finalSkills;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const html = $(this.element);

    // Visueller Edit-Lock-Rahmen: auffällig, damit andere Mitspieler es sehen
    if (this.editMode) {
      this.element.classList.add("edit-mode-active");
    } else {
      this.element.classList.remove("edit-mode-active");
    }

    // Roll click handlers — nur im Bearbeitungsmodus aktiv
    if (this.editMode) {
      html.find(".rollable-skill").click(this._onRollSkill.bind(this));
      html.find(".rollable-char").click(this._onRollCharacteristic.bind(this));
    }

    // Item controls
    html.find(".item-edit").click(this._onItemEdit.bind(this));
    html.find(".item-delete").click(this._onItemDelete.bind(this));
    html.find(".item-create").click(this._onItemCreate.bind(this));
    html.find(".item-equip").click(this._onItemEquip.bind(this));
    html.find(".reset-xp-log").click(this._onResetXpLog.bind(this));
    html.find(".award-xp-btn").click(this._onAwardXp.bind(this));

    // Inline QoL skill edits
    html.find(".skill-val-input").change(this._onSkillValChange.bind(this));
    html.find(".career-toggle").change(this._onCareerToggle.bind(this));

    // Biography drop-zone clicks to open compendiums
    html.find(".drop-zone").click(this._onOpenCompendium.bind(this));

    // Image editing handler for V2
    if (this.isEditable) {
      html.find('img[data-edit="img"]').click(event => {
        const fp = new foundry.applications.apps.FilePicker.implementation({
          type: "image",
          current: this.document.img,
          callback: path => {
            this.document.update({ img: path });
          }
        });
        fp.render(true);
      });

      // Talent tree: immer binden (GM kann immer erstatten); Kauf nur im editMode
      html.find(".talent-card").click(this._onTalentCardClick.bind(this));

      // Biography removal handler — keine XP-Seiteneffekte, immer erlaubt
      html.find(".remove-bio").click(this._onRemoveBio.bind(this));

      // Specialization header removal handler
      html.find(".remove-spec-header").click(this._onRemoveSpecHeader.bind(this));

      // GM-only Verwaltungsaktionen (Sandbox, Sperren, Reset) — immer erlaubt
      html.find(".lock-creation-btn").click(async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const result = await this.actor.lockCreation();
        if (result && !result.success) ui.notifications?.error(result.message);
        else if (result && result.message) ui.notifications?.info(result.message);
      });

      html.find(".toggle-sandbox-btn").click(async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const result = await this.actor.toggleSandboxMode();
        if (result && result.message) ui.notifications?.info(result.message);
      });

      html.find(".reset-creation-btn").click(async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const result = await this.actor.resetToCreationMode();
        if (result && result.message) ui.notifications?.info(result.message);
      });

      // ── Kauf- und Rückgabe-Buttons: nur im Bearbeitungsmodus ──────────────
      // (Ausnahme: GM-Refund-Buttons sind im Template für GMs immer aktiv und
      //  werden durch actor.decreaseSkillRank/refundTalent serverseitig geprüft)

      html.find(".upgrade-characteristic-btn").click(async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!this.editMode) return;
        const charName = event.currentTarget.dataset.characteristic;
        if (charName) {
          const result = await this.actor.buyAttribute(charName);
          if (result && !result.success) ui.notifications?.warn(result.message);
          else if (result && result.message) ui.notifications?.info(result.message);
        }
      });

      html.find(".decrease-characteristic-btn").click(async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!this.editMode) return;
        const charName = event.currentTarget.dataset.characteristic;
        if (charName) {
          const result = await this.actor.decreaseAttribute(charName);
          if (result && !result.success) ui.notifications?.warn(result.message);
          else if (result && result.message) ui.notifications?.info(result.message);
        }
      });

      html.find(".upgrade-skill-btn").click(async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!this.editMode) return;
        const skillName = event.currentTarget.dataset.name;
        const skillChar = event.currentTarget.dataset.characteristic;
        const skillCat = event.currentTarget.dataset.category;
        if (skillName) {
          const result = await this.actor.buySkillRank(skillName, skillChar, skillCat);
          if (result && !result.success) ui.notifications?.warn(result.message);
          else if (result && result.message) ui.notifications?.info(result.message);
        }
      });

      html.find(".decrease-skill-btn").click(async (event) => {
        event.preventDefault();
        event.stopPropagation();
        // GM-Refunds laufen immer durch (serverseitiger Check in decreaseSkillRank)
        // Nicht-GM im Play-Modus: JS-Guard zusätzlich zur serverseitigen Ablehnung
        if (!this.editMode && !game.user.isGM) return;
        const skillName = event.currentTarget.dataset.name;
        if (skillName) {
          const result = await this.actor.decreaseSkillRank(skillName);
          if (result && !result.success) ui.notifications?.warn(result.message);
          else if (result && result.message) ui.notifications?.info(result.message);
        }
      });

      html.find(".free-career-toggle").change(async (event) => {
        event.preventDefault();
        if (!this.editMode) return;
        const skillName = event.currentTarget.dataset.name;
        const checked = event.currentTarget.checked;
        const result = await this.actor.toggleFreeCareerSkill(skillName, checked);
        if (result && !result.success) {
          event.currentTarget.checked = !checked;
          ui.notifications?.warn(result.message);
        }
      });

      html.find(".free-spec-toggle").change(async (event) => {
        event.preventDefault();
        if (!this.editMode) return;
        const skillName = event.currentTarget.dataset.name;
        const checked = event.currentTarget.checked;
        const result = await this.actor.toggleFreeSpecializationSkill(skillName, checked);
        if (result && !result.success) {
          event.currentTarget.checked = !checked;
          ui.notifications?.warn(result.message);
        }
      });
    }

  }

  async _onTalentCardClick(event) {
    event.preventDefault();
    if (!this.editMode) {
      ui.notifications?.warn("Bitte zuerst den Bearbeitungsmodus aktivieren, um Talente zu bearbeiten.");
      return;
    }
    const card = event.currentTarget;
    const key = card.dataset.key;
    const cost = parseInt(card.dataset.cost || 0);
    const name = card.dataset.name;
    const activation = card.dataset.activation;
    const description = card.dataset.description;
    const row = parseInt(card.dataset.row);
    const col = parseInt(card.dataset.col);
    const specName = card.closest("[data-spec-name]")?.dataset?.specName || "";
    const isPurchased = card.classList.contains("purchased");
    const isReachable = card.dataset.reachable === "true";
    const availableXp = this.actor.system.xp?.available || 0;

    if (isPurchased) {
      const isCreationMode = this.actor.system.creation?.isCreationMode === true;
      if (!isCreationMode && !game.user?.isGM) {
        ui.notifications?.warn("Nur der GM kann bereits bestätigte Käufe zurücknehmen.");
        return;
      }

      // Validate refund graph if specialization item found
      const specItem = this.actor.items.find(i => i.type === "specialization" && i.name.toLowerCase() === specName.toLowerCase());
      if (specItem && !isNaN(row) && !isNaN(col)) {
        const refundValid = TalentTreeUtils.validateRefund(specItem.name, specItem.system.talentRows, row, col, this.actor);
        if (!refundValid) {
          ui.notifications?.warn(`Talent "${name}" kann nicht erstattet werden, da andere gekaufte Talente davon abhängen!`);
          return;
        }
      }

      const confirmRefund = await foundry.applications.api.DialogV2.confirm({
        window: { title: "Talent erstatten" },
        content: `<p>Möchtest du <strong>${name}</strong> erstatten (+${cost} XP)?</p>`
      });
      if (!confirmRefund) return;

      // Find talent item by exact coordinate or key
      let talentItem = this.actor.items.find(t => 
        t.type === "talent" && 
        t.system?.key === key && 
        (!specName || t.system?.specialization === specName.toLowerCase()) && 
        (!isNaN(row) ? t.system?.row === row : true) && 
        (!isNaN(col) ? t.system?.col === col : true)
      );
      if (!talentItem) {
        talentItem = this.actor.items.find(t => t.type === "talent" && t.system?.key === key);
      }

      if (talentItem) {
        const result = await this.actor.refundTalent(talentItem.id, cost, name, {
          logDescription: `Erstattung von Talent "${name}" (+${cost} XP)`
        });
        if (result && !result.success) {
          ui.notifications?.warn(result.message);
        } else {
          if (result && result.message) ui.notifications?.info(result.message);
          this.render();
        }
      }
    } else {
      if (!isReachable && !isNaN(row) && row > 0) {
        ui.notifications?.warn(`Talent "${name}" ist noch nicht erreichbar! Kaufe zuerst ein angrenzendes verbundenes Talent.`);
        return;
      }

      if (availableXp < cost) {
        ui.notifications?.warn(`Nicht genug XP vorhanden, um "${name}" zu kaufen! (Kosten: ${cost} XP, Verfügbar: ${availableXp} XP)`);
        return;
      }

      const confirmBuy = await foundry.applications.api.DialogV2.confirm({
        window: { title: "Talent kaufen" },
        content: `<p>Möchtest du <strong>${name}</strong> für <strong>${cost} XP</strong> kaufen?</p>`
      });
      if (!confirmBuy) return;

      const result = await this.actor.buyTalent({
        name: name,
        key: key,
        activation: activation,
        description: description,
        specialization: specName.toLowerCase(),
        row: row,
        col: col
      }, cost, {
        logDescription: `Kauf von Talent "${name}" (-${cost} XP)`
      });
      
      if (result && !result.success) {
        ui.notifications?.warn(result.message);
      } else {
        if (result && result.message) ui.notifications?.info(result.message);
        this.render();
      }
    }
  }

  async _onRollSkill(event) {
    event.preventDefault();
    if (!this.editMode) {
      ui.notifications?.warn("Bitte zuerst den Bearbeitungsmodus aktivieren, um zu würfeln.");
      return;
    }
    const element = event.currentTarget;
    const rawSkill = element.dataset.name || element.dataset.skill || "";
    const skillName = normalizeSkillName(rawSkill);
    const charName = element.dataset.characteristic || getSkillCharacteristic(skillName);
    const rank = parseInt(element.dataset.rank || 0);
    const weaponName = element.dataset.weaponName || "";

    const charValue = this.actor.system.characteristics[charName]?.value || 0;
    
    // Assemble base green/yellow dice
    const greenCount = Math.abs(charValue - rank);
    const yellowCount = Math.min(charValue, rank);

    // Calculate boost and setback dice suggestions from talents
    let boostCount = 0;
    let setbackRemovalCount = 0;

    for (const item of this.actor.items) {
      if (item.type === "talent") {
        const system = item.system;
        const ranks = system.ranks || 1;

        // Check boost skills (normalized)
        const boostSkillsList = (system.boostSkills || "").split(",").map(s => normalizeSkillName(s.trim()).toLowerCase()).filter(s => s);
        if (boostSkillsList.includes(skillName.toLowerCase())) {
          boostCount += ranks;
        }

        // Check setback removal skills (normalized)
        const removeSkillsList = (system.setbackRemoveSkills || "").split(",").map(s => normalizeSkillName(s.trim()).toLowerCase()).filter(s => s);
        if (removeSkillsList.includes(skillName.toLowerCase())) {
          setbackRemovalCount += ranks;
        }

        // Check boost characteristics
        const boostCharsList = (system.boostCharacteristics || "").split(",").map(s => s.trim().toLowerCase()).filter(s => s);
        if (boostCharsList.includes(charName.toLowerCase())) {
          boostCount += ranks;
        }

        // Check setback removal characteristics
        const removeCharsList = (system.setbackRemoveCharacteristics || "").split(",").map(s => s.trim().toLowerCase()).filter(s => s);
        if (removeCharsList.includes(charName.toLowerCase())) {
          setbackRemovalCount += ranks;
        }
      }
    }

    // Open/set central dice roller pool
    if (game.starwarsFFG?.diceRoller) {
      game.starwarsFFG.diceRoller.setPool({
        ability: greenCount,
        proficiency: yellowCount,
        boost: boostCount,
        setbackRemoval: setbackRemovalCount
      });
      game.starwarsFFG.diceRoller.render(true);
    }
  }

  async _onRollCharacteristic(event) {
    event.preventDefault();
    if (!this.editMode) {
      ui.notifications?.warn("Bitte zuerst den Bearbeitungsmodus aktivieren, um zu würfeln.");
      return;
    }
    const element = event.currentTarget;
    const charName = element.dataset.characteristic;
    const charValue = this.actor.system.characteristics[charName]?.value || 0;

    // Calculate boost/setback removal for this characteristic from talents
    let boostCount = 0;
    let setbackRemovalCount = 0;

    for (const item of this.actor.items) {
      if (item.type === "talent") {
        const system = item.system;
        const ranks = system.ranks || 1;

        const boostCharsList = (system.boostCharacteristics || "").split(",").map(s => s.trim().toLowerCase());
        if (boostCharsList.includes(charName.toLowerCase())) {
          boostCount += ranks;
        }

        const removeCharsList = (system.setbackRemoveCharacteristics || "").split(",").map(s => s.trim().toLowerCase());
        if (removeCharsList.includes(charName.toLowerCase())) {
          setbackRemovalCount += ranks;
        }
      }
    }

    // Open/set central dice roller pool
    if (game.starwarsFFG.diceRoller) {
      game.starwarsFFG.diceRoller.setPool({
        ability: charValue,
        proficiency: 0,
        boost: boostCount,
        setbackRemoval: setbackRemovalCount
      });
    }
  }

  async _onSkillValChange(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.dataset.itemId;
    const value = parseInt(element.value || 0);

    if (itemId) {
      const item = this.actor.items.get(itemId);
      await item.update({ "system.value": value });
    } else {
      const skillName = element.dataset.name;
      const skillChar = element.dataset.characteristic;
      const skillCat = element.dataset.category;
      await this.actor.createEmbeddedDocuments("Item", [{
        name: skillName,
        type: "skill",
        system: { value: value, characteristic: skillChar, category: skillCat }
      }]);
    }
  }

  async _onCareerToggle(event) {
    const isGM = game.user?.isGM || false;
    const isSandbox = this.actor.system.creation?.sandboxMode || false;
    if (!isGM && !isSandbox) {
      ui.notifications?.warn("Nur der Spielleiter oder der Sandbox-Modus dürfen Karriere-Status manuell ändern!");
      return;
    }

    const element = event.currentTarget;
    const itemId = element.dataset.itemId;
    const isCareer = element.checked;

    if (itemId) {
      const item = this.actor.items.get(itemId);
      await item.update({ "system.career": isCareer });
    } else {
      const skillName = element.dataset.name;
      const skillChar = element.dataset.characteristic;
      const skillCat = element.dataset.category;
      await this.actor.createEmbeddedDocuments("Item", [{
        name: skillName,
        type: "skill",
        system: { career: isCareer, characteristic: skillChar, category: skillCat, value: 0 }
      }]);
    }
  }

  async _onResetXpLog(event) {
    event.preventDefault();
    if (!game.user.isGM) {
      ui.notifications.warn("Nur der Spielleiter darf das XP-Audit-Log zurücksetzen!");
      return;
    }

    const confirmReset = confirm("Möchtest du das gesamte XP-Audit-Log für diesen Charakter unwiderruflich löschen?");
    if (!confirmReset) return;

    await this.actor.update({ "system.xp.log": [] });
    ui.notifications.info("XP-Audit-Log erfolgreich zurückgesetzt.");
  }

  async _onAwardXp(event) {
    event.preventDefault();
    if (!game.user.isGM) {
      ui.notifications.warn("Nur der Spielleiter darf XP manuell vergeben oder abziehen!");
      return;
    }

    const htmlContent = `
      <div style="padding: 5px;">
        <div class="form-group" style="margin-bottom: 8px;">
          <label style="display: block; font-weight: bold; margin-bottom: 4px;">Aktion:</label>
          <select id="award-xp-mode" style="width: 100%; height: 26px; background: rgba(0,0,0,0.5); color: #fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px;">
            <option value="adjust">XP verändern (Zuweisung / Abzug)</option>
            <option value="set">XP absolut setzen (Neuer Festwert)</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 8px;">
          <label style="display: block; font-weight: bold; margin-bottom: 4px;">XP-Menge:</label>
          <input type="number" id="award-xp-amount" value="10" style="width: 100%;" />
        </div>
        <div class="form-group">
          <label style="display: block; font-weight: bold; margin-bottom: 4px;">Begründung / Notiz:</label>
          <input type="text" id="award-xp-reason" placeholder="z. B. Spielabend 4 Belohnung" style="width: 100%;" />
        </div>
      </div>
    `;

    const dialog = new foundry.applications.api.DialogV2({
      window: { title: "XP vergeben / abziehen" },
      content: htmlContent,
      buttons: [
        {
          action: "confirm",
          label: "Bestätigen",
          default: true,
          callback: async (event, button, dialogInstance) => {
            const html = $(dialogInstance.element);
            const mode = html.find("#award-xp-mode").val();
            const amount = parseInt(html.find("#award-xp-amount").val() || 0);
            const reason = html.find("#award-xp-reason").val().trim() || "Manuelle XP-Zuweisung";

            const isCreation = this.actor.system.creation?.isCreationMode === true;
            const dutyXp = this.actor.dutyXp || 0;
            const currentStarting = this.actor.system.creation?.startingXp || 0;
            const currentEarned = this.actor.system.xp?.earned || 0;
            const currentAvail = this.actor.system.xp.available || 0;
            const currentTotal = this.actor.system.xp.total || 0;
            const spent = currentTotal - currentAvail;

            if (mode === "set") {
              const updates = {
                "system.xp.available": Math.max(0, amount - spent),
                "system.xp.total": amount
              };
              if (isCreation) {
                updates["system.creation.startingXp"] = Math.max(0, amount - dutyXp);
              } else {
                updates["system.xp.earned"] = Math.max(0, amount - currentStarting - dutyXp);
              }
              await this.actor.update(updates, {
                xpLogDescription: `XP absolut gesetzt auf ${amount} (${reason})`
              });
              ui.notifications.info(`XP erfolgreich auf ${amount} gesetzt.`);
            } else {
              if (amount === 0) return;
              const updates = {
                "system.xp.available": Math.max(0, currentAvail + amount),
                "system.xp.total": Math.max(0, currentTotal + amount)
              };
              if (isCreation) {
                updates["system.creation.startingXp"] = Math.max(0, currentStarting + amount);
              } else {
                updates["system.xp.earned"] = Math.max(0, currentEarned + amount);
              }
              await this.actor.update(updates, {
                xpLogDescription: reason
              });
              ui.notifications.info(`${amount > 0 ? "Erfolgreich vergeben:" : "Erfolgreich abgezogen:"} ${Math.abs(amount)} XP.`);
            }
          }
        },
        {
          action: "cancel",
          label: "Abbrechen"
        }
      ]
    });
    dialog.render(true);
  }

  _onItemEdit(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    item.sheet.render({ force: true });
  }

  async _onItemDelete(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    
    if (item && item.type === "specialization") {
      const specName = item.name.toLowerCase();
      // Find all talents belonging to this specialization
      const talentsToDelete = this.actor.items.filter(t => 
        t.type === "talent" && 
        t.system?.specialization === specName
      );
      
      // Calculate XP to refund (cost = (row + 1) * 5)
      let refundXp = 0;
      const idsToDelete = [itemId];
      
      for (const talent of talentsToDelete) {
        const row = talent.system?.row ?? 0;
        const cost = (row + 1) * 5;
        refundXp += cost;
        idsToDelete.push(talent.id);
      }
      
      const currentXp = this.actor.system.xp.available || 0;
      const newXp = currentXp + refundXp;
      
      const remainingSpecs = this.actor.items.filter(i => i.type === "specialization" && i.id !== itemId);
      const careerName = this.actor.system.biography.career;
      
      // Perform atomic updates: add XP, delete documents, and recalculate career skills
      await this.actor.update(
        { "system.xp.available": newXp },
        { xpLogDescription: `Löschen der Spezialisierung "${item.name}" (+${refundXp} XP erstattet)` }
      );
      await this.actor.deleteEmbeddedDocuments("Item", idsToDelete);
      
      if (refundXp > 0) {
        ui.notifications.info(`Specialization "${item.name}" removed. Refunded ${refundXp} XP for ${talentsToDelete.length} purchased talents.`);
      } else {
        ui.notifications.info(`Specialization "${item.name}" removed.`);
      }
    } else {
      await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
    }
  }

  async _onItemCreate(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.type;
    const itemData = {
      name: `New ${type.capitalize()}`,
      type: type,
      system: {}
    };
    await this.actor.createEmbeddedDocuments("Item", [itemData]);
  }

  async _onItemEquip(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    await item.update({ "system.equipped": !item.system.equipped });
  }

  /** @override */
  async _onDrop(event) {
    if (!this.isEditable) return false;
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (!data) return false;

    const item = await Item.fromDropData(data);
    if (!item) return super._onDrop(event);
    const itemData = item.toObject();

    // Check lockFields to prevent species, career, specialization drop if locked
    const isCreation = this.document.system.creation?.isCreationMode !== false;
    const lockFields = !game.user.isGM && !isCreation;
    if (lockFields && ["species", "career", "specialization"].includes(itemData.type)) {
      ui.notifications.warn("Charaktererstellung ist gesperrt! Spezies, Karriere und Spezialisierungen können nicht mehr geändert werden.");
      return false;
    }

    // Check if dropping an attachment onto a weapon or armor item
    if (itemData.type === "attachment") {
      const targetItemEl = event.target.closest(".item");
      const targetItemId = targetItemEl ? targetItemEl.dataset.itemId : null;

      if (targetItemId) {
        const targetItem = this.actor.items.get(targetItemId);
        if (targetItem && (targetItem.type === "weapon" || targetItem.type === "armor")) {
          const requiredHP = itemData.system.hardpoints || 1;
          const remainingHP = targetItem.derived?.hardpointsRemaining ?? targetItem.system.hardpoints ?? 0;
          
          if (remainingHP < requiredHP) {
            ui.notifications.warn(`Nicht genügend Befestigungspunkte frei auf ${targetItem.name}! (Benötigt: ${requiredHP}, Frei: ${remainingHP})`);
            return false;
          }

          const attachments = Array.from(targetItem.system.attachments || []);
          attachments.push(itemData);
          
          await targetItem.update({ "system.attachments": attachments });
          ui.notifications.info(`Aufsatz "${itemData.name}" erfolgreich auf "${targetItem.name}" installiert.`);

          // If the attachment was already an item owned by this actor, delete it from top-level inventory
          if (item.actor && item.actor.id === this.actor.id) {
            await this.actor.deleteEmbeddedDocuments("Item", [item.id]);
          }
          return false;
        }
      }
    }

    if (itemData.type === "species") {
      const result = await this.actor.applySpecies(itemData);
      if (result && !result.success) ui.notifications?.warn(result.message);
      else if (result && result.message) ui.notifications?.info(result.message);
    } else if (itemData.type === "career") {
      const result = await this.actor.applyCareer(itemData);
      if (result && !result.success) ui.notifications?.warn(result.message);
      else if (result && result.message) ui.notifications?.info(result.message);
    } else if (itemData.type === "specialization") {
      const result = await this.actor.applySpecialization(itemData);
      if (result && !result.success) ui.notifications?.warn(result.message);
      else if (result && result.message) ui.notifications?.info(result.message);
    } else {
      await super._onDropItem(event, item);
    }
  }

  _onOpenCompendium(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.dropType;
    if (type === "species") {
      const pack = game.packs.get("starwars-ffg-scratch.species");
      if (pack) pack.render(true);
    } else if (type === "career") {
      const pack = game.packs.get("starwars-ffg-scratch.careers");
      if (pack) pack.render(true);
    } else if (type === "specialization") {
      const pack = game.packs.get("starwars-ffg-scratch.specializations");
      if (pack) pack.render(true);
    }
  }

  _onRemoveBio(event) {
    event.preventDefault();
    event.stopPropagation();
    const type = event.currentTarget.dataset.type;
    if (type === "species") this._onRemoveSpecies();
    else if (type === "career") this._onRemoveCareer();
  }

  async _onRemoveSpecHeader(event) {
    event.preventDefault();
    event.stopPropagation();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;

    const confirmRemove = confirm(`Do you want to remove the specialization ${item.name}? This will update your career skills.`);
    if (!confirmRemove) return;

    const isStartingSpec = this.actor.system.biography.specialization === item.name;
    const result = await this.actor.removeSpecialization(itemId, isStartingSpec);
    if (result && !result.success) {
      ui.notifications?.warn(result.message);
    } else {
      if (result && result.message) ui.notifications?.info(result.message);
      this.render();
    }
  }

  async _onRemoveSpecies() {
    const confirmRemove = confirm("Do you want to remove your Species? This will reset starting characteristics, thresholds, and starting skill bonuses back to default. It will also remove your Career and Specializations.");
    if (!confirmRemove) return;

    const result = await this.actor.removeSpecies();
    if (result && !result.success) {
      ui.notifications?.warn(result.message);
    } else {
      if (result && result.message) ui.notifications?.info(result.message);
      this.render();
    }
  }

  async _onRemoveCareer() {
    const confirmRemove = confirm("Do you want to remove your Career? This will also update your career skills and remove your starting Specialization.");
    if (!confirmRemove) return;

    const result = await this.actor.removeCareer();
    if (result && !result.success) {
      ui.notifications?.warn(result.message);
    } else {
      if (result && result.message) ui.notifications?.info(result.message);
      this.render();
    }
  }


}
