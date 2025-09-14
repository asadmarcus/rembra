const WebSocket = require('ws');
const EventEmitter = require('events');

class AIConnectionManager extends EventEmitter {
    constructor() {
        super();
        // Increase max listeners to prevent warnings
        this.setMaxListeners(20);
        this.ws = null;
        this.isConnected = false;
        this.isReceiving = false;
        this.responseCompleted = false;
        this.messageHistory = [];
        this.lastMessages = [];
        this.messageStream = '';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.shouldMaintainConnection = true;
        this.responseTimeout = null;
        this.responseTimeoutDuration = 45000; // 45 seconds

        // Connection URL
        this.connectionURL = 'wss://itzerhypergalaxy.online/horizon/assist/chat-ws';

        // Auto-connect
        this.connect();
    }

    // Cleanup method to remove all listeners
    cleanup() {
        this.removeAllListeners();
        this.disconnect();
    }

    async connect() {
        if (this.ws || !this.shouldMaintainConnection) return;

        try {
            console.log('🔗 Connecting to AI service...');
            this.ws = new WebSocket(this.connectionURL);

            this.ws.on('open', () => {
                console.log('✅ Connected to AI service');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
                this.emit('connected');
            });

            this.ws.on('message', (data) => {
                this.handleMessage(data);
            });

            this.ws.on('close', (code, reason) => {
                console.log(`🔌 Connection closed: ${code} - ${reason}`);
                this.isConnected = false;
                this.emit('disconnected');

                if (this.shouldMaintainConnection) {
                    this.scheduleReconnect();
                }
            });

            this.ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error);
                this.isConnected = false;
                this.emit('error', error);
            });

        } catch (error) {
            console.error('❌ Connection failed:', error);
            if (this.shouldMaintainConnection) {
                this.scheduleReconnect();
            }
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('❌ Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);

        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            this.ws = null;
            this.connect();
        }, delay);
    }

    handleMessage(data) {
        try {
            const text = data.toString();

            if (!this.isReceiving && this.messageStream === '') {
                this.isReceiving = true;
                this.responseCompleted = false;
                console.log('🤖 Starting to receive AI response...');
            }

            this.messageStream += text;
            console.log('📥 Received chunk:', text.length, 'chars');

            // Update or create message in lastMessages
            if (this.lastMessages.length > 0 && !this.lastMessages[this.lastMessages.length - 1].isUser) {
                this.lastMessages[this.lastMessages.length - 1].message = this.messageStream;
            } else {
                this.lastMessages.push({
                    message: this.messageStream,
                    isUser: false,
                    timestamp: Date.now()
                });
            }

            this.emit('messageUpdate', this.lastMessages);

            // Check for completion - more flexible detection
            const isComplete = text.includes('</response>') ||
                text.includes('COMPLETE') ||
                text.endsWith('\n\n') ||
                text.includes('###END###') ||
                (this.messageStream.length > 100 && text.trim() === '') ||
                text.includes('[END]');

            if (isComplete) {
                console.log('🏁 AI response completed, total length:', this.messageStream.length);
                this.isReceiving = false;
                this.responseCompleted = true;
                this.clearResponseTimeout();

                // Add to history
                if (this.messageStream.trim()) {
                    this.messageHistory.push({
                        role: 'assistant',
                        content: this.messageStream
                    });
                }

                console.log('📤 Emitting responseComplete event');
                this.emit('responseComplete');
                this.messageStream = '';
            }

        } catch (error) {
            console.error('❌ Error handling message:', error);
            this.isReceiving = false;
            this.responseCompleted = true;
        }
    }

    async sendMessage(text, contextData = null) {
        if (!this.isConnected) {
            if (this.shouldMaintainConnection) {
                await this.connect();
                // Wait a moment for connection
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            if (!this.isConnected) {
                throw new Error('Not connected to AI service');
            }
        }

        // Reset states
        this.responseCompleted = false;
        this.isReceiving = false;
        this.messageStream = '';

        // This is now handled above with enhanced text

        // Add specialized instructions for blog analysis
        let enhancedText = text;
        if (text.toLowerCase().includes('analyze this blog') || text.toLowerCase().includes('blog analysis')) {
            enhancedText = text + `

Provide an in-depth, comprehensive blog analysis with detailed insights:

# 📖 Blog Analysis: [Extract actual blog title]

## 🎯 Key Insights & Takeaways
- Provide 5-7 detailed, specific insights from the content
- Include quantitative details (dates, numbers, percentages) when mentioned
- Focus on business implications and strategic decisions
- Highlight any unique approaches or methodologies discussed

## 📝 Content Overview
- **Main Topic:** [Detailed description with context]
- **Target Audience:** [Specific user segments and their needs]
- **Content Type:** [Detailed categorization]
- **Key Themes:** [3-4 major themes explored]

## 🔍 Detailed Analysis
### Strategic Context
- Analyze the business/market context behind this content
- Discuss timing and competitive landscape factors
- Examine the strategic rationale for decisions mentioned

### Core Arguments & Evidence
- Break down each major argument with supporting evidence
- Analyze the logical flow and persuasiveness
- Identify any assumptions or unstated premises

### Implementation Details
- Examine specific processes, timelines, or methodologies described
- Analyze the practical aspects of any recommendations
- Discuss potential challenges or limitations

### Strengths & Innovations
- Identify what makes this approach unique or effective
- Highlight innovative solutions or creative problem-solving
- Analyze communication effectiveness and clarity

### Critical Analysis
- Examine potential weaknesses or gaps in reasoning
- Discuss alternative approaches or perspectives
- Identify questions that remain unanswered

## 💡 Strategic Assessment
Provide a nuanced evaluation of:
- Long-term implications and sustainability
- Broader industry relevance and applicability
- Potential risks and mitigation strategies
- Innovation potential and competitive advantages

## 🚀 Actionable Recommendations
- Immediate actions readers should take
- Long-term strategic considerations
- Specific metrics or KPIs to monitor
- Resources for further learning or implementation

Be thorough, analytical, and provide deep insights that go beyond surface-level observations.`;
        }
        
        // Update user message with enhanced text  
        const userMessage = {
            role: 'user',
            content: enhancedText,
            metadata: contextData ? {
                ocrText: contextData.ocrText || null,
                selectedText: contextData.selectedText || null
            } : null
        };

        this.messageHistory.push(userMessage);

        // Create request
        const request = {
            messages: this.messageHistory,
            imageBytes: contextData?.imageBytes || null,
            smarterAnalysisEnabled: false
        };

        console.log('📤 Sending message to AI service...');

        // Start response timeout
        this.startResponseTimeout();

        try {
            this.ws.send(JSON.stringify(request));
        } catch (error) {
            this.clearResponseTimeout();
            this.isReceiving = false;
            this.responseCompleted = true;
            throw error;
        }
    }

    startResponseTimeout() {
        this.clearResponseTimeout();

        this.responseTimeout = setTimeout(() => {
            if (this.isReceiving) {
                console.log('⏰ Response timeout - forcing completion');
                this.isReceiving = false;
                this.responseCompleted = true;

                if (this.messageStream.trim()) {
                    this.messageHistory.push({
                        role: 'assistant',
                        content: this.messageStream
                    });

                    // Update lastMessages with current stream
                    if (this.lastMessages.length > 0 && !this.lastMessages[this.lastMessages.length - 1].isUser) {
                        this.lastMessages[this.lastMessages.length - 1].message = this.messageStream;
                    } else {
                        this.lastMessages.push({
                            message: this.messageStream,
                            isUser: false,
                            timestamp: Date.now()
                        });
                    }
                } else {
                    const timeoutMessage = 'I apologize, but my response timed out. Please try sending your message again.';
                    this.messageHistory.push({
                        role: 'assistant',
                        content: timeoutMessage
                    });

                    if (this.lastMessages.length > 0 && !this.lastMessages[this.lastMessages.length - 1].isUser) {
                        this.lastMessages[this.lastMessages.length - 1].message = timeoutMessage;
                    } else {
                        this.lastMessages.push({
                            message: timeoutMessage,
                            isUser: false,
                            timestamp: Date.now()
                        });
                    }

                    this.emit('messageUpdate', this.lastMessages);
                }

                console.log('📤 Emitting responseComplete from timeout');
                this.emit('responseComplete');
                this.messageStream = '';
            }
        }, this.responseTimeoutDuration);
    }

    clearResponseTimeout() {
        if (this.responseTimeout) {
            clearTimeout(this.responseTimeout);
            this.responseTimeout = null;
        }
    }

    clearConversation() {
        this.messageHistory = [];
        this.lastMessages = [];
        this.messageStream = '';
        this.isReceiving = false;
        this.responseCompleted = true;
        this.clearResponseTimeout();

        console.log('🆕 Conversation cleared');
        this.emit('conversationCleared');
    }

    disconnect() {
        this.shouldMaintainConnection = false;
        this.clearResponseTimeout();

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.isConnected = false;
    }

    getConnectionStatus() {
        return {
            connected: this.isConnected,
            receiving: this.isReceiving,
            messageCount: this.messageHistory.length
        };
    }
}

// Singleton instance to prevent multiple connections and memory leaks
let instance = null;

function getAIConnectionManager() {
    if (!instance) {
        instance = new AIConnectionManager();
    }
    return instance;
}

// Export both the class and singleton getter
module.exports = AIConnectionManager;
module.exports.getInstance = getAIConnectionManager;