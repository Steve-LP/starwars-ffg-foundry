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

    new Dialog({
      title: "XP vergeben / abziehen",
      content: htmlContent,
      buttons: {
        confirm: {
          icon: '<i class="fas fa-check"></i>',
          label: "Bestätigen",
          callback: async (html) => {
            const mode = html.find("#award-xp-mode").val();
            const amount = parseInt(html.find("#award-xp-amount").val() || 0);
            const reason = html.find("#award-xp-reason").val().trim() || "Manuelle XP-Zuweisung";

            const currentAvail = this.actor.system.xp.available || 0;
            const currentTotal = this.actor.system.xp.total || 0;

            if (mode === "set") {
              await this.actor.update({
                "system.xp.available": amount,
                "system.xp.total": amount
              }, {
                xpLogDescription: `XP absolut gesetzt auf ${amount} (${reason})`
              });
              ui.notifications.info(`XP erfolgreich auf ${amount} gesetzt.`);
            } else {
              if (amount === 0) return;
              await this.actor.update({
                "system.xp.available": Math.max(0, currentAvail + amount),
                "system.xp.total": Math.max(0, currentTotal + amount)
              }, {
                xpLogDescription: reason
              });
              ui.notifications.info(`${amount > 0 ? "Erfolgreich vergeben:" : "Erfolgreich abgezogen:"} ${Math.abs(amount)} XP.`);
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Abbrechen"
        }
      },
      default: "confirm"
    }).render(true);
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
      "system.stats.wounds.base": woundsBase + br,
      "system.stats.strain.base": strainBase + wl,
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
    this.render();
  }


}
