#!/bin/bash
set -e
cd $(dirname ${0})
npm update
npm install
node updateversion.js
npm update
npm run package-extension
mv bsjs-push-pull-*.vsix ./packages/
echo "==============================="
echo ""
echo "Build complete!"
echo "TODO. AUTO PUSH UPDATE TO BLUEHQ"
echo ""
echo "RELOAD EDITOR SINCE IT THE BUILD SCRIPT MESSES WITH DEVELOPER INSTALLS"
