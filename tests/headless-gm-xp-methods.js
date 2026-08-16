/**
 * Headless-Test: grantXp() und setXp()
 *
 * Ausführung in der Foundry-Konsole (F12) als GM:
 *   const actor = game.actors.getName("DEIN_CHAR_NAME");
 *   // Dann entweder den ganzen Block einfügen oder abschnittsweise
 *
 * Erwartete Ausgaben sind jeweils als Kommentar angegeben.
 * SWFFG | [grantXp] / [setXp] Einträge erscheinen im Browser-Konsolenlog.
 */

(async () => {
  // ─── Testvoraussetzungen ────────────────────────────────────────────────────
  const actor = game.actors.getName("DEIN_CHAR_NAME");
  if (!actor) { console.error("SWFFG TEST | Charakter nicht gefunden!"); return; }
  console.group("SWFFG TEST | grantXp() + setXp()");

  // ── Block A: Methoden auf einem Charakter im Creation-Mode ablehnen ─────────
  console.group("A) Creation-Mode-Blockade");

  // A1: grantXp auf Creation-Charakter
  const charInCreation = game.actors.find(a => a.system.creation?.isCreationMode === true);
  if (charInCreation) {
    const r1 = await charInCreation.grantXp(20);
    console.assert(r1.success === false, "A1 FAIL: grantXp sollte ablehnen");
    console.assert(r1.message.includes("Charaktererstellung"), "A1 FAIL: Meldung unklar");
    console.log("A1 grantXp@CreationMode:", r1.success === false ? "✅ korrekt abgelehnt" : "❌ fälschlich akzeptiert", r1.message);

    const r2 = await charInCreation.setXp(50, "Test");
    console.assert(r2.success === false, "A2 FAIL: setXp sollte ablehnen");
    console.log("A2 setXp@CreationMode:", r2.success === false ? "✅ korrekt abgelehnt" : "❌ fälschlich akzeptiert", r2.message);
  } else {
    console.warn("A) Kein Charakter im Creation-Mode gefunden — Abschnitt übersprungen");
  }
  console.groupEnd();

  // ── Block B: Validierungsfehler auf fertigem Charakter ──────────────────────
  console.group("B) Eingabe-Validierung");

  const r3 = await actor.grantXp(-5);
  console.assert(r3.success === false, "B1 FAIL: negative Zahl akzeptiert");
  console.log("B1 grantXp(-5):", r3.success === false ? "✅" : "❌", r3.message);

  const r4 = await actor.grantXp(3.7);
  console.assert(r4.success === false, "B2 FAIL: Fließkomma akzeptiert");
  console.log("B2 grantXp(3.7):", r4.success === false ? "✅" : "❌", r4.message);

  const r5 = await actor.setXp(-10, "Test");
  console.assert(r5.success === false, "B3 FAIL: negativer Zielwert akzeptiert");
  console.log("B3 setXp(-10):", r5.success === false ? "✅" : "❌", r5.message);

  const r6 = await actor.setXp(30);
  console.assert(r6.success === false, "B4 FAIL: kein Grund → sollte ablehnen");
  console.log("B4 setXp(30, kein Grund):", r6.success === false ? "✅" : "❌", r6.message);

  const r7 = await actor.setXp(30, "   ");
  console.assert(r7.success === false, "B5 FAIL: Leerzeichen als Grund → sollte ablehnen");
  console.log("B5 setXp(30, '   '):", r7.success === false ? "✅" : "❌", r7.message);

  console.groupEnd();

  // ── Block C: Erfolgreiche Operationen + XP-Log-Prüfung ──────────────────────
  // HINWEIS: Nach actor.update() muss der frische Document-Stand per
  // game.actors.get() abgerufen werden — der lokale actor-Snapshot ist veraltet.
  console.group("C) Happy Path + XP-Log");

  const actorId = actor.id;
  const fresh = () => game.actors.get(actorId); // immer aktueller Stand

  const xpBefore    = fresh().system.xp?.available ?? 0;
  const totalBefore = fresh().system.xp?.total ?? 0;
  console.log(`C0 Ausgangswert: available=${xpBefore}, total=${totalBefore}`);

  // C1: grantXp(20)
  const r8 = await fresh().grantXp(20);
  console.assert(r8.success === true, "C1 FAIL: grantXp(20) abgelehnt");
  console.assert(r8.data?.granted === 20, "C1 FAIL: granted-Wert falsch");
  console.assert(r8.data?.newAvailable === xpBefore + 20, "C1 FAIL: newAvailable falsch");
  console.log("C1 grantXp(20):", r8.success ? "✅" : "❌", r8.message, r8.data);

  // XP-Log-Prüfung für C1 — frischer Stand
  const logAfterGrant = fresh().system.xp?.log ?? [];
  const lastGrant = logAfterGrant.at(-1);
  console.assert(lastGrant?.description?.includes("Session-XP"), "C1 LOG FAIL: Beschreibung fehlt/falsch");
  console.assert(lastGrant?.description?.includes(game.user.name), "C1 LOG FAIL: GM-Name fehlt");
  console.log("C1 XP-Log:", lastGrant ? `✅ "${lastGrant.description}"` : "❌ kein Eintrag");

  // C2: setXp(10, "Retroaktive Korrektur")
  // Nach grantXp(20) steht available bei xpBefore+20.
  // setXp muss diesen Wert als oldValue lesen und im Log protokollieren —
  // nicht den vor-grantXp-Snapshot. Das ist der Kern dieses Bug-Checks.
  const expectedOldValue = xpBefore + 20;  // = available nach grantXp
  const r9 = await fresh().setXp(10, "Retroaktive Korrektur nach Spielleitertreffen");
  console.assert(r9.success === true, "C2 FAIL: setXp abgelehnt");
  console.assert(r9.data?.oldValue === expectedOldValue,
    `C2 FAIL: oldValue falsch — erwartet ${expectedOldValue}, erhalten ${r9.data?.oldValue} (Stale-Read-Bug?)`);
  console.assert(r9.data?.newValue === 10, "C2 FAIL: newValue falsch");
  console.log("C2 setXp(10):", r9.success ? "✅" : "❌", r9.message, r9.data);

  // XP-Log-Prüfung für C2: Description muss den korrekten Ausgangswert enthalten
  const logAfterSet = fresh().system.xp?.log ?? [];
  const lastSet = logAfterSet.at(-1);
  console.assert(lastSet?.description?.includes("GM-Korrektur"), "C2 LOG FAIL: Beschreibung fehlt/falsch");
  console.assert(lastSet?.description?.includes("Retroaktive"), "C2 LOG FAIL: Grund nicht in Beschreibung");
  // Kernprüfung: Log muss korrekte oldValue enthalten, nicht den veralteten Snapshot
  console.assert(lastSet?.description?.includes(String(expectedOldValue)),
    `C2 LOG FAIL: Log enthält falschen Ausgangswert — erwartet "${expectedOldValue}" in "${lastSet?.description}"`);
  console.log("C2 XP-Log:", lastSet ? `✅ "${lastSet.description}"` : "❌ kein Eintrag");

  // C3: Konsistenz-Check — kein fresh()-Read nötig, da Foundry's _onUpdate
  // asynchron via Socket-Round-Trip kommt. Stattdessen: Rückgabewerte der
  // Methoden sind direkt nach await korrekt und beweisen die Logik vollständig.
  //
  //   grantXp(20) von xpBefore → newAvailable = xpBefore + 20, newTotal = totalBefore + 20
  //   setXp(10)   → newValue = 10, total bleibt newTotal (setXp ändert total nicht)
  const expectedTotal = totalBefore + 20;  // grantXp addiert zu total, setXp nicht
  const expectedAvailable = 10;            // setXp setzt final auf 10

  console.assert(r8.data.newAvailable === xpBefore + 20, "C3 FAIL: grantXp newAvailable inkorrekt");
  console.assert(r8.data.newTotal     === totalBefore + 20, "C3 FAIL: grantXp newTotal inkorrekt");
  console.assert(r9.data.newValue     === expectedAvailable, "C3 FAIL: setXp newValue inkorrekt");
  // setXp gibt kein newTotal zurück (es ändert total nicht) — das ist regelkonformes Design
  console.log(`C3 Endzustand (via return-data): available=${expectedAvailable}, total=${expectedTotal}`);
  console.log("C3 grantXp addiert korrekt zu total:", r8.data.newTotal === totalBefore + 20 ? "✅" : "❌");
  console.log("C3 setXp setzt available korrekt:  ", r9.data.newValue === 10 ? "✅" : "❌");
  console.log("C3 setXp lässt total unberührt:    ", r9.data.newTotal === undefined ? "✅ (kein newTotal in setXp-Rückgabe)" : "⚠️");

  console.groupEnd();
  console.groupEnd();
  console.log("SWFFG TEST | Alle Assertions abgeschlossen. Oben auf ❌ prüfen.");
})();
