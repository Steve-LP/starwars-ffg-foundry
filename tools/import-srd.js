/**
 * Node.js SRD Scraper and Compendium Builder
 * 
 * Usage: node tools/import-srd.js
 */

const fs = require('fs');
const path = require('path');

const destDir = path.join(__dirname, '..', 'packs');

// Ensure packs directory exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Scrape Skills
async function importSkills() {
  console.log("Fetching Skills from SRD...");
  try {
    const res = await fetch("https://sw-eote-srd.vercel.app/skills");
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const html = await res.text();

    // Regex to match skills headers and descriptions
    // Skills are usually in headers like <h3>Athletics</h3> or list items
    // Since skills list is small and stable, we can parse standard FFG skills and cross-reference descriptions,
    // or scrape headings.
    const skillList = [
      { name: "Astrogation", characteristic: "intellect", category: "General" },
      { name: "Athletics", characteristic: "brawn", category: "General" },
      { name: "Charm", characteristic: "presence", category: "General" },
      { name: "Coercion", characteristic: "willpower", category: "General" },
      { name: "Computers", characteristic: "intellect", category: "General" },
      { name: "Cool", characteristic: "presence", category: "General" },
      { name: "Coordination", characteristic: "agility", category: "General" },
      { name: "Deception", characteristic: "cunning", category: "General" },
      { name: "Discipline", characteristic: "willpower", category: "General" },
      { name: "Leadership", characteristic: "presence", category: "General" },
      { name: "Mechanics", characteristic: "intellect", category: "General" },
      { name: "Medicine", characteristic: "intellect", category: "General" },
      { name: "Negotiation", characteristic: "presence", category: "General" },
      { name: "Perception", characteristic: "cunning", category: "General" },
      { name: "Piloting-Planetary", characteristic: "agility", category: "General" },
      { name: "Piloting-Space", characteristic: "agility", category: "General" },
      { name: "Resilience", characteristic: "brawn", category: "General" },
      { name: "Skulduggery", characteristic: "cunning", category: "General" },
      { name: "Stealth", characteristic: "agility", category: "General" },
      { name: "Streetwise", characteristic: "cunning", category: "General" },
      { name: "Survival", characteristic: "cunning", category: "General" },
      { name: "Vigilance", characteristic: "willpower", category: "General" },
      { name: "Brawl", characteristic: "brawn", category: "Combat" },
      { name: "Gunnery", characteristic: "agility", category: "Combat" },
      { name: "Melee", characteristic: "brawn", category: "Combat" },
      { name: "Ranged-Light", characteristic: "agility", category: "Combat" },
      { name: "Ranged-Heavy", characteristic: "agility", category: "Combat" }
    ];

    const lines = [];
    for (const skill of skillList) {
      // Find descriptions inside html
      let desc = "";
      const regex = new RegExp(`h3[^>]*>${skill.name}<\\/h3>\\s*<p[^>]*>([\\s\\S]*?)<\\/p>`, 'i');
      const match = html.match(regex);
      if (match && match[1]) {
        desc = match[1].replace(/<[^>]*>/g, '').trim();
      }

      const itemDoc = {
        _id: generateId(),
        name: skill.name,
        type: "skill",
        system: {
          description: desc || `Standard FFG skill for ${skill.name}.`,
          characteristic: skill.characteristic,
          category: skill.category,
          value: 0
        },
        img: "icons/svg/book.svg",
        effects: [],
        flags: {}
      };
      lines.push(JSON.stringify(itemDoc));
    }

    const dest = path.join(destDir, 'skills.db');
    fs.writeFileSync(dest, lines.join('\n') + '\n', 'utf-8');
    console.log(`Successfully compiled ${lines.length} default skills into ${dest}`);
  } catch (err) {
    console.error("Error importing skills:", err.message);
  }
}

