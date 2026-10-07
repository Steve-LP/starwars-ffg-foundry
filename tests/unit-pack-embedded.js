/**
 * Unit test (node): embedded documents in LevelDB packs match their NeDB source.
 * Checks parent ID lists against child keys (`!actors.items!<actorId>.<itemId>`, `!tables.results!...`)
 * and that legacy table results were migrated to the V13+ schema.
 * Foundry must be stopped (it locks the pack directories while running).
 * Run: node tests/unit-pack-embedded.js
 */
import fs from "fs";
import { ClassicLevel } from "classic-level";

const PACKS = [
  { name: "adversaries", collection: "actors", field: "items" },
  { name: "critical-injuries", collection: "tables", field: "results" },
  { name: "critical-injuries-vehicles", collection: "tables", field: "results" }
];

let pass = 0, fail = 0;
function assertEqual(name, actual, expected) {
  if (actual === expected) { pass++; console.log(`[PASS] ${name}`); }
  else { fail++; console.log(`[FAIL] ${name}: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

for (const { name, collection, field } of PACKS) {
  const source = fs.readFileSync(`packs/${name}.db`, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
  const expectedChildren = source.reduce((n, d) => n + (d[field]?.length ?? 0), 0);

  const db = new ClassicLevel(`packs/${name}`, { valueEncoding: "json" });
  await db.open();
  const parents = new Map(), children = new Map();
  for await (const [key, value] of db.iterator()) {
    if (key.startsWith(`!${collection}!`)) parents.set(value._id, value);
    else if (key.startsWith(`!${collection}.${field}!`)) children.set(key.slice(key.lastIndexOf("!") + 1), value);
  }
  await db.close();

  assertEqual(`${name}: parent documents`, parents.size, source.length);
  assertEqual(`${name}: embedded ${field}`, children.size, expectedChildren);

  const listed = [...parents.values()].flatMap(p => (p[field] ?? []).map(id => `${p._id}.${id}`));
  assertEqual(`${name}: parents list only plain IDs`, [...parents.values()].every(p => (p[field] ?? []).every(id => typeof id === "string")), true);
  assertEqual(`${name}: every listed ID has a child key`, listed.every(k => children.has(k)), true);
  assertEqual(`${name}: every child key is listed by its parent`, children.size === listed.length, true);

  if (collection === "tables") {
    const results = [...children.values()];
    assertEqual(`${name}: results use type "text"`, results.every(r => r.type === "text"), true);
    assertEqual(`${name}: results have description, no legacy text`, results.every(r => r.description && !("text" in r)), true);
  }
}

console.log("==================================================");
console.log(`TOTAL: ${pass + fail} | PASSED: ${pass} | FAILED: ${fail}`);
console.log("==================================================");
if (fail) process.exitCode = 1;
