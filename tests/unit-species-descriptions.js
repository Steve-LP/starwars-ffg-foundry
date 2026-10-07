/**
 * Unit test (node): species descriptions in packs/species.db.
 * No description may consist of a bare rulebook reference anymore; generated fact blocks
 * (tools/build-species-descriptions.mjs) carry a source, a Wookieepedia link and, where saved
 * SRD facts exist, homeworld/language/professions.
 * Run: node tests/unit-species-descriptions.js
 */
import fs from "fs";

const facts = JSON.parse(fs.readFileSync("tools/data-srd/species-facts.json", "utf8"));
const species = fs.readFileSync("packs/species.db", "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));

let pass = 0, fail = 0;
function assertEqual(name, actual, expected) {
  if (actual === expected) { pass++; console.log(`[PASS] ${name}`); }
  else { fail++; console.log(`[FAIL] ${name}: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

const plain = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const generated = species.filter(s => s.system.description?.includes("swffg-species-facts"));
const bareReferences = species.filter(s => !s.system.description?.includes("swffg-species-facts")
  && /see\s+page\s+\d+/i.test(plain(s.system.description || "")) && plain(s.system.description || "").length < 300);

assertEqual("No bare rulebook references left", bareReferences.map(s => s.name).join(", "), "");
assertEqual("50 generated fact blocks", generated.length, 50);
assertEqual("Every fact block names its source", generated.every(s => /<strong>Quelle:<\/strong> Page \d+/.test(s.system.description)), true);
assertEqual("Every fact block links Wookieepedia", generated.every(s => /href="https:\/\/starwars\.fandom\.com\/wiki\/[^"]+"/.test(s.system.description)), true);
assertEqual("Fact blocks with saved SRD facts show homeworld", generated.filter(s => facts[s.name]).every(s => s.system.description.includes("<strong>Heimatwelt:</strong>")), true);
assertEqual("11 fact blocks with SRD facts", generated.filter(s => facts[s.name]).length, 11);
assertEqual("No broken heading markup (</h4>Name</h4>) in fact blocks", generated.some(s => /^<\/h4>/.test(s.system.description)), false);

console.log("==================================================");
console.log(`TOTAL: ${pass + fail} | PASSED: ${pass} | FAILED: ${fail}`);
console.log("==================================================");
if (fail) process.exitCode = 1;
