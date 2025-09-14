// Suppress Chromium logging before importing Electron
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
process.env.ELECTRON_NO_ATTACH_CONSOLE = 'true';
process.env.ELECTRON_ENABLE_LOGGING = 'false';

// Load environment variables from .env file
require('dotenv').config();

const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const FirebaseManager = require('./services/FirebaseManager');
const ClientManager = require('./services/ClientManager');
const AudioCaptureManager = require('./services/AudioCaptureManager');
const OAuthManager = require('./services/OAuthManager');
const UpdateManager = require('./services/UpdateManager');
const firebaseConfig = require('./config/firebase');
const { initMain } = require('electron-audio-loopback');

// Increase max listeners for IPC to prevent memory leak warnings
require('events').EventEmitter.defaultMaxListeners = 20;

// Initialize electron-audio-loopback before app is ready
console.log('🔧 Initializing electron-audio-loopback...');
try {
  initMain({
    sourcesOptions: {
      types: ['screen'],
      fetchWindowIcons: false
    },
    loopbackWithMute: false
  });
  console.log('✅ electron-audio-loopback initialized');
} catch (error) {
  console.log('⚠️ electron-audio-loopback initialization failed (permissions may be needed)');
  // Don't crash the app - system audio just won't be available
}

// Comprehensive SSL/TLS Configuration for Electron to fix SSL handshake errors
app.commandLine.appendSwitch('--ignore-certificate-errors');
app.commandLine.appendSwitch('--ignore-ssl-errors');
app.commandLine.appendSwitch('--ignore-certificate-errors-spki-list');
app.commandLine.appendSwitch('--disable-web-security');
app.commandLine.appendSwitch('--allow-running-insecure-content');
app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('--disable-site-isolation-trials');
app.commandLine.appendSwitch('--disable-background-timer-throttling');
app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('--disable-renderer-backgrounding');

// Disable network services that might cause SSL errors
app.commandLine.appendSwitch('--disable-background-networking');
app.commandLine.appendSwitch('--disable-component-update');
app.commandLine.appendSwitch('--disable-default-apps');
app.commandLine.appendSwitch('--disable-extensions');
app.commandLine.appendSwitch('--disable-plugins');
app.commandLine.appendSwitch('--disable-sync');
app.commandLine.appendSwitch('--disable-translate');
app.commandLine.appendSwitch('--no-first-run');
app.commandLine.appendSwitch('--no-default-browser-check');
app.commandLine.appendSwitch('--disable-client-side-phishing-detection');
app.commandLine.appendSwitch('--disable-component-extensions-with-background-pages');
app.commandLine.appendSwitch('--disable-ipc-flooding-protection');

// SUPPRESS SSL ERROR LOGGING - Hide those annoying SSL handshake errors
app.commandLine.appendSwitch('--log-level', '3'); // Only show fatal errors
app.commandLine.appendSwitch('--disable-logging');
app.commandLine.appendSwitch('--silent');
app.commandLine.appendSwitch('--no-sandbox');
app.commandLine.appendSwitch('--disable-gpu-sandbox');

// Additional SSL fixes for macOS
if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('--use-system-default-ssl-cert-db');
  app.commandLine.appendSwitch('--disable-dev-shm-usage');
}

// Additional SSL fixes for Windows
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('--disable-background-timer-throttling');
  app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows');
  app.commandLine.appendSwitch('--disable-renderer-backgrounding');
  app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
}

const store = new Store();

// Suppress SSL error console output
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args.join(' ');
  // Filter out SSL handshake errors
  if (message.includes('ssl_client_socket_impl.cc') || 
      message.includes('handshake failed') || 
      message.includes('net_error -101') ||
      message.includes('SSL error code 1')) {
    return; // Don't log SSL errors
  }
  originalConsoleError.apply(console, args);
};

// Also suppress stderr SSL errors
const originalStderrWrite = process.stderr.write;
process.stderr.write = function(chunk, encoding, callback) {
  const message = chunk.toString();
  if (message.includes('ssl_client_socket_impl.cc') || 
      message.includes('handshake failed') || 
      message.includes('net_error -101') ||
      message.includes('SSL error code 1')) {
    return true; // Don't write SSL errors to stderr
  }
  return originalStderrWrite.call(process.stderr, chunk, encoding, callback);
};

class RembraApp {
  constructor() {
    this.launchWindow = null;
    this.welcomeWindow = null;
    this.loginWindow = null;
    this.mainWindow = null;
    this.settingsWindow = null;
    this.helpWindow = null;
    this.aiAssistWindow = null;
    this.briefWindow = null;
    this.emailWindow = null;
    this.listenWindow = null;
    this.firebaseManager = new FirebaseManager();
    this.clientManager = new ClientManager();
    this.audioCaptureManager = new AudioCaptureManager();
    this.oauthManager = new OAuthManager();
    this.updateManager = null; // Will be initialized after main window
    this.isAuthenticated = store.get('isAuthenticated', false);
    this.contentProtectionEnabled = store.get('contentProtectionEnabled', true);
    
    // Debug: Check what's in the store on startup
    console.log('🔍 STARTUP DEBUG:');
    console.log('🔍 isAuthenticated:', this.isAuthenticated);
    console.log('🔍 currentUser in store:', store.get('currentUser'));
    console.log('🔍 Full store:', store.store);
    
    // Fix: If authenticated but no user data, try to get from Firebase later
    if (this.isAuthenticated && !store.get('currentUser')) {
      console.log('🔧 FIXING: Authenticated but no user data stored');
      this.needUserDataRecovery = true; // Flag to recover user data
    }
    
    // Note: Firebase will be initialized in renderer processes to avoid Node.js TLS issues
    console.log('🔥 Firebase will be initialized in renderer processes for better SSL compatibility');
  }

