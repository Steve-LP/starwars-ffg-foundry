/**
 * SWFFG Headless Test: Catalog Fields (Price, Rarity, Restricted, SlotType)
 *
 * Can be run in Foundry V14 F12 Developer Console.
 */
(async function testCatalogFields() {
  console.log("==================================================");
  console.log("SWFFG TEST | Catalog Fields (Price, Rarity, Restricted)");
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

  const createdItems = [];

  try {
    // 1. Weapon Item with custom catalog fields
    const weapon = await Item.create({
      name: "Heavy Blaster Pistol",
      type: "weapon",
      system: {
        price: 750,
        rarity: 6,
        restricted: true,
        damage: 7,
        critical: 3
      }
    });
    createdItems.push(weapon);

    assert("1) Weapon price persisted", weapon.system.price === 750, `got ${weapon.system.price}`);
    assert("2) Weapon rarity persisted", weapon.system.rarity === 6, `got ${weapon.system.rarity}`);
    assert("3) Weapon restricted persisted", weapon.system.restricted === true, `got ${weapon.system.restricted}`);

    // 2. Armor Item with custom catalog fields
    const armor = await Item.create({
      name: "Heavy Battle Armor",
      type: "armor",
      system: {
        price: 2500,
        rarity: 7,
        restricted: true,
        soak: 2,
        defence: 1
      }
    });
    createdItems.push(armor);

    assert("4) Armor price persisted", armor.system.price === 2500, `got ${armor.system.price}`);
    assert("5) Armor rarity persisted", armor.system.rarity === 7, `got ${armor.system.rarity}`);
    assert("6) Armor restricted persisted", armor.system.restricted === true, `got ${armor.system.restricted}`);

    // 3. Gear Item with custom catalog fields
    const gear = await Item.create({
      name: "Comlink (Long-range)",
      type: "gear",
      system: {
        price: 250,
        rarity: 2,
        restricted: false,
        encumbrance: 1
      }
    });
    createdItems.push(gear);

    assert("7) Gear price persisted", gear.system.price === 250, `got ${gear.system.price}`);
    assert("8) Gear rarity persisted", gear.system.rarity === 2, `got ${gear.system.rarity}`);
    assert("9) Gear restricted persisted", gear.system.restricted === false, `got ${gear.system.restricted}`);

    // 4. Attachment Item with custom catalog fields and slotType
    const attachment = await Item.create({
      name: "Telescopic Optical Sight",
      type: "attachment",
      system: {
        price: 500,
        rarity: 3,
        restricted: false,
        hardpoints: 1,
        slotType: "weapon"
      }
    });
    createdItems.push(attachment);

    assert("10) Attachment price persisted", attachment.system.price === 500, `got ${attachment.system.price}`);
    assert("11) Attachment rarity persisted", attachment.system.rarity === 3, `got ${attachment.system.rarity}`);
    assert("12) Attachment restricted persisted", attachment.system.restricted === false, `got ${attachment.system.restricted}`);
    assert("13) Attachment slotType persisted", attachment.system.slotType === "weapon", `got ${attachment.system.slotType}`);

    // 5. Default Values on Unconfigured New Items
    const defaultItem = await Item.create({
      name: "Default Gear",
      type: "gear"
    });
    createdItems.push(defaultItem);

    assert("14) Default price is 0", defaultItem.system.price === 0, `got ${defaultItem.system.price}`);
    assert("15) Default rarity is 0", defaultItem.system.rarity === 0, `got ${defaultItem.system.rarity}`);
    assert("16) Default restricted is false", defaultItem.system.restricted === false, `got ${defaultItem.system.restricted}`);

    // 6. Update Test
    await weapon.update({ "system.price": 800, "system.restricted": false });
    assert("17) Weapon price updated to 800", weapon.system.price === 800, `got ${weapon.system.price}`);
    assert("18) Weapon restricted updated to false", weapon.system.restricted === false, `got ${weapon.system.restricted}`);

  } finally {
    for (const item of createdItems) {
      await item.delete();
    }
    console.log("SWFFG TEST | Cleanup completed.");
  }

  console.log("==================================================");
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("==================================================");
})();
