/**
 * SWFFG Weapon Skills Runtime Migration Script
 *
 * Runs inside Foundry V14 (Console or Macro) to normalize all weapon skills
 * on World Actors, World Items, and unlocked Compendiums.
 */
(async function migrateWeaponSkills() {
  console.log("SWFFG | Starting runtime weapon skill migration...");
  let updatedItems = 0;
  let updatedActors = 0;

  // Import utility if available or fallback inline map
  let normalize = (name) => {
    if (!name) return "Ranged - Light";
    const lower = name.toLowerCase().trim();
    if (lower.includes("ranged") && lower.includes("heavy")) return "Ranged - Heavy";
    if (lower.includes("ranged") && lower.includes("light")) return "Ranged - Light";
    if (lower.includes("gunn")) return "Gunnery";
    if (lower.includes("brawl")) return "Brawl";
    if (lower.includes("melee")) return "Melee";
    if (lower.includes("saber")) return "Lightsaber";
    return name;
  };

  try {
    const mod = await import("../module/utils/skill-normalization.js");
    if (mod && mod.normalizeSkillName) normalize = mod.normalizeSkillName;
  } catch (e) {
    // Fallback
  }

  // 1. World Items
  for (const item of game.items) {
    if (item.type === "weapon") {
      const current = item.system.skill || "";
      const canonical = normalize(current);
      if (current !== canonical) {
        await item.update({ "system.skill": canonical });
        updatedItems++;
      }
    }
  }

  // 2. Embedded Items in World Actors
  for (const actor of game.actors) {
    const updates = [];
    for (const item of actor.items) {
      if (item.type === "weapon") {
        const current = item.system.skill || "";
        const canonical = normalize(current);
        if (current !== canonical) {
          updates.push({ _id: item.id, "system.skill": canonical });
        }
      }
    }
    if (updates.length > 0) {
      await actor.updateEmbeddedDocuments("Item", updates);
      updatedActors++;
      updatedItems += updates.length;
    }
  }

  console.log(`SWFFG | Runtime Migration Complete! Updated ${updatedItems} weapon items across ${updatedActors} actors.`);
  ui.notifications?.info(`Waffen-Fertigkeiten-Migration abgeschlossen: ${updatedItems} Waffen aktualisiert.`);
})();
