/**
 * Headless test (Foundry console / macro, as GM): species bonus-skill choice (CHOICE_SPECIES)
 * with the real species compendium data.
 *
 *  - Without a choice, none of the options gets a free rank (no double grant from the data string).
 *  - setSpeciesSkillChoice() grants exactly one free rank to the chosen option; switching moves it.
 *  - Invalid options and species without a choice are rejected.
 *  - Re-applying a species clears the previous choice.
 *  - After lockCreation() the rank is persisted on the skill item and the choice is locked.
 */
(async function testSpeciesSkillChoice() {
  console.log("SWFFG TEST | Species Skill Choice");
  let passed = 0, failed = 0;
  function assert(name, condition, details = "") {
    if (condition) { console.log(`[PASS] ${name}`); passed++; }
    else { console.error(`[FAIL] ${name} ${details ? "(" + details + ")" : ""}`); failed++; }
  }

  const { CHOICE_SPECIES, normalizeSpeciesName } = await import("/systems/starwars-ffg-scratch/module/actor-sheet.js");
  const speciesDocs = await game.packs.get("starwars-ffg-scratch.species").getDocuments();
  const free = (actor, skill) => actor.derivedSkills?.[skill.toLowerCase()]?.freeRanks ?? 0;

  for (const speciesName of ["Twi'lek", "Devaronian", "Weequay", "Klatooinian"]) {
    const doc = speciesDocs.find(s => s.name === speciesName);
    const options = CHOICE_SPECIES[normalizeSpeciesName(speciesName)];
    const actor = await Actor.create({ name: `Choice-Tester ${speciesName}`, type: "character" }, { skipBuilder: true });
    try {
      await actor.applySpecies(doc.toObject());
      assert(`${speciesName}: no free rank before choosing`, options.every(o => free(actor, o) === 0),
        options.map(o => `${o}=${free(actor, o)}`).join(", "));

      const r1 = await actor.setSpeciesSkillChoice(options[0]);
      assert(`${speciesName}: choose ${options[0]} -> 1 rank, others 0`,
        r1.success && free(actor, options[0]) === 1 && options.slice(1).every(o => free(actor, o) === 0),
        options.map(o => `${o}=${free(actor, o)}`).join(", "));

      await actor.setSpeciesSkillChoice(options[1]);
      assert(`${speciesName}: switch to ${options[1]} moves the rank`,
        free(actor, options[1]) === 1 && free(actor, options[0]) === 0, options.map(o => `${o}=${free(actor, o)}`).join(", "));

      const bad = await actor.setSpeciesSkillChoice("Astrogation");
      assert(`${speciesName}: invalid option rejected`, bad.success === false && free(actor, options[1]) === 1, bad.message);

      await actor.applySpecies(doc.toObject());
      assert(`${speciesName}: re-applying the species clears the choice`,
        actor.system.creation.ledger.speciesSkillChoice === "" && options.every(o => free(actor, o) === 0));

      if (speciesName === "Twi'lek") {
        await actor.setSpeciesSkillChoice("Deception");
        await actor.lockCreation();
        const item = actor.items.find(i => i.type === "skill" && i.name === "Deception");
        assert("Twi'lek: after lock Deception rank 1 is persisted on the skill item",
          item?.system.value === 1 && item?.system.freeRanks === 1, `value ${item?.system.value}, freeRanks ${item?.system.freeRanks}`);
        const locked = await actor.setSpeciesSkillChoice("Charm");
        assert("Twi'lek: choice cannot be changed after lock", locked.success === false, locked.message);
      }
    } finally {
      await actor.delete();
    }
  }

  const human = await Actor.create({ name: "Choice-Tester Human", type: "character" }, { skipBuilder: true });
  try {
    await human.applySpecies(speciesDocs.find(s => s.name === "Human").toObject());
    const r = await human.setSpeciesSkillChoice("Charm");
    assert("Human: species without a choice option rejects setSpeciesSkillChoice", r.success === false, r.message);
  } finally {
    await human.delete();
  }

  console.log(`\nSWFFG TEST | Complete! PASSED: ${passed}, FAILED: ${failed}`);
  return { passed, failed };
})();
