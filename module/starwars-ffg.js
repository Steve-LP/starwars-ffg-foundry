import { SWFFGActor } from "./actor.js";
import { SWFFGItem } from "./item.js";
import { SWFFGActorSheet } from "./actor-sheet.js";
import { SWFFGItemSheet } from "./item-sheet.js";
import { oggdudeParser } from "./oggdude-importer.js";
import { CharacterData, NPCData, MinionData, WeaponData, ArmorData, TalentData, ForcePowerData, SpecializationData, SkillData, SpeciesData, CareerData } from "./data-models.js";
import { SWFFGDiceRoller } from "./dice-roller.js";

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
    talent: TalentData,
    forcePower: ForcePowerData,
    specialization: SpecializationData,
    skill: SkillData,
    species: SpeciesData,
    career: CareerData
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
    makeDefault: true
  });

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
    diceRoller: new SWFFGDiceRoller()
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
