# 🚀 Rembra App Update Guide

## Overview
Your Rembra app now has professional auto-update capabilities! Users will automatically receive notifications when new versions are available.

## 📋 Update Workflow

### 1. **Development & Testing**
```bash
# Make your changes to the app
# Test thoroughly
# Commit your changes
git add .
git commit -m "Add new feature: improved meetings integration"
```

### 2. **Create a Release**
```bash
# Use the release script (easiest way)
./scripts/release.sh 1.0.1

# Or manually:
npm version 1.0.1
npm run release
```

### 3. **What Happens Automatically**
- ✅ App builds for all platforms (Windows, macOS, Linux)
- ✅ Creates GitHub release with installers
- ✅ Existing users get update notifications
- ✅ New users can download from GitHub releases

## 🎯 Quick Commands

### Build Only (No Release)
```bash
npm run build          # Current platform
npm run dist:all        # All platforms
```

### Release to GitHub
```bash
npm run release         # All platforms + GitHub release
npm run release:mac     # macOS only
npm run release:win     # Windows only
```

### Manual Update Check
Users can check for updates in: **Settings → About → Check for Updates**

## 🔧 Configuration

### GitHub Setup
1. Create a GitHub repository for your app
2. Generate a GitHub token with release permissions
3. Set environment variable: `GH_TOKEN=your_github_token`
4. Update `package.json` with your GitHub details:

```json
"build": {
  "publish": [
    {
      "provider": "github",
      "owner": "your-username",
      "repo": "rembra-desktop"
    }
  ]
}
```

### Environment Variables
Create `.env` file in project root:
```
GH_TOKEN=your_github_personal_access_token
```

## 📊 Update Types

### **Automatic Updates (Default)**
- Users get notifications
- Downloads in background
- Installs on next restart

### **Manual Distribution**
- Build with `npm run dist:all`
- Share installer files manually
- No auto-update notifications

## 🚦 Version Numbering

Use semantic versioning:
- `1.0.0` → `1.0.1` (Bug fixes)
- `1.0.0` → `1.1.0` (New features)
- `1.0.0` → `2.0.0` (Breaking changes)

## 📝 Release Notes

Add release notes in GitHub releases to tell users what's new:

```markdown
## What's New in v1.0.1

✨ **New Features**
- Meetings dashboard integrated into settings
- Real Zoom OAuth integration
- Improved meeting platform connections

🐛 **Bug Fixes**
- Fixed token storage issues
- Improved error handling

🔧 **Improvements**
- Better OAuth flow using default browser
- Enhanced meeting card UI
```

## 🛠️ Troubleshooting

### Update Check Not Working
- Ensure GitHub repository exists
- Check `GH_TOKEN` environment variable
- Verify `package.json` publish settings

### Build Failures
- Run `npm run rebuild` to fix native modules
- Check all dependencies are installed
- Ensure code signing certificates (for distribution)

### Users Not Getting Updates
- Check GitHub releases are marked as "Latest"
- Verify app version in `package.json`
- Ensure users have internet connection

## 🎉 Best Practices

1. **Test Before Release**
   - Always test on target platforms
   - Verify all features work after build

2. **Gradual Rollout**
   - Release to beta users first
   - Monitor for issues before wide release

3. **Clear Release Notes**
   - Tell users what's new
   - Mention any breaking changes

4. **Backup Strategy**
   - Keep previous versions available
   - Test rollback procedures

## 📞 Need Help?

If you run into issues:
1. Check the terminal output for errors
2. Verify GitHub token permissions
3. Test with a simple version bump first
4. Check electron-builder documentation

---

🎯 **Ready to Ship!** Your Rembra app is now ready for professional distribution with automatic updates!
