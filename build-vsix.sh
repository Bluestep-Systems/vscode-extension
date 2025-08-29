#!/bin/bash
set -e
cd $(dirname ${0})

# Initialize flags
RELEASE_MODE=false
GIT_MODE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -r|--release)
      RELEASE_MODE=true
      shift # past argument
      ;;
    -g|--git)
      GIT_MODE=true
      shift # past argument
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -r, --release    Increment version and install dependencies for release"
      echo "  -g, --git        Perform git operations (commit, tag, push)"
      echo "  -h, --help       Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use -h or --help for usage information"
      exit 1
      ;;
  esac
done

# Release mode: increment version
if [[ "$RELEASE_MODE" == true ]]; then
  echo "🚀 Release mode: Incrementing version and installing dependencies"
  node updateversion.js
  npm install #the install is mostly just to update package-lock.json
fi

# Git mode: perform git operations
if [[ "$GIT_MODE" == true ]]; then
  echo "📝 Git mode: Performing git operations"
  
  # Get the current version from package.json
  VERSION=$(node -p "require('./package.json').version")
  TAG="$(../gittag)"
  # Add all changes
  git add .
  
  # Commit with version tag
  git commit -m "Release v${VERSION}" || echo "No changes to commit"

  # Create and push tag
  git tag -a "v${VERSION}" -m "Version ${VERSION}" || echo "Tag v${VERSION} already exists"
  git push origin ${TAG}
  git push origin "v${VERSION}" || echo "Tag already pushed"
fi

npm run package-extension

#this can probably be done inside the package-extension.js directly instead of us doing it here
mv bsjs-push-pull-*.vsix ./packages/

echo ""
echo ""
echo "==============================="
echo ""
echo "Build complete!"
if [[ "$RELEASE_MODE" == true ]]; then
  echo "✅ Version updated and dependencies installed"
fi
if [[ "$GIT_MODE" == true ]]; then
  echo "✅ Git operations completed"
fi
echo ""
echo "==============================="
echo ""
echo ""
echo "YOU MAY NEED TO RELOAD EDITOR SINCE THE NPM TASK MESSES WITH DEVELOPER INSTALLS"
echo ""
echo ""