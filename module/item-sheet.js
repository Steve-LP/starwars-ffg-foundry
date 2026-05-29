/**
 * Custom Item Sheet for Star Wars FFG Ruleset
 */
export class SWFFGItemSheet extends ItemSheet {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["starwars-ffg", "sheet", "item"],
      template: "systems/starwars-ffg-scratch/templates/items/item-sheet.html",
      width: 520,
      height: 480
    });
  }

  /** @override */
  getData() {
    const context = super.getData();
    const itemData = context.item;
    
    // Pass custom attributes
    context.system = itemData.system;
    
    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
  }
}
