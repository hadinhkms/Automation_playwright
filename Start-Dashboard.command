#!/bin/zsh
# Double-click to start the Dashboard server
cd "$(dirname "$0")" || exit 1
[ -f ~/.zshrc ] && source ~/.zshrc >/dev/null 2>&1
[ -d node_modules ] || npm install
npm run dashboard:start
echo; echo "Server stopped. Press any key to close."; read -k 1
