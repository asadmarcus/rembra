const { ipcMain } = require('electron');
const { initMain } = require('electron-audio-loopback');

class AudioCaptureManager {
  constructor() {
    this.isRecording = false;
    this.microphoneStream = null;
    this.systemAudioStream = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.combinedStream = null;
    this.systemAudioCapture = null;
    this.rendererWindow = null;
    
    // electron-audio-loopback is already initialized in main.js
    console.log('✅ AudioCaptureManager ready (loopback already initialized)');
  }

  setupIPC() {
    // Remove existing handlers first
    ipcMain.removeHandler('start-system-audio-capture');
    ipcMain.removeHandler('stop-system-audio-capture');
    ipcMain.removeHandler('get-loopback-audio-stream');

    // System audio capture using electron-audio-loopback
    ipcMain.handle('start-system-audio-capture', async (event, options = {}) => {
      try {
        return await this.startSystemAudioCapture(event.sender, options);
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('stop-system-audio-capture', async () => {
      try {
        return await this.stopSystemAudioCapture();
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Helper for getting loopback audio stream info
    ipcMain.handle('get-loopback-audio-stream', async () => {
      try {
        return { 
          success: true, 
          message: 'Use getDisplayMedia with audio: true after enabling loopback' 
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  }

  async startSystemAudioCapture(sender, options = {}) {
    if (this.isRecording) {
      return { success: false, error: 'Already recording' };
    }

    try {
      // Store renderer window reference
      this.rendererWindow = sender;
      this.isRecording = true;
      
      console.log('🎧 System audio loopback ready - renderer should use getDisplayMedia...');
      
      // The actual audio capture happens in the renderer process
      // using getDisplayMedia after enabling loopback audio
      // This just signals that we're ready to capture
      
      return { 
        success: true, 
        message: 'System audio loopback enabled - use getDisplayMedia with audio: true' 
      };
    } catch (error) {
      this.isRecording = false;
      console.error('Failed to start system audio capture:', error);
      return { success: false, error: error.message };
    }
  }

  async stopSystemAudioCapture() {
    if (!this.isRecording) {
      return { success: false, error: 'Not recording' };
    }

    try {
      // Clean up streams
      if (this.microphoneStream) {
        this.microphoneStream.getTracks().forEach(track => track.stop());
        this.microphoneStream = null;
      }

      if (this.systemAudioStream) {
        this.systemAudioStream.getTracks().forEach(track => track.stop());
        this.systemAudioStream = null;
      }

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      this.isRecording = false;
      this.audioChunks = [];
      this.combinedStream = null;
      this.rendererWindow = null;

      console.log('🛑 System audio loopback disabled');
      return { success: true, message: 'System audio capture stopped' };
    } catch (error) {
      throw error;
    }
  }

  getStatus() {
    return {
      isRecording: this.isRecording,
      hasMicrophone: !!this.microphoneStream,
      hasSystemAudio: !!this.systemAudioCapture
    };
  }
}

module.exports = AudioCaptureManager;