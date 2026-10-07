/**
 * Headless test (Foundry console / macro, as GM): species starting skills for ALL species.
 * Every skill listed in a species' data (system.modifiers.skills) must end up as free ranks on a
 * fresh character after applySpecies() — including legacy names like "Education"
 * (-> "Knowledge: Education"). Choice options (CHOICE_SPECIES) are covered by
 * headless-species-skill-choice.js and skipped here. Entries without a skill name are reported.
 */
(async function testSpeciesSkillRanks() {
  console.log("SWFFG TEST | Species Starting Skill Ranks (all species)");
  let passed = 0, failed = 0;
  function assert(name, condition, details = "") {
    if (condition) { console.log(`[PASS] ${name}`); passed++; }
    else { console.error(`[FAIL] ${name} ${details ? "(" + details + ")" : ""}`); failed++; }
  }

  const { CHOICE_SPECIES, normalizeSpeciesName } = await import("/systems/starwars-ffg-scratch/module/actor-sheet.js");
  const { normalizeSkillName } = await import("/systems/starwars-ffg-scratch/module/utils/skill-normalization.js");
  const speciesDocs = await game.packs.get("starwars-ffg-scratch.species").getDocuments();

  const missing = [], dataIssues = [];
  let checkedSkills = 0;
  const actor = await Actor.create({ name: "Species-Rank-Tester", type: "character" }, { skipBuilder: true });
  try {
    for (const species of speciesDocs) {
      const entries = (species.system.modifiers?.skills || "").split(",").map(p => p.trim()).filter(Boolean);
      if (!entries.length) continue;
      const choices = (CHOICE_SPECIES[normalizeSpeciesName(species.name)] || []).map(c => c.toLowerCase());
      await actor.applySpecies(species.toObject());

      const expected = {};
      for (const entry of entries) {
        const [rawName, rawValue] = entry.split(":");
        const name = normalizeSkillName(rawName || "");
        if (!name) { dataIssues.push(`${species.name}: "${entry}"`); continue; }
        if (choices.includes(name.toLowerCase())) continue;
        expected[name.toLowerCase()] = (expected[name.toLowerCase()] || 0) + (parseInt(rawValue) || 1);
      }
      for (const [skill, ranks] of Object.entries(expected)) {
        checkedSkills++;
        const free = actor.derivedSkills?.[skill]?.freeRanks ?? null;
        if (free === null || free < ranks) missing.push(`${species.name}: ${skill} expected ${ranks}, got ${free ?? "no skill"}`);
      }
    }
  } finally {
    await actor.delete();
  }

  assert(`All ${checkedSkills} listed species skills grant their free ranks`, missing.length === 0, missing.join("; "));
  if (dataIssues.length) console.warn(`SWFFG TEST | Data entries without skill name (see TODO): ${dataIssues.join(", ")}`);

  console.log(`\nSWFFG TEST | Complete! PASSED: ${passed}, FAILED: ${failed}`);
  return { passed, failed, checkedSkills, missing, dataIssues };
})();
