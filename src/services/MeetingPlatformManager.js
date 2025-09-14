/**
 * Meeting Platform Integrations Manager
 * Handles Google Meet, Teams, Zoom integration for fetching meeting details
 */

class MeetingPlatformManager {
    constructor() {
        this.platforms = {
            googleMeet: {
                name: 'Google Meet',
                icon: '<img src="./google.png" style="width: 32px; height: 32px; border-radius: 8px; object-fit: contain;" alt="Google Meet">',
                enabled: false,
                apiKey: null,
                connected: false
            },
            teams: {
                name: 'Microsoft Teams',
                icon: '<img src="./microsoft.webp" style="width: 32px; height: 32px; border-radius: 8px; object-fit: contain;" alt="Microsoft Teams">',
                enabled: false,
                clientId: null,
                connected: false
            },
            zoom: {
                name: 'Zoom',
                icon: '<img src="./zoom.png" style="width: 32px; height: 32px; border-radius: 8px; object-fit: contain;" alt="Zoom">',
                enabled: false,
                apiKey: null,
                connected: false
            },
            webex: {
                name: 'Cisco Webex',
                icon: '<img src="./webex.png" style="width: 32px; height: 32px; border-radius: 8px; object-fit: contain;" alt="Cisco Webex">',
                enabled: false,
                apiKey: null,
                connected: false
            }
        };
    }

