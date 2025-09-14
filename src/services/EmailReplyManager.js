const { clipboard } = require('electron');
const robot = (() => {
    try {
        return require('robotjs');
    } catch (error) {
        console.warn('⚠️ robotjs not available on this platform:', error.message);
        return {
            keyTap: () => console.warn('robotjs not available - keyboard automation disabled'),
            getWindows: () => [],
            getActiveWindow: () => null
        };
    }
})();

class EmailReplyManager {
    constructor() {
        this.isProcessing = false;
    }

    // Enhanced email reply insertion with AI integration
    async handleEmailReplyFlow(aiResponse, windowInfo) {
        console.log('📧 Starting enhanced email reply flow...');

        try {
            // Extract email reply from AI response
            const replyContent = this.extractEmailReplyFromResponse(aiResponse);

            if (!replyContent) {
                throw new Error('Could not extract email reply from AI response');
            }

            // Insert the reply
            const success = await this.insertEmailReply(replyContent, windowInfo);

            if (success) {
                return {
                    success: true,
                    message: '✅ Email reply pasted into compose box! Please review the content and click Send when ready.'
                };
            } else {
                // Fallback to clipboard
                const { clipboard } = require('electron');
                clipboard.writeText(replyContent);

                return {
                    success: false,
                    message: '⚠️ Auto-insertion failed, but your reply has been copied to the clipboard! Please paste it manually using Ctrl+V (or Cmd+V on Mac).'
                };
            }

        } catch (error) {
            console.error('❌ Email reply flow error:', error);

            // Always copy to clipboard as backup
            const { clipboard } = require('electron');
            clipboard.writeText(aiResponse);

            return {
                success: false,
                message: `❌ Error processing email reply: ${error.message}. The response has been copied to your clipboard.`
            };
        }
    }

    async insertEmailReply(replyContent, windowInfo) {
        if (this.isProcessing) return false;

        this.isProcessing = true;
        console.log('📧 Starting cross-platform email reply insertion...');

        try {
            // Extract email body from AI response
            const emailBody = this.extractEmailBody(replyContent);

            // Copy to clipboard as backup FIRST
            const { clipboard } = require('electron');
            clipboard.writeText(emailBody);
            console.log('📋 Email copied to clipboard as backup');

            // Detect email client type with better cross-platform detection
            const clientInfo = this.detectEmailClientEnhanced(windowInfo.name);
            console.log(`📧 Detected email client: ${clientInfo.type} (${clientInfo.platform})`);

            // Simplified insertion with better cross-platform support
            const success = await this.insertReplyEnhanced(clientInfo, emailBody, windowInfo);

            this.isProcessing = false;
            return success;

        } catch (error) {
            console.error('❌ Email reply insertion failed:', error);
            this.isProcessing = false;
            return false;
        }
    }

    extractEmailBody(aiResponse) {
        // Look for BODY: section
        const bodyMatch = aiResponse.match(/BODY:\s*([\s\S]*?)(?:\n\n|$)/i);
        if (bodyMatch) {
            return bodyMatch[1].trim();
        }

        // Look for content in code blocks
        const codeBlockMatch = aiResponse.match(/```[\s\S]*?\n([\s\S]*?)```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1].trim();
        }

        // Remove SUBJECT: line if present
        const lines = aiResponse.split('\n');
        const filteredLines = lines.filter(line => !line.startsWith('SUBJECT:'));

