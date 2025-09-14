const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // IPC communication
  send: (channel, data) => {
    const validChannels = [
      'show-login', 'close-login', 'show-welcome', 'show-settings', 'close-settings',
      'hide-main-panel', 'show-help', 'close-help', 'show-ai-assist', 'close-ai-assist',
      'resize-ai-assist', 'ai-sphere-clicked', 'close-ai-chat', 'show-window-selector',
      'show-brief-panel', 'close-brief-panel', 'show-email-panel', 'close-email-panel',
      'show-listen-panel', 'close-listen-panel', 'clients-updated', 'sessions-updated'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  invoke: async (channel, data) => {
    const validChannels = [
      'logout', 'get-user-data', 'send-password-reset', 'change-email', 'change-password',
      'delete-account', 'authenticate', 'google-signin', 'set-content-protection',
      'get-content-protection', 'capture-window-content', 'capture-email-context',
      'insert-email-reply', 'get-available-windows', 'capture-system-audio-native',
      'stop-native-audio-capture', 'enable-loopback-audio', 'disable-loopback-audio',
      'start-audio-capture', 'stop-audio-capture', 'start-native-system-audio', 'generate-ai-summary'
    ];
    if (validChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, data);
    }
  },

  on: (channel, func) => {
    const validChannels = [
      'clients-updated', 'sessions-updated', 'expand-chat', 'collapse-chat'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },

  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Expose Node.js modules needed for the app
contextBridge.exposeInMainWorld('nodeAPI', {
  require: (module) => {
    const allowedModules = ['os', 'path'];
    if (allowedModules.includes(module)) {
      return require(module);
    }
    throw new Error(`Module ${module} is not allowed`);
  },
  
  // For TranscriptionService
  TranscriptionService: require('./services/TranscriptionService'),
  EnhancedTranscriptionService: require('./services/EnhancedTranscriptionService'),
  AudioMixer: require('./utils/AudioMixer')
});