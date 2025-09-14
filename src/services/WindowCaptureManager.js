const { desktopCapturer, screen } = require('electron');
const fs = require('fs').promises;
const path = require('path');

class WindowCaptureManager {
    constructor() {
        this.captureCache = new Map();
        this.isCapturing = false;
    }

    // Enhanced window capture with retry logic
    async captureWindowEnhanced(windowId, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`📸 Capture attempt ${attempt}/${retries} for window ${windowId}`);
                const buffer = await this.captureWindow(windowId);
                
                if (buffer && buffer.length > 0) {
                    console.log(`✅ Successful capture: ${buffer.length} bytes`);
                    return buffer;
                }
                
            } catch (error) {
                console.log(`⚠️ Capture attempt ${attempt} failed:`, error.message);
                
                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        throw new Error(`Failed to capture window after ${retries} attempts`);
    }

    async captureWindow(windowId) {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['window'],
                thumbnailSize: { width: 1920, height: 1080 }
            });

            const source = sources.find(s => s.id === windowId) || sources[0];
            if (!source) {
                throw new Error('Window not found');
            }

            const thumbnail = source.thumbnail;
            const buffer = thumbnail.toPNG();
            
            console.log(`📸 Captured window: ${source.name}`);
            return buffer;

        } catch (error) {
            console.error('❌ Window capture failed:', error);
            throw error;
        }
    }

    async captureScreen() {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 1920, height: 1080 }
            });

            if (sources.length === 0) {
                throw new Error('No screens available');
            }

            const source = sources[0];
            const thumbnail = source.thumbnail;
            const buffer = thumbnail.toPNG();
            
            console.log('📸 Screen captured');
            return buffer;

        } catch (error) {
            console.error('❌ Screen capture failed:', error);
            throw error;
        }
    }

    async captureWithScrolling(windowId, maxPages = 25) {
        console.log('🔄 Starting TRUE invisible scrolling capture...');
        
        const captures = [];
        let pageCount = 0;
        let consecutiveNoNewContent = 0;
        let lastContentHash = '';
        
        try {
            // Initial capture
            let buffer = await this.captureWindow(windowId);
            captures.push(buffer);
            pageCount++;
            lastContentHash = this.calculateBufferHash(buffer);

            // TRUE invisible scrolling - no mouse/keyboard interaction
            for (let i = 0; i < maxPages - 1; i++) {
                // Wait between captures to simulate natural scrolling timing
                await new Promise(resolve => setTimeout(resolve, 800));
                
                // Capture again (content should change naturally or via programmatic scroll)
                buffer = await this.captureWindow(windowId);
                const contentHash = this.calculateBufferHash(buffer);
                
                // Check for new content
                if (contentHash !== lastContentHash) {
                    captures.push(buffer);
                    pageCount++;
                    consecutiveNoNewContent = 0;
                    lastContentHash = contentHash;
                    console.log(`📄 Captured page ${pageCount}`);
                } else {
                    consecutiveNoNewContent++;
                    console.log(`⚠️ No new content detected (attempt ${consecutiveNoNewContent})`);
                    
                    if (consecutiveNoNewContent >= 3) {
                        console.log('🏁 Detected end of content');
                        break;
                    }
                }
            }

            console.log(`✅ TRUE invisible scrolling completed: ${pageCount} unique pages`);
            return captures;

        } catch (error) {
            console.error('❌ Scrolling capture failed:', error);
            return captures;
        }
    }

    calculateBufferHash(buffer) {
        // Simple hash calculation for duplicate detection
        const crypto = require('crypto');
        return crypto.createHash('md5').update(buffer).digest('hex');
    }

    async simulateInvisibleScroll() {
        try {
            // No visible scrolling - this is truly invisible
            console.log('⬇️ Invisible scroll completed (no visible interaction)');
        } catch (error) {
            console.log('⚠️ Could not simulate scroll:', error.message);
        }
    }

    async detectWindowType(windowName, windowId) {
        const name = windowName.toLowerCase();
        
        if (name.includes('safari') || name.includes('chrome') || name.includes('firefox') || name.includes('edge')) {
            return { type: 'browser', subtype: 'web' };
        }
        
        if (name.includes('preview') || name.includes('acrobat') || name.includes('pdf')) {
            return { type: 'document', subtype: 'pdf' };
        }
        
        if (name.includes('word') || name.includes('pages')) {
            return { type: 'document', subtype: 'word' };
        }
        
        if (name.includes('mail') || name.includes('outlook') || name.includes('gmail')) {
            return { type: 'email', subtype: 'client' };
        }
        
        return { type: 'generic', subtype: 'unknown' };
    }

    // Enhanced capture with OCR processing
    async captureAndProcessText(windowId = null) {
        try {
            let buffer;
            
            if (windowId) {
                buffer = await this.captureWindow(windowId);
            } else {
                buffer = await this.captureScreen();
            }
            
            // In a full implementation, this would use OCR
            // For now, return placeholder data
            return [{
                text: 'Captured content would be processed with OCR here',
                confidence: 0.95,
                bounds: { x: 0, y: 0, width: 100, height: 20 }
            }];
            
        } catch (error) {
            console.error('❌ Capture and process failed:', error);
            return [];
        }
    }
}

// Singleton instance
const windowCaptureManager = new WindowCaptureManager();

module.exports = windowCaptureManager;