#!/usr/bin/env bash
# Build the Foundry release package from a git tag (committed state only, never the working tree).
#
#   tools/build-release.sh v0.2.0
#
# Output: dist/system.zip + dist/system.json — upload both as assets of the GitHub release:
#   gh release create v0.2.0 dist/system.zip dist/system.json --title "..." --notes "..."
set -euo pipefail

TAG="${1:?usage: tools/build-release.sh <tag>}"
ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
cd "$ROOT"

git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || { echo "SWFFG | [Release] tag $TAG not found" >&2; exit 1; }

VERSION="$(git show "$TAG:system.json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["version"])')"
[ "v$VERSION" = "$TAG" ] || { echo "SWFFG | [Release] system.json version $VERSION does not match tag $TAG" >&2; exit 1; }

# Runtime files only: everything Foundry loads (manifest, code, templates, styles, fonts, pack images, packs)
RUNTIME_PATHS=(system.json module templates css fonts assets packs CHANGELOG.md)

mkdir -p dist
rm -f dist/system.zip dist/system.json
git archive --format=zip -o dist/system.zip "$TAG" -- "${RUNTIME_PATHS[@]}"
git show "$TAG:system.json" > dist/system.json

echo "SWFFG | [Release] built dist/system.zip ($(du -h dist/system.zip | cut -f1)) and dist/system.json for $TAG"
