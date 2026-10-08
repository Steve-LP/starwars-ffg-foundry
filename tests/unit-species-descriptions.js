/**
 * Unit test (node): uniform species descriptions in packs/species.db
 * (built by tools/build-species-descriptions.mjs).
 * Every species: facts block with heading, source and Wookieepedia link; SRD facts where saved;
 * descriptive text where the OggDude data has some; well-formed HTML; no bare rulebook references.
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

function nestingProblem(html) {
  const stack = [];
  for (const [, closing, tag] of html.matchAll(/<(\/?)([a-z0-9]+)[^>]*>/gi)) {
    if (/^br$/i.test(tag)) continue;
    if (!closing) stack.push(tag.toLowerCase());
    else if (stack.pop() !== tag.toLowerCase()) return `unexpected </${tag}>`;
  }
  return stack.length ? `unclosed <${stack.at(-1)}>` : null;
}

const names = (list) => list.map(s => s.name).join(", ");
const desc = (s) => s.system.description || "";
const block = (s) => desc(s).match(/^<div class="swffg-species-facts">([\s\S]*?)<\/div>/)?.[1] ?? "";

assertEqual("Every description starts with the facts block", names(species.filter(s => !block(s))), "");
assertEqual("Facts block heading is the species name", names(species.filter(s => !block(s).startsWith(`<h4>${s.name.replace(/&/g, "&amp;")}</h4>`))), "");
assertEqual("Every species names its source", names(species.filter(s => !/<strong>Quelle:<\/strong> [^<]+/.test(block(s)))), "");
// Fan-made "Unofficial Species Menagerie" entries have no page numbers; official sources must have one
assertEqual("Official sources include a page", names(species.filter(s => !/Unofficial Species Menagerie/.test(block(s))
  && !/<strong>Quelle:<\/strong> [^<]+, S\. \d+/.test(block(s)))), "");
assertEqual("Every species links Wookieepedia", names(species.filter(s => !/href="https:\/\/starwars\.fandom\.com\/wiki\/[^"]+"/.test(block(s)))), "");
assertEqual("Saved SRD facts are shown (27 species)", species.filter(s => facts[s.name] && block(s).includes("<strong>Heimatwelt:</strong>")).length, 27);
assertEqual("63 species keep their descriptive text", species.filter(s => desc(s).includes('<div class="swffg-species-text">')).length, 63);
assertEqual("All descriptions are well-formed HTML", species.map(s => nestingProblem(desc(s)) && `${s.name}: ${nestingProblem(desc(s))}`).filter(Boolean).join(" | "), "");
assertEqual("No leftover BBCode or broken heading markup", names(species.filter(s => /\[(H[34]|h[34]|B|b|I|i|P)\]|<\/h4>[^<]*<\/h4>/.test(desc(s)))), "");
assertEqual("No bare rulebook references", names(species.filter(s => /please see page \d+/i.test(desc(s)))), "");

console.log("==================================================");
console.log(`TOTAL: ${pass + fail} | PASSED: ${pass} | FAILED: ${fail}`);
console.log("==================================================");
if (fail) process.exitCode = 1;
