/**
 * Modern TypeDataModel schema definitions for Foundry VTT V13 / V14
 */

class BaseActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      characteristics: new fields.SchemaField({
        brawn: new fields.SchemaField({ value: new fields.NumberField({ initial: 1, min: 1, max: 6 }) }),
        agility: new fields.SchemaField({ value: new fields.NumberField({ initial: 1, min: 1, max: 6 }) }),
        intellect: new fields.SchemaField({ value: new fields.NumberField({ initial: 1, min: 1, max: 6 }) }),
        cunning: new fields.SchemaField({ value: new fields.NumberField({ initial: 1, min: 1, max: 6 }) }),
        willpower: new fields.SchemaField({ value: new fields.NumberField({ initial: 1, min: 1, max: 6 }) }),
        presence: new fields.SchemaField({ value: new fields.NumberField({ initial: 1, min: 1, max: 6 }) })
      }),
      stats: new fields.SchemaField({
        wounds: new fields.SchemaField({
          value: new fields.NumberField({ initial: 0, min: 0 }),
          max: new fields.NumberField({ initial: 10, min: 1 }),
          base: new fields.NumberField({ initial: 10, min: 0 })
        }),
        strain: new fields.SchemaField({
          value: new fields.NumberField({ initial: 0, min: 0 }),
          max: new fields.NumberField({ initial: 10, min: 1 }),
          base: new fields.NumberField({ initial: 10, min: 0 })
        }),
        soak: new fields.SchemaField({
          value: new fields.NumberField({ initial: 0 })
        }),
        defence: new fields.SchemaField({
          melee: new fields.NumberField({ initial: 0 }),
          ranged: new fields.NumberField({ initial: 0 })
        }),
        encumbrance: new fields.SchemaField({
          value: new fields.NumberField({ initial: 0, min: 0 }),
          max: new fields.NumberField({ initial: 5, min: 0 })
        })
      })
    };
  }
}

export class CharacterData extends BaseActorData {
  static defineSchema() {
    const fields = foundry.data.fields;
    const base = super.defineSchema();
    return {
      ...base,
      biography: new fields.SchemaField({
        species: new fields.StringField({ initial: "" }),
        career: new fields.StringField({ initial: "" }),
        specialization: new fields.StringField({ initial: "" }),
        obligation: new fields.StringField({ initial: "" }),
        duty: new fields.StringField({ initial: "" }),
        morality: new fields.StringField({ initial: "" }),
        specialAbilities: new fields.HTMLField({ initial: "" })
      }),
      creation: new fields.SchemaField({
        isCreationMode: new fields.BooleanField({ initial: true }),
        startingXp: new fields.NumberField({ initial: 0, min: 0 }),
        baseGroupDutyXp: new fields.NumberField({ initial: 0, min: 0 }),
        doubleDuty: new fields.BooleanField({ initial: false }),
        baseCharacteristics: new fields.SchemaField({
          brawn: new fields.NumberField({ initial: 2, min: 1, max: 6 }),
          agility: new fields.NumberField({ initial: 2, min: 1, max: 6 }),
          intellect: new fields.NumberField({ initial: 2, min: 1, max: 6 }),
          cunning: new fields.NumberField({ initial: 2, min: 1, max: 6 }),
          willpower: new fields.NumberField({ initial: 2, min: 1, max: 6 }),
          presence: new fields.NumberField({ initial: 2, min: 1, max: 6 })
        })
      }),
      xp: new fields.SchemaField({
        total: new fields.NumberField({ initial: 0 }),
        available: new fields.NumberField({ initial: 0 }),
        earned: new fields.NumberField({ initial: 0, min: 0 }),
        log: new fields.ArrayField(new fields.ObjectField(), { initial: [] })
      })
    };
  }
}

export class NPCData extends BaseActorData {
  static defineSchema() {
    const fields = foundry.data.fields;
    const base = super.defineSchema();
    return {
      ...base,
      biography: new fields.SchemaField({
        description: new fields.HTMLField({ initial: "" })
      })
    };
  }
}

