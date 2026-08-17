/**
 * SWFFG Headless Test: Verification of 5 Reported Bug Fixes
 */
(async function testBugFixes() {
  console.log("SWFFG TEST | Bug Fixes Verification");
  let passed = 0, failed = 0;
  function assert(name, condition, details = "") {
    if (condition) { console.log(`[PASS] ${name}`); passed++; }
    else { console.error(`[FAIL] ${name} ${details ? "(" + details + ")" : ""}`); failed++; }
  }

  const { CharacterBuilder } = await import("/systems/starwars-ffg-scratch/module/applications/character-builder.js");
  const { SWFFGActorSheet } = await import("/systems/starwars-ffg-scratch/module/actor-sheet.js");
  const { SWFFGSpecializationSheet } = await import("/systems/starwars-ffg-scratch/module/specialization-sheet.js");

  const testActor = await Actor.create({
    name: "Regression-Tester",
    type: "character",
    system: {
      characteristics: { brawn: { value: 2 }, agility: { value: 3 }, intellect: { value: 2 }, cunning: { value: 2 }, willpower: { value: 2 }, presence: { value: 2 } },
      creation: {
        isCreationMode: true,
        baseCharacteristics: { brawn: 2, agility: 3, intellect: 2, cunning: 2, willpower: 2, presence: 2 },
        speciesSnapshot: { name: "Human" },
        careerSnapshot: { name: "Bounty Hunter" },
        specializationSnapshot: { name: "Assassin" },
        freeCareerSkills: ["Athletics"],
        freeSpecializationSkills: ["Melee"],
        ledger: { upgrades: { characteristics: {}, skills: {} } }
      }
    }
  });

  try {
    // Attach specialization and skill items
    const specPack = game.packs.get("starwars-ffg-scratch.specializations");
    let assassinItemData = {
      name: "Assassin",
      type: "specialization",
      system: { career: "Bounty Hunter", careerSkills: "Melee, Ranged - Heavy, Skulduggery, Stealth", talentRows: [] }
    };
    if (specPack) {
      const idx = await specPack.getIndex();
      const match = idx.find(s => s.name === "Assassin");
      if (match) {
        const doc = await specPack.getDocument(match._id);
        assassinItemData = doc.toObject();
      }
    }
    const [specDoc] = await testActor.createEmbeddedDocuments("Item", [assassinItemData]);

    const skillPack = game.packs.get("starwars-ffg-scratch.skills");
    if (skillPack) {
      const skillDocs = await skillPack.getDocuments();
      await testActor.createEmbeddedDocuments("Item", skillDocs.map(d => d.toObject()));
    }

    // =========================================================================
    // FIX 1: CharacterBuilder Step 6 Specialization Card & Tree Opener
    // =========================================================================
    const builder = new CharacterBuilder({ actor: testActor });
    builder.currentStep = CharacterBuilder.STEPS.XP_SPENDING;
    builder.activeTab = "talents";
    
    const context = await builder._prepareContext({});
    assert("1) Step 6 context has specialization object", !!context.specialization, `spec: ${context.specialization?.name}`);
    assert("2) Specialization name matches 'Assassin'", context.specialization?.name === "Assassin");

    await builder.render({ force: true });
    await new Promise(r => setTimeout(r, 60));
    const builderEl = builder.element;
    assert("3) Builder rendered", !!builderEl && document.body.contains(builderEl));

    if (builderEl) {
      const openBox = builderEl.querySelector(".talent-tree-open-box");
      assert("4) .talent-tree-open-box rendered in Step 6 Talents tab", !!openBox);
      const warningText = builderEl.querySelector(".warning-text");
      assert("5) No missing specialization warning rendered", !warningText);
    }

    // =========================================================================
    // FIX 2: CharacterBuilder Scroll Preservation Hooks
    // =========================================================================
    assert("6) Builder has _preRender hook", typeof builder._preRender === "function");
    assert("7) Builder has _onRender hook", typeof builder._onRender === "function");

    // =========================================================================
    // FIX 3: Step 6 Skill Purchase Visible Increment
    // =========================================================================
    const buyResult = await testActor.buySkillRank("Coercion");
    assert("8) buySkillRank('Coercion') succeeded", buyResult.success, buyResult.message);
    const details = testActor.getSkillRankDetails("Coercion");
    assert("9) getSkillRankDetails('Coercion') rank is 1", details?.currentRank === 1, `got rank ${details?.currentRank}`);
    assert("10) getSkillRankDetails('Coercion') currentUpgrades is 1", details?.currentUpgrades === 1, `got upgrades ${details?.currentUpgrades}`);

    const updatedContext = await builder._prepareContext({});
    const coercionSkill = updatedContext.allSkills?.find(s => s.name.toLowerCase() === "coercion");
    assert("11) CharacterBuilder context.allSkills reflects Rank 1", coercionSkill?.rank === 1, `got rank ${coercionSkill?.rank}`);

    await builder.close();

    // =========================================================================
    // FIX 4: SpecializationSheet Talent Purchase Locked Mode
    // =========================================================================
    await testActor.update({ "system.creation.isCreationMode": false });
    const specSheet = new SWFFGSpecializationSheet({ document: specDoc });
    await specSheet.render({ force: true });
    await new Promise(r => setTimeout(r, 50));

    // Simulate actor sheet being in locked mode
    const sheet = new SWFFGActorSheet({ document: testActor });
    sheet.editMode = false;
    testActor.sheet = sheet;

    // Test clicking a talent card when locked
    const mockCard = document.createElement("div");
    mockCard.className = "talent-card";
    mockCard.dataset.key = "grit";
    mockCard.dataset.cost = "5";
    mockCard.dataset.name = "Grit";
    mockCard.dataset.row = "0";
    mockCard.dataset.col = "0";
    mockCard.dataset.reachable = "true";

    let warnTriggered = false;
    const origWarn = ui.notifications.warn;
    ui.notifications.warn = (msg) => {
      if (msg.includes("gesperrt")) warnTriggered = true;
      origWarn.call(ui.notifications, msg);
    };

    // Temporarily simulate non-GM to test lock enforcement
    const origIsGM = game.user.isGM;
    Object.defineProperty(game.user, "isGM", { value: false, configurable: true });

    await specSheet._onTalentCardClick({ preventDefault: () => {}, currentTarget: mockCard });
    assert("12) Talent click rejected and warned in locked mode", warnTriggered);

    // Restore isGM and notification
    Object.defineProperty(game.user, "isGM", { value: origIsGM, configurable: true });
    ui.notifications.warn = origWarn;
    await specSheet.close();

    // =========================================================================
    // FIX 5: Dice Rolling in Locked Mode (Direct Roll / Pool Loading)
    // =========================================================================
    await sheet.render({ force: true });
    await new Promise(r => setTimeout(r, 50));
    assert("13) Actor sheet rendered in locked mode (editMode: false)", sheet.editMode === false);

    const sheetEl = sheet.element;
    if (sheetEl) {
      const charNode = sheetEl.querySelector('.rollable-char[data-characteristic="agility"]');
      assert("14) Agility roll node found in sheet", !!charNode);

      if (charNode) {
        charNode.click();
        const diceRoller = game.starwarsFFG?.diceRoller;
        assert("15) Dice pool loaded for Agility (ability: 3)", diceRoller?.dicePool?.ability === 3, `got ability: ${diceRoller?.dicePool?.ability}`);
      }

      const skillNode = sheetEl.querySelector('.rollable-skill[data-name="Athletics"]');
      assert("16) Athletics roll button found in sheet", !!skillNode);
      if (skillNode) {
        skillNode.click();
        const diceRoller = game.starwarsFFG?.diceRoller;
        assert("17) Dice pool loaded for Athletics (ability: 1, proficiency: 1)", diceRoller?.dicePool?.ability === 1 && diceRoller?.dicePool?.proficiency === 1, `ability: ${diceRoller?.dicePool?.ability}, prof: ${diceRoller?.dicePool?.proficiency}`);
      }
    }
    await sheet.close();

  } finally {
    await testActor.delete();
  }

  console.log(`SWFFG TEST | Fertig. PASSED: ${passed}, FAILED: ${failed}`);
})();
