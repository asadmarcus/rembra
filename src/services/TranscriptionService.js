const WebSocket = require('ws');
const { EventEmitter } = require('events');

class TranscriptionService extends EventEmitter {
    constructor() {
        super();
        this.ws = null;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioStream = null;
        this.transcript = [];
        this.currentSession = null;
        this.apiKey = null;
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    async startTranscription() {
        if (!this.apiKey) {
            throw new Error('AssemblyAI API key not set');
        }

        try {
            // Always use mixed audio (microphone + system) for meetings
            console.log('🎧 Setting up mixed audio capture for meeting...');
            
            let micStream, systemStream;
            
            // Get microphone stream
            try {
                micStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: 16000,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
                console.log('✅ Microphone stream acquired');
            } catch (error) {
                throw new Error(`Microphone access failed: ${error.message}`);
            }
            
            // Get system audio to capture other participants
            try {
                systemStream = await navigator.mediaDevices.getDisplayMedia({
                    video: false,
                    audio: {
                        sampleRate: 16000,
                        channelCount: 1,
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    }
                });
                
                const audioTracks = systemStream.getAudioTracks();
                if (audioTracks.length > 0) {
                    console.log('✅ System audio captured - can hear other participants');
                    this.audioStream = this.mixAudioStreams(micStream, systemStream);
                } else {
                    throw new Error('No system audio available');
                }
            } catch (error) {
                throw new Error('System audio required to capture other participants. Please allow screen sharing and check "Share System Audio".');
            }

            // Connect to AssemblyAI real-time API
            const wsUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${this.apiKey}`;
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('Connected to AssemblyAI');
                this.emit('connected');
                this.startAudioCapture();
            };

            this.ws.onmessage = (event) => {
                try {
                    const response = JSON.parse(event.data);
                    this.handleTranscriptionResponse(response);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.emit('error', error);
            };

            this.ws.onclose = () => {
                console.log('WebSocket closed');
                this.emit('disconnected');
            };

            // Initialize session
            this.currentSession = {
                id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                startTime: new Date(),
                transcript: [],
                speakers: new Set(),
                isActive: true,
                audioSource: 'mixed'
            };

            this.isRecording = true;
            this.emit('started', this.currentSession.id);

        } catch (error) {
            console.error('Failed to start transcription:', error);
            throw error;
        }
    }

    startAudioCapture() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const source = audioContext.createMediaStreamSource(this.audioStream);
        const processor = audioContext.createScriptProcessor(1024, 1, 1);

        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (event) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                const inputData = event.inputBuffer.getChannelData(0);
                const pcm16 = this.convertToPCM16(inputData);
                this.ws.send(pcm16);
            }
        };

        this.audioProcessor = processor;
        this.audioContext = audioContext;
    }

    convertToPCM16(float32Array) {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);

        for (let i = 0; i < float32Array.length; i++) {
            const sample = Math.max(-1, Math.min(1, float32Array[i]));
            const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(i * 2, intSample, true);
        }

        return buffer;
    }

    handleTranscriptionResponse(response) {
        if (response.message_type === 'PartialTranscript') {
            this.emit('partial', {
                text: response.text || '',
                confidence: response.confidence || 0,
                speaker: 'Speaker A'
            });
        } else if (response.message_type === 'FinalTranscript') {
            const finalText = {
                id: `transcript_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                text: response.text || '',
                confidence: response.confidence || 0,
                speaker: 'Speaker A',
                timestamp: new Date(),
                words: response.words || []
            };

            this.transcript.push(finalText);
            this.currentSession.transcript.push(finalText);
            this.currentSession.speakers.add(finalText.speaker);

            this.emit('final', finalText);
        } else if (response.message_type === 'SessionBegins') {
            console.log('Session began:', response.session_id);
        } else if (response.error) {
            this.emit('error', new Error(response.error));
        }
    }

    async stopTranscription() {
        if (!this.isRecording) return null;

        this.isRecording = false;

        // Stop audio capture
        if (this.audioProcessor) {
            this.audioProcessor.disconnect();
            this.audioProcessor = null;
        }
        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        
        // Clean up mixer resources
        if (this.mixerContext) {
            await this.mixerContext.close();
            this.mixerContext = null;
        }
        if (this.mixerSources) {
            this.mixerSources.forEach(source => source.disconnect());
            this.mixerSources = null;
        }
        
        // Stop system audio capture
        if (this.systemAudioCapture) {
            await this.systemAudioCapture.stopCapture();
            this.systemAudioCapture = null;
        }

        // Close WebSocket
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Finalize session
        if (this.currentSession) {
            this.currentSession.endTime = new Date();
            this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;
            this.currentSession.isActive = false;

            // Generate summary with timeout protection
            try {
                console.log('🤖 Generating meeting summary...');
                const summary = await Promise.race([
                    this.generateSummary(this.currentSession.transcript),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Summary generation timeout')), 45000)
                    )
                ]);
                this.currentSession.summary = summary;
                console.log('✅ Meeting summary generated successfully');
            } catch (error) {
                console.error('❌ Summary generation failed:', error);
                this.currentSession.summary = this.generateBasicSummary(this.currentSession.transcript);
            }

            this.emit('stopped', this.currentSession);

            const session = { ...this.currentSession };
            this.currentSession = null;
            this.transcript = [];

            return session;
        }

