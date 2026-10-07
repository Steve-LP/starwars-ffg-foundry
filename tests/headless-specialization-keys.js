/**
 * Headless test (Foundry console / macro): specialization keys & in-career specialization costs
 * against the REAL compendium data (no hand-made career/spec fixtures).
 *
 *  1. Every specialization keeps its `system.key` (SpecializationData schema field).
 *  2. Every spec key referenced by a career resolves to a compendium specialization.
 *  3. Spec costs during creation and after the career snapshot is dropped by lockCreation():
 *     in-career = 10 x N, out-of-career = 10 x N + 10.
 *  4. removeCareer() clears biography.careerSpecializations.
 */
(async function testSpecializationKeys() {
  console.log("SWFFG TEST | Specialization Keys & In-Career Costs");
  let passed = 0, failed = 0;
  function assert(name, condition, details = "") {
    if (condition) { console.log(`[PASS] ${name}`); passed++; }
    else { console.error(`[FAIL] ${name} ${details ? "(" + details + ")" : ""}`); failed++; }
  }

  const specs = await game.packs.get("starwars-ffg-scratch.specializations").getDocuments();
  const careers = await game.packs.get("starwars-ffg-scratch.careers").getDocuments();
  const spec = (name) => specs.find(s => s.name === name);

  // 1) Keys survive loading
  const withoutKey = specs.filter(s => !s.system.key).map(s => s.name);
  assert(`1) All ${specs.length} specializations have system.key`, withoutKey.length === 0, `missing: ${withoutKey.slice(0, 5).join(", ")}`);

  // 2) Career -> specialization references resolve (same match as the Character Builder)
  const unresolved = [];
  for (const career of careers) {
    for (const key of career.system.specializations ?? []) {
      if (!specs.some(s => (s.system.key || s.name).toLowerCase().trim() === String(key).toLowerCase().trim())) unresolved.push(`${career.name}:${key}`);
    }
  }
  assert("2) Every career spec key resolves to a specialization", unresolved.length === 0, unresolved.join(", "));

  // 3) Costs with a real career (Guardian) and its real starting spec (Warden)
  const guardian = careers.find(c => c.name === "Guardian");
  const actor = await Actor.create({ name: "Spec-Key-Tester", type: "character" }, { skipBuilder: true });
  try {
    await actor.applyCareer(guardian);
    assert("3.A) applyCareer stores the career spec keys on biography",
      actor.system.biography.careerSpecializations.length === guardian.system.specializations.length,
      JSON.stringify(actor.system.biography.careerSpecializations));

    await actor.createEmbeddedDocuments("Item", [spec("Warden").toObject()]);

    const cost = (name) => actor.calculateSpecializationCost(spec(name));
    assert("3.B) Creation: 2nd spec Warleader (in-career, key = name) costs 20", cost("Warleader") === 20, `got ${cost("Warleader")}`);
    assert("3.C) Creation: 2nd spec Peacekeeper (in-career, key 'peace' != name) costs 20", cost("Peacekeeper") === 20, `got ${cost("Peacekeeper")}`);
    assert("3.D) Creation: 2nd spec Pilot (other career) costs 30", cost("Pilot") === 30, `got ${cost("Pilot")}`);

    // Same state lockCreation() leaves behind: snapshot dropped, creation mode off
    await actor.update({ "system.creation.careerSnapshot": null, "system.creation.isCreationMode": false });
    assert("3.E) After lock: Peacekeeper still in-career (20)", cost("Peacekeeper") === 20, `got ${cost("Peacekeeper")}`);
    assert("3.F) After lock: Soresu Defender still in-career (20)", cost("Soresu Defender") === 20, `got ${cost("Soresu Defender")}`);
    assert("3.G) After lock: Pilot still out-of-career (30)", cost("Pilot") === 30, `got ${cost("Pilot")}`);

    // 4) Removing the career clears the persisted keys
    await actor.update({ "system.creation.isCreationMode": true });
    await actor.removeCareer(false);
    assert("4) removeCareer clears biography.careerSpecializations", actor.system.biography.careerSpecializations.length === 0,
      JSON.stringify(actor.system.biography.careerSpecializations));
  } finally {
    await actor.delete();
  }

  console.log(`\nSWFFG TEST | Complete! PASSED: ${passed}, FAILED: ${failed}`);
  return { passed, failed };
})();
