# TODO: Star Wars FFG Foundry V14

Open bugs, unverified features and deferred roadmap items.
Reconstructed on 2026-10-07 from the Antigravity sessions (June–August 2026) and a code check.
Keep this file current: items agreed "for later" in chat belong here, not only in the conversation.

---

## 1. Bugs (mechanics)

- [x] **Triumph/Despair counted twice** (`module/dice.js`, `rollFFGPool`)
  Triumph faces store `{ success: 1, triumph: 1 }`, then the net calculation adds
  `rawTotals.success + rawTotals.triumph` again. One Proficiency die showing Triumph
  yields 2 successes instead of 1. Same for Despair (2 failures instead of 1).
  Rule: Triumph = 1 success + 1 Triumph; Despair = 1 failure + 1 Despair.
  Fixed in v0.2.1, verified in-game; headless test `tests/unit-dice-cancellation.js`.
- [x] **Dice So Nice shows no 3D dice** (`module/starwars-ffg.js`, `diceSoNiceReady` hook)
  Live test (Aug 2026): no 3D dice at all. Cause found in DsN 6.2.9 source:
  `addDicePreset` reads `CONFIG.Dice.terms[<letter>].name`; no terms are registered for
  `a`/`p`/`b`/`s`, so the first preset (`da`) throws and the hook aborts.
  Additionally `dc`/`df` collide with DsN's core Coin (d2) and Fate die (d6) and would be
  rendered as those even after the crash is fixed.
  Fixed in v0.2.1, verified in-game: `module/dice-so-nice.js` registers 7 FFG dice terms
  (`da` `di` `dp` `dr` `dw` `db` `ds`), headless test `tests/unit-dice-so-nice.js`.

- [x] **Compendium conversion dropped embedded documents** (`tools/repack-from-ndjson.mjs`)
  Found in-game 2026-10-08. The NeDB → LevelDB repack writes each document as one flat
  `!items!`/`!actors!` entry and ignores embedded collections. V14 expects the parent to hold
  only IDs and each child as its own key (`!actors.items!<actorId>.<itemId>`, verified against
  a Foundry-written world DB; `!tables.results!<tableId>.<resultId>` by the same convention).
  - Adversaries: 1,379 of 2,468 lost all embedded items — 4,072 total (2,066 weapons, 2,006 talents).
    Still present in legacy `packs/adversaries.db`.
  - Critical injury tables (both): stored under `!items!` instead of `!tables!`, results embedded
    in V11 format (`type: 0`, `text`) → both RollTable compendiums show 0 entries in-game.
  Fixed in v0.2.1, verified in-game (4,072 items, 21 + 15 results); headless test `tests/unit-pack-embedded.js`.
- [ ] **Adversary talents are placeholders** — 1,962 of 2,006 embedded talents are named "Talent"
  with no description (already in the original import, `tools/compile-stoogoff.js`). Source data needs re-import.
- [ ] **Adversaries have no skills** — neither the NeDB nor the LevelDB data contain skill ranks
  (system keys: characteristics, stats, biography only). Source data (Stoogoff) needs checking.

- [x] **Builder hid 41 of 114 specializations; in-career specs cost +10** (found 2026-10-08 in builder test)
  `SpecializationData` had no `key` field, so Foundry dropped the key that careers reference
  (`peace` → Peacekeeper); 17 of 20 careers were affected (Clone Soldier showed none).
  Spec cost compared names instead of keys, and `lockCreation()` drops the career snapshot,
  so every extra spec counted as out-of-career in play.
  Fixed, verified in-game (Guardian → Soresu Defender; after lock in-career 20 / other career 30):
  `key` field + `biography.careerSpecializations` (kept after lock), headless test `tests/headless-specialization-keys.js`.
  Characters locked before this fix have no `careerSpecializations` → recreate or migrate.
- [x] **XP log lumps and double-counts builder purchases** (XP balance itself is correct)
  Characteristic/skill purchases in the builder get no own entry; their cost lands in the next logged
  event ("Toughened (-5 XP)" logged as -85). `lockCreation()` then appends an itemized list of the same
  purchases, so the log sums to -180 for 90 XP actually spent (character "claude 2", 2026-10-08).
  Fixed: creation purchases are not logged; `lockCreation()` writes one summary entry with the actual spend
  and a per-category breakdown (flags deviations). Verified in-game, test `tests/headless-xp-log-summary.js`.
