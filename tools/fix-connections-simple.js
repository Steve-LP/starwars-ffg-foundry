const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, '..', 'packs', 'specializations.db');

function fixAmbassador() {
  if (!fs.existsSync(dbFile)) {
    console.error(`Database not found: ${dbFile}`);
    return;
  }

  const content = fs.readFileSync(dbFile, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  const updatedLines = [];

  for (const line of lines) {
    const doc = JSON.parse(line);
    if (doc.system?.key === 'ambassador') {
      console.log('Fixing Dedication up-line in Ambassador...');
      // Row 5 (index 4), Column 3 (index 2 - Dedication) -> set up: false
      doc.system.talentRows[4].directions[2].up = false;
    }
    updatedLines.push(JSON.stringify(doc));
  }

  fs.writeFileSync(dbFile, updatedLines.join('\n') + '\n', 'utf-8');
  console.log('Ambassador database connection fixed.');
}

fixAmbassador();