  async initialize() {
    await app.whenReady();
    
    this.setupIPC();
    this.clientManager.setupIPC(ipcMain);
    this.audioCaptureManager.setupIPC();
    this.setupGlobalShortcuts();
    this.setupAppEvents();
    this.showLaunchAnimation();
  }

  setupAppEvents() {
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('will-quit', () => {
      // Unregister all global shortcuts
      globalShortcut.unregisterAll();
      
      // Clean up AI connection manager
      try {
        const { getInstance } = require('./services/AIConnectionManager');
        const aiManager = getInstance();
        if (aiManager && typeof aiManager.cleanup === 'function') {
          aiManager.cleanup();
        }
      } catch (error) {
        console.log('AI cleanup error (non-critical):', error.message);
      }
      
      // Clean up client manager
      try {
        if (this.clientManager && typeof this.clientManager.cleanup === 'function') {
          this.clientManager.cleanup();
        }
      } catch (error) {
        console.log('Client manager cleanup error (non-critical):', error.message);
      }
      
      // Remove all IPC listeners
      ipcMain.removeAllListeners();
    });
  }

  showLaunchAnimation() {
    this.launchWindow = new BrowserWindow({
      width: 600,
      height: 500,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      backgroundColor: '#00000000',
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
        allowRunningInsecureContent: true,
        experimentalFeatures: true,
        preload: path.join(__dirname, 'preload', 'firebase-preload.js')
      }
    });

    this.launchWindow.loadFile('src/views/launch.html');
    this.launchWindow.center();
    this.applyContentProtection(this.launchWindow);

