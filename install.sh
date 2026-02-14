#!/usr/bin/env bash
set -euo pipefail

# Clavion installer — https://clavion.xyz
# Usage: curl -fsSL https://clavion.xyz/install.sh | bash

REPO="https://github.com/clavion-xyz/clavion.git"
INSTALL_DIR="${CLAVION_DIR:-$HOME/.clavion}"
MIN_NODE=20

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

info()  { printf "${CYAN}▸${RESET} %s\n" "$1"; }
ok()    { printf "${GREEN}✓${RESET} %s\n" "$1"; }
fail()  { printf "${RED}✗${RESET} %s\n" "$1" >&2; exit 1; }

# ── Banner ──
printf "\n${GREEN}${BOLD}  ⟩⟩ Clavion${RESET}${DIM} — secure crypto runtime for autonomous agents${RESET}\n\n"

# ── Check prerequisites ──
command -v git >/dev/null 2>&1 || fail "git is required but not installed."

if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -lt "$MIN_NODE" ]; then
    fail "Node.js >= $MIN_NODE required (found v$(node -v | sed 's/v//')). Install from https://nodejs.org"
  fi
  ok "Node.js $(node -v)"
else
  fail "Node.js >= $MIN_NODE is required. Install from https://nodejs.org"
fi

command -v npm >/dev/null 2>&1 || fail "npm is required but not installed."
ok "npm $(npm -v)"

# ── Clone or update ──
if [ -d "$INSTALL_DIR" ]; then
  info "Updating existing installation at $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only || fail "Failed to update. Resolve conflicts or remove $INSTALL_DIR and retry."
else
  info "Cloning clavion to $INSTALL_DIR"
  git clone --depth 1 "$REPO" "$INSTALL_DIR" || fail "Failed to clone repository."
fi

ok "Source at $INSTALL_DIR"

# ── Install & build ──
cd "$INSTALL_DIR"

info "Installing dependencies..."
npm ci --ignore-scripts 2>&1 | tail -1
ok "Dependencies installed"

info "Building packages..."
npm run build 2>&1 | tail -1
ok "Build complete"

# ── Summary ──
printf "\n${GREEN}${BOLD}  ✓ Clavion installed successfully!${RESET}\n\n"
printf "  ${DIM}Location:${RESET}  %s\n" "$INSTALL_DIR"
printf "  ${DIM}Version:${RESET}   %s\n\n" "$(node -e "console.log(require('./package.json').version)")"

printf "  ${BOLD}Next steps:${RESET}\n\n"
printf "    ${CYAN}1.${RESET} Generate a wallet key:\n"
printf "       ${DIM}cd %s && npx clavion-cli key generate${RESET}\n\n" "$INSTALL_DIR"
printf "    ${CYAN}2.${RESET} Start the server:\n"
printf "       ${DIM}ISCL_RPC_URL=<your-rpc-url> npx clavion-core${RESET}\n\n"
printf "    ${CYAN}3.${RESET} Read the docs:\n"
printf "       ${DIM}https://docs.clavion.xyz${RESET}\n\n"
