const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export const DEFAULT_SKILLS = [
  { name: "Astrogation", characteristic: "intellect", category: "General" },
  { name: "Athletics", characteristic: "brawn", category: "General" },
  { name: "Charm", characteristic: "presence", category: "General" },
  { name: "Coercion", characteristic: "willpower", category: "General" },
  { name: "Computers", characteristic: "intellect", category: "General" },
  { name: "Cool", characteristic: "presence", category: "General" },
  { name: "Coordination", characteristic: "agility", category: "General" },
  { name: "Core Worlds", characteristic: "intellect", category: "Knowledge" },
  { name: "Deception", characteristic: "cunning", category: "General" },
  { name: "Discipline", characteristic: "willpower", category: "General" },
  { name: "Education", characteristic: "intellect", category: "Knowledge" },
  { name: "Leadership", characteristic: "presence", category: "General" },
  { name: "Lore", characteristic: "intellect", category: "Knowledge" },
  { name: "Mechanics", characteristic: "intellect", category: "General" },
  { name: "Medicine", characteristic: "intellect", category: "General" },
  { name: "Negotiation", characteristic: "presence", category: "General" },
  { name: "Outer Rim", characteristic: "intellect", category: "Knowledge" },
  { name: "Perception", characteristic: "cunning", category: "General" },
  { name: "Piloting - Planetary", characteristic: "agility", category: "General" },
  { name: "Piloting - Space", characteristic: "agility", category: "General" },
  { name: "Resilience", characteristic: "brawn", category: "General" },
  { name: "Skulduggery", characteristic: "cunning", category: "General" },
  { name: "Stealth", characteristic: "agility", category: "General" },
  { name: "Streetwise", characteristic: "cunning", category: "General" },
  { name: "Survival", characteristic: "cunning", category: "General" },
  { name: "Underworld", characteristic: "intellect", category: "Knowledge" },
  { name: "Vigilance", characteristic: "willpower", category: "General" },
  { name: "Warfare", characteristic: "intellect", category: "Knowledge" },
  { name: "Xenology", characteristic: "intellect", category: "Knowledge" },
  // Combat Skills
  { name: "Brawl", characteristic: "brawn", category: "Combat" },
  { name: "Gunnery", characteristic: "agility", category: "Combat" },
  { name: "Lightsaber", characteristic: "brawn", category: "Combat" },
  { name: "Melee", characteristic: "brawn", category: "Combat" },
  { name: "Ranged - Light", characteristic: "agility", category: "Combat" },
  { name: "Ranged - Heavy", characteristic: "agility", category: "Combat" }
];

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
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/starwars-ffg-scratch/templates/actors/character-sheet.html",
      scrollable: [".sheet-body"]
    }
  };

  static TABS = {
    primary: {
      id: "primary",
      initial: "skills",
      tabs: [
        { id: "skills", label: "Skills" },
        { id: "talents", label: "Talents & Force" },
        { id: "inventory", label: "Inventory" },
        { id: "biography", label: "Biography" },
        { id: "xpLog", label: "XP Log" }
      ]
    }
  };

  tabGroups = {
    primary: "skills"
  };

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
        specObj.system.talentRows = rows.map(row => {
          const resolvedTalents = row.talents.map((talentKey, colIdx) => {
            const refTalent = talentsIndex.find(t => t.system?.key === talentKey);
            const isPurchased = this.actor.items.some(t => t.type === "talent" && t.system?.key === talentKey);
            
            return {
              key: talentKey,
              name: refTalent ? refTalent.name : talentKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
              description: refTalent ? refTalent.system.description : "No description available.",
              activation: refTalent ? refTalent.system.activation : "Passive",
              ranked: refTalent ? refTalent.system.ranked : false,
              purchased: isPurchased,
              directions: row.directions[colIdx] || { up: false, down: false, left: false, right: false }
            };
          });

          return {
            index: row.index,
            cost: row.cost,
            talents: resolvedTalents
          };
        });
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
      const isSandbox = this.actor.system.creation?.sandboxMode || false;
      const canUpgrade = !this.actor.system.creation?.isCreationMode || baseRank < 2;
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
      const canUpgrade = !this.actor.system.creation?.isCreationMode || baseRank < 2;
      const canAfford = isSandbox || (
        canUpgrade && (
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

    // Roll click handlers (Now routing to the central Dice Roller)
    html.find(".rollable-skill").click(this._onRollSkill.bind(this));
    html.find(".rollable-char").click(this._onRollCharacteristic.bind(this));

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

      // Talent tree purchase/refund handler
      html.find(".talent-card").click(this._onTalentCardClick.bind(this));

      // Biography removal handler
      html.find(".remove-bio").click(this._onRemoveBio.bind(this));

      // Specialization header removal handler
      html.find(".remove-spec-header").click(this._onRemoveSpecHeader.bind(this));

      // Character creation upgrade, decrease & locking handlers
      html.find(".upgrade-characteristic-btn").click(async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const charName = event.currentTarget.dataset.characteristic;
        if (charName) {
          await this.actor.buyAttribute(charName);
        }
      });

      html.find(".decrease-characteristic-btn").click(async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const charName = event.currentTarget.dataset.characteristic;
        if (charName) {
          await this.actor.decreaseAttribute(charName);
        }
      });

      html.find(".lock-creation-btn").click(async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await this.actor.lockCreation();
      });

      html.find(".toggle-sandbox-btn").click(async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await this.actor.toggleSandboxMode();
      });

      html.find(".reset-creation-btn").click(async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await this.actor.resetToCreationMode();
      });

      // Skill purchase and decrease handlers for character creation phase
      html.find(".upgrade-skill-btn").click(async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const skillName = event.currentTarget.dataset.name;
        const skillChar = event.currentTarget.dataset.characteristic;
        const skillCat = event.currentTarget.dataset.category;
        if (skillName) {
          await this.actor.buySkillRank(skillName, skillChar, skillCat);
        }
      });

      html.find(".decrease-skill-btn").click(async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const skillName = event.currentTarget.dataset.name;
        if (skillName) {
          await this.actor.decreaseSkillRank(skillName);
        }
      });

      html.find(".free-career-toggle").change(async (event) => {
        event.preventDefault();
        const skillName = event.currentTarget.dataset.name;
        const checked = event.currentTarget.checked;
        const currentArray = Array.from(this.actor.system.creation?.ledger?.freeCareerSkills || this.actor.system.creation?.freeCareerSkills || []);
        if (checked) {
          if (currentArray.length >= 4) {
            event.currentTarget.checked = false;
            ui.notifications?.warn("Du kannst maximal 4 freie Karriere-Fertigkeiten auswählen!");
            return;
          }
          if (!currentArray.includes(skillName)) {
            currentArray.push(skillName);
          }
        } else {
          const idx = currentArray.indexOf(skillName);
          if (idx > -1) currentArray.splice(idx, 1);
        }
        await this.actor.update({
          "system.creation.freeCareerSkills": currentArray,
          "system.creation.ledger.freeCareerSkills": currentArray
        });
      });

      html.find(".free-spec-toggle").change(async (event) => {
        event.preventDefault();
        const skillName = event.currentTarget.dataset.name;
        const checked = event.currentTarget.checked;
        const currentArray = Array.from(this.actor.system.creation?.ledger?.freeSpecializationSkills || this.actor.system.creation?.freeSpecializationSkills || []);
        if (checked) {
          if (currentArray.length >= 2) {
            event.currentTarget.checked = false;
            ui.notifications?.warn("Du kannst maximal 2 freie Spezialisierungs-Fertigkeiten auswählen!");
            return;
          }
          if (!currentArray.includes(skillName)) {
            currentArray.push(skillName);
          }
        } else {
          const idx = currentArray.indexOf(skillName);
          if (idx > -1) currentArray.splice(idx, 1);
        }
        await this.actor.update({
          "system.creation.freeSpecializationSkills": currentArray,
          "system.creation.ledger.freeSpecializationSkills": currentArray
        });
      });
    }
  }

  async _onTalentCardClick(event) {
    event.preventDefault();
    const card = event.currentTarget;
    const key = card.dataset.key;
    const cost = parseInt(card.dataset.cost || 0);
    const name = card.dataset.name;
    const activation = card.dataset.activation;
    const description = card.dataset.description;

    const isPurchased = card.classList.contains("purchased");
    const availableXp = this.actor.system.xp.available || 0;

    if (isPurchased) {
      // Refund talent
      const confirmRefund = confirm(`Do you want to refund ${name} and regain ${cost} XP?`);
      if (!confirmRefund) return;

      const talentItem = this.actor.items.find(t => t.type === "talent" && t.system?.key === key);
      if (talentItem) {
        await this.actor.deleteEmbeddedDocuments("Item", [talentItem.id]);
        const newAvailable = availableXp + cost;
        await this.actor.update({ "system.xp.available": newAvailable });
        ui.notifications.info(`Refunded ${name}. Regained ${cost} XP.`);
      }
    } else {
      // Purchase talent
      if (availableXp < cost) {
        ui.notifications.warn(`Not enough XP to purchase ${name}! (Cost: ${cost} XP, Available: ${availableXp} XP)`);
        return;
      }

      const confirmBuy = confirm(`Do you want to buy ${name} for ${cost} XP?`);
      if (!confirmBuy) return;

      // Deduct XP and add talent
      const newAvailable = availableXp - cost;
      await this.actor.update({ "system.xp.available": newAvailable });
      await this.actor.createEmbeddedDocuments("Item", [{
        name: name,
        type: "talent",
        img: "icons/svg/star-filled.svg",
        system: {
          key: key,
          activation: activation,
          description: description,
          tier: Math.ceil(cost / 5)
        }
      }]);
      ui.notifications.info(`Purchased ${name} for ${cost} XP.`);
    }
  }

  async _onRollSkill(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const skillName = element.dataset.name || "";
    const charName = element.dataset.characteristic;
    const rank = parseInt(element.dataset.rank || 0);

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

        // Check boost skills
        const boostSkillsList = (system.boostSkills || "").split(",").map(s => s.trim().toLowerCase());
        if (boostSkillsList.includes(skillName.toLowerCase())) {
          boostCount += ranks;
        }

        // Check setback removal skills
        const removeSkillsList = (system.setbackRemoveSkills || "").split(",").map(s => s.trim().toLowerCase());
        if (removeSkillsList.includes(skillName.toLowerCase())) {
          setbackRemovalCount += ranks;
        }

        // Check boost characteristics
        const boostCharsList = (system.boostCharacteristics || "").split(",").map(s => s.trim().toLowerCase());
        if (boostCharsList.includes(charName.toLowerCase())) {
          boostCount += ranks;
        }

        // Check setback removal characteristics
        const removeCharsList = (system.setbackRemoveCharacteristics || "").split(",").map(s => s.trim().toLowerCase());
        if (removeCharsList.includes(charName.toLowerCase())) {
          setbackRemovalCount += ranks;
        }
      }
    }

    // Open/set central dice roller pool
    if (game.starwarsFFG.diceRoller) {
      game.starwarsFFG.diceRoller.setPool({
        ability: greenCount,
        proficiency: yellowCount,
        boost: boostCount,
        setbackRemoval: setbackRemovalCount
      });
    }
  }

  async _onRollCharacteristic(event) {
    event.preventDefault();
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
      return this._onDropSpecies(itemData);
    }
    if (itemData.type === "career") {
      return this._onDropCareer(itemData);
    }
    if (itemData.type === "specialization") {
      return this._onDropSpecialization(itemData);
    }

    return super._onDrop(event);
  }

  async _onDropSpecies(speciesData) {
    const characteristics = speciesData.system.characteristics || {};
    
    const getVal = (charObj) => {
      if (!charObj) return 2;
      if (charObj.value !== undefined) return charObj.value;
      if (typeof charObj === "number") return charObj;
      return 2;
    };

    const br = getVal(characteristics.brawn);
    const ag = getVal(characteristics.agility);
    const it = getVal(characteristics.intellect);
    const cu = getVal(characteristics.cunning);
    const wl = getVal(characteristics.willpower);
    const pr = getVal(characteristics.presence);

    const woundsBase = speciesData.system.wounds?.base ?? (typeof speciesData.system.wounds === "number" ? speciesData.system.wounds : 10);
    const strainBase = speciesData.system.strain?.base ?? (typeof speciesData.system.strain === "number" ? speciesData.system.strain : 10);
    const xpTotal = speciesData.system.xp ?? 100;

    let specialAbilitiesText = speciesData.system.specialAbilities || "";
    let skillMods = speciesData.system.modifiers?.skills || "";

    if (speciesData.name.toLowerCase() === "twi'lek") {
      if (!skillMods.toLowerCase().includes("charm")) {
        skillMods = skillMods ? `${skillMods},Charm:1` : "Charm:1";
      }
      if (!specialAbilitiesText) {
        specialAbilitiesText = "Hitzeresistenz: Twi'leks entfernen ein Setback-Dice (Schwarzer Würfel) aus allen Proben aufgrund von heißer oder arider Umgebung.";
      }
    }

    // Check if species has starting skill choice
    const speciesNameNorm = normalizeSpeciesName(speciesData.name);
    const choiceOptions = CHOICE_SPECIES[speciesNameNorm];
    let chosenSkill = "";
    if (choiceOptions && choiceOptions.length > 0) {
      chosenSkill = await new Promise((resolve) => {
        const optionsHtml = choiceOptions.map(opt => {
          return `<option value="${opt}">${opt}</option>`;
        }).join("");

        const content = `
          <div style="padding: 10px;">
            <p style="margin-bottom: 12px;">Diese Spezies beginnt mit einem freien Rang in einer der folgenden Fertigkeiten. Bitte wählen Sie eine aus:</p>
            <div class="form-group">
              <label style="font-weight: bold; display: block; margin-bottom: 6px;">Fertigkeit:</label>
              <select id="species-skill-choice-select" style="width: 100%; height: 28px;">
                ${optionsHtml}
              </select>
            </div>
          </div>
        `;

        new foundry.applications.api.DialogV2({
          window: { title: `${speciesData.name} Fertigkeitsauswahl` },
          content: content,
          buttons: [
            {
              action: "confirm",
              label: "Bestätigen",
              default: true,
              callback: (event, button, dialogInstance) => {
                const html = $(dialogInstance.element);
                const selected = html.find("#species-skill-choice-select").val();
                resolve(selected);
              }
            }
          ],
          close: () => {
            resolve(choiceOptions[0]);
          }
        }).render(true);
      });
    }

    const speciesSnapshot = {
      name: speciesData.name,
      characteristics: { brawn: br, agility: ag, intellect: it, cunning: cu, willpower: wl, presence: pr },
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
      "system.creation.ledger.speciesSkillChoice": chosenSkill,
      "system.creation.startingXp": xpTotal,
      "system.creation.baseCharacteristics": {
        brawn: br, agility: ag, intellect: it, cunning: cu, willpower: wl, presence: pr
      },
      "system.xp.total": xpTotal,
      "system.xp.available": xpTotal
    };

    // Ensure skill items exist for the species starting skills, with value 0
    const itemsToCreate = [];
    const currentSkills = this.actor.items.filter(i => i.type === "skill");

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
    if (chosenSkill && !skillsToEnsure.includes(chosenSkill.toLowerCase())) {
      skillsToEnsure.push(chosenSkill.toLowerCase());
    }

    for (const sNameLower of skillsToEnsure) {
      const existing = currentSkills.find(s => s.name.toLowerCase() === sNameLower);
      if (!existing) {
        const defSkill = DEFAULT_SKILLS.find(s => s.name.toLowerCase() === sNameLower);
        if (defSkill) {
          itemsToCreate.push({
            name: defSkill.name,
            type: "skill",
            system: {
              value: 0,
              freeRanks: 0,
              characteristic: defSkill.characteristic,
              category: defSkill.category,
              career: false
            }
          });
        }
      }
    }

    if (itemsToCreate.length > 0) {
      await this.actor.createEmbeddedDocuments("Item", itemsToCreate);
    }

    return this.actor.update(updates);
  }

  async _onDropCareer(careerData) {
    const skillListStr = careerData.system.careerSkills || "";
    const careerSkills = skillListStr.split(",").map(s => s.trim().toLowerCase()).filter(s => s);

    const careerSnapshot = {
      name: careerData.name,
      careerSkills: careerSkills
    };

    const currentSkills = this.actor.items.filter(i => i.type === "skill");
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
      await this.actor.createEmbeddedDocuments("Item", itemsToCreate);
    }

    return this.actor.update({
      "system.biography.career": careerData.name,
      "system.creation.careerSnapshot": careerSnapshot,
      "system.creation.freeCareerSkills": [],
      "system.creation.ledger.freeCareerSkills": []
    });
  }

  async _onDropSpecialization(specData) {
    const skillListStr = specData.system.careerSkills || "";
    const careerSkills = skillListStr.split(",").map(s => s.trim().toLowerCase()).filter(s => s);

    const specSnapshot = {
      name: specData.name,
      careerSkills: careerSkills
    };

    const currentSkills = this.actor.items.filter(i => i.type === "skill");
    const itemsToCreate = [];

    // Create the specialization item on the actor if they do not have it
    const hasSpec = this.actor.items.some(i => i.type === "specialization" && i.name.toLowerCase() === specData.name.toLowerCase());
    if (!hasSpec) {
      if (!this.actor.canAffordSpecialization(specData)) {
        ui.notifications?.warn(`Nicht genug XP vorhanden, um die Spezialisierung "${specData.name}" zu erwerben!`);
        return;
      }
      itemsToCreate.push(specData);
    }

    // Ensure spec career skills exist on the actor
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
      await this.actor.createEmbeddedDocuments("Item", itemsToCreate);
    }

    const updates = { 
      "system.biography.specialization": specData.name,
      "system.creation.specializationSnapshot": specSnapshot,
      "system.creation.freeSpecializationSkills": [],
      "system.creation.ledger.freeSpecializationSkills": []
    };
    return this.actor.update(updates);
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
    const updates = {};
    if (isStartingSpec) {
      updates["system.biography.specialization"] = "";
      updates["system.creation.specializationSnapshot"] = null;
      updates["system.creation.freeSpecializationSkills"] = [];
      updates["system.creation.ledger.freeSpecializationSkills"] = [];
    }

    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
    if (Object.keys(updates).length > 0) {
      await this.actor.update(updates);
    }
    this.render();
  }

  async _onRemoveSpecies() {
    const confirmRemove = confirm("Do you want to remove your Species? This will reset starting characteristics, thresholds, and starting skill bonuses back to default.");
    if (!confirmRemove) return;

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
        brawn: 2,
        agility: 2,
        intellect: 2,
        cunning: 2,
        willpower: 2,
        presence: 2
      },
      "system.stats.wounds.base": 10,
      "system.stats.strain.base": 10,
      "system.stats.wounds.max": 10,
      "system.stats.strain.max": 10
    };

    await this.actor.update(updates);
    this.render();
  }

  async _onRemoveCareer() {
    const confirmRemove = confirm("Do you want to remove your Career? This will also update your career skills.");
    if (!confirmRemove) return;

    await this.actor.update({
      "system.biography.career": "",
      "system.creation.careerSnapshot": null,
      "system.creation.freeCareerSkills": [],
      "system.creation.ledger.freeCareerSkills": []
    });
    this.render();
  }


}
