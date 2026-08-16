/**
 * SWFFG Headless Test: Weapon Attack Roll Resolution & Skill Normalization
 *
 * Can be run in Foundry V14 F12 Developer Console.
 */
(async function testWeaponAttackRolls() {
  console.log("==================================================");
  console.log("SWFFG TEST | Weapon Attack Rolls & Normalization");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = "") {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} ${details ? "(" + details + ")" : ""}`);
      failed++;
    }
  }

  // 1. Create a Test Character
  const actor = await Actor.create({
    name: "Test-Sniper",
    type: "character",
    system: {
      characteristics: {
        agility: { value: 3 },
        brawn: { value: 2 },
        intellect: { value: 2 },
        cunning: { value: 2 },
        willpower: { value: 2 },
        presence: { value: 2 }
      },
      creation: {
        isCreationMode: false
      }
    }
  });

  try {
    // 2. Add Ranged - Heavy skill (Rank 2)
    const skillItem = await Item.create({
      name: "Ranged - Heavy",
      type: "skill",
      system: {
        value: 2,
        characteristic: "agility"
      }
    }, { parent: actor });

    // 3. Add Talents with normalized and legacy boost skill notations
    const talent1 = await Item.create({
      name: "Sniper Aim",
      type: "talent",
      system: {
        boostSkills: "Ranged - Heavy",
        ranks: 1
      }
    }, { parent: actor });

    const talent2 = await Item.create({
      name: "Deadly Accuracy",
      type: "talent",
      system: {
        boostSkills: "Ranged: Heavy", // Legacy colon format
        ranks: 1
      }
    }, { parent: actor });

    // 4. Add Weapon with legacy skill notation
    const weapon = await Item.create({
      name: "DLT-19 Heavy Blaster",
      type: "weapon",
      system: {
        damage: 10,
        critical: 3,
        range: "Long",
        skill: "Ranged: Heavy" // Legacy format from adversary import
      }
    }, { parent: actor });

    // 5. Test Sheet Context Resolution
    const sheet = new actor.sheet.constructor({ document: actor });
    sheet.editMode = true;
    const context = await sheet._prepareContext({});

    const resolvedWeapon = context.weapons.find(w => w.name === "DLT-19 Heavy Blaster");
    assert("Weapon found in sheet context", !!resolvedWeapon);
    assert("Weapon skill normalized to canonical", resolvedWeapon?.derivedSkillName === "Ranged - Heavy", `got ${resolvedWeapon?.derivedSkillName}`);
    assert("Weapon characteristic resolved", resolvedWeapon?.derivedCharacteristic === "agility", `got ${resolvedWeapon?.derivedCharacteristic}`);
    assert("Weapon rank resolved", resolvedWeapon?.derivedRank === 2, `got ${resolvedWeapon?.derivedRank}`);

    // 6. Test Mock Attack Roll Event
    let capturedPool = null;
    const originalRoller = game.starwarsFFG?.diceRoller;
    if (!game.starwarsFFG) game.starwarsFFG = {};
    game.starwarsFFG.diceRoller = {
      setPool(pool) {
        capturedPool = pool;
      },
      render() {}
    };

    const mockEvent = {
      preventDefault() {},
      currentTarget: {
        dataset: {
          name: resolvedWeapon.derivedSkillName,
          skill: resolvedWeapon.derivedSkillName,
          characteristic: resolvedWeapon.derivedCharacteristic,
          rank: resolvedWeapon.derivedRank,
          weaponName: resolvedWeapon.name
        }
      }
    };

    await sheet._onRollSkill(mockEvent);

    assert("Dice pool captured", !!capturedPool);
    assert("Ability dice (Green) == 1 (|3 Agility - 2 Rank|)", capturedPool?.ability === 1, `got ${capturedPool?.ability}`);
    assert("Proficiency dice (Yellow) == 2 (min(3 Agility, 2 Rank))", capturedPool?.proficiency === 2, `got ${capturedPool?.proficiency}`);
    assert("Boost dice (Blue) == 2 (from both talents)", capturedPool?.boost === 2, `got ${capturedPool?.boost}`);

    // Restore original roller
    if (originalRoller) game.starwarsFFG.diceRoller = originalRoller;

    // 7. Test New Weapon Item Default
    const defaultWeapon = await Item.create({
      name: "New Blaster",
      type: "weapon"
    });
    assert("Newly created weapon has canonical default skill 'Ranged - Light'", defaultWeapon.system.skill === "Ranged - Light", `got ${defaultWeapon.system.skill}`);
    await defaultWeapon.delete();

  } finally {
    await actor.delete();
    console.log("SWFFG TEST | Cleanup completed.");
  }

  console.log("==================================================");
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("==================================================");
})();
