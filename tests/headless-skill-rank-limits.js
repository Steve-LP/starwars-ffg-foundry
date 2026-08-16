/**
 * Headless-Test: Dynamisches Skill-Rang-Limit (Creation Mode vs. Play Mode)
 *
 * Ausführung in der Foundry-Konsole (F12) als GM:
 *   (async () => { ... })();
 */

(async () => {
  console.group("SWFFG TEST | Dynamisches Skill-Rang-Limit");

  const testActor = await Actor.create({
    name: "Skill Limit Test Dummy",
    type: "character",
    system: {
      xp: { available: 200, total: 200 },
      creation: {
        isCreationMode: true,
        startingXp: 200,
        baseCharacteristics: { brawn: 2, agility: 2, intellect: 2, cunning: 2, willpower: 2, presence: 2 },
        ledger: {
          speciesSkillChoice: "",
          freeCareerSkills: ["athletics"],
          freeSpecializationSkills: [],
          upgrades: {
            characteristics: { brawn: 0, agility: 0, intellect: 0, cunning: 0, willpower: 0, presence: 0 },
            skills: {},
            talents: [],
            specializations: []
          }
        }
      }
    }
  });

  // Builder-Fenster für den Test-Dummy schließen
  for (const app of Object.values(ui.windows)) {
    if (app.actor?.id === testActor.id) app.close();
  }

  const results = {};

  try {
    // ── 1. Creation Mode: Max Rank = 2 ─────────────────────────────────────────
    console.group("1) Creation Mode (Limit = 2)");
    console.assert(testActor.getMaxSkillRank() === 2, "1.0 FAIL: getMaxSkillRank() sollte 2 sein");

    // Athletics: Startet bei freeRanks = 1 (durch freeCareerSkills)
    // Kauf auf Rang 2 (Upgrade 1)
    const r1 = await testActor.buySkillRank("Athletics", "brawn", "General");
    console.assert(r1.success === true, "1.1 FAIL: Kauf auf Rang 2 fehlgeschlagen");
    console.log("1.1 Kauf auf Rang 2: ✅", r1.message);

    // Versuch auf Rang 3 (Upgrade 2) -> Muss fehlschlagen
    const r2 = await testActor.buySkillRank("Athletics", "brawn", "General");
    console.assert(r2.success === false, "1.2 FAIL: Kauf auf Rang 3 durfte in Creation Mode nicht klappen");
    console.assert(r2.message.includes("Maximaler Rang (2)"), `1.2 FAIL: Falsche Meldung: ${r2.message}`);
    console.log("1.2 Kauf auf Rang 3 abgelehnt: ✅", r2.message);

    results.creationLimitPassed = (r1.success === true && r2.success === false);
    console.groupEnd();

    // ── 2. Finalisierung via lockCreation() ────────────────────────────────────
    console.group("2) lockCreation() & Übergang in den Play-Modus");
    const lockRes = await testActor.lockCreation();
    console.assert(lockRes.success === true, "2.1 FAIL: lockCreation fehlgeschlagen");
    console.assert(testActor.system.creation.isCreationMode === false, "2.2 FAIL: isCreationMode ist nicht false");
    console.assert(testActor.getMaxSkillRank() === 5, "2.3 FAIL: getMaxSkillRank() sollte jetzt 5 sein");

    // Prüfen, ob Athletics als Item mit Rang 2 existiert
    const athleticsItem = testActor.items.find(i => i.name.toLowerCase() === "athletics");
    console.assert(athleticsItem !== undefined && athleticsItem.system.value === 2, `2.4 FAIL: Athletics nicht auf Rang 2 im DB-Item: ${athleticsItem?.system?.value}`);
    console.log(`2.4 Athletics persistent: ✅ Rang = ${athleticsItem?.system?.value}`);
    console.groupEnd();

    // ── 3. Play Mode: Hochkaufen bis Rang 5, Rang 6 ablehnen ──────────────────
    console.group("3) Play Mode (Limit = 5)");

    // Kauf Rang 3 (Kosten: 3 * 5 = 15 XP)
    const r3 = await testActor.buySkillRank("Athletics", "brawn", "General");
    console.assert(r3.success === true, "3.1 FAIL: Kauf Rang 3 im Play-Modus fehlgeschlagen");
    console.log("3.1 Kauf auf Rang 3: ✅", r3.message);

    // Kauf Rang 4 (Kosten: 4 * 5 = 20 XP)
    const r4 = await testActor.buySkillRank("Athletics", "brawn", "General");
    console.assert(r4.success === true, "3.2 FAIL: Kauf Rang 4 fehlgeschlagen");
    console.log("3.2 Kauf auf Rang 4: ✅", r4.message);

    // Kauf Rang 5 (Kosten: 5 * 5 = 25 XP)
    const r5 = await testActor.buySkillRank("Athletics", "brawn", "General");
    console.assert(r5.success === true, "3.3 FAIL: Kauf Rang 5 fehlgeschlagen");
    console.log("3.3 Kauf auf Rang 5: ✅", r5.message);

    // Versuch Rang 6 -> Muss fehlschlagen
    const r6 = await testActor.buySkillRank("Athletics", "brawn", "General");
    console.assert(r6.success === false, "3.4 FAIL: Kauf Rang 6 durfte nicht klappen");
    console.assert(r6.message.includes("Maximaler Rang (5)"), `3.4 FAIL: Falsche Meldung: ${r6.message}`);
    console.log("3.4 Kauf auf Rang 6 abgelehnt: ✅", r6.message);

    results.playLimitPassed = (r3.success === true && r4.success === true && r5.success === true && r6.success === false);
    console.groupEnd();

  } finally {
    await testActor.delete();
    console.log("SWFFG TEST | Test Dummy gelöscht.");
    console.groupEnd();
  }

  return results;
})();
