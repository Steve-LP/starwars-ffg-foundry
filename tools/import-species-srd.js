const fs = require('fs');
const path = require('path');

const slugs = [
  'aqualish',   'arcona',      'besalisk',
  'bothan',     'chevin',      'chiss',
  'clawdite',   'devaronian',  'droid',
  'dug',        'duros',       'falleen',
  'gand',       'gotal',       'gran',
  'human',      'kalleran',    'klatooinian',
  'mirialan',   'mustafarian', 'quarren',
  'rodian',     'togruta',     'toydarian',
  'trandoshan', 'twilek',      'weequay',
  'wookiee'
];

const slugToDbMap = {
  'aqualish': { key: 'aqua', name: 'Aqualish' },
  'arcona': { key: 'arcona', name: 'Arcona' },
  'besalisk': { key: 'besalisk', name: 'Besalisk' },
  'bothan': { key: 'both', name: 'Bothan' },
  'chevin': { key: 'chevin', name: 'Chevin' },
  'chiss': { key: 'chiss', name: 'Chiss' },
  'clawdite': { key: 'clawdite', name: 'Clawdite' },
  'devaronian': { key: 'devar', name: 'Devaronian' },
  'droid': { key: 'droid', name: 'Droid' },
  'dug': { key: 'dug', name: 'Dug' },
  'duros': { key: 'duros', name: 'Duros' },
  'falleen': { key: 'falleen', name: 'Falleen' },
  'gand': { key: 'gand', name: 'Gand' },
  'gotal': { key: 'gotal', name: 'Gotal' },
  'gran': { key: 'gran', name: 'Gran' },
  'human': { key: 'human', name: 'Human' },
  'kalleran': { key: 'kalleran', name: 'Kalleran' },
  'klatooinian': { key: 'klatoo', name: 'Klatooinian' },
  'mirialan': { key: 'mirialan', name: 'Mirialan' },
  'mustafarian': { key: 'mustafarian', name: 'Mustafarian' },
  'quarren': { key: 'quarren', name: 'Quarren' },
  'rodian': { key: 'rod', name: 'Rodian' },
  'togruta': { key: 'togruta', name: 'Togruta' },
  'toydarian': { key: 'toydarian', name: 'Toydarians' },
  'trandoshan': { key: 'trand', name: 'Trandoshan' },
  'twilek': { key: 'twi', name: "Twi'lek" },
  'weequay': { key: 'weequay', name: 'Weequay' },
  'wookiee': { key: 'wook', name: 'Wookiee' }
};

const pagesDir = '/home/steve/.gemini/antigravity/brain/1967c286-33b3-491b-b5bd-30392f36fcec/scratch/srd_pages';
const dbPath = path.join(__dirname, '..', 'packs', 'species.db');

