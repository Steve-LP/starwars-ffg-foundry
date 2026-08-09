/**
 * Headless Test Script: Case Sensitivity Verification
 * 
 * Tests the specific case where an actor purchases a skill and a talent 
 * with different casing conventions, and verifies that they are correctly 
 * found and rolled back by the removeCareer and removeSpecialization methods.
 * 
 * Run in Foundry Console: 
 * const testScript = await fetch('modules/starwars-ffg-scratch/tests/headless-case-sensitivity.js').then(r => r.text());
 * eval(testScript);
 */

(async () => {
  console.log("🚀 Starting Headless Test: Case Sensitivity...");

  // 1. Create a dummy actor
  const actor = await Actor.create({
    name: "Case Sensitivity Dummy",
    type: "character",
    system: { creation: { startingXp: 100 } }
  });

  try {
    await actor.update({ "system.creation.isCreationMode": true });

    // 2. Mock a Career with a lower-cased skill in its snapshot
    await actor.applyCareer({
      name: "MockCareer",
      type: "career",
      system: { careerSkills: "athletics" }
    });

    // 3. Mock a Specialization 
    await actor.applySpecialization({
      name: "MockSpec",
      type: "specialization",
      system: { careerSkills: "brawl" }
    });

    // 4. Buy a skill with UPPERCASE name (simulating how items might be capitalized)
    await actor.buySkillRank("Athletics", "brawn", "general");
    await actor.buySkillRank("BRAWL", "brawn", "general");

    // 5. Buy a talent where the item name is capitalized but the specialization field is lowercased
    await actor.buyTalent({ 
      name: "Toughness", 
      key: "toughness", 
      specialization: "mockspec" // Lowercase spec name
    }, 5);

    await new Promise(r => setTimeout(r, 100));

    console.log("✅ Items purchased with mixed casing.");

    // 6. Rollback
    await actor.removeCareer();
    await new Promise(r => setTimeout(r, 100));

    // 7. Verify
    const finalXp = actor.system.xp.available;
    const hasTalents = actor.items.some(i => i.type === "talent");
    const athleticsRank = actor.derivedSkills?.athletics?.value || 0;
    const brawlRank = actor.derivedSkills?.brawl?.value || 0;

    console.assert(finalXp === 100, `Expected 100 XP, got ${finalXp}`);
    console.assert(!hasTalents, `Expected no talents, but found ${actor.items.filter(i => i.type === "talent").length}`);
    console.assert(athleticsRank === 0, `Expected Athletics value to be 0, got ${athleticsRank}`);
    console.assert(brawlRank === 0, `Expected Brawl value to be 0, got ${brawlRank}`);

    if (finalXp === 100 && !hasTalents && athleticsRank === 0 && brawlRank === 0) {
      console.log("🎉 SUCCESS! Mixed-casing rollback correctly caught all items and refunded XP.");
    } else {
      console.error("❌ FAILED! Casing issue prevented clean rollback.", { finalXp, hasTalents, athleticsRank, brawlRank });
    }

  } catch (err) {
    console.error("❌ Test failed with exception:", err);
  } finally {
    await actor.delete();
    console.log("🧹 Test dummy cleaned up.");
  }
})();