- [ ] **Builder talent tab only shows the starting specialization's tree** (found 2026-10-08: Clone Pilot + Agitator)
  `character-builder.js` (context + `#onTalentCardClick`) always uses `specializationSnapshot`; additional
  specs bought in step 7 cannot be opened or bought from. Needs a spec selector in the talents tab.
- [x] **Out-of-career spec bought during creation is charged 20 instead of 30 XP**
  `calculateSpentSpecializationXp()` (derived XP in creation) still checks `classification === "non-career"`,
  which no compendium spec has; the purchase dialog shows 30 via `calculateSpecializationCost()`.
  Surfaced by the new lock summary ("Abweichung zur Aufschlüsselung: -10 XP", character "claude 3").
  Fixed: uses `isCareerSpecialization()`; headless test (in-game) 12/12. Live builder re-test pending.
- [x] **Species skill choice is lost (e.g. Twi'lek gets neither Charm nor Deception)**
  The builder writes the chosen skill into the species modifiers string, but the derived calculation skips
  all choice options found there and `ledger.speciesSkillChoice` is never set → no free rank at all.
  `CHOICE_SPECIES` covers only 4 species; 32 species list several skills — which of those are a choice vs.
  both ranks needs a rules check per species (data format cannot express it).
  Fixed for the 4 `CHOICE_SPECIES` (Twi'lek, Devaronian, Weequay, Klatooinian): new logic method
  `setSpeciesSkillChoice()`, builder uses it; headless test `tests/headless-species-skill-choice.js` (in-game 23/23).
  Live builder re-test pending.
- [x] **12 species lost their starting Knowledge rank** (found 2026-10-08)
  Species data still used pre-A4 names ("Education", "Lore", "Warfare", "Core Worlds", "Xenology"), which the
  rank calculation did not find (Bardottan, Clone, Cosian, Drall, Elomin, Givin, Kel Dor, Mon Calamari,
  Muun ×2, Skakoan, Tholothian). Fixed by normalizing species skill names when read;
  test `tests/headless-species-skill-ranks.js` covers all 113 species (in-game: 128/128 skills).
- [ ] **Species choices not modeled yet** — rules check needed per species:
  - Human: one rank in each of two different non-career skills (data has no skills at all).
  - The other 28 species listing several skills: choice or both ranks?
  - Cerean: data `Vigilance:1,:1` — second skill name missing.
- [ ] **Display package (read-only, no automation)** — agreed 2026-10-08
  - "Merken" block on the character sheet overview: species abilities, conditional talents the system does
    not calculate itself, critical injuries. Dice tokens like `[SETBACK]` rendered as symbols.
    Situational abilities (e.g. Twi'lek arid/hot) stay GM adjudication — reminder only.
  - Species stat block (characteristics, wounds/strain, start XP, start skills incl. choices, abilities),
    shared partial used in the species item sheet (compendium) and as preview in builder step 1.
  - Optional later: reminder line in the roll dialog.
  - Not planned: stats in the compendium sidebar list (would hook into Foundry's directory rendering).
- [ ] **No universal specializations in the compendium** (Force Sensitive Exile/Emergent, Recruit) —
  none has `isUniversal` or `classification: "universal"`.

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

- [x] Push to GitHub and release `v0.2.0` (2026-10-08, built with `tools/build-release.sh`)
- [x] Release `v0.2.1` (dice fixes + compendium repair)
  Release steps: bump `version` + `download` URL in `system.json`, CHANGELOG entry, tag, `tools/build-release.sh <tag>`, `gh release create`
- [ ] Remove dead pack data: legacy NeDB `packs/*.db` files and unregistered `packs/careers_backup`, `packs/specializations_backup`
- [ ] Old `system.zip` versions (~60 MB each) remain in git history; only a history rewrite would shrink the repo
- [ ] Remove fallback symlink `~/.gemini/antigravity/scratch/starwars-ffg-foundry` once the new location is confirmed working
