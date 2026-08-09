/**
 * Headless Test Script: Clone Diffing Verification
 * 
 * Verifies that the diff-based approach correctly splits updates 
 * into create/update/delete operations for embedded documents, 
 * avoiding the "missing _id" error from a blanket update.
 * 
 * Run in Foundry Console: 
 * const testScript = await fetch('modules/starwars-ffg-scratch/tests/headless-clone-diffing.js').then(r => r.text());
 * eval(testScript);
 */

(async () => {
  console.log("🚀 Starting Headless Test: Clone Diffing...");

  // 1. Create a dummy original actor
  const originalActor = await Actor.create({
    name: "Diffing Actor",
    type: "character",
    system: { 
      creation: { isCreationMode: true, startingXp: 100, speciesSnapshot: { xp: 100 } } 
    }
  });

  await new Promise(r => setTimeout(r, 200));
  
  try {
    // 2. Add a pre-existing item to test 'update' and 'delete'
    await originalActor.createEmbeddedDocuments("Item", [{
      name: "Old Talent",
      type: "talent",
      system: { description: "To be updated" }
    }, {
      name: "Doomed Talent",
      type: "talent"
    }]);

    // 3. Clone the actor
    const cloneActor = originalActor.clone();
    console.log("✅ Actor cloned with initial items.");

    // 4. Modify the clone
    // Delete the doomed talent
    const doomedItem = cloneActor.items.find(i => i.name === "Doomed Talent");
    await cloneActor.deleteEmbeddedDocuments("Item", [doomedItem.id]);
    
    // Update the old talent
    const oldItem = cloneActor.items.find(i => i.name === "Old Talent");
    await cloneActor.updateEmbeddedDocuments("Item", [{ _id: oldItem.id, "system.description": "Has been updated" }]);

    // Create a new talent
    const buyResult = await cloneActor.buyTalent({ 
      name: "New Talent", 
      key: "newtalent",
      specialization: "testspec" 
    }, 10);
    
    if (!buyResult.success) throw new Error("Failed to buy talent: " + buyResult.message);
    console.log("✅ Clone modified: 1 deleted, 1 updated, 1 created.");

    // 5. Run the Diffing Logic (The Builder's Save mechanism)
    console.log("⚙️ Executing Diff-Save...");
    
    const cloneData = cloneActor.toObject();
    const { items: cloneItems, ...actorScalarData } = cloneData;
    const originalItemIds = new Set(originalActor.items.map(i => i.id));
    const cloneItemIds = new Set(cloneItems.map(i => i._id));

    // A. New Items
    const newItems = cloneItems
      .filter(i => !originalItemIds.has(i._id))
      .map(({ _id, ...rest }) => rest);

    // B. Deleted Items
    const deletedItemIds = [...originalItemIds].filter(id => !cloneItemIds.has(id));

    // C. Changed Items
    const changedItems = cloneItems.filter(i => {
      if (!originalItemIds.has(i._id)) return false;
      const originalItem = originalActor.items.get(i._id).toObject();
      // Using diffObject which is standard in V14
      const diff = foundry.utils.diffObject(originalItem, i);
      return !foundry.utils.isEmpty(diff);
    });

    // Execute operations
    if (deletedItemIds.length) {
      await originalActor.deleteEmbeddedDocuments("Item", deletedItemIds);
      console.log(`🗑️ Deleted ${deletedItemIds.length} items.`);
    }
    if (changedItems.length) {
      await originalActor.updateEmbeddedDocuments("Item", changedItems);
      console.log(`🔄 Updated ${changedItems.length} items.`);
    }
    
    await originalActor.update(actorScalarData);
    
    if (newItems.length) {
      await originalActor.createEmbeddedDocuments("Item", newItems);
      console.log(`✨ Created ${newItems.length} new items.`);
    }

    await new Promise(r => setTimeout(r, 200));

    // 6. Verify Original Actor
    const finalItems = originalActor.items;
    
    const hasOldUpdated = finalItems.find(i => i.name === "Old Talent" && i.system.description === "Has been updated");
    const hasDoomed = finalItems.find(i => i.name === "Doomed Talent");
    const hasNew = finalItems.find(i => i.name === "New Talent");
    const finalXp = originalActor.system.xp.available;

    console.assert(hasOldUpdated, "Old Talent was not updated!");
    console.assert(!hasDoomed, "Doomed Talent was not deleted!");
    console.assert(hasNew, "New Talent was not created!");
    console.assert(finalXp === 90, `XP was not updated, got ${finalXp}`);

    if (hasOldUpdated && !hasDoomed && hasNew && finalXp === 90) {
      console.log("🎉 SUCCESS! The Diffing-Save logic works perfectly!");
    } else {
      console.error("❌ FAILED! Verification failed.", { hasOldUpdated: !!hasOldUpdated, hasDoomed: !!hasDoomed, hasNew: !!hasNew, finalXp });
    }

  } catch (err) {
    console.error("❌ Test failed with exception:", err);
  } finally {
    await originalActor.delete();
    console.log("🧹 Test dummy cleaned up.");
  }
})();
