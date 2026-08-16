# Changelog: Star Wars FFG Foundry V14

All notable changes, architectural implementations, and bug fixes for the Star Wars FFG Foundry V14 system.

---

## [2026-08-16] - Equipment System, Compendium Ingestion & Skill Roll Fixes

### 🚀 Features & Enhancements

#### 1. Equipment Catalog Fields & Data Models
- Extended all equipment data models (`WeaponData`, `ArmorData`, `GearData`, `AttachmentData`) in `module/data-models.js` with unified catalog fields:
  - `price`: `NumberField` (default `0`, min `0`)
  - `rarity`: `NumberField` (default `0`, min `0`, max `10`)
  - `restricted`: `BooleanField` (default `false`)
- Added `slotType` to `AttachmentData` (`"weapon"`, `"armor"`, `"vehicle"`, `"all"`).
- Updated item sheet `templates/items/item-sheet.html` with catalog, hardpoints, and slot type inputs.

#### 2. Canonical Skill Normalization (`module/utils/skill-normalization.js`)
- Created central helper module standardizing all 35 Star Wars FFG skills.
- Implemented `normalizeSkillName()`: converts legacy adversary skills, OggDude keys (`RANGLT`, `RANGHVY`, `PILOTSP`, `PILOTPL`, `LTSABER`, `CORE`, etc.), and delimiter variations (`Ranged: Heavy` $\rightarrow$ `Ranged - Heavy`).
- Implemented `getSkillCharacteristic()`: dynamically maps any skill to its governing attribute.
- Migrated 1,399 legacy weapon skill references in `packs/adversaries.db`.

#### 3. Weapon Attack Roll & Talent Boost Integration
- Updated `SWFFGActorSheet._prepareContext()` to enrich weapon items with `derivedSkillName`, `derivedCharacteristic`, and `derivedRank`.
- Re-wired `character-sheet.html` attack button to trigger `_onRollSkill` using canonical skill names.
- Integrated talent boosts (`boostSkills`, `setbackRemoveSkills`) directly into weapon attack dice pool construction.

#### 4. OggDude Equipment Parsers (`module/oggdude-importer.js`)
- Added `parseOggdudeArmor()`, `parseOggdudeGear()`, `parseOggdudeAttachments()`.
- Implemented `formatOggdudeDescription()` to convert BB-code tags and dice notations (`[SETBACK]`, `[BOOST]`, `[DIFFICULTY]`, etc.) into clean HTML.
- Standardized weapon and armor quality keys via `QUALITY_MAP`.
- Added defensive error isolation and default fallbacks for missing XML tags.

#### 5. Full Compendium Population (1,524 Items)
- Ingested all sourcebooks from OggDude XML dataset into Foundry LevelDB compendiums:
  - **`packs/armor`**: 112 items
  - **`packs/gear`**: 586 items
  - **`packs/attachments`**: 346 items (139 weapon, 59 armor, 125 vehicle, 23 universal)
  - **`packs/weapons`**: 480 items
- Added `tools/compile-equipment.js` compiler and updated `tools/repack-from-ndjson.mjs` for LevelDB packing via `classic-level`.
- Registered `attachments` compendium pack in `system.json`.

#### 6. Group XP Granting & Dynamic Owner Logic
- Implemented `SWFFGActor.grantXp(amount, options)` API method for session rewards and audit logging.
- Wired batch XP dialog to dynamically check primary owner online status (`user.active && actor.testUserPermission(user, "OWNER")`).

---

### 🐛 Bug Fixes
- **Encumbrance Reference**: Fixed `carriedEncumbrance is not defined` in `SWFFGActor.prepareDerivedData()`.
- **Sheet Scope Reference**: Fixed `isSandbox is not defined` in `SWFFGActorSheet._prepareSkills()`.
- **LevelDB Precedence**: Fixed empty LevelDB directory shadowing of `.db` files by repacking all 12 system compendiums into binary LevelDB directories.
- **Attachment Categorization**: Prevented vehicle/starship attachments from polluting character weapon/armor UI by introducing dedicated `slotType: "vehicle"`.

---

### 🧪 Test Suites Delivered
- `tests/unit-skill-normalization.js`: 57 node unit tests for canonical skill mapping.
- `tests/unit-importer-resilience.js`: 7 node unit tests for corrupted XML error isolation and slotType fallbacks.
- `tests/verify-equipment-samples.js`: Automated comparison of Core vs. Non-Core equipment against official FFG sourcebooks.
- `tests/headless-compendium-check.js`: 17 headless in-Foundry verification assertions across all 4 equipment compendiums.