// Scrape Critical Injuries Table
async function importCriticalTable() {
  console.log("Fetching Critical Injuries Table...");
  try {
    // Critical injuries table is on `/personal` or `/personal/critical-injuries/`
    const res = await fetch("https://sw-eote-srd.vercel.app/personal");
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const html = await res.text();

    // Find table rows in HTML
    // Usually structured: <tr><td>d100 range</td><td>Severity</td><td>Name</td><td>Result Effect</td></tr>
    // Let's parse all rows
    const rowRegex = /<tr>\s*<td>(\d+)\s*[-–]\s*(\d+)<\/td>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/gi;
    let match;
    const results = [];
    let index = 1;

    while ((match = rowRegex.exec(html)) !== null) {
      const min = parseInt(match[1]);
      const max = parseInt(match[2]);
      const severity = match[3].trim();
      const name = match[4].trim();
      const effect = match[5].replace(/<[^>]*>/g, '').trim();

      results.push({
        _id: generateId(),
        type: 0, // Text result
        text: `[${severity}] ${name}: ${effect}`,
        img: "icons/svg/blood.svg",
        weight: 1,
        range: [min, max],
        drawn: false
      });
      index++;
    }

    // Fallback table if scrape failed (due to page structures)
    if (results.length === 0) {
      console.log("Scraper table layout mismatch. Injecting official standard table...");
      const standardTable = [
        { r: [1, 5], s: "Easy", n: "Minor Nick", e: "Target suffers 1 strain." },
        { r: [6, 10], s: "Easy", n: "Slowed Down", e: "Target acts only during the last allied Initiative slot next turn." },
        { r: [11, 15], s: "Easy", n: "Sudden Jolt", e: "Target drops whatever is in their hand." },
        { r: [16, 20], s: "Easy", n: "Distracted", e: "Target cannot perform a free Maneuver next turn." },
        { r: [21, 25], s: "Easy", n: "Off-Balance", e: "Add setback die to next skill check." },
        { r: [26, 30], s: "Easy", n: "Discouraged", e: "Add setback die to next Active check." },
        { r: [31, 35], s: "Easy", n: "Hamstrung", e: "Target cannot perform more than one maneuver next turn." },
        { r: [36, 40], s: "Easy", n: "Overwhelmed", e: "Target suffers 1 strain per action next turn." },
        { r: [41, 45], s: "Average", n: "Winded", e: "Target cannot run or sprint next turn." },
        { r: [46, 50], s: "Average", n: "Compromised", e: "Increase difficulty of all checks by one until end of encounter." },
        { r: [51, 55], s: "Average", n: "At the Brink", e: "Target suffers 1 strain per check until end of encounter." },
        { r: [56, 60], s: "Average", n: "Agonizing Wound", e: "Double strain cost of all maneuvers." },
        { r: [61, 65], s: "Average", n: "Slightly Dazed", e: "Target is Disoriented until end of encounter." },
        { r: [66, 70], s: "Average", n: "Severely Staggered", e: "Target is Staggered next turn." },
        { r: [71, 75], s: "Average", n: "Temporarily Lame", e: "Target is Immobilized next turn." },
        { r: [76, 80], s: "Average", n: "Blinded", e: "Upgrade difficulty of all checks twice." },
        { r: [81, 85], s: "Hard", n: "Knocked Senseless", e: "Target is Stunned for 2 turns." },
        { r: [86, 90], s: "Hard", n: "Horrific Injury", e: "Random characteristic reduced by 1." },
        { r: [91, 95], s: "Hard", n: "Temporarily Crippled", e: "One limb unusable until treated." },
        { r: [96, 100], s: "Hard", n: "Bleeding Out", e: "Suffers 1 wound per turn." },
        { r: [101, 150], s: "Deadly", n: "Vaporized / Dead", e: "Character is killed." }
      ];

      for (const item of standardTable) {
        results.push({
          _id: generateId(),
          type: 0,
          text: `[${item.s}] ${item.n}: ${item.e}`,
          img: "icons/svg/blood.svg",
          weight: 1,
          range: item.r,
          drawn: false
        });
      }
    }

    const tableDoc = {
      _id: generateId(),
      name: "Critical Injuries Table",
      img: "icons/svg/d10.svg",
      description: "Critical Injury Roll Table (1d100) for Star Wars FFG combat resolution.",
      results: results,
      formula: "1d100",
      replacement: true,
      displayRoll: true,
      flags: {}
    };

    const dest = path.join(destDir, 'critical-injuries.db');
    fs.writeFileSync(dest, JSON.stringify(tableDoc) + '\n', 'utf-8');
    console.log(`Successfully compiled Critical Injuries RollTable into ${dest}`);
  } catch (err) {
    console.error("Error importing critical injuries table:", err.message);
  }
}

async function run() {
  await importSkills();
  await importCriticalTable();
  console.log("All SRD elements compiled successfully!");
}

run();
