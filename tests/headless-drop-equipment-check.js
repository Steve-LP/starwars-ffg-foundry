/**
 * SWFFG Headless Test: Equipment Drag & Drop onto Actor Sheet
 * Tests dropping armor, weapons, and gear from compendiums onto SWFFGActorSheet.
 */
(async function testEquipmentDrop() {
  console.log("SWFFG TEST | Equipment Drop Verification");
  let passed = 0, failed = 0;
  function assert(name, condition, details = "") {
    if (condition) { console.log(`[PASS] ${name}`); passed++; }
    else { console.error(`[FAIL] ${name} ${details ? "(" + details + ")" : ""}`); failed++; }
  }

  const sheetClass = CONFIG.Actor.sheetClasses.character?.["starwars-ffg.SWFFGActorSheet"]?.cls;
  assert("1) SWFFGActorSheet is registered", !!sheetClass);

  const testActor = await Actor.create({
    name: "Drop-Tester",
    type: "character",
    system: {}
  });

  try {
    const sheet = new sheetClass({ document: testActor });
    await sheet.render({ force: true });
    await new Promise(r => setTimeout(r, 50));

    // 1. Test Armor Drop from Compendium
    const armorPack = game.packs.get("starwars-ffg-scratch.armor");
    assert("2) Armor pack exists", !!armorPack);

    if (armorPack) {
      const index = await armorPack.getIndex();
      const firstArmorEntry = index.contents[0];
      assert("3) Found armor entry in compendium", !!firstArmorEntry);

      if (firstArmorEntry) {
        const armorDoc = await armorPack.getDocument(firstArmorEntry._id);
        const dropEvent = {
          preventDefault: () => {},
          stopPropagation: () => {},
          target: sheet.element || document.body,
          dataTransfer: {
            getData: (type) => {
              if (type === "text/plain") {
                return JSON.stringify({ type: "Item", uuid: armorDoc.uuid });
              }
              return "";
            }
          }
        };

        // Trigger _onDrop
        let dropError = null;
        try {
          await sheet._onDrop(dropEvent);
        } catch (e) {
          dropError = e;
        }

        assert("4) _onDrop for armor executed without error", !dropError, dropError ? dropError.stack : "");
        const addedArmor = testActor.items.find(i => i.type === "armor" && i.name === armorDoc.name);
        assert("5) Armor was successfully added to actor items", !!addedArmor, `Found items: ${testActor.items.map(i => i.name).join(", ")}`);
      }
    }

    // 2. Test Weapon Drop from Compendium
    const weaponPack = game.packs.get("starwars-ffg-scratch.weapons");
    if (weaponPack) {
      const index = await weaponPack.getIndex();
      const firstWeaponEntry = index.contents[0];
      if (firstWeaponEntry) {
        const weaponDoc = await weaponPack.getDocument(firstWeaponEntry._id);
        const dropEvent = {
          preventDefault: () => {},
          stopPropagation: () => {},
          target: sheet.element || document.body,
          dataTransfer: {
            getData: (type) => type === "text/plain" ? JSON.stringify({ type: "Item", uuid: weaponDoc.uuid }) : ""
          }
        };

        let dropError = null;
        try {
          await sheet._onDrop(dropEvent);
        } catch (e) {
          dropError = e;
        }

        assert("6) _onDrop for weapon executed without error", !dropError, dropError ? dropError.stack : "");
        const addedWeapon = testActor.items.find(i => i.type === "weapon" && i.name === weaponDoc.name);
        assert("7) Weapon was successfully added to actor items", !!addedWeapon);
      }
    }

    await sheet.close();
  } finally {
    await testActor.delete();
  }

  console.log(`SWFFG TEST | Fertig. PASSED: ${passed}, FAILED: ${failed}`);
})();
