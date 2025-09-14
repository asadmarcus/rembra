const { EventEmitter } = require('events');
const { ipcRenderer } = require('electron');

// Try to load AudioMixer, but don't fail if it's not available
let AudioMixer;
try {
  AudioMixer = require('../utils/AudioMixer');
} catch (error) {
  console.warn('AudioMixer not available:', error.message);
  AudioMixer = class { cleanup() { } }; // Fallback
}

class EnhancedTranscriptionService extends EventEmitter {
  constructor() {
    super();
    this.apiKey = null;

    // Multichannel WebSocket connections
    this.microphoneSocket = null;
    this.systemAudioSocket = null;
    this.isConnected = false;
    this.isRecording = false;
    this.sessionId = null;
    this.startTime = null;
    this.transcript = [];
    this.speakers = new Set();

    // Initialize AudioMixer safely
    try {
      this.audioMixer = new AudioMixer();
    } catch (error) {
      console.warn('Failed to initialize AudioMixer:', error.message);
      this.audioMixer = { cleanup: () => { } }; // Fallback
    }

    // Separate audio streams for multichannel
    this.microphoneStream = null;
    this.systemAudioStream = null;
    this.microphoneProcessor = null;
    this.systemAudioProcessor = null;
    this.microphoneContext = null;
    this.systemAudioContext = null;

    this.audioSource = 'multichannel';

    // Channel-specific tracking
    this.microphoneSessionId = null;
    this.systemAudioSessionId = null;

    // Turn detection tracking
    this.currentTurnId = null;
    this.currentTurnSpeaker = null;
    this.turnCount = 0;
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  async startTranscription() {
    if (!this.apiKey) {
      throw new Error('AssemblyAI API key not set');
    }

    try {
      console.log('🎧 Starting enhanced transcription service...');

      // Get microphone stream first
      console.log('🎤 Getting microphone stream...');
      try {
        this.microphoneStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000
          }
        });
        console.log('✅ Microphone stream acquired');
      } catch (micError) {
        throw new Error(`Microphone access failed: ${micError.message}. Please allow microphone access.`);
      }

      // Try to start system audio capture (REQUIRED for meeting platform)
      await this.startSystemAudioCapture();

      // For meeting platform, BOTH audio sources are required
      if (!this.systemAudioStream) {
        throw new Error('Meeting platform requires both microphone AND system audio. System audio capture failed - cannot proceed with meeting transcription.');
      }

      console.log('🎵 Audio mode: Meeting Mode (Microphone + System Audio)');

      // Connect to AssemblyAI
      await this.connectMultichannelToAssemblyAI();

      // Start streaming audio
      this.startMultichannelAudioStreaming();

      this.isRecording = true;
      this.startTime = Date.now();
      this.sessionId = this.generateSessionId();