    // Connect to Google Meet
    async connectGoogleMeet(credentials) {
        try {
            console.log('Connecting to Google Meet...');
            
            // Store credentials securely
            await this.storeCredentials('googleMeet', credentials);
            
            // Test connection
            const isConnected = await this.testGoogleMeetConnection(credentials);
            
            if (isConnected) {
                this.platforms.googleMeet.connected = true;
                this.platforms.googleMeet.enabled = true;
                await this.saveSettings();
                return { success: true, message: 'Google Meet connected successfully!' };
            }
            
            throw new Error('Failed to connect to Google Meet');
        } catch (error) {
            console.error('Google Meet connection failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Connect to Microsoft Teams
    async connectTeams(credentials) {
        try {
            console.log('Connecting to Microsoft Teams...');
            
            await this.storeCredentials('teams', credentials);
            const isConnected = await this.testTeamsConnection(credentials);
            
            if (isConnected) {
                this.platforms.teams.connected = true;
                this.platforms.teams.enabled = true;
                await this.saveSettings();
                return { success: true, message: 'Microsoft Teams connected successfully!' };
            }
            
            throw new Error('Failed to connect to Microsoft Teams');
        } catch (error) {
            console.error('Teams connection failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Connect to Zoom
    async connectZoom(credentials) {
        try {
            console.log('Connecting to Zoom...');
            
            await this.storeCredentials('zoom', credentials);
            const isConnected = await this.testZoomConnection(credentials);
            
            if (isConnected) {
                this.platforms.zoom.connected = true;
                this.platforms.zoom.enabled = true;
                await this.saveSettings();
                return { success: true, message: 'Zoom connected successfully!' };
            }
            
            throw new Error('Failed to connect to Zoom');
        } catch (error) {
            console.error('Zoom connection failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Connect to Cisco Webex
    async connectWebex(credentials) {
        try {
            console.log('Connecting to Cisco Webex...');
            
            await this.storeCredentials('webex', credentials);
            const isConnected = await this.testWebexConnection(credentials);
            
            if (isConnected) {
                this.platforms.webex.connected = true;
                this.platforms.webex.enabled = true;
                await this.saveSettings();
                return { success: true, message: 'Cisco Webex connected successfully!' };
            }
            
            throw new Error('Failed to connect to Cisco Webex');
        } catch (error) {
            console.error('Webex connection failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Fetch meeting details from URL
    async fetchMeetingDetails(meetingUrl) {
        try {
            const platform = this.detectPlatform(meetingUrl);
            
            if (!platform) {
                throw new Error('Unsupported meeting platform');
            }

            if (!this.platforms[platform].connected) {
                throw new Error(`${this.platforms[platform].name} not connected. Please connect in settings.`);
            }

            switch (platform) {
                case 'googleMeet':
                    return await this.fetchGoogleMeetDetails(meetingUrl);
                case 'teams':
                    return await this.fetchTeamsDetails(meetingUrl);
                case 'zoom':
                    return await this.fetchZoomDetails(meetingUrl);
                default:
                    throw new Error('Platform not supported');
            }
        } catch (error) {
            console.error('Failed to fetch meeting details:', error);
            throw error;
        }
    }

    // Detect platform from meeting URL
    detectPlatform(url) {
        if (url.includes('meet.google.com')) return 'googleMeet';
        if (url.includes('teams.microsoft.com') || url.includes('teams.live.com')) return 'teams';
        if (url.includes('zoom.us') || url.includes('zoom.com')) return 'zoom';
        if (url.includes('webex.com') || url.includes('cisco.webex.com')) return 'webex';
        return null;
    }

    // Join meeting and start recording
    async joinMeeting(meetingUrl, options = {}) {
        try {
            const platform = this.detectPlatform(meetingUrl);
            const details = await this.fetchMeetingDetails(meetingUrl);
            
            // Open meeting in default browser
            const { shell } = require('electron');
            await shell.openExternal(meetingUrl);
            
            // Start Rembra recording
            const { ipcRenderer } = require('electron');
            await ipcRenderer.invoke('start-meeting-session', {
                meetingUrl,
                platform: this.platforms[platform].name,
                title: details.title,
                participants: details.participants,
                startTime: new Date().toISOString(),
                autoRecord: options.autoRecord !== false
            });

            return {
                success: true,
                meetingDetails: details,
                platform: this.platforms[platform].name
            };
        } catch (error) {
            console.error('Failed to join meeting:', error);
            throw error;
        }
    }

    // Platform-specific implementations
    async fetchGoogleMeetDetails(url) {
        // Extract meeting ID from URL
        const meetingId = this.extractGoogleMeetId(url);
        
        // This would integrate with Google Calendar API to get meeting details
        // For demo purposes, returning mock data
        return {
            platform: 'Google Meet',
            title: 'Team Standup',
            startTime: new Date().toISOString(),
            duration: 60,
            participants: ['john@company.com', 'sara@company.com'],
            agenda: 'Daily team sync and updates',
            meetingId,
            url
        };
    }

    async fetchTeamsDetails(url) {
        // Extract meeting info from Teams URL
        const meetingInfo = this.extractTeamsInfo(url);
        
        return {
            platform: 'Microsoft Teams',
            title: 'Project Review',
            startTime: new Date().toISOString(),
            duration: 90,
            participants: ['alice@company.com', 'bob@company.com'],
            agenda: 'Monthly project review and planning',
            meetingId: meetingInfo.id,
            url
        };
    }

    async fetchZoomDetails(url) {
        // Extract meeting info from Zoom URL
        const meetingInfo = this.extractZoomInfo(url);
        
        return {
            platform: 'Zoom',
            title: 'Client Meeting',
            startTime: new Date().toISOString(),
            duration: 120,
            participants: ['client@external.com', 'sales@company.com'],
            agenda: 'Product demo and Q&A session',
            meetingId: meetingInfo.id,
            url
        };
    }

    // Helper methods
    extractGoogleMeetId(url) {
        const match = url.match(/meet\.google\.com\/([a-z-]+)/);
        return match ? match[1] : null;
    }

    extractTeamsInfo(url) {
        // Teams URL parsing logic
        return { id: 'teams-meeting-id' };
    }

    extractZoomInfo(url) {
        const match = url.match(/zoom\.us\/j\/(\d+)/);
        return { id: match ? match[1] : 'zoom-meeting-id' };
    }

    // Test connections
    async testGoogleMeetConnection(credentials) {
        // Test Google Calendar API connection
        return true; // Mock for now
    }

    async testTeamsConnection(credentials) {
        // Test Microsoft Graph API connection
        return true; // Mock for now
    }

    async testZoomConnection(credentials) {
        // Test Zoom API connection
        return true; // Mock for now
    }

    async testWebexConnection(credentials) {
        // Test Cisco Webex API connection
        return true; // Mock for now
    }

    // Storage methods
    async storeCredentials(platform, credentials) {
        // Store encrypted credentials
        const encrypted = this.encrypt(JSON.stringify(credentials));
        localStorage.setItem(`${platform}_credentials`, encrypted);
    }

    async saveSettings() {
        localStorage.setItem('meeting_platforms', JSON.stringify(this.platforms));
    }

    loadSettings() {
        const saved = localStorage.getItem('meeting_platforms');
        if (saved) {
            this.platforms = { ...this.platforms, ...JSON.parse(saved) };
        }
    }

    encrypt(text) {
        // Basic encryption - in production use proper encryption
        return btoa(text);
    }

    decrypt(encrypted) {
        return atob(encrypted);
    }

    getConnectedPlatforms() {
        return Object.entries(this.platforms)
            .filter(([key, platform]) => platform.connected)
            .map(([key, platform]) => ({ key, ...platform }));
    }

    getAllPlatforms() {
        return Object.entries(this.platforms)
            .map(([key, platform]) => ({ key, ...platform }));
    }
}

module.exports = new MeetingPlatformManager();
