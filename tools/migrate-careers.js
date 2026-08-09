const fs = require('fs');
const path = require('path');

const careersDir = path.join(__dirname, 'data-oggdude/Careers');
const dbPath = path.join(__dirname, '../packs/careers.db');

const xmlFiles = fs.readdirSync(careersDir).filter(f => f.endsWith('.xml'));
const careerMap = {};

for (const file of xmlFiles) {
  const content = fs.readFileSync(path.join(careersDir, file), 'utf-8');
  
  const keyMatch = content.match(/<Key>(.*?)<\/Key>/);
  if (!keyMatch) continue;
  const careerKey = keyMatch[1].toLowerCase();
  
  const specMatch = content.match(/<Specializations>([\s\S]*?)<\/Specializations>/);
  const specializations = [];
  if (specMatch) {
    const specKeys = specMatch[1].match(/<Key>(.*?)<\/Key>/g);
    if (specKeys) {
      for (const sk of specKeys) {
        specializations.push(sk.replace(/<\/?Key>/g, '').toLowerCase());
      }
    }
  }
  
  careerMap[careerKey] = specializations;
}

const dbContent = fs.readFileSync(dbPath, 'utf-8');
const lines = dbContent.split('\n');
const newLines = [];

let updated = 0;
for (const line of lines) {
  if (!line.trim()) {
    newLines.push(line);
    continue;
  }
  
  try {
    const obj = JSON.parse(line);
    if (obj.system && obj.system.key) {
      const cKey = obj.system.key.toLowerCase();
      if (careerMap[cKey]) {
        obj.system.specializations = careerMap[cKey];
        updated++;
      }
    }
    newLines.push(JSON.stringify(obj));
  } catch (e) {
    newLines.push(line);
  }
}

fs.writeFileSync(dbPath, newLines.join('\n'));
console.log(`Updated ${updated} careers with specializations.`);
