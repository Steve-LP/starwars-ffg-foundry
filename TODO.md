# TODO: Star Wars FFG Foundry V14

Open bugs, unverified features and deferred roadmap items.
Reconstructed on 2026-10-07 from the Antigravity sessions (June–August 2026) and a code check.
Keep this file current: items agreed "for later" in chat belong here, not only in the conversation.

---

## 1. Bugs (mechanics)

- [ ] **Triumph/Despair counted twice** (`module/dice.js`, `rollFFGPool`)
  Triumph faces store `{ success: 1, triumph: 1 }`, then the net calculation adds
  `rawTotals.success + rawTotals.triumph` again. One Proficiency die showing Triumph
  yields 2 successes instead of 1. Same for Despair (2 failures instead of 1).
  Rule: Triumph = 1 success + 1 Triumph; Despair = 1 failure + 1 Despair.
- [ ] **Dice So Nice shows no 3D dice** (`module/starwars-ffg.js`, `diceSoNiceReady` hook)
  Live test (Aug 2026): no 3D dice at all. Cause found in DsN 6.2.9 source:
  `addDicePreset` reads `CONFIG.Dice.terms[<letter>].name`; no terms are registered for
  `a`/`p`/`b`/`s`, so the first preset (`da`) throws and the hook aborts.
  Additionally `dc`/`df` collide with DsN's core Coin (d2) and Fate die (d6) and would be
  rendered as those even after the crash is fixed.

## 2. Unverified (needs a live test in Foundry)

- [ ] Item sheet parse error ("Parse error on line 199") — fixed in `548c86b`, open a compendium item to confirm
- [ ] Wizard: "Actor … does not exist" after choosing a species — window cleanup added, never confirmed with a real, freshly created character
- [ ] Wizard end-to-end smoke test (last open item of the Wizard Step 6 & 7 task list)
- [ ] Verification macro of 2026-08-19 (B1 universal vs. out-of-career cost, A4 Knowledge names in the compendium index, B2 Duty/Morality via wizard, GM permission + log) — output never reported back
- [ ] Rival / Nemesis: only existence tested, no statblock/sheet verification

## 3. Deferred features (roadmap)

- [ ] **Homebrew careers: `narrativeType`** — optional field on `CareerData`
  (`"auto" | "obligation" | "duty" | "morality" | "none"`) so a GM can preset the narrative
  mechanic for custom careers. Current fallback: Obligation, manually switchable in wizard step 6.
- [ ] **Qualities engine** — weapon/armor qualities are free text; no automatic dice-pool or stat effects (Accurate, Defensive, Pierce …)
- [ ] **Force power trees** — interactive tree view analogous to `SWFFGSpecializationSheet`
- [ ] **Signature Abilities** — own item type + tree view (card on sheet exists already)
- [ ] **Vehicles / starships** — own roadmap block; 148 vehicle attachments already in the `attachments` compendium (`slotType: "vehicle"`)
- [ ] **Group actor** — optional second entry point for the XP batch dialog
- [ ] **UI scaling** on non-4K screens (raised June 2026)

## 4. Housekeeping

- [ ] Push to GitHub (credentials expired) and tag `v0.2.0`
- [ ] Remove fallback symlink `~/.gemini/antigravity/scratch/starwars-ffg-foundry` once the new location is confirmed working