      console.log('✅ Enhanced transcription started successfully (Meeting Mode: Microphone + System Audio)');
      this.emit('started', this.sessionId);

    } catch (error) {
      console.error('❌ Failed to start transcription:', error);
      await this.cleanup();
      throw error;
    }
  }

  async connectMultichannelToAssemblyAI() {
    console.log('🔗 Connecting to AssemblyAI v3 Streaming API...');

    // Use the correct AssemblyAI v3 streaming API format with proper diarization
    const querystring = require('querystring');
    const params = querystring.stringify({
      sampleRate: 16000,
      formatTurns: true,
      // Enhanced diarization parameters for live conversation
      end_of_turn_confidence_threshold: 0.4,
      min_end_of_turn_silence_when_confident: 560, // Recommended for multi-speaker conversations
      max_turn_silence: 1280,
      // Enable speaker diarization features
      speaker_labels: true,
      speakers_expected: 2  // Can be adjusted based on expected participants
    });
    const wsUrl = `wss://streaming.assemblyai.com/v3/ws?${params}`;

    // Use the built-in WebSocket in renderer process
    const WebSocket = window.WebSocket || require('ws');

    // Create separate connections for each channel
    const microphonePromise = new Promise((resolve, reject) => {
      // For browser WebSocket, we need to handle auth differently since headers aren't supported
      // We'll use Node.js WebSocket for proper header support
      const NodeWebSocket = require('ws');
      this.microphoneSocket = new NodeWebSocket(wsUrl, {
        headers: {
          'Authorization': this.apiKey
        }
      });

      this.microphoneSocket.onopen = () => {
        console.log('✅ Microphone channel connected to AssemblyAI v3');
        resolve();
      };

      this.microphoneSocket.onmessage = (event) => {
        try {
          console.log('📥 Microphone message received:', event.data);
          const data = JSON.parse(event.data);
          this.handleChannelMessage(data, 'microphone');
        } catch (error) {
          console.error('❌ Failed to parse microphone message:', error);
          console.error('❌ Raw message:', event.data);
        }
      };

      this.microphoneSocket.onerror = (error) => {
        console.error('❌ Microphone WebSocket error:', error);
        console.error('❌ Error details:', error.message, error.code);
        reject(error);
      };

      this.microphoneSocket.onclose = (event) => {
        console.log('🔌 Microphone channel disconnected:', event.code, event.reason);
      };
    });

    const systemAudioPromise = new Promise((resolve, reject) => {
      // For meeting platform, system audio is REQUIRED
      if (!this.systemAudioStream) {
        console.error('❌ System audio stream required for meeting platform');
        reject(new Error('System audio stream is required for meeting transcription'));
        return;
      }

      try {
        const NodeWebSocket = require('ws');
        this.systemAudioSocket = new NodeWebSocket(wsUrl, {
          headers: {
            'Authorization': this.apiKey
          }
        });

        this.systemAudioSocket.onopen = () => {
          console.log('✅ System audio channel connected to AssemblyAI v3');
          resolve();
        };

        this.systemAudioSocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleChannelMessage(data, 'system');
          } catch (error) {
            console.error('❌ Failed to parse system audio message:', error);
          }
        };

        this.systemAudioSocket.onerror = (error) => {
          console.error('❌ System audio WebSocket error:', error);
          console.error('❌ System audio error details:', error.message, error.code);
          // For meeting platform, system audio failure is critical
          reject(new Error(`System audio WebSocket connection failed: ${error.message}. Meeting transcription requires both microphone and system audio.`));
        };

        this.systemAudioSocket.onclose = (event) => {
          console.log('🔌 System audio channel disconnected:', event.code, event.reason);
        };
      } catch (error) {
        console.error('❌ Failed to create system audio WebSocket:', error);
        // For meeting platform, system audio failure is critical
        reject(new Error(`System audio WebSocket creation failed: ${error.message}. Meeting platform requires both microphone and system audio.`));
      }
    });

    // Wait for both connections
    await Promise.all([microphonePromise, systemAudioPromise]);

    this.isConnected = true;
    this.emit('connected');
    console.log('✅ All channels connected to AssemblyAI v3 Streaming');
  }

  startMultichannelAudioStreaming() {
    console.log('🎵 Starting multichannel audio streaming...');

    // Start microphone channel streaming
    if (this.microphoneStream && this.microphoneSocket) {
      this.startChannelStreaming(this.microphoneStream, this.microphoneSocket, 'microphone');
    }

    // Start system audio channel streaming
    if (this.systemAudioStream && this.systemAudioSocket) {
      this.startChannelStreaming(this.systemAudioStream, this.systemAudioSocket, 'system');
    }

    console.log('✅ Multichannel audio streaming started');
  }

  startChannelStreaming(stream, socket, channelName) {
    console.log(`🎵 Starting ${channelName} channel streaming...`);

    // Create AudioContext for PCM conversion
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);

    // Create ScriptProcessorNode for real-time PCM data
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      if (socket && socket.readyState === 1) { // WebSocket.OPEN
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);

        // Convert Float32Array to Int16Array (PCM 16-bit)
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          // Clamp and convert to 16-bit PCM
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }

        // Send raw PCM data as ArrayBuffer
        socket.send(pcmData.buffer);
      }
    };

    // Connect the audio processing chain
    source.connect(processor);
    processor.connect(audioContext.destination);

    // Store references for cleanup
    if (channelName === 'microphone') {
      this.microphoneContext = audioContext;
      this.microphoneProcessor = processor;
      this.microphoneSource = source;
    } else {
      this.systemAudioContext = audioContext;
      this.systemAudioProcessor = processor;
      this.systemAudioSource = source;
    }

    console.log(`✅ ${channelName} channel streaming started (PCM 16-bit, 16kHz)`);
  }

  async startSystemAudioCapture() {
    try {
      console.log('🔧 Starting system audio capture via electron-audio-loopback...');

      // Check if electron-audio-loopback is available
      let getLoopbackAudioMediaStream;
      try {
        const loopback = require('electron-audio-loopback');
        getLoopbackAudioMediaStream = loopback.getLoopbackAudioMediaStream;

        if (!getLoopbackAudioMediaStream) {
          throw new Error('getLoopbackAudioMediaStream not available');
        }
      } catch (requireError) {
        console.warn('⚠️ electron-audio-loopback not available:', requireError.message);
        throw new Error('System audio capture not available - electron-audio-loopback missing');
      }

      console.log('🎧 Getting system audio via getLoopbackAudioMediaStream...');
      this.systemAudioStream = await getLoopbackAudioMediaStream({
        removeVideo: true
      });

      if (!this.systemAudioStream || this.systemAudioStream.getAudioTracks().length === 0) {
        throw new Error('No system audio tracks available');
      }

      console.log('✅ System audio capture started successfully');
      console.log('🎵 System audio tracks:', this.systemAudioStream.getAudioTracks().length);

    } catch (error) {
      console.error('❌ System audio capture failed:', error);
      console.error('❌ Error details:', error.message);

      // For meeting platform, system audio is REQUIRED - don't fallback
      throw new Error(`Meeting platform requires system audio capture. ${error.message}. Please ensure screen recording permissions are granted and restart the application.`);
    }
  }

  handleChannelMessage(data, channel) {
    // Handle v3 streaming API message format with proper diarization support
    if (data.type === 'Begin') {
      console.log(`🎬 ${channel} channel session began:`, data.id);
      if (channel === 'microphone') {
        this.microphoneSessionId = data.id;
      } else {
        this.systemAudioSessionId = data.id;
      }
      
      // Use the first session ID as the main session ID
      if (!this.sessionId) {
        this.sessionId = data.id;
      }
    } else if (data.type === 'Turn') {
      const transcript = data.transcript || '';
      const isFormatted = data.turn_is_formatted;
      const endOfTurn = data.end_of_turn || false;
      const turnId = data.turn_id || 'unknown';
      const turnOrder = data.turn_order || 0;
      const words = data.words || [];
      
      // Use AssemblyAI's speaker detection from words array if available
      let detectedSpeaker = this.extractSpeakerFromWords(words) || this.getSpeakerFromChannel(channel, transcript);
      
      if (isFormatted) {
        // Final transcript with proper speaker diarization
        const transcriptData = {
          text: transcript,
          confidence: 0.9,
          speaker: detectedSpeaker,
          timestamp: Date.now(),
          turnId: turnId,
          turnOrder: turnOrder,
          endOfTurn: endOfTurn,
          channel: channel,
          words: words,
          endOfTurnConfidence: data.end_of_turn_confidence || 0
        };

        this.transcript.push(transcriptData);
        this.speakers.add(transcriptData.speaker);
        this.emit('final', transcriptData);
        
        if (endOfTurn) {
          console.log(`🔄 Turn ${turnOrder} ended [${channel}]:`, detectedSpeaker + ':', transcript);
          this.emit('turnEnd', transcriptData);
        } else {
          console.log(`📝 Turn ${turnOrder} final [${channel}]:`, detectedSpeaker + ':', transcript);
        }
      } else {
        // Partial transcript with proper speaker info
        this.emit('partial', {
          text: transcript,
          confidence: 0.7,
          speaker: detectedSpeaker,
          turnId: turnId,
          turnOrder: turnOrder,
          endOfTurn: endOfTurn,
          channel: channel,
          words: words
        });
      }
    } else if (data.type === 'Termination') {
      console.log(`🏁 ${channel} channel session terminated`);
      const audioDuration = data.audio_duration_seconds;
      const sessionDuration = data.session_duration_seconds;
      console.log(`📊 ${channel} stats: Audio=${audioDuration}s, Session=${sessionDuration}s`);
      this.emit('disconnected');
    } else if (data.error) {
      console.error(`❌ ${channel} channel error:`, data.error);
      this.emit('error', new Error(data.error));
    }
  }

  extractSpeakerFromWords(words) {
    // Extract speaker information from AssemblyAI's word-level data
    if (!words || words.length === 0) return null;
    
    // Look for speaker information in the words array
    const firstWord = words[0];
    if (firstWord && firstWord.speaker) {
      return `Speaker ${firstWord.speaker}`;
    }
    
    return null;
  }

  getSpeakerFromChannel(channel, transcript) {
    // Fallback channel-based speaker identification when diarization data isn't available
    // This should be used as a last resort - prefer AssemblyAI's speaker diarization
    if (channel === 'microphone') {
      return 'You'; // User speaking into microphone
    } else if (channel === 'system') {
      return 'Remote'; // Remote participants from system audio
    }
    
    return 'Unknown Speaker';
  }

  async stopTranscription() {
    if (!this.isRecording) {
      throw new Error('Not currently recording');
    }

    try {
      // Send termination message to v3 API
      if (this.microphoneSocket && this.microphoneSocket.readyState === 1) {
        this.microphoneSocket.close();
      }

      if (this.systemAudioSocket && this.systemAudioSocket.readyState === 1) {
        this.systemAudioSocket.close();
      }

      // Create session summary
      console.log('🤖 Generating session summary...');
      const summary = await this.generateSummary();

      const session = {
        id: this.sessionId,
        startTime: this.startTime,
        endTime: Date.now(),
        duration: Date.now() - this.startTime,
        transcript: this.transcript,
        speakers: Array.from(this.speakers),
        summary: summary,
        audioSource: this.audioSource || 'multichannel'
      };

      await this.cleanup();

      this.emit('stopped', session);
      return session;

    } catch (error) {
      console.error('Error stopping transcription:', error);
      throw error;
    }
  }

  async cleanup() {
    try {
      // Stop microphone channel processing
      if (this.microphoneProcessor) {
        this.microphoneProcessor.disconnect();
        this.microphoneProcessor = null;
      }

      if (this.microphoneSource) {
        this.microphoneSource.disconnect();
        this.microphoneSource = null;
      }

      if (this.microphoneContext && this.microphoneContext.state !== 'closed') {
        await this.microphoneContext.close();
        this.microphoneContext = null;
      }

      // Stop system audio channel processing
      if (this.systemAudioProcessor) {
        this.systemAudioProcessor.disconnect();
        this.systemAudioProcessor = null;
      }

      if (this.systemAudioSource) {
        this.systemAudioSource.disconnect();
        this.systemAudioSource = null;
      }

      if (this.systemAudioContext && this.systemAudioContext.state !== 'closed') {
        await this.systemAudioContext.close();
        this.systemAudioContext = null;
      }

      // Stop microphone stream
      if (this.microphoneStream) {
        this.microphoneStream.getTracks().forEach(track => track.stop());
        this.microphoneStream = null;
      }

      // Stop system audio stream
      if (this.systemAudioStream) {
        this.systemAudioStream.getTracks().forEach(track => track.stop());
        this.systemAudioStream = null;
      }

      // Close WebSocket connections
      if (this.microphoneSocket) {
        this.microphoneSocket.close();
        this.microphoneSocket = null;
      }

      if (this.systemAudioSocket) {
        this.systemAudioSocket.close();
        this.systemAudioSocket = null;
      }

      // Clean up audio mixer
      if (this.audioMixer) {
        this.audioMixer.cleanup();
      }

      console.log('🧹 Multichannel audio streams and processing cleaned up');

      this.isRecording = false;
      this.isConnected = false;

      console.log('🧹 Multichannel cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  detectSpeakerFromTurn(turnData, text) {
    // Enhanced speaker detection using turn information from AssemblyAI
    if (!text || text.length < 3) return this.currentTurnSpeaker || 'Speaker A';

    const turnId = turnData.turn_id || 'unknown';
    const endOfTurn = turnData.end_of_turn || false;

    // Initialize turn tracking
    if (!this.currentTurnId) {
      this.currentTurnId = turnId;
      this.currentTurnSpeaker = 'Speaker A';
      this.turnCount = 0;
    }

    // Check if this is a new turn
    if (this.currentTurnId !== turnId || endOfTurn) {
      this.currentTurnId = turnId;
      this.turnCount = (this.turnCount || 0) + 1;

      // Alternate between speakers for new turns
      const speakers = ['Speaker A', 'Speaker B', 'Speaker C'];
      this.currentTurnSpeaker = speakers[this.turnCount % speakers.length];

      console.log(`🔄 Turn ${this.turnCount}: ${this.currentTurnSpeaker} (ID: ${turnId}, EndOfTurn: ${endOfTurn})`);
    }

    return this.currentTurnSpeaker;
  }

  detectSpeaker(text) {
    // Fallback speaker detection for backward compatibility
    if (!text || text.length < 3) return this.lastSpeaker || 'Speaker A';

    // Simple heuristic: if text contains common user phrases, it's likely the user
    const userPhrases = ['i think', 'i believe', 'my opinion', 'i would', 'let me', 'i can', 'i will', 'i am', 'i\'m'];
    const systemPhrases = ['thank you', 'please', 'welcome', 'hello', 'good morning', 'good afternoon'];

    const lowerText = text.toLowerCase();
    const hasUserPhrase = userPhrases.some(phrase => lowerText.includes(phrase));
    const hasSystemPhrase = systemPhrases.some(phrase => lowerText.includes(phrase));

    let speaker;
    if (hasUserPhrase) {
      speaker = 'You';
    } else if (hasSystemPhrase) {
      speaker = 'Remote';
    } else {
      // Use alternating pattern with slight randomness
      const hash = text.length + text.charCodeAt(0);
      speaker = (hash % 2 === 0) ? 'You' : 'Remote';
    }

    this.lastSpeaker = speaker;
    return speaker;
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  async generateSummary() {
    if (this.transcript.length === 0) {
      return 'No transcript available';
    }

    const fullText = this.transcript.map(t => `${t.speaker}: ${t.text}`).join('\n');
    const wordCount = this.transcript.reduce((count, t) => count + t.text.split(' ').length, 0);
    const speakerCount = this.speakers.size;
    const duration = Math.round((Date.now() - this.startTime) / 1000 / 60);

    // Try to generate AI summary
    try {
      console.log('🤖 Generating AI summary for enhanced transcription...');

      if (wordCount < 50) {
        return this.generateBasicSummary(duration, speakerCount, wordCount);
      }

      // Use ipcRenderer to communicate with AI service
      const summaryPrompt = `Please analyze this meeting transcript and provide a concise summary:

**Meeting Details:**
- Duration: ${duration} minutes
- Speakers: ${Array.from(this.speakers).join(', ')}
- Word count: ${wordCount}
- Audio source: Multichannel (Separate Mic + System Audio)

**Transcript:**
${fullText.substring(0, 3000)}${fullText.length > 3000 ? '...' : ''}

Please provide a structured summary with:
1. Main topics discussed
2. Key decisions made
3. Action items (if any)
4. Important points raised`;

      // Try to get AI summary via IPC
      const aiResult = await ipcRenderer.invoke('generate-ai-summary', { prompt: summaryPrompt });

      if (aiResult && aiResult.success && aiResult.summary) {
        console.log('✅ AI summary generated successfully');
        return `# Meeting Summary\n\n**Duration:** ${duration} minutes | **Speakers:** ${speakerCount} | **Words:** ${wordCount}\n\n${aiResult.summary}`;
      }
    } catch (error) {
      console.error('❌ AI summary generation failed:', error);
    }

    // Fallback to basic summary
    return this.generateBasicSummary(duration, speakerCount, wordCount);
  }

  generateBasicSummary(duration, speakerCount, wordCount) {
    const keyPoints = this.extractKeyPoints();

    return `# Meeting Summary (Basic)

**Meeting Details:**
- Duration: ${duration} minutes
- Speakers: ${Array.from(this.speakers).join(', ')} (${speakerCount} total)
- Total words: ${wordCount}
- Audio source: Multichannel (Separate Mic + System Audio)

**Key Points:**
${keyPoints}

**Transcript Preview:**
${this.transcript.slice(0, 3).map(t => `**${t.speaker}:** ${t.text.substring(0, 100)}${t.text.length > 100 ? '...' : ''}`).join('\n\n')}

*This is an automated basic summary. For detailed AI analysis, ensure AI services are connected.*`;
  }

  extractKeyPoints() {
    if (this.transcript.length === 0) return 'No key points identified.';

    const keyPoints = [];

    this.transcript.forEach(t => {
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
          trimmed.toLowerCase().includes('will') ||
          trimmed.toLowerCase().includes('follow up')
        )) {
          keyPoints.push(`• **${t.speaker}:** ${trimmed}`);
        }
      });
    });

    return keyPoints.slice(0, 5).join('\n') || '• No specific key points identified in the transcript.';
  }
}

module.exports = EnhancedTranscriptionService;