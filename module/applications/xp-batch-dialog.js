import { SWFFGActor } from "../actor.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM-only dialog to grant XP to multiple characters in a single batch operation.
 * Each character can receive a per-row override amount; otherwise the global default applies.
 *
 * Usage:
 *   new XpBatchDialog().render({ force: true });
 */
export class XpBatchDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  constructor(options = {}) {
    super(options);
    /** @type {Map<string, boolean>} actorId → selected */
    this._selected = new Map();
    /** @type {Map<string, string>} actorId → override input string */
    this._overrides = new Map();
    this._defaultAmount = "";
  }

  static DEFAULT_OPTIONS = {
    id: "xp-batch-dialog",
    classes: ["swffg", "xp-batch-dialog"],
    tag: "form",
    window: {
      title: "Session-XP vergeben",
      icon: "fas fa-star",
      resizable: false,
      width: 480
    },
    actions: {
      toggleCharacter: XpBatchDialog.#onToggleCharacter,
      apply: XpBatchDialog.#onApply
    }
  };

  static PARTS = {
    form: {
      template: "systems/starwars-ffg-scratch/templates/dialogs/xp-batch.hbs",
      scrollable: [".xp-batch-char-list"]
    }
  };

  // ─── Context ────────────────────────────────────────────────────────────────

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Build online-user lookup: userId → active
    const activeOwnerIds = new Set(
      game.users.filter(u => u.active && !u.isGM).map(u => u.id)
    );

    // Collect all player characters (not in creation mode)
    const allChars = game.actors
      .filter(a => a.type === "character")
      .sort((a, b) => a.name.localeCompare(b.name, "de"));

    const characters = allChars.map(actor => {
      // Find the non-GM owner of this actor
      const ownerEntry = Object.entries(actor.ownership || {}).find(([userId, level]) => {
        if (userId === "default") return false;
        const user = game.users.get(userId);
        return user && !user.isGM && level >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
      });

      const ownerId = ownerEntry?.[0] ?? null;
      const ownerUser = ownerId ? game.users.get(ownerId) : null;
      const ownerName = ownerUser?.name ?? "—";
      const isOnline = ownerId ? activeOwnerIds.has(ownerId) : false;
      const inCreation = actor.system.creation?.isCreationMode === true;

      // Default selection: online owner present and not in creation mode
      if (!this._selected.has(actor.id)) {
        this._selected.set(actor.id, isOnline && !inCreation);
      }

      return {
        id: actor.id,
        name: actor.name,
        img: actor.img,
        ownerName,
        isOnline,
        inCreation,
        selected: this._selected.get(actor.id),
        override: this._overrides.get(actor.id) ?? ""
      };
    });

    context.characters = characters;
    context.defaultAmount = this._defaultAmount;
    return context;
  }

  // ─── Actions ────────────────────────────────────────────────────────────────

  static #onToggleCharacter(event, target) {
    const actorId = target.closest("[data-actor-id]").dataset.actorId;
    const current = this._selected.get(actorId) ?? false;
    this._selected.set(actorId, !current);
    this.render();
  }

  static async #onApply(event, target) {
    if (!game.user?.isGM) return;

    // Read current values from DOM before applying
    const form = this.element;
    const defaultRaw = form.querySelector("#xp-batch-default")?.value.trim() ?? "";
    const defaultAmount = defaultRaw === "" ? null : parseInt(defaultRaw, 10);

    // Validate default
    if (defaultAmount !== null && (!Number.isInteger(defaultAmount) || defaultAmount <= 0)) {
      ui.notifications.warn("Standard-XP muss eine positive Ganzzahl sein.");
      return;
    }

    const results = [];
    const errors = [];

    // Collect rows
    const rows = form.querySelectorAll(".xp-batch-row[data-actor-id]");
    for (const row of rows) {
      const actorId = row.dataset.actorId;
      const checkbox = row.querySelector(".xp-batch-checkbox");
      if (!checkbox?.checked) continue;

      const overrideInput = row.querySelector(".xp-batch-override");
      const overrideRaw = overrideInput?.value.trim() ?? "";
      let amount;

      if (overrideRaw !== "") {
        amount = parseInt(overrideRaw, 10);
        if (!Number.isInteger(amount) || amount <= 0) {
          errors.push(`${row.dataset.actorName ?? actorId}: Ungültiger Override-Betrag „${overrideRaw}".`);
          continue;
        }
      } else if (defaultAmount !== null) {
        amount = defaultAmount;
      } else {
        errors.push(`${row.dataset.actorName ?? actorId}: Kein XP-Betrag angegeben.`);
        continue;
      }

      const actor = game.actors.get(actorId);
      if (!actor) {
        errors.push(`${row.dataset.actorName ?? actorId}: Actor nicht mehr vorhanden.`);
        continue;
      }

      const result = await actor.grantXp(amount);
      if (result.success) {
        const isOverride = overrideRaw !== "";
        results.push({ name: actor.name, amount, override: isOverride });
      } else {
        errors.push(`${actor.name}: ${result.message}`);
      }
    }

    if (results.length === 0 && errors.length === 0) {
      ui.notifications.warn("Keine Charaktere ausgewählt oder kein Betrag angegeben.");
      return;
    }

    // Build summary
    this.close();
    XpBatchDialog._showSummary(results, errors);
  }

  // ─── Summary ────────────────────────────────────────────────────────────────

  static _showSummary(results, errors) {
    const successLines = results.map(r =>
      `<li><strong>${r.name}</strong>: +${r.amount} XP${r.override ? " <em>(Override)</em>" : ""}</li>`
    ).join("");

    const errorLines = errors.map(e =>
      `<li class="xp-batch-error">${e}</li>`
    ).join("");

    const content = `
      <p>${results.length} Charakter${results.length !== 1 ? "e" : ""} erhielten XP:</p>
      <ul class="xp-batch-summary-list">${successLines}</ul>
      ${errors.length > 0 ? `<p class="xp-batch-error-heading">Fehler (${errors.length}):</p><ul class="xp-batch-summary-list">${errorLines}</ul>` : ""}
    `;

    foundry.applications.api.DialogV2.alert({
      window: { title: "XP-Vergabe abgeschlossen" },
      content,
      ok: { label: "Schließen" }
    });
  }

  // ─── Override state tracking from form inputs ───────────────────────────────

  _onRender(context, options) {
    super._onRender(context, options);

    const form = this.element;

    // Track default amount
    const defaultInput = form.querySelector("#xp-batch-default");
    if (defaultInput) {
      defaultInput.addEventListener("input", () => {
        this._defaultAmount = defaultInput.value;
      });
    }

    // Track overrides
    form.querySelectorAll(".xp-batch-override[data-actor-id]").forEach(input => {
      input.addEventListener("input", () => {
        this._overrides.set(input.dataset.actorId, input.value);
      });
    });

    // Restore scroll position
    const list = form.querySelector(".xp-batch-char-list");
    if (list && this._scrollTop !== undefined) list.scrollTop = this._scrollTop;

    if (list) {
      list.addEventListener("scroll", () => {
        this._scrollTop = list.scrollTop;
      });
    }
  }
}
