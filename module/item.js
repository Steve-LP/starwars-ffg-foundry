/**
 * Custom Item class for Star Wars FFG Ruleset
 */
export class SWFFGItem extends Item {
  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    const itemData = this;
    const system = itemData.system;

    if (this.type === "weapon" || this.type === "armor") {
      const attachments = system.attachments || [];
      let occupiedHP = 0;
      let damageBonus = 0;
      let criticalMod = 0;
      let soakBonus = 0;
      let defenceBonus = 0;
      const qualityMods = [];

      for (const att of attachments) {
        occupiedHP += att.hardpoints || 0;

        // Base modifiers of the attachment
        if (att.baseModifiers) {
          damageBonus += att.baseModifiers.damage || 0;
          criticalMod += att.baseModifiers.critical || 0;
          soakBonus += att.baseModifiers.soak || 0;
          if (att.baseModifiers.qualities) {
            qualityMods.push(att.baseModifiers.qualities);
          }
        }

        // Active/unlocked mods of the attachment
        const activeMods = (att.mods || []).filter(m => m.active);
        for (const mod of activeMods) {
          if (mod.type === "stat") {
            if (mod.target === "damage") damageBonus += mod.value || 0;
            else if (mod.target === "critical") criticalMod += mod.value || 0;
            else if (mod.target === "soak") soakBonus += mod.value || 0;
            else if (mod.target === "defence") defenceBonus += mod.value || 0;
          } else if (mod.type === "quality" && mod.target) {
            qualityMods.push(`${mod.target} ${mod.value || ""}`.trim());
          }
        }
      }

      // Store derived values on the Item document instance
      this.derived = {
        hardpointsRemaining: Math.max(0, (system.hardpoints || 0) - occupiedHP),
        damage: this.type === "weapon" ? (system.damage || 0) + damageBonus : 0,
        critical: this.type === "weapon" ? (system.critical || 0) + criticalMod : 0,
        qualities: this.type === "weapon" ? this._mergeQualities(system.qualities || "", qualityMods) : "",
        soak: this.type === "armor" ? (system.soak || 0) + soakBonus : 0,
        defence: this.type === "armor" ? (system.defence || 0) + defenceBonus : 0
      };
    }
  }

  _mergeQualities(baseQualityStr, qualityMods) {
    const qualities = {};
    const parseQualities = (str) => {
      if (!str) return;
      const parts = str.split(",").map(p => p.trim());
      for (const part of parts) {
        if (!part) continue;
        const match = part.match(/^([a-zA-Z\s\-\(\)]+)\s+(\d+)$/);
        if (match) {
          const name = match[1].trim();
          const value = parseInt(match[2]);
          qualities[name] = (qualities[name] || 0) + value;
        } else {
          qualities[part] = true;
        }
      }
    };

    parseQualities(baseQualityStr);
    for (const qMod of qualityMods) {
      parseQualities(qMod);
    }

    return Object.entries(qualities).map(([name, val]) => {
      if (val === true) return name;
      return `${name} ${val}`;
    }).join(", ");
  }
}
