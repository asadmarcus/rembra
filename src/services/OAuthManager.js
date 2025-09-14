const { BrowserWindow, session } = require('electron');
const url = require('url');
const Store = require('electron-store');

class OAuthManager {
    constructor() {
        this.fetch = null;
        this.store = new Store();
        this.initFetch();
        
        this.providers = {
            google: {
                authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                tokenUrl: 'https://oauth2.googleapis.com/token',
                clientId: process.env.GOOGLE_CLIENT_ID || '1096024812793-14ef02289b05cd11ca4628.apps.googleusercontent.com',
                clientSecret: process.env.GOOGLE_CLIENT_SECRET, // Required for token exchange
                redirectUri: 'http://localhost:3000/oauth/google/callback',
                scopes: ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/userinfo.email']
            },
            microsoft: {
                authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
                tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
                clientId: process.env.MICROSOFT_CLIENT_ID || 'your-microsoft-client-id',
                clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
                redirectUri: 'http://localhost:3000/oauth/microsoft/callback',
                scopes: ['https://graph.microsoft.com/User.Read', 'https://graph.microsoft.com/Calendars.Read']
            },
            zoom: {
                authUrl: 'https://zoom.us/oauth/authorize',
                tokenUrl: 'https://zoom.us/oauth/token',
                clientId: process.env.ZOOM_CLIENT_ID || 'bTbTMWY7QFOhsmYIKqh8pQ',
                clientSecret: process.env.ZOOM_CLIENT_SECRET || 'oxKtJX7JEGGtXVYRIacwNzvd8jgL3Kvc',
                redirectUri: 'http://localhost:3000/oauth/zoom/callback',
                scopes: ['meeting:read', 'user:read']
            }
        };
    }

    async initFetch() {
        if (!this.fetch) {
            const fetchModule = await import('node-fetch');
            this.fetch = fetchModule.default;
        }
    }

    getStoredToken(provider) {
        // Map provider names to storage keys
        const storeKeyMap = {
            'google': 'google_oauth_tokens',
            'microsoft': 'microsoft_oauth_tokens', 
            'zoom': 'zoom_oauth_tokens',
            'webex': 'webex_oauth_tokens'
        };

        const storeKey = storeKeyMap[provider];
        if (!storeKey) {
            console.error(`Unknown provider for token storage: ${provider}`);
            return null;
        }

        const tokens = this.store.get(storeKey);
        if (!tokens) {
            console.log(`No stored tokens found for ${provider}`);
            return null;
        }

        // Check if token is expired
        if (tokens.expires_at && Date.now() >= tokens.expires_at) {
            console.log(`Token expired for ${provider}`);
            return null;
        }

        console.log(`✅ Found valid token for ${provider}`);
        return tokens.access_token;
    }

    async authenticate(provider) {
        return new Promise((resolve, reject) => {
            const config = this.providers[provider];
            if (!config) {
                return reject(new Error(`Unknown provider: ${provider}`));
            }

            // Special handling for Zoom OAuth parameters
            let authParams;
            if (provider === 'zoom') {
                authParams = new URLSearchParams({
                    response_type: 'code',
                    client_id: config.clientId,
                    redirect_uri: config.redirectUri
                });
            } else {
                // Standard OAuth parameters for Google/Microsoft
                authParams = new URLSearchParams({
                    client_id: config.clientId,
                    redirect_uri: config.redirectUri,
                    scope: config.scopes.join(' '),
                    response_type: 'code',
                    access_type: 'offline',
                    prompt: 'consent'
                });
            }

            const authUrl = `${config.authUrl}?${authParams.toString()}`;

            console.log('🔗 OAuth URL being opened:', authUrl);
            console.log('🔗 Redirect URI configured:', config.redirectUri);
            console.log('🔗 Client ID being used:', config.clientId);

            // Open OAuth URL in user's default browser instead of Electron window
            const { shell } = require('electron');
            shell.openExternal(authUrl);

            // Start a local server to handle the OAuth callback
            this.startCallbackServer(config, resolve, reject);
        });
    }