        return filteredLines.join('\n').trim();
    }

    detectEmailClientEnhanced(windowName) {
        const name = windowName.toLowerCase();
        const platform = process.platform;

        // Gmail in any browser - most specific check first
        if (name.includes('gmail')) {
            return { type: 'gmail', platform, isWeb: true };
        }

        // Yahoo Mail
        if (name.includes('yahoo') && name.includes('mail')) {
            return { type: 'yahoo_mail', platform, isWeb: true };
        }

        // Outlook.com (web)
        if (name.includes('outlook.com') || name.includes('outlook.live.com')) {
            return { type: 'outlook_web', platform, isWeb: true };
        }

        // ProtonMail
        if (name.includes('protonmail') || name.includes('proton.me')) {
            return { type: 'protonmail', platform, isWeb: true };
        }

        // Apple iCloud Mail
        if (name.includes('icloud.com') && name.includes('mail')) {
            return { type: 'icloud_mail', platform, isWeb: true };
        }

        // Fastmail
        if (name.includes('fastmail')) {
            return { type: 'fastmail', platform, isWeb: true };
        }

        // Zoho Mail
        if (name.includes('zoho') && name.includes('mail')) {
            return { type: 'zoho_mail', platform, isWeb: true };
        }

        // Browser-based email (catch-all for other webmail)
        if (name.includes('chrome') || name.includes('safari') || name.includes('firefox') || 
            name.includes('edge') || name.includes('opera') || name.includes('brave') ||
            name.includes('vivaldi') || name.includes('arc') || name.includes('browser')) {
            return { type: 'webmail', platform, isWeb: true };
        }

        // Outlook desktop app
        if (name.includes('outlook') && !name.includes('.com')) {
            return { type: 'outlook', platform, isWeb: false };
        }

        // Thunderbird
        if (name.includes('thunderbird')) {
            return { type: 'thunderbird', platform, isWeb: false };
        }

        // Apple Mail app
        if (name.includes('mail') && platform === 'darwin' && !name.includes('gmail') && !name.includes('.com')) {
            return { type: 'apple_mail', platform, isWeb: false };
        }

        // Windows Mail app and Outlook
        if (platform === 'win32') {
            if (name.toLowerCase().includes('applicationframehost') || 
                name.toLowerCase().includes('hxmail') ||
                name.toLowerCase().includes('mailapp') ||
                name.toLowerCase().includes('windows mail')) {
                return { type: 'windows_mail', platform, isWeb: false };
            }
            if (name.toLowerCase().includes('outlook') && !name.includes('.com')) {
                return { type: 'outlook_windows', platform, isWeb: false };
            }
        }

        // Mailbird (Windows)
        if (name.includes('mailbird')) {
            return { type: 'mailbird', platform, isWeb: false };
        }

        // Spark (macOS/iOS)
        if (name.includes('spark')) {
            return { type: 'spark', platform, isWeb: false };
        }

        // Airmail (macOS)
        if (name.includes('airmail')) {
            return { type: 'airmail', platform, isWeb: false };
        }

        return { type: 'generic', platform, isWeb: false };
    }

    async insertReplyEnhanced(clientInfo, emailBody, windowInfo) {
        console.log(`📧 Cross-platform insertion for ${clientInfo.type} on ${clientInfo.platform}`);
        console.log(`📋 Email content ready (${emailBody.length} characters)`);

        try {
            // CRITICAL: Focus the email window first before any insertion attempts
            console.log('🎯 Activating email window before insertion...');
            const windowFocused = await this.activateEmailWindow(windowInfo, clientInfo);
            
            if (!windowFocused) {
                console.log('⚠️ Failed to focus email window, proceeding anyway...');
            } else {
                console.log('✅ Email window activated successfully');
            }
            
            // Verify clipboard content before proceeding
            console.log('📋 Verifying clipboard content...');
            try {
                const clipboardContent = require('electron').clipboard.readText();
                if (clipboardContent && clipboardContent.includes(emailBody.substring(0, 50))) {
                    console.log('✅ Clipboard verified - content is ready for pasting');
                } else {
                    console.log('⚠️ Clipboard verification failed - re-copying content...');
                    require('electron').clipboard.writeText(emailBody);
                    console.log('✅ Content re-copied to clipboard');
                }
            } catch (clipError) {
                console.log('⚠️ Clipboard verification failed:', clipError.message);
                // Try to copy anyway
                try {
                    require('electron').clipboard.writeText(emailBody);
                    console.log('✅ Content copied to clipboard as fallback');
                } catch (copyError) {
                    console.error('❌ Failed to copy to clipboard:', copyError.message);
                }
            }
            
            // Multiple attempts with different strategies - FASTER
            for (let attempt = 1; attempt <= 2; attempt++) {
                console.log(`📧 Insertion attempt ${attempt}/2`);

                try {
                    // Re-focus window before each attempt
                    if (attempt > 1) {
                        console.log('🔄 Re-focusing email window...');
                        await this.activateEmailWindow(windowInfo, clientInfo);
                    }

                    // Step 1: Try to open reply with appropriate shortcut
                    await this.openReplyWithShortcut(clientInfo, attempt);
                    
                    // Step 2: Much shorter wait
                    const waitTime = 1500; // Reduced from 3000/2000
                    await this.delay(waitTime);
                    
                    // Step 3: Quick paste
                    const pasteSuccess = await this.pasteContentSafely(clientInfo.platform, clientInfo);
                    
                    if (pasteSuccess) {
                        console.log(`✅ Email insertion successful on attempt ${attempt}`);
                        return true;
                    } else {
                        console.log(`⚠️ Primary paste failed, trying backup method...`);
                        // Backup: Try direct keyboard shortcut
                        const backupPaste = await this.pasteWithBackupMethod(clientInfo.platform);
                        if (backupPaste) {
                            console.log(`✅ Email insertion successful with backup method on attempt ${attempt}`);
                            return true;
                        }
                    }
                    
                } catch (error) {
                    console.log(`⚠️ Attempt ${attempt} failed: ${error.message}`);
                }
                
                // Shorter wait between attempts
                if (attempt < 2) {
                    await this.delay(500); // Much faster
                }
            }

            console.log('❌ All insertion attempts failed');
            return false;

        } catch (error) {
            console.error('❌ Enhanced insertion failed:', error);
            return false;
        }
    }

    async openReplyWithShortcut(clientInfo, attempt) {
        const robot = require('robotjs');
        const { type, platform, isWeb } = clientInfo;

        console.log(`📧 Opening reply for ${type} (attempt ${attempt})`);

        if (isWeb) {
            // Web-based email shortcuts
            if (type === 'gmail') {
                // Gmail: 'r' key for reply
                robot.keyTap('r');
            } else if (type === 'yahoo_mail') {
                // Yahoo Mail: 'r' key or Ctrl+R
                const shortcuts = ['r', platform === 'darwin' ? ['r', 'command'] : ['r', 'control']];
                const shortcut = shortcuts[attempt - 1] || 'r';
                if (Array.isArray(shortcut)) {
                    robot.keyTap(shortcut[0], shortcut[1]);
                } else {
                    robot.keyTap(shortcut);
                }
            } else if (type === 'outlook_web') {
                // Outlook.com: Ctrl+R or Cmd+R
                const modifier = platform === 'darwin' ? 'command' : 'control';
                robot.keyTap('r', modifier);
            } else if (type === 'protonmail') {
                // ProtonMail: 'r' key
                robot.keyTap('r');
            } else if (type === 'icloud_mail') {
                // iCloud Mail: often uses standard shortcuts
                const modifier = platform === 'darwin' ? 'command' : 'control';
                robot.keyTap('r', modifier);
            } else if (type === 'fastmail' || type === 'zoho_mail') {
                // Fastmail/Zoho: try 'r' then Ctrl+R
                const shortcuts = ['r', platform === 'darwin' ? ['r', 'command'] : ['r', 'control']];
                const shortcut = shortcuts[attempt - 1] || 'r';
                if (Array.isArray(shortcut)) {
                    robot.keyTap(shortcut[0], shortcut[1]);
                } else {
                    robot.keyTap(shortcut);
                }
            } else {
                // Other webmail: try common shortcuts
                const shortcuts = ['r', platform === 'darwin' ? ['r', 'command'] : ['r', 'control']];
                const shortcut = shortcuts[attempt - 1] || 'r';
                
                if (Array.isArray(shortcut)) {
                    robot.keyTap(shortcut[0], shortcut[1]);
                } else {
                    robot.keyTap(shortcut);
                }
            }
        } else {
            // Native email apps
            const modifier = platform === 'darwin' ? 'command' : 'control';
            
            if (type === 'thunderbird') {
                // Thunderbird: Ctrl+R or Cmd+R
                robot.keyTap('r', modifier);
            } else if (type === 'apple_mail') {
                // Apple Mail: Cmd+R
                robot.keyTap('r', 'command');
            } else if (type === 'outlook') {
                // Outlook desktop: Ctrl+R or Cmd+R
                robot.keyTap('r', modifier);
            } else if (type === 'spark' || type === 'airmail') {
                // Modern Mac email apps: usually Cmd+R
                robot.keyTap('r', platform === 'darwin' ? 'command' : 'control');
            } else if (type === 'windows_mail' || type === 'mailbird') {
                // Windows email apps: Ctrl+R
                robot.keyTap('r', 'control');
            } else {
                // Generic fallback: Ctrl+R or Cmd+R
                robot.keyTap('r', modifier);
            }
        }
    }

    async pasteContentSafely(platform, clientInfo) {
        const robot = require('robotjs');
        
        try {
            // Cross-platform paste - NO AUTO-SEND, user controls sending
            const modifier = platform === 'darwin' ? 'command' : 'control';
            
            console.log(`Pasting content (user will send manually)...`);
            
            // Quick and simple paste - no fancy stuff, just paste
            robot.keyTap('v', modifier);
            await this.delay(300);
            
            
            // Ensure we don't accidentally trigger send shortcuts
            console.log('Content pasted - user can review and send when ready');
            
            return true;
        } catch (error) {
            console.error('Paste operation failed:', error);
            return false;
        }
    }

    async pasteWithBackupMethod(platform) {
        const robot = require('robotjs');
        
        try {
            console.log('🔄 Backup paste method...');
            const modifier = platform === 'darwin' ? 'command' : 'control';
            
            // Simple backup: Just try pasting again
            await this.delay(200);
            robot.keyTap('v', modifier);
            await this.delay(300);
            
            console.log('✅ Backup paste completed');
            return true;
        } catch (error) {
            console.error('❌ Backup paste failed:', error);
            return false;
        }
    }

    // Utility method for delays
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Extract email reply content from AI response with better parsing
    extractEmailReplyFromResponse(response) {
        // Look for SUBJECT/BODY structure first
        const subjectMatch = response.match(/SUBJECT:\s*(.*?)(?:\n|$)/i);
        const bodyMatch = response.match(/BODY:\s*([\s\S]*?)(?:\n\n|$)/i);
        
        if (subjectMatch && bodyMatch) {
            return `SUBJECT: ${subjectMatch[1].trim()}\n\nBODY:\n${bodyMatch[1].trim()}`;
        }
        
        // Look for content in code blocks
        const codeBlockMatch = response.match(/```[\s\S]*?\n([\s\S]*?)```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1].trim();
        }
        
        // Clean up and return full response if structured format not found
        const lines = response.split('\n');
        const cleanLines = lines.filter(line => {
            const lower = line.toLowerCase();
            return !lower.includes('as an ai') && 
                   !lower.includes('i hope this') && 
                   !lower.includes('let me know') &&
                   line.trim().length > 0;
        });
        
        return cleanLines.join('\n').trim();
    }

    async openReplyBox(clientType) {
        console.log(`🔓 Opening reply box for ${clientType}`);

        try {
            switch (clientType) {
                case 'webmail':
                    return await this.openWebmailReply();
                case 'outlook':
                    return await this.openOutlookReply();
                case 'apple_mail':
                    return await this.openAppleMailReply();
                default:
                    return await this.openGenericReply();
            }
        } catch (error) {
            console.error(`❌ Failed to open reply box for ${clientType}:`, error);
            return false;
        }
    }

    async openWebmailReply() {
        console.log('🌐 Opening webmail reply box...');

        // Try multiple methods for webmail
        const methods = [
            () => robot.keyTap('r'), // Gmail shortcut
            () => this.clickReplyButton(),
            () => robot.keyTap('r', 'command'), // Alternative shortcut
            () => this.findAndClickReply()
        ];

        for (const method of methods) {
            try {
                method();
                await this.delay(2000); // Wait for reply box to open

                // Check if reply box opened by looking for common indicators
                if (await this.isReplyBoxOpen()) {
                    console.log('✅ Webmail reply box opened');
                    return true;
                }
            } catch (error) {
                console.log(`⚠️ Method failed, trying next: ${error.message}`);
            }
        }

        return false;
    }

    async openOutlookReply() {
        console.log('📮 Opening Outlook reply box...');

        const methods = [
            () => robot.keyTap('r', 'command'), // Ctrl+R or Cmd+R
            () => robot.keyTap('r', 'control'),
            () => this.clickReplyButton(),
            () => this.findAndClickReply()
        ];

        for (const method of methods) {
            try {
                method();
                await this.delay(2500); // Outlook might be slower

                if (await this.isReplyBoxOpen()) {
                    console.log('✅ Outlook reply box opened');
                    return true;
                }
            } catch (error) {
                console.log(`⚠️ Outlook method failed: ${error.message}`);
            }
        }

        return false;
    }

    async openAppleMailReply() {
        console.log('📬 Opening Apple Mail reply box...');

        const methods = [
            () => robot.keyTap('r', 'command'), // Cmd+R
            () => this.clickReplyButton(),
            () => this.findAndClickReply()
        ];

        for (const method of methods) {
            try {
                method();
                await this.delay(2000);

                if (await this.isReplyBoxOpen()) {
                    console.log('✅ Apple Mail reply box opened');
                    return true;
                }
            } catch (error) {
                console.log(`⚠️ Apple Mail method failed: ${error.message}`);
            }
        }

        return false;
    }

    async openGenericReply() {
        console.log('🔧 Opening generic reply box...');

        const shortcuts = [
            ['r', 'command'],
            ['r', 'control'],
            ['r', null],
            ['enter', 'command']
        ];

        for (const [key, modifier] of shortcuts) {
            try {
                if (modifier) {
                    robot.keyTap(key, modifier);
                } else {
                    robot.keyTap(key);
                }

                await this.delay(2000);

                if (await this.isReplyBoxOpen()) {
                    console.log('✅ Generic reply box opened');
                    return true;
                }
            } catch (error) {
                console.log(`⚠️ Generic shortcut failed: ${error.message}`);
            }
        }

        return false;
    }

    async clickReplyButton() {
        console.log('🖱️ Attempting to click Reply button...');

        // Get screen size for positioning
        const screenSize = robot.getScreenSize();
        const { width, height } = screenSize;

        // Common reply button positions (relative to screen)
        const replyPositions = [
            { x: width * 0.1, y: height * 0.2 }, // Top left area
            { x: width * 0.9, y: height * 0.2 }, // Top right area
            { x: width * 0.5, y: height * 0.15 }, // Top center
            { x: width * 0.2, y: height * 0.3 }, // Left side
        ];

        for (const pos of replyPositions) {
            try {
                // Move mouse and click
                robot.moveMouse(pos.x, pos.y);
                await this.delay(100);
                robot.mouseClick();
                await this.delay(500);

                console.log(`🖱️ Clicked at position (${pos.x}, ${pos.y})`);
            } catch (error) {
                console.log(`⚠️ Click failed at position: ${error.message}`);
            }
        }
    }

    async findAndClickReply() {
        console.log('🔍 Searching for Reply button...');

        // This would need OCR or image recognition in a full implementation
        // For now, try common keyboard navigation
        try {
            // Tab through interface elements
            for (let i = 0; i < 10; i++) {
                robot.keyTap('tab');
                await this.delay(200);

                // Try pressing Enter on potential Reply button
                robot.keyTap('enter');
                await this.delay(1000);

                if (await this.isReplyBoxOpen()) {
                    console.log('✅ Found Reply button via navigation');
                    return true;
                }
            }
        } catch (error) {
            console.log(`⚠️ Navigation search failed: ${error.message}`);
        }

        return false;
    }

    async isReplyBoxOpen() {
        // Simple heuristic: check if we can type (cursor is in text field)
        try {
            // Try typing a test character and immediately delete it
            robot.typeString(' ');
            await this.delay(100);
            robot.keyTap('backspace');

            // If no error occurred, likely in a text field
            return true;
        } catch (error) {
            return false;
        }
    }

    async insertWebmailReply(emailBody, replyBoxOpened = false) {
        console.log('📧 Inserting webmail reply...');

        if (!replyBoxOpened) {
            // Try to open reply box if not already opened
            robot.keyTap('r');
            await this.delay(2000);
        }

        // Ensure we're in the compose area
        await this.focusComposeArea();

        // Paste the content
        robot.keyTap('v', process.platform === 'darwin' ? 'command' : 'control');
        await this.delay(500);

        return true;
    }

    async insertOutlookReply(emailBody, replyBoxOpened = false) {
        console.log('📧 Inserting Outlook reply...');

        if (!replyBoxOpened) {
            robot.keyTap('r', process.platform === 'darwin' ? 'command' : 'control');
            await this.delay(2500);
        }

        await this.focusComposeArea();

        // Paste content
        robot.keyTap('v', process.platform === 'darwin' ? 'command' : 'control');
        await this.delay(500);

        return true;
    }

    async insertAppleMailReply(emailBody, replyBoxOpened = false) {
        console.log('📧 Inserting Apple Mail reply...');

        if (!replyBoxOpened) {
            robot.keyTap('r', 'command');
            await this.delay(2000);
        }

        await this.focusComposeArea();

        // Paste content
        robot.keyTap('v', 'command');
        await this.delay(500);

        return true;
    }

    async insertGenericReply(emailBody, replyBoxOpened = false) {
        console.log('📧 Inserting generic reply...');

        if (!replyBoxOpened) {
            robot.keyTap('r', process.platform === 'darwin' ? 'command' : 'control');
            await this.delay(1500);
        }

        await this.focusComposeArea();

        // Paste content
        robot.keyTap('v', process.platform === 'darwin' ? 'command' : 'control');
        await this.delay(500);

        return true;
    }

    async focusComposeArea() {
        console.log('🎯 Focusing compose area...');

        try {
            // Try common methods to focus the compose text area
            const methods = [
                () => robot.keyTap('tab'), // Tab to compose area
                () => robot.keyTap('tab', 'shift'), // Shift+Tab
                () => robot.keyTap('down'), // Arrow down
                () => robot.keyTap('end'), // End key
            ];

            for (const method of methods) {
                method();
                await this.delay(300);

                // Test if we can type
                try {
                    robot.typeString(' ');
                    robot.keyTap('backspace');
                    console.log('✅ Compose area focused');
                    return true;
                } catch (error) {
                    // Continue to next method
                }
            }

            // If all methods fail, try clicking in the center-bottom area
            const screenSize = robot.getScreenSize();
            const clickX = screenSize.width * 0.5;
            const clickY = screenSize.height * 0.7;

            robot.moveMouse(clickX, clickY);
            robot.mouseClick();
            await this.delay(500);

            console.log('🖱️ Clicked to focus compose area');
            return true;

        } catch (error) {
            console.error('❌ Failed to focus compose area:', error);
            return false;
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Check if current screen content looks like an email
    isEmailContext(screenText) {
        const emailIndicators = [
            'from:', 'to:', 'subject:', 'reply', 'forward',
            'sent:', 'received:', '@', 'inbox', 'compose'
        ];

        const lowerText = screenText.toLowerCase();
        return emailIndicators.some(indicator => lowerText.includes(indicator));
    }

    // Enhanced email reply extraction from AI response
    extractEmailReplyFromResponse(aiResponse) {
        console.log('🔍 Extracting email reply from AI response...');

        // Look for explicit SUBJECT/BODY structure
        const subjectMatch = aiResponse.match(/SUBJECT:\s*(.*?)\n/i);
        const bodyMatch = aiResponse.match(/BODY:\s*([\s\S]*?)(?:\n\n|$)/i);

        if (subjectMatch && bodyMatch) {
            const subject = subjectMatch[1].trim();
            const body = bodyMatch[1].trim();
            return `SUBJECT: ${subject}\n\nBODY:\n${body}`;
        }

        // Look for content in code blocks
        const codeBlockMatch = aiResponse.match(/```[\s\S]*?\n([\s\S]*?)```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1].trim();
        }

        // Look for email-like content
        const lines = aiResponse.split('\n');
        let emailContent = [];
        let inEmailContent = false;

        for (const line of lines) {
            const trimmed = line.trim();

            // Start capturing when we see email indicators
            if (trimmed.toLowerCase().startsWith('subject:') ||
                trimmed.toLowerCase().startsWith('dear ') ||
                trimmed.toLowerCase().startsWith('hi ') ||
                trimmed.toLowerCase().startsWith('hello ')) {
                inEmailContent = true;
            }

            if (inEmailContent) {
                emailContent.push(line);
            }

            // Stop if we hit explanation text
            if (trimmed.toLowerCase().includes('this reply') ||
                trimmed.toLowerCase().includes('the above') ||
                trimmed.toLowerCase().includes('explanation:')) {
                break;
            }
        }

        if (emailContent.length > 0) {
            return emailContent.join('\n').trim();
        }

        // Final fallback
        return aiResponse.trim();
    }

    // Extract email body from structured response
    extractEmailBody(aiResponse) {
        // Look for BODY: section
        const bodyMatch = aiResponse.match(/BODY:\s*([\s\S]*?)(?:\n\n|$)/i);
        if (bodyMatch) {
            return bodyMatch[1].trim();
        }

        // Remove SUBJECT: line if present
        const lines = aiResponse.split('\n');
        const filteredLines = lines.filter(line => !line.toLowerCase().startsWith('subject:'));

        return filteredLines.join('\n').trim();
    }

    // Extract email thread context for better replies
    extractEmailContext(screenText) {
        const lines = screenText.split('\n');
        const context = {
            subject: '',
            sender: '',
            content: '',
            isReply: false
        };

        for (const line of lines) {
            const lower = line.toLowerCase().trim();

            if (lower.startsWith('subject:') || lower.startsWith('re:')) {
                context.subject = line.trim();
                context.isReply = lower.includes('re:');
            }

            if (lower.startsWith('from:')) {
                context.sender = line.trim();
            }
        }

        // Extract main email content (simplified)
        const contentStart = lines.findIndex(line =>
            line.toLowerCase().includes('wrote:') ||
            line.toLowerCase().includes('said:') ||
            line.trim() === ''
        );

        if (contentStart > -1) {
            context.content = lines.slice(0, contentStart).join('\n').trim();
        } else {
            context.content = screenText;
        }

        return context;
    }

    // Enhanced reply box opening with multiple methods
    async openReplyBoxEnhanced(clientType) {
        console.log(`🔓 Enhanced reply box opening for ${clientType}`);

        const robot = require('robotjs');
        const methods = [];

        // Define methods based on client type
        switch (clientType) {
            case 'webmail':
                methods.push(
                    () => robot.keyTap('r'), // Gmail shortcut
                    () => this.clickReplyButton(),
                    () => robot.keyTap('r', 'command'),
                    () => this.findAndClickReply()
                );
                break;

            case 'outlook':
                methods.push(
                    () => robot.keyTap('r', process.platform === 'darwin' ? 'command' : 'control'),
                    () => this.clickReplyButton(),
                    () => this.findAndClickReply()
                );
                break;

            case 'apple_mail':
                methods.push(
                    () => robot.keyTap('r', 'command'),
                    () => this.clickReplyButton(),
                    () => this.findAndClickReply()
                );
                break;

            default:
                methods.push(
                    () => robot.keyTap('r', process.platform === 'darwin' ? 'command' : 'control'),
                    () => robot.keyTap('r'),
                    () => this.clickReplyButton()
                );
        }

        // Try each method
        for (let i = 0; i < methods.length; i++) {
            try {
                console.log(`🔄 Trying reply method ${i + 1}/${methods.length}`);
                methods[i]();

                // Wait for reply box to open
                await this.delay(clientType === 'outlook' ? 3000 : 2000);

                // Check if reply box opened
                if (await this.isReplyBoxOpen()) {
                    console.log(`✅ Reply box opened with method ${i + 1}`);
                    return true;
                }
            } catch (error) {
                console.log(`⚠️ Reply method ${i + 1} failed:`, error.message);
            }
        }

        return false;
    }

    // Enhanced webmail reply insertion
    async insertWebmailReplyEnhanced(emailBody, replyBoxOpened = false) {
        console.log('🌐 Enhanced webmail reply insertion...');

        const robot = require('robotjs');

        if (!replyBoxOpened) {
            robot.keyTap('r');
            await this.delay(2000);
        }

        await this.focusComposeAreaEnhanced();
        robot.keyTap('v', process.platform === 'darwin' ? 'command' : 'control');
        await this.delay(500);

        return true;
    }

    // Enhanced Outlook reply insertion
    async insertOutlookReplyEnhanced(emailBody, replyBoxOpened = false) {
        console.log('📨 Enhanced Outlook reply insertion...');

        const robot = require('robotjs');

        if (!replyBoxOpened) {
            robot.keyTap('r', process.platform === 'darwin' ? 'command' : 'control');
            await this.delay(3000);
        }

        await this.focusComposeAreaEnhanced();
        robot.keyTap('v', process.platform === 'darwin' ? 'command' : 'control');
        await this.delay(500);

        return true;
    }

    // Enhanced Apple Mail reply insertion
    async insertAppleMailReplyEnhanced(emailBody, replyBoxOpened = false) {
        console.log('📬 Enhanced Apple Mail reply insertion...');

        const robot = require('robotjs');

        if (!replyBoxOpened) {
            robot.keyTap('r', 'command');
            await this.delay(2000);
        }

        await this.focusComposeAreaEnhanced();
        robot.keyTap('v', 'command');
        await this.delay(500);

        return true;
    }

    // Enhanced generic reply insertion
    async insertGenericReplyEnhanced(emailBody, replyBoxOpened = false) {
        console.log('🔧 Enhanced generic reply insertion...');

        const robot = require('robotjs');

        if (!replyBoxOpened) {
            robot.keyTap('r', process.platform === 'darwin' ? 'command' : 'control');
            await this.delay(2000);
        }

        await this.focusComposeAreaEnhanced();
        robot.keyTap('v', process.platform === 'darwin' ? 'command' : 'control');
        await this.delay(500);

        return true;
    }

    // Enhanced compose area focusing
    async focusComposeAreaEnhanced() {
        console.log('🎯 Enhanced compose area focusing...');

        const robot = require('robotjs');

        const methods = [
            () => robot.keyTap('tab'),
            () => robot.keyTap('tab', 'shift'),
            () => robot.keyTap('down'),
            () => robot.keyTap('end')
        ];

        for (const method of methods) {
            try {
                method();
                await this.delay(300);

                if (await this.testTypingCapability()) {
                    console.log('✅ Compose area focused');
                    return true;
                }
            } catch (error) {
                // Continue to next method
            }
        }

        return false;
    }

    // Test typing capability
    async testTypingCapability() {
        try {
            const robot = require('robotjs');
            robot.typeString(' ');
            await this.delay(100);
            robot.keyTap('backspace');
            return true;
        } catch (error) {
            return false;
        }
    }

    // Activate the email window using AppleScript or shell commands
    async activateEmailWindow(windowInfo, clientInfo) {
        console.log(`🎯 Activating window: ${windowInfo.name}`);
        
        try {
            if (process.platform === 'darwin') {
                return await this.activateWindowMacOS(windowInfo, clientInfo);
            } else if (process.platform === 'win32') {
                return await this.activateWindowWindows(windowInfo, clientInfo);
            }
            return false;
        } catch (error) {
            console.error('❌ Window activation failed:', error);
            return false;
        }
    }

    // macOS window activation using AppleScript
    async activateWindowMacOS(windowInfo, clientInfo) {
        const { spawn } = require('child_process');
        
        try {
            // Determine the app name based on window info
            let appName = this.detectAppNameFromWindow(windowInfo.name);

            console.log(`🎯 Activating ${appName} on macOS...`);

            // Use AppleScript to activate the specific app
            const appleScript = `
                tell application "${appName}"
                    activate
                    delay 0.5
                end tell
            `;

            return new Promise((resolve) => {
                const process = spawn('osascript', ['-e', appleScript]);
                
                process.on('close', (code) => {
                    if (code === 0) {
                        console.log(`✅ ${appName} activated successfully`);
                        resolve(true);
                    } else {
                        console.log(`⚠️ Failed to activate ${appName}, code: ${code}`);
                        resolve(false);
                    }
                });

                process.on('error', (error) => {
                    console.log(`⚠️ AppleScript error: ${error.message}`);
                    resolve(false);
                });

                // Timeout after 3 seconds
                setTimeout(() => {
                    process.kill();
                    console.log('⚠️ AppleScript timeout');
                    resolve(false);
                }, 3000);
            });

        } catch (error) {
            console.error('❌ macOS window activation error:', error);
            return false;
        }
    }

    // Detect app name from window title for macOS activation
    detectAppNameFromWindow(windowName) {
        const name = windowName.toLowerCase();

        // Web Browsers
        if (name.includes('chrome')) return 'Google Chrome';
        if (name.includes('safari')) return 'Safari';
        if (name.includes('firefox')) return 'Firefox';
        if (name.includes('edge')) return 'Microsoft Edge';
        if (name.includes('opera')) return 'Opera';
        if (name.includes('brave')) return 'Brave Browser';
        if (name.includes('vivaldi')) return 'Vivaldi';
        if (name.includes('arc')) return 'Arc';

        // Native Email Apps
        if (name.includes('outlook') && !name.includes('.com')) return 'Microsoft Outlook';
        if (name.includes('thunderbird')) return 'Thunderbird';
        if (name.includes('mail') && !name.includes('gmail') && !name.includes('.com')) return 'Mail';
        if (name.includes('spark')) return 'Spark – Email App by Readdle';
        if (name.includes('airmail')) return 'Airmail 5';
        if (name.includes('mailmate')) return 'MailMate';
        if (name.includes('canary')) return 'Canary Mail';
        if (name.includes('mimestream')) return 'MimeStream';

        // Default fallback based on common patterns
        if (name.includes('gmail') || name.includes('yahoo') || name.includes('outlook.com') || 
            name.includes('protonmail') || name.includes('icloud.com')) {
            return 'Safari'; // Default to Safari for webmail
        }

        return 'Safari'; // Ultimate fallback
    }

    // Windows window activation using PowerShell and Win32 APIs
    async activateWindowWindows(windowInfo, clientInfo) {
        console.log('🎯 Activating window on Windows...');
        const { spawn } = require('child_process');
        
        try {
            // Try to use PowerShell to activate the window
            const windowTitle = windowInfo.name;
            const powershellScript = `
                Add-Type -TypeDefinition '
                    using System;
                    using System.Diagnostics;
                    using System.Runtime.InteropServices;
                    public class WindowActivator {
                        [DllImport("user32.dll")]
                        public static extern bool SetForegroundWindow(IntPtr hWnd);
                        [DllImport("user32.dll")]
                        public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
                        [DllImport("user32.dll")]
                        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
                    }
                ';
                
                $processes = Get-Process | Where-Object { $_.MainWindowTitle -like "*${windowTitle.split(' - ')[0]}*" }
                foreach ($process in $processes) {
                    if ($process.MainWindowHandle -ne [System.IntPtr]::Zero) {
                        [WindowActivator]::ShowWindow($process.MainWindowHandle, 9)
                        [WindowActivator]::SetForegroundWindow($process.MainWindowHandle)
                        Write-Output "Window activated"
                        break
                    }
                }
            `;

            return new Promise((resolve) => {
                const process = spawn('powershell', ['-Command', powershellScript], { 
                    windowsHide: true 
                });
                
                let output = '';
                process.stdout.on('data', (data) => {
                    output += data.toString();
                });

                process.on('close', (code) => {
                    if (code === 0 && output.includes('Window activated')) {
                        console.log('✅ Windows window activated successfully');
                        resolve(true);
                    } else {
                        console.log('⚠️ PowerShell activation failed, trying Alt+Tab fallback');
                        // Fallback to Alt+Tab
                        this.activateWindowWindowsFallback();
                        resolve(false);
                    }
                });

                process.on('error', (error) => {
                    console.log(`⚠️ PowerShell error: ${error.message}`);
                    this.activateWindowWindowsFallback();
                    resolve(false);
                });

                // Timeout after 5 seconds
                setTimeout(() => {
                    process.kill();
                    console.log('⚠️ PowerShell timeout');
                    this.activateWindowWindowsFallback();
                    resolve(false);
                }, 5000);
            });

        } catch (error) {
            console.error('❌ Windows window activation error:', error);
            this.activateWindowWindowsFallback();
            return false;
        }
    }

    // Windows fallback activation using Alt+Tab
    async activateWindowWindowsFallback() {
        console.log('🎯 Using Alt+Tab fallback for Windows');
        const robot = require('robotjs');
        try {
            // Try Alt+Tab a few times to cycle through windows
            for (let i = 0; i < 3; i++) {
                robot.keyTap('tab', 'alt');
                await this.delay(500);
            }
            return true;
        } catch (error) {
            console.error('❌ Alt+Tab fallback failed:', error);
            return false;
        }
    }
}

// Singleton instance
const emailReplyManager = new EmailReplyManager();

module.exports = emailReplyManager;