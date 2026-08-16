/**
 * SWFFG Headless Test: UI-Overhaul Verification
 * Tests tab restructuring, action bindings, and edit-mode state.
 */
(async function testUiOverhaul() {
  console.log("SWFFG TEST | UI-Overhaul & Sheet Verification");
  let passed = 0, failed = 0;
  function assert(name, condition, details = "") {
    if (condition) { console.log(`[PASS] ${name}`); passed++; }
    else { console.error(`[FAIL] ${name} ${details ? "(" + details + ")" : ""}`); failed++; }
  }

  // 1. Check TABS Configuration on SWFFGActorSheet
  const sheetClass = CONFIG.Actor.sheetClasses.character?.["starwars-ffg.SWFFGActorSheet"]?.cls;
  assert("1) SWFFGActorSheet is registered", !!sheetClass);

  if (sheetClass) {
    const tabs = sheetClass.TABS?.primary?.tabs;
    assert("2) Primary tabs count is exactly 4", Array.isArray(tabs) && tabs.length === 4, `found ${tabs?.length}`);
    
    const tabIds = tabs ? tabs.map(t => t.id) : [];
    assert("3) Tabs are ['overview', 'inventory', 'biography', 'xpLog']", 
      tabIds.includes("overview") && tabIds.includes("inventory") && tabIds.includes("biography") && tabIds.includes("xpLog"),
      `tabIds: ${JSON.stringify(tabIds)}`
    );

    assert("4) Initial tab is 'overview'", sheetClass.TABS?.primary?.initial === "overview");
    assert("5) Sheet action 'openSpecialization' is defined", typeof sheetClass.DEFAULT_OPTIONS?.actions?.openSpecialization === "function");
    assert("6) Sheet action 'openBuilder' is defined", typeof sheetClass.DEFAULT_OPTIONS?.actions?.openBuilder === "function");
    assert("7) Sheet action 'toggleEditMode' is defined", typeof sheetClass.DEFAULT_OPTIONS?.actions?.toggleEditMode === "function");
  }

  // 2. Check CharacterBuilder actions
  const { CharacterBuilder } = await import("./applications/character-builder.js");
  assert("8) CharacterBuilder is defined", !!CharacterBuilder);
  assert("9) CharacterBuilder action 'openTalentTree' is defined", typeof CharacterBuilder.DEFAULT_OPTIONS?.actions?.openTalentTree === "function");
  assert("10) CharacterBuilder width is fixed to 600px", CharacterBuilder.DEFAULT_OPTIONS?.position?.width === 600);

  // 3. Test Actor Sheet Rendering Context
  const testActor = await Actor.create({
    name: "UI-Test-Hero",
    type: "character",
    system: {
      characteristics: { brawn: { value: 2 }, agility: { value: 3 } }
    }
  });

  try {
    const sheet = new sheetClass({ document: testActor });
    assert("11) Sheet editMode defaults to false", sheet.editMode === false);
    
    const context = await sheet._prepareContext({});
    assert("12) Context has tabs object with overview", !!context.tabs?.overview);
    assert("13) Context tabGroups primary is 'overview'", sheet.tabGroups?.primary === "overview");
    assert("14) Context editMode matches sheet.editMode (false)", context.editMode === false);
    
    // Toggle editMode
    sheet.editMode = true;
    const editContext = await sheet._prepareContext({});
    assert("15) Toggled editMode is true in context", editContext.editMode === true);

  } finally {
    await testActor.delete();
  }

  console.log(`SWFFG TEST | Fertig. PASSED: ${passed}, FAILED: ${failed}`);
})();
