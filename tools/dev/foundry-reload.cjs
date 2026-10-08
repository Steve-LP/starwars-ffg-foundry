/**
 * Reloads the Foundry game tab in the debug browser (like F5) and waits until the game is ready,
 * so changed system code is active before running tests.
 *
 *   node tools/dev/foundry-reload.cjs
 */
const { connect, findGamePage } = require("./foundry-connect.cjs");

(async () => {
  const browser = await connect();
  const page = await findGamePage(browser);
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => globalThis.game?.ready === true, { timeout: 90000 });
  const version = await page.evaluate(() => `${game.system.id} ${game.system.version} on Foundry ${game.version}`);
  console.log(`SWFFG | [DevTools] reloaded, game ready (${version})`);
  browser.disconnect();
})().catch((e) => { console.error(`SWFFG | [DevTools] ${e.message}`); process.exit(1); });
