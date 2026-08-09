import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ClassicLevel } from 'classic-level';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const oggDudeCareersDir = path.resolve(__dirname, 'data-oggdude', 'Careers');
const oggDudeSpecsDir = path.resolve(__dirname, 'data-oggdude', 'Specializations');
const packsDir = path.resolve(__dirname, '..', 'packs');

async function migrate() {
  console.log("🚀 Starting Career-Specialization Migration...");

  // 1. Parse OggDude Careers to build the mapping
  const careerMap = {};
  if (fs.existsSync(oggDudeCareersDir)) {
    const files = fs.readdirSync(oggDudeCareersDir).filter(f => f.endsWith('.xml'));
    for (const file of files) {
      const xml = fs.readFileSync(path.join(oggDudeCareersDir, file), 'utf8');
      const keyMatch = xml.match(/<Key>(.*?)<\/Key>/i);
      if (keyMatch) {
        const careerKey = keyMatch[1].trim().toLowerCase();
        const specsMatch = xml.match(/<Specializations>([\s\S]*?)<\/Specializations>/i);
        const specs = [];
        if (specsMatch) {
          const specKeys = specsMatch[1].match(/<Key>(.*?)<\/Key>/gi);
          if (specKeys) {
            for (const sk of specKeys) {
              const cleaned = sk.replace(/<\/?Key>/gi, '').trim().toLowerCase();
              if (cleaned) specs.push(cleaned);
            }
          }
        }
        careerMap[careerKey] = specs;
      }
    }
    console.log(`✅ Parsed ${Object.keys(careerMap).length} careers from OggDude data.`);
  } else {
    console.warn("⚠️ OggDude Careers directory not found!");
  }

  // 2. Parse OggDude Specializations for Universal flag
  const universalSpecs = new Set();
  if (fs.existsSync(oggDudeSpecsDir)) {
    const files = fs.readdirSync(oggDudeSpecsDir).filter(f => f.endsWith('.xml'));
    for (const file of files) {
      const xml = fs.readFileSync(path.join(oggDudeSpecsDir, file), 'utf8');
      const keyMatch = xml.match(/<Key>(.*?)<\/Key>/i);
      const isUniversal = /<Universal>true<\/Universal>/i.test(xml);
      if (keyMatch && isUniversal) {
        universalSpecs.add(keyMatch[1].trim().toLowerCase());
      }
    }
    console.log(`✅ Identified ${universalSpecs.size} universal specializations.`);
  } else {
    console.warn("⚠️ OggDude Specializations directory not found!");
  }

  // 3. Backup Packs
  console.log("📦 Creating backups of LevelDB packs...");
  try {
    execSync(`cp -r "${path.join(packsDir, 'careers')}" "${path.join(packsDir, 'careers_backup')}"`);
    execSync(`cp -r "${path.join(packsDir, 'specializations')}" "${path.join(packsDir, 'specializations_backup')}"`);
    console.log("✅ Backups created successfully.");
  } catch (e) {
    console.error("❌ Failed to create backups:", e.message);
    return;
  }

  // 4. Update Careers LevelDB
  let careersUpdated = 0;
  const careersDbDir = path.join(packsDir, 'careers');
  const careersDb = new ClassicLevel(careersDbDir, { keyEncoding: 'utf8', valueEncoding: 'json' });
  await careersDb.open();
  try {
    const batch = careersDb.batch();
    for await (const [key, value] of careersDb.iterator()) {
      if (value.type === "career") {
        const itemKey = (value.system.key || "").toLowerCase();
        value.system.specializations = careerMap[itemKey] || [];
        value.system.schemaVersion = "1.0";
        batch.put(key, value);
        careersUpdated++;
      }
    }
    await batch.write();
    console.log(`✅ Updated ${careersUpdated} careers in LevelDB.`);
  } finally {
    await careersDb.close();
  }

  // 5. Update Specializations LevelDB
  let specsUpdated = 0;
  const specsDbDir = path.join(packsDir, 'specializations');
  const specsDb = new ClassicLevel(specsDbDir, { keyEncoding: 'utf8', valueEncoding: 'json' });
  await specsDb.open();
  try {
    const batch = specsDb.batch();
    for await (const [key, value] of specsDb.iterator()) {
      if (value.type === "specialization") {
        const itemKey = (value.system.key || "").toLowerCase();
        value.system.isUniversal = universalSpecs.has(itemKey);
        value.system.schemaVersion = "1.0";
        batch.put(key, value);
        specsUpdated++;
      }
    }
    await batch.write();
    console.log(`✅ Updated ${specsUpdated} specializations in LevelDB.`);
  } finally {
    await specsDb.close();
  }

  console.log("🎉 Migration completed successfully!");
}

migrate().catch(console.error);
