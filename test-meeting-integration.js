// Test the meeting platform integration flow
const { ipcRenderer } = require('electron');

async function testMeetingIntegration() {
    console.log('🧪 Testing Meeting Platform Integration');
    
    try {
        // Test 1: Start a meeting session
        console.log('1. Testing meeting session start...');
        const sessionResult = await ipcRenderer.invoke('start-meeting-session', {
            meetingUrl: 'https://meet.google.com/test-meeting',
            platform: 'Google Meet',
            title: 'Test Meeting',
            participants: ['test@example.com'],
            startTime: new Date().toISOString(),
            autoRecord: true
        });
        
        console.log('Session start result:', sessionResult);
        
        // Test 2: Get current meeting session
        console.log('2. Testing current session retrieval...');
        const currentSession = await ipcRenderer.invoke('get-current-meeting-session');
        console.log('Current session:', currentSession);
        
        // Test 3: End meeting session
        console.log('3. Testing meeting session end...');
        const endResult = await ipcRenderer.invoke('end-meeting-session');
        console.log('Session end result:', endResult);
        
        console.log('✅ Meeting integration test completed!');
        
    } catch (error) {
        console.error('❌ Meeting integration test failed:', error);
    }
}

// Run test when DOM is loaded
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', testMeetingIntegration);
} else {
    testMeetingIntegration();
}
