/**
 * Custom Item Sheet for Star Wars FFG Ruleset using ItemSheetV2
 */
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class SWFFGItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  constructor(options={}) {
    // If this sheet is for a specialization, customize its window options for the talent tree
    if (options.document?.type === "specialization") {
      options.window = foundry.utils.mergeObject(options.window || {}, {
        resizable: true,
        title: `Specialization Tree: ${options.document.name}`
      });
      options.position = foundry.utils.mergeObject(options.position || {}, {
        width: 820,
        height: 680
      });
    }
    super(options);
  }

  static DEFAULT_OPTIONS = {
    classes: ["starwars-ffg", "sheet", "item"],
    position: {
      width: 520,
      height: 480
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/starwars-ffg-scratch/templates/items/item-sheet.html"
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.system = this.document.system;
    context.item = this.document;

    if (this.document.type === "specialization") {
      const actor = this.document.actor;
      context.isEmbedded = !!actor;
      context.availableXp = actor ? (actor.system.xp.available || 0) : 0;

      // Resolve Specialization Talent Tree
      const talentPack = game.packs.get("starwars-ffg-scratch.talents");
      const talentsIndex = talentPack ? await talentPack.getIndex({ fields: ["system.description", "system.activation", "system.ranked", "system.key"] }) : [];

      let rows = context.system.talentRows;
      console.log("SWFFG Item Sheet | talentRows raw data:", rows);
      if (typeof rows === "string") {
        try {
          rows = JSON.parse(rows);
        } catch (e) {
          rows = [];
        }
      }

      if (rows && Array.isArray(rows)) {
        console.log("SWFFG Item Sheet | talentRows resolved as array, length:", rows.length);
        context.talentRows = rows.map(row => {
          const resolvedTalents = row.talents.map((talentKey, colIdx) => {
            const refTalent = talentsIndex.find(t => t.system?.key === talentKey);
            const isPurchased = actor ? actor.items.some(t => t.type === "talent" && t.system?.key === talentKey) : false;

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
        console.warn("SWFFG Item Sheet | talentRows was empty or not an array!");
        context.talentRows = [];
      }
    }

    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const html = $(this.element);

    if (this.document.type === "specialization" && this.isEditable) {
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

    const isPurchased = card.classList.contains("purchased");
    const availableXp = actor.system.xp.available || 0;

    if (isPurchased) {
      // Refund talent
      const confirmRefund = confirm(`Do you want to refund ${name} and regain ${cost} XP?`);
      if (!confirmRefund) return;

      const talentItem = actor.items.find(t => t.type === "talent" && t.system?.key === key);
      if (talentItem) {
        await actor.deleteEmbeddedDocuments("Item", [talentItem.id]);
        const newAvailable = availableXp + cost;
        await actor.update({ "system.xp.available": newAvailable });
        ui.notifications.info(`Refunded ${name}. Regained ${cost} XP.`);
        this.render();
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
      await actor.update({ "system.xp.available": newAvailable });
      await actor.createEmbeddedDocuments("Item", [{
        name: name,
        type: "talent",
        img: "icons/svg/star.svg",
        system: {
          key: key,
          activation: activation,
          description: description,
          tier: Math.ceil(cost / 5)
        }
      }]);
      ui.notifications.info(`Purchased ${name} for ${cost} XP.`);
      this.render();
    }
  }
}
