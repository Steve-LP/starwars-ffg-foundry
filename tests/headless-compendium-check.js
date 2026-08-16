/**
 * SWFFG Headless Test: Compendium Equipment Verification
 *
 * Can be run in Foundry V14 F12 Developer Console.
 */
(async function testCompendiumEquipment() {
  console.log("==================================================");
  console.log("SWFFG TEST | Compendium Equipment Verification");
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

  // 1. Check Armor Compendium
  const armorPack = game.packs.get("starwars-ffg-scratch.armor");
  assert("1) Armor compendium exists", !!armorPack);
  if (armorPack) {
    const index = await armorPack.getIndex({ fields: ["system.price", "system.rarity", "system.restricted", "system.soak", "system.defence", "system.hardpoints", "flags.starwarsffg.sources"] });
    assert("2) Armor pack contains items (>50)", index.size >= 50, `found ${index.size}`);

    // Core Sample: Armored Clothing
    const armoredClothing = index.find(i => i.name === "Armored Clothing");
    assert("3) Core Armor 'Armored Clothing' exists", !!armoredClothing);
    assert("   Armored Clothing Price == 1000", armoredClothing?.system?.price === 1000, `got ${armoredClothing?.system?.price}`);
    assert("   Armored Clothing Soak == 1", armoredClothing?.system?.soak === 1, `got ${armoredClothing?.system?.soak}`);
    assert("   Armored Clothing Defense == 1", armoredClothing?.system?.defence === 1, `got ${armoredClothing?.system?.defence}`);

    // Non-Core Sample: Rebel Heavy Battle Armor (Forged in Battle)
    const rebelArmor = index.find(i => i.name === "Rebel Heavy Battle Armor");
    assert("4) Non-Core Armor 'Rebel Heavy Battle Armor' exists", !!rebelArmor);
    assert("   Rebel Heavy Battle Armor Restricted == true", rebelArmor?.system?.restricted === true, `got ${rebelArmor?.system?.restricted}`);
    assert("   Rebel Heavy Battle Armor Soak == 2", rebelArmor?.system?.soak === 2, `got ${rebelArmor?.system?.soak}`);
  }

  // 2. Check Gear Compendium
  const gearPack = game.packs.get("starwars-ffg-scratch.gear");
  assert("5) Gear compendium exists", !!gearPack);
  if (gearPack) {
    const index = await gearPack.getIndex({ fields: ["system.price", "system.rarity", "system.restricted", "system.encumbrance"] });
    assert("6) Gear pack contains items (>300)", index.size >= 300, `found ${index.size}`);

    // Core Sample: Emergency Medpac
    const medpac = index.find(i => i.name === "Emergency Medpac");
    assert("7) Core Gear 'Emergency Medpac' exists", !!medpac);
    assert("   Emergency Medpac Price == 100", medpac?.system?.price === 100, `got ${medpac?.system?.price}`);

    // Non-Core Sample: Sporting Macrobinoculars (Nexus of Power)
    const sportingBinocs = index.find(i => i.name === "Sporting Macrobinoculars");
    assert("8) Non-Core Gear 'Sporting Macrobinoculars' exists", !!sportingBinocs);
    assert("   Sporting Macrobinoculars Price == 250", sportingBinocs?.system?.price === 250, `got ${sportingBinocs?.system?.price}`);
  }

  // 3. Check Attachments Compendium
  const attPack = game.packs.get("starwars-ffg-scratch.attachments");
  assert("9) Attachments compendium exists", !!attPack);
  if (attPack) {
    const index = await attPack.getIndex({ fields: ["system.price", "system.rarity", "system.restricted", "system.slotType", "system.hardpoints", "system.mods"] });
    assert("10) Attachments pack contains items (>150)", index.size >= 150, `found ${index.size}`);

    // Core Weapon Attachment: Augmented Spin Barrel
    const spinBarrel = index.find(i => i.name === "Augmented Spin Barrel");
    assert("11) Core Attachment 'Augmented Spin Barrel' exists", !!spinBarrel);
    assert("    Augmented Spin Barrel SlotType == 'weapon'", spinBarrel?.system?.slotType === "weapon", `got ${spinBarrel?.system?.slotType}`);
    assert("    Augmented Spin Barrel HP == 2", spinBarrel?.system?.hardpoints === 2, `got ${spinBarrel?.system?.hardpoints}`);

    // Core Armor Attachment: Superior Armor Customization
    const supArmor = index.find(i => i.name === "Superior Armor Customization");
    assert("12) Core Armor Attachment 'Superior Armor Customization' exists", !!supArmor);
    assert("    Superior Armor Customization SlotType == 'armor'", supArmor?.system?.slotType === "armor", `got ${supArmor?.system?.slotType}`);
  }

  // 4. Check Weapons Compendium
  const weaponPack = game.packs.get("starwars-ffg-scratch.weapons");
  assert("13) Weapons compendium exists", !!weaponPack);
  if (weaponPack) {
    const index = await weaponPack.getIndex({ fields: ["system.price", "system.rarity", "system.restricted", "system.damage", "system.critical", "system.range", "system.skill", "system.qualities"] });
    assert("14) Weapons pack contains items (>200)", index.size >= 200, `found ${index.size}`);

    // Core Weapon: Heavy Blaster Pistol
    const heavyPistol = index.find(i => i.name === "Heavy Blaster Pistol");
    assert("15) Core Weapon 'Heavy Blaster Pistol' exists", !!heavyPistol);
    assert("    Heavy Blaster Pistol Skill == 'Ranged - Light'", heavyPistol?.system?.skill === "Ranged - Light", `got ${heavyPistol?.system?.skill}`);
    assert("    Heavy Blaster Pistol Damage == 7", heavyPistol?.system?.damage === 7, `got ${heavyPistol?.system?.damage}`);

    // Non-Core Weapon: TT24 Holdout Blaster (Beyond the Rim)
    const tt24 = index.find(i => i.name === "TT24 Holdout Blaster");
    assert("16) Non-Core Weapon 'TT24 Holdout Blaster' exists", !!tt24);
    assert("    TT24 Damage == 6", tt24?.system?.damage === 6, `got ${tt24?.system?.damage}`);
    assert("    TT24 Range == 'Medium'", tt24?.system?.range === "Medium", `got ${tt24?.system?.range}`);
  }

  console.log("==================================================");
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("==================================================");
})();
