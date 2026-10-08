/**
 * Shared helper: connects to the debug browser (remote debugging port) and finds the Foundry game tab.
 * See tools/dev/README.md for how to start the debug browser.
 */
const puppeteer = require("puppeteer-core");

const BROWSER_URL = process.env.SWFFG_DEBUG_URL || "http://127.0.0.1:9222";

async function connect() {
  try {
    return await puppeteer.connect({ browserURL: BROWSER_URL, defaultViewport: null });
  } catch (e) {
    throw new Error(`No debug browser at ${BROWSER_URL} — start it as described in tools/dev/README.md (${e.message})`);
  }
}

async function findGamePage(browser) {
  const page = (await browser.pages()).find((p) => /\/game(\?|$)/.test(p.url()));
  if (!page) throw new Error("No Foundry /game tab found — log into the world in the debug browser first.");
  return page;
}

module.exports = { connect, findGamePage };
