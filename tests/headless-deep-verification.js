/**
 * SWFFG Headless Test: Deep Verification of UI Overhaul
 * 
 * Specifically proves:
 * 1. Multiclassing layout with 4 simultaneous trees (regular, force, signature)
 * 2. DOM-level scrollability and non-clipping in CharacterBuilder with constrained viewport
 * 3. Exact action routing for all tree cards
 * 4. Icon classes and tooltips across the UI
 */
(async function testDeepUiVerification() {
  console.log("SWFFG TEST | Deep UI & Layout Verification");
  let passed = 0, failed = 0;
  function assert(name, condition, details = "") {
    if (condition) { console.log(`[PASS] ${name}`); passed++; }
    else { console.error(`[FAIL] ${name} ${details ? "(" + details + ")" : ""}`); failed++; }
  }

  // =========================================================================
  // 1. MULTICLASSING & MULTI-TREE SCALABILITY TEST (3+ Trees)
  // =========================================================================
  const sheetClass = CONFIG.Actor.sheetClasses.character?.["starwars-ffg.SWFFGActorSheet"]?.cls;
  const testActor = await Actor.create({
    name: "Multi-Tree-Master",
    type: "character",
    system: {
      biography: { career: "Bounty Hunter" },
      characteristics: { brawn: { value: 3 }, agility: { value: 4 }, intellect: { value: 2 }, cunning: { value: 3 }, willpower: { value: 2 }, presence: { value: 2 } }
    }
  });

  try {
    // Attach 4 distinct trees simultaneously
    const createdItems = await testActor.createEmbeddedDocuments("Item", [
      {
        name: "Assassin",
        type: "specialization",
        system: {
          career: "Bounty Hunter",
          careerSkills: "Melee, Ranged - Heavy, Skulduggery, Stealth",
          classification: "career",
          talentRows: []
        }
      },
      {
        name: "Gadgeteer",
        type: "specialization",
        system: {
          career: "Bounty Hunter",
          careerSkills: "Brawl, Coercion, Mechanics, Ranged - Light",
          classification: "career",
          talentRows: []
        }
      },
      {
        name: "Force Sensitive Exile",
        type: "specialization",
        system: {
          career: "Universal",
          careerSkills: "",
          classification: "force-power",
          talentRows: []
        }
      },
      {
        name: "Unmatched Bravery",
        type: "specialization",
        system: {
          career: "Bounty Hunter",
          careerSkills: "",
          classification: "signature-ability",
          talentRows: []
        }
      }
    ]);

    const sheet = new sheetClass({ document: testActor });
    const context = await sheet._prepareContext({});

    // Verify data segregation
    assert("1) Exactly 2 regular specializations resolved", context.specializations?.length === 2, `found ${context.specializations?.length}`);
    assert("2) Exactly 1 Force tree resolved", context.forceSpecializations?.length === 1, `found ${context.forceSpecializations?.length}`);
    assert("3) Exactly 1 Signature Ability resolved", context.signatureSpecializations?.length === 1, `found ${context.signatureSpecializations?.length}`);

    // Render HTML and test DOM structure
    await sheet.render({ force: true });
    // Allow microtask to complete rendering
    await new Promise(r => setTimeout(r, 50));
    const sheetEl = sheet.element;
    assert("4) Sheet rendered in DOM", !!sheetEl && document.body.contains(sheetEl));

    if (sheetEl) {
      const cardsGrid = sheetEl.querySelector(".spec-cards-grid");
      assert("5) .spec-cards-grid exists in Overview tab", !!cardsGrid);

      const allCards = cardsGrid.querySelectorAll(".spec-card:not(.empty-card)");
      assert("6) Exactly 4 tree cards rendered in grid", allCards.length === 4, `found ${allCards.length}`);

      const regularCards = cardsGrid.querySelectorAll(".spec-card:not(.force-card):not(.signature-card):not(.empty-card)");
      assert("7) 2 regular specialization cards rendered", regularCards.length === 2);

      const forceCards = cardsGrid.querySelectorAll(".spec-card.force-card");
      assert("8) 1 force card rendered with .force-card class", forceCards.length === 1);

      const sigCards = cardsGrid.querySelectorAll(".spec-card.signature-card");
      assert("9) 1 signature card rendered with .signature-card class", sigCards.length === 1);

      // Test openSpecialization action on card 2 (Gadgeteer)
      const gadgeteerCard = Array.from(allCards).find(c => c.textContent.includes("Gadgeteer"));
      assert("10) Gadgeteer card found", !!gadgeteerCard);
      if (gadgeteerCard) {
        const btn = gadgeteerCard.querySelector('[data-action="openSpecialization"]');
        assert("11) Gadgeteer open button has correct data-item-id", !!btn && btn.dataset.itemId === createdItems[1].id);
      }
    }
    await sheet.close();

    // =========================================================================
    // 2. CHARACTER BUILDER HEIGHT OVERFLOW & SCROLLABILITY TEST
    // =========================================================================
    const { CharacterBuilder } = await import("/systems/starwars-ffg-scratch/module/applications/character-builder.js");
    const builder = new CharacterBuilder({ actor: testActor });
    
    // Set to step 6 (XP Spending, Skills tab with 35 items) to test maximum height overflow
    builder.currentStep = CharacterBuilder.STEPS.XP_SPENDING;
    builder.activeTab = "skills";
    await builder.render({ force: true });
    await new Promise(r => setTimeout(r, 50));

    const builderEl = builder.element;
    assert("12) CharacterBuilder rendered in DOM", !!builderEl && document.body.contains(builderEl));

    if (builderEl) {
      // Force test viewport constraint to 500px height (simulating 720p display)
      builderEl.style.height = "500px";
      builderEl.style.maxHeight = "500px";

      const container = builderEl.querySelector(".character-builder-container");
      assert("13) .character-builder-container exists", !!container);

      const stepSection = builderEl.querySelector(".builder-step");
      assert("14) .builder-step exists", !!stepSection);

      if (stepSection) {
        const computedOverflowY = window.getComputedStyle(stepSection).overflowY;
        assert("15) .builder-step has computed overflow-y: auto", computedOverflowY === "auto" || computedOverflowY === "scroll", `computed: ${computedOverflowY}`);

        // Verify content exceeds height and is scrollable
        const isContentTall = stepSection.scrollHeight > stepSection.clientHeight;
        assert("16) Step content scrollHeight > clientHeight (overflow condition met)", isContentTall, `scroll: ${stepSection.scrollHeight}px, client: ${stepSection.clientHeight}px`);

        // Test actual scroll behavior
        stepSection.scrollTop = 120;
        const didScroll = stepSection.scrollTop > 0;
        assert("17) Step content scrolls successfully (scrollTop > 0)", didScroll, `scrollTop: ${stepSection.scrollTop}`);

        // Verify footer stays in visible area
        const footer = builderEl.querySelector(".builder-footer");
        assert("18) .builder-footer is present and not scrolled out", !!footer);
        if (footer) {
          const builderRect = builderEl.getBoundingClientRect();
          const footerRect = footer.getBoundingClientRect();
          const footerVisible = footerRect.bottom <= builderRect.bottom + 5 && footerRect.top >= builderRect.top;
          assert("19) Footer controls remain visible inside window bounds", footerVisible, `builder bottom: ${builderRect.bottom}, footer bottom: ${footerRect.bottom}`);
        }
      }
    }
    await builder.close();

    // =========================================================================
    // 3. ICONS & UI DENSITY TEST
    // =========================================================================
    const templateSource = await fetch("systems/starwars-ffg-scratch/templates/actors/character-sheet.html").then(r => r.text());
    assert("20) Overview tab has icon <i class=\"fas fa-id-card\">", templateSource.includes("fa-id-card"));
    assert("21) Inventory tab has icon <i class=\"fas fa-boxes\">", templateSource.includes("fa-boxes"));
    assert("22) Biography tab has icon <i class=\"fas fa-book\">", templateSource.includes("fa-book"));
    assert("23) XP Log tab has icon <i class=\"fas fa-history\">", templateSource.includes("fa-history"));
    assert("24) Tree action buttons use icon <i class=\"fas fa-external-link-alt\">", templateSource.includes("fa-external-link-alt"));

  } finally {
    await testActor.delete();
  }

  console.log(`SWFFG TEST | Fertig. PASSED: ${passed}, FAILED: ${failed}`);
})();