export class MinionData extends BaseActorData {
  static defineSchema() {
    const fields = foundry.data.fields;
    const base = super.defineSchema();
    return {
      ...base,
      biography: new fields.SchemaField({
        description: new fields.HTMLField({ initial: "" })
      }),
      quantity: new fields.SchemaField({
        value: new fields.NumberField({ initial: 1, min: 1 }),
        max: new fields.NumberField({ initial: 1, min: 1 })
      })
    };
  }
}

// ITEMS
export class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      damage: new fields.NumberField({ initial: 0 }),
      critical: new fields.NumberField({ initial: 0 }),
      range: new fields.StringField({ initial: "Engaged" }),
      encumbrance: new fields.NumberField({ initial: 1 }),
      hardpoints: new fields.NumberField({ initial: 0 }),
      qualities: new fields.StringField({ initial: "" }),
      skill: new fields.StringField({ initial: "Ranged-Light" }),
      key: new fields.StringField({ initial: "" }),
      equipped: new fields.BooleanField({ initial: false }),
      modifiers: new fields.SchemaField({
        wounds: new fields.NumberField({ initial: 0 }),
        strain: new fields.NumberField({ initial: 0 }),
        soak: new fields.NumberField({ initial: 0 }),
        encumbrance: new fields.NumberField({ initial: 0 }),
        characteristics: new fields.StringField({ initial: "" }),
        skills: new fields.StringField({ initial: "" })
      }),
      attachments: new fields.ArrayField(new fields.ObjectField(), { initial: [] })
    };
  }
}

export class ArmorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      soak: new fields.NumberField({ initial: 1 }),
      defence: new fields.NumberField({ initial: 0 }),
      encumbrance: new fields.NumberField({ initial: 2 }),
      hardpoints: new fields.NumberField({ initial: 0 }),
      qualities: new fields.StringField({ initial: "" }),
      equipped: new fields.BooleanField({ initial: false }),
      key: new fields.StringField({ initial: "" }),
      modifiers: new fields.SchemaField({
        wounds: new fields.NumberField({ initial: 0 }),
        strain: new fields.NumberField({ initial: 0 }),
        soak: new fields.NumberField({ initial: 0 }),
        encumbrance: new fields.NumberField({ initial: 0 }),
        characteristics: new fields.StringField({ initial: "" }),
        skills: new fields.StringField({ initial: "" })
      }),
      attachments: new fields.ArrayField(new fields.ObjectField(), { initial: [] })
    };
  }
}

export class GearData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({ initial: "" }),
      quantity: new fields.NumberField({ initial: 1 }),
      encumbrance: new fields.NumberField({ initial: 1 }),
      equipped: new fields.BooleanField({ initial: false }),
      modifiers: new fields.SchemaField({
        wounds: new fields.NumberField({ initial: 0 }),
        strain: new fields.NumberField({ initial: 0 }),
        soak: new fields.NumberField({ initial: 0 }),
        encumbrance: new fields.NumberField({ initial: 0 }),
        characteristics: new fields.StringField({ initial: "" }),
        skills: new fields.StringField({ initial: "" })
      }),
      key: new fields.StringField({ initial: "" })
    };
  }
}

