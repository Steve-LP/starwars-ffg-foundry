# Developer tools: testing against a live Foundry

Scripts to run headless tests inside a running Foundry world and read its browser console,
without opening any UI by hand. They drive a separate browser profile via its remote debugging
port (`puppeteer-core`, already a project dependency).

## 1. Start Foundry and the debug browser

```bash
# Foundry server (local install, data path with the system symlinked into Data/systems)
node /home/steve/FoundryVTT/app/main.js --dataPath=/home/steve/FoundryVTT/data

# Separate Brave profile with remote debugging (normal profile/logins stay untouched)
brave-browser --remote-debugging-port=9222 --user-data-dir=$HOME/.brave-foundry-debug http://localhost:30000 &
```

Log into the world **as Gamemaster** in that window. While it is open, any local program can
control it via port 9222 — close it when done. Override the address with `SWFFG_DEBUG_URL`.

## 2. Tools

| Command | Purpose |
|---|---|
| `node tools/dev/foundry-reload.cjs` | Reload the game tab (F5) and wait until `game.ready` — after code changes |
| `node tools/dev/foundry-eval.cjs tests/headless-<name>.js [...]` | Run headless tests in the game tab; prints `[PASS]/[FAIL]` and the returned `{ passed, failed }` |
| `node tools/dev/foundry-eval.cjs --code 'return game.version'` | Run a snippet (body of an async function) |
| `node tools/dev/foundry-console-log.cjs /tmp/foundry-console.log &` | Stream the browser console into a file while testing manually |

`foundry-eval.cjs` exits with code 1 if a run throws or reports failures.

## 3. Tests

**Node unit tests** (no Foundry needed):

```bash
for t in tests/unit-*.js; do node "$t" | grep TOTAL; done
```

`tests/unit-pack-embedded.js` opens the LevelDB packs directly — **Foundry must be stopped**
(the server locks the pack directories).

**In-game headless tests** (Foundry + debug browser running, logged in as GM). Current, self-cleaning
tests that return `{ passed, failed }`:

```bash
node tools/dev/foundry-reload.cjs
node tools/dev/foundry-eval.cjs \
  tests/headless-specialization-keys.js \
  tests/headless-xp-log-summary.js \
  tests/headless-species-skill-choice.js \
  tests/headless-species-skill-ranks.js \
  tests/headless-additional-spec-talents.js
```

Older `tests/headless-*.js` scripts were written as console macros for manual runs; check them
before running (some expect specific world state).

## 4. Compendium packs

- Source of truth for repacked packs are the NDJSON files `packs/<name>.db`; rebuild with
  `node tools/repack-from-ndjson.mjs <name>` — **only with Foundry stopped**.
- Before repacking, make sure the `.db` file is not older than the LevelDB pack (edits made in Foundry
  only exist in LevelDB).
- A running Foundry rewrites `packs/*/CURRENT|LOG|MANIFEST-*` on start. Commit that churn only
  while Foundry is stopped.

## 5. Release

```bash
# bump "version" and the "download" URL (releases/download/vX.Y.Z/system.zip) in system.json,
# add a CHANGELOG entry, commit, then:
git tag -a vX.Y.Z -m "vX.Y.Z - <title>"
tools/build-release.sh vX.Y.Z          # runtime files only, from the tag
git push origin main vX.Y.Z
gh release create vX.Y.Z dist/system.zip dist/system.json --title "vX.Y.Z - Star Wars FFG Foundry V14" --notes "..."
```

Never use Foundry's "Update" button for this system locally — the system folder is a symlink to this
working copy.
