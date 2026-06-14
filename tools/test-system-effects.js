/**
 * Star Wars FFG System Effects & Recalculation Test Script
 * 
 * Instructions:
 * 1. Open Foundry VTT.
 * 2. Create a new Script Macro.
 * 3. Paste this code and execute it.
 * 4. Open the browser developer console (F12) to see the results.
 */

(async () => {
  console.log("SWFFG TEST | Starting system effects and recalculation tests...");
  
  // 1. Create a temporary character
  const actor = await Actor.create({
    name: "Test Character (Temp)",
    type: "character",
    system: {
      characteristics: {
        brawn: { value: 1 },
        agility: { value: 1 },
        intellect: { value: 1 },
        cunning: { value: 1 },
        willpower: { value: 1 },
        presence: { value: 1 }
      },
      stats: {
        wounds: { base: 10 },
        strain: { base: 10 }
      }
    }
  });

  const assert = (condition, message) => {
    if (condition) {
      console.log(`%c[PASS] ${message}`, "color: green; font-weight: bold;");
    } else {
      console.error(`[FAIL] ${message}`);
    }
  };

  try {
    // Test base values
    assert(actor.system.stats.wounds.max === 10, "Base wounds max is 10");
    assert(actor.system.stats.strain.max === 10, "Base strain max is 10");
    assert(actor.system.stats.soak.value === 1, "Base soak is 1 (Brawn 1)");
    assert(actor.system.stats.encumbrance.max === 6, "Base max encumbrance is 6 (5 + Brawn 1)");

    // 2. Add Talent (Toughened)
    const toughened = await actor.createEmbeddedDocuments("Item", [{
      name: "Toughened",
      type: "talent",
      system: { key: "toughened", tier: 1 }
    }]);
    assert(actor.system.stats.wounds.max === 12, "Toughened adds +2 max wounds (12)");

    // 3. Remove Talent (Toughened)
    await actor.deleteEmbeddedDocuments("Item", [toughened[0].id]);
    assert(actor.system.stats.wounds.max === 10, "Deleting Toughened cleanly reverts max wounds to 10");

    // 4. Add cybernetic arm (Gear) with modifiers and equip it
    const cyberArm = await actor.createEmbeddedDocuments("Item", [{
      name: "Cybernetic Arm",
      type: "gear",
      system: {
        equipped: true,
        modifiers: {
          characteristics: "brawn:1",
          skills: "athletics:1",
          wounds: 1
        }
      }
    }]);

    // Recalculate context & check stats
    assert(actor.system.characteristics.brawn.value === 2, "Equipped cybernetic arm increases Brawn to 2");
    assert(actor.system.stats.soak.value === 2, "Soak increases to 2 (Brawn 2)");
    assert(actor.system.stats.wounds.max === 11, "Wounds increases to 11");
    assert(actor.system.stats.encumbrance.max === 7, "Max encumbrance increases to 7 (5 + Brawn 2)");

    // 5. Unequip gear
    await cyberArm[0].update({ "system.equipped": false });
    assert(actor.system.characteristics.brawn.value === 1, "Unequipping cybernetic arm reverts Brawn to 1");
    assert(actor.system.stats.soak.value === 1, "Unequipping reverts Soak to 1");
    assert(actor.system.stats.wounds.max === 10, "Unequipping reverts Max Wounds to 10");
    assert(actor.system.stats.encumbrance.max === 6, "Unequipping reverts Max Encumbrance to 6");

    // 6. Test weapons, attachments and mod upgrades
    const blaster = await actor.createEmbeddedDocuments("Item", [{
      name: "Heavy Blaster Pistol",
      type: "weapon",
      system: {
        damage: 7,
        hardpoints: 3,
        equipped: true
      }
    }]);

    // Create an attachment object to drop/install
    const laserSightData = {
      name: "Laser Sight",
      type: "attachment",
      system: {
        hardpoints: 1,
        baseModifiers: {
          qualities: "Accurate 1"
        },
        mods: [
          { name: "+1 Damage Mod", active: false, type: "stat", target: "damage", value: 1 },
          { name: "Pierce 1 Mod", active: false, type: "quality", target: "Pierce", value: 1 }
        ]
      }
    };

    // Simulate drag & drop (install attachment)
    const attachments = [laserSightData];
    await blaster[0].update({ "system.attachments": attachments });

    let blasterItem = actor.items.get(blaster[0].id);
    assert(blasterItem.system.derived.hardpointsRemaining === 2, "Attachment consumes 1 HP, 2 remaining");
    assert(blasterItem.system.derived.qualities === "Accurate 1", "Accurate 1 quality is applied");
    assert(blasterItem.system.derived.damage === 7, "Damage remains 7 before unlocking mods");

    // Toggle mod active state (unlock +1 Damage and Pierce 1)
    const updatedAttachments = JSON.parse(JSON.stringify(blasterItem.system.attachments));
    updatedAttachments[0].mods[0].active = true; // +1 damage
    updatedAttachments[0].mods[1].active = true; // Pierce 1
    await blasterItem.update({ "system.attachments": updatedAttachments });

    blasterItem = actor.items.get(blaster[0].id);
    assert(blasterItem.system.derived.damage === 8, "Derived weapon damage increases to 8 after unlocking mod");
    assert(blasterItem.system.derived.qualities.includes("Pierce 1"), "Pierce 1 quality is applied from unlocked mod");

    // Uninstall attachment
    await blasterItem.update({ "system.attachments": [] });
    blasterItem = actor.items.get(blaster[0].id);
    assert(blasterItem.system.derived.hardpointsRemaining === 3, "Uninstalling attachment restores HP to 3");
    assert(blasterItem.system.derived.damage === 7, "Damage reverts to base 7");
    assert(blasterItem.system.derived.qualities === "", "Attachment qualities are removed");

  } catch (error) {
    console.error("SWFFG TEST | Test suite encountered an error:", error);
  } finally {
    // Cleanup character
    await actor.delete();
    console.log("SWFFG TEST | Cleanup complete. Temp character deleted.");
  }
})();