function decodeEntities(str) {
  return str
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function cleanBlock(html) {
  let cleaned = html;
  
  // Replace SVGs representing dice
  cleaned = cleaned.replace(/<svg[^>]*>[\s\S]*?<g id="setback"[\s\S]*?<\/svg>/g, ' [SETBACK] ');
  cleaned = cleaned.replace(/<svg[^>]*>[\s\S]*?<g id="boost"[\s\S]*?<\/svg>/g, ' [BOOST] ');
  cleaned = cleaned.replace(/<svg[^>]*>[\s\S]*?<\/svg>/g, ''); // Remove other SVGs
  
  // Remove Gatsby comments
  cleaned = cleaned.replace(/<!--.*?-->/g, '');
  
  // Strip links from text inside abilities (e.g. status effect links)
  cleaned = cleaned.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1');
  
  // Replace list elements or divs with linebreaks/markers
  cleaned = cleaned.replace(/<li[^>]*>/gi, '\n* ');
  cleaned = cleaned.replace(/<\/li>/gi, '');
  cleaned = cleaned.replace(/<ul[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/ul>/gi, '');
  cleaned = cleaned.replace(/<div[^>]*>/gi, '\n');
  cleaned = cleaned.replace(/<\/div>/gi, '');
  cleaned = cleaned.replace(/<p[^>]*>/gi, '\n');
  cleaned = cleaned.replace(/<\/p>/gi, '');
  cleaned = cleaned.replace(/<span[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/span>/gi, '');
  
  cleaned = decodeEntities(cleaned);
  
  // Split lines, clean them up
  let rawLines = cleaned.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  let lines = [];
  for (let line of rawLines) {
    // Remove leading bullet/asterisk/dots
    line = line.replace(/^[\*\•\s\-\u2022]+/, '').trim();
    if (!line) continue;
    
    // Clean up redundant "Special Abilities:" prefix
    line = line.replace(/^Special Abilities:\s*/i, '');
    if (!line) continue;
    
    lines.push(line);
  }
  
  // Rejoin with <br><br>
  let finalHtml = '';
  for (let line of lines) {
    // Add strong tags for headings of abilities
    if (line.match(/^[A-Za-z0-9\/\s\-\(\)]+:/)) {
      line = line.replace(/^([A-Za-z0-9\/\s\-\(\)]+:)/, '<strong>$1</strong>');
    }
    
    if (finalHtml) finalHtml += '<br><br>';
    finalHtml += line;
  }
  
  return finalHtml;
}

function runImport() {
  console.log("Loading existing species.db...");
  if (!fs.existsSync(dbPath)) {
    console.error(`Database file not found at: ${dbPath}`);
    return;
  }
  
  const dbContent = fs.readFileSync(dbPath, 'utf8');
  const dbLines = dbContent.trim().split('\n');
  const dbDocs = dbLines.map(line => JSON.parse(line));
  console.log(`Loaded ${dbDocs.length} species records from compendium.`);

  let updatedCount = 0;

  for (const slug of slugs) {
    const filePath = path.join(pagesDir, `${slug}.html`);
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found for ${slug}: ${filePath}`);
      continue;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const mapping = slugToDbMap[slug];
    if (!mapping) {
      console.warn(`No mapping found for slug: ${slug}`);
      continue;
    }

    // Find document in DB by name or key
    const doc = dbDocs.find(d => d.name === mapping.name || d.system.key === mapping.key);
    if (!doc) {
      console.warn(`Could not find compendium entry for: ${mapping.name} (Key: ${mapping.key})`);
      continue;
    }

    // 1. Extract Wookieepedia Link
    const wookieeMatch = content.match(/<strong>Wookiepedia Link:<\/strong>\s*<a[^>]*href="([^"]+)"/i);
    const wookieeLink = wookieeMatch ? wookieeMatch[1] : '';

    // 2. Extract Characteristics
    const tableMatch = content.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
    const stats = {};
    if (tableMatch) {
      const tableHtml = tableMatch[1];
      const tds = tableHtml.match(/<td[^>]*>(\d+)<\/td>/gi);
      if (tds && tds.length >= 6) {
        const vals = tds.map(td => parseInt(td.replace(/<[^>]*>/g, '').trim()));
        stats.brawn = vals[0];
        stats.agility = vals[1];
        stats.intellect = vals[2];
        stats.cunning = vals[3];
        stats.willpower = vals[4];
        stats.presence = vals[5];
      }
    }

    // 3. Extract Thresholds and Starting XP
    const woundMatch = content.match(/•\s*Wound\s+Threshold:\s*(\d+)\s*\+\s*([a-zA-Z]+)/i);
    const woundBase = woundMatch ? parseInt(woundMatch[1]) : null;

    const strainMatch = content.match(/•\s*Strain\s+Threshold:\s*(\d+)\s*\+\s*([a-zA-Z]+)/i);
    const strainBase = strainMatch ? parseInt(strainMatch[1]) : null;

    const xpMatch = content.match(/•\s*Starting\s+Experience:\s*(\d+)\s*XP/i);
    const startingXp = xpMatch ? parseInt(xpMatch[1]) : null;

    // 4. Extract Lore details (Homeworld, Language, Professions)
    const homeworldMatch = content.match(/<p[^>]*>Homeworld:\s*([^<]+)<\/p>/i);
    const homeworld = homeworldMatch ? decodeEntities(homeworldMatch[1].trim()) : '';

    const languageMatch = content.match(/<p[^>]*>Language:\s*([\s\S]*?)<\/p>/i);
    const language = languageMatch ? decodeEntities(languageMatch[1].replace(/<[^>]*>/g, '').trim()) : '';

    const professionsMatch = content.match(/<p[^>]*>Common\s+Professions:\s*([\s\S]*?)<\/p>/i);
    const professions = professionsMatch ? decodeEntities(professionsMatch[1].replace(/<[^>]*>/g, '').trim()) : '';

    // 5. Extract and Clean Special Abilities
    const startIndex = content.search(/Starting\s+Experience:/i);
    const endIndex = content.search(/Homeworld:/i);
    let specialAbilities = '';
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      let slice = content.substring(startIndex, endIndex);
      slice = slice.replace(/^[\s\S]*?Starting\s+Experience:\s*\d+\s*XP[\s\S]*?<\/li>/i, '');
      specialAbilities = cleanBlock(slice);
    }

    // Apply updates to the database document
    if (stats.brawn !== undefined) {
      doc.system.characteristics.brawn.value = stats.brawn;
      doc.system.characteristics.agility.value = stats.agility;
      doc.system.characteristics.intellect.value = stats.intellect;
      doc.system.characteristics.cunning.value = stats.cunning;
      doc.system.characteristics.willpower.value = stats.willpower;
      doc.system.characteristics.presence.value = stats.presence;
    }

    if (woundBase !== null) {
      doc.system.wounds = doc.system.wounds || {};
      doc.system.wounds.base = woundBase;
    }
    if (strainBase !== null) {
      doc.system.strain = doc.system.strain || {};
      doc.system.strain.base = strainBase;
    }
    if (startingXp !== null) {
      doc.system.xp = startingXp;
    }

    if (specialAbilities) {
      doc.system.specialAbilities = specialAbilities;
    }

    // Build description HTML
    let metadataHtml = ``;
    if (wookieeLink) {
      metadataHtml += `<p><strong>Wookiepedia Link:</strong> <a href="${wookieeLink}" target="_blank" rel="noopener noreferrer">${wookieeLink}</a></p>`;
    }
    if (homeworld) {
      metadataHtml += `<p><strong>Homeworld:</strong> ${homeworld}</p>`;
    }
    if (language) {
      metadataHtml += `<p><strong>Language:</strong> ${language}</p>`;
    }
    if (professions) {
      metadataHtml += `<p><strong>Common Professions:</strong> ${professions}</p>`;
    }

    const currentDesc = doc.system.description || '';
    const isPlaceholder = !currentDesc || 
                          currentDesc.includes('Please see page') || 
                          currentDesc.includes('Core Rulebook') || 
                          currentDesc.includes('Sourcebook') ||
                          currentDesc.length < 150;

    if (isPlaceholder) {
      doc.system.description = `<h4>${mapping.name}</h4>\n${metadataHtml}`;
    } else {
      // Keep rich description and append metadata at the end if not already appended
      if (!currentDesc.includes('Wookiepedia Link') && !currentDesc.includes('Homeworld:')) {
        doc.system.description = `${currentDesc}\n<hr>\n${metadataHtml}`;
      }
    }

    console.log(`Updated: ${mapping.name} (Key: ${mapping.key})`);
    updatedCount++;
  }

  if (updatedCount > 0) {
    const outputContent = dbDocs.map(d => JSON.stringify(d)).join('\n') + '\n';
    fs.writeFileSync(dbPath, outputContent, 'utf8');
    console.log(`Successfully merged and saved ${updatedCount} species records in ${dbPath}`);
  } else {
    console.log("No species were updated.");
  }
}

runImport();
