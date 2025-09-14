# Rembra AI Meeting Assistant

> Your intelligent companion for seamless meeting experiences across all platforms

## 🚀 Features

- **🎤 Real-time Transcription**: Advanced AI-powered speech-to-text during meetings
- **🤝 Multi-Platform Integration**: Works with Zoom, Google Meet, Microsoft Teams, and WebEx
- **🧠 AI Context Management**: Smart context understanding for better meeting insights
- **📧 Automated Follow-ups**: Generate professional emails and summaries
- **🔄 Auto-Updates**: Seamless updates delivered automatically
- **🎯 Meeting Analytics**: Track and analyze your meeting patterns

## 📥 Download

Download the latest version for your platform:

- **macOS**: [Download .dmg](https://github.com/asadmarcus/rembra/releases/latest)
- **Windows**: [Download .exe](https://github.com/asadmarcus/rembra/releases/latest)  
- **Linux**: [Download .AppImage](https://github.com/asadmarcus/rembra/releases/latest)

## 🔧 Development

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/asadmarcus/rembra.git
cd rembra

# Install dependencies
npm install

# Start development server
npm start
```

### Building

```bash
# Build for current platform
npm run build

# Build for all platforms
npm run dist:all

# Build for specific platform
npm run build:mac
npm run build:win
npm run build:linux
```

## 🔐 Configuration

1. **OAuth Setup**: Configure your meeting platform credentials in the settings
2. **API Keys**: Set up AI service API keys for enhanced features
3. **Preferences**: Customize transcription and meeting preferences

## 📖 Usage

1. **Launch Rembra** and complete the initial setup
2. **Connect Platforms**: Link your meeting accounts (Zoom, Google Meet, etc.)
3. **Join Meetings**: Rembra automatically detects and enhances your meetings
4. **Review Insights**: Access transcripts, summaries, and follow-up suggestions

## 🛠️ Tech Stack

- **Electron**: Cross-platform desktop framework
- **Node.js**: Backend runtime
- **OAuth 2.0**: Secure platform integration
- **AssemblyAI**: Advanced speech recognition
- **Firebase**: Cloud services and analytics

## 🔄 Auto-Updates

Rembra automatically checks for updates and notifies you when new versions are available. Updates download in the background and install seamlessly.

## 🐛 Issues & Support

- **Bug Reports**: [Create an issue](https://github.com/asadmarcus/rembra/issues)
- **Feature Requests**: [Submit a request](https://github.com/asadmarcus/rembra/issues)
- **Documentation**: Check our [setup guides](./GITHUB_SETUP.md)

## 📄 License

Copyright © 2025 Rembra. All rights reserved.

## 🚀 Release Process

For developers working on releases:

```bash
# Create a new release
./scripts/release.sh 1.2.0

# The script will:
# 1. Update version in package.json
# 2. Build for all platforms
# 3. Create git tag
# 4. Push to GitHub
# 5. Create GitHub release
# 6. Publish for auto-updater
```

---

**Made with ❤️ for better meetings**
