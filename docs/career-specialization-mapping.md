# Career-Specialization Mapping (FFG Foundry)

## Konzept
Um einen geführten "Character Builder" oder intelligente Filter-Funktionen zu ermöglichen, wurde das Datenmodell erweitert. 

Im Star Wars FFG System gibt es zwei Typen von Spezialisierungen:
1. **Karriere-Spezialisierungen:** Sind an einen spezifischen Beruf (Career) gebunden (z. B. *Pilot* gehört zu *Smuggler*). Eine Spezialisierung kann theoretisch auch zu mehreren Berufen gehören.
2. **Universelle Spezialisierungen:** Sind an **keinen** Beruf gebunden und können von jedem Charakter gewählt werden (z. B. *Force Sensitive Exile*).

## Datenmodell-Erweiterung (`module/data-models.js`)
* `CareerData`: Besitzt das Feld `specializations` (Array of Strings). Dieses Array enthält die `key`-Werte (in Kleinschreibung) aller zugehörigen Spezialisierungen.
* `SpecializationData`: Besitzt das Feld `isUniversal` (Boolean). Ist dieses auf `true`, taucht die Spezialisierung bei jedem Beruf als gültige Option auf.

## Migration (OggDude Import)
Das Skript `tools/migrate-career-specializations.mjs` liest die XML-Rohdaten aus dem OggDude-Datensatz (Ordner `tools/data-oggdude/`) und schreibt die Zuordnungen automatisch in die Foundry LevelDB-Kompendien (`packs/careers` und `packs/specializations`).

**WICHTIG:** Das Skript arbeitet direkt auf der Foundry-Datenbank. **Foundry VTT muss beendet sein**, wenn das Skript über `node tools/migrate-career-specializations.mjs` ausgeführt wird (ansonsten gibt es einen "Resource temporarily unavailable" / LevelDB Lock-Fehler).

## Homebrew / Manuelle Anpassungen
Wenn ein Spielleiter neue Careers oder Specializations im Foundry UI anlegt:
* **Neue Spezialisierung:** Um sie universell zu machen, muss das Feld `isUniversal` (sofern im UI angebunden) auf `true` gesetzt werden. (Wenn das UI-Feld fehlt, kann es über die Konsole oder das direkte Editieren des Item-JSONs gesetzt werden).
* **Neuer Beruf:** Um Spezialisierungen zuzuweisen, muss das Array `specializations` mit den Keys der Spezialisierungen gefüllt werden. 

## Datenzugriff (API)
Für UI-Dialoge steht die Funktion `SWFFGActor.getSpecializationsForCareer(careerKey)` bereit. Sie gibt ein Objekt zurück:
```javascript
{
  careerSpecs: [...],        // Array der verknüpften Spezialisierungen
  universalSpecs: [...],     // Array aller universellen Spezialisierungen
  noCurationAvailable: false // True, falls der Beruf keine Verknüpfungen besitzt (Fallback)
}
```