        return null;
    }

    async generateSummary(transcript) {
        if (!transcript || transcript.length === 0) {
            return 'No transcript available';
        }

        const fullText = transcript.map(t => `${t.speaker}: ${t.text}`).join('\n');
        const speakers = [...new Set(transcript.map(t => t.speaker))];
        const wordCount = transcript.reduce((count, t) => count + t.text.split(' ').length, 0);
        const duration = Math.round(this.currentSession?.duration / 1000 / 60);

        // Try to generate AI summary with improved error handling
        try {
            console.log('🤖 Attempting to generate AI summary...');
            
            // Check if we have enough content for a meaningful summary
            if (wordCount < 50) {
                console.log('⚠️ Transcript too short for AI summary, using basic summary');
                return this.generateBasicSummary(transcript);
            }

            const { getInstance } = require('./AIConnectionManager');
            const aiManager = getInstance();

            const summaryPrompt = `Please analyze this meeting transcript and provide a concise summary including:

**Main Topics Discussed:**
- List the primary subjects covered

**Key Decisions Made:**
- Important decisions or conclusions reached

**Action Items:**
- Tasks or follow-ups identified (if any)

**Important Points:**
- Notable insights or information shared

**Meeting Details:**
- Duration: ${duration} minutes
- Speakers: ${speakers.join(', ')}
- Word count: ${wordCount}

**Transcript:**
${fullText.substring(0, 3000)}${fullText.length > 3000 ? '...' : ''}

Please provide a well-structured summary in markdown format.`;

            // Improved AI connection handling
            const connectionTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('AI connection timeout')), 10000)
            );

            const connectionPromise = new Promise((resolve) => {
                if (aiManager.getConnectionStatus().connected) {
                    resolve();
                } else {
                    aiManager.once('connected', resolve);
                }
            });

            await Promise.race([connectionPromise, connectionTimeout]);

            if (aiManager.getConnectionStatus().connected) {
                console.log('✅ AI connected, generating summary...');
                
                let aiSummary = '';
                let isComplete = false;

                // Enhanced response handling
                const summaryPromise = new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        cleanup();
                        reject(new Error('AI response timeout'));
                    }, 45000);

                    const onUpdate = (messages) => {
                        try {
                            const lastMessage = messages[messages.length - 1];
                            if (lastMessage && !lastMessage.isUser) {
                                aiSummary = lastMessage.message;
                            }
                        } catch (error) {
                            console.error('Error processing AI message update:', error);
                        }
                    };

                    const onComplete = () => {
                        isComplete = true;
                        cleanup();
                        resolve(aiSummary);
                    };

                    const onError = (error) => {
                        cleanup();
                        reject(error);
                    };

                    const cleanup = () => {
                        clearTimeout(timeout);
                        aiManager.off('messageUpdate', onUpdate);
                        aiManager.off('responseComplete', onComplete);
                        aiManager.off('error', onError);
                    };

                    aiManager.on('messageUpdate', onUpdate);
                    aiManager.on('responseComplete', onComplete);
                    aiManager.on('error', onError);
                });

                await aiManager.sendMessage(summaryPrompt);
                const generatedSummary = await summaryPromise;

                if (generatedSummary && generatedSummary.trim() && generatedSummary.length > 50) {
                    console.log('✅ AI summary generated successfully');
                    return `# Meeting Summary\n\n**Duration:** ${duration} minutes | **Speakers:** ${speakers.length} | **Words:** ${wordCount}\n\n${generatedSummary}`;
                } else {
                    console.log('⚠️ AI summary too short or empty, using fallback');
                }
            } else {
                console.log('⚠️ AI not connected, using basic summary');
            }
        } catch (error) {
            console.error('❌ AI summary generation failed:', error.message);
        }

        // Enhanced fallback summary
        return this.generateBasicSummary(transcript);
    }

    extractKeyPoints(transcript) {
        // Extract sentences that might be key points (longer sentences, questions, etc.)
        const keyPoints = [];

        transcript.forEach(t => {
            const sentences = t.text.split(/[.!?]+/).filter(s => s.trim().length > 20);
            sentences.forEach(sentence => {
                const trimmed = sentence.trim();
                if (trimmed.length > 30 && (
                    trimmed.includes('?') ||
                    trimmed.toLowerCase().includes('decision') ||
                    trimmed.toLowerCase().includes('action') ||
                    trimmed.toLowerCase().includes('important') ||
                    trimmed.toLowerCase().includes('need to') ||
                    trimmed.toLowerCase().includes('should') ||
                    trimmed.toLowerCase().includes('will')
                )) {
                    keyPoints.push(`• ${t.speaker}: ${trimmed}`);
                }
            });
        });

        return keyPoints.slice(0, 5).join('\n') || 'No specific key points identified.';
    }

    getCurrentSession() {
        return this.currentSession;
    }

    isActive() {
        return this.isRecording;
    }

    mixAudioStreams(stream1, stream2) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source1 = audioContext.createMediaStreamSource(stream1);
        const source2 = audioContext.createMediaStreamSource(stream2);
        const destination = audioContext.createMediaStreamDestination();
        const gainNode1 = audioContext.createGain();
        const gainNode2 = audioContext.createGain();

        // Set gain levels (adjust as needed)
        gainNode1.gain.value = 0.7; // Microphone
        gainNode2.gain.value = 0.5; // System audio

        source1.connect(gainNode1);
        source2.connect(gainNode2);
        gainNode1.connect(destination);
        gainNode2.connect(destination);

        this.mixerContext = audioContext;
        this.mixerSources = [source1, source2];

        return destination.stream;
    }

    async getAvailableAudioSources() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(device => device.kind === 'audioinput');

            return {
                microphones: audioInputs,
                systemAudio: true, // Available via getDisplayMedia
                mixedAudio: true   // Can mix both sources
            };
        } catch (error) {
            console.error('Error getting audio sources:', error);
            return {
                microphones: [],
                systemAudio: false,
                mixedAudio: false
            };
        }
    }
    generateBasicSummary(transcript) {
        if (!transcript || transcript.length === 0) {
            return 'No transcript available';
        }

        const speakers = [...new Set(transcript.map(t => t.speaker))];
        const wordCount = transcript.reduce((count, t) => count + t.text.split(' ').length, 0);
        const duration = Math.round(this.currentSession?.duration / 1000 / 60);
        const keyPoints = this.extractKeyPoints(transcript);

        return `# Meeting Summary (Basic)

**Meeting Details:**
- Duration: ${duration} minutes
- Speakers: ${speakers.join(', ')} (${speakers.length} total)
- Total words: ${wordCount}
- Audio source: Mixed (Microphone + System Audio)

**Key Points:**
${keyPoints}

**Transcript Preview:**
${transcript.slice(0, 3).map(t => `**${t.speaker}:** ${t.text.substring(0, 100)}${t.text.length > 100 ? '...' : ''}`).join('\n\n')}

*This is an automated basic summary. For detailed analysis, ensure AI services are connected.*`;
    }

    async captureSystemAudioNative() {
        const platform = process.platform;
        console.log(`🎧 Attempting native system audio capture for ${platform}...`);
        
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('capture-system-audio-native', { platform });
            
            if (result && result.success) {
                console.log('✅ Native system audio capture successful');
                return this.createMediaStreamFromNativeAudio(result.audioData);
            } else {
                throw new Error(result.error || 'Native capture failed');
            }
        } catch (error) {
            console.log('⚠️ Native capture not available:', error.message);
            throw error;
        }
    }

    createMediaStreamFromNativeAudio(audioData) {
        console.log('🔄 Converting native audio to MediaStream...');
        
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            const destination = audioContext.createMediaStreamDestination();
            
            if (audioData && audioData.length > 0) {
                // Create buffer from audio data
                const buffer = audioContext.createBuffer(1, audioData.length, 16000);
                const channelData = buffer.getChannelData(0);
                
                // Copy audio data to buffer
                for (let i = 0; i < audioData.length; i++) {
                    channelData[i] = audioData[i];
                }
                
                // Create and configure buffer source
                const bufferSource = audioContext.createBufferSource();
                bufferSource.buffer = buffer;
                bufferSource.loop = true;
                
                const gainNode = audioContext.createGain();
                gainNode.gain.value = 1.0;
                
                // Connect audio graph
                bufferSource.connect(gainNode);
                gainNode.connect(destination);
                
                // Start playback
                bufferSource.start();
            }
            
            return destination.stream;
        } catch (error) {
            console.error('Failed to create MediaStream from native audio:', error);
            return null;
        }
    }
}

module.exports = new TranscriptionService();