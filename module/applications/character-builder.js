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
    NARRATIVE: 6,
    XP_SPENDING: 7
  };

  constructor(options = {}) {
    super(options);
    this.actor = options.actor;
    if (!this.actor) throw new Error("CharacterBuilder requires an actor.");
    
    // Internal state
    this.currentStep = this.determineCurrentStep(this.actor);
    this.activeTab = "attributes"; // UI state: "attributes" | "skills" | "talents" | "specs"
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
      openTalentTree: CharacterBuilder.#onOpenTalentTree,
      talentCardClick: CharacterBuilder.#onTalentCardClick,
      buySpec: CharacterBuilder.#onBuySpec,
      switchTab: CharacterBuilder.#onSwitchTab
    }
  };

  static PARTS = {
    form: {
      template: "systems/starwars-ffg-scratch/templates/character-builder.hbs"
    }
  };

  static async #onOpenTalentTree(event, target) {
    const specName = this.actor.system.creation?.specializationSnapshot?.name;
    const specItem = specName 
      ? this.actor.items.find(i => i.type === "specialization" && i.name === specName)
      : this.actor.items.find(i => i.type === "specialization");

    if (specItem) {
      specItem.sheet.render(true);
    } else {
      ui.notifications.warn("Keine Spezialisierung auf dem Charakter vorhanden.");
    }
  }

  _preRender(context, options) {
    super._preRender(context, options);
    if (this.element) {
      const stepEl = this.element.querySelector(".builder-step");
      if (stepEl) this._savedStepScroll = stepEl.scrollTop;
      const skillsGrid = this.element.querySelector(".skills-grid");
      if (skillsGrid) this._savedSkillsGridScroll = skillsGrid.scrollTop;
      const selectList = this.element.querySelector(".selection-list");
      if (selectList) this._savedSelectListScroll = selectList.scrollTop;
    }
  }

  _onRender(context, options) {
    super._onRender(context, options);
    if (this.element) {
      if (this._savedStepScroll !== undefined) {
        const stepEl = this.element.querySelector(".builder-step");
        if (stepEl) stepEl.scrollTop = this._savedStepScroll;
      }
      if (this._savedSkillsGridScroll !== undefined) {
        const skillsGrid = this.element.querySelector(".skills-grid");
        if (skillsGrid) skillsGrid.scrollTop = this._savedSkillsGridScroll;
      }
      if (this._savedSelectListScroll !== undefined) {
        const selectList = this.element.querySelector(".selection-list");
        if (selectList) selectList.scrollTop = this._savedSelectListScroll;
      }
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
    else if (this.currentStep === CharacterBuilder.STEPS.NARRATIVE) {
      const careerName = (this.actor.system.biography?.career || "").toLowerCase();
      const aorCareers = ["ace", "commander", "diplomat", "engineer", "soldier", "spy"];
      const fadCareers = ["consular", "guardian", "mystic", "seeker", "sentinel", "warrior"];

      let autoType = "obligation";
      if (aorCareers.includes(careerName)) autoType = "duty";
      else if (fadCareers.includes(careerName)) autoType = "morality";

      const narrative = this.actor.system.narrative || {};
      const activeType = (narrative.activeType && narrative.activeType !== "auto") ? narrative.activeType : autoType;

      context.narrative = {
        activeType: activeType,
        isObligation: activeType === "obligation",
        isDuty: activeType === "duty",
        isMorality: activeType === "morality",
        obligation: narrative.obligation || { type: "Debt", magnitude: 10, details: "" },
        duty: narrative.duty || { type: "Combat Readiness", magnitude: 10, details: "" },
        morality: narrative.morality || { score: 50, strength: "Bravery", weakness: "Anger", conflict: 0 },
        obligationTypes: [
          "Addiction", "Betrayal", "Blackmail", "Bounty", "Criminal", "Debt", 
          "Duty Bound", "Family", "Favor", "For Honor", "Oath", "Obsession", 
          "Responsibility", "Score to Settle"
        ],
        dutyTypes: [
          "Combat Readiness", "Counter-Intelligence", "Intelligence", "Internal Security", 
          "Personnel", "Political Support", "Resource Acquisition", "Sabotage", 
          "Space Superiority", "Support", "Tech Procurement"
        ],
        moralityTraits: [
          { strength: "Bravery", weakness: "Anger", label: "Bravery / Anger" },
          { strength: "Compassion", weakness: "Hatred", label: "Compassion / Hatred" },
          { strength: "Curiosity", weakness: "Obsession", label: "Curiosity / Obsession" },
          { strength: "Discipline", weakness: "Obstinacy", label: "Discipline / Obstinacy" },
          { strength: "Enthusiasm", weakness: "Recklessness", label: "Enthusiasm / Recklessness" },
          { strength: "Independence", weakness: "Coldness", label: "Independence / Coldness" },
          { strength: "Justice", weakness: "Cruelty", label: "Justice / Cruelty" },
          { strength: "Love", weakness: "Jealousy", label: "Love / Jealousy" },
          { strength: "Pride", weakness: "Arrogance", label: "Pride / Arrogance" }
        ]
      };
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

      // 3. Talent Tree Grid & Specialization Object
      const specName = this.actor.system.creation?.specializationSnapshot?.name;
      const specItem = (specName ? this.actor.items.find(i => i.type === "specialization" && i.name.toLowerCase() === specName.toLowerCase()) : null)
        || this.actor.items.find(i => i.type === "specialization");
      if (specItem) {
        context.specialization = specItem.toObject();
        context.specialization.id = specItem.id;
        const talentPack = game.packs.get("starwars-ffg-scratch.talents");
        const talentsIndex = talentPack ? await talentPack.getIndex({ fields: ["system.description", "system.activation", "system.ranked", "system.key"] }) : [];
        
        let rows = specItem.system.talentRows;
        context.talentRows = TalentTreeUtils.buildGrid(specItem.name, rows, talentsIndex, this.actor);
      }

      // 4. Additional Specializations Tab
      if (this.cachedSpecializations.length === 0) {
        this.cachedSpecializations = await this.#fetchItemsByType("specialization");
      }
      const ownedSpecNames = this.actor.items.filter(i => i.type === "specialization").map(s => s.name.toLowerCase());
      context.ownedSpecializations = this.actor.items.filter(i => i.type === "specialization").map(s => ({
        id: s.id,
        name: s.name,
        careerSkills: s.system?.careerSkills || ""
      }));
      context.availableSpecializations = this.cachedSpecializations.filter(s => {
        return !ownedSpecNames.includes(s.name.toLowerCase());
      }).map(s => {
        const specObj = s.toObject ? s.toObject() : s;
        const cost = this.actor.calculateSpecializationCost(specObj);
        const canAfford = (this.actor.totalAvailableXp >= cost);
        return {
          uuid: s.uuid,
          name: s.name,
          career: s.system?.career || "",
          careerSkills: s.system?.careerSkills || "",
          isUniversal: s.system?.isUniversal || s.system?.classification === "universal",
          cost: cost,
          canAfford: canAfford
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
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
    if (!game.actors?.has(instance.actor?.id)) {
      ui.notifications.warn("Dieser Charakter existiert nicht mehr im System.");
      instance.close();
      return;
    }
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
        const result = await instance.actor.applySpecies(speciesData);
        const choiceResult = result?.success ? await instance.actor.setSpeciesSkillChoice(select.value) : null;
        if (!result?.success || !choiceResult?.success) {
          ui.notifications.warn(choiceResult?.message || result?.message || "Fehler beim Anwenden der Spezies.");
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
        const freeCareer = instance.actor.system.creation?.freeCareerSkills || [];
        const freeSpec = instance.actor.system.creation?.freeSpecializationSkills || [];
        if (freeCareer.length < 4 || freeSpec.length < 2) {
          throw new Error(`Bitte wähle 4 Karriere- und 2 Spezialisierungs-Fertigkeiten (aktuell: ${freeCareer.length}/4 Karriere, ${freeSpec.length}/2 Spezialisierung).`);
        }
        await instance._setStep(CharacterBuilder.STEPS.NARRATIVE);
      }
      else if (instance.currentStep === CharacterBuilder.STEPS.NARRATIVE) {
        const formEl = instance.element;
        const activeType = formEl.querySelector("select[name='narrativeType']")?.value || "obligation";
        const updates = {
          "system.narrative.activeType": activeType
        };
        if (activeType === "obligation") {
          updates["system.narrative.obligation.type"] = formEl.querySelector("select[name='obligationType']")?.value || "Debt";
          updates["system.narrative.obligation.magnitude"] = Number(formEl.querySelector("input[name='obligationMagnitude']")?.value) || 10;
          updates["system.narrative.obligation.details"] = formEl.querySelector("textarea[name='obligationDetails']")?.value || "";
        } else if (activeType === "duty") {
          updates["system.narrative.duty.type"] = formEl.querySelector("select[name='dutyType']")?.value || "Combat Readiness";
          updates["system.narrative.duty.magnitude"] = Number(formEl.querySelector("input[name='dutyMagnitude']")?.value) || 10;
          updates["system.narrative.duty.details"] = formEl.querySelector("textarea[name='dutyDetails']")?.value || "";
        } else if (activeType === "morality") {
          updates["system.narrative.morality.score"] = Number(formEl.querySelector("input[name='moralityScore']")?.value) || 50;
          const strengthWeakness = formEl.querySelector("select[name='moralityTrait']")?.value || "Bravery|Anger";
          const [str, wkn] = strengthWeakness.split("|");
          updates["system.narrative.morality.strength"] = str || "Bravery";
          updates["system.narrative.morality.weakness"] = wkn || "Anger";
        }
        await instance.actor.update(updates);
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
      CharacterBuilder.STEPS.NARRATIVE,
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
      else if (instance.currentStep === CharacterBuilder.STEPS.NARRATIVE) {
        await instance._setStep(CharacterBuilder.STEPS.FREE_SKILLS);
      }
      else if (instance.currentStep === CharacterBuilder.STEPS.XP_SPENDING) {
        await instance._setStep(CharacterBuilder.STEPS.NARRATIVE);
      }
    } catch (err) {
      ui.notifications.error(err.message);
    } finally {
      instance.isPending = false;
      instance.render();
    }
  }

  static async #onBuySpec(event, target) {
    const instance = this;
    const uuid = target.dataset.uuid;
    const specDoc = instance.cachedSpecializations.find(s => s.uuid === uuid);
    if (!specDoc) {
      ui.notifications.warn("Spezialisierungs-Dokument nicht gefunden.");
      return;
    }
    const result = await instance.actor.buyAdditionalSpecialization(specDoc.toObject());
    if (!result.success) {
      ui.notifications.warn(result.message);
    } else {
      ui.notifications.info(result.message);
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

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Charaktererstellung abschließen" },
      content: "<p>Möchtest du die Charaktererstellung wirklich abschließen?</p><p><strong>Hinweis:</strong> Danach ist der Charakterbogen gesperrt und Attribute sowie Start-Entscheidungen können nur noch durch den Spielleiter verändert oder erstattet werden.</p>",
      yes: { label: "Abschließen", icon: "fas fa-check" },
      no: { label: "Weiter bearbeiten", icon: "fas fa-times" }
    });
    if (!confirmed) return;

    instance.isPending = true;
    try {
      // Charakter offiziell und vollständig über lockCreation finalisieren
      // (überträgt Attribute aus dem Ledger in feste Werte, finalisiert Skills & XP-Log)
      const result = await instance.actor.lockCreation();
      if (result && !result.success) {
        ui.notifications?.warn(result.message);
        return;
      }
      
      await instance.actor.update({
        "system.creation.wizardStep": CharacterBuilder.STEPS.XP_SPENDING
      });
      console.info(`SWFFG | [CharacterBuilder] ${instance.actor.name}: Erstellung abgeschlossen — isCreationMode = false`);
      instance.close();
    } finally {
      instance.isPending = false;
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
