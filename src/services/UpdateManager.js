const { autoUpdater } = require('electron-updater');
const { dialog, app } = require('electron');

class UpdateManager {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.setupAutoUpdater();
    }

    setupAutoUpdater() {
        // Only enable auto-updater in production builds
        if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
            console.log('🔧 Development mode - auto-updater disabled');
            return;
        }
        
        // Configure auto-updater
        autoUpdater.checkForUpdatesAndNotify();
        
        // Auto-updater events
        autoUpdater.on('checking-for-update', () => {
            console.log('🔍 Checking for updates...');
        });

        autoUpdater.on('update-available', (info) => {
            console.log('📦 Update available:', info.version);
            this.showUpdateAvailableDialog(info);
        });

        autoUpdater.on('update-not-available', () => {
            console.log('✅ App is up to date');
        });

        autoUpdater.on('error', (err) => {
            console.error('❌ Update error:', err);
        });

        autoUpdater.on('download-progress', (progressObj) => {
            let log_message = `📥 Download speed: ${progressObj.bytesPerSecond}`;
            log_message += ` - Downloaded ${progressObj.percent}%`;
            log_message += ` (${progressObj.transferred}/${progressObj.total})`;
            console.log(log_message);
            
            // Send progress to renderer if needed
            if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('update-progress', progressObj);
            }
        });

        autoUpdater.on('update-downloaded', (info) => {
            console.log('✅ Update downloaded:', info.version);
            this.showUpdateReadyDialog(info);
        });
    }

    showUpdateAvailableDialog(info) {
        const response = dialog.showMessageBoxSync(this.mainWindow, {
            type: 'info',
            title: 'Update Available',
            message: `A new version (${info.version}) is available!`,
            detail: 'Do you want to download it now? The update will be installed when you restart the app.',
            buttons: ['Download Now', 'Later'],
            defaultId: 0
        });

        if (response === 0) {
            autoUpdater.downloadUpdate();
        }
    }

    showUpdateReadyDialog(info) {
        const response = dialog.showMessageBoxSync(this.mainWindow, {
            type: 'info',
            title: 'Update Ready',
            message: `Update (${info.version}) has been downloaded!`,
            detail: 'The update will be applied when you restart the app. Restart now?',
            buttons: ['Restart Now', 'Later'],
            defaultId: 0
        });

        if (response === 0) {
            autoUpdater.quitAndInstall();
        }
    }

    // Manual check for updates (can be called from menu)
    checkForUpdates() {
        // In development mode, show a message instead
        if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
            dialog.showMessageBox(this.mainWindow, {
                type: 'info',
                title: 'Development Mode',
                message: 'Auto-updater is disabled in development mode',
                detail: 'Updates will work automatically in the packaged app.',
                buttons: ['OK']
            });
            return;
        }
        
        autoUpdater.checkForUpdatesAndNotify();
    }

    // Force update check
    async checkForUpdatesManual() {
        // In development mode, show a message instead
        if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
            dialog.showMessageBox(this.mainWindow, {
                type: 'info',
                title: 'Development Mode',
                message: 'Auto-updater is disabled in development mode',
                detail: 'Updates will work automatically in the packaged app.',
                buttons: ['OK']
            });
            return;
        }
        
        try {
            const result = await autoUpdater.checkForUpdates();
            if (!result.downloadPromise) {
                dialog.showMessageBox(this.mainWindow, {
                    type: 'info',
                    title: 'No Updates',
                    message: 'You are running the latest version!',
                    buttons: ['OK']
                });
            }
        } catch (error) {
            dialog.showMessageBox(this.mainWindow, {
                type: 'error',
                title: 'Update Check Failed',
                message: 'Failed to check for updates',
                detail: error.message,
                buttons: ['OK']
            });
        }
    }
}

module.exports = UpdateManager;
