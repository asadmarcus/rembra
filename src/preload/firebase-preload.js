/**
 * Firebase Preload Script
 * Initializes Firebase in the renderer process context to avoid Node.js TLS issues
 */

const { contextBridge, ipcRenderer } = require('electron');

// Firebase will be initialized in the renderer process
contextBridge.exposeInMainWorld('firebaseAPI', {
  // Authentication methods
  signIn: async (email, password) => {
    return await ipcRenderer.invoke('firebase-signin', { email, password });
  },
  
  signUp: async (email, password) => {
    return await ipcRenderer.invoke('firebase-signup', { email, password });
  },
  
  signOut: async () => {
    return await ipcRenderer.invoke('firebase-signout');
  },
  
  getCurrentUser: async () => {
    return await ipcRenderer.invoke('firebase-get-user');
  },
  
  sendPasswordReset: async (email) => {
    return await ipcRenderer.invoke('firebase-password-reset', email);
  },
  
  changeEmail: async (currentPassword, newEmail) => {
    return await ipcRenderer.invoke('firebase-change-email', { currentPassword, newEmail });
  },
  
  changePassword: async (currentPassword, newPassword) => {
    return await ipcRenderer.invoke('firebase-change-password', { currentPassword, newPassword });
  },
  
  deleteAccount: async (password) => {
    return await ipcRenderer.invoke('firebase-delete-account', { password });
  }
});

console.log('🔥 Firebase preload script loaded - Firebase will run in renderer context');