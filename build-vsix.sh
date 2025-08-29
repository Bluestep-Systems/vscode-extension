#!/bin/bash
set -e
cd $(dirname ${0})

# Initialize flags
RELEASE_MODE=false
GIT_MODE=false
CLEAN=false
KEEP_COUNT=5

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
    -k|--clean)
      CLEAN=true
      # Check if next argument is a number
      if [[ $# -gt 1 && $2 =~ ^[0-9]+$ ]]; then
        KEEP_COUNT=$2
        shift # past the number
      fi
      shift # past argument
      ;;
    -k*)
      # Handle -k5 format (number directly attached)
      CLEAN=true
      KEEP_COUNT="${1#-k}"
      if [[ ! "$KEEP_COUNT" =~ ^[0-9]+$ ]]; then
        echo "Error: Invalid number format for -k option: $KEEP_COUNT"
        exit 1
      fi
      shift # past argument
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -r, --release         Increment version and install dependencies for release"
      echo "  -g, --git             Perform git operations (commit, tag, push)"
      echo "  -k[N], -k [N], --clean [N]"
      echo "                        Keep only the N most recent versions (default: 1)"
      echo "                        Examples: -k (keep 1), -k3 (keep 3), --clean 5"
      echo "  -h, --help            Show this help message"
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

# Get the current version from package.json
VERSION=$(node -p "require('./package.json').version")

npm run package-extension

#this can probably be done inside the package-extension.js directly instead of us doing it here
mv bsjs-push-pull-*.vsix ./packages/


# Git mode: perform git operations
if [[ "$GIT_MODE" == true ]]; then
  echo "📝 Git mode: Performing git operations"
  
  TAG="$(./gittag.sh)"
  # Add all git changes
  git add .
  
  # Commit with version tag
  git commit -m "Release v${VERSION}" || echo "No changes to commit"

  # Create and push tag
  git tag -a "v${VERSION}" -m "Version ${VERSION}" || echo "Tag v${VERSION} already exists"
  git push origin ${TAG}
  git push origin "v${VERSION}" || echo "Tag already pushed"
fi

if [[ "$CLEAN" == true ]]; then
  echo "🧹 Clean mode: Keeping ${KEEP_COUNT} most recent version(s)"
  
  # Get all VSIX files, sort by modification time (newest first), keep only the specified count
  VSIX_FILES=($(find ./packages -name "*.vsix" -printf '%T@ %p\n' 2>/dev/null | sort -nr | cut -d' ' -f2-))
  
  if [[ ${#VSIX_FILES[@]} -gt $KEEP_COUNT ]]; then
    # Remove files beyond the keep count
    for ((i=$KEEP_COUNT; i<${#VSIX_FILES[@]}; i++)); do
      echo "Removing: $(basename "${VSIX_FILES[i]}")"
      rm -f "${VSIX_FILES[i]}"
    done
    echo "Kept ${KEEP_COUNT} most recent version(s)"
  else
    echo "Found ${#VSIX_FILES[@]} file(s), no cleanup needed"
  fi
fi

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