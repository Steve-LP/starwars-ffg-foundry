/**
 * Headless-Test: Talent-Kosten, GM-Refunds & Attribut-Finalisierung
 *
 * Ausführung in der Foundry-Konsole (F12) als GM:
 *   (async () => {
 *     // Kopiere diesen gesamten Block in die Konsole
 *   })();
 */

(async () => {
  console.group("SWFFG TEST | Talent-Kosten, GM-Refunds & Attribut-Finalisierung");

  // 1. Test-Charakter erstellen
  const testActor = await Actor.create({
    name: "Talent Regression Test Dummy",
    type: "character",
    system: {
      xp: { available: 100, total: 100 },
      creation: {
        isCreationMode: true,
        startingXp: 100,
        baseCharacteristics: { brawn: 2, agility: 2, intellect: 2, cunning: 2, willpower: 2, presence: 2 },
        ledger: {
          speciesSkillChoice: "",
          freeCareerSkills: [],
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

  // Close any auto-opened CharacterBuilder for the test dummy
  for (const app of Object.values(ui.windows)) {
    if (app.actor?.id === testActor.id) app.close();
  }

  try {
    // ── Block 1: Talent-Kauf nach Reihen (5 XP, 10 XP, 15 XP) ──────────────────
    console.group("1) Talent-Kosten nach Reihe");

    // Reihe 1 (Row 0): 5 XP
    const startXp = testActor.system.xp.available;
    const r1 = await testActor.buyTalent({
      name: "Toughened",
      key: "toughened",
      activation: "Passive",
      description: "+2 Wundschwelle",
      specialization: "bounty hunter",
      row: 0,
      col: 0
    }, 5);
    console.assert(r1.success === true, "1.1 FAIL: Kauf Reihe 1 fehlgeschlagen");
    console.assert(testActor.system.xp.available === startXp - 5, `1.1 FAIL: XP nach Reihe 1 falsch: ${testActor.system.xp.available} (erwartet: ${startXp - 5})`);
    console.log(`1.1 Reihe 1 Kauf: ✅ 5 XP abgezogen (Verfügbar: ${testActor.system.xp.available} XP)`);

    // Reihe 2 (Row 1): 10 XP
    const r2 = await testActor.buyTalent({
      name: "Grit",
      key: "grit",
      activation: "Passive",
      description: "+1 Erschöpfung",
      specialization: "bounty hunter",
      row: 1,
      col: 0
    }, 10);
    console.assert(r2.success === true, "1.2 FAIL: Kauf Reihe 2 fehlgeschlagen");
    console.assert(testActor.system.xp.available === startXp - 15, `1.2 FAIL: XP nach Reihe 2 falsch: ${testActor.system.xp.available} (erwartet: ${startXp - 15})`);
    console.log(`1.2 Reihe 2 Kauf: ✅ 10 XP abgezogen (Verfügbar: ${testActor.system.xp.available} XP)`);

    // Reihe 3 (Row 2): 15 XP
    const r3 = await testActor.buyTalent({
      name: "Deadly Accuracy",
      key: "deadly_accuracy",
      activation: "Passive",
      description: "Zusätzlicher Schaden",
      specialization: "bounty hunter",
      row: 2,
      col: 0
    }, 15);
    console.assert(r3.success === true, "1.3 FAIL: Kauf Reihe 3 fehlgeschlagen");
    console.assert(testActor.system.xp.available === startXp - 30, `1.3 FAIL: XP nach Reihe 3 falsch: ${testActor.system.xp.available} (erwartet: ${startXp - 30})`);
    console.log(`1.3 Reihe 3 Kauf: ✅ 15 XP abgezogen (Verfügbar: ${testActor.system.xp.available} XP)`);

    console.groupEnd();

    // ── Block 2: Attribut-Kauf & lockCreation() ────────────────────────────────
    console.group("2) Attributssteigerung im Wizard / lockCreation()");

    await testActor.buyAttribute("brawn"); // Brawn 2 -> 3 (Kosten 30 XP im Ledger)
    console.log(`2.1 Brawn gesteigert: Ledger = ${testActor.system.creation.ledger.upgrades.characteristics.brawn}, derived Brawn = ${testActor.system.characteristics.brawn.value}`);

    const lockResult = await testActor.lockCreation();
    console.assert(lockResult.success === true, "2.2 FAIL: lockCreation fehlgeschlagen");
    console.assert(testActor.system.creation.isCreationMode === false, "2.2 FAIL: isCreationMode ist nicht false");
    console.assert(testActor.system.characteristics.brawn.value === 3, `2.2 FAIL: Brawn nach lockCreation nicht 3, sondern ${testActor.system.characteristics.brawn.value}`);
    console.log(`2.2 lockCreation: ✅ isCreationMode=false, Brawn=${testActor.system.characteristics.brawn.value} (korrekt im DB-Feld gespeichert)`);

    console.groupEnd();

    // ── Block 3: GM-Refunds im Play-Modus ──────────────────────────────────────
    console.group("3) Play-Modus Talent Refunds");

    const talentToRefund = testActor.items.find(t => t.type === "talent" && t.name === "Deadly Accuracy");
    console.assert(talentToRefund !== undefined, "3.1 FAIL: Talent nicht gefunden");

    // Simuliere Nicht-GM Check
    const origIsGM = game.user.isGM;
    game.user.isGM = false;
    const nonGmRefund = await testActor.refundTalent(talentToRefund.id, 15, "Deadly Accuracy");
    console.assert(nonGmRefund.success === false, "3.2 FAIL: Nicht-GM durfte Talent erstatten");
    console.log("3.2 Nicht-GM Refund:", nonGmRefund.success === false ? "✅ korrekt abgelehnt" : "❌ fälschlich erlaubt", nonGmRefund.message);

    // GM Refund
    game.user.isGM = true;
    const gmRefund = await testActor.refundTalent(talentToRefund.id, 15, "Deadly Accuracy");
    console.assert(gmRefund.success === true, "3.3 FAIL: GM Refund fehlgeschlagen");
    console.log(`3.3 GM Refund: ✅ 15 XP erstattet (Verfügbar: ${testActor.system.xp.available} XP)`);

    // Reset user state
    game.user.isGM = origIsGM;
    console.groupEnd();

  } finally {
    await testActor.delete();
    console.log("SWFFG TEST | Test Dummy gelöscht.");
    console.groupEnd();
  }
})();
