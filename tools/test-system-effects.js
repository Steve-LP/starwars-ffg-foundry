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
    console.log("SWFFG TEST DEBUG | blasterItem:", blasterItem);
    console.log("SWFFG TEST DEBUG | blasterItem.system:", blasterItem.system);
    console.log("SWFFG TEST DEBUG | blasterItem.system.validationFailures:", blasterItem.system.validationFailures);
    console.log("SWFFG TEST DEBUG | blasterItem.derived:", blasterItem.derived);
    assert(blasterItem.derived.hardpointsRemaining === 2, "Attachment consumes 1 HP, 2 remaining");
    assert(blasterItem.derived.qualities === "Accurate 1", "Accurate 1 quality is applied");
    assert(blasterItem.derived.damage === 7, "Damage remains 7 before unlocking mods");

    // Toggle mod active state (unlock +1 Damage and Pierce 1)
    const updatedAttachments = JSON.parse(JSON.stringify(blasterItem.system.attachments));
    updatedAttachments[0].system.mods[0].active = true; // +1 damage
    updatedAttachments[0].system.mods[1].active = true; // Pierce 1
    await blasterItem.update({ "system.attachments": updatedAttachments });

    blasterItem = actor.items.get(blaster[0].id);
    assert(blasterItem.derived.damage === 8, "Derived weapon damage increases to 8 after unlocking mod");
    assert(blasterItem.derived.qualities.includes("Pierce 1"), "Pierce 1 quality is applied from unlocked mod");

    // Uninstall attachment
    await blasterItem.update({ "system.attachments": [] });
    blasterItem = actor.items.get(blaster[0].id);
    assert(blasterItem.derived.hardpointsRemaining === 3, "Uninstalling attachment restores HP to 3");
    assert(blasterItem.derived.damage === 7, "Damage reverts to base 7");
    assert(blasterItem.derived.qualities === "", "Attachment qualities are removed");

    // 7. Character Creation & XP Engine Tests
    console.log("SWFFG TEST | Starting Character Creation & XP Ledger tests...");
    await actor.update({
      "system.creation.startingXp": 100,
      "system.creation.baseGroupDutyXp": 10,
      "system.creation.doubleDuty": true,
      "system.creation.isCreationMode": true,
      "system.creation.baseCharacteristics": {
        brawn: 2,
        agility: 2,
        intellect: 2,
        cunning: 2,
        willpower: 2,
        presence: 2
      },
      "system.characteristics.brawn.value": 2,
      "system.characteristics.agility.value": 2,
      "system.characteristics.intellect.value": 2,
      "system.characteristics.cunning.value": 2,
      "system.characteristics.willpower.value": 2,
      "system.characteristics.presence.value": 2
    });

    assert(actor.dutyXp === 20, "Duty XP is 20 (baseGroupDutyXp 10 + doubleDuty (+10))");
    assert(actor.maxAttributeXpAllowed === 120, "Max attribute XP allowed is 120 (startingXp 100 + dutyXp 20)");
    assert(actor.currentAttributeXpSpent === 0, "No XP spent on attributes initially");
    assert(actor.totalAvailableXp === 120, "Total available XP matches max starting XP");

    // Upgrade Brawn: 2 -> 3 (cost: 30)
    await actor.buyAttribute("brawn");
    assert(actor._source.system.characteristics.brawn.value === 3, "Brawn successfully upgraded to 3");
    assert(actor.currentAttributeXpSpent === 30, "Current attribute XP spent is 30");
    assert(actor.totalAvailableXp === 90, "Remaining available XP is 90");

    // Upgrade Brawn: 3 -> 4 (cost: 40)
    await actor.buyAttribute("brawn");
    assert(actor._source.system.characteristics.brawn.value === 4, "Brawn successfully upgraded to 4");
    assert(actor.currentAttributeXpSpent === 70, "Current attribute XP spent is 70 (30 + 40)");
    assert(actor.totalAvailableXp === 50, "Remaining available XP is 50");

    // Upgrade Agility: 2 -> 3 (cost: 30)
    await actor.buyAttribute("agility");
    assert(actor._source.system.characteristics.agility.value === 3, "Agility successfully upgraded to 3");
    assert(actor.currentAttributeXpSpent === 100, "Current attribute XP spent is 100");
    assert(actor.totalAvailableXp === 20, "Remaining available XP is 20");

    // Mock non-GM user for restriction testing
    const originalIsGM = game.user.isGM;
    Object.defineProperty(game.user, "isGM", {
      value: false,
      configurable: true
    });
    try {
      // Try to upgrade Agility: 3 -> 4 (cost: 40). Should fail due to insufficient global available XP (20)
      await actor.buyAttribute("agility");
      assert(actor._source.system.characteristics.agility.value === 3, "Agility upgrade to 4 rejected due to insufficient available XP");
      assert(actor.totalAvailableXp === 20, "Available XP remains 20");

      // Give campaign earned XP: +100
      await actor.update({ "system.xp.earned": 100 });
      assert(actor.totalAvailableXp === 120, "Available XP is now 120 (20 + 100 earned)");

      // Try to upgrade Agility: 3 -> 4 (cost: 40). `currentAttributeXpSpent + 40 = 140` which exceeds limit (120)
      await actor.buyAttribute("agility");
      assert(actor._source.system.characteristics.agility.value === 3, "Agility upgrade to 4 rejected: exceeds maxAttributeXpAllowed (120)");
      assert(actor.totalAvailableXp === 120, "Available XP remains 120");

      // Lock creation mode
      await actor.lockCreation();
      assert(actor.system.creation.isCreationMode === false, "Creation mode locked successfully");

      // Try to upgrade Agility: 3 -> 4 (cost: 40) after creation mode is locked. Should fail.
      await actor.buyAttribute("agility");
      assert(actor._source.system.characteristics.agility.value === 3, "Agility upgrade rejected: creation mode locked");
    } finally {
      // Restore GM status
      delete game.user.isGM;
    }

    // GM Override test: bypass locked creation mode and exceed limits
    assert(game.user.isGM === true, "Restored GM status for override test");
    await actor.buyAttribute("agility");
    assert(actor._source.system.characteristics.agility.value === 4, "GM successfully bypassed limits and upgraded Agility to 4");
    assert(actor.currentAttributeXpSpent === 140, "Current attribute XP spent updated to 140");

    // 8. Specialization XP Purchasing Tests
    console.log("SWFFG TEST | Starting Specialization XP Purchasing tests...");
    
    // Add first specialization (Index 0: Starting Spec) - Costs 0 XP
    const spec1 = await actor.createEmbeddedDocuments("Item", [{
      name: "Slick Pilot",
      type: "specialization",
      system: { classification: "career" }
    }]);
    assert(actor.calculateSpentSpecializationXp() === 0, "Starting specialization costs 0 XP");
    assert(actor.totalAvailableXp === 80, "Available XP remains 80");

    // Add second specialization (Index 1: Career Spec) - Costs 20 XP (base: (1+1)*10)
    const specTestData2 = { type: "specialization", system: { classification: "career" } };
    assert(actor.canAffordSpecialization(specTestData2) === true, "Actor can afford second specialization (cost: 20 XP)");
    
    const spec2 = await actor.createEmbeddedDocuments("Item", [{
      name: "Driver",
      type: "specialization",
      system: { classification: "career" }
    }]);
    assert(actor.calculateSpentSpecializationXp() === 20, "Spent specialization XP is 20 after purchasing second tree");
    assert(actor.totalAvailableXp === 60, "Available XP reduced to 60");

    // Add third specialization (Index 2: Non-Career Spec) - Costs 40 XP (30 base + 10 penalty)
    const specTestData3 = { type: "specialization", system: { classification: "non-career" } };
    assert(actor.canAffordSpecialization(specTestData3) === true, "Actor can afford third specialization (non-career, cost: 40 XP)");

    const spec3 = await actor.createEmbeddedDocuments("Item", [{
      name: "Mercenary Soldier",
      type: "specialization",
      system: { classification: "non-career" }
    }]);
    assert(actor.calculateSpentSpecializationXp() === 60, "Spent specialization XP is 60 (20 + 40)");
    assert(actor.totalAvailableXp === 20, "Available XP reduced to 20");

    // Add fourth specialization (Index 3: Non-Career Spec) - Costs 50 XP (40 base + 10 penalty [exceeding available 20])
    const specTestData4 = { type: "specialization", system: { classification: "non-career" } };
    
    // Mock non-GM
    Object.defineProperty(game.user, "isGM", { value: false, configurable: true });
    try {
      assert(actor.canAffordSpecialization(specTestData4) === false, "Non-GM cannot afford fourth specialization (cost: 50 XP vs available: 20 XP)");
    } finally {
      delete game.user.isGM;
    }

    assert(actor.canAffordSpecialization(specTestData4) === true, "GM can afford fourth specialization regardless of available XP");

    // 9. Force Powers & Signature Abilities Tests
    console.log("SWFFG TEST | Starting Force Power & Signature Ability tests...");
    
    // Earn more campaign XP so available is 120 (currently 20 available + 100 earned)
    await actor.update({ "system.xp.earned": 200 });
    assert(actor.totalAvailableXp === 120, "Earned campaign XP updated. Available XP is 120");

    // Buy a Force Power tree (classification: "force-power") - Costs 10 XP
    const forcePowerItem = await actor.createEmbeddedDocuments("Item", [{
      name: "Sense",
      type: "specialization",
      system: { classification: "force-power" }
    }]);
    assert(actor.calculateSpentSpecializationXp() === 70, "Total specs cost is 70 (60 regular specs + 10 Force Power)");
    assert(actor.totalAvailableXp === 110, "Available XP reduced to 110");

    // Purchase a Row 0 upgrade in the Force Power tree (specialization: "sense") - Costs 5 XP
    const senseUpgrade = await actor.createEmbeddedDocuments("Item", [{
      name: "Sense Duration Upgrade",
      type: "talent",
      system: { row: 0, col: 0, specialization: "sense" }
    }]);
    assert(actor.calculateSpentTalentXp() === 5, "Spent talent XP is 5 (Row 0 force power upgrade)");
    assert(actor.totalAvailableXp === 105, "Available XP reduced to 105");

    // Buy a Signature Ability tree (classification: "signature-ability") - Costs 30 XP
    const sigAbilityItem = await actor.createEmbeddedDocuments("Item", [{
      name: "My Signature Ability",
      type: "specialization",
      system: { classification: "signature-ability" }
    }]);
    assert(actor.calculateSpentSpecializationXp() === 100, "Total specs cost is 100 (70 previous + 30 Signature Ability)");
    assert(actor.totalAvailableXp === 75, "Available XP reduced to 75");

    // Buy Row 0 upgrade in Signature Ability - Costs 10 XP
    const sigUpgrade1 = await actor.createEmbeddedDocuments("Item", [{
      name: "Sig Row 0 Upgrade",
      type: "talent",
      system: { row: 0, col: 0, specialization: "my signature ability" }
    }]);
    assert(actor.calculateSpentTalentXp() === 15, "Spent talent XP is 15 (5 Sense + 10 Signature Ability Row 0)");
    assert(actor.totalAvailableXp === 65, "Available XP reduced to 65");

    // Buy Row 2 upgrade in Signature Ability - Costs 15 XP
    const sigUpgrade2 = await actor.createEmbeddedDocuments("Item", [{
      name: "Sig Row 2 Upgrade",
      type: "talent",
      system: { row: 2, col: 0, specialization: "my signature ability" }
    }]);
    assert(actor.calculateSpentTalentXp() === 30, "Spent talent XP is 30 (15 previous + 15 Signature Ability Row 2)");
    assert(actor.totalAvailableXp === 50, "Available XP reduced to 50");

    // Test customXpCost override on a Force Power - Custom cost 5 XP instead of 10 XP
    const customForcePower = await actor.createEmbeddedDocuments("Item", [{
      name: "Minor Force Power",
      type: "specialization",
      system: { classification: "force-power", customXpCost: 5 }
    }]);
    assert(actor.calculateSpentSpecializationXp() === 105, "Spent specs XP is 105 (100 previous + 5 custom cost override)");
    assert(actor.totalAvailableXp === 45, "Available XP reduced to 45");

    // 10. Species Starting Bonuses Test
    console.log("SWFFG TEST | Starting Species Starting Bonuses tests...");
    
    // Import SWFFGActorSheet dynamically
    const { SWFFGActorSheet } = await import("/systems/starwars-ffg-scratch/module/actor-sheet.js");
    
    // Construct sheet instance linked to our temp actor
    const sheet = new SWFFGActorSheet({ document: actor });
    
    const twilekData = {
      name: "Twi'lek",
      type: "species",
      system: {
        characteristics: {
          brawn: 1,
          agility: 2,
          intellect: 2,
          cunning: 2,
          willpower: 2,
          presence: 3
        },
        wounds: { base: 10 },
        strain: { base: 11 },
        xp: 100,
        modifiers: {
          skills: "charm:1"
        },
        specialAbilities: "Resistance to Heat"
      }
    };

    await sheet._onDropSpecies(twilekData);

    assert(actor.system.biography.species === "Twi'lek", "Actor biography species is set to Twi'lek");
    assert(actor.system.biography.specialAbilities === "Resistance to Heat", "Actor biography specialAbilities contains Resistance to Heat");
    
    const charmSkill = actor.items.find(i => i.type === "skill" && i.name.toLowerCase() === "charm");
    assert(charmSkill !== undefined, "Charm skill item was created");
    assert(charmSkill.system.value === 1, "Charm skill rank is 1");
    assert(charmSkill.system.freeRanks === 1, "Charm skill has 1 free rank");

    // Remove Species Test
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      await sheet._onRemoveSpecies();
    } finally {
      window.confirm = originalConfirm;
    }

    assert(actor.system.biography.species === "", "Actor biography species is reset to empty");
    assert(actor.system.biography.specialAbilities === "", "Actor biography specialAbilities is reset to empty");
    assert(actor.system.characteristics.brawn.value === 1, "Brawn reset to 1");
    assert(actor.system.creation.startingXp === 0, "Starting XP reset to 0");
    assert(actor.system.creation.baseCharacteristics.brawn === 1, "Base Brawn reset to 1");
    assert(charmSkill.system.value === 0, "Charm skill rank reverted back to 0");
    assert(charmSkill.system.freeRanks === 0, "Charm skill free ranks reverted back to 0");

    // 11. Career Status Reversion Test
    console.log("SWFFG TEST | Starting Career Status Reversion tests...");
    
    // Add a specialization tree that grants Charm as a career skill
    const specTree = await actor.createEmbeddedDocuments("Item", [{
      name: "Performer Tree",
      type: "specialization",
      system: { careerSkills: "charm", classification: "career" }
    }]);
    await actor.recalculateCareerSkills(); // Await async recalculation

    // Charm should now be a career skill
    const updatedCharmSkill = actor.items.find(i => i.type === "skill" && i.name.toLowerCase() === "charm");
    assert(updatedCharmSkill.system.career === true, "Charm is now marked as a career skill");

    // Simulate player purchasing rank 2 in Charm (above freeRanks which is 0)
    await updatedCharmSkill.update({ "system.value": 2 });
    assert(updatedCharmSkill.system.value === 2, "Charm skill rank updated to 2");

    // Delete the specialization tree
    await actor.deleteEmbeddedDocuments("Item", [specTree[0].id]);
    await actor.recalculateCareerSkills(); // Await async recalculation
    
    // Charm should revert to non-career and value should fall back to freeRanks (0)
    assert(updatedCharmSkill.system.career === false, "Charm reverted to non-career skill after specialization deletion");
    assert(updatedCharmSkill.system.value === 0, "Charm skill value automatically reset to freeRanks (0) to prevent illegal states");

  } catch (error) {
    console.error("SWFFG TEST | Test suite encountered an error:", error);
  } finally {
    // Cleanup character
    await actor.delete();
    console.log("SWFFG TEST | Cleanup complete. Temp character deleted.");
  }
})();
