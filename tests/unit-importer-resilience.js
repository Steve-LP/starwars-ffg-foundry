import { parseOggdudeArmor, parseOggdudeGear, parseOggdudeAttachments, parseOggdudeWeapons } from "../module/oggdude-importer.js";

// Mock DOMParser for Node test environment if not present
if (typeof DOMParser === "undefined") {
  // Simple XML parser shim using regex for node testing
  globalThis.DOMParser = class {
    parseFromString(str, mime) {
      return {
        getElementsByTagName(tag) {
          const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
          const matches = [];
          let m;
          while ((m = regex.exec(str)) !== null) {
            const inner = m[1];
            matches.push({
              textContent: inner.replace(/<[^>]+>/g, "").trim(),
              getElementsByTagName(subTag) {
                const subRegex = new RegExp(`<${subTag}[^>]*>([\\s\\S]*?)<\\/${subTag}>`, "gi");
                const subMatches = [];
                let sm;
                while ((sm = subRegex.exec(inner)) !== null) {
                  subMatches.push({ textContent: sm[1].replace(/<[^>]+>/g, "").trim() });
                }
                return subMatches;
              }
            });
          }
          return matches;
        }
      };
    }
  };
}

console.log("==================================================");
console.log("SWFFG TEST | Importer Resilience & Skip Handling");
console.log("==================================================");

let passed = 0;
let failed = 0;

function assert(name, condition, details = "") {
  if (condition) {
    console.log(`[PASS] ${name}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name} ${details ? "(" + details + ")" : ""}`);
    failed++;
  }
}

// 1. Armor Parser with missing tags and corrupted data
const sampleArmorXml = `
<Armors>
  <Armor>
    <Key>VALID1</Key>
    <Name>Standard Vest</Name>
    <Soak>1</Soak>
    <Defense>0</Defense>
    <Price>200</Price>
    <Rarity>1</Rarity>
  </Armor>
  <Armor>
    <!-- Completely missing Key, Soak, Defense, Price -->
    <Name>Corrupted Entry With Defaults</Name>
  </Armor>
  <Armor>
    <Key>VALID2</Key>
    <Name>Heavy Armor</Name>
    <Soak>2</Soak>
    <Defense>1</Defense>
    <Price>3000</Price>
    <Rarity>7</Rarity>
    <Restricted>true</Restricted>
  </Armor>
</Armors>
`;

const parsedArmors = parseOggdudeArmor(sampleArmorXml);
assert("1) Armor parser processed all 3 entries without crashing", parsedArmors.length === 3, `got ${parsedArmors.length}`);
assert("2) First armor has correct parsed values", parsedArmors[0].name === "Standard Vest" && parsedArmors[0].system.soak === 1 && parsedArmors[0].system.price === 200);
assert("3) Corrupted armor safely defaulted soak/defense/price to 0", parsedArmors[1].system.soak === 0 && parsedArmors[1].system.defence === 0 && parsedArmors[1].system.price === 0);
assert("4) Third armor parsed successfully despite corrupted entry in between", parsedArmors[2].name === "Heavy Armor" && parsedArmors[2].system.soak === 2 && parsedArmors[2].system.restricted === true);

// 2. Attachment SlotType Fallback Verification
const sampleAttXml = `
<ItemAttachments>
  <ItemAttachment>
    <Key>W1</Key>
    <Name>Laser Sight</Name>
    <Type>Weapon</Type>
    <HP>1</HP>
  </ItemAttachment>
  <ItemAttachment>
    <Key>A1</Key>
    <Name>Armor Plating</Name>
    <Type>Armor</Type>
    <HP>2</HP>
  </ItemAttachment>
  <ItemAttachment>
    <Key>V1</Key>
    <Name>Hyperdrive Module Class 4</Name>
    <Type>Vehicle / Starship</Type>
    <HP>3</HP>
  </ItemAttachment>
</ItemAttachments>
`;

const parsedAtts = parseOggdudeAttachments(sampleAttXml);
assert("5) Weapon attachment got slotType 'weapon'", parsedAtts[0].system.slotType === "weapon");
assert("6) Armor attachment got slotType 'armor'", parsedAtts[1].system.slotType === "armor");
assert("7) Vehicle attachment received slotType 'vehicle'", parsedAtts[2].system.slotType === "vehicle");

console.log("==================================================");
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("==================================================");
