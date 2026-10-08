/**
 * Runs JavaScript files inside the Foundry game tab of the debug browser and prints the result.
 *
 *   node tools/dev/foundry-eval.cjs tests/headless-xp-log-summary.js [more files...]
 *   node tools/dev/foundry-eval.cjs --code 'return game.version'
 *
 * A file containing a self-invoking test "(async function test() { ... })();" is awaited and its
 * return value printed; otherwise the file is run as the body of an async function (use `return`).
 * Console output of the page during each run (SWFFG lines, [PASS]/[FAIL], errors) is shown as well.
 * Exit code 1 if a run throws or a returned { failed } is > 0.
 */
const fs = require("fs");
const { connect, findGamePage } = require("./foundry-connect.cjs");

function toFunctionBody(source) {
  const withoutHeader = source.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, "");
  return /^\(async\s+(function|\()/.test(withoutHeader) ? `return await ${withoutHeader.trim().replace(/;\s*$/, "")}` : source;
}

(async () => {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error("Usage: node tools/dev/foundry-eval.cjs <file.js> [...] | --code '<js>'");
    process.exit(2);
  }
  const jobs = args[0] === "--code" ? [{ name: "--code", body: args.slice(1).join(" ") }]
    : args.map((file) => ({ name: file, body: toFunctionBody(fs.readFileSync(file, "utf8")) }));

  const browser = await connect();
  const page = await findGamePage(browser);
  let failedRuns = 0;

  for (const job of jobs) {
    const lines = [];
    const onConsole = (m) => {
      const text = m.text();
      if (m.type() === "error" || m.type() === "warn" || /SWFFG|\[PASS\]|\[FAIL\]/.test(text)) lines.push(`[${m.type()}] ${text}`);
    };
    const onError = (e) => lines.push(`[pageerror] ${e.message}`);
    page.on("console", onConsole);
    page.on("pageerror", onError);

    console.log(`\n=== ${job.name}`);
    try {
      const result = await page.evaluate(`(async () => { ${job.body} })()`);
      await new Promise((r) => setTimeout(r, 200));
      lines.forEach((l) => console.log(l));
      if (result !== undefined) console.log("RESULT:", JSON.stringify(result, null, 2));
      if (result && typeof result === "object" && Number(result.failed) > 0) failedRuns++;
    } catch (e) {
      lines.forEach((l) => console.log(l));
      console.error(`SWFFG | [DevTools] ${job.name} threw: ${e.message}`);
      failedRuns++;
    } finally {
      page.off("console", onConsole);
      page.off("pageerror", onError);
    }
  }

  browser.disconnect();
  if (jobs.length > 1) console.log(`\nSWFFG | [DevTools] ${jobs.length} runs, ${failedRuns} with failures`);
  process.exitCode = failedRuns ? 1 : 0;
})().catch((e) => { console.error(`SWFFG | [DevTools] ${e.message}`); process.exit(1); });
