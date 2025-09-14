# GitHub Releases Setup Guide

Complete guide for setting up professional app distribution with auto-updates using GitHub releases.

## 🎯 Overview

This setup enables:
- **Automatic Updates**: Users get notified and can update seamlessly
- **Professional Distribution**: Direct downloads from GitHub releases
- **Version Management**: Semantic versioning with automated workflows
- **Cross-Platform**: Support for macOS, Windows, and Linux

## 📋 Prerequisites

1. **GitHub Repository**: Your app code should be in a GitHub repository
2. **GitHub CLI** (recommended): `brew install gh` on macOS
3. **Node.js & npm**: Latest LTS version
4. **Git**: Configured with your GitHub account

## 🚀 Initial Setup

### 1. Repository Configuration

Make sure your repository has these permissions:
```bash
# Login to GitHub CLI
gh auth login

# Set repository to public or ensure proper permissions for releases
gh repo view --json visibility
```

### 2. GitHub Personal Access Token

For automated releases, create a token with these permissions:
- `repo` (full repository access)
- `write:packages` (for publishing)

```bash
# Create token via CLI
gh auth refresh -s repo,write:packages

# Or manually: https://github.com/settings/tokens/new
```

### 3. Environment Variables

Add to your shell profile (`~/.zshrc` or `~/.bashrc`):
```bash
export GH_TOKEN="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"
export GITHUB_TOKEN="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"  # for electron-builder
```

## 🔧 Project Configuration

### 1. Verify package.json Settings

Ensure your `package.json` has the correct repository and publish configuration:

```json
{
  "name": "rembra",
  "repository": {
    "type": "git",
    "url": "https://github.com/asadmarcus/rembra.git"
  },
  "build": {
    "publish": {
      "provider": "github",
      "owner": "asadmarcus",
      "repo": "rembra"
    }
  }
}
```

### 2. Your Repository Configuration

✅ **Repository**: `https://github.com/asadmarcus/rembra.git`
✅ **Owner**: `asadmarcus`
✅ **Repo**: `rembra`

## 🎬 First Release Process

### 1. Test Build Locally

Before creating a release, test the build:
```bash
npm run dist:all
```

### 2. Create Your First Release

```bash
# Make release script executable
chmod +x scripts/release.sh

# Create version 1.0.0 (adjust as needed)
./scripts/release.sh 1.0.0
```

### 3. Monitor the Process

The script will:
1. ✅ Update version in package.json
2. ✅ Build for all platforms (macOS, Windows, Linux)
3. ✅ Create git commit and tag
4. ✅ Push to GitHub
5. ✅ Create GitHub release (draft)
6. ✅ Upload build artifacts
7. ✅ Publish for auto-updater

## 📱 User Experience Flow

### For New Users
1. **Discovery**: Users find your app on GitHub releases
2. **Download**: They download the appropriate installer (.dmg, .exe, .AppImage)
3. **Installation**: Standard installation process for their platform
4. **First Launch**: App works immediately with auto-update enabled

### For Existing Users  
1. **Notification**: App shows update notification automatically
2. **Download**: Update downloads in background (or on user confirmation)
3. **Installation**: App restarts with new version
4. **Seamless**: No user data is lost, preferences are preserved

## 🔄 Release Workflow

### Regular Releases

```bash
# For minor updates
./scripts/release.sh 1.1.0

# For patches
./scripts/release.sh 1.0.1

# For major updates
./scripts/release.sh 2.0.0
```

### Release Checklist

Before each release:
- [ ] Test all major features
- [ ] Update changelog/release notes
- [ ] Check for security vulnerabilities
- [ ] Verify build on all platforms
- [ ] Test auto-updater functionality

## 🛠️ Advanced Configuration

### Custom Release Notes

Edit the GitHub release after creation:
1. Go to: `https://github.com/asadmarcus/rembra/releases`
2. Find your draft release
3. Edit the description with:
   - New features
   - Bug fixes
   - Breaking changes
   - Migration instructions

### Auto-Update Settings

In your main process (`main.js`):
```javascript
// Check for updates every 4 hours
setInterval(() => {
  autoUpdater.checkForUpdatesAndNotify();
}, 4 * 60 * 60 * 1000);

// Check on app startup (after 10 seconds)
setTimeout(() => {
  autoUpdater.checkForUpdatesAndNotify();
}, 10000);
```

### Beta Releases

For pre-release versions:
```bash
# Create a beta release
npm version prerelease --preid=beta
git tag "v1.1.0-beta.1"
git push origin "v1.1.0-beta.1"

# Mark as pre-release on GitHub
gh release create "v1.1.0-beta.1" --prerelease
```

## 🔍 Troubleshooting

### Common Issues

**Build Fails**
```bash
# Clean and rebuild
rm -rf dist/ node_modules/
npm install
npm run dist:all
```

**GitHub CLI Issues**
```bash
# Re-authenticate
gh auth logout
gh auth login
```

**Auto-Updater Not Working**
- Check repository is public or token has correct permissions
- Verify GitHub release exists and has assets
- Check app is code-signed (macOS) or has valid certificate (Windows)

### Debug Mode

Enable update debugging:
```javascript
// In main.js
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';
```

## 📊 Monitoring & Analytics

### GitHub Insights

Monitor your releases:
- Download statistics: `https://github.com/your-username/your-repo/releases`
- Traffic analytics: Repository insights tab
- Issue tracking: Users can report problems via GitHub issues

### Update Success Rates

Track in your app:
```javascript
autoUpdater.on('update-downloaded', () => {
  // Send analytics event
  analytics.track('update_downloaded');
});

autoUpdater.on('update-not-available', () => {
  // Send analytics event
  analytics.track('update_check_no_update');
});
```

## 🔐 Security Considerations

### Code Signing

**macOS**: Apple Developer Certificate required
```json
{
  "build": {
    "mac": {
      "hardenedRuntime": true,
      "entitlements": "build/entitlements.mac.plist"
    }
  }
}
```

**Windows**: Code signing certificate recommended
```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/certificate.p12",
      "certificatePassword": "password"
    }
  }
}
```

### Update Security

- Always use HTTPS for downloads
- Verify signatures before installation
- Use GitHub's built-in security features
- Enable branch protection rules

## 🎯 Best Practices

### Release Frequency
- **Major versions**: Every 3-6 months
- **Minor versions**: Monthly or bi-weekly
- **Patches**: As needed for critical bugs

### Version Numbering
- `1.0.0`: Major release, breaking changes
- `1.1.0`: Minor release, new features
- `1.0.1`: Patch release, bug fixes

### Communication
- Announce major updates on your website/social media
- Include migration guides for breaking changes
- Respond to user feedback on GitHub issues
- Maintain a changelog

## 🎉 Success Metrics

Your setup is successful when:
- ✅ Users receive update notifications automatically
- ✅ Downloads complete without user intervention
- ✅ App restarts with new version seamlessly
- ✅ No user data is lost during updates
- ✅ Release process takes < 10 minutes
- ✅ Users can easily find and download your app

---

## 🆘 Need Help?

If you encounter issues:
1. Check the [electron-updater documentation](https://www.electron.build/auto-update)
2. Review GitHub Actions logs
3. Test with a simple version increment first
4. Create an issue in your repository for community help

Your app now has professional-grade distribution and update capabilities! 🚀
