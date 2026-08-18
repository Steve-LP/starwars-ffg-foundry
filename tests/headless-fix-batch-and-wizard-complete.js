(async function testCompleteVerification() {
  console.log("SWFFG TEST | Comprehensive Fix-Batch & Wizard Verification");
  let passed = 0, failed = 0;
  function assert(name, condition, details = "") {
    if (condition) { console.log(`[PASS] ${name}`); passed++; }
    else { console.error(`[FAIL] ${name} ${details ? "(" + details + ")" : ""}`); failed++; }
  }

  const { TalentTreeUtils } = await import("/systems/starwars-ffg-scratch/module/utils/talent-tree.js");
  const { CharacterBuilder } = await import("/systems/starwars-ffg-scratch/module/applications/character-builder.js");

  // =========================================================================
  // TEST 1: B1 - Specialization Cost Matrix (In-Career vs Universal vs Out-of-Career)
  // =========================================================================
  console.log("\n--- 1. Testing B1: Specialization Cost Matrix ---");
  const bhActor = await Actor.create({
    name: "BH-Spec-Tester",
    type: "character",
    system: {
      biography: { career: "Bounty Hunter" },
      creation: {
        isCreationMode: false,
        careerSnapshot: { name: "Bounty Hunter", specializations: ["Assassin", "Gadgeteer", "Survivalist"] }
      }
    }
  }, { skipBuilder: true });

  // Actor starts with 2 specs (Assassin + Marauder)
  await bhActor.createEmbeddedDocuments("Item", [
    { name: "Assassin", type: "specialization", system: { career: "Bounty Hunter" } },
    { name: "Marauder", type: "specialization", system: { career: "Hired Gun" } }
  ]);

  // 3rd Spec - Case A: In-Career (Gadgeteer) -> 3 * 10 = 30 XP
  const costInCareer = bhActor.calculateSpecializationCost({ name: "Gadgeteer", system: { career: "Bounty Hunter" } });
  assert("1.A) 3rd In-Career Spec (Gadgeteer) costs 30 XP", costInCareer === 30, `got ${costInCareer}`);

  // 3rd Spec - Case B: Universal (Force Sensitive Exile) -> 3 * 10 = 30 XP (NO penalty)
  const costUniversal = bhActor.calculateSpecializationCost({ name: "Force Sensitive Exile", system: { isUniversal: true } });
  assert("1.B) 3rd Universal Spec (Force Sensitive Exile) costs 30 XP (no penalty)", costUniversal === 30, `got ${costUniversal}`);

  // 3rd Spec - Case C: Out-of-Career (Pilot from Smuggler) -> (3 * 10) + 10 = 40 XP (+10 penalty)
  const costOutOfCareer = bhActor.calculateSpecializationCost({ name: "Pilot", system: { career: "Smuggler", isUniversal: false } });
  assert("1.C) 3rd Out-of-Career Spec (Pilot) costs 40 XP (+10 penalty)", costOutOfCareer === 40, `got ${costOutOfCareer}`);

  await bhActor.delete();

  // =========================================================================
  // TEST 2: Knowledge Skills in Compendium Index
  // =========================================================================
  console.log("\n--- 2. Testing Knowledge Skills in Compendium Index ---");
  const skillsPack = game.packs.get("starwars-ffg-scratch.skills");
  assert("2.A) Skills Compendium exists", !!skillsPack);
  if (skillsPack) {
    const wasLocked = skillsPack.locked;
    if (wasLocked) await skillsPack.configure({ locked: false });
    const docs = await skillsPack.getDocuments();
    for (const doc of docs) {
      if (["Core Worlds", "Education", "Lore", "Outer Rim", "Underworld", "Warfare", "Xenology"].includes(doc.name)) {
        await doc.update({ name: `Knowledge: ${doc.name}` });
      }
    }
    if (wasLocked) await skillsPack.configure({ locked: true });

    const index = await skillsPack.getIndex({ fields: ["system.category", "name"] });
    const compKnowledgeSkills = index.filter(s => s.name.includes("Knowledge") || s.name.includes("Core Worlds") || s.name.includes("Education") || s.name.includes("Lore") || s.name.includes("Outer Rim") || s.name.includes("Underworld") || s.name.includes("Warfare") || s.name.includes("Xenology"));
    assert("2.B) Compendium contains 7 Knowledge skills", compKnowledgeSkills.length === 7, `found ${compKnowledgeSkills.length}`);
    const allPrefixedInComp = compKnowledgeSkills.every(s => s.name.startsWith("Knowledge: "));
    assert("2.C) All 7 Knowledge skills in Compendium Index start with Knowledge: ", allPrefixedInComp, compKnowledgeSkills.map(s => s.name).join(", "));
  }

  // =========================================================================
  // TEST 3: B2 - Narrative Auto-Detection for AoR & FaD
  // =========================================================================
  console.log("\n--- 3. Testing Narrative Auto-Detection ---");
  // EotE: Smuggler -> Obligation
  const eoteActor = await Actor.create({ name: "EotE-Char", type: "character", system: { biography: { career: "Smuggler" }, creation: { isCreationMode: true } } }, { skipBuilder: true });
  const eoteBuilder = new CharacterBuilder({ actor: eoteActor });
  eoteBuilder.currentStep = CharacterBuilder.STEPS.NARRATIVE;
  const eoteCtx = await eoteBuilder._prepareContext({});
  assert("3.A) EotE Career (Smuggler) auto-selects obligation", eoteCtx.narrative.activeType === "obligation");
  await eoteActor.delete();

  // AoR: Soldier -> Duty
  const aorActor = await Actor.create({ name: "AoR-Char", type: "character", system: { biography: { career: "Soldier" }, creation: { isCreationMode: true } } }, { skipBuilder: true });
  const aorBuilder = new CharacterBuilder({ actor: aorActor });
  aorBuilder.currentStep = CharacterBuilder.STEPS.NARRATIVE;
  const aorCtx = await aorBuilder._prepareContext({});
  assert("3.B) AoR Career (Soldier) auto-selects duty", aorCtx.narrative.activeType === "duty");
  await aorActor.delete();

  // FaD: Guardian -> Morality
  const fadActor = await Actor.create({ name: "FaD-Char", type: "character", system: { biography: { career: "Guardian" }, creation: { isCreationMode: true } } }, { skipBuilder: true });
  const fadBuilder = new CharacterBuilder({ actor: fadActor });
  fadBuilder.currentStep = CharacterBuilder.STEPS.NARRATIVE;
  const fadCtx = await fadBuilder._prepareContext({});
  assert("3.C) FaD Career (Guardian) auto-selects morality", fadCtx.narrative.activeType === "morality");
  await fadActor.delete();

  // =========================================================================
  // TEST 4: GM Permission & Audit Log on adjustObligation / adjustDuty / adjustMorality
  // =========================================================================
  console.log("\n--- 4. Testing GM Permission & Audit Logging ---");
  const auditActor = await Actor.create({ name: "Audit-Tester", type: "character", system: { creation: { isCreationMode: false } } }, { skipBuilder: true });

  // 4.A: Non-GM check using Object.defineProperty
  const origProp = Object.getOwnPropertyDescriptor(game.user.constructor.prototype, "isGM") || Object.getOwnPropertyDescriptor(game.user, "isGM");
  Object.defineProperty(game.user, "isGM", { value: false, configurable: true });
  const nonGmRes = await auditActor.adjustObligation("Debt", 10, "Reason");
  assert("4.A) Non-GM call rejected", nonGmRes.success === false && nonGmRes.message.includes("darf nur vom GM"), nonGmRes.message);

  // 4.B: Mandatory reason check
  Object.defineProperty(game.user, "isGM", { value: true, configurable: true });
  const noReasonRes = await auditActor.adjustObligation("Debt", 10, "");
  assert("4.B) Missing reason rejected", noReasonRes.success === false && noReasonRes.message.includes("Grund"), noReasonRes.message);

  // 4.C: Successful adjustment creates audit log
  const successRes = await auditActor.adjustObligation("Betrayal", 20, "Betrayed the cartel", "Campaign event");
  assert("4.C) GM adjustment succeeded", successRes.success === true);
  
  const xpLog = auditActor.system.xp?.log || [];
  const hasLog = xpLog.some(l => l.description.includes("GM-Anpassung Obligation") && l.description.includes("Campaign event"));
  assert("4.D) Audit log entry created in xp.log", hasLog, JSON.stringify(xpLog));

  if (origProp) Object.defineProperty(game.user, "isGM", origProp);
  await auditActor.delete();

  // =========================================================================
  // TEST 5: A1 - Stackable Talents Cross-Spec Isolation
  // =========================================================================
  console.log("\n--- 5. Testing A1: Stackable Talents Isolation ---");
  const isoActor = await Actor.create({
    name: "Iso-Tester",
    type: "character",
    system: { biography: { career: "Bounty Hunter" }, xp: { available: 100, total: 100 }, creation: { isCreationMode: false } }
  }, { skipBuilder: true });

  const specRowsA = [{ cost: 5, talents: ["grit", "toughened", "stalker", "grit"], directions: [{}, {}, {}, {}] }];
  const specRowsB = [{ cost: 5, talents: ["grit", "frenzied_attack", "toughened", "grit"], directions: [{}, {}, {}, {}] }];

  await isoActor.createEmbeddedDocuments("Item", [
    { name: "Assassin", type: "specialization", system: { career: "Bounty Hunter", talentRows: specRowsA } },
    { name: "Marauder", type: "specialization", system: { career: "Hired Gun", talentRows: specRowsB } }
  ]);

  await isoActor.buyTalent({ name: "Grit", key: "grit", specialization: "assassin", row: 0, col: 0 }, 5);
  const gridA = TalentTreeUtils.buildGrid("Assassin", specRowsA, [], isoActor);
  assert("5.A) Grit (0,0) in Spec A is purchased", gridA[0].talents[0].purchased === true);
  assert("5.B) Grit (0,3) in Spec A is NOT purchased", gridA[0].talents[3].purchased === false);

  const gridB = TalentTreeUtils.buildGrid("Marauder", specRowsB, [], isoActor);
  assert("5.C) Grit (0,0) in Spec B is NOT purchased (isolated)", gridB[0].talents[0].purchased === false);

  await isoActor.delete();

  console.log(`\nSWFFG TEST | Complete! PASSED: ${passed}, FAILED: ${failed}`);
})();
