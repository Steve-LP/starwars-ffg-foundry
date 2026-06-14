/**
 * Floating Dice Roller Application for Star Wars FFG using ApplicationV2
 */
const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class SWFFGDiceRoller extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.dicePool = {
      ability: 0,
      proficiency: 0,
      boost: 0,
      difficulty: 0,
      challenge: 0,
      setback: 0,
      force: 0
    };
  }

  static DEFAULT_OPTIONS = {
    id: "swffg-dice-roller",
    window: {
      title: "Star Wars FFG Dice Roller",
      resizable: false,
      minimizable: true
    },
    position: {
      width: 400,
      height: "auto"
    },
    classes: ["starwars-ffg", "dice-roller-app"]
  };

  static PARTS = {
    main: {
      template: "systems/starwars-ffg-scratch/templates/hud/dice-roller.html"
    }
  };

  /** @override */
  async _prepareContext(options) {
    return {
      dicePool: this.dicePool,
      setbackRemoval: this.setbackRemoval || 0
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const html = $(this.element);
    html.find(".dice-pool-control").click(this._onDicePoolControl.bind(this));
    html.find(".roll-pool-button").click(this._onRoll.bind(this));
    html.find(".clear-pool-button").click(this._onClear.bind(this));
  }

  _onDicePoolControl(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dieType = element.dataset.die;
    const action = element.dataset.action;

    if (action === "add") {
      this.dicePool[dieType] = (this.dicePool[dieType] || 0) + 1;
    } else if (action === "sub") {
      this.dicePool[dieType] = Math.max(0, (this.dicePool[dieType] || 0) - 1);
    }
    this.render();
  }

  async _onRoll(event) {
    event.preventDefault();
    const { rollFFGPool, sendRollToChat } = await import("./dice.js");
    
    const totalDice = Object.values(this.dicePool).reduce((a, b) => a + b, 0);
    if (totalDice === 0) return;

    // Apply setback removal on the final rolled pool
    const finalPool = { ...this.dicePool };
    const removal = this.setbackRemoval || 0;
    if (removal > 0) {
      finalPool.setback = Math.max(0, finalPool.setback - removal);
    }

    const result = rollFFGPool(finalPool);
    await sendRollToChat(null, result, "Manual Dice Roll");
    this.clear();
  }

  _onClear(event) {
    if (event) event.preventDefault();
    this.clear();
  }

  clear() {
    this.dicePool = {
      ability: 0,
      proficiency: 0,
      boost: 0,
      difficulty: 0,
      challenge: 0,
      setback: 0,
      force: 0
    };
    this.setbackRemoval = 0;
    this.render();
  }

  /**
   * Sets the active dice pool and renders the window.
   * @param {Object} pool 
   */
  setPool(pool) {
    this.dicePool = foundry.utils.mergeObject({
      ability: 0,
      proficiency: 0,
      boost: 0,
      difficulty: 0,
      challenge: 0,
      setback: 0,
      force: 0
    }, pool);
    this.setbackRemoval = pool.setbackRemoval || 0;
    this.render({ force: true });
    try { this.bringToTop(); } catch(e) {}
  }

  /**
   * Merges options into the active dice pool and renders.
   * @param {Object} pool 
   */
  addPool(pool) {
    for (const [key, val] of Object.entries(pool)) {
      if (this.dicePool[key] !== undefined) {
        this.dicePool[key] += val;
      }
    }
    this.render({ force: true });
    try { this.bringToTop(); } catch(e) {}
  }
}
