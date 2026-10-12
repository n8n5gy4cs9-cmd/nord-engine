#!/usr/bin/env bash
# Run the Nord Engine editor from source (macOS recommended; Linux builds without the embedded webview).
#
#   ./run.sh                    # editor, project hub
#   ./run.sh path/to/project    # open a project directly
#   ./run.sh examples/conformance-2d
#   ./run.sh --release          # optimized build
#   ./run.sh --no-webview       # skip the wry embedded webview (viewport opens in your browser instead)
#
# Needs: Rust (https://rustup.rs). Node 18+ is optional (JS syntax checking in the code editor + dev tooling).
set -euo pipefail
ORIG_PWD="$PWD"
cd "$(dirname "$0")"

PROFILE=()
FEATURES=()
ARGS=()
WEBVIEW=1
for a in "$@"; do
  case "$a" in
    --release) PROFILE=(--release) ;;
    --no-webview) WEBVIEW=0 ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) ARGS+=("$a") ;;
  esac
done

if ! command -v cargo >/dev/null; then
  echo "cargo not found. Install Rust first:  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh" >&2
  exit 1
fi
command -v node >/dev/null || echo "note: node not found - JS syntax checking in the code editor is disabled" >&2

# The webview (WKWebView child view) is the macOS viewport; on other systems it is not wired up.
if [ "$(uname -s)" = "Darwin" ] && [ "$WEBVIEW" = 1 ]; then FEATURES=(--features webview); fi

# The editor finds vendor/, runtime/ and editor/ (viewport JS) here.
export NORD_ROOT="$PWD"

# A project path is taken relative to where you launched ./run.sh from.
if [ "${#ARGS[@]}" -gt 0 ]; then
  if [ -d "$ORIG_PWD/${ARGS[0]}" ]; then ARGS[0]="$(cd "$ORIG_PWD/${ARGS[0]}" && pwd)"; fi
fi

# (${arr[@]+"${arr[@]}"} keeps empty arrays working under `set -u` on macOS's bash 3.2)
echo "==> cargo run ${PROFILE[*]:-} ${FEATURES[*]:-}"
exec cargo run ${PROFILE[@]+"${PROFILE[@]}"} -p nord-editor ${FEATURES[@]+"${FEATURES[@]}"} -- ${ARGS[@]+"${ARGS[@]}"}
