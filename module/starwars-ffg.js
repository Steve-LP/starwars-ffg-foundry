import { SWFFGActor } from "./actor.js";
import { SWFFGItem } from "./item.js";
import { SWFFGActorSheet } from "./actor-sheet.js";
import { SWFFGItemSheet } from "./item-sheet.js";
import { SWFFGSpecializationSheet } from "./specialization-sheet.js";
import { oggdudeParser } from "./oggdude-importer.js";
import { CharacterData, NPCData, MinionData, WeaponData, ArmorData, GearData, TalentData, ForcePowerData, SpecializationData, SkillData, SpeciesData, CareerData, AttachmentData } from "./data-models.js";
import { SWFFGDiceRoller } from "./dice-roller.js";
import { CharacterBuilder } from "./applications/character-builder.js";
import { XpBatchDialog } from "./applications/xp-batch-dialog.js";

Hooks.once("init", async function () {
  console.log("Star Wars FFG Scratch | Initializing Star Wars FFG System (V13/V14)");

  // Register Data Models
  CONFIG.Actor.dataModels = {
    character: CharacterData,
    npc: NPCData,
    minion: MinionData
  };
  CONFIG.Item.dataModels = {
    weapon: WeaponData,
    armor: ArmorData,
    gear: GearData,
    talent: TalentData,
    forcePower: ForcePowerData,
    specialization: SpecializationData,
    skill: SkillData,
    species: SpeciesData,
    career: CareerData,
    attachment: AttachmentData
  };

  // Define custom document classes
  CONFIG.Actor.documentClass = SWFFGActor;
  CONFIG.Item.documentClass = SWFFGItem;

  // Register sheet classes
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, "starwars-ffg", SWFFGActorSheet, {
    types: ["character", "npc", "minion"],
    makeDefault: true
  });

  foundry.applications.apps.DocumentSheetConfig.registerSheet(Item, "starwars-ffg", SWFFGItemSheet, {
    types: ["weapon", "armor", "gear", "talent", "forcePower", "skill", "species", "career", "attachment"],
    makeDefault: true
  });

  foundry.applications.apps.DocumentSheetConfig.registerSheet(Item, "starwars-ffg", SWFFGSpecializationSheet, {
    types: ["specialization"],
    makeDefault: true
  });

  // Preload Handlebars templates & partials
  await foundry.applications.handlebars.loadTemplates([
    "systems/starwars-ffg-scratch/templates/parts/talent-grid.hbs",
    "systems/starwars-ffg-scratch/templates/dialogs/xp-batch.hbs"
  ]);

  // Handlebars helper: capitalize string
  Handlebars.registerHelper("capitalize", function (str) {
    if (typeof str !== "string") return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  // Handlebars helper: construct array
  Handlebars.registerHelper("arr", function (...args) {
    return args.slice(0, -1);
  });

  // Handlebars helper: check if positive
  Handlebars.registerHelper("isPositive", function (val) {
    return val > 0;
  });

  // Expose system namespace globally
  game.starwarsFFG = {
    importOggdudeXml: oggdudeParser,
    diceRoller: new SWFFGDiceRoller(),
    openXpBatchDialog: () => new XpBatchDialog().render({ force: true })
  };
});

// Add floating dice roller control button
Hooks.on("getSceneControlButtons", (controls) => {
  let tokenControl;
  if (Array.isArray(controls)) {
    tokenControl = controls.find(c => c.name === "token");
  } else if (controls) {
    tokenControl = controls.token;
  }

  if (tokenControl) {
    tokenControl.tools.push({
      name: "swffg-dice-roller",
      title: "Star Wars Dice Roller",
      icon: "fas fa-dice",
      button: true,
      onClick: () => {
        game.starwarsFFG.diceRoller.render(true);
      }
    });
  }
});

Hooks.once("ready", async function () {
  console.log("Star Wars FFG Scratch | Running database verification in Foundry...");
  const specPack = game.packs.get("starwars-ffg-scratch.specializations");
  const talentPack = game.packs.get("starwars-ffg-scratch.talents");
  if (specPack && talentPack) {
    const specsIndex = await specPack.getIndex();
    const talentsIndex = await talentPack.getIndex({ fields: ["system.key"] });
    console.log(`Star Wars FFG Scratch | Foundry loaded ${specsIndex.size} specializations and ${talentsIndex.size} talents.`);
    
    // Look up Ambassador specifically as a test
    const ambassadorEntry = specsIndex.find(s => s.name === "Ambassador");
    if (ambassadorEntry) {
      const ambassadorDoc = await specPack.getDocument(ambassadorEntry._id);
      const rows = ambassadorDoc.system.talentRows || [];
      let missingKeys = [];
      for (const row of rows) {
        for (const tKey of row.talents) {
          const found = talentsIndex.some(t => t.system?.key === tKey);
          if (!found) missingKeys.push(tKey);
        }
      }
      if (missingKeys.length === 0) {
        console.log("Star Wars FFG Scratch | ✅ Ambassador specialization tree verified successfully inside Foundry VTT!");
      } else {
        console.warn("Star Wars FFG Scratch | ❌ Missing keys in Ambassador specialization inside Foundry VTT:", missingKeys);
      }
    } else {
      console.warn("Star Wars FFG Scratch | ❌ Ambassador specialization not found in pack!");
    }
  } else {
    console.warn("Star Wars FFG Scratch | ❌ Specializations or Talents packs could not be loaded!");
  }
});

Hooks.on("createActor", (actor, options, userId) => {
  console.log("SWFFG | createActor hook fired for", actor.name);
  // Only trigger for the user who created the actor, and only for characters
  if (game.user.id !== userId) return;
  if (actor.type !== "character") return;
  
  console.log("SWFFG | Opening Character Builder for new actor:", actor.name);
  // Auto-open the Character Builder
  const builder = new CharacterBuilder({ actor });
  builder.render({ force: true });
});

/**
 * Inject GM-only "Session-XP vergeben" button into the Actors sidebar.
 */
Hooks.on("renderActorDirectory", (app, html) => {
  if (!game.user?.isGM) return;
  // Avoid duplicate buttons on re-renders
  if (html.querySelector(".xp-batch-sidebar-btn")) return;

  const headerActions = html.querySelector(".directory-footer, .action-buttons, footer");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.classList.add("xp-batch-sidebar-btn");
  btn.innerHTML = `<i class="fas fa-star"></i> Session-XP vergeben`;
  btn.title = "XP an Spielercharaktere vergeben (GM-only)";
  btn.addEventListener("click", () => {
    new XpBatchDialog().render({ force: true });
  });

  if (headerActions) {
    headerActions.prepend(btn);
  } else {
    // Fallback: append to the whole sidebar content
    html.appendChild(btn);
  }
});
