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
  let found = false;

  for (const line of lines) {
    const doc = JSON.parse(line);
    if (doc.system?.key === 'ambassador') {
      found = true;
      console.log('Fixing Ambassador connection lines in database...');
      
      doc.system.talentRows = [
        {
          index: 0,
          cost: 5,
          talents: ["indis", "kill", "nobfool", "conf"],
          directions: [
            { up: false, down: false, left: false, right: false }, // Indistinguishable
            { up: false, down: true, left: false, right: false },  // Kill with Kindness -> down
            { up: false, down: false, left: false, right: false }, // Nobody's Fool
            { up: false, down: false, left: false, right: false }  // Confidence
          ]
        },
        {
          index: 1,
          cost: 10,
          talents: ["indis", "grit", "grit", "dodge"],
          directions: [
            { up: false, down: false, left: false, right: true },  // Indistinguishable -> right
            { up: true, down: true, left: true, right: false },   // Grit (up to Kill, down to Insp Rhet, left to Indis)
            { up: false, down: false, left: false, right: false }, // Grit
            { up: false, down: true, left: false, right: false }   // Dodge -> down
          ]
        },
        {
          index: 2,
          cost: 15,
          talents: ["kill", "insprhet", "stnerv", "conf"],
          directions: [
            { up: false, down: true, left: false, right: true },   // Kill with Kindness -> down, right
            { up: true, down: true, left: true, right: true },     // Inspiring Rhetoric -> up, down, left, right
            { up: false, down: false, left: true, right: true },   // Steely Nerves -> left, right
            { up: true, down: true, left: true, right: false }     // Confidence -> up, down, left
          ]
        },
        {
          index: 3,
          cost: 20,
          talents: ["insprhetimp", "intenspre", "worklikecharm", "dodge"],
          directions: [
            { up: true, down: false, left: false, right: false },  // Imp Insp Rhet -> up
            { up: true, down: true, left: false, right: true },    // Intense Presence -> up, down, right
            { up: false, down: false, left: true, right: false },  // Works Like a Charm -> left (no down)
            { up: true, down: false, left: false, right: false }   // Dodge -> up
          ]
        },
        {
          index: 4,
          cost: 25,
          talents: ["insprhetsup", "natcharm", "dedi", "sixsense"],
          directions: [
            { up: false, down: false, left: false, right: false }, // Supreme Insp Rhet -> no right connection
            { up: true, down: false, left: false, right: true },    // Natural Charmer -> up, right (no left connection)
            { up: false, down: false, left: true, right: true },   // Dedication -> left, right (no up)
            { up: false, down: false, left: true, right: false }   // Sixth Sense -> left
          ]
        }
      ];
    }
    updatedLines.push(JSON.stringify(doc));
  }

  if (found) {
    fs.writeFileSync(dbFile, updatedLines.join('\n') + '\n', 'utf-8');
    console.log('Ambassador connection lines fixed successfully!');
  } else {
    console.error('Ambassador specialization not found in database!');
  }
}

fixAmbassador();
