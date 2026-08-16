# Star Wars FFG - Character Rules & XP Engine Guide

This document provides a comprehensive overview of the character creation rules, characteristic upgrades, skill ranks, specialization purchases, talent progression, and the dynamic XP engine as currently implemented in our Foundry VTT system.

---

## 1. Starting Base State (Default/Blank Character)

When a character sheet is initialized or fully reset (i.e. before selecting a species), the character has the following default state:

*   **Characteristics:** All characteristics default to **2**.
    *   `Brawn: 2`, `Agility: 2`, `Intellect: 2`, `Cunning: 2`, `Willpower: 2`, `Presence: 2`
*   **Base Thresholds:**
    *   Wound Threshold Base: **10**
    *   Strain Threshold Base: **10**
*   **XP Pool:** Total XP, Available XP, and Earned XP start at **0**.
*   **Biography:** Species, Career, Specializations, and Special Abilities are empty.
*   **Skill Ranks:** All skill items have rank `value = 0`, `freeRanks = 0`, and `career = false`.

---

## 2. Species Drop (`_onDropSpecies` & `_onRemoveSpecies`)

Dropping a species item from a compendium or folder onto a character sheet defines the core physical and mental starting capabilities:

### Species Selection (Drop)
1.  **Characteristics Update:**
    *   Overwrites the default `2`s with the species-specific starting characteristics (e.g. Brawn 1, Presence 3 for Twi'lek).
    *   Saves these starting values in `system.creation.baseCharacteristics` as a reference point for future XP upgrades.
2.  **Thresholds:** Overwrites base wounds and strain thresholds with the species base values.
3.  **Starting XP:** Sets `system.creation.startingXp` to the species starting XP (typically between 80 XP and 110 XP).
4.  **Species Skill Bonuses:** Updates any starting skills granted by the species:
    *   Increments `system.freeRanks` (free ranks) on the skill item.
    *   Adjusts the current rank `system.value` to match at least the granted free ranks.
5.  **Special Abilities:** Copies species-specific traits and passive abilities into `system.biography.specialAbilities`.

### Species Reversion (Removal)
When the species is removed from the sheet:
1.  **Default Restoration:** Reverts all characteristics and base characteristics back to the default **2**s.
2.  **Thresholds & XP:** Reverts wounds/strain bases to 10 and sets starting XP back to 0.
3.  **Skill Clean-up:** Subtracts species-granted starting ranks (`freeRanks`) from each skill's current rank and sets `freeRanks` back to 0.
4.  **Biography Reset:** Clears species name and special abilities.

---

## 3. Dynamic XP Calculations

XP is **never** manually subtracted or saved directly to a spent field database. Instead, available XP and spent XP are calculated dynamically on-the-fly inside `prepareDerivedData()` using the following formula:

$$\text{Available XP} = (\text{Starting XP} + \text{Duty XP} + \text{Earned XP}) - \text{Spent Attribute XP} - \text{Spent Skill XP} - \text{Spent Talent XP} - \text{Spent Specialization XP}$$

### A. Spent Attribute XP
*   Compares the current raw database values (`system.characteristics`) with the species starting values (`system.creation.baseCharacteristics`).
*   The XP cost to upgrade an attribute from value $B$ to value $C$ is computed as:
    $$\text{Upgrade Cost} = \sum_{v=B+1}^{C} v \times 10$$
    *(e.g., upgrading from 2 to 4 costs $30 + 40 = 70$ XP)*

### B. Spent Skill XP
*   Loops over all skill items and compares their current rank (`value`) to their free species-granted ranks (`freeRanks`). Ranks equal to or below `freeRanks` cost 0 XP.
*   Purchased ranks above `freeRanks` cost:
    *   **Career Skills:** `rank * 5` XP per purchased rank.
    *   **Non-Career Skills:** `(rank * 5) + 5` XP per purchased rank.
    $$\text{Rank Cost} = \sum_{r=\text{freeRanks}+1}^{\text{value}} (\text{isCareer} ? (r \times 5) : (r \times 5 + 5))$$
    *(e.g. purchasing rank 2 of a career skill costs 10 XP; if non-career, it costs 15 XP)*

### C. Spent Specialization XP
*   The first specialization tree (starting tree) is free (**0 XP**).
*   Subsequent specializations cost based on the number of owned specializations $N$:
    $$\text{Base Cost} = (N+1) \times 10 \text{ XP}$$
*   If the specialization's classification is `"non-career"`, there is an additional **+10 XP** penalty:
    $$\text{Non-Career Cost} = ((N+1) \times 10) + 10 \text{ XP}$$

### D. Spent Talent XP
*   **Spec-Tree Talents:** Cost is based on the grid row index ($0$-indexed):
    $$\text{Cost} = (\text{row} + 1) \times 5 \text{ XP}$$
    *(Row 0 costs 5 XP, Row 1 costs 10 XP, Row 2 costs 15 XP, etc.)*
*   **Standalone/Custom Talents:** Cost is based on the talent's tier:
    $$\text{Cost} = \text{tier} \times 5 \text{ XP}$$

---

## 4. Backend APIs & Constraints

The system exposes specialized asynchronous methods on the `SWFFGActor` class to perform actions while enforcing FFG rules:

| API Method | Description & Rules Enforced |
| :--- | :--- |
| `buyAttribute(attributeName)` | Increments attribute value by 1. Enforces: <br> 1. Must be in creation mode.<br> 2. Must have sufficient available XP.<br> 3. Must not exceed species limit (`startingXp + dutyXp`). |
| `decreaseAttribute(attributeName)` | Decrements attribute value by 1 and refunds XP. Enforces: <br> 1. Must be in creation mode.<br> 2. Cannot go below the species starting value. |
| `buySkillRank(name, char, cat)` | Upgrades skill rank by 1. Enforces: <br> 1. Must be in creation mode.<br> 2. Must have sufficient available XP.<br> 3. Skill rank cannot be upgraded past **rank 2** during creation. |
| `decreaseSkillRank(name)` | Decrements skill rank by 1 and refunds XP. Enforces: <br> 1. Must be in creation mode. <br> 2. Cannot go below `freeRanks` (starting species ranks). |
| `toggleSandboxMode()` | (GM Only) Activates sandbox mode, allowing GMs to bypass all XP, limit, and phase constraints. |
| `lockCreation()` | Finalizes character creation, locking all manual updates and XP upgrades for players. |
| `resetToCreationMode()` | Performs a full reset. Removes species, career, specs, talents, sets characteristics to 2, and resets XP logs. |

---

## 5. Career Skill & Status Reversions

When a specialization tree or a career is deleted, or career biography is removed:
1.  **Recalculation:** The system recalculates career skills from remaining specializations, career compendiums, and active talents.
2.  **Status Loss Reversion:** If a skill loses its `"career"` status:
    *   Its rank value automatically reverts back to its `freeRanks` (usually `0`).
    *   This prevents illegal character sheets (where a player had purchased cheaper career ranks that are now non-career).
    *   The XP spent on those lost ranks is dynamically refunded back to the player's available XP.
3.  **Audit Log entry:** A detailed transaction entry (e.g. `+15 XP erstattet durch Zurücksetzen...`) is automatically written to the XP log to track refunds.

---

## 6. The XP Audit Log (`system.xp.log`)

Any database change that alters `system.xp.available` or `system.xp.total` (either via UI button clicks, script updates, or flat manual inputs on the character sheet) is intercepted by `_preUpdate()` and logged:

*   **Positive changes:** Logged as XP refunds or grants (green badge `+X XP`).
*   **Negative changes:** Logged as XP expenditures (red/grey badge `-X XP`).
*   **Details:** Each log entry records a timestamp, the user who performed the edit, the description of the change, and the before/after available and total XP.

---

## 7. XP Granting & Group Distribution (`grantXp`)

The `SWFFGActor` class provides an asynchronous `grantXp(amount, options)` method for GM awards and session progression:

```javascript
await actor.grantXp(15, { reason: "Session 4 completion" });
```

*   **Ledger Enforcement:** Increments `system.experience.earned` and `system.experience.total` without overwriting historical creation baselines.
*   **Batch & Group XP Dialog:** Allows GMs to select multiple party members simultaneously. Pre-selection dynamically checks per actor if its assigned primary owner (player) is currently online (`user.active && actor.testUserPermission(user, "OWNER")`), preventing unintended XP distribution to inactive/offline players.

---

## 8. Canonical Skills & Normalization (`module/utils/skill-normalization.js`)

All 35 standard Star Wars FFG skills are strictly standardized in `CANONICAL_SKILLS`:

*   **Canonical Mapping:** Normalizes legacy inputs, OggDude keys (`RANGLT`, `RANGHVY`, `PILOTSP`, `PILOTPL`, `LTSABER`, `CORE`, `MED`, etc.), and punctuation variants (`Ranged: Heavy` / `Ranged-Heavy` $\rightarrow$ `Ranged - Heavy`).
*   **Idempotence:** `normalizeSkillName(name)` is idempotent; calling it on an already canonical skill returns the exact name without alteration.
*   **Characteristic Resolution:** `getSkillCharacteristic(skillName)` maps any skill to its governing characteristic (e.g. `Ranged - Heavy` $\rightarrow$ `agility`, `Brawl` $\rightarrow$ `brawn`, `Core Worlds` $\rightarrow$ `intellect`).

---

## 9. Weapon Attack Rolls & Talent Integration

Weapon attacks are wired directly through the central skill roll engine:

1.  **Context Enrichment:** In `SWFFGActorSheet._prepareContext()`, every weapon item is enriched with:
    *   `derivedSkillName`: Normalized standard skill name.
    *   `derivedCharacteristic`: Governing attribute key.
    *   `derivedRank`: Current character rank in that skill.
2.  **Attack Button Execution:** Clicking 🎲 on a weapon triggers `_onRollSkill(event)`:
    *   Passes the canonical skill name and characteristic.
    *   Queries active talents for skill boosts (`boostSkills`) and setback removal (`setbackRemoveSkills`).
    *   Pops the interactive dice pool builder with pre-calculated ability/proficiency dice and automatic talent boost/setback dice.

---

## 10. Equipment Architecture & Catalog Datasets

All equipment items share unified catalog and handling fields:

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `system.price` | `Number` | `0` | Base purchase price in Credits. |
| `system.rarity` | `Number` | `0` | Rarity rating on a scale of `0` to `10`. |
| `system.restricted` | `Boolean` | `false` | True if the item is black market / restricted. |

### Item Types & Schemas

*   **`weapon`**: Damage, Critical, Range, Encumbrance, Hardpoints, Qualities, Skill, Catalog fields.
*   **`armor`**: Soak, Defense rating, Encumbrance, Hardpoints, Qualities, Catalog fields.
*   **`gear`**: Description, Quantity, Encumbrance, Catalog fields.
*   **`attachment`**: Description, Hardpoints, Base Modifiers, Upgradeable `mods` array, Catalog fields, and `slotType`:
    *   `"weapon"`: Fits handheld/mounted weapons.
    *   `"armor"`: Fits personal armor.
    *   `"vehicle"`: Fits vehicle/starship hulls and systems.
    *   `"all"`: Universal gear and storage modifications.

### Compendium Packs (Foundry V14 LevelDB)

*   `starwars-ffg-scratch.weapons`: **480** items
*   `starwars-ffg-scratch.armor`: **112** items
*   `starwars-ffg-scratch.gear`: **586** items
*   `starwars-ffg-scratch.attachments`: **346** items (139 weapon, 59 armor, 125 vehicle, 23 universal)

