/**
 * Custom Actor Sheet for Star Wars FFG Ruleset using ActorSheetV2
 */
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class SWFFGActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["starwars-ffg", "sheet", "actor"],
    position: {
      width: 780,
      height: 700
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
        { id: "biography", label: "Biography" }
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

    // Set up default skills if they don't exist
    context.skills = this._prepareSkills();
    console.log("SWFFG | Prepared context skills:", context.skills);
    context.tabs = this._prepareTabs("primary");
    context.weapons = [];
    context.armor = [];
    context.gear = [];
    context.talents = [];
    context.forcePowers = [];

    // Categorize items
    for (let item of actorData.items) {
      if (item.type === "weapon") context.weapons.push(item);
      else if (item.type === "armor") context.armor.push(item);
      else if (item.type === "gear") context.gear.push(item);
      else if (item.type === "talent") context.talents.push(item);
      else if (item.type === "forcePower") context.forcePowers.push(item);
    }

    // Resolve Specializations and their Talent Trees
    const specializations = this.actor.items.filter(i => i.type === "specialization");
    const talentPack = game.packs.get("starwars-ffg-scratch.talents");
    const talentsIndex = talentPack ? await talentPack.getIndex({ fields: ["system.description", "system.activation", "system.ranked", "system.key"] }) : [];

    context.specializations = specializations.map(spec => {
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
      } else {
        specObj.system.talentRows = [];
      }
      return specObj;
    });

    return context;
  }

  /**
   * Generates default Star Wars FFG skills list
   */
  _prepareSkills() {
    const currentSkills = this.actor.items.filter(i => i.type === "skill");
    
    // Default FFG list if none present
    const defaultList = [
      { name: "Astrogation", characteristic: "intellect", category: "General" },
      { name: "Athletics", characteristic: "brawn", category: "General" },
      { name: "Charm", characteristic: "presence", category: "General" },
      { name: "Coercion", characteristic: "willpower", category: "General" },
      { name: "Computers", characteristic: "intellect", category: "General" },
      { name: "Cool", characteristic: "presence", category: "General" },
      { name: "Coordination", characteristic: "agility", category: "General" },
      { name: "Deception", characteristic: "cunning", category: "General" },
      { name: "Discipline", characteristic: "willpower", category: "General" },
      { name: "Leadership", characteristic: "presence", category: "General" },
      { name: "Mechanics", characteristic: "intellect", category: "General" },
      { name: "Medicine", characteristic: "intellect", category: "General" },
      { name: "Negotiation", characteristic: "presence", category: "General" },
      { name: "Perception", characteristic: "cunning", category: "General" },
      { name: "Piloting (Planetary)", characteristic: "agility", category: "General" },
      { name: "Piloting (Space)", characteristic: "agility", category: "General" },
      { name: "Resilience", characteristic: "brawn", category: "General" },
      { name: "Skulduggery", characteristic: "cunning", category: "General" },
      { name: "Stealth", characteristic: "agility", category: "General" },
      { name: "Streetwise", characteristic: "cunning", category: "General" },
      { name: "Survival", characteristic: "cunning", category: "General" },
      { name: "Vigilance", characteristic: "willpower", category: "General" },
      // Combat Skills
      { name: "Brawl", characteristic: "brawn", category: "Combat" },
      { name: "Gunnery", characteristic: "agility", category: "Combat" },
      { name: "Melee", characteristic: "brawn", category: "Combat" },
      { name: "Ranged (Light)", characteristic: "agility", category: "Combat" },
      { name: "Ranged (Heavy)", characteristic: "agility", category: "Combat" }
    ];

    const finalSkills = {};
    for (const skill of defaultList) {
      // Find matching item in actor items (for rank values)
      const actorSkill = currentSkills.find(s => s.name.toLowerCase() === skill.name.toLowerCase());
      const value = Math.max(0, actorSkill?.system.value || 0);
      const characteristic = skill.characteristic;
      const charValue = Math.max(0, this.actor.system.characteristics[characteristic]?.value || 0);

      const greenCount = Math.max(0, Math.abs(charValue - value));
      const yellowCount = Math.max(0, Math.min(charValue, value));

      finalSkills[skill.name] = {
        name: skill.name,
        characteristic: skill.characteristic,
        category: skill.category,
        value: value,
        career: actorSkill?.system.career || false,
        id: actorSkill?._id || null,
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
    const charName = element.dataset.characteristic;
    const rank = parseInt(element.dataset.rank || 0);

    const charValue = this.actor.system.characteristics[charName]?.value || 0;
    
    // Assemble base green/yellow dice
    const greenCount = Math.abs(charValue - rank);
    const yellowCount = Math.min(charValue, rank);

    // Open/set central dice roller pool
    if (game.starwarsFFG.diceRoller) {
      game.starwarsFFG.diceRoller.setPool({
        ability: greenCount,
        proficiency: yellowCount
      });
    }
  }

  async _onRollCharacteristic(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const charName = element.dataset.characteristic;
    const charValue = this.actor.system.characteristics[charName]?.value || 0;

    // Open/set central dice roller pool
    if (game.starwarsFFG.diceRoller) {
      game.starwarsFFG.diceRoller.setPool({
        ability: charValue
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
      const remainingSpecs = this.actor.items.filter(i => i.type === "specialization" && i.id !== itemId);
      const careerName = this.actor.system.biography.career;
      await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
      await this._recalculateCareerSkills([], remainingSpecs, careerName);
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

    const updates = {
      "system.biography.species": speciesData.name,
      "system.characteristics.brawn.value": br,
      "system.characteristics.agility.value": ag,
      "system.characteristics.intellect.value": it,
      "system.characteristics.cunning.value": cu,
      "system.characteristics.willpower.value": wl,
      "system.characteristics.presence.value": pr,
      "system.stats.wounds.max": woundsBase + br,
      "system.stats.strain.max": strainBase + wl,
      "system.xp.total": xpTotal,
      "system.xp.available": xpTotal
    };

    return this.actor.update(updates);
  }

  async _onDropCareer(careerData) {
    const skillListStr = careerData.system.careerSkills || "";
    const careerSkills = skillListStr.split(",").map(s => s.trim().toLowerCase());

    const currentSkills = this.actor.items.filter(i => i.type === "skill");
    
    const defaultList = [
      { name: "Astrogation", characteristic: "intellect", category: "General" },
      { name: "Athletics", characteristic: "brawn", category: "General" },
      { name: "Charm", characteristic: "presence", category: "General" },
      { name: "Coercion", characteristic: "willpower", category: "General" },
      { name: "Computers", characteristic: "intellect", category: "General" },
      { name: "Cool", characteristic: "presence", category: "General" },
      { name: "Coordination", characteristic: "agility", category: "General" },
      { name: "Deception", characteristic: "cunning", category: "General" },
      { name: "Discipline", characteristic: "willpower", category: "General" },
      { name: "Leadership", characteristic: "presence", category: "General" },
      { name: "Mechanics", characteristic: "intellect", category: "General" },
      { name: "Medicine", characteristic: "intellect", category: "General" },
      { name: "Negotiation", characteristic: "presence", category: "General" },
      { name: "Perception", characteristic: "cunning", category: "General" },
      { name: "Piloting (Planetary)", characteristic: "agility", category: "General" },
      { name: "Piloting (Space)", characteristic: "agility", category: "General" },
      { name: "Resilience", characteristic: "brawn", category: "General" },
      { name: "Skulduggery", characteristic: "cunning", category: "General" },
      { name: "Stealth", characteristic: "agility", category: "General" },
      { name: "Streetwise", characteristic: "cunning", category: "General" },
      { name: "Survival", characteristic: "cunning", category: "General" },
      { name: "Vigilance", characteristic: "willpower", category: "General" },
      { name: "Brawl", characteristic: "brawn", category: "Combat" },
      { name: "Gunnery", characteristic: "agility", category: "Combat" },
      { name: "Melee", characteristic: "brawn", category: "Combat" },
      { name: "Ranged (Light)", characteristic: "agility", category: "Combat" },
      { name: "Ranged (Heavy)", characteristic: "agility", category: "Combat" }
    ];

    const itemsToCreate = [];
    const itemsToUpdate = [];

    for (const dSkill of defaultList) {
      const isCareerSkill = careerSkills.includes(dSkill.name.toLowerCase());
      const existing = currentSkills.find(s => s.name.toLowerCase() === dSkill.name.toLowerCase());

      if (existing) {
        itemsToUpdate.push({
          _id: existing.id,
          "system.career": isCareerSkill
        });
      } else {
        if (isCareerSkill) {
          itemsToCreate.push({
            name: dSkill.name,
            type: "skill",
            system: {
              value: 0,
              career: true,
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
    if (itemsToUpdate.length > 0) {
      await this.actor.updateEmbeddedDocuments("Item", itemsToUpdate);
    }

    return this.actor.update({ "system.biography.career": careerData.name });
  }

  async _onDropSpecialization(specData) {
    const skillListStr = specData.system.careerSkills || "";
    const careerSkills = skillListStr.split(",").map(s => s.trim().toLowerCase());

    const currentSkills = this.actor.items.filter(i => i.type === "skill");
    
    const defaultList = [
      { name: "Astrogation", characteristic: "intellect", category: "General" },
      { name: "Athletics", characteristic: "brawn", category: "General" },
      { name: "Charm", characteristic: "presence", category: "General" },
      { name: "Coercion", characteristic: "willpower", category: "General" },
      { name: "Computers", characteristic: "intellect", category: "General" },
      { name: "Cool", characteristic: "presence", category: "General" },
      { name: "Coordination", characteristic: "agility", category: "General" },
      { name: "Deception", characteristic: "cunning", category: "General" },
      { name: "Discipline", characteristic: "willpower", category: "General" },
      { name: "Leadership", characteristic: "presence", category: "General" },
      { name: "Mechanics", characteristic: "intellect", category: "General" },
      { name: "Medicine", characteristic: "intellect", category: "General" },
      { name: "Negotiation", characteristic: "presence", category: "General" },
      { name: "Perception", characteristic: "cunning", category: "General" },
      { name: "Piloting (Planetary)", characteristic: "agility", category: "General" },
      { name: "Piloting (Space)", characteristic: "agility", category: "General" },
      { name: "Resilience", characteristic: "brawn", category: "General" },
      { name: "Skulduggery", characteristic: "cunning", category: "General" },
      { name: "Stealth", characteristic: "agility", category: "General" },
      { name: "Streetwise", characteristic: "cunning", category: "General" },
      { name: "Survival", characteristic: "cunning", category: "General" },
      { name: "Vigilance", characteristic: "willpower", category: "General" },
      { name: "Brawl", characteristic: "brawn", category: "Combat" },
      { name: "Gunnery", characteristic: "agility", category: "Combat" },
      { name: "Melee", characteristic: "brawn", category: "Combat" },
      { name: "Ranged (Light)", characteristic: "agility", category: "Combat" },
      { name: "Ranged (Heavy)", characteristic: "agility", category: "Combat" }
    ];

    const itemsToCreate = [];
    const itemsToUpdate = [];

    // Create the specialization item on the actor if they do not have it
    const hasSpec = this.actor.items.some(i => i.type === "specialization" && i.name.toLowerCase() === specData.name.toLowerCase());
    if (!hasSpec) {
      itemsToCreate.push(specData);
    }

    for (const dSkill of defaultList) {
      const isCareerSkill = careerSkills.includes(dSkill.name.toLowerCase());
      if (!isCareerSkill) continue;

      const existing = currentSkills.find(s => s.name.toLowerCase() === dSkill.name.toLowerCase());

      if (existing) {
        if (!existing.system.career) {
          itemsToUpdate.push({
            _id: existing.id,
            "system.career": true
          });
        }
      } else {
        itemsToCreate.push({
          name: dSkill.name,
          type: "skill",
          system: {
            value: 0,
            career: true,
            characteristic: dSkill.characteristic,
            category: dSkill.category
          }
        });
      }
    }

    if (itemsToCreate.length > 0) {
      await this.actor.createEmbeddedDocuments("Item", itemsToCreate);
    }
    if (itemsToUpdate.length > 0) {
      await this.actor.updateEmbeddedDocuments("Item", itemsToUpdate);
    }

    return this.actor.update({ "system.biography.specialization": specData.name });
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

    const remainingSpecs = this.actor.items.filter(i => i.type === "specialization" && i.id !== itemId);
    const careerName = this.actor.system.biography.career;
    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
    await this._recalculateCareerSkills([], remainingSpecs, careerName);
    this.render();
  }

  async _onRemoveSpecies() {
    const confirmRemove = confirm("Do you want to remove your Species? This will reset starting characteristics and thresholds back to default.");
    if (!confirmRemove) return;

    const updates = {
      "system.biography.species": "",
      "system.characteristics.brawn.value": 1,
      "system.characteristics.agility.value": 1,
      "system.characteristics.intellect.value": 1,
      "system.characteristics.cunning.value": 1,
      "system.characteristics.willpower.value": 1,
      "system.characteristics.presence.value": 1,
      "system.stats.wounds.max": 10,
      "system.stats.strain.max": 10,
      "system.xp.total": 0,
      "system.xp.available": 0
    };

    await this.actor.update(updates);
    this.render();
  }

  async _onRemoveCareer() {
    const confirmRemove = confirm("Do you want to remove your Career? This will also update your career skills.");
    if (!confirmRemove) return;

    await this.actor.update({ "system.biography.career": "" });
    const remainingSpecs = this.actor.items.filter(i => i.type === "specialization");
    await this._recalculateCareerSkills([], remainingSpecs, "");
    this.render();
  }

  async _recalculateCareerSkills(removedSpecSkills = [], remainingSpecs = [], careerName = "") {
    const activeCareerSkills = new Set();
    
    for (const spec of remainingSpecs) {
      const skills = (spec.system?.careerSkills || "").split(",").map(s => s.trim().toLowerCase());
      for (const s of skills) {
        if (s) activeCareerSkills.add(s);
      }
    }

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

    const currentSkills = this.actor.items.filter(i => i.type === "skill");
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
      await this.actor.updateEmbeddedDocuments("Item", updates);
    }
  }
}
