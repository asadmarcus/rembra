# OAuth Setup Guide for Rembra

This guide explains how to set up OAuth credentials for meeting platform integrations.

## Google Meet Integration (Google Calendar API)

### 1. Go to Google Cloud Console
- Visit: https://console.cloud.google.com/
- Create a new project or select existing project

### 2. Enable APIs
- Go to "APIs & Services" > "Library"
- Enable "Google Calendar API"
- Enable "Google+ API" (for user info)

### 3. Create OAuth Credentials
- Go to "APIs & Services" > "Credentials"
- Click "Create Credentials" > "OAuth 2.0 Client IDs"
- Application type: "Desktop application"
- Name: "Rembra Desktop"
- Add authorized redirect URI: `http://localhost:3000/oauth/google/callback`

### 4. Set Environment Variables
```bash
export GOOGLE_CLIENT_ID="your-google-client-id"
export GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

## Microsoft Teams Integration (Microsoft Graph API)

### 1. Go to Azure Portal
- Visit: https://portal.azure.com/
- Go to "Azure Active Directory" > "App registrations"

### 2. Create App Registration
- Click "New registration"
- Name: "Rembra Desktop"
- Supported account types: "Personal Microsoft accounts only"
- Redirect URI: `http://localhost:3000/oauth/microsoft/callback`

### 3. Configure API Permissions
- Go to "API permissions"
- Add permissions:
  - Microsoft Graph > Delegated > User.Read
  - Microsoft Graph > Delegated > Calendars.Read

### 4. Create Client Secret
- Go to "Certificates & secrets"
- Create new client secret
- Copy the secret value

### 5. Set Environment Variables
```bash
export MICROSOFT_CLIENT_ID="your-microsoft-client-id"
export MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"
```

## Zoom Integration

### 1. Go to Zoom Marketplace
- Visit: https://marketplace.zoom.us/
- Sign in with your Zoom account

### 2. Create App
- Click "Develop" > "Build App"
- Choose "OAuth" app type
- App name: "Rembra Desktop"

### 3. Configure OAuth
- OAuth Redirect URL: `http://localhost:3000/oauth/zoom/callback`
- Add scopes:
  - meeting:read
  - user:read

### 4. Set Environment Variables
```bash
export ZOOM_CLIENT_ID="your-zoom-client-id"
export ZOOM_CLIENT_SECRET="your-zoom-client-secret"
```

## Running with Environment Variables

### Option 1: Terminal
```bash
cd /path/to/rembra-electron
export GOOGLE_CLIENT_ID="your-google-client-id"
export GOOGLE_CLIENT_SECRET="your-google-client-secret"
export MICROSOFT_CLIENT_ID="your-microsoft-client-id"
export MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"
export ZOOM_CLIENT_ID="your-zoom-client-id"
export ZOOM_CLIENT_SECRET="your-zoom-client-secret"
npm start
```

### Option 2: .env File
Create a `.env` file in the project root:
```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
ZOOM_CLIENT_ID=your-zoom-client-id
ZOOM_CLIENT_SECRET=your-zoom-client-secret
```

Then install dotenv:
```bash
npm install dotenv
```

And load it in main.js:
```javascript
require('dotenv').config();
```

## Testing the Integration

1. Start the app: `npm start`
2. Go to Settings > Meeting Platform Integration
3. Click "Connect" for any platform
4. A browser window will open for OAuth authentication
5. Complete the login process
6. The app will receive access tokens and fetch your meetings

## Troubleshooting

### Common Issues:
1. **Invalid redirect URI**: Make sure redirect URIs match exactly
2. **Scope errors**: Ensure all required scopes are added
3. **Client secret errors**: Verify client secrets are set correctly
4. **Token expiration**: Tokens will expire and need refresh

### Debug Mode:
Check the console for detailed OAuth flow logs and error messages.
