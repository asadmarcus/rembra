#!/bin/bash

# Enhanced Release Script with GitHub Integration
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Rembra Release Process${NC}"
echo "========================="

# Check if version is provided
if [ "$#" -ne 1 ]; then
    echo -e "${RED}Usage: $0 <version>${NC}"
    echo "Example: $0 1.2.0"
    exit 1
fi

VERSION=$1
echo -e "${BLUE}📦 Preparing release for version: $VERSION${NC}"

# Validate version format
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}❌ Invalid version format. Use semantic versioning (e.g., 1.2.0)${NC}"
    exit 1
fi

# Check if GitHub CLI is available
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}⚠️  GitHub CLI not found. Install it for better GitHub integration.${NC}"
    USE_GH=false
else
    USE_GH=true
fi

# Check working directory is clean
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${YELLOW}⚠️  Working directory has uncommitted changes.${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update version in package.json
echo -e "${BLUE}⬆️  Updating version in package.json...${NC}"
npm version $VERSION --no-git-tag-version

# Install dependencies to ensure everything is up to date
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install

# Build the app for all platforms
echo -e "${BLUE}🔨 Building application for all platforms...${NC}"
npm run dist:all

# Check if build was successful
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed. Please check the errors above.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build completed successfully!${NC}"

# List generated files
echo -e "${BLUE}📄 Generated files:${NC}"
ls -la dist/

# Calculate file sizes
echo -e "${BLUE}📊 File sizes:${NC}"
find dist/ -name "*.dmg" -o -name "*.exe" -o -name "*.AppImage" -o -name "*.deb" | while read file; do
    size=$(du -h "$file" | cut -f1)
    echo "  $file: $size"
done

# Create git commit and tag
echo -e "${BLUE}🏷️  Creating git commit and tag...${NC}"
git add package.json package-lock.json
git commit -m "Release v$VERSION

- Update version to $VERSION
- Build and release for all platforms
"

git tag "v$VERSION"

# Push to GitHub
echo -e "${BLUE}📤 Pushing to GitHub...${NC}"
git push origin main
git push origin "v$VERSION"

# Create GitHub release
if [ "$USE_GH" = true ]; then
    echo -e "${BLUE}🚀 Creating GitHub release...${NC}"
    
    # Generate release notes
    RELEASE_NOTES="## What's New in v$VERSION

### 🎉 Features
- Add your feature descriptions here

### 🐛 Bug Fixes  
- Add your bug fixes here

### 🔧 Improvements
- Add your improvements here

---

## 📥 Download for Your Platform

- **macOS**: Download the \`.dmg\` file
- **Windows**: Download the \`.exe\` file  
- **Linux**: Download the \`.AppImage\` file

## � Auto-Update
If you have Rembra already installed, you'll be notified about this update automatically!
"

    # Create the release
    gh release create "v$VERSION" \
        --title "Rembra v$VERSION" \
        --notes "$RELEASE_NOTES" \
        --draft \
        dist/*.dmg dist/*.exe dist/*.AppImage dist/*.deb

    echo -e "${GREEN}✅ GitHub release created as draft!${NC}"
    echo -e "${BLUE}📝 Edit the release notes and publish when ready:${NC}"
    echo "   https://github.com/$(gh repo view --json owner,name -q '.owner.login + \"/\" + .name')/releases"
    
else
    # Manual upload instructions
    echo -e "${YELLOW}📤 Manual GitHub release needed:${NC}"
    echo "1. Go to: https://github.com/your-username/rembra-desktop/releases/new"
    echo "2. Tag: v$VERSION"
    echo "3. Title: Rembra v$VERSION"
    echo "4. Upload files from dist/ folder"
    echo "5. Add release notes and publish"
fi

# Publish to electron-builder (auto-update)
echo -e "${BLUE}🚀 Publishing for auto-updater...${NC}"
npm run release

# Success message
echo ""
echo -e "${GREEN}🎉 Release v$VERSION completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "   1. ✅ Code pushed to GitHub"
echo "   2. ✅ Release created (draft)"
echo "   3. ✅ Auto-updater files published"
echo "   4. 📝 Edit release notes on GitHub"
echo "   5. 🚀 Publish the release"
echo "   6. 📊 Monitor update adoption"
echo ""
echo -e "${BLUE}📈 Release URLs:${NC}"
if [ "$USE_GH" = true ]; then
    REPO_URL=$(gh repo view --json url -q '.url')
    echo "   Release: $REPO_URL/releases/tag/v$VERSION"
    echo "   All releases: $REPO_URL/releases"
fi
echo ""
echo -e "${GREEN}🎯 Users will be automatically notified of this update!${NC}"
