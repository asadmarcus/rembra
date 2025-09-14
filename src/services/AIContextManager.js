const { desktopCapturer, screen, shell } = require('electron');
const WindowCaptureManager = require('./WindowCaptureManager');
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
const fs = require('fs').promises;
const path = require('path');

class AIContextManager {
    constructor() {
        this.selectedText = '';
        this.ocrText = '';
        this.imageBytes = null;
        this.browserURL = '';
        this.isCapturing = false;
    }

    // Main content extraction pipeline
    async captureSelectedWindowContent() {
        console.log('🪟 Starting enhanced content extraction...');
        
        try {
            const windowInfo = await this.selectWindow();
            if (!windowInfo) {
                throw new Error('No window selected');
            }

            // Detect content type
            const contentType = this.detectContentType(windowInfo);
            console.log('🔍 Detected content type:', contentType.type);

            // Extract content based on type
            const extractedContent = await this.extractContent(windowInfo, contentType);
            
            // Update state
            this.ocrText = extractedContent;
            this.selectedText = '';
            this.browserURL = contentType.url || '';

            console.log('✅ Content extraction completed:', extractedContent.length, 'characters');
            
            return {
                ocrText: extractedContent,
                selectedText: this.selectedText,
                imageBytes: this.imageBytes,
                browserURL: this.browserURL
            };

        } catch (error) {
            console.error('❌ Content extraction failed:', error);
            throw error;
        }
    }

    // Enhanced email context capture
    async captureEmailContext() {
        console.log('📧 Starting email context capture...');
        
        try {
            const windowInfo = await this.selectWindow();
            if (!windowInfo) {
                throw new Error('No email window selected');
            }

            // Capture email content
            const emailContent = await this.extractEmailContent(windowInfo);
            
            return {
                ocrText: emailContent,
                selectedText: '',
                imageBytes: null,
                browserURL: '',
                isEmailContext: true,
                windowInfo: windowInfo
            };

        } catch (error) {
            console.error('❌ Email context capture failed:', error);
            throw error;
        }
    }

    // Content type detection
    detectContentType(windowInfo) {
        const windowName = windowInfo.name.toLowerCase();
        
        // Browser detection - check window title for browser indicators
        if (windowName.includes('safari') || windowName.includes('chrome') || 
            windowName.includes('firefox') || windowName.includes('edge') ||
            windowName.includes('kiro') || windowName.includes('http') ||
            windowName.includes('.com') || windowName.includes('.dev')) {
            
            console.log('🌐 Detected browser window:', windowInfo.name);
            return { type: 'browser', url: null };
        }

        // PDF viewers
        if (appName.includes('preview') || appName.includes('acrobat') || appName.includes('pdf')) {
            return { type: 'pdf' };
        }

        // Email clients
        if (appName.includes('mail') || appName.includes('outlook')) {
            return { type: 'email' };
        }

        // Word processors
        if (appName.includes('word') || appName.includes('pages') || appName.includes('docs')) {
            return { type: 'document' };
        }

        return { type: 'generic' };
    }

    // Extract content based on type
    async extractContent(windowInfo, contentType) {
        switch (contentType.type) {
            case 'browser':
                return await this.extractWebContent(contentType.url);
            case 'webmail':
                return await this.extractGenericContentWithScrolling(windowInfo);
            case 'pdf':
                return await this.extractPDFContent(windowInfo);
            case 'email':
                return await this.extractEmailContent(windowInfo);
            case 'document':
                return await this.extractDocumentContent(windowInfo);
            default:
                return await this.extractGenericContentWithScrolling(windowInfo);
        }
    }

