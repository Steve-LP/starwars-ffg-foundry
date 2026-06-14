/**
 * Custom Item Sheet for Star Wars FFG Ruleset using ItemSheetV2
 */
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class SWFFGItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  constructor(options={}) {
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
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const html = $(this.element);
    html.find(".toggle-attachment-mod").click(this._onToggleAttachmentMod.bind(this));
    html.find(".remove-attachment").click(this._onRemoveAttachment.bind(this));
  }

  async _onToggleAttachmentMod(event) {
    event.preventDefault();
    const target = event.currentTarget;
    const attachmentIdx = parseInt(target.dataset.attachmentIndex);
    const modIdx = parseInt(target.dataset.modIndex);
    
    const attachments = Array.from(this.document.system.attachments || []);
    if (attachments[attachmentIdx]) {
      const att = attachments[attachmentIdx];
      if (att.mods && att.mods[modIdx]) {
        att.mods[modIdx].active = !att.mods[modIdx].active;
        await this.document.update({ "system.attachments": attachments });
        ui.notifications.info(`Modifikation "${att.mods[modIdx].name}" ${att.mods[modIdx].active ? "aktiviert" : "deaktiviert"}.`);
      }
    }
  }

  async _onRemoveAttachment(event) {
    event.preventDefault();
    const target = event.currentTarget;
    const attachmentIdx = parseInt(target.dataset.attachmentIndex);
    
    const attachments = Array.from(this.document.system.attachments || []);
    if (attachments[attachmentIdx]) {
      const removed = attachments.splice(attachmentIdx, 1)[0];
      await this.document.update({ "system.attachments": attachments });
      ui.notifications.info(`Aufsatz "${removed.name}" entfernt.`);
      
      if (this.document.actor) {
        await this.document.actor.createEmbeddedDocuments("Item", [removed]);
      }
    }
  }
}
