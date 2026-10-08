/**
 * Unit test (node): formatOggdudeDescription() turns OggDude BBCode into well-formed HTML.
 * Case-sensitive tags ([B]open/[b]close), [P] paragraphs, dice symbols incl. short codes,
 * plus a sweep over every <Description> in tools/data-oggdude.
 * Run: node tests/unit-oggdude-description.js
 */
import fs from "fs";
import path from "path";
import { formatOggdudeDescription as format } from "../module/oggdude-importer.js";

let pass = 0, fail = 0;
function assertEqual(name, actual, expected) {
  if (actual === expected) { pass++; console.log(`[PASS] ${name}`); }
  else { fail++; console.log(`[FAIL] ${name}: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

/** Returns null if all tags are properly nested and closed, otherwise the first problem. */
function nestingProblem(html) {
  const stack = [];
  for (const [, closing, tag] of html.matchAll(/<(\/?)([a-z0-9]+)[^>]*>/gi)) {
    if (/^(br|img|hr)$/i.test(tag)) continue;
    if (!closing) stack.push(tag.toLowerCase());
    else if (stack.pop() !== tag.toLowerCase()) return `unexpected </${tag}>`;
  }
  return stack.length ? `unclosed <${stack.at(-1)}>` : null;
}

assertEqual("Heading and paragraph", format("[H4]Chiss[h4] Blue skin."), "<h4>Chiss</h4><p>Blue skin.</p>");
assertEqual("Bold label pairs", format("[P][B]Physiology:[b] text"), "<p><strong>Physiology:</strong> text</p>");
assertEqual("[P] separates paragraphs", format("One.[P]Two."), "<p>One.</p><p>Two.</p>");
assertEqual("Blank line separates paragraphs", format("One.\n\n  Two."), "<p>One.</p><p>Two.</p>");
assertEqual("Italic pairs", format("[I]Lore[i]"), "<p><em>Lore</em></p>");
assertEqual("Dice symbol long form", format("add [SETBACK]"), "<p>add <strong>[Setback]</strong></p>");
assertEqual("Dice symbol short forms", format("[SE][BO][AD][TR]"),
  "<p><strong>[Setback]</strong><strong>[Boost]</strong><strong>[Advantage]</strong><strong>[Triumph]</strong></p>");
assertEqual("Unknown tokens stay untouched", format("Rank [11]"), "<p>Rank [11]</p>");
assertEqual("Empty input", format(""), "");

// Sweep over all OggDude descriptions in the repository
const root = "tools/data-oggdude";
const files = [];
const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) walk(p); else if (p.endsWith(".xml")) files.push(p);
} };
walk(root);

let total = 0;
const problems = [];
for (const file of files) {
  const xml = fs.readFileSync(file, "utf8");
  for (const [, raw] of xml.matchAll(/<Description>([\s\S]*?)<\/Description>/g)) {
    total++;
    const html = format(raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
    const problem = nestingProblem(html) || (/\[(H[34]|h[34]|B|b|I|i|P)\]/.test(html) ? "leftover BBCode tag" : null);
    if (problem) problems.push(`${path.basename(file)}: ${problem}`);
  }
}
assertEqual(`All ${total} OggDude descriptions convert to well-formed HTML`, problems.slice(0, 5).join(" | "), "");

console.log("==================================================");
console.log(`TOTAL: ${pass + fail} | PASSED: ${pass} | FAILED: ${fail}`);
console.log("==================================================");
if (fail) process.exitCode = 1;
