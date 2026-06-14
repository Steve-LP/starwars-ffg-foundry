/**
 * Custom Specialization Sheet for Star Wars FFG Ruleset
 */
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

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
      const encounteredKeys = {};
      
      // Pass 1: Resolve all talents and their purchased state
      const talentGrid = rows.map((row, rIdx) => {
        return row.talents.map((talentKey, colIdx) => {
          const refTalent = talentsIndex.find(t => t.system?.key === talentKey);
          
          // Track occurrences of keys for legacy fallback
          encounteredKeys[talentKey] = (encounteredKeys[talentKey] || 0) + 1;
          const occurrenceIndex = encounteredKeys[talentKey];

          // 1. Check for exact node match (specialization name, row, col)
          let isPurchased = actor ? actor.items.some(t => 
            t.type === "talent" && 
            t.system?.key === talentKey && 
            t.system?.specialization === this.document.name.toLowerCase() && 
            t.system?.row === rIdx && 
            t.system?.col === colIdx
          ) : false;

          // 2. Legacy Fallback (for older talent items that don't have row/col metadata)
          if (!isPurchased && actor) {
            const totalOwned = actor.items.filter(t => t.type === "talent" && t.system?.key === talentKey).length;
            // Subtract any talents that are already explicitly mapped to other specific cells
            const mappedToOthers = actor.items.filter(t => 
              t.type === "talent" && 
              t.system?.key === talentKey && 
              t.system?.specialization === this.document.name.toLowerCase() && 
              (t.system?.row !== rIdx || t.system?.col !== colIdx)
            ).length;

            isPurchased = (totalOwned - mappedToOthers) >= 1;
          }

          return {
            key: talentKey,
            name: refTalent ? refTalent.name : talentKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
            description: refTalent ? refTalent.system.description : "No description available.",
            activation: refTalent ? refTalent.system.activation : "Passive",
            ranked: refTalent ? refTalent.system.ranked : false,
            purchased: isPurchased,
            directions: row.directions[colIdx] || { up: false, down: false, left: false, right: false },
            row: rIdx,
            col: colIdx
          };
        });
      });

      // Pass 2: Calculate reachability for each cell in the 2D grid using BFS propagation
      // Initialize all to unreachable except row 0 which is always reachable
      for (let r = 0; r < talentGrid.length; r++) {
        for (let c = 0; c < talentGrid[r].length; c++) {
          talentGrid[r][c].reachable = (r === 0);
        }
      }

      const queue = [];
      const visited = new Set();
      const keyOf = (r, c) => `${r},${c}`;

      // Start the BFS with all Row 0 nodes
      if (talentGrid.length > 0) {
        for (let c = 0; c < talentGrid[0].length; c++) {
          queue.push({ r: 0, c: c });
        }
      }

      while (queue.length > 0) {
        const { r, c } = queue.shift();
        const key = keyOf(r, c);
        if (visited.has(key)) continue;
        visited.add(key);

        const cell = talentGrid[r][c];
        cell.reachable = true;

        // If this cell is purchased, propagate reachability to connected neighbors
        if (cell.purchased) {
          const neighbors = [
            { dr: -1, dc: 0, dirSelf: "up", dirOther: "down" },
            { dr: 1, dc: 0, dirSelf: "down", dirOther: "up" },
            { dr: 0, dc: -1, dirSelf: "left", dirOther: "right" },
            { dr: 0, dc: 1, dirSelf: "right", dirOther: "left" }
          ];

          for (const { dr, dc, dirSelf, dirOther } of neighbors) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < talentGrid.length && nc >= 0 && nc < talentGrid[nr].length) {
              const neighbor = talentGrid[nr][nc];
              if (cell.directions[dirSelf] && neighbor.directions[dirOther]) {
                const neighborKey = keyOf(nr, nc);
                if (!visited.has(neighborKey)) {
                  queue.push({ r: nr, c: nc });
                }
              }
            }
          }
        }
      }

      context.talentRows = rows.map((row, rIdx) => {
        return {
          index: row.index,
          cost: row.cost,
          talents: talentGrid[rIdx]
        };
      });
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
      // Refund talent
      const confirmRefund = confirm(`Do you want to refund ${name} and regain ${cost} XP?`);
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
        await actor.deleteEmbeddedDocuments("Item", [talentItem.id]);
        const newAvailable = availableXp + cost;
        await actor.update({ "system.xp.available": newAvailable });
        ui.notifications.info(`Refunded ${name}. Regained ${cost} XP.`);
        this.render();
      }
    } else {
      // Path validation
      if (!isReachable) {
        ui.notifications.warn(`You cannot purchase "${name}" yet! You must purchase an adjacent connected talent first.`);
        return;
      }

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
          tier: Math.ceil(cost / 5),
          specialization: this.document.name.toLowerCase(),
          row: row,
          col: col
        }
      }]);
      ui.notifications.info(`Purchased ${name} for ${cost} XP.`);
      this.render();
    }
  }
}
