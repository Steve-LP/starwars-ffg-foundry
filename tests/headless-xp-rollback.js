/**
 * Headless Test Script: XP Rollback Verification
 * 
 * Tests the specific case where an actor gains a career, specialization, 
 * buys talents, buys a skill, and then removes the career.
 * This verifies that the newly decoupled actor.js methods correctly 
 * remove associated items and refund all XP.
 * 
 * Run in Foundry Console: 
 * const testScript = await fetch('modules/starwars-ffg-scratch/tests/headless-xp-rollback.js').then(r => r.text());
 * eval(testScript);
 */

(async () => {
  console.log("🚀 Starting Headless Test: XP Rollback...");

  // 1. Create a dummy actor
  const actor = await Actor.create({
    name: "XP Test Dummy",
    type: "character",
    system: { creation: { startingXp: 100 } }
  });
  console.log("✅ 1. Actor created.");

  try {
    // 2. Set to creation mode
    await actor.update({ "system.creation.isCreationMode": true });

    // 3. Load career and specialization from compendium
    const careerPack = game.packs.get("starwars-ffg-scratch.careers");
    const specPack = game.packs.get("starwars-ffg-scratch.specializations");
    
    if (!careerPack || !specPack) {
      throw new Error("Compendiums not found!");
    }

    const smugglerDocs = await careerPack.getDocuments({ name: "Smuggler" });
    const smugglerData = smugglerDocs[0].toObject();
    
    const pilotDocs = await specPack.getDocuments({ name: "Pilot" });
    const pilotData = pilotDocs[0].toObject();

    // Apply Career
    const careerRes = await actor.applyCareer(smugglerData);
    if (!careerRes.success) throw new Error(careerRes.message);
    console.log("✅ 2. Career Smuggler applied.");

    // Apply Specialization
    const specRes = await actor.applySpecialization(pilotData);
    if (!specRes.success) throw new Error(specRes.message);
    console.log("✅ 3. Specialization Pilot applied.");

    // 4. Buy Talents ("Full Throttle" 5XP, "Skilled Jockey" 10XP)
    const t1Res = await actor.buyTalent({ name: "Full Throttle", key: "fullthrottle", specialization: "pilot" }, 5);
    if (!t1Res.success) throw new Error(t1Res.message);

    const t2Res = await actor.buyTalent({ name: "Skilled Jockey", key: "skilledjockey", specialization: "pilot" }, 10);
    if (!t2Res.success) throw new Error(t2Res.message);
    console.log("✅ 4. Talents purchased (15 XP total).");

    // 5. Buy Skill (Streetwise)
    // Wait, Streetwise is a Smuggler career skill. Let's give it 1 rank (costs 5 XP).
    const skillRes = await actor.buySkillRank("Streetwise", "cunning", "general");
    if (!skillRes.success) throw new Error(skillRes.message);
    console.log("✅ 5. Streetwise rank purchased (5 XP total).");

    // Wait for derived data preparation
    await new Promise(r => setTimeout(r, 100));

    // Verify current XP balance before rollback
    // Base 100 - 15 (Talents) - 5 (Skill) = 80 XP
    if (actor.system.xp.available !== 80) {
      console.warn(`⚠️ Warning: Expected 80 available XP before rollback, got ${actor.system.xp.available}`);
    } else {
      console.log(`✅ 6. Pre-rollback XP verified at 80.`);
    }

    // 6. Rollback!
    console.log("🔥 INITIATING CASCADING ROLLBACK (Removing Career: Smuggler)...");
    const removeRes = await actor.removeCareer();
    if (!removeRes.success) throw new Error(removeRes.message);

    // Wait for derived data preparation
    await new Promise(r => setTimeout(r, 100));

    // 7. Verify Rollback
    const finalXp = actor.system.xp.available;
    const hasTalents = actor.items.some(i => i.type === "talent");
    const streetwiseRank = actor.derivedSkills?.streetwise?.value || 0;

    console.assert(finalXp === 100, `Expected 100 XP, got ${finalXp}`);
    console.assert(!hasTalents, `Expected no talents, but found ${actor.items.filter(i => i.type === "talent").length}`);
    console.assert(streetwiseRank === 0, `Expected Streetwise value to be 0, got ${streetwiseRank}`);

    if (finalXp === 100 && !hasTalents && streetwiseRank === 0) {
      console.log("🎉 SUCCESS! Cascading rollback cleanly refunded all XP and removed all items.");
    } else {
      console.error("❌ FAILED! Rollback left dirty state.", { finalXp, hasTalents, streetwiseRank });
    }

  } catch (err) {
    console.error("❌ Test failed with exception:", err);
  } finally {
    await actor.delete();
    console.log("🧹 Test dummy cleaned up.");
  }

})();
