import { TalentTreeUtils } from "../utils/talent-tree.js";
import { CHOICE_SPECIES, normalizeSpeciesName } from "../actor-sheet.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CharacterBuilder extends HandlebarsApplicationMixin(ApplicationV2) {
  static STEPS = {
    SPECIES: 1,
    SPECIES_CHOICE: 2,
    CAREER: 3,
    SPECIALIZATION: 4,
    FREE_SKILLS: 5,
    XP_SPENDING: 6
  };

  constructor(options = {}) {
    super(options);
    this.actor = options.actor;
    if (!this.actor) throw new Error("CharacterBuilder requires an actor.");
    
    // Internal state
    this.currentStep = this.determineCurrentStep(this.actor);
    this.activeTab = "attributes"; // UI state: "attributes" | "skills" | "talents"
    this.isPending = false;
    
    this.cachedSpecies = [];
    this.cachedCareers = [];
    this.cachedSpecializations = [];
  }

  static DEFAULT_OPTIONS = {
    id: "character-builder",
    classes: ["swffg", "character-builder"],
    tag: "form",
    window: {
      title: "Charakter erstellen",
      icon: "fas fa-user-plus",
      resizable: true,
      width: 600,
      height: 700
    },
    position: {
      width: 600,
      height: 700
    },
    actions: {
      nextStep: CharacterBuilder.#onNextStep,
      prevStep: CharacterBuilder.#onPrevStep,
      finish: CharacterBuilder.#onFinish,
      increaseChar: CharacterBuilder.#onIncreaseChar,
      decreaseChar: CharacterBuilder.#onDecreaseChar,
      toggleCareerSkill: CharacterBuilder.#onToggleCareerSkill,
      toggleSpecSkill: CharacterBuilder.#onToggleSpecSkill,
      resetPurchases: CharacterBuilder.#onResetPurchases,
      increaseSkill: CharacterBuilder.#onIncreaseSkill,
      decreaseSkill: CharacterBuilder.#onDecreaseSkill,
      talentCardClick: CharacterBuilder.#onTalentCardClick,
      switchTab: CharacterBuilder.#onSwitchTab
    }
  };

  static PARTS = {
    form: {
      template: "systems/starwars-ffg-scratch/templates/character-builder.hbs"
    }
  };

  _onRender(context, options) {
    super._onRender(context, options);
    
    const html = $(this.element);
    if (this.currentStep === CharacterBuilder.STEPS.XP_SPENDING && this.activeTab === "talents") {
      this.setPosition({ width: 850 });
      // Delegate click to talent cards
      html.find(".talent-card").click((e) => {
        CharacterBuilder.#onTalentCardClick.call(this, e, e.currentTarget);
      });
    } else {
      this.setPosition({ width: 600 });
    }
  }

  determineCurrentStep(actor) {
    if (actor.system.creation?.wizardStep) {
      return Math.min(actor.system.creation.wizardStep, CharacterBuilder.STEPS.XP_SPENDING);
    }

    const hasSpecies = !!actor.system.creation?.speciesSnapshot;
    const hasCareer = !!actor.system.creation?.careerSnapshot;
    const hasSpec = !!actor.system.creation?.specializationSnapshot;

    if (!hasSpecies) return CharacterBuilder.STEPS.SPECIES;
    if (!hasCareer) return CharacterBuilder.STEPS.CAREER;
    if (!hasSpec) return CharacterBuilder.STEPS.SPECIALIZATION;
    
    return CharacterBuilder.STEPS.FREE_SKILLS;
  }

  async _setStep(newStep) {
    this.currentStep = newStep;
    await this.actor.update({ "system.creation.wizardStep": newStep });
  }

  async _prepareContext(options) {
    const context = {
      step: this.currentStep,
      activeTab: this.activeTab || "attributes",
      actor: this.actor,
      isPending: this.isPending,
      xp: this.actor.system.xp?.available || 0,
      stats: {
        brawn: this.actor.system.characteristics?.brawn?.value || 2,
        agility: this.actor.system.characteristics?.agility?.value || 2,
        intellect: this.actor.system.characteristics?.intellect?.value || 2,
        cunning: this.actor.system.characteristics?.cunning?.value || 2,
        willpower: this.actor.system.characteristics?.willpower?.value || 2,
        presence: this.actor.system.characteristics?.presence?.value || 2,
        wounds: this.actor.system.stats?.wounds?.base || 10,
        strain: this.actor.system.stats?.strain?.base || 10
      }
    };

    if (this.currentStep === CharacterBuilder.STEPS.SPECIES) {
      if (this.cachedSpecies.length === 0) {
        this.cachedSpecies = await this.#fetchItemsByType("species");
      }
      context.speciesList = this.cachedSpecies.map(s => ({ uuid: s.uuid, name: s.name }));
    } 
    else if (this.currentStep === CharacterBuilder.STEPS.SPECIES_CHOICE) {
      context.speciesChoices = this.pendingSpeciesChoices;
    }
    else if (this.currentStep === CharacterBuilder.STEPS.CAREER) {
      if (this.cachedCareers.length === 0) {
        this.cachedCareers = await this.#fetchItemsByType("career");
      }
      context.careersList = this.cachedCareers.map(c => ({ uuid: c.uuid, name: c.name }));
    }
    else if (this.currentStep === CharacterBuilder.STEPS.SPECIALIZATION) {
      if (this.cachedSpecializations.length === 0) {
        this.cachedSpecializations = await this.#fetchItemsByType("specialization");
      }
      
      const careerSnapshot = this.actor.system.creation?.careerSnapshot;
      let validKeys = [];
      if (careerSnapshot?.specializations && careerSnapshot.specializations.length > 0) {
        validKeys = careerSnapshot.specializations.map(k => k.toLowerCase().trim());
      }
      
      context.specsList = this.cachedSpecializations.filter(s => {
        if (validKeys.length === 0) return true;
        const key = (s.system.key || s.name).toLowerCase().trim();
        return validKeys.includes(key);
      }).map(s => ({ uuid: s.uuid, name: s.name }));
    }
    else if (this.currentStep === CharacterBuilder.STEPS.FREE_SKILLS) {
      const allSkills = this.actor.items.filter(i => i.type === "skill");
      
      const careerSkillsNames = (this.actor.system.creation?.careerSnapshot?.careerSkills || []).map(n => n.toLowerCase());
      context.careerSkills = allSkills
        .filter(s => careerSkillsNames.includes(s.name.toLowerCase()))
        .map(s => ({
          name: s.name,
          characteristic: s.system.characteristic,
          checked: (this.actor.system.creation?.freeCareerSkills || []).includes(s.name)
        }));
        
      const startingSpec = this.actor.system.biography?.specialization;
      let specSkillsNames = [];
      if (startingSpec) {
        const specItem = this.actor.items.find(i => i.type === "specialization" && i.name === startingSpec);
        if (specItem) specSkillsNames = (specItem.system.careerSkills || "").split(",").map(n => n.trim().toLowerCase()).filter(n => n);
      }
      context.specSkills = allSkills
        .filter(s => specSkillsNames.includes(s.name.toLowerCase()))
        .map(s => ({
          name: s.name,
          characteristic: s.system.characteristic,
          checked: (this.actor.system.creation?.freeSpecializationSkills || []).includes(s.name)
        }));
    }
    else if (this.currentStep === CharacterBuilder.STEPS.XP_SPENDING) {
      // 1. Characteristics
      context.characteristics = {
        brawn: { value: this.actor.system.characteristics.brawn.value, base: this.actor.system.creation.baseCharacteristics.brawn },
        agility: { value: this.actor.system.characteristics.agility.value, base: this.actor.system.creation.baseCharacteristics.agility },
        intellect: { value: this.actor.system.characteristics.intellect.value, base: this.actor.system.creation.baseCharacteristics.intellect },
        cunning: { value: this.actor.system.characteristics.cunning.value, base: this.actor.system.creation.baseCharacteristics.cunning },
        willpower: { value: this.actor.system.characteristics.willpower.value, base: this.actor.system.creation.baseCharacteristics.willpower },
        presence: { value: this.actor.system.characteristics.presence.value, base: this.actor.system.creation.baseCharacteristics.presence }
      };

      // 2. Skill Ranks
      const allSkills = this.actor.items.filter(i => i.type === "skill");
      context.allSkills = allSkills.map(s => {
        const details = this.actor.getSkillRankDetails(s.name);
        return {
          name: s.name,
          characteristic: s.system.characteristic,
          isCareer: details?.isCareer ?? this.actor.isCareerSkill(s.name),
          rank: details?.currentRank ?? s.system.rank,
          baseRank: details?.freeRanks ?? 0,
          currentUpgrades: details?.currentUpgrades ?? 0,
          nextCost: details?.nextCost,
          refundCost: details?.refundCost,
          isMax: details?.isMax ?? false
        };
      }).sort((a,b) => a.name.localeCompare(b.name));

      // 3. Talent Tree Grid
      const specName = this.actor.system.creation?.specializationSnapshot?.name;
      if (specName) {
        const specItem = this.actor.items.find(i => i.type === "specialization" && i.name === specName);
        if (specItem) {
          const talentPack = game.packs.get("starwars-ffg-scratch.talents");
          const talentsIndex = talentPack ? await talentPack.getIndex({ fields: ["system.description", "system.activation", "system.ranked", "system.key"] }) : [];
          
          let rows = specItem.system.talentRows;
          context.talentRows = TalentTreeUtils.buildGrid(specName, rows, talentsIndex, this.actor);
        }
      }
    }
    
    return context;
  }

  async #fetchItemsByType(type) {
    let items = [];
    items.push(...game.items.filter(i => i.type === type));
    for (const pack of game.packs.values()) {
      if (pack.documentName === "Item") {
        const index = await pack.getIndex({ fields: ["type", "system"] });
        if (index.some(i => i.type === type)) {
          const docs = await pack.getDocuments({ type });
          items.push(...docs);
        }
      }
    }
    console.log(`SWFFG | CharacterBuilder fetched ${items.length} items of type ${type}`);
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  static async #onNextStep(event, target) {
    const instance = this;
    if (instance.isPending) return;
    instance.isPending = true;
    instance.render();

    try {
      if (instance.currentStep === CharacterBuilder.STEPS.SPECIES) {
        const select = instance.element.querySelector("select[name='species']");
        if (!select || !select.value) throw new Error("Bitte eine Spezies wählen.");

        const speciesDoc = instance.cachedSpecies.find(s => s.uuid === select.value);
        if (!speciesDoc) throw new Error("Spezies-Daten nicht gefunden.");

        const normName = normalizeSpeciesName(speciesDoc.name);
        if (CHOICE_SPECIES[normName]) {
          instance.pendingSpeciesDoc = speciesDoc;
          instance.pendingSpeciesChoices = CHOICE_SPECIES[normName];
          await instance._setStep(CharacterBuilder.STEPS.SPECIES_CHOICE);
        } else {
          const result = await instance.actor.applySpecies(speciesDoc.toObject());
          if (!result?.success) {
            ui.notifications.warn(result?.message || "Fehler beim Anwenden der Spezies.");
          } else {
            await instance._setStep(CharacterBuilder.STEPS.CAREER);
          }
        }
      }
      else if (instance.currentStep === CharacterBuilder.STEPS.SPECIES_CHOICE) {
        const select = instance.element.querySelector("select[name='speciesChoice']");
        if (!select || !select.value) throw new Error("Bitte eine Bonus-Fertigkeit wählen.");

        const speciesData = instance.pendingSpeciesDoc.toObject();
        speciesData.system.modifiers = speciesData.system.modifiers || {};

        let currentSkills = speciesData.system.modifiers.skills || "";
        for (const choice of instance.pendingSpeciesChoices) {
          const regex = new RegExp(`(^|,)\\s*${choice}:\\d+\\s*(?=$|,)`, "gi");
          currentSkills = currentSkills.replace(regex, "");
        }
        currentSkills = currentSkills.replace(/^,/, "").replace(/,$/, "").trim();

        if (currentSkills) {
           speciesData.system.modifiers.skills = `${currentSkills}, ${select.value}:1`;
        } else {
           speciesData.system.modifiers.skills = `${select.value}:1`;
        }

        const result = await instance.actor.applySpecies(speciesData);
        if (!result?.success) {
          ui.notifications.warn(result?.message || "Fehler beim Anwenden der Spezies.");
        } else {
          await instance._setStep(CharacterBuilder.STEPS.CAREER);
          instance.pendingSpeciesDoc = null;
          instance.pendingSpeciesChoices = null;
        }
      }
      else if (instance.currentStep === CharacterBuilder.STEPS.CAREER) {
        const select = instance.element.querySelector("select[name='career']");
        if (!select || !select.value) throw new Error("Bitte eine Karriere wählen.");

        const careerDoc = instance.cachedCareers.find(s => s.uuid === select.value);
        if (!careerDoc) throw new Error("Karriere-Daten nicht gefunden.");

        const result = await instance.actor.applyCareer(careerDoc.toObject());
        if (!result?.success) {
          ui.notifications.warn(result?.message || "Fehler beim Anwenden der Karriere.");
        } else {
          await instance._setStep(CharacterBuilder.STEPS.SPECIALIZATION);
        }
      }
      else if (instance.currentStep === CharacterBuilder.STEPS.SPECIALIZATION) {
        const select = instance.element.querySelector("select[name='specialization']");
        if (!select || !select.value) throw new Error("Bitte eine Spezialisierung wählen.");
        
        const specDoc = instance.cachedSpecializations.find(s => s.uuid === select.value);
        if (!specDoc) throw new Error("Spezialisierungs-Daten nicht gefunden.");

        const result = await instance.actor.applySpecialization(specDoc.toObject());
        if (!result?.success) {
          ui.notifications.warn(result?.message || "Fehler beim Anwenden der Spezialisierung.");
        } else {
          await instance._setStep(CharacterBuilder.STEPS.FREE_SKILLS);
        }
      }
      else if (instance.currentStep === CharacterBuilder.STEPS.FREE_SKILLS) {
        await instance._setStep(CharacterBuilder.STEPS.XP_SPENDING);
      }
    } catch (err) {
      ui.notifications.error(err.message);
    } finally {
      instance.isPending = false;
      instance.render();
    }
  }

  static async #onPrevStep(event, target) {
    const instance = this;
    if (instance.isPending) return;
    
    const structuralSteps = [
      CharacterBuilder.STEPS.SPECIES,
      CharacterBuilder.STEPS.SPECIES_CHOICE,
      CharacterBuilder.STEPS.CAREER,
      CharacterBuilder.STEPS.SPECIALIZATION,
      CharacterBuilder.STEPS.FREE_SKILLS,
      CharacterBuilder.STEPS.XP_SPENDING
    ];
    if (structuralSteps.includes(instance.currentStep)) {
      if (instance.actor.hasCreationPurchases()) {
        ui.notifications.warn("Bitte setze erst alle XP-Käufe über den Reset-Button zurück, bevor du strukturelle Entscheidungen (Spezies/Karriere/Spezialisierung/Gratis-Skills) änderst!");
        return;
      }
    }
    
    instance.isPending = true;
    instance.render();

    try {
      if (instance.currentStep === CharacterBuilder.STEPS.SPECIES_CHOICE) {
        await instance._setStep(CharacterBuilder.STEPS.SPECIES);
        instance.pendingSpeciesDoc = null;
        instance.pendingSpeciesChoices = null;
      }
      else if (instance.currentStep === CharacterBuilder.STEPS.CAREER) {
        const result = await instance.actor.removeSpecies();
        if (!result?.success) ui.notifications.warn(result?.message || "Fehler beim Entfernen der Spezies.");
        else await instance._setStep(CharacterBuilder.STEPS.SPECIES);
      }
      else if (instance.currentStep === CharacterBuilder.STEPS.SPECIALIZATION) {
        const result = await instance.actor.removeCareer();
        if (!result?.success) ui.notifications.warn(result?.message || "Fehler beim Entfernen der Karriere.");
        else await instance._setStep(CharacterBuilder.STEPS.CAREER);
      }
      else if (instance.currentStep === CharacterBuilder.STEPS.FREE_SKILLS) {
        const startingSpecName = instance.actor.system.biography?.specialization;
        if (startingSpecName) {
          const startingSpecItem = instance.actor.items.find(i => i.type === "specialization" && i.name === startingSpecName);
          if (startingSpecItem) {
            const result = await instance.actor.removeSpecialization(startingSpecItem.id, true);
            if (!result?.success) ui.notifications.warn(result?.message || "Fehler beim Entfernen der Spezialisierung.");
            else await instance._setStep(CharacterBuilder.STEPS.SPECIALIZATION);
          } else {
            await instance._setStep(CharacterBuilder.STEPS.SPECIALIZATION);
          }
        } else {
          await instance._setStep(CharacterBuilder.STEPS.SPECIALIZATION);
        }
      }
      else if (instance.currentStep === CharacterBuilder.STEPS.XP_SPENDING) {
        await instance._setStep(CharacterBuilder.STEPS.FREE_SKILLS);
      }
    } catch (err) {
      ui.notifications.error(err.message);
    } finally {
      instance.isPending = false;
      instance.render();
    }
  }

  static async #onSwitchTab(event, target) {
    const instance = this;
    const tab = target.dataset.tab;
    if (tab && instance.activeTab !== tab) {
      instance.activeTab = tab;
      instance.render();
    }
  }

  static async #onFinish(event, target) {
    const instance = this;
    if (instance.isPending) return;

    instance.isPending = true;
    try {
      // Charakter offiziell aus dem Erstellungsmodus entlassen
      await instance.actor.update({
        "system.creation.isCreationMode": false,
        "system.creation.wizardStep": CharacterBuilder.STEPS.XP_SPENDING
      }, {
        xpLogDescription: "Charaktererstellung abgeschlossen"
      });
      console.info(`SWFFG | [CharacterBuilder] ${instance.actor.name}: Erstellung abgeschlossen — isCreationMode = false`);
    } finally {
      instance.isPending = false;
      instance.close();
    }
  }

  static async #onIncreaseChar(event, target) {
    const instance = this;
    const char = target.dataset.char;
    const result = await instance.actor.buyAttribute(char);
    if (!result.success) ui.notifications.warn(result.message);
    instance.render();
  }

  static async #onDecreaseChar(event, target) {
    const instance = this;
    const char = target.dataset.char;
    const result = await instance.actor.decreaseAttribute(char);
    if (!result.success) ui.notifications.warn(result.message);
    instance.render();
  }

  static async #onToggleCareerSkill(event, target) {
    const instance = this;
    if (instance.actor.hasCreationPurchases()) {
      ui.notifications.warn("Bitte setze erst alle XP-Käufe zurück, bevor du Gratis-Fertigkeiten änderst!");
      event.preventDefault();
      return;
    }
    const skillName = target.value;
    const isChecked = target.checked;
    const result = await instance.actor.toggleFreeCareerSkill(skillName, isChecked);
    if (result && result.success === false) {
      ui.notifications.warn(result.message);
    }
    instance.render();
  }

  static async #onToggleSpecSkill(event, target) {
    const instance = this;
    if (instance.actor.hasCreationPurchases()) {
      ui.notifications.warn("Bitte setze erst alle XP-Käufe zurück, bevor du Gratis-Fertigkeiten änderst!");
      event.preventDefault();
      return;
    }
    const skillName = target.value;
    const isChecked = target.checked;
    const result = await instance.actor.toggleFreeSpecializationSkill(skillName, isChecked);
    if (result && result.success === false) {
      ui.notifications.warn(result.message);
    }
    instance.render();
  }

  static async #onIncreaseSkill(event, target) {
    const instance = this;
    const skillName = target.dataset.skill;
    const result = await instance.actor.buySkillRank(skillName);
    if (!result.success) ui.notifications.warn(result.message);
    instance.render();
  }

  static async #onDecreaseSkill(event, target) {
    const instance = this;
    const skillName = target.dataset.skill;
    const result = await instance.actor.decreaseSkillRank(skillName);
    if (!result.success) ui.notifications.warn(result.message);
    instance.render();
  }

  static async #onTalentCardClick(event, target) {
    event.preventDefault();
    const instance = this;
    const card = target;
    const actor = instance.actor;
    
    const specName = actor.system.creation?.specializationSnapshot?.name;
    const specItem = actor.items.find(i => i.type === "specialization" && i.name === specName);
    if (!specItem) return;

    const key = card.dataset.key;
    const cost = parseInt(card.dataset.cost || 0);
    const name = card.dataset.name;
    const activation = card.dataset.activation;
    const description = card.dataset.description;
    const row = parseInt(card.dataset.row);
    const col = parseInt(card.dataset.col);

    const isPurchased = card.classList.contains("purchased");
    const isReachable = card.dataset.reachable === "true";

    if (isPurchased) {
      let rows = specItem.system.talentRows;
      const refundValid = TalentTreeUtils.validateRefund(specName, rows, row, col, actor);
      if (!refundValid) {
        ui.notifications.warn(`You cannot refund "${name}" because other purchased talents depend on it!`);
        return;
      }

      const confirmRefund = await foundry.applications.api.DialogV2.confirm({ window: { title: "Talent erstatten" }, content: `<p>Möchtest du <strong>${name}</strong> erstatten (+${cost} XP)?</p>` });
      if (!confirmRefund) return;

      let talentItem = actor.items.find(t => 
        t.type === "talent" && 
        t.system?.key === key && 
        t.system?.specialization === specName.toLowerCase() && 
        t.system?.row === row && 
        t.system?.col === col
      );

      if (!talentItem) {
        talentItem = actor.items.find(t => t.type === "talent" && t.system?.key === key);
      }

      if (talentItem) {
        const result = await actor.refundTalent(talentItem.id, cost, name, {
          logDescription: `Erstattung von Talent "${name}" (+${cost} XP)`
        });
        if (result && !result.success) ui.notifications.warn(result.message);
        else instance.render();
      }
    } else {
      if (!isReachable) {
        ui.notifications.warn(`You cannot purchase "${name}" yet! You must purchase an adjacent connected talent first.`);
        return;
      }

      const confirmBuy = await foundry.applications.api.DialogV2.confirm({ window: { title: "Talent kaufen" }, content: `<p>Möchtest du <strong>${name}</strong> für <strong>${cost} XP</strong> kaufen?</p>` });
      if (!confirmBuy) return;

      const result = await actor.buyTalent({
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
      
      if (result && !result.success) ui.notifications.warn(result.message);
      else instance.render();
    }
  }

  static async #onResetPurchases(event, target) {
    const instance = this;
    if (instance.isPending) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "XP-Käufe zurücksetzen" },
      content: "<p>Möchtest du wirklich alle getätigten XP-Ausgaben für Attribute, Fertigkeiten und Talente zurücksetzen?</p><p>Spezies, Karriere, Spezialisierung und Gratis-Fertigkeiten bleiben erhalten.</p>"
    });

    if (!confirmed) return;

    instance.isPending = true;
    instance.render();

    try {
      const result = await instance.actor.resetCreationPurchases();
      if (result.success) {
        ui.notifications.info(result.message);
      } else {
        ui.notifications.warn(result.message);
      }
    } catch (e) {
      ui.notifications.error(e.message);
    } finally {
      instance.isPending = false;
      instance.render();
    }
  }
}
