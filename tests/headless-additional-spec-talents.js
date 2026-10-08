/**
 * Headless test (Foundry console / macro, as GM): talents of an ADDITIONAL specialization during creation.
 * Real compendium data: Clone Soldier with starting spec Clone Pilot, Agitator bought as 2nd spec.
 *
 *  Logic: buying a talent in the 2nd spec costs its row price, is isolated from the 1st spec's tree
 *         and appears in the lock summary without deviation.
 *  UI:    in the Character Builder's talents tab, the button of the 2nd spec opens the 2nd spec's
 *         tree (regression: it always opened the starting spec).
 */
(async function testAdditionalSpecTalents() {
  console.log("SWFFG TEST | Talents of an Additional Specialization");
  let passed = 0, failed = 0;
  function assert(name, condition, details = "") {
    if (condition) { console.log(`[PASS] ${name}`); passed++; }
    else { console.error(`[FAIL] ${name} ${details ? "(" + details + ")" : ""}`); failed++; }
  }

  const { TalentTreeUtils } = await import("/systems/starwars-ffg-scratch/module/utils/talent-tree.js");
  const { CharacterBuilder } = await import("/systems/starwars-ffg-scratch/module/applications/character-builder.js");
  const docs = async (pack) => game.packs.get(`starwars-ffg-scratch.${pack}`).getDocuments();
  const specs = await docs("specializations");
  const spec = (name) => specs.find(s => s.name === name);

  const actor = await Actor.create({ name: "Spec2-Talent-Tester", type: "character" }, { skipBuilder: true });
  let builder = null;
  try {
    await actor.applySpecies((await docs("species")).find(s => s.name === "Human").toObject());
    await actor.applyCareer((await docs("careers")).find(c => c.name === "Clone Soldier"));
    await actor.applySpecialization(spec("Clone Pilot").toObject());
    await actor.buyAdditionalSpecialization(spec("Agitator").toObject());
    const agitator = actor.items.find(i => i.type === "specialization" && i.name === "Agitator");
    assert("1) Agitator owned as 2nd specialization", !!agitator);

    // Logic: buy the first talent of the Agitator tree
    const rows = agitator.system.talentRows;
    const raw = rows[0].talents[0];
    const key = typeof raw === "string" ? raw : (raw?.key ?? raw?.name);
    const before = actor.system.xp.available;
    const result = await actor.buyTalent({ name: key, key, specialization: "agitator", row: 0, col: 0 }, 5,
      { logDescription: `Kauf von Talent "${key}" (-5 XP) aus Agitator` });
    assert("2) Talent purchase in 2nd spec succeeds", result?.success !== false, result?.message);
    assert("3) Row-1 talent costs 5 XP", before - actor.system.xp.available === 5, `deducted ${before - actor.system.xp.available}`);

    const gridAgitator = TalentTreeUtils.buildGrid("Agitator", rows, [], actor);
    const pilot = actor.items.find(i => i.type === "specialization" && i.name === "Clone Pilot");
    const gridPilot = TalentTreeUtils.buildGrid("Clone Pilot", pilot.system.talentRows, [], actor);
    assert("4) Agitator tree shows the talent as purchased", gridAgitator[0].talents[0].purchased === true);
    assert("5) Clone Pilot tree is unaffected", gridPilot[0].talents.every(t => !t.purchased));

    // UI: the Agitator button in the builder's talents tab opens the Agitator tree
    builder = new CharacterBuilder({ actor });
    builder.currentStep = CharacterBuilder.STEPS.XP_SPENDING;
    builder.activeTab = "talents";
    await builder.render({ force: true });
    await new Promise(r => setTimeout(r, 300));
    const button = builder.element.querySelector(`[data-action="openTalentTree"][data-item-id="${agitator.id}"]`);
    assert("6) Builder lists a tree button for the 2nd spec", !!button);
    button?.click();
    await new Promise(r => setTimeout(r, 500));
    assert("7) Clicking it opens the Agitator tree", agitator.sheet.rendered === true && pilot.sheet.rendered !== true,
      `agitator open: ${agitator.sheet.rendered}, clone pilot open: ${pilot.sheet.rendered}`);
    await agitator.sheet.close();
    await builder.close();
    builder = null;

    // Lock: summary includes the talent, no deviation
    await actor.lockCreation();
    const summary = actor.system.xp.log.at(-1)?.description ?? "";
    assert("8) Lock summary has no deviation", summary.startsWith("Charaktererstellung abgeschlossen") && !summary.includes("Abweichung"), summary);
  } finally {
    if (builder) await builder.close();
    await actor.delete();
  }

  console.log(`\nSWFFG TEST | Complete! PASSED: ${passed}, FAILED: ${failed}`);
  return { passed, failed };
})();
