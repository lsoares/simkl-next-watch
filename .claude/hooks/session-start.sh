#!/bin/bash
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

npm install --silent --no-audit --no-fund

# Web-only Playwright fix: Claude Code on the web ships /opt/pw-browsers with a
# pre-installed Chromium headless shell, but the revision may not match what
# the project's Playwright version expects, and the download fails offline.
# Symlink the installed binary into the directory Playwright probes.
if [[ "${CLAUDE_CODE_REMOTE:-}" != "true" ]]; then exit 0; fi
if [[ ! -f node_modules/playwright-core/browsers.json ]]; then exit 0; fi

EXPECTED_REV=$(node -e "
  const b = JSON.parse(require('fs').readFileSync('node_modules/playwright-core/browsers.json'));
  const e = b.browsers.find(x => x.name === 'chromium-headless-shell');
  if (e) process.stdout.write(e.revision);
")
[[ -z "$EXPECTED_REV" ]] && exit 0

EXPECTED_ROOT="/opt/pw-browsers/chromium_headless_shell-${EXPECTED_REV}"
EXPECTED_DIR="${EXPECTED_ROOT}/chrome-headless-shell-linux64"
EXPECTED_BIN="${EXPECTED_DIR}/chrome-headless-shell"

if [[ -x "$EXPECTED_BIN" ]]; then exit 0; fi

AVAILABLE=$(ls -d /opt/pw-browsers/chromium_headless_shell-*/chrome-linux 2>/dev/null | head -n 1 || true)
if [[ -z "$AVAILABLE" ]] || [[ ! -x "$AVAILABLE/headless_shell" ]]; then
  echo "session-start.sh: no installed Chromium headless shell found under /opt/pw-browsers" >&2
  exit 0
fi

mkdir -p "$EXPECTED_DIR"
for f in "$AVAILABLE"/*; do
  ln -sf "$f" "$EXPECTED_DIR/$(basename "$f")"
done
ln -sf "$AVAILABLE/headless_shell" "$EXPECTED_BIN"
touch "$EXPECTED_ROOT/INSTALLATION_COMPLETE" "$EXPECTED_ROOT/DEPENDENCIES_VALIDATED"