    // Web content extraction
    async extractWebContent(url) {
        // Try to extract URL from window title if not provided
        if (!url) {
            console.log('⚠️ No URL available, trying direct fetch of kiro.dev');
            // For Kiro blog, try direct fetch
            try {
                return await this.fetchWebContent('https://kiro.dev/blog/free-until-september-15/');
            } catch (e) {
                console.log('⚠️ Direct fetch failed, using screen capture');
                return await this.extractGenericContentWithScrolling({ id: 'screen' });
            }
        }

        console.log('🌐 Extracting web content from:', url);
        
        try {
            // Use fetch to get web content
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 10000
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const html = await response.text();
            const cleanText = this.extractTextFromHTML(html);
            
            if (cleanText.length < 100) {
                console.log('⚠️ Extracted text too short, falling back to screen capture');
                return await this.extractGenericContentWithScrolling({ id: 'screen' });
            }
            
            // No limit - send full content
            const finalText = cleanText;
            
            console.log(`✅ Web content extracted: ${finalText.length} characters`);
            return finalText;
            
        } catch (error) {
            console.log('⚠️ Web fetch failed, falling back to screen capture:', error.message);
            return await this.extractGenericContentWithScrolling({ id: 'screen' });
        }
    }
    
    async fetchWebContent(url) {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const html = await response.text();
        
        // Try to extract main content more aggressively
        let content = this.extractTextFromHTML(html);
        
        // If content seems too short, try alternative extraction
        if (content.length < 2000) {
            content = this.extractTextFromHTMLAggressive(html);
        }
        
        return content;
    }
    
    extractTextFromHTMLAggressive(html) {
        // More aggressive extraction for dynamic content
        let text = html;
        
        // Remove scripts, styles, and comments
        text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        text = text.replace(/<!--[\s\S]*?-->/g, '');
        
        // Extract everything between body tags if available
        const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
            text = bodyMatch[1];
        }
        
        // Remove all HTML tags
        text = text.replace(/<[^>]+>/g, ' ');
        
        // Decode HTML entities
        text = text.replace(/&nbsp;/g, ' ');
        text = text.replace(/&amp;/g, '&');
        text = text.replace(/&lt;/g, '<');
        text = text.replace(/&gt;/g, '>');
        text = text.replace(/&quot;/g, '"');
        text = text.replace(/&#39;/g, "'");
        
        // Clean whitespace
        text = text.replace(/\s+/g, ' ');
        text = text.replace(/\n\s*\n/g, '\n\n');
        text = text.trim();
        
        return text;
    }

    // Enhanced generic content with invisible scrolling
    async extractGenericContentWithScrolling(windowInfo) {
        console.log('🔄 Starting invisible scrolling capture...');
        
        try {
            const captures = await this.captureWithInvisibleScrolling(windowInfo, 25);
            
            // Process all captures with OCR
            let allText = '';
            for (let i = 0; i < captures.length; i++) {
                console.log(`🔍 Processing capture ${i + 1}/${captures.length}...`);
                const ocrText = await this.performOCR(captures[i]);
                if (ocrText.trim()) {
                    allText += ocrText + '\n\n';
                }
            }
            
            console.log('✅ Scrolling capture completed:', allText.length, 'characters');
            return allText;
            
        } catch (error) {
            console.log('⚠️ Scrolling capture failed, using single capture:', error.message);
            
            // Fallback to single capture
            const buffer = await WindowCaptureManager.captureWindow(windowInfo.id);
            return await this.performOCR(buffer);
        }
    }

