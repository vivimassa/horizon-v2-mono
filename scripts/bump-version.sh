#!/bin/bash
# Usage: ./scripts/bump-version.sh patch|minor|major

set -e

TYPE=${1:-patch}

CURRENT=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT"

IFS='.' read -ra PARTS <<< "$CURRENT"
MAJOR=${PARTS[0]}
MINOR=${PARTS[1]}
PATCH=${PARTS[2]}

case $TYPE in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *) echo "Usage: bump-version.sh patch|minor|major"; exit 1 ;;
esac

NEW="$MAJOR.$MINOR.$PATCH"
echo "New version: $NEW"

node -e "const p=require('./package.json'); p.version='$NEW'; require('fs').writeFileSync('./package.json', JSON.stringify(p, null, 2)+'\n')"

echo "Updated to $NEW"
echo "Next: git commit -am 'release: v$NEW' && git tag v$NEW"
