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
}