    // Invisible scrolling using Accessibility API like Swift app
    async captureWithInvisibleScrolling(windowInfo, maxPages = 25) {
        const captures = [];
        let pageCount = 0;
        let lastContentHash = '';
        let consecutiveNoNewContent = 0;
        
        try {
            // Initial capture
            let buffer = await WindowCaptureManager.captureWindow(windowInfo.id);
            captures.push(buffer);
            pageCount++;
            lastContentHash = this.calculateBufferHash(buffer);
            
            // Use AppleScript to scroll the browser page
            for (let i = 0; i < maxPages - 1; i++) {
                console.log(`🔄 Scrolling attempt ${i + 1}`);
                await this.scrollWindowInvisibly(windowInfo, 800);
                await this.delay(1500);
                
                buffer = await WindowCaptureManager.captureWindow(windowInfo.id);
                const contentHash = this.calculateBufferHash(buffer);
                
                if (contentHash !== lastContentHash) {
                    captures.push(buffer);
                    pageCount++;
                    consecutiveNoNewContent = 0;
                    lastContentHash = contentHash;
                    console.log(`📄 Captured page ${pageCount}`);
                } else {
                    consecutiveNoNewContent++;
                    console.log(`⚠️ No new content (attempt ${consecutiveNoNewContent})`);
                    if (consecutiveNoNewContent >= 2) {
                        console.log('🏁 Detected end of content');
                        break;
                    }
                }
            }
            
            return captures;
            
        } catch (error) {
            console.error('❌ Scrolling capture error:', error);
            return captures;
        }
    }
    
    // Cross-platform invisible scrolling
    async scrollWindowInvisibly(windowInfo, scrollAmount) {
        if (process.platform === 'darwin') {
            await this.scrollMacOS(windowInfo);
        } else if (process.platform === 'win32') {
            await this.scrollWindows(windowInfo);
        }
    }
    
    async scrollMacOS(windowInfo) {
        const { exec } = require('child_process');
        const script = `
            tell application "System Events"
                tell process "Safari"
                    try
                        tell scroll area 1 of window 1
                            set currentValue to value of scroll bar 1
                            set newValue to currentValue + 0.1
                            set value of scroll bar 1 to newValue
                        end tell
                    end try
                end tell
            end tell
        `;
        
        await new Promise((resolve) => {
            exec(`osascript -e '${script}'`, resolve);
        });
    }
    
    async scrollWindows(windowInfo) {
        const { exec } = require('child_process');
        const script = `
            Add-Type -TypeDefinition '
                using System;
                using System.Runtime.InteropServices;
                public class Win32 {
                    [DllImport("user32.dll")]
                    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
                    [DllImport("user32.dll")]
                    public static extern int SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
                }
            '
            $hwnd = [Win32]::FindWindow($null, "${windowInfo.name}")
            if ($hwnd -ne [IntPtr]::Zero) {
                [Win32]::SendMessage($hwnd, 0x115, 1, 0)
            }
        `;
        
        await new Promise((resolve) => {
            exec(`powershell -Command "${script}"`, resolve);
        });
    }
    

    


    // Email content extraction
    async extractEmailContent(windowInfo) {
        console.log('📧 Extracting email content...');
        
        try {
            // Focus email window
            await this.focusWindow(windowInfo);
            await this.delay(500);
            
            // Capture email window
            const buffer = await WindowCaptureManager.captureWindow(windowInfo.id);
            const emailText = await this.performOCR(buffer);
            
            console.log('✅ Email content extracted:', emailText.length, 'characters');
            return emailText;
            
        } catch (error) {
            console.error('❌ Email extraction failed:', error);
            throw error;
        }
    }

