# 🛸 System Specification: Star Wars FFG Character Creation Engine

## 1. Core Identity & Architectural Goal
This document serves as the absolute, mathematically precise blueprint for implementing the Character Creation and XP Ledger system in Foundry VTT V14 using the Antigravity Framework. 

To ensure complete game balance and prevent "user errors" or regressions, the system must rigidly enforce the distinct rules of **Phase 2 (Creation Mode)** and automatically transition to **Phase 3 (In-Game Mode)** upon lock.

---

## Phase 1: The Static Foundation (Steps 1–3)
During this initial setup, data values are assigned statically to the Actor document. No XP calculations or purchases occur yet.

### Step 1: Background Narrative Selection
The player selects one primary narrative mechanic depending on the core rulebook used. At this stage, this selection has zero (0) XP impact:
* **Edge of the Empire:** Obligation
* **Age of Rebellion:** Duty
* **Force and Destiny:** Morality

### Step 2: Species Selection (Species)
Dropping a Species item onto the Actor sheet instantly overrides and locks the following baseline data:
1. **The 6 Core Attributes:** Brawn, Agility, Intellect, Cunning, Willpower, Presence. (e.g., Wookiee sets Brawn to 3, Agility to 1, others to 2). These values form the **Species Base Value (Floor)**.
2. **Wound Threshold:** A fixed species base integer (e.g., 10) + the current Brawn attribute.
3. **Strain Threshold:** A fixed species base integer (e.g., 10) + the current Willpower attribute.
4. **Starting XP:** A fixed starting account balance determined solely by the species (typically ranges between 90 and 110 XP).
5. **Free Species Ranks:** Fixed skill ranks granted by birth (e.g., Corellian grants 1 free rank in *Piloting (Space)*).
6. **Species Features:** Passive special abilities (e.g., Trandoshan regeneration).

### Step 3: Career & Starting Specialization
The player selects one Career (e.g., Hired Gun) and one free starting Specialization (e.g., Bodyguard).
1. **Career Skills:** The Career designates 8 fixed skills as Career Skills.
2. **Spec Skills:** The Specialization designates 4 fixed skills as Career Skills.
3. **Free Career Ranks:** The player selects exactly 4 unique skills out of the 8 Career Skills and receives 1 free rank in each.
4. **Free Specialization Ranks:** The player selects exactly 2 unique skills out of the 4 Spec Skills and receives 1 free rank in each.

> 🛑 **Strict Generation Hardcap:** No skill rank may exceed **Rank 2** during this initial phase, even if species, career, and specialization bonuses overlap on the same skill.

---

## Phase 2: Modification & XP Ledger Phase (Step 4)
This phase unlocks the XP wallet. The player starts with their `Starting XP`. The following calculation metrics, purchase rules, caps, and floors apply **ONLY** while `system.creation.isCreationMode === true`.

### 1. The Meta-Wallet (Generating Bonus Starting XP)
Before spending XP, the player can opt to adjust their background mechanic (from Step 1) to gain extra starting funds:
* **The Option:** Draw additional Obligation, reduce starting Duty, or shift Morality.
* **The Reward:** Grants either `+5 XP` or `+10 XP` maximum.
* **System Formula:** `Max_Attribute_XP = Species_Starting_XP + Bonus_XP`

### 2. Purchasing Attributes (CREATION ONLY)
Upgrading core attributes is heavily restricted and mathematically calculated.
* **Cost Formula:** `New Value * 10`
* **Example:** Upgrading Agility from 2 to 3 costs 30 XP ($3 \times 10$). Upgrading it further from 3 to 4 costs 40 XP ($4 \times 10$). Total cost to go from 2 to 4 is 70 XP.
* **System Hardcaps:**
  1. **Creation Cap:** No attribute can ever be upgraded beyond **Rank 5** during character creation.
  2. **Absolute Game Cap:** No attribute can ever exceed **Rank 6** at any point in the game (even via post-creation Dedication talents).
  3. **Total Wallet Cap:** The sum of all attribute upgrades (`currentAttributeXpSpent`) must never exceed `Max_Attribute_XP`.

### 3. Purchasing Skill Ranks
Players can buy additional skill ranks using their remaining pooled XP. Prices vary based on whether the target skill is a designated "Career Skill" (from Step 3).
* **Career Skill Cost:** `New Rank * 5`
  * Buying Rank 1 costs 5 XP ($1 \times 5$). Buying Rank 2 costs 10 XP ($2 \times 5$).
* **Non-Career Skill Cost:** `(New Rank * 5) + 5`
  * Buying Rank 1 costs 10 XP ($(1 \times 5) + 5$). Buying Rank 2 costs 15 XP ($(2 \times 5) + 5$).

