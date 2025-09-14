#!/bin/bash

# GitHub Release Setup for Rembra
echo "🚀 Setting up GitHub Releases for Rembra"
echo "========================================"

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "📦 Installing GitHub CLI..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install gh
        else
            echo "❌ Please install Homebrew first: https://brew.sh"
            exit 1
        fi
    else
        echo "❌ Please install GitHub CLI: https://cli.github.com"
        exit 1
    fi
fi

echo "✅ GitHub CLI is installed"

# Authenticate with GitHub
echo "🔐 Authenticating with GitHub..."
gh auth login

# Create repository if it doesn't exist
echo "📦 Setting up GitHub repository..."
read -p "Enter your GitHub username: " github_username
read -p "Enter repository name (default: rembra-desktop): " repo_name
repo_name=${repo_name:-rembra-desktop}

# Check if repo exists
if gh repo view "$github_username/$repo_name" &> /dev/null; then
    echo "✅ Repository $github_username/$repo_name already exists"
else
    echo "🔨 Creating repository $github_username/$repo_name..."
    gh repo create "$github_username/$repo_name" --private --description "Rembra AI Meeting Assistant"
    
    # Set up git remote
    git remote add origin "https://github.com/$github_username/$repo_name.git"
fi

# Update package.json with correct GitHub info
echo "📝 Updating package.json with GitHub repository info..."
cat package.json | jq ".build.publish[0].owner = \"$github_username\"" | jq ".build.publish[0].repo = \"$repo_name\"" > package.json.tmp
mv package.json.tmp package.json

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Push your code: git push origin main"
echo "   2. Create your first release: ./scripts/release.sh 1.0.0"
echo "   3. Users can download from: https://github.com/$github_username/$repo_name/releases"
