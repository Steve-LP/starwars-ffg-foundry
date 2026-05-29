import { rollFFGPool, sendRollToChat } from "./dice.js";

/**
 * Custom Actor Sheet for Star Wars FFG Ruleset
 */
export class SWFFGActorSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["starwars-ffg", "sheet", "actor"],
      template: "systems/starwars-ffg-scratch/templates/actors/character-sheet.html",
      width: 780,
      height: 700,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "skills" }]
    });
  }

  /** @override */
  getData() {
    const context = super.getData();
    const actorData = context.actor;

    // Set up default skills if they don't exist
    context.skills = this._prepareSkills();
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

    // Default dice pool builder HUD state
    context.dicePool = this.dicePool || {
      ability: 0,
      proficiency: 0,
      boost: 0,
      difficulty: 0,
      challenge: 0,
      setback: 0,
      force: 0
    };

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
      finalSkills[skill.name] = {
        name: skill.name,
        characteristic: skill.characteristic,
        category: skill.category,
        value: actorSkill?.system.value || 0,
        id: actorSkill?._id || null
      };
    }

    return finalSkills;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Roll click handlers
    html.find(".rollable-skill").click(this._onRollSkill.bind(this));
    html.find(".rollable-char").click(this._onRollCharacteristic.bind(this));

    // Item controls
    html.find(".item-edit").click(this._onItemEdit.bind(this));
    html.find(".item-delete").click(this._onItemDelete.bind(this));
    html.find(".item-create").click(this._onItemCreate.bind(this));
    html.find(".item-equip").click(this._onItemEquip.bind(this));

    // Custom Dice Pool Builder bindings
    html.find(".dice-pool-control").click(this._onDicePoolControl.bind(this));
    html.find(".roll-pool-button").click(this._onRollCustomPool.bind(this));
    html.find(".clear-pool-button").click(this._onClearCustomPool.bind(this));
  }

  async _onRollSkill(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const skillName = element.dataset.name;
    const charName = element.dataset.characteristic;
    const rank = parseInt(element.dataset.rank || 0);

    const charValue = this.actor.system.characteristics[charName]?.value || 0;
    
    // Assemble base green/yellow dice
    const greenCount = Math.abs(charValue - rank);
    const yellowCount = Math.min(charValue, rank);

    this.dicePool = this.dicePool || { ability: 0, proficiency: 0, boost: 0, difficulty: 0, challenge: 0, setback: 0, force: 0 };
    this.dicePool.ability = greenCount;
    this.dicePool.proficiency = yellowCount;

    this.render();
  }

  async _onRollCharacteristic(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const charName = element.dataset.characteristic;
    const charValue = this.actor.system.characteristics[charName]?.value || 0;

    this.dicePool = this.dicePool || { ability: 0, proficiency: 0, boost: 0, difficulty: 0, challenge: 0, setback: 0, force: 0 };
    this.dicePool.ability = charValue;
    this.dicePool.proficiency = 0;

    this.render();
  }

  _onDicePoolControl(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dieType = element.dataset.die;
    const action = element.dataset.action; // "add" or "sub"

    this.dicePool = this.dicePool || { ability: 0, proficiency: 0, boost: 0, difficulty: 0, challenge: 0, setback: 0, force: 0 };
    
    if (action === "add") {
      this.dicePool[dieType] = (this.dicePool[dieType] || 0) + 1;
    } else if (action === "sub") {
      this.dicePool[dieType] = Math.max(0, (this.dicePool[dieType] || 0) - 1);
    }

    this.render();
  }

  async _onRollCustomPool(event) {
    event.preventDefault();
    if (!this.dicePool) return;

    const result = rollFFGPool(this.dicePool);
    await sendRollToChat(this.actor, result, `${this.actor.name} rolls Dice Pool`);
    this._onClearCustomPool(event);
  }

  _onClearCustomPool(event) {
    event.preventDefault();
    this.dicePool = {
      ability: 0,
      proficiency: 0,
      boost: 0,
      difficulty: 0,
      challenge: 0,
      setback: 0,
      force: 0
    };
    this.render();
  }

  _onItemEdit(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    item.sheet.render(true);
  }

  async _onItemDelete(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
    this.render();
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
    this.render();
  }

  async _onItemEquip(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    await item.update({ "system.equipped": !item.system.equipped });
    this.render();
  }
}