export class TalentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({ initial: "" }),
      activation: new fields.StringField({ initial: "Passive" }),
      tier: new fields.NumberField({ initial: 1 }),
      ranked: new fields.BooleanField({ initial: false }),
      ranks: new fields.NumberField({ initial: 1 }),
      key: new fields.StringField({ initial: "" }),
      specialization: new fields.StringField({ initial: "" }),
      row: new fields.NumberField({ initial: null, nullable: true }),
      col: new fields.NumberField({ initial: null, nullable: true }),
      careerSkillsUnlocks: new fields.StringField({ initial: "" }),
      boostSkills: new fields.StringField({ initial: "" }),
      setbackRemoveSkills: new fields.StringField({ initial: "" }),
      boostCharacteristics: new fields.StringField({ initial: "" }),
      setbackRemoveCharacteristics: new fields.StringField({ initial: "" })
    };
  }
}
export class ForcePowerData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({ initial: "" }),
      upgrades: new fields.StringField({ initial: "" })
    };
  }
}
export class SpecializationData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({ initial: "" }),
      careerSkills: new fields.StringField({ initial: "" }),
      classification: new fields.StringField({ initial: "career", choices: ["career", "non-career", "universal", "force-power", "signature-ability"] }),
      customXpCost: new fields.NumberField({ initial: null, nullable: true, min: 0 }),
      talentRows: new fields.ArrayField(new fields.ObjectField(), { initial: [] })
    };
  }
}
export class SkillData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({ initial: "" }),
      characteristic: new fields.StringField({ initial: "brawn" }),
      category: new fields.StringField({ initial: "General" }),
      value: new fields.NumberField({ initial: 0 }),
      freeRanks: new fields.NumberField({ initial: 0, min: 0 }),
      career: new fields.BooleanField({ initial: false })
    };
  }
}

export class SpeciesData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({ initial: "" }),
      characteristics: new fields.SchemaField({
        brawn: new fields.SchemaField({ value: new fields.NumberField({ initial: 2, min: 1, max: 6 }) }),
        agility: new fields.SchemaField({ value: new fields.NumberField({ initial: 2, min: 1, max: 6 }) }),
        intellect: new fields.SchemaField({ value: new fields.NumberField({ initial: 2, min: 1, max: 6 }) }),
        cunning: new fields.SchemaField({ value: new fields.NumberField({ initial: 2, min: 1, max: 6 }) }),
        willpower: new fields.SchemaField({ value: new fields.NumberField({ initial: 2, min: 1, max: 6 }) }),
        presence: new fields.SchemaField({ value: new fields.NumberField({ initial: 2, min: 1, max: 6 }) })
      }),
      wounds: new fields.SchemaField({
        base: new fields.NumberField({ initial: 10, min: 1 })
      }),
      strain: new fields.SchemaField({
        base: new fields.NumberField({ initial: 10, min: 1 })
      }),
      xp: new fields.NumberField({ initial: 100 }),
      key: new fields.StringField({ initial: "" }),
      modifiers: new fields.SchemaField({
        wounds: new fields.NumberField({ initial: 0 }),
        strain: new fields.NumberField({ initial: 0 }),
        soak: new fields.NumberField({ initial: 0 }),
        encumbrance: new fields.NumberField({ initial: 0 }),
        characteristics: new fields.StringField({ initial: "" }),
        skills: new fields.StringField({ initial: "" })
      }),
      specialAbilities: new fields.HTMLField({ initial: "" })
    };
  }
}

export class CareerData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({ initial: "" }),
      careerSkills: new fields.StringField({ initial: "" }),
      key: new fields.StringField({ initial: "" })
    };
  }
}

export class AttachmentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({ initial: "" }),
      hardpoints: new fields.NumberField({ initial: 1, min: 0 }),
      baseModifiers: new fields.SchemaField({
        wounds: new fields.NumberField({ initial: 0 }),
        strain: new fields.NumberField({ initial: 0 }),
        soak: new fields.NumberField({ initial: 0 }),
        encumbrance: new fields.NumberField({ initial: 0 }),
        characteristics: new fields.StringField({ initial: "" }),
        skills: new fields.StringField({ initial: "" }),
        qualities: new fields.StringField({ initial: "" }),
        damage: new fields.NumberField({ initial: 0 }),
        critical: new fields.NumberField({ initial: 0 })
      }),
      mods: new fields.ArrayField(new fields.ObjectField(), { initial: [] }),
      key: new fields.StringField({ initial: "" })
    };
  }
}