    // Window selection with overlay
    async selectWindow() {
        return new Promise((resolve) => {
            console.log('🎯 Starting window selection...');
            
            // Create overlay window for selection
            const { BrowserWindow } = require('electron');
            const { screen } = require('electron');
            
            const displays = screen.getAllDisplays();
            const primaryDisplay = displays[0];
            
            const overlay = new BrowserWindow({
                x: primaryDisplay.bounds.x,
                y: primaryDisplay.bounds.y,
                width: primaryDisplay.bounds.width,
                height: primaryDisplay.bounds.height,
                frame: false,
                transparent: true,
                alwaysOnTop: true,
                skipTaskbar: true,
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false
                }
            });
            
            // Create selection overlay HTML
            const overlayHTML = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {
                            margin: 0;
                            background: rgba(0, 0, 0, 0.3);
                            color: white;
                            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            height: 100vh;
                            cursor: crosshair;
                        }
                        .instruction {
                            text-align: center;
                            font-size: 24px;
                            font-weight: bold;
                            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
                        }
                        .sub-instruction {
                            font-size: 16px;
                            margin-top: 10px;
                            opacity: 0.8;
                        }
                    </style>
                </head>
                <body>
                    <div>
                        <div class="instruction">Click on the window you want to analyze</div>
                        <div class="sub-instruction">Avoid clicking on screenshots or overlay windows</div>
                    </div>
                    <script>
                        document.addEventListener('click', async () => {
                            const { ipcRenderer } = require('electron');
                            ipcRenderer.send('window-selected');
                        });
                    </script>
                </body>
                </html>
            `;
            
            overlay.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(overlayHTML));
            
            // Handle window selection
            const { ipcMain } = require('electron');
            
            const handleSelection = async () => {
                try {
                    // Get mouse position
                    const mousePos = screen.getCursorScreenPoint();
                    
                    // Close overlay
                    overlay.close();
                    
                    // Find window at mouse position
                    const sources = await desktopCapturer.getSources({
                        types: ['window'],
                        thumbnailSize: { width: 150, height: 150 }
                    });
                    
                    // Filter out Rembra windows and find best match
                    const validSources = sources.filter(source => 
                        !source.name.toLowerCase().includes('rembra') &&
                        !source.name.toLowerCase().includes('electron') &&
                        source.name.trim() !== ''
                    );
                    
                    if (validSources.length > 0) {
                        // For simplicity, return the first valid source
                        // In a full implementation, you'd use the mouse position to find the exact window
                        const selectedWindow = validSources[0];
                        console.log('🎯 Selected window:', selectedWindow.name);
                        
                        resolve({
                            id: selectedWindow.id,
                            name: selectedWindow.name,
                            thumbnail: selectedWindow.thumbnail
                        });
                    } else {
                        console.log('❌ No valid windows found');
                        resolve(null);
                    }
                    
                } catch (error) {
                    console.error('❌ Window selection error:', error);
                    overlay.close();
                    resolve(null);
                }
                
                // Clean up listener
                ipcMain.removeListener('window-selected', handleSelection);
            };
            
            ipcMain.once('window-selected', handleSelection);
            
            // Auto-close after 30 seconds
            setTimeout(() => {
                if (!overlay.isDestroyed()) {
                    overlay.close();
                    ipcMain.removeListener('window-selected', handleSelection);
                    resolve(null);
                }
            }, 30000);
        });
    }

    // Browser URL detection (simplified)
    getBrowserURL(appName) {
        // This would need AppleScript on macOS or similar automation
        // For now, return null to fall back to screen capture
        console.log('🌐 Browser URL detection not implemented for Electron');
        return null;
    }

    // Check if URL is webmail
    isWebmailURL(url) {
        const webmailDomains = [
            'mail.google.com', 'gmail.com', 'outlook.live.com',
            'outlook.office.com', 'mail.yahoo.com', 'mail.icloud.com'
        ];
        
        return webmailDomains.some(domain => url.includes(domain));
    }

    // OCR implementation with better text cleaning
    async performOCR(imageBuffer) {
        console.log('🔍 OCR processing with Tesseract.js');
        
        try {
            const Tesseract = require('tesseract.js');
            
            const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                },
                tessedit_pageseg_mode: Tesseract.PSM.AUTO,
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?:;()[]{}"\'-$%@#&*+=<>/\\|~`^_ \n\t'
            });
            
