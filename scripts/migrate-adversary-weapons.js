import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeSkillName } from "../module/utils/skill-normalization.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, "../packs/adversaries.db");
const backupPath = path.resolve(__dirname, "../packs/adversaries.db.bak");

console.log("SWFFG MIGRATION | Starting weapon skill migration for adversaries.db...");

if (!fs.existsSync(dbPath)) {
  console.error("Adversaries database not found at", dbPath);
  process.exit(1);
}

// Create backup
fs.copyFileSync(dbPath, backupPath);
console.log(`SWFFG MIGRATION | Backup created at ${backupPath}`);

const lines = fs.readFileSync(dbPath, "utf-8").split("\n");
let totalActors = 0;
let totalWeaponsChecked = 0;
let totalWeaponsUpdated = 0;

const updatedLines = lines.map(line => {
  if (!line.trim()) return line;
  totalActors++;
  try {
    const doc = JSON.parse(line);
    let docModified = false;

    if (doc.items && Array.isArray(doc.items)) {
      for (const item of doc.items) {
        if (item.type === "weapon" && item.system) {
          totalWeaponsChecked++;
          const currentSkill = item.system.skill || "";
          const normalized = normalizeSkillName(currentSkill || "Ranged - Light");
          if (currentSkill !== normalized) {
            item.system.skill = normalized;
            docModified = true;
            totalWeaponsUpdated++;
          }
        }
      }
    }

    return docModified ? JSON.stringify(doc) : line;
  } catch (err) {
    console.error("Failed parsing line:", err);
    return line;
  }
});

fs.writeFileSync(dbPath, updatedLines.join("\n"), "utf-8");

console.log("SWFFG MIGRATION | Complete!");
console.log(`- Total Actors processed: ${totalActors}`);
console.log(`- Total Weapons checked: ${totalWeaponsChecked}`);
console.log(`- Total Weapons updated to canonical skill: ${totalWeaponsUpdated}`);
