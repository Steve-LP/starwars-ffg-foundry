/**
 * Headless test (Foundry console / macro, as GM): XP log during character creation.
 *
 *  - Purchases during creation (attribute, skill rank, talent, additional specialization) add NO log entries.
 *  - An out-of-career specialization bought during creation is deducted at the price shown (+10 XP).
 *  - GM actions during creation (sandbox toggle) are still logged.
 *  - lockCreation() adds exactly ONE summary entry; its amount equals the XP actually spent
 *    and the per-category breakdown adds up (no "Abweichung").
 *  - After locking, purchases are logged individually again.
 */
(async function testXpLogSummary() {
  console.log("SWFFG TEST | XP Log Summary at Lock");
  let passed = 0, failed = 0;
  function assert(name, condition, details = "") {
    if (condition) { console.log(`[PASS] ${name}`); passed++; }
    else { console.error(`[FAIL] ${name} ${details ? "(" + details + ")" : ""}`); failed++; }
  }

  const docs = async (pack) => game.packs.get(`starwars-ffg-scratch.${pack}`).getDocuments();
  const human = (await docs("species")).find(s => s.name === "Human");
  const guardian = (await docs("careers")).find(c => c.name === "Guardian");
  const specs = await docs("specializations");
  const spec = (name) => specs.find(s => s.name === name);

  const actor = await Actor.create({ name: "XP-Log-Tester", type: "character" }, { skipBuilder: true });
  try {
    await actor.applySpecies(human);
    await actor.applyCareer(guardian);
    await actor.applySpecialization(spec("Warden").toObject());

    // GM action during creation stays logged (grantXp is blocked in creation by design; sandbox toggle is allowed)
    let logLen = actor.system.xp.log.length;
    await actor.toggleSandboxMode();
    await actor.toggleSandboxMode();
    assert("1) GM sandbox toggles during creation are logged", actor.system.xp.log.length === logLen + 2,
      `log ${logLen} -> ${actor.system.xp.log.length}`);

    // Purchases during creation are not logged
    logLen = actor.system.xp.log.length;
    const before = actor.system.xp.available;
    const r1 = await actor.buyAttribute("agility");
    const r2 = await actor.buySkillRank("Melee", "brawn", "Combat");
    const r3 = await actor.buyTalent({ name: "Grit", key: "grit", specialization: "warden", row: 0, col: 0 }, 5,
      { logDescription: 'Kauf von Talent "Grit" (-5 XP)' });
    const r4 = await actor.buyAdditionalSpecialization(spec("Peacekeeper").toObject());
    // Out-of-career spec during creation: actual deduction must equal the price shown (3rd spec: 30 + 10)
    const pilotPrice = actor.calculateSpecializationCost(spec("Pilot"));
    const beforePilot = actor.system.xp.available;
    await actor.buyAdditionalSpecialization(spec("Pilot").toObject());
    const pilotCharged = beforePilot - actor.system.xp.available;
    assert("2b) Out-of-career spec in creation: price shown is 40", pilotPrice === 40, `got ${pilotPrice}`);
    assert("2c) Out-of-career spec in creation: XP deducted equals price shown", pilotCharged === pilotPrice,
      `shown ${pilotPrice}, deducted ${pilotCharged}`);
    const spent = before - actor.system.xp.available;
    assert("2) Creation purchases succeeded", [r1, r2, r3, r4].every(r => r?.success !== false),
      JSON.stringify([r1, r2, r3, r4].map(r => r?.message)));
    assert("3) Creation purchases spent XP", spent > 0, `spent ${spent}`);
    assert("4) No log entries for creation purchases", actor.system.xp.log.length === logLen,
      `log ${logLen} -> ${actor.system.xp.log.length}: ${actor.system.xp.log.slice(logLen).map(e => e.description).join(" | ")}`);

    // Lock: exactly one summary entry matching the actual spend
    const total = actor.system.xp.total, available = actor.system.xp.available;
    const lock = await actor.lockCreation();
    const newEntries = actor.system.xp.log.slice(logLen);
    assert("5) lockCreation succeeded", lock?.success !== false, lock?.message);
    assert("6) Exactly one log entry added at lock", newEntries.length === 1,
      newEntries.map(e => `${e.change} ${e.description}`).join(" | "));
    const summary = newEntries[0];
    assert("7) Summary amount equals XP actually spent", summary?.change === `-${total - available}`,
      `entry ${summary?.change}, spent ${total - available}`);
    assert("8) Breakdown adds up (no deviation)", !!summary && !summary.description.includes("Abweichung"), summary?.description);
    assert("9) Breakdown lists all categories bought",
      ["Attribute", "Fertigkeiten", "Spezialisierungen", "Talente"].every(l => summary?.description.includes(l)), summary?.description);
    console.log(`SWFFG TEST | Summary entry: ${summary?.change} | ${summary?.description}`);

    // After lock: purchases are logged individually again
    logLen = actor.system.xp.log.length;
    await actor.buySkillRank("Vigilance", "willpower", "General");
    const last = actor.system.xp.log.at(-1);
    assert("10) In-play skill purchase is logged", actor.system.xp.log.length === logLen + 1 && last.description.startsWith("Rang erworben"),
      last?.description);
  } finally {
    await actor.delete();
  }

  console.log(`\nSWFFG TEST | Complete! PASSED: ${passed}, FAILED: ${failed}`);
  return { passed, failed };
})();
