#!/bin/sh
# svelte-utils installer — https://github.com/davis7dotsh/svelte-utils
# (not affiliated with the Svelte team)
set -eu

REPO="davis7dotsh/svelte-utils"
BIN_DIR="${SVELTE_UTILS_BIN_DIR:-$HOME/.local/bin}"
TARGET="$BIN_DIR/svelte-utils"

if ! command -v node >/dev/null 2>&1; then
	echo "error: svelte-utils requires Node.js 20+ (node not found on PATH)" >&2
	exit 1
fi

URL="https://github.com/$REPO/releases/latest/download/svelte-utils.js"

echo "Downloading $URL"
mkdir -p "$BIN_DIR"
if command -v curl >/dev/null 2>&1; then
	curl -fsSL "$URL" -o "$TARGET"
else
	wget -qO "$TARGET" "$URL"
fi
chmod +x "$TARGET"

echo "Installed to $TARGET"
"$TARGET" --version

case ":$PATH:" in
	*":$BIN_DIR:"*) ;;
	*)
		echo ""
		echo "note: $BIN_DIR is not on your PATH. Add this to your shell profile:"
		echo "  export PATH=\"$BIN_DIR:\$PATH\""
		;;
esac

echo ""
echo "Next steps:"
echo "  svelte-utils config set host http://<your-core-machine>:5175"
echo "  svelte-utils open Component.svelte"
