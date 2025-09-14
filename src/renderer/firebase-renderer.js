/**
 * Firebase Renderer Manager
 * Handles Firebase operations in the renderer process to avoid Node.js TLS issues
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  GoogleAuthProvider, 
  signInWithPopup,
  sendPasswordResetEmail,
  updateEmail,
  updatePassword,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';

class FirebaseRenderer {
  constructor() {
    this.app = null;
    this.auth = null;
    this.isInitialized = false;
  }

  initialize(config) {
    try {
      console.log('🔥 Initializing Firebase in renderer process...');
      
      // Initialize Firebase in renderer context (uses Chromium's TLS)
      this.app = initializeApp(config);
      this.auth = getAuth(this.app);
      
      // Set up auth state listener
      this.auth.onAuthStateChanged((user) => {
        if (user) {
          console.log('🔐 User authenticated in renderer:', user.email);
        } else {
          console.log('🔓 User signed out in renderer');
        }
      });
      
      this.isInitialized = true;
      console.log('✅ Firebase initialized successfully in renderer process');
    } catch (error) {
      console.error('❌ Firebase renderer initialization failed:', error);
      throw error;
    }
  }

  async signIn(email, password) {
    if (!this.isInitialized) throw new Error('Firebase not initialized');
    
    try {
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  async signUp(email, password) {
    if (!this.isInitialized) throw new Error('Firebase not initialized');
    
    try {
      const result = await createUserWithEmailAndPassword(this.auth, email, password);
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  async signOut() {
    if (!this.isInitialized) throw new Error('Firebase not initialized');
    
    try {
      await signOut(this.auth);
      return { success: true };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  async signInWithGoogle() {
    if (!this.isInitialized) throw new Error('Firebase not initialized');
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.auth, provider);
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  getCurrentUser() {
    if (!this.isInitialized) return null;
    return this.auth.currentUser;
  }

  async sendPasswordReset(email) {
    if (!this.isInitialized) throw new Error('Firebase not initialized');
    
    try {
      await sendPasswordResetEmail(this.auth, email);
      return { success: true };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  async changeEmail(currentPassword, newEmail) {
    if (!this.isInitialized) throw new Error('Firebase not initialized');
    
    try {
      const user = this.auth.currentUser;
      if (!user) throw new Error('No user logged in');
      
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update email
      await updateEmail(user, newEmail);
      return { success: true };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  async changePassword(currentPassword, newPassword) {
    if (!this.isInitialized) throw new Error('Firebase not initialized');
    
    try {
      const user = this.auth.currentUser;
      if (!user) throw new Error('No user logged in');
      
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
      return { success: true };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  async deleteAccount(password) {
    if (!this.isInitialized) throw new Error('Firebase not initialized');
    
    try {
      const user = this.auth.currentUser;
      if (!user) throw new Error('No user logged in');
      
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      
      // Delete user
      await deleteUser(user);
      return { success: true };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  getErrorMessage(error) {
    switch (error.code) {
      case 'auth/invalid-email':
        return 'Invalid email address';
      case 'auth/wrong-password':
        return 'Incorrect password';
      case 'auth/user-not-found':
        return 'No account found with this email';
      case 'auth/email-already-in-use':
        return 'An account already exists with this email';
      case 'auth/weak-password':
        return 'Password is too weak';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection';
      default:
        return error.message;
    }
  }
}

// Create global instance
window.firebaseRenderer = new FirebaseRenderer();

export default FirebaseRenderer;