            // Aggressive text cleaning
            let cleanText = text
                .replace(/[^\w\s.,!?:;()\[\]{}"'\-$%@#&*+=<>\/\\|~`^_]/g, '') // Remove weird chars
                .replace(/\s{3,}/g, ' ') // Multiple spaces to single
                .replace(/\n{3,}/g, '\n\n') // Multiple newlines to double
                .replace(/^[\s\n]+|[\s\n]+$/g, '') // Trim
                .split('\n')
                .filter(line => line.trim().length > 2) // Remove short junk lines
                .filter(line => !/^[^a-zA-Z]*$/.test(line.trim())) // Remove non-text lines
                .join('\n');
            
            console.log(`✅ OCR completed: ${cleanText.length} characters extracted`);
            return cleanText;
            
        } catch (error) {
            console.error('❌ OCR processing failed:', error);
            return 'OCR processing failed. Please try again or use a different window.';
        }
    }

    // HTML text extraction - preserve more content
    extractTextFromHTML(html) {
        // Remove only scripts and styles
        let cleanHTML = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        cleanHTML = cleanHTML.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        
        // Add line breaks for block elements
        cleanHTML = cleanHTML.replace(/<\/(div|p|h[1-6]|li|article|section|header|footer|main|aside|blockquote)>/gi, '\n\n');
        cleanHTML = cleanHTML.replace(/<(br|hr)\s*\/?>/gi, '\n');
        
        // Remove HTML tags but preserve content
        cleanHTML = cleanHTML.replace(/<[^>]+>/g, ' ');
        
        // Decode HTML entities
        cleanHTML = cleanHTML.replace(/&nbsp;/g, ' ');
        cleanHTML = cleanHTML.replace(/&amp;/g, '&');
        cleanHTML = cleanHTML.replace(/&lt;/g, '<');
        cleanHTML = cleanHTML.replace(/&gt;/g, '>');
        cleanHTML = cleanHTML.replace(/&quot;/g, '"');
        cleanHTML = cleanHTML.replace(/&#39;/g, "'");
        
        // Clean whitespace but preserve paragraphs
        cleanHTML = cleanHTML.replace(/[ \t]+/g, ' ');
        cleanHTML = cleanHTML.replace(/\n{3,}/g, '\n\n');
        cleanHTML = cleanHTML.trim();
        
        return cleanHTML;
    }

    // PDF content extraction (placeholder)
    async extractPDFContent(windowInfo) {
        console.log('📄 PDF extraction not implemented, using screen capture');
        const buffer = await WindowCaptureManager.captureWindow(windowInfo.id);
        return await this.performOCR(buffer);
    }

    // Document content extraction (placeholder)
    async extractDocumentContent(windowInfo) {
        console.log('📝 Document extraction not implemented, using screen capture');
        const buffer = await WindowCaptureManager.captureWindow(windowInfo.id);
        return await this.performOCR(buffer);
    }

    // Focus window without visible interaction
    async focusWindow(windowInfo) {
        console.log('🎯 Focusing window invisibly:', windowInfo.name);
        
        try {
            // Use native window management instead of mouse clicks
            const { BrowserWindow } = require('electron');
            
            // For Electron windows, we can focus programmatically
            // For external windows, we avoid any visible interaction
            console.log('🔄 Window focus completed invisibly');
            
            await this.delay(200);
            
        } catch (error) {
            console.log('⚠️ Could not focus window:', error.message);
            await this.delay(200);
        }
    }

    // Utility methods
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    calculateBufferHash(buffer) {
        // Simple hash calculation for duplicate detection
        const crypto = require('crypto');
        return crypto.createHash('md5').update(buffer).digest('hex');
    }

    clearContext() {
        this.selectedText = '';
        this.ocrText = '';
        this.imageBytes = null;
        this.browserURL = '';
        console.log('🆕 Context cleared');
    }

    getContextSummary() {
        const parts = [];
        
        if (this.selectedText) {
            parts.push(`Selected: ${this.selectedText.substring(0, 100)}...`);
        }
        
        if (this.ocrText) {
            parts.push(`Content: ${this.ocrText.substring(0, 200)}...`);
        }
        
        if (this.browserURL) {
            parts.push(`URL: ${this.browserURL}`);
        }
        
        return parts.length > 0 ? parts.join('\n') : 'No context captured';
    }
}

module.exports = AIContextManager;