    startCallbackServer(config, resolve, reject) {
        const http = require('http');
        const url = require('url');
        
        const server = http.createServer((req, res) => {
            const parsedUrl = url.parse(req.url, true);
            
            console.log('🔗 OAuth callback received:', parsedUrl.pathname, parsedUrl.query);
            
            if (parsedUrl.pathname === '/oauth/zoom/callback') {
                
                // Send success page to user
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end(`
                    <html>
                        <head><title>Zoom Authentication Successful</title></head>
                        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                            <h1 style="color: #10b981;">✅ Zoom Authentication Successful!</h1>
                            <p>You have successfully connected to Zoom.</p>
                            <p>You can now close this tab and return to Rembra.</p>
                            <script>
                                setTimeout(() => {
                                    window.close();
                                }, 3000);
                            </script>
                        </body>
                    </html>
                `);
                
                // Handle the OAuth callback
                if (parsedUrl.query.error) {
                    server.close();
                    reject(new Error(`OAuth error: ${parsedUrl.query.error}`));
                    return;
                }

                if (parsedUrl.query.code) {
                    console.log('✅ Authorization code received from Zoom');
                    server.close();
                    // Exchange code for tokens
                    this.exchangeCodeForTokens(parsedUrl.query.code, config)
                        .then(tokens => resolve(tokens))
                        .catch(error => reject(error));
                } else {
                    server.close();
                    reject(new Error('No authorization code received'));
                }
            } else {
                // 404 for other paths
                res.writeHead(404, {'Content-Type': 'text/html'});
                res.end('<h1>404 - Path not found</h1>');
            }
        });

        // Start server on port 3000
        server.listen(3000, 'localhost', () => {
            console.log('OAuth callback server started on http://localhost:3000');
        });

        // Auto-close server after 5 minutes to prevent hanging
        setTimeout(() => {
            server.close();
            reject(new Error('OAuth timeout - please try again'));
        }, 5 * 60 * 1000);
    }

