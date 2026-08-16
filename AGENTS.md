# Entwicklungsrichtlinien: Star Wars FFG für Foundry V14

> **Diese Datei ist bindend für alle KI-Assistenten (Antigravity, Claude etc.)**  
> Vor jedem Arbeitsschritt lesen und einhalten. Keine Ausnahmen.

---

## WICHTIGSTE GRUNDREGEL

Wir entwickeln **ausschließlich für Foundry VTT V14**.  
Keine Abwärtskompatibilität. Kein Legacy-Code aus V11/V12/V13.  
Keine externen Frameworks oder Bibliotheken (kein Vue, React, Svelte, jQuery etc.).

---

## 1. Technologie-Stack (Vanilla & Native Only)

| Was | Vorgabe |
|---|---|
| JavaScript | ES6+ Module (`import`/`export`), kein CommonJS |
| CSS | Vanilla CSS / native CSS-Variablen, keine Frameworks |
| HTML | Native HTML5 + Handlebars (Foundry-Standard) |
| Foundry API | Nur V14 Core API (`foundry.applications.api`, `ApplicationV2`, `TypeDataModel`) |
| Externe Libs | **Verboten.** Jede externe Abhängigkeit ist eine zukünftige Bruchstelle |

**Grund:** Externe Abhängigkeiten brechen bei großen Foundry-Updates. Vanilla-Code lebt ewig.

---

## 2. Strikte Trennung: Logik ↔ UI (MVC)

### Logik-Schicht (DataModels, Documents, Rule Engine)
- Alle Spielregeln, Berechnungen, XP-Formeln, Würfelpools → **in TypeDataModel-Klassen**
- Diese Schicht **weiß nichts** vom DOM, HTML, CSS
- Jede Logik-Methode muss **ohne UI testbar** sein (headless, über Konsole/Makro)

### UI-Schicht (ApplicationV2 Sheets)
- Das UI ist **"dumm"** — es liest nur Daten und rendert sie
- Event-Listener **dürfen niemals** direkt Daten manipulieren oder Spiel-Logik ausführen
- Das UI ruft **ausschließlich** dedizierte, getestete Logik-Methoden auf
- Das UI darf **keine Validierungen umgehen** — Validierung gehört in die Logik

```
FALSCH: html.find(".buy-btn").click(() => actor.update({"system.xp": x - cost}))
RICHTIG: html.find(".buy-btn").click(() => actor.buySkillRank(skillName))
         // buySkillRank() enthaelt Validierung + Update
```

---

## 3. Modularität & Regressionsvermeidung

**Kein neues Feature darf ein bestehendes, funktionierendes Feature beschädigen ("killen").**

- Jedes Feature (Waffen, Machtkräfte, Fahrzeug-Kampf, Charaktererstellung) = eigenständiges ES6-Modul
- Erweiterung durch **Komposition** (neuen Code hinzufügen), nicht durch Umschreiben von Kernfunktionen
- Vor jeder Änderung: **Seiteneffekte prüfen** — was könnte das brechen?
- Bestehender, funktionierender Code wird **nicht ungefragt angefasst**

---

## 4. Testbarkeit (Headless Testing zuerst)

**Workflow: Zuerst Logik + Test → Test bestätigt → dann UI bauen**

Zu jedem neuen Logik-Block wird ein **Test-Snippet** geliefert (Foundry-Konsole oder Makro).  
Das UI-Fenster darf für diese Tests **niemals geöffnet werden müssen**.

---

## 5. Git-Workflow & Versionierung

- Änderungen werden **atomisch** geliefert (ein Feature = ein Commit)
- Neue Dateien: immer mit **exaktem Dateipfad** benennen
- Zu jedem erfolgreich getesteten Feature/Bugfix: **Commit-Message-Vorschlag** im Conventional Commits Format

```
feat: add dynamic XP cost recalculation on career change
fix: prevent skill rank below freeRanks floor on species removal
docs: update character-rules-guide with career skill cost table
```

---

## 6. Arbeitsweise & Code-Lieferung

1. **Schritt für Schritt** — kein monolithischer Code-Dump
2. **Reihenfolge:** Logik → Test → Bestätigung vom User → UI
3. **Logging:** Einheitliches Präfix `SWFFG | [ModulName]` für alle `console.debug/info/warn`
4. **Halluzinationen verboten:** Bei Unklarheit zur V14 API → offen kommunizieren, nicht raten
5. **Websuche:** Nur auf explizite Anforderung oder bei kritischer V14-API-Unklarheit

---

## 7. Bestehende Projekt-Dokumente (müssen bekannt sein)

| Datei | Inhalt |
|---|---|
| `character-rules-guide.md` | XP-Engine, API-Methoden, Skill-/Attribut-Kosten, Ausrüstungs-Architektur |
| `system-specification-ffg-creation.md` | Phase 1-3 Charaktererstellung, alle Härtefälle |
| `creation-xp-rules.md` | Detaillierte XP-Ledger-Regeln |
| `instructions.md` | Senior Developer Persona & V14 Guardrails |
| `CHANGELOG.md` | Chronologische Release- & Feature-Historie |

---

## 8. Antwort auf "Gilt das nur für die Charaktererstellung?"

**Nein. Die dynamische Skill-Kostenberechnung gilt für das gesamte Spielerleben.**

| Phase | Attribute | Skills | Talente |
|---|---|---|---|
| **Erstellung (isCreationMode=true)** | Kaufbar (10*neuer Wert) | Kaufbar bis Rang 2 | Kaufbar (5/10/15/20/25 XP) |
| **Im Spiel (isCreationMode=false)** | GESPERRT | Kaufbar bis Rang 5 | Kaufbar |

**Was sich ändert bei neuer Spezialisierung:**
Wenn eine neue Spezialisierung hinzukommt, werden deren Career-Skills zu Career-Skills des Chars.
Bereits gekaufte Ränge werden NICHT neu berechnet (regelkonform).
Nur neue Käufe profitieren von der günstigeren Rate.

**Was unser System tun muss:**
`isCareerSkill(skillName)` prüft dynamisch ob ein Skill aus der aktuellen Kombination
von Career + allen Spezialisierungen als Career-Skill gilt.
Reine Logik-Methode, ohne UI, jederzeit testbar.

---

*Letzte Aktualisierung: 2026-08-16 | Stand nach Equipment- & Kompendien-Befüllung*
