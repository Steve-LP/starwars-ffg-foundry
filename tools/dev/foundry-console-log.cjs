/**
 * Streams the browser console of the Foundry tab (incl. page errors and reloads) into a log file
 * until the debug browser closes. Run it in the background while testing manually.
 *
 *   node tools/dev/foundry-console-log.cjs /tmp/foundry-console.log
 */
const fs = require("fs");
const { connect } = require("./foundry-connect.cjs");

const out = process.argv[2];
if (!out) {
  console.error("Usage: node tools/dev/foundry-console-log.cjs <log-file>");
  process.exit(2);
}
const log = (s) => fs.appendFileSync(out, `${new Date().toISOString().slice(11, 23)} ${s}\n`);

(async () => {
  const browser = await connect();
  const attached = new WeakSet();
  const attach = (page) => {
    if (attached.has(page) || !/:\d+\//.test(page.url())) return;
    attached.add(page);
    page.on("console", (m) => {
      const loc = m.location();
      log(`[${m.type()}] ${m.text()}${loc?.url ? `  (${loc.url.split("/").slice(-2).join("/")}:${loc.lineNumber})` : ""}`);
    });
    page.on("pageerror", (e) => log(`[pageerror] ${e.stack || e.message}`));
    page.on("load", () => log(`[load] ${page.url()}`));
    log(`[attached] ${page.url()}`);
  };
  for (const page of await browser.pages()) attach(page);
  browser.on("targetcreated", async (t) => { const p = await t.page(); if (p) attach(p); });
  browser.on("disconnected", () => { log("[disconnected]"); process.exit(0); });
  console.log(`SWFFG | [DevTools] logging browser console to ${out} (stops when the debug browser closes)`);
})().catch((e) => { console.error(`SWFFG | [DevTools] ${e.message}`); process.exit(1); });