> 🛑 **Creation Skill Cap:** No skill rank may be raised above **Rank 2** via XP spending during the character creation phase.

### 4. Purchasing Talents & Abilities
Players spend XP within specialization talent trees, force power trees, or signature ability trees.

* **A. Talent Trees & Force Power Trees (5 Rows × 4 Columns):**
  * Standard layout consists of 4 columns and 5 rows (20 nodes total).
  * **Talent Tree Cost Structure:** Determined strictly by the row index:
    * Row 1 (Top): **5 XP** per talent.
    * Row 2: **10 XP** per talent.
    * Row 3: **15 XP** per talent.
    * Row 4: **20 XP** per talent.
    * Row 5 (Bottom): **25 XP** per talent.
  * **Force Power Tree Cost Structure:**
    * Basic Power (Top block, typically spanning all columns): **10 XP** base cost.
    * Upgrades: Unlike standard talent trees, the upgrade costs in Force Power trees **are NOT row-dependent**. Instead, each node has a specific cost printed on its card (typically in increments of **5 XP, 10 XP, 15 XP, or 20 XP**).
  * **Prerequisite Rule:** A talent or force upgrade can only be purchased if it connects via an active grid line to a *previously purchased* adjacent or overhead node. Row 1 nodes (or the basic power) are unlocked by default.

* **B. Signature Ability Trees (3 Rows × 4 Columns):**
  * Grid layout consists of 4 columns and 3 rows.
  * **Signature Ability Cost Structure:**
    * Row 1 (Base Ability, spans 4 columns): **30 XP**.
    * Row 2 (4 upgrades): **10 XP** per upgrade.
    * Row 3 (Bottom, 4 upgrades): **15 XP** per upgrade.

### 5. Purchasing Additional Specialization Trees
Players may purchase extra talent trees immediately using starting XP.
* **Base Cost Formula:** `Current Number of Owned Trees * 10`
* **Career Premium:** Add a flat `+10 XP` penalty if the new tree does *not* belong to the Actor's primary Career (Out-of-Career). Universal trees are exempt from this penalty.

### 6. UI Refunding & Floor Management (Safety Boundaries)
The UI must allow fluid upgrading and downgrading of all selections, refunding spent XP dynamically back into the wallet. However, it must strictly prevent downgrading below established baselines:

* **Attribute Floors:** 
  * The absolute floor for each attribute is its **Species Base Value** (e.g., Brawn 3 for a Wookiee).
  * The UI minus button must be disabled as soon as the attribute value equals this species floor. Players cannot downgrade an attribute to gain "extra" XP.
* **Skill Floors:**
  * Free ranks granted by Species, Career, or Specialization choices act as the absolute floor for that skill.
  * The UI must only allow downgrading on ranks that were *actively bought with XP*. Free choices cannot be downgraded to harvest XP.
* **Species Removal (Reverse Logic):**
  * When a species is removed from the sheet, all core attributes are reset back to the default **2**s, and starting XP is reset to 0.
  * All skills that received free starting ranks from the species are radically reset to rank **0** (value = 0, freeRanks = 0).
  * If the player had purchased additional ranks for these species-granted skills (e.g., upgrading a species-granted rank 1 skill to rank 2), all purchased ranks are deleted and the spent XP is fully refunded to their wallet.
* **Specialization Floors:**
  * The primary starting specialization (purchased for 0 XP) cannot be deleted unless a replacement starting tree is designated.
  * Secondary purchased trees can be deleted, instantly refunding their full purchase cost (including any Out-of-Career penalties) back into the active ledger.

---

## Phase 3: Transition to In-Game Mode
When creation is complete, the user triggers the closure sequence, setting `system.creation.isCreationMode` to `false`.

### Permanent System State Changes:
1. **Attribute Lock:** All attribute plus/minus buttons are completely removed or disabled on the sheet. Attributes are frozen and can now only be increased via the "Dedication" talent within a talent tree (up to the absolute game cap of 6).
2. **Skill Cap Removal:** The Rank 2 ceiling on skills is removed. Skills can now be actively upgraded up to **Rank 5** using earned campaign XP.
3. **Wallet Separation:** All future XP awarded by the Game Master is funneled into `system.xp.earned`. The starting creation wallet is permanently locked from alterations.
4. **Vitality Freezing:** Maximum Wound and Strain thresholds are finalized and will only update reactively if specific talents (like *Toughened*) are acquired or lost.

### 🛠️ Game Master Override Exception
If the active Foundry VTT user possesses the **GAMEMASTER** role, the system bypasses all Phase 2 validation checks, limits, and floors, allowing the GM to manually sculpt or fix any attribute or skill value directly on the sheet at any time.
