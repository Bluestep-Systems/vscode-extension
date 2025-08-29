#!/bin/bash
set -e
cd $(dirname ${0})

node updateversion.js
npm install
npm run package-extension
mv bsjs-push-pull-*.vsix ./packages/
echo ""
echo ""
echo "==============================="
echo ""
echo "Build complete!"
echo "TODO. AUTO PUSH UPDATE TO BLUEHQ"
echo ""
echo "==============================="
echo ""
echo ""
echo "YOU MAY NEED TO RELOAD EDITOR SINCE THE NPM TASK MESSES WITH DEVELOPER INSTALLS"
echo ""
echo ""