    const LAUNCH_ANIMATION_DURATION = 3000;
    setTimeout(() => {
      if (this.launchWindow && !this.launchWindow.isDestroyed()) {
        this.launchWindow.close();
        this.launchWindow = null;
        this.proceedToMainApp();
      }
    }, LAUNCH_ANIMATION_DURATION);
  }

  async proceedToMainApp() {
    // First, verify authentication with Firebase
    console.log('🔍 Verifying authentication before showing main app...');
    
    try {
      // Check if Firebase user is actually authenticated
      const currentUser = this.firebaseManager.getCurrentUser();
      const isFirebaseAuthenticated = currentUser !== null;
      
      console.log('🔍 Firebase authentication check:', {
        currentUser: currentUser?.email || 'null',
        isFirebaseAuthenticated,
        storedIsAuthenticated: this.isAuthenticated
      });
      
      // If stored auth state doesn't match Firebase state, correct it
      if (this.isAuthenticated && !isFirebaseAuthenticated) {
        console.log('⚠️ Auth state mismatch - stored says authenticated but Firebase says no');
        this.isAuthenticated = false;
        store.set('isAuthenticated', false);
        store.delete('currentUser');
      } else if (!this.isAuthenticated && isFirebaseAuthenticated) {
        console.log('✅ Firebase user found, updating stored auth state');
        this.isAuthenticated = true;
        store.set('isAuthenticated', true);
        // Store the current user data
        const userData = {
          email: currentUser.email,
          uid: currentUser.uid,
          displayName: currentUser.displayName || currentUser.email.split('@')[0]
        };
        store.set('currentUser', userData);
      }
      
      // Now proceed based on verified authentication state
      if (this.isAuthenticated && isFirebaseAuthenticated) {
        console.log('✅ User verified as authenticated - showing main app');
        this.showMainApp();
      } else {
        console.log('🔐 User not authenticated - showing welcome window');
        this.showWelcomeWindow();
      }
    } catch (error) {
      console.error('❌ Error during authentication verification:', error);
      // On error, assume not authenticated
      this.isAuthenticated = false;
      store.set('isAuthenticated', false);
      store.delete('currentUser');
      this.showWelcomeWindow();
    }
  }

  showMainApp() {
    this.mainWindow = new BrowserWindow({
      width: 450,
      height: 40,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      skipTaskbar: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.mainWindow.loadFile('src/views/main-panel.html');
    
    // Position at top center of screen
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width } = primaryDisplay.workAreaSize;
    
    this.mainWindow.setPosition(
      Math.round((width - 450) / 2),
      20
    );
    
    this.mainWindow.setMovable(true);
    this.applyContentProtection(this.mainWindow);
    
    // Initialize update manager after main window is ready
    if (!this.updateManager) {
      this.updateManager = new UpdateManager(this.mainWindow);
      console.log('✅ Update manager initialized');
    }
  }

  showSettingsWindow() {
    if (this.settingsWindow) {
      this.settingsWindow.focus();
      return;
    }

    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    this.settingsWindow = new BrowserWindow({
      width: 800,
      height: 550,
      x: Math.round((width - 800) / 2),
      y: Math.round((height - 550) / 2),
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      skipTaskbar: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.settingsWindow.loadFile('src/views/settings.html');
    this.settingsWindow.setMovable(true);

    this.applyContentProtection(this.settingsWindow);
    
    // If we need to recover user data, do it after the window loads
    this.settingsWindow.webContents.once('did-finish-load', async () => {
      if (this.needUserDataRecovery) {
        console.log('🔧 Settings window loaded, attempting user data recovery...');
        setTimeout(async () => {
          try {
            const result = await this.handleGetUserFromRenderer();
            if (result.success) {
              console.log('✅ User data recovery successful');
              this.needUserDataRecovery = false;
            } else {
              console.log('⚠️ User data recovery failed:', result.error);
            }
          } catch (error) {
            console.log('❌ Error during user data recovery:', error.message);
          }
        }, 3000); // Wait 3 seconds for Firebase to fully initialize
      }
    });
    
    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });
  }

  async handleGetUserFromRenderer() {
    console.log('🔍 Getting user data from renderer Firebase');
    return new Promise((resolve) => {
      // We'll send a message to get user data from renderer
      if (this.settingsWindow) {
        this.settingsWindow.webContents.send('request-user-from-firebase');
        
        // Listen for response
        const handleUserResponse = (event, userData) => {
          console.log('🔍 Received user data from renderer:', userData);
          if (userData) {
            // Store it for future use
            store.set('currentUser', userData);
            console.log('✅ Stored user data from renderer recovery');
          }
          resolve({ success: true, user: userData });
          ipcMain.removeListener('user-from-renderer', handleUserResponse);
        };
        
        ipcMain.once('user-from-renderer', handleUserResponse);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          ipcMain.removeListener('user-from-renderer', handleUserResponse);
          resolve({ success: false, error: 'Timeout getting user from renderer' });
        }, 10000);
      } else {
        resolve({ success: false, error: 'No renderer window available' });
      }
    });
  }

  showWelcomeWindow() {
    this.welcomeWindow = new BrowserWindow({
      width: 300,
      height: 120,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      skipTaskbar: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.welcomeWindow.loadFile('src/views/welcome.html');
    this.welcomeWindow.center();
    this.welcomeWindow.setMovable(true);
    this.applyContentProtection(this.welcomeWindow);
  }

  showLoginWindow(isSignUp = false) {
    if (this.welcomeWindow) {
      this.welcomeWindow.close();
      this.welcomeWindow = null;
    }

    this.loginWindow = new BrowserWindow({
      width: 350,
      height: 340,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      skipTaskbar: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const url = `src/views/login.html${isSignUp ? '?signup=true' : ''}`;
    this.loginWindow.loadFile(url);
    this.loginWindow.center();
    this.loginWindow.setMovable(true);
    this.applyContentProtection(this.loginWindow);
  }

  setupIPC() {
    ipcMain.on('show-login', (event, isSignUp) => {
      this.showLoginWindow(isSignUp);
    });

    ipcMain.on('close-login', () => {
      if (this.loginWindow) {
        this.loginWindow.close();
        this.loginWindow = null;
        this.showWelcomeWindow();
      }
    });

    ipcMain.on('show-welcome', () => {
      if (this.loginWindow) {
        this.loginWindow.close();
        this.loginWindow = null;
      }
      this.showWelcomeWindow();
    });

    ipcMain.on('show-settings', () => {
      this.showSettingsWindow();
    });

    ipcMain.on('close-settings', () => {
      if (this.settingsWindow) {
        this.settingsWindow.close();
        this.settingsWindow = null;
      }
    });

    ipcMain.handle('get-platform-meetings', async () => {
      try {
        const platforms = ['google-meet', 'microsoft-teams', 'zoom', 'webex'];
        const results = {};
        
        for (const platform of platforms) {
          try {
            const meetings = await this.oauthManager.getMeetings(platform);
            results[platform] = meetings || [];
          } catch (error) {
            console.log(`Error fetching ${platform} meetings:`, error.message);
            results[platform] = [];
          }
        }
        
        return results;
      } catch (error) {
        console.error('Error fetching platform meetings:', error);
        return {};
      }
    });

    ipcMain.handle('logout', async () => {
      try {
        console.log('🔓 Logout requested');
        
        // Sign out from Firebase
        const result = await this.firebaseManager.signOut();
        console.log('🔓 Firebase signOut result:', result);
        
        // Always clear local auth state regardless of Firebase result
        this.isAuthenticated = false;
        store.set('isAuthenticated', false);
        store.delete('currentUser'); // Clear stored user data
        
        console.log('🔓 Cleared local authentication state');
        
        // Close all windows except welcome
        if (this.mainWindow) {
          this.mainWindow.close();
          this.mainWindow = null;
          console.log('🔓 Closed main window');
        }
        if (this.settingsWindow) {
          this.settingsWindow.close();
          this.settingsWindow = null;
          console.log('🔓 Closed settings window');
        }
        
        // Show welcome window for re-authentication
        this.showWelcomeWindow();
        console.log('🔓 Showed welcome window');
        
        return { success: true };
      } catch (error) {
        console.error('❌ Logout error:', error);
        
        // Even if Firebase sign out fails, clear local state
        this.isAuthenticated = false;
        store.set('isAuthenticated', false);
        store.delete('currentUser');
        
        if (this.mainWindow) {
          this.mainWindow.close();
          this.mainWindow = null;
        }
        if (this.settingsWindow) {
          this.settingsWindow.close();
          this.settingsWindow = null;
        }
        
        this.showWelcomeWindow();
        
        return { success: true, warning: 'Local logout completed despite Firebase error' };
      }
    });

    ipcMain.handle('get-user-data', async () => {
      console.log('🔍 GET-USER-DATA IPC HANDLER CALLED');
      console.log('🔍 this.isAuthenticated:', this.isAuthenticated);
      
      try {
        // First try to get from Firebase manager if initialized
        const currentUser = this.firebaseManager.getCurrentUser();
        console.log('🔍 Firebase currentUser:', currentUser);
        
        if (currentUser) {
          const userData = {
            email: currentUser.email,
            uid: currentUser.uid,
            displayName: currentUser.displayName
          };
          console.log('🔍 Returning Firebase user data:', userData);
          return { 
            success: true, 
            user: userData
          };
        }
        
        // Fallback to stored user data
        const storedUser = store.get('currentUser');
        console.log('🔍 Stored user data:', storedUser);
        console.log('🔍 isAuthenticated check:', this.isAuthenticated);
        
        if (storedUser && this.isAuthenticated) {
          console.log('🔍 Returning stored user data:', storedUser);
          return { 
            success: true, 
            user: storedUser
          };
        }
        
        console.log('🔍 No user found - not authenticated');
        return { success: false, error: 'No user logged in' };
      } catch (error) {
        console.error('❌ Error getting user data:', error);
        
        // Try stored user data as fallback
        const storedUser = store.get('currentUser');
        console.log('🔍 Error fallback - stored user:', storedUser);
        
        if (storedUser && this.isAuthenticated) {
          console.log('🔍 Returning fallback stored user data:', storedUser);
          return { 
            success: true, 
            user: storedUser
          };
        }
        
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('send-password-reset', async (event, email) => {
      try {
        return await this.firebaseManager.sendPasswordReset(email);
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('change-email', async (event, { currentPassword, newEmail }) => {
      try {
        return await this.firebaseManager.changeEmail(currentPassword, newEmail);
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('change-password', async (event, { currentPassword, newPassword }) => {
      try {
        return await this.firebaseManager.changePassword(currentPassword, newPassword);
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('delete-account', async (event, { password }) => {
      try {
        const result = await this.firebaseManager.deleteAccount(password);
        if (result.success) {
          this.isAuthenticated = false;
          store.set('isAuthenticated', false);
          
          // Close all windows
          if (this.mainWindow) {
            this.mainWindow.close();
            this.mainWindow = null;
          }
          if (this.settingsWindow) {
            this.settingsWindow.close();
            this.settingsWindow = null;
          }
        }
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Firebase authentication will be handled in renderer processes
    ipcMain.handle('authenticate', async (event, { email, password, isSignUp }) => {
      console.log(`🔐 Auth attempt: ${isSignUp ? 'Sign Up' : 'Sign In'} for ${email}`);
      console.log('🔥 Authentication will be handled in renderer process for better SSL compatibility');
      
      // The actual Firebase auth will happen in the renderer process
      // This handler just manages the app state
      return { success: true, message: 'Auth delegated to renderer process' };
    });

    // Handle successful authentication from renderer process
    ipcMain.handle('auth-success', async (event, { user }) => {
      console.log('🔍 AUTH-SUCCESS IPC HANDLER CALLED');
      console.log('🔍 Received user data:', user);
      console.log('✅ Authentication successful from renderer:', user.email);
      
      this.isAuthenticated = true;
      store.set('isAuthenticated', true);
      
      // Store user data for settings panel
      const userData = {
        email: user.email,
        uid: user.uid,
        displayName: user.displayName || user.email.split('@')[0]
      };
      
      store.set('currentUser', userData);
      console.log('🔍 Stored user data:', userData);
      console.log('🔍 Store now contains:', {
        isAuthenticated: store.get('isAuthenticated'),
        currentUser: store.get('currentUser')
      });
      
      if (this.loginWindow) {
        this.loginWindow.close();
        this.loginWindow = null;
      }
      
      this.showMainApp();
      console.log('✅ User authenticated - showing main app');
      
      return { success: true };
    });

    ipcMain.handle('google-signin', async () => {
      console.log('🔐 Google Sign-In attempt');
      
      try {
        const result = await this.firebaseManager.signInWithGoogle();
        
        console.log('🔐 Google Sign-In result:', result.success ? '✅ Success' : '❌ Failed', result.error || '');
        
        if (result.success) {
          this.isAuthenticated = true;
          if (this.loginWindow) {
            this.loginWindow.close();
            this.loginWindow = null;
          }
          console.log('✅ Google user authenticated - showing main app');
        }
        
        return result;
      } catch (error) {
        console.error('❌ Google Sign-In error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('set-content-protection', async (event, enabled) => {
      try {
        this.contentProtectionEnabled = enabled;
        store.set('contentProtectionEnabled', enabled);
        
        // Apply to all existing windows
        const windows = [this.launchWindow, this.welcomeWindow, this.loginWindow, this.mainWindow, this.settingsWindow, this.helpWindow, this.aiAssistWindow, this.briefWindow, this.emailWindow, this.listenWindow];
        windows.forEach(window => {
          if (window && !window.isDestroyed()) {
            this.applyContentProtection(window);
          }
        });
        
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('get-content-protection', async () => {
      return { enabled: this.contentProtectionEnabled };
    });

    // Settings handlers
    ipcMain.handle('update-setting', async (event, key, value) => {
      try {
        store.set(`settings.${key}`, value);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('get-setting', async (event, key) => {
      try {
        const value = store.get(`settings.${key}`);
        return { success: true, value };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Test IPC connection
    ipcMain.handle('test-ipc', async () => {
      console.log('🔍 IPC test called from settings panel');
      return { success: true, message: 'IPC connection working' };
    });

    // Check for app updates
    ipcMain.handle('check-for-updates', async () => {
      try {
        if (this.updateManager) {
          await this.updateManager.checkForUpdatesManual();
          return { success: true, message: 'Update check completed' };
        } else {
          return { success: false, error: 'Update manager not available' };
        }
      } catch (error) {
        console.error('Update check failed:', error);
        return { success: false, error: error.message };
      }
    });

    // Get user data from renderer Firebase
    ipcMain.handle('get-user-from-renderer', async () => {
      console.log('🔍 Requesting user data from renderer Firebase');
      return new Promise((resolve) => {
        // We'll send a message to get user data from renderer
        if (this.settingsWindow) {
          this.settingsWindow.webContents.send('request-user-from-firebase');
          
          // Listen for response
          const handleUserResponse = (event, userData) => {
            console.log('🔍 Received user data from renderer:', userData);
            if (userData) {
              // Store it for future use
              store.set('currentUser', userData);
            }
            resolve({ success: true, user: userData });
            ipcMain.removeListener('user-from-renderer', handleUserResponse);
          };
          
          ipcMain.once('user-from-renderer', handleUserResponse);
          
          // Timeout after 10 seconds
          setTimeout(() => {
            ipcMain.removeListener('user-from-renderer', handleUserResponse);
            resolve({ success: false, error: 'Timeout getting user from renderer' });
          }, 10000);
        } else {
          resolve({ success: false, error: 'No renderer window available' });
        }
      });
    });

    // External link handler
    ipcMain.handle('open-external', async (event, url) => {
      try {
        const { shell } = require('electron');
        await shell.openExternal(url);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Message box handler for dialogs
    ipcMain.handle('show-message-box', async (event, options) => {
      try {
        const { dialog } = require('electron');
        const senderWindow = event.sender.getOwnerBrowserWindow();
        const result = await dialog.showMessageBox(senderWindow, options);
        return result;
      } catch (error) {
        console.error('Error showing message box:', error);
        return { response: 0, checkboxChecked: false };
      }
    });

    // Meeting Platform Connection Handlers - REAL OAuth Implementation
    ipcMain.handle('connect-google-meet', async (event) => {
      try {
        console.log('🔗 Starting Google OAuth flow...');
        
        // Start OAuth flow
        const tokens = await rembraApp.oauthManager.authenticate('google');
        
        // Validate the token
        const isValid = await rembraApp.oauthManager.validateToken('google', tokens.access_token);
        if (!isValid) {
          throw new Error('Token validation failed');
        }
        
        // Store tokens securely
        store.set('google_oauth_tokens', {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: Date.now() + (tokens.expires_in * 1000)
        });
        
        // Test fetching calendar events
        const events = await rembraApp.oauthManager.getGoogleCalendarEvents(tokens.access_token);
        console.log(`✅ Google OAuth successful! Found ${events.length} calendar events`);
        
        store.set('googleMeet_connected', true);
        return { 
          success: true, 
          message: `Google Meet connected successfully! Found ${events.length} upcoming meetings.`,
          events: events.slice(0, 3) // Return first 3 events as preview
        };
      } catch (error) {
        console.error('❌ Google Meet OAuth failed:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('connect-teams', async (event) => {
      try {
        console.log('🔗 Starting Microsoft Teams OAuth flow...');
        
        const tokens = await rembraApp.oauthManager.authenticate('microsoft');
        
        const isValid = await rembraApp.oauthManager.validateToken('microsoft', tokens.access_token);
        if (!isValid) {
          throw new Error('Token validation failed');
        }
        
        store.set('microsoft_oauth_tokens', {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: Date.now() + (tokens.expires_in * 1000)
        });
        
        const events = await rembraApp.oauthManager.getMicrosoftCalendarEvents(tokens.access_token);
        console.log(`✅ Microsoft Teams OAuth successful! Found ${events.length} calendar events`);
        
        store.set('teams_connected', true);
        return { 
          success: true, 
          message: `Microsoft Teams connected successfully! Found ${events.length} upcoming meetings.`,
          events: events.slice(0, 3)
        };
      } catch (error) {
        console.error('❌ Microsoft Teams OAuth failed:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('connect-zoom', async (event) => {
      try {
        console.log('🔗 Starting Zoom OAuth flow...');
        
        const tokens = await rembraApp.oauthManager.authenticate('zoom');
        
        const isValid = await rembraApp.oauthManager.validateToken('zoom', tokens.access_token);
        if (!isValid) {
          throw new Error('Token validation failed');
        }
        
        store.set('zoom_oauth_tokens', {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: Date.now() + (tokens.expires_in * 1000)
        });
        
        const meetings = await rembraApp.oauthManager.getZoomMeetings(tokens.access_token);
        console.log(`✅ Zoom OAuth successful! Found ${meetings.length} meetings`);
        
        store.set('zoom_connected', true);
        return { 
          success: true, 
          message: `Zoom connected successfully! Found ${meetings.length} upcoming meetings.`,
          meetings: meetings.slice(0, 3)
        };
      } catch (error) {
        console.error('❌ Zoom OAuth failed:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('connect-webex', async (event) => {
      try {
        console.log('🔗 Cisco Webex OAuth not yet implemented...');
        // Webex OAuth would need to be set up with proper credentials
        return { 
          success: false, 
          error: 'Cisco Webex integration requires additional setup. Please contact support.' 
        };
      } catch (error) {
        console.error('Webex connection failed:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('disconnect-platform', async (event, platformKey) => {
      try {
        console.log(`🔌 Disconnecting ${platformKey}...`);
        
        // Clear OAuth tokens and connection status
        switch (platformKey) {
          case 'googleMeet':
            store.delete('google_oauth_tokens');
            store.set('googleMeet_connected', false);
            break;
          case 'teams':
            store.delete('microsoft_oauth_tokens');
            store.set('teams_connected', false);
            break;
          case 'zoom':
            store.delete('zoom_oauth_tokens');
            store.set('zoom_connected', false);
            break;
          case 'webex':
            store.set('webex_connected', false);
            break;
        }
        
        return { success: true, message: 'Platform disconnected successfully!' };
      } catch (error) {
        console.error('Platform disconnection failed:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('get-platform-status', async (event, platformKey) => {
      try {
        // Check if we have valid OAuth tokens for this platform
        let connected = false;
        let tokens = null;
        
        switch (platformKey) {
          case 'googleMeet':
            tokens = store.get('google_oauth_tokens');
            break;
          case 'teams':
            tokens = store.get('microsoft_oauth_tokens');
            break;
          case 'zoom':
            tokens = store.get('zoom_oauth_tokens');
            break;
          case 'webex':
            connected = store.get('webex_connected', false);
            break;
        }
        
        // For platforms with OAuth tokens, check if they're valid and not expired
        if (tokens && tokens.access_token) {
          const now = Date.now();
          connected = tokens.expires_at > now;
          
          if (!connected) {
            console.log(`⚠️ OAuth token expired for ${platformKey}`);
          }
        }
        
        return { success: true, connected };
      } catch (error) {
        console.error('Failed to get platform status:', error);
        return { success: false, connected: false };
      }
    });

    // Data management handlers
    ipcMain.handle('open-data-folder', async () => {
      try {
        const { shell } = require('electron');
        const dataPath = app.getPath('userData');
        await shell.openPath(dataPath);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('clear-all-data', async () => {
      try {
        const fs = require('fs');
        const path = require('path');
        
        // Clear store data
        store.clear();
        
        // Clear any recording files (if they exist)
        const userDataPath = app.getPath('userData');
        const recordingsPath = path.join(userDataPath, 'recordings');
        
        if (fs.existsSync(recordingsPath)) {
          fs.rmSync(recordingsPath, { recursive: true, force: true });
        }
        
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.on('hide-main-panel', () => {
      this.hideMainPanel();
    });

    ipcMain.on('show-help', () => {
      this.showHelpWindow();
    });

    ipcMain.on('close-help', () => {
      if (this.helpWindow) {
        this.helpWindow.close();
        this.helpWindow = null;
      }
    });

    ipcMain.on('show-ai-assist', () => {
      this.showAIAssistWindow();
    });

    ipcMain.on('close-ai-assist', () => {
      if (this.aiAssistWindow) {
        this.aiAssistWindow.close();
        this.aiAssistWindow = null;
      }
    });

    ipcMain.on('resize-ai-assist', (event, width, height) => {
      // Not needed anymore - direct chat interface
    });

    ipcMain.on('ai-sphere-clicked', () => {
      // Not needed anymore - direct chat interface
    });

    ipcMain.on('close-ai-chat', () => {
      if (this.aiAssistWindow) {
        this.aiAssistWindow.close();
        this.aiAssistWindow = null;
      }
    });

    ipcMain.on('show-window-selector', () => {
      this.showWindowSelector();
    });

    ipcMain.on('show-brief-panel', () => {
      this.showBriefPanel();
    });

    ipcMain.on('close-brief-panel', () => {
      if (this.briefWindow) {
        this.briefWindow.close();
        this.briefWindow = null;
      }
    });

    ipcMain.on('show-email-panel', () => {
      this.showEmailPanel();
    });

    ipcMain.on('close-email-panel', () => {
      if (this.emailWindow) {
        this.emailWindow.close();
        this.emailWindow = null;
      }
    });

    ipcMain.on('clients-updated', () => {
      // Notify all open panels about client updates
      if (this.briefWindow && !this.briefWindow.isDestroyed()) {
        this.briefWindow.webContents.send('clients-updated');
      }
      if (this.emailWindow && !this.emailWindow.isDestroyed()) {
        this.emailWindow.webContents.send('clients-updated');
      }
      if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
        this.settingsWindow.webContents.send('clients-updated');
      }
    });

    ipcMain.on('show-listen-panel', () => {
      this.showListenPanel();
    });

    ipcMain.on('close-listen-panel', () => {
      if (this.listenWindow) {
        this.listenWindow.close();
        this.listenWindow = null;
      }
    });

    ipcMain.on('sessions-updated', () => {
      // Notify settings panel about session updates
      if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
        this.settingsWindow.webContents.send('sessions-updated');
      }
    });

    // AI Context and Email Reply handlers
    ipcMain.handle('capture-window-content', async (event, options = {}) => {
      try {
        const AIContextManager = require('./services/AIContextManager');
        const contextManager = new AIContextManager();
        
        const result = await contextManager.captureSelectedWindowContent();
        return { success: true, data: result };
      } catch (error) {
        console.error('❌ Window content capture failed:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('capture-email-context', async (event, options = {}) => {
      try {
        const AIContextManager = require('./services/AIContextManager');
        const contextManager = new AIContextManager();
        
        const result = await contextManager.captureEmailContext();
        return { success: true, data: result };
      } catch (error) {
        console.error('❌ Email context capture failed:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('insert-email-reply', async (event, { aiResponse, windowInfo }) => {
      try {
        const EmailReplyManager = require('./services/EmailReplyManager');
        
        const result = await EmailReplyManager.handleEmailReplyFlow(aiResponse, windowInfo);
        return result;
      } catch (error) {
        console.error('❌ Email reply insertion failed:', error);
        return { 
          success: false, 
          message: `Error inserting email reply: ${error.message}` 
        };
      }
    });

    // Meeting Platform Integration Handler
    ipcMain.handle('start-meeting-session', async (event, meetingData) => {
      try {
        console.log('Starting meeting session:', meetingData);
        
        // Store meeting context for transcription
        const store = new Store();
        const currentSession = {
          id: Date.now().toString(),
          meetingUrl: meetingData.meetingUrl,
          platform: meetingData.platform,
          title: meetingData.title || 'Meeting Session',
          participants: meetingData.participants || [],
          startTime: meetingData.startTime,
          autoRecord: meetingData.autoRecord,
          isActive: true
        };
        
        // Store the session
        store.set('currentMeetingSession', currentSession);
        
        // If auto-record is enabled, signal to start transcription
        if (meetingData.autoRecord) {
          // Notify all renderer windows about auto-record start
          BrowserWindow.getAllWindows().forEach(window => {
            window.webContents.send('auto-record-meeting', currentSession);
          });
        }
        
        return { 
          success: true, 
          sessionId: currentSession.id,
          message: 'Meeting session started successfully' 
        };
      } catch (error) {
        console.error('Failed to start meeting session:', error);
        return { 
          success: false, 
          error: error.message 
        };
      }
    });

    ipcMain.handle('end-meeting-session', async (event) => {
      try {
        const store = new Store();
        const currentSession = store.get('currentMeetingSession');
        
        if (currentSession) {
          currentSession.isActive = false;
          currentSession.endTime = new Date().toISOString();
          
          // Move to session history
          const sessionHistory = store.get('meetingSessionHistory', []);
          sessionHistory.push(currentSession);
          store.set('meetingSessionHistory', sessionHistory);
          
          // Clear current session
          store.delete('currentMeetingSession');
          
          return { 
            success: true, 
            message: 'Meeting session ended successfully' 
          };
        }
        
        return { 
          success: false, 
          message: 'No active meeting session found' 
        };
      } catch (error) {
        console.error('Failed to end meeting session:', error);
        return { 
          success: false, 
          error: error.message 
        };
      }
    });

    ipcMain.handle('get-current-meeting-session', async () => {
      try {
        const store = new Store();
        const currentSession = store.get('currentMeetingSession');
        return { 
          success: true, 
          session: currentSession || null 
        };
      } catch (error) {
        console.error('Failed to get current meeting session:', error);
        return { 
          success: false, 
          error: error.message 
        };
      }
    });

    ipcMain.handle('get-available-windows', async () => {
      try {
        const { desktopCapturer } = require('electron');
        
        const sources = await desktopCapturer.getSources({
          types: ['window'],
          thumbnailSize: { width: 150, height: 150 }
        });
        
        // Filter out Rembra windows
        const validSources = sources
          .filter(source => 
            !source.name.toLowerCase().includes('rembra') &&
            !source.name.toLowerCase().includes('electron') &&
            source.name.trim() !== ''
          )
          .map(source => ({
            id: source.id,
            name: source.name,
            thumbnail: source.thumbnail.toDataURL()
          }));
        
        return { success: true, windows: validSources };
      } catch (error) {
        console.error('❌ Failed to get available windows:', error);
        return { success: false, error: error.message };
      }
    });

    // Audio handlers are managed by AudioCaptureManager
    
    // Native system audio capture for macOS (automatic)
    ipcMain.handle('start-native-system-audio', async () => {
      try {
        console.log('🍎 Starting native macOS system audio capture...');
        
        // Initialize the native system audio capture
        const result = await this.audioCaptureManager.startCapture({
          captureSystemAudio: true,
          platform: 'darwin',
          automatic: true
        });
        
        if (result && result.success) {
          console.log('✅ Native macOS system audio capture started');
          return { success: true, message: 'Native system audio capture active' };
        } else {
          return { success: false, error: 'Failed to start native capture' };
        }
        
      } catch (error) {
        console.error('❌ Native macOS system audio capture failed:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('generate-ai-summary', async (event, { prompt }) => {
      try {
        console.log('🤖 Generating AI summary via main process...');
        
        // Try to use AI service if available
        const { getInstance } = require('./services/AIConnectionManager');
        const aiManager = getInstance();
        
        // Check if AI is connected
        const status = aiManager.getConnectionStatus();
        if (!status.connected) {
          console.log('⚠️ AI not connected, returning fallback');
          return { success: false, error: 'AI service not connected' };
        }

        // Generate summary with timeout
        const summaryPromise = new Promise((resolve, reject) => {
          let aiSummary = '';
          
          const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('AI summary timeout'));
          }, 30000);

          const onUpdate = (messages) => {
            try {
              const lastMessage = messages[messages.length - 1];
              if (lastMessage && !lastMessage.isUser) {
                aiSummary = lastMessage.message;
              }
            } catch (error) {
              console.error('Error processing AI message:', error);
            }
          };

          const onComplete = () => {
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

        await aiManager.sendMessage(prompt);
        const summary = await summaryPromise;

        if (summary && summary.trim() && summary.length > 50) {
          console.log('✅ AI summary generated successfully via main process');
          return { success: true, summary: summary };
        } else {
          return { success: false, error: 'AI summary too short or empty' };
        }

      } catch (error) {
        console.error('❌ AI summary generation failed in main process:', error);
        return { success: false, error: error.message };
      }
    });


  }

  applyContentProtection(window) {
    if (!window || window.isDestroyed()) return;
    
    // Enhanced protection for maximum privacy
    window.setContentProtection(this.contentProtectionEnabled);
    
    if (this.contentProtectionEnabled) {
      // Additional privacy measures
      window.webContents.on('before-input-event', (event, input) => {
        // Block common screenshot shortcuts
        if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 's') {
          event.preventDefault();
        }
        if (input.key === 'PrintScreen' || input.key === 'F12') {
          event.preventDefault();
        }
      });
      
      // Disable dev tools in production
      if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
        window.webContents.closeDevTools();
        window.webContents.on('devtools-opened', () => {
          window.webContents.closeDevTools();
        });
      }
    }
  }

  setupGlobalShortcuts() {
    // Register Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux) to toggle main panel
    const shortcut = process.platform === 'darwin' ? 'Cmd+Shift+R' : 'Ctrl+Shift+R';
    
    globalShortcut.register(shortcut, () => {
      this.toggleMainPanel();
    });
    
    console.log(`🔥 Global shortcut registered: ${shortcut}`);
  }

  hideMainPanel() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.hide();
      console.log('🙈 Main panel hidden - use Ctrl+Shift+R to show');
    }
  }

  showMainPanel() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.show();
      this.mainWindow.focus();
      console.log('👁️ Main panel shown');
    } else if (this.isAuthenticated) {
      // Recreate main panel if it was closed
      this.showMainApp();
    }
  }

  toggleMainPanel() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (this.mainWindow.isVisible()) {
        this.hideMainPanel();
      } else {
        this.showMainPanel();
      }
    } else if (this.isAuthenticated) {
      this.showMainPanel();
    }
  }

  showHelpWindow() {
    if (this.helpWindow) {
      this.helpWindow.focus();
      return;
    }

    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    this.helpWindow = new BrowserWindow({
      width: 900,
      height: 700,
      x: Math.round((width - 900) / 2),
      y: Math.round((height - 700) / 2),
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      skipTaskbar: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.helpWindow.loadFile('src/views/help.html');
    this.helpWindow.setMovable(true);
    this.applyContentProtection(this.helpWindow);

    this.helpWindow.on('closed', () => {
      this.helpWindow = null;
    });
  }

  showAIAssistWindow() {
    if (this.aiAssistWindow) {
      this.aiAssistWindow.focus();
      return;
    }

    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    // Position in bottom-right corner like Mac app with proper margins
    const margin = 20;
    this.aiAssistWindow = new BrowserWindow({
      width: 340,
      height: 520,
      x: width - 380 - margin,
      y: height - 520 - margin,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      backgroundColor: 'rgba(15, 15, 15, 0)',
      hasShadow: false,
      skipTaskbar: true,
      resizable: false,
      show: false,
      thickFrame: false,
      roundedCorners: false,
      titleBarStyle: 'hidden',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        backgroundThrottling: false,
        webSecurity: false,
        offscreen: false
      }
    });

    this.aiAssistWindow.setMenuBarVisibility(false);
    this.aiAssistWindow.setIgnoreMouseEvents(false);
    
    this.aiAssistWindow.once('ready-to-show', () => {
      this.aiAssistWindow.show();
      console.log('🤖 AI Assist chat is now visible');
    });

    this.aiAssistWindow.loadFile('src/views/ai-assist.html');
    this.aiAssistWindow.setMovable(true);
    this.applyContentProtection(this.aiAssistWindow);

    this.aiAssistWindow.on('closed', () => {
      this.aiAssistWindow = null;
      console.log('🤖 AI Assist window closed');
    });

    this.aiAssistWindow.webContents.on('did-finish-load', () => {
      console.log('🤖 AI Assist window finished loading');
    });
  }

  showBriefPanel() {
    if (this.briefWindow) {
      this.briefWindow.focus();
      return;
    }

    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    this.briefWindow = new BrowserWindow({
      width: 620,
      height: 700,
      minWidth: 400,
      minHeight: 500,
      maxWidth: 700,
      maxHeight: 900,
      x: Math.round((width - 620) / 2),
      y: Math.max(30, Math.round((height - 700) / 2)),
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      backgroundColor: 'rgba(0,0,0,0)',
      hasShadow: false,
      skipTaskbar: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.briefWindow.loadFile('src/views/brief-panel.html');
    this.briefWindow.setMovable(true);
    this.applyContentProtection(this.briefWindow);

    this.briefWindow.on('closed', () => {
      this.briefWindow = null;
    });
  }

  showEmailPanel() {
    if (this.emailWindow) {
      this.emailWindow.focus();
      return;
    }

    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    this.emailWindow = new BrowserWindow({
      width: 450,
      height: 500,
      x: Math.round((width - 450) / 2),
      y: Math.round((height - 500) / 2),
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      backgroundColor: 'rgba(0,0,0,0)',
      hasShadow: false,
      skipTaskbar: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.emailWindow.loadFile('src/views/email-panel-simple.html');
    this.emailWindow.setMovable(true);
    this.applyContentProtection(this.emailWindow);

    this.emailWindow.on('closed', () => {
      this.emailWindow = null;
    });
  }

  showListenPanel() {
    if (this.listenWindow) {
      this.listenWindow.focus();
      return;
    }

    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    this.listenWindow = new BrowserWindow({
      width: 500,
      height: 400,
      x: Math.round((width - 500) / 2),
      y: Math.round((height - 400) / 2),
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      backgroundColor: 'rgba(0,0,0,0)',
      hasShadow: false,
      skipTaskbar: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.listenWindow.loadFile('src/views/listen-panel.html');
    this.listenWindow.setMovable(true);
    this.applyContentProtection(this.listenWindow);

    this.listenWindow.on('closed', () => {
      this.listenWindow = null;
    });
  }
}

const rembraApp = new RembraApp();
rembraApp.initialize();