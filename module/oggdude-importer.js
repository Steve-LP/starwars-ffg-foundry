/**
 * Oggdude XML Dataset parser for Star Wars FFG
 */

/**
 * Parses an Oggdude talent XML definition
 * @param {string} xmlString - The talent XML file contents
 * @returns {Array<Object>} Array of parsed talent structures ready for Foundry item creation
 */
export function parseOggdudeTalents(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  const talents = xmlDoc.getElementsByTagName("Talent");
  const items = [];

  for (let i = 0; i < talents.length; i++) {
    const talentNode = talents[i];
    const key = talentNode.getElementsByTagName("Key")[0]?.textContent || "";
    const name = talentNode.getElementsByTagName("Name")[0]?.textContent || "Unnamed Talent";
    const description = talentNode.getElementsByTagName("Description")[0]?.textContent || "";
    
    // Check if ranked
    const rankedNode = talentNode.getElementsByTagName("Ranked")[0];
    const isRanked = rankedNode ? (rankedNode.textContent.toLowerCase() === "true") : false;

    // Check activation
    const activationNode = talentNode.getElementsByTagName("ActivationValue")[0];
    const activation = activationNode ? activationNode.textContent : "Passive";

    items.push({
      name: name,
      type: "talent",
      system: {
        description: description,
        activation: activation,
        tier: 1,
        ranked: isRanked,
        key: key
      }
    });
  }

  return items;
}

/**
 * Parses Oggdude Weapon XML definitions
 */
export function parseOggdudeWeapons(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  const weapons = xmlDoc.getElementsByTagName("Weapon");
  const items = [];

  for (let i = 0; i < weapons.length; i++) {
    const weaponNode = weapons[i];
    const key = weaponNode.getElementsByTagName("Key")[0]?.textContent || "";
    const name = weaponNode.getElementsByTagName("Name")[0]?.textContent || "Unnamed Weapon";
    const damage = parseInt(weaponNode.getElementsByTagName("Damage")[0]?.textContent || "0");
    const crit = parseInt(weaponNode.getElementsByTagName("Crit")[0]?.textContent || "0");
    const range = weaponNode.getElementsByTagName("Range")[0]?.textContent || "Engaged";
    const encumbrance = parseInt(weaponNode.getElementsByTagName("Encumbrance")[0]?.textContent || "1");
    const qualities = weaponNode.getElementsByTagName("Qualities")[0]?.textContent || "";

    items.push({
      name: name,
      type: "weapon",
      system: {
        damage: damage,
        critical: crit,
        range: range,
        encumbrance: encumbrance,
        qualities: qualities,
        key: key
      }
    });
  }

  return items;
}

/**
 * Exposing a general dispatcher
 */
export function oggdudeParser(xmlString, type) {
  if (type === "talent") {
    return parseOggdudeTalents(xmlString);
  } else if (type === "weapon") {
    return parseOggdudeWeapons(xmlString);
  }
  return [];
}
