/**
 * Star Wars FFG Narrative Dice Engine and Cancellation Logic
 */

// Define face results for all dice
export const DICE_FACES = {
  ability: [
    {}, // Blank
    { success: 1 },
    { success: 1 },
    { success: 2 },
    { advantage: 1 },
    { advantage: 1 },
    { success: 1, advantage: 1 },
    { advantage: 2 }
  ],
  proficiency: [
    {}, // Blank
    { success: 1 },
    { success: 1 },
    { success: 2 },
    { success: 2 },
    { advantage: 1 },
    { success: 1, advantage: 1 },
    { success: 1, advantage: 1 },
    { success: 1, advantage: 1 },
    { advantage: 2 },
    { advantage: 2 },
    { success: 1, triumph: 1 } // Triumph acts as a success too
  ],
  boost: [
    {}, // Blank
    {}, // Blank
    { success: 1 },
    { success: 1, advantage: 1 },
    { advantage: 2 },
    { advantage: 1 }
  ],
  difficulty: [
    {}, // Blank
    { failure: 1 },
    { failure: 2 },
    { threat: 1 },
    { threat: 1 },
    { threat: 1 },
    { threat: 2 },
    { failure: 1, threat: 1 }
  ],
  challenge: [
    {}, // Blank
    { failure: 1 },
    { failure: 1 },
    { failure: 2 },
    { failure: 2 },
    { threat: 1 },
    { threat: 1 },
    { failure: 1, threat: 1 },
    { failure: 1, threat: 1 },
    { threat: 2 },
    { threat: 2 },
    { failure: 1, despair: 1 } // Despair acts as a failure too
  ],
  setback: [
    {}, // Blank
    {}, // Blank
    { failure: 1 },
    { failure: 1 },
    { threat: 1 },
    { threat: 1 }
  ],
  force: [
    { dark: 1 },
    { dark: 1 },
    { dark: 1 },
    { dark: 1 },
    { dark: 1 },
    { dark: 1 },
    { dark: 2 },
    { light: 1 },
    { light: 1 },
    { light: 2 },
    { light: 2 },
    { light: 2 }
  ]
};

/**
 * Executes a roll of a specified pool of dice and calculates net results.
 * @param {Object} pool - E.g. { ability: 2, difficulty: 1, boost: 1 }
 */
export function rollFFGPool(pool) {
  const rolledDice = [];
  const rawTotals = {
    success: 0,
    failure: 0,
    advantage: 0,
    threat: 0,
    triumph: 0,
    despair: 0,
    light: 0,
    dark: 0
  };

  for (const [dieType, count] of Object.entries(pool)) {
    if (!DICE_FACES[dieType] || count <= 0) continue;

    for (let i = 0; i < count; i++) {
      const faces = DICE_FACES[dieType];
      const rollIndex = Math.floor(Math.random() * faces.length);
      const faceResult = faces[rollIndex];

      rolledDice.push({
        type: dieType,
        index: rollIndex,
        result: faceResult
      });

      // Accumulate raw totals
      for (const [key, val] of Object.entries(faceResult)) {
        rawTotals[key] += val;
      }
    }
  }

  // Calculate Net Results
  const totalSuccess = rawTotals.success + rawTotals.triumph;
  const totalFailure = rawTotals.failure + rawTotals.despair;
  const netSuccess = totalSuccess - totalFailure;

  const netAdvantage = rawTotals.advantage - rawTotals.threat;

  const results = {
    success: netSuccess > 0 ? netSuccess : 0,
    failure: netSuccess < 0 ? Math.abs(netSuccess) : 0,
    advantage: netAdvantage > 0 ? netAdvantage : 0,
    threat: netAdvantage < 0 ? Math.abs(netAdvantage) : 0,
    triumph: rawTotals.triumph,
    despair: rawTotals.despair,
    light: rawTotals.light,
    dark: rawTotals.dark,
    isSuccess: netSuccess > 0
  };

  return {
    pool,
    rolls: rolledDice,
    raw: rawTotals,
    results
  };
}

/**
 * Helper to display the rolled chat message in Foundry VTT
 */
export async function sendRollToChat(actor, rollResult, title = "Skill Check") {
  const templatePath = "systems/starwars-ffg-scratch/templates/chat/roll-card.html";
  
  const templateData = {
    actor: actor,
    title: title,
    pool: rollResult.pool,
    rolls: rollResult.rolls,
    results: rollResult.results
  };

  const html = await foundry.applications.handlebars.renderTemplate(templatePath, templateData);

  const chatData = {
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER
  };

  return ChatMessage.create(chatData);
}
