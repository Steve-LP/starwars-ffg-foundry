/**
 * Headless Test Script: Clone and Update Verification
 * 
 * Tests whether modifying an unlinked actor clone (using buyTalent to create embedded items)
 * and then calling update(clone.toObject()) on the original actor correctly syncs the 
 * created embedded items (talents) into the original actor's items collection.
 * 
 * Run in Foundry Console: 
 * const testScript = await fetch('modules/starwars-ffg-scratch/tests/headless-clone-update.js').then(r => r.text());
 * eval(testScript);
 */

(async () => {
  console.log("🚀 Starting Headless Test: Clone and Update...");

  // 1. Create a dummy original actor
  const originalActor = await Actor.create({
    name: "Original Actor",
    type: "character",
    system: { xp: { available: 100 } }
  });
  console.log("✅ 1. Original Actor created with 100 XP.");

  try {
    // 2. Clone the actor (unlinked)
    const cloneActor = originalActor.clone();
    console.log("✅ 2. Actor cloned.");

    // 3. Buy a talent on the clone
    console.log("⚙️ Buying 'Test Talent' on clone...");
    const buyResult = await cloneActor.buyTalent({ 
      name: "Test Talent", 
      key: "testtalent",
      specialization: "testspec" 
    }, 10);
    
    if (!buyResult.success) {
      throw new Error("Failed to buy talent on clone: " + buyResult.message);
    }
    
    const cloneTalentCount = cloneActor.items.filter(i => i.type === "talent").length;
    console.assert(cloneTalentCount === 1, `Expected 1 talent on clone, found ${cloneTalentCount}`);
    console.assert(cloneActor.system.xp.available === 90, `Expected 90 XP on clone, found ${cloneActor.system.xp.available}`);
    console.log("✅ 3. Talent successfully bought on clone.");

    // 4. Update the original actor using the clone's object data
    console.log("⚙️ Synchronizing original actor via originalActor.update(cloneActor.toObject())...");
    await originalActor.update(cloneActor.toObject());
    
    // Wait for internal hooks/processing
    await new Promise(r => setTimeout(r, 100));

    // 5. Verify the original actor
    const finalXp = originalActor.system.xp.available;
    const finalTalentCount = originalActor.items.filter(i => i.type === "talent").length;

    console.assert(finalXp === 90, `Expected 90 XP on original, got ${finalXp}`);
    
    if (finalTalentCount === 1) {
      console.log("🎉 SUCCESS! actor.update() correctly synchronized the new embedded item.");
    } else {
      console.error(`❌ FAILED! actor.update() DID NOT synchronize the new embedded item. Expected 1 talent, found ${finalTalentCount}.`);
      console.warn("⚠️ CONCLUSION: The builder MUST use a diffing approach (createEmbeddedDocuments/deleteEmbeddedDocuments) instead of a blind update().");
    }

  } catch (err) {
    console.error("❌ Test failed with exception:", err);
  } finally {
    await originalActor.delete();
    console.log("🧹 Test dummy cleaned up.");
  }
})();
