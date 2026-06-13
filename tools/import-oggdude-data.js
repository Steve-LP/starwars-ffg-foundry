const fs = require('fs');
const path = require('path');

const oggdudeDataDir = '/home/steve/Dokumente/rpg/StarWarsSteve/SWCharGen/Data';
const destDir = path.join(__dirname, '..', 'packs');

// Unique ID Generator
function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Simple XML tag extractor helper
function getTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`, 'i'));
  return match ? match[1].trim() : "";
}

// Clean Oggdude formatting tags to clean HTML
function formatDescription(desc) {
  if (!desc) return "";
  let formatted = desc;
  
  // Tag replacements
  formatted = formatted.replace(/\[h4\]/gi, "</h4>").replace(/\[H4\]/gi, "<h4>");
  formatted = formatted.replace(/\[b\]/gi, "</strong>").replace(/\[B\]/gi, "<strong>");
  formatted = formatted.replace(/\[i\]/gi, "</em>").replace(/\[I\]/gi, "<em>");
  formatted = formatted.replace(/\[p\]/gi, "</p>").replace(/\[P\]/gi, "<p>");
  formatted = formatted.replace(/\[bullet\]/gi, "</li>").replace(/\[Bullet\]/gi, "<li>");
  
  // Format line endings and spacing
  formatted = formatted.replace(/\r?\n\r?\n/g, "<br><br>");
  formatted = formatted.replace(/\r?\n/g, " ");
  
  // Trim redundant spacing
  formatted = formatted.replace(/\s+/g, " ");
  
  return formatted.trim();
}

const skillMap = {
  "ASTRO": "Astrogation",
  "ATHL": "Athletics",
  "CHARM": "Charm",
  "COERC": "Coercion",
  "COMP": "Computers",
  "COOL": "Cool",
  "COORD": "Coordination",
  "DEC": "Deception",
  "DISC": "Discipline",
  "LEAD": "Leadership",
  "MECH": "Mechanics",
  "MED": "Medicine",
  "NEG": "Negotiation",
  "PERC": "Perception",
  "PILOTPL": "Piloting (Planetary)",
  "PILOTSP": "Piloting (Space)",
  "RESIL": "Resilience",
  "SKUL": "Skulduggery",
  "STEAL": "Stealth",
  "SW": "Streetwise",
  "SURV": "Survival",
  "VIGIL": "Vigilance",
  "BRAWL": "Brawl",
  "GUNN": "Gunnery",
  "MELEE": "Melee",
  "RANGLT": "Ranged (Light)",
  "RANGHVY": "Ranged (Heavy)"
};

// Compile Species
function compileSpecies() {
  const speciesSrcDir = path.join(oggdudeDataDir, 'Species');
  if (!fs.existsSync(speciesSrcDir)) {
    console.error(`Species source folder not found at: ${speciesSrcDir}`);
    return;
  }

  // Load available copied images to do correct mapping
  const localSpeciesAssets = path.join(__dirname, '..', 'assets', 'species');
  let imgFiles = [];
  if (fs.existsSync(localSpeciesAssets)) {
    imgFiles = fs.readdirSync(localSpeciesAssets).filter(f => f.endsWith('.png'));
  }

  const files = fs.readdirSync(speciesSrcDir).filter(f => f.endsWith('.xml'));
  console.log(`Compiling ${files.length} species from Oggdude XML...`);
  const lines = [];

  for (const file of files) {
    const rawXml = fs.readFileSync(path.join(speciesSrcDir, file), 'utf-8');
    const name = getTag(rawXml, 'Name') || file.replace('.xml', '');
    const key = getTag(rawXml, 'Key') || name.toUpperCase();
    
    const desc = formatDescription(getTag(rawXml, 'Description'));

    const startingChars = getTag(rawXml, 'StartingChars');
    const brawn = parseInt(getTag(startingChars, 'Brawn')) || 2;
    const agility = parseInt(getTag(startingChars, 'Agility')) || 2;
    const intellect = parseInt(getTag(startingChars, 'Intellect')) || 2;
    const cunning = parseInt(getTag(startingChars, 'Cunning')) || 2;
    const willpower = parseInt(getTag(startingChars, 'Willpower')) || 2;
    const presence = parseInt(getTag(startingChars, 'Presence')) || 2;

    const startingAttrs = getTag(rawXml, 'StartingAttrs');
    const wounds = parseInt(getTag(startingAttrs, 'WoundThreshold')) || 10;
    const strain = parseInt(getTag(startingAttrs, 'StrainThreshold')) || 10;
    const xp = parseInt(getTag(startingAttrs, 'Experience')) || 100;

    // Image mapping
    const cleanKey = key.toUpperCase();
    const matchImg = imgFiles.find(img => {
      const baseImgName = img.replace('.png', '').toUpperCase();
      return cleanKey.startsWith(baseImgName) || baseImgName.startsWith(cleanKey);
    });
    const imgPath = matchImg ? `systems/starwars-ffg-scratch/assets/species/${matchImg}` : "icons/svg/citizen.svg";

    const speciesDoc = {
      _id: generateId(),
      name: name,
      type: "species",
      img: imgPath,
      system: {
        description: desc,
        characteristics: {
          brawn: { value: brawn },
          agility: { value: agility },
          intellect: { value: intellect },
          cunning: { value: cunning },
          willpower: { value: willpower },
          presence: { value: presence }
        },
        wounds: { base: wounds },
        strain: { base: strain },
        xp: xp,
        key: key.toLowerCase()
      },
      effects: [],
      flags: {}
    };

    lines.push(JSON.stringify(speciesDoc));
  }

  const destFile = path.join(destDir, 'species.db');
  fs.writeFileSync(destFile, lines.join('\n') + '\n', 'utf-8');
  console.log(`Saved compiled species to ${destFile}`);
}

// Compile Careers
function compileCareers() {
  const careersSrcDir = path.join(oggdudeDataDir, 'Careers');
  if (!fs.existsSync(careersSrcDir)) {
    console.error(`Careers source folder not found at: ${careersSrcDir}`);
    return;
  }

  const files = fs.readdirSync(careersSrcDir).filter(f => f.endsWith('.xml'));
  console.log(`Compiling ${files.length} careers from Oggdude XML...`);
  const lines = [];

  for (const file of files) {
    const rawXml = fs.readFileSync(path.join(careersSrcDir, file), 'utf-8');
    const name = getTag(rawXml, 'Name') || file.replace('.xml', '');
    const key = getTag(rawXml, 'Key') || name.toUpperCase();
    
    const desc = formatDescription(getTag(rawXml, 'Description'));

    const skillsSection = getTag(rawXml, 'CareerSkills');
    const skillKeys = [];
    const keyRegex = /<Key>([^<]+)<\/Key>/gi;
    let match;
    while ((match = keyRegex.exec(skillsSection)) !== null) {
      skillKeys.push(match[1].trim().toUpperCase());
    }

    const mappedSkills = skillKeys.map(k => skillMap[k]).filter(Boolean);

    const careerDoc = {
      _id: generateId(),
      name: name,
      type: "career",
      img: "icons/svg/target.svg",
      system: {
        description: desc,
        careerSkills: mappedSkills.join(', '),
        key: key.toLowerCase()
      },
      effects: [],
      flags: {}
    };

    lines.push(JSON.stringify(careerDoc));
  }

  const destFile = path.join(destDir, 'careers.db');
  fs.writeFileSync(destFile, lines.join('\n') + '\n', 'utf-8');
  console.log(`Saved compiled careers to ${destFile}`);
}

// Compile Specializations
function compileSpecializations() {
  const specsSrcDir = path.join(oggdudeDataDir, 'Specializations');
  if (!fs.existsSync(specsSrcDir)) {
    console.error(`Specializations source folder not found at: ${specsSrcDir}`);
    return;
  }

  const files = fs.readdirSync(specsSrcDir).filter(f => f.endsWith('.xml'));
  console.log(`Compiling ${files.length} specializations from Oggdude XML...`);
  const lines = [];

  for (const file of files) {
    const rawXml = fs.readFileSync(path.join(specsSrcDir, file), 'utf-8');
    const name = getTag(rawXml, 'Name') || file.replace('.xml', '');
    const key = getTag(rawXml, 'Key') || name.toUpperCase();
    
    const desc = formatDescription(getTag(rawXml, 'Description'));

    const skillsSection = getTag(rawXml, 'CareerSkills');
    const skillKeys = [];
    const keyRegex = /<Key>([^<]+)<\/Key>/gi;
    let match;
    while ((match = keyRegex.exec(skillsSection)) !== null) {
      skillKeys.push(match[1].trim().toUpperCase());
    }

    const mappedSkills = skillKeys.map(k => skillMap[k]).filter(Boolean);

    // Parse Talent Rows
    const talentRows = [];
    const talentRowRegex = /<TalentRow>([\s\S]*?)<\/TalentRow>/gi;
    let rowMatch;
    while ((rowMatch = talentRowRegex.exec(rawXml)) !== null) {
      const rowXml = rowMatch[1];
      const index = parseInt(getTag(rowXml, 'Index')) || 0;
      const cost = parseInt(getTag(rowXml, 'Cost')) || 0;

      const talentsBlock = getTag(rowXml, 'Talents');
      const talentKeys = [];
      const tKeyRegex = /<Key>([^<]+)<\/Key>/gi;
      let tMatch;
      while ((tMatch = tKeyRegex.exec(talentsBlock)) !== null) {
        talentKeys.push(tMatch[1].trim().toLowerCase());
      }

      const directionsBlock = getTag(rowXml, 'Directions');
      const directionRegex = /<Direction>([\s\S]*?)<\/Direction>/gi;
      const directions = [];
      let dirMatch;
      while ((dirMatch = directionRegex.exec(directionsBlock)) !== null) {
        const dirContent = dirMatch[1];
        directions.push({
          up: dirContent.includes('<Up>true</Up>'),
          down: dirContent.includes('<Down>true</Down>'),
          left: dirContent.includes('<Left>true</Left>'),
          right: dirContent.includes('<Right>true</Right>')
        });
      }

      talentRows.push({
        index: index,
        cost: cost,
        talents: talentKeys,
        directions: directions
      });
    }

    const specDoc = {
      _id: generateId(),
      name: name,
      type: "specialization",
      img: "icons/svg/book.svg",
      system: {
        description: desc,
        careerSkills: mappedSkills.join(', '),
        key: key.toLowerCase(),
        talentRows: talentRows
      },
      effects: [],
      flags: {}
    };

    lines.push(JSON.stringify(specDoc));
  }

  const destFile = path.join(destDir, 'specializations.db');
  fs.writeFileSync(destFile, lines.join('\n') + '\n', 'utf-8');
  console.log(`Saved compiled specializations to ${destFile}`);
}

// Compile Talents
function compileTalents() {
  const talentsFile = path.join(oggdudeDataDir, 'Talents.xml');
  if (!fs.existsSync(talentsFile)) {
    console.error(`Talents file not found at: ${talentsFile}`);
    return;
  }

  const rawXml = fs.readFileSync(talentsFile, 'utf-8');
  const talentRegex = /<Talent>([\s\S]*?)<\/Talent>/gi;
  const lines = [];
  let match;
  console.log("Compiling talents from Talents.xml...");
  while ((match = talentRegex.exec(rawXml)) !== null) {
    const talentXml = match[1];
    const key = getTag(talentXml, 'Key');
    const name = getTag(talentXml, 'Name');
    const desc = formatDescription(getTag(talentXml, 'Description'));
    const isRanked = getTag(talentXml, 'Ranked').toLowerCase() === 'true';
    const activation = getTag(talentXml, 'ActivationValue') === 'taPassive' ? 'Passive' : 'Active';

    const talentDoc = {
      _id: generateId(),
      name: name,
      type: "talent",
      img: "icons/svg/star.svg",
      system: {
        description: desc,
        activation: activation,
        tier: 1,
        ranked: isRanked,
        key: key.toLowerCase()
      },
      effects: [],
      flags: {}
    };
    lines.push(JSON.stringify(talentDoc));
  }

  const destFile = path.join(destDir, 'talents.db');
  fs.writeFileSync(destFile, lines.join('\n') + '\n', 'utf-8');
  console.log(`Saved compiled talents to ${destFile}`);
}

// Run compilation
compileSpecies();
compileCareers();
compileSpecializations();
compileTalents();
console.log("Oggdude XML dataset compiled successfully!");
