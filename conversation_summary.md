# Star Wars FFG Foundry VTT Project Context & Progress Summary

Use this document to quickly bootstrap the context of this project on a different PC or in a new AI conversation context.

---

## 1. Project Parameters & Architecture

*   **VTT Target**: Foundry VTT **V13 & V14** compatible. (V12 and below dropped).
*   **Data Model Architecture**: Implemented modern class-based ES Data Models extending `foundry.abstract.TypeDataModel` (located in `module/data-models.js`) instead of utilizing legacy static JSON definitions in `template.json`.
*   **Dice Engine**: Custom narrative cancellation engine (Success/Failure and Advantage/Threat cancellation, plus Triumph/Despair tracking) implemented in `module/dice.js`.
*   **UI styling**: Custom premium dark sci-fi HUD theme (`css/starwars-ffg.css`) utilizing vibrant HSL neon highlights and glassmorphism.

---

## 2. Integrated Databases & Compendiums

*   **NPC/Adversary Database**: 
    *   **Source**: Communities database from `swa.stoogoff.com` (`stoogoff/sw-adversaries`).
    *   **Volume**: **2,468 NPCs** compiled successfully from JSON data.
    *   **Output File**: `packs/adversaries.db` (Registered in `system.json`).
*   **System Reference Document (SRD)**:
    *   **Source**: Core skills & critical tables extracted from `https://sw-eote-srd.vercel.app/`.
    *   **Default Skills**: 27 standard skills compiled inside `packs/skills.db`.
    *   **RollTables**: 
        *   `packs/critical-injuries.db` (Character Critical Injury RollTable, 1d100)
        *   `packs/critical-injuries-vehicles.db` (Vehicle Critical Hit RollTable, 1d100)

---

## 3. How to Initialize and Run on a New PC

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/Steve-LP/starwars-ffg-foundry.git
    ```
2.  **Junction/Symlink the Workspace into Foundry VTT**:
    Open PowerShell as Administrator and run:
    ```powershell
    New-Item -ItemType Junction -Path "C:\Users\YOUR-USERNAME\AppData\Local\FoundryVTT\Data\systems\starwars-ffg-scratch" -Value "C:\Path\To\Cloned\Repository"
    ```
3.  **Local Compilation**:
    If you ever want to re-compile or update your NPC/SRD databases, run:
    ```bash
    # To compile Oggdude/Stoogoff adversaries
    node tools/compile-stoogoff.js
    
    # To scrape/compile SRD Skills and Tables
    node tools/import-srd.js
    ```