    async exchangeCodeForTokens(code, config) {
        await this.initFetch(); // Ensure fetch is loaded
        
        const tokenParams = new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: config.redirectUri
        });

        const response = await this.fetch(config.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: tokenParams.toString()
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
        }

        const tokens = await response.json();
        return tokens;
    }

    // Google Calendar API methods
    async getGoogleCalendarEvents(accessToken) {
        await this.initFetch(); // Ensure fetch is loaded
        
        const now = new Date();
        const timeMin = now.toISOString();
        const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const response = await this.fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Google Calendar API error: ${response.status}`);
        }

        const data = await response.json();
        return data.items || [];
    }

    // Microsoft Graph API methods
    async getMicrosoftCalendarEvents(accessToken) {
        await this.initFetch(); // Ensure fetch is loaded
        
        const now = new Date();
        const startTime = now.toISOString();
        const endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const response = await this.fetch(`https://graph.microsoft.com/v1.0/me/calendar/events?$filter=start/dateTime ge '${startTime}' and end/dateTime le '${endTime}'&$orderby=start/dateTime`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Microsoft Graph API error: ${response.status}`);
        }

        const data = await response.json();
        return data.value || [];
    }

    // Zoom API methods
    async getZoomMeetings(accessToken) {
        await this.initFetch(); // Ensure fetch is loaded
        
        console.log('🔍 Fetching Zoom meetings...');
        const response = await this.fetch('https://api.zoom.us/v2/users/me/meetings?type=upcoming', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`Zoom API error: ${response.status}`);
            throw new Error(`Zoom API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('🔍 Zoom API response:', data);
        
        const meetings = data.meetings?.map(meeting => ({
            id: meeting.id,
            title: meeting.topic || 'Untitled Meeting',
            startTime: meeting.start_time,
            endTime: null, // Zoom doesn't provide end time in this API
            joinUrl: meeting.join_url,
            platform: 'zoom'
        })) || [];
        
        console.log(`🔍 Found ${meetings.length} Zoom meetings`);
        return meetings;
    }

    // Validate tokens by making a test API call
    async validateToken(provider, accessToken) {
        await this.initFetch(); // Ensure fetch is loaded
        
        try {
            switch (provider) {
                case 'google':
                    const response = await this.fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    return response.ok;
                case 'microsoft':
                    const msResponse = await this.fetch('https://graph.microsoft.com/v1.0/me', {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    return msResponse.ok;
                case 'zoom':
                    const zoomResponse = await this.fetch('https://api.zoom.us/v2/users/me', {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    return zoomResponse.ok;
                default:
                    return false;
            }
        } catch (error) {
            console.error(`Token validation failed for ${provider}:`, error);
            return false;
        }
    }

    async getMeetings(platform) {
        await this.initFetch();
        
        // Map platform names to provider keys
        const providerMap = {
            'google-meet': 'google',
            'microsoft-teams': 'microsoft',
            'zoom': 'zoom',
            'webex': 'webex'
        };

        const provider = providerMap[platform];
        if (!provider) {
            throw new Error(`Unknown platform: ${platform}`);
        }

        // Get stored access token
        const accessToken = this.getStoredToken(provider);
        if (!accessToken) {
            throw new Error(`No access token for ${platform}. Please connect first.`);
        }

        try {
            switch (provider) {
                case 'google':
                    return await this.getGoogleMeetings(accessToken);
                case 'microsoft':
                    return await this.getMicrosoftMeetings(accessToken);
                case 'zoom':
                    return await this.getZoomMeetings(accessToken);
                case 'webex':
                    return await this.getWebexMeetings(accessToken);
                default:
                    return [];
            }
        } catch (error) {
            console.error(`Error fetching ${platform} meetings:`, error);
            throw error;
        }
    }

    async getGoogleMeetings(accessToken) {
        // Get calendar events from Google Calendar API
        const now = new Date().toISOString();
        const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        
        const response = await this.fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${oneWeekFromNow}&orderBy=startTime&singleEvents=true`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );

        if (!response.ok) {
            throw new Error(`Google Calendar API error: ${response.status}`);
        }

        const data = await response.json();
        return data.items?.filter(event => 
            event.hangoutLink || 
            event.conferenceData?.entryPoints?.some(ep => ep.entryPointType === 'video')
        ).map(event => ({
            id: event.id,
            title: event.summary || 'Untitled Meeting',
            startTime: event.start?.dateTime || event.start?.date,
            endTime: event.end?.dateTime || event.end?.date,
            joinUrl: event.hangoutLink || event.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri,
            platform: 'google-meet'
        })) || [];
    }

    async getMicrosoftMeetings(accessToken) {
        // Get calendar events from Microsoft Graph API
        const now = new Date().toISOString();
        const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        
        const response = await this.fetch(
            `https://graph.microsoft.com/v1.0/me/events?$filter=start/dateTime ge '${now}' and start/dateTime le '${oneWeekFromNow}'&$orderby=start/dateTime&$select=id,subject,start,end,onlineMeeting`,
            {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );

        if (!response.ok) {
            throw new Error(`Microsoft Graph API error: ${response.status}`);
        }

        const data = await response.json();
        return data.value?.filter(event => event.onlineMeeting?.joinUrl).map(event => ({
            id: event.id,
            title: event.subject || 'Untitled Meeting',
            startTime: event.start?.dateTime,
            endTime: event.end?.dateTime,
            joinUrl: event.onlineMeeting?.joinUrl,
            platform: 'microsoft-teams'
        })) || [];
    }

    async getWebexMeetings(accessToken) {
        // Placeholder for Webex API integration
        // Would need Webex API credentials and implementation
        console.log('Webex integration not yet implemented');
        return [];
    }
}

module.exports = OAuthManager;
