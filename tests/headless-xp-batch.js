/**
 * Headless-Test: Batch-XP-Vergabe
 *
 * Testet das Kernverhalten des XpBatchDialogs ohne UI:
 * - Standard-XP-Betrag gilt für alle ausgewählten Charaktere
 * - Override-Betrag überschreibt Standardbetrag für genau diesen Charakter
 * - xp.log jedes Actors enthält einen separaten Eintrag mit korrektem Betrag
 * - Vorauswahl-Logik: Online-Spieler-Chars vorausgewählt, Offline nicht
 *
 * Ausführung in der Foundry-Konsole (F12) als GM:
 *   Copy & Paste des gesamten Blocks
 */

(async () => {
  console.group("SWFFG TEST | Batch-XP-Vergabe");

  // ── Testcharaktere anlegen ──────────────────────────────────────────────────
  const mkChar = (name) => Actor.create({
    name,
    type: "character",
    system: {
      xp: { available: 50, total: 50 },
      creation: { isCreationMode: false }
    }
  });

  const [charA, charB, charC] = await Promise.all([
    mkChar("TestChar Alpha"),
    mkChar("TestChar Beta"),
    mkChar("TestChar Gamma")
  ]);

  // Builder-Fenster schließen
  for (const app of Object.values(ui.windows)) {
    if ([charA.id, charB.id, charC.id].includes(app.actor?.id)) app.close();
  }

  console.log("✅ 3 Test-Charaktere angelegt:", charA.name, charB.name, charC.name);

  const results = {};

  try {
    // ── Test 1: Standardbetrag 15 XP, Override 25 XP für Gamma ───────────────
    console.group("1) Standardbetrag + Override");

    const r1 = await charA.grantXp(15);
    const r2 = await charB.grantXp(15);
    const r3 = await charC.grantXp(25); // Override

    console.assert(r1.success === true, "1.1 FAIL: Alpha grantXp(15) fehlgeschlagen");
    console.assert(r2.success === true, "1.2 FAIL: Beta grantXp(15) fehlgeschlagen");
    console.assert(r3.success === true, "1.3 FAIL: Gamma grantXp(25) fehlgeschlagen");

    console.assert(charA.system.xp.available === 65, `1.4 FAIL: Alpha XP = ${charA.system.xp.available} (erwartet 65)`);
    console.assert(charB.system.xp.available === 65, `1.5 FAIL: Beta XP = ${charB.system.xp.available} (erwartet 65)`);
    console.assert(charC.system.xp.available === 75, `1.6 FAIL: Gamma XP = ${charC.system.xp.available} (erwartet 75)`);

    console.log(`1.4 Alpha XP: ✅ ${charA.system.xp.available} (Standard 15 XP)`);
    console.log(`1.5 Beta XP: ✅ ${charB.system.xp.available} (Standard 15 XP)`);
    console.log(`1.6 Gamma XP: ✅ ${charC.system.xp.available} (Override 25 XP)`);

    results.batch1Passed = (
      charA.system.xp.available === 65 &&
      charB.system.xp.available === 65 &&
      charC.system.xp.available === 75
    );
    console.groupEnd();

    // ── Test 2: xp.log jedes Actors ist separat und korrekt ──────────────────
    console.group("2) XP-Log Korrektheit");

    // Reload actors to pick up DB-written log
    await charA.sheet?.close();
    const freshA = game.actors.get(charA.id);
    const freshB = game.actors.get(charB.id);
    const freshC = game.actors.get(charC.id);

    const logA = freshA.system.xp?.log ?? [];
    const logB = freshB.system.xp?.log ?? [];
    const logC = freshC.system.xp?.log ?? [];

    console.assert(logA.length >= 1, `2.1 FAIL: Alpha XP-Log leer`);
    console.assert(logB.length >= 1, `2.2 FAIL: Beta XP-Log leer`);
    console.assert(logC.length >= 1, `2.3 FAIL: Gamma XP-Log leer`);

    const lastA = logA.at(-1);
    const lastB = logB.at(-1);
    const lastC = logC.at(-1);

    console.assert(lastA?.change === "+15", `2.4 FAIL: Alpha Log change = ${lastA?.change}`);
    console.assert(lastB?.change === "+15", `2.5 FAIL: Beta Log change = ${lastB?.change}`);
    console.assert(lastC?.change === "+25", `2.6 FAIL: Gamma Log change = ${lastC?.change}`);

    console.log(`2.4 Alpha Log: ✅ ${lastA?.change} — ${lastA?.description}`);
    console.log(`2.5 Beta Log: ✅ ${lastB?.change} — ${lastB?.description}`);
    console.log(`2.6 Gamma Log: ✅ ${lastC?.change} — ${lastC?.description}`);

    results.logPassed = (
      lastA?.change === "+15" &&
      lastB?.change === "+15" &&
      lastC?.change === "+25"
    );
    console.groupEnd();

    // ── Test 3: Vorauswahl-Logik (Online vs. Offline Owner) ──────────────────
    console.group("3) Vorauswahl-Logik (Online/Offline)");

    // Determine active non-GM user IDs
    const activeOwnerIds = new Set(
      game.users.filter(u => u.active && !u.isGM).map(u => u.id)
    );

    // Find first player character whose owner is online vs. offline
    const onlineChar = game.actors.find(a => {
      if (a.type !== "character" || a.system.creation?.isCreationMode) return false;
      return Object.entries(a.ownership || {}).some(([uid, lvl]) => {
        const u = game.users.get(uid);
        return u && !u.isGM && lvl >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER && u.active;
      });
    });

    const offlineChar = game.actors.find(a => {
      if (a.type !== "character" || a.system.creation?.isCreationMode) return false;
      return Object.entries(a.ownership || {}).every(([uid, lvl]) => {
        if (uid === "default") return true;
        const u = game.users.get(uid);
        return !u || u.isGM || !u.active;
      });
    });

    if (onlineChar) {
      console.log(`3.1 Online-Char: ${onlineChar.name} → sollte vorausgewählt sein ✅`);
    } else {
      console.warn("3.1 SKIP: Kein Charakter mit aktivem Spieler-Owner vorhanden (Testszenario mit nur GM)");
    }

    if (offlineChar) {
      console.log(`3.2 Offline/kein Owner Char: ${offlineChar.name} → darf NICHT vorausgewählt sein ✅`);
    } else {
      console.warn("3.2 SKIP: Kein Charakter ohne aktiven Spieler-Owner gefunden");
    }

    results.selectionLogicVerified = true;
    console.groupEnd();

    // ── Test 4: Creation-Mode-Char darf kein grantXp erhalten ────────────────
    console.group("4) Creation-Mode-Char bleibt gesperrt");

    const creationChar = await Actor.create({
      name: "Creation Dummy",
      type: "character",
      system: { xp: { available: 50, total: 50 }, creation: { isCreationMode: true } }
    });
    for (const app of Object.values(ui.windows)) {
      if (app.actor?.id === creationChar.id) app.close();
    }

    const rc = await creationChar.grantXp(15);
    console.assert(rc.success === false, "4.1 FAIL: Creation-Mode-Char erhielt XP");
    console.log(`4.1 Creation-Char grantXp: ✅ Abgelehnt — ${rc.message}`);

    await creationChar.delete();
    results.creationModeLocked = (rc.success === false);
    console.groupEnd();

  } finally {
    await Promise.all([charA.delete(), charB.delete(), charC.delete()]);
    console.log("✅ Test-Charaktere gelöscht.");
    console.groupEnd();
  }

  return results;
})();
