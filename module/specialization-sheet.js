/**
 * Custom Specialization Sheet for Star Wars FFG Ruleset
 */
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
import { TalentTreeUtils } from "./utils/talent-tree.js";

export class SWFFGSpecializationSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  constructor(options={}) {
    super(options);
  }

  static DEFAULT_OPTIONS = {
    classes: ["starwars-ffg", "sheet", "specialization-sheet"],
    position: {
      width: 820,
      height: 780
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
      template: "systems/starwars-ffg-scratch/templates/items/specialization-sheet.html"
    }
  };

  /** @override */
  get title() {
    return `Specialization Tree: ${this.document.name}`;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.system = this.document.system;
    context.item = this.document;

    const actor = this.document.actor;
    context.isEmbedded = !!actor;
    context.availableXp = actor ? (actor.system.xp.available || 0) : 0;

    // Resolve Specialization Talent Tree
    const talentPack = game.packs.get("starwars-ffg-scratch.talents");
    const talentsIndex = talentPack ? await talentPack.getIndex({ fields: ["system.description", "system.activation", "system.ranked", "system.key"] }) : [];

    let rows = this.document.system.talentRows;
    console.log("SpecializationSheet | talentRows raw data:", rows);

    // Fallback: If rows is empty, try loading it from the compendium pack
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      console.log("SpecializationSheet | talentRows empty. Attempting fallback lookup in specializations compendium...");
      const specPack = game.packs.get("starwars-ffg-scratch.specializations");
      if (specPack) {
        const index = await specPack.getIndex();
        const match = index.find(s => s.name.toLowerCase() === this.document.name.toLowerCase());
        if (match) {
          const fullDoc = await specPack.getDocument(match._id);
          rows = fullDoc.system.talentRows;
          console.log("SpecializationSheet | Fallback successful! Loaded talentRows from compendium:", rows);
          // Asynchronously update without blocking the render context to avoid loop
          this.document.update({ "system.talentRows": rows });
        }
      }
    }

    if (typeof rows === "string") {
      try {
        rows = JSON.parse(rows);
      } catch (e) {
        rows = [];
      }
    }

    if (rows && Array.isArray(rows)) {
      context.talentRows = TalentTreeUtils.buildGrid(this.document.name, rows, talentsIndex, actor);
    } else {
      console.warn("SpecializationSheet | talentRows was empty or not an array!");
      context.talentRows = [];
    }

    console.log("SpecializationSheet | Prepared context talentRows:", context.talentRows);
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const html = $(this.element);

    if (this.isEditable) {
      html.find(".talent-card").click(this._onTalentCardClick.bind(this));
    }
  }

  async _onTalentCardClick(event) {
    event.preventDefault();
    const card = event.currentTarget;
    const actor = this.document.actor;
    if (!actor) {
      ui.notifications.warn("You can only buy or refund talents on a specialization item that has been dropped onto a character sheet!");
      return;
    }

    const key = card.dataset.key;
    const cost = parseInt(card.dataset.cost || 0);
    const name = card.dataset.name;
    const activation = card.dataset.activation;
    const description = card.dataset.description;
    const row = parseInt(card.dataset.row);
    const col = parseInt(card.dataset.col);

    const isPurchased = card.classList.contains("purchased");
    const isReachable = card.dataset.reachable === "true";
    const availableXp = actor.system.xp.available || 0;

    if (isPurchased) {
      // Path validation for refund
      const refundValid = this._validateRefund(row, col);
      if (!refundValid) {
        ui.notifications.warn(`You cannot refund "${name}" because other purchased talents depend on it!`);
        return;
      }

      const confirmRefund = await foundry.applications.api.DialogV2.confirm({
        window: { title: "Talent erstatten" },
        content: `<p>Möchtest du <strong>${name}</strong> erstatten (+${cost} XP)?</p>`
      });
      if (!confirmRefund) return;

      // Find exact coordinate matched item first, or fall back to key match
      let talentItem = actor.items.find(t => 
        t.type === "talent" && 
        t.system?.key === key && 
        t.system?.specialization === this.document.name.toLowerCase() && 
        t.system?.row === row && 
        t.system?.col === col
      );

      if (!talentItem) {
        // Fallback for legacy items
        talentItem = actor.items.find(t => t.type === "talent" && t.system?.key === key);
      }

      if (talentItem) {
        const result = await actor.refundTalent(talentItem.id, cost, name, {
          logDescription: `Erstattung von Talent "${name}" (+${cost} XP) aus ${this.document.name}`
        });
        if (result && !result.success) {
          ui.notifications?.warn(result.message);
        } else {
          if (result && result.message) ui.notifications?.info(result.message);
          this.render();
        }
      }
    } else {
      // Path validation
      if (!isReachable) {
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

      const result = await actor.buyTalent({
        name: name,
        key: key,
        activation: activation,
        description: description,
        specialization: this.document.name.toLowerCase(),
        row: row,
        col: col
      }, cost, {
        logDescription: `Kauf von Talent "${name}" (-${cost} XP) aus ${this.document.name}`
      });
      
      if (result && !result.success) {
        ui.notifications?.warn(result.message);
      } else {
        if (result && result.message) ui.notifications?.info(result.message);
        this.render();
      }
    }
  }

  /**
   * Validates if a talent can be safely refunded without breaking path reachability
   * to other purchased talents in this tree.
   * @param {number} targetRow - Row of the talent to simulate refunding
   * @param {number} targetCol - Column of the talent to simulate refunding
   * @returns {boolean} - True if it is safe to refund, false if it breaks the path
   */
  _validateRefund(targetRow, targetCol) {
    const actor = this.document.actor;
    return TalentTreeUtils.validateRefund(this.document.name, this.document.system.talentRows, targetRow, targetCol, actor);
  }
}
