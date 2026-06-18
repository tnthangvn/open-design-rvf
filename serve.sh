#!/bin/bash

# Re-exec with bash if invoked via sh/dash
if [ -z "$BASH_VERSION" ]; then
  exec bash "$0" "$@"
fi

# Source NVM to restore node/npm PATH
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh" --no-use

# Add npm global bin + /usr/local/bin
NPM_PREFIX=$(npm config get prefix 2>/dev/null)
[ -n "$NPM_PREFIX" ] && export PATH="$NPM_PREFIX/bin:$PATH"
export PATH="/usr/local/bin:$PATH"

PORT=${1:-3000}
TUNNEL=${2:-""}

if command -v serve &>/dev/null; then
  echo "[skip] serve already installed: $(command -v serve)"
else
  echo "[install] Installing serve globally..."
  npm i -g serve
fi

if [ -n "$TUNNEL" ]; then
  if command -v cloudflared &>/dev/null; then
    echo "[skip] cloudflared already installed: $(command -v cloudflared)"
  else
    echo "[install] Installing cloudflared..."
    ARCH=$(uname -m)
    if [ "$ARCH" = "x86_64" ]; then
      BIN="cloudflared-linux-amd64"
    elif [ "$ARCH" = "aarch64" ]; then
      BIN="cloudflared-linux-arm64"
    else
      echo "[error] Unsupported arch: $ARCH"
      exit 1
    fi

    # Try /usr/local/bin first, fall back to ~/.local/bin
    if [ -w "/usr/local/bin" ]; then
      INSTALL_DIR="/usr/local/bin"
    else
      INSTALL_DIR="$HOME/.local/bin"
      mkdir -p "$INSTALL_DIR"
      export PATH="$INSTALL_DIR:$PATH"
    fi

    echo "[install] Downloading cloudflared to $INSTALL_DIR..."
    if curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/$BIN" -o "$INSTALL_DIR/cloudflared"; then
      chmod +x "$INSTALL_DIR/cloudflared"
      echo "[install] cloudflared installed at $INSTALL_DIR/cloudflared"
    else
      echo "[error] Download failed. Get it manually: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/"
      exit 1
    fi
  fi
fi

echo "[start] Serving on port $PORT..."
serve -p "$PORT" . &

if [ -n "$TUNNEL" ]; then
  echo "[tunnel] Opening Cloudflare quick tunnel on port $PORT..."
  cloudflared tunnel --url "http://localhost:$PORT"
else
  wait
fi
