import { SWFFGActor } from "./actor.js";
import { SWFFGItem } from "./item.js";
import { SWFFGActorSheet } from "./actor-sheet.js";
import { SWFFGItemSheet } from "./item-sheet.js";
import { oggdudeParser } from "./oggdude-importer.js";
import { CharacterData, NPCData, MinionData, WeaponData, ArmorData, TalentData, ForcePowerData, SpecializationData, SkillData } from "./data-models.js";

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
    skill: SkillData
  };

  // Define custom document classes
  CONFIG.Actor.documentClass = SWFFGActor;
  CONFIG.Item.documentClass = SWFFGItem;

  // Register sheet classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("starwars-ffg", SWFFGActorSheet, {
    types: ["character", "npc", "minion"],
    makeDefault: true
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("starwars-ffg", SWFFGItemSheet, {
    makeDefault: true
  });

  // Handlebars helper: capitalize string
  Handlebars.registerHelper("capitalize", function (str) {
    if (typeof str !== "string") return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  // Handlebars helper: check if positive
  Handlebars.registerHelper("isPositive", function (val) {
    return val > 0;
  });

  // Expose parser globally for developer testing
  game.starwarsFFG = {
    importOggdudeXml: oggdudeParser
  };
});
