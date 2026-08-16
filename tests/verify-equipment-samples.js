import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packsDir = path.join(__dirname, "../packs");

function inspectPack(name, keysToFind) {
  const file = path.join(packsDir, `${name}.db`);
  const lines = fs.readFileSync(file, "utf-8").split("\n").filter(l => l.trim());
  console.log(`\n================== PACK: ${name} (${lines.length} items) ==================`);
  
  const found = [];
  for (const line of lines) {
    const doc = JSON.parse(line);
    if (keysToFind.some(k => doc.name.toLowerCase().includes(k.toLowerCase()) || doc.system?.key === k.toLowerCase())) {
      found.push(doc);
    }
  }

  for (const doc of found) {
    console.log(`\n[Item: ${doc.name}] (Type: ${doc.type})`);
    console.log(`- Price: ${doc.system.price}, Rarity: ${doc.system.rarity}, Restricted: ${doc.system.restricted}`);
    console.log(`- Encumbrance: ${doc.system.encumbrance}`);
    if (doc.type === "weapon") {
      console.log(`- Damage: ${doc.system.damage}, Crit: ${doc.system.critical}, Range: ${doc.system.range}, Skill: ${doc.system.skill}`);
      console.log(`- Qualities: ${doc.system.qualities}, Hardpoints: ${doc.system.hardpoints}`);
    } else if (doc.type === "armor") {
      console.log(`- Soak: ${doc.system.soak}, Defence: ${doc.system.defence}, Hardpoints: ${doc.system.hardpoints}`);
      console.log(`- Qualities: ${doc.system.qualities}`);
    } else if (doc.type === "attachment") {
      console.log(`- SlotType: ${doc.system.slotType}, Hardpoints: ${doc.system.hardpoints}`);
      console.log(`- Upgradeable Mods Count: ${doc.system.mods?.length}`);
      if (doc.system.mods?.length > 0) {
        console.log(`  Sample Mods:`, doc.system.mods.slice(0, 3));
      }
    }
    console.log(`- Sources:`, doc.flags?.starwarsffg?.sources);
  }
}

inspectPack("armor", ["Armored Clothing", "Laminate Armor", "Heavy Battle Armor"]);
inspectPack("gear", ["Comlink (handheld)", "Emergency Medpac", "Macrobinoculars"]);
inspectPack("attachments", ["Augmented Spin Barrel", "Balanced Hilt", "Superior Armor Customization"]);
inspectPack("weapons", ["Holdout Blaster", "DLT-19", "Heavy Blaster Pistol"]);
