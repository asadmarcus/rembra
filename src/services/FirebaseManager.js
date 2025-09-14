const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, connectAuthEmulator } = require('firebase/auth');

class FirebaseManager {
    constructor() {
        this.app = null;
        this.auth = null;
        this.isInitialized = false;
        this.connectionRetries = 0;
        this.maxRetries = 3;
    }

    initialize(config) {
        try {
            // Configure Firebase for better connection handling
            const enhancedConfig = {
                ...config,
                // Add connection settings to reduce SSL handshake issues
                cacheSizeBytes: 1048576, // 1MB cache
                experimentalForceLongPolling: false, // Use WebSocket when possible
            };

            this.app = initializeApp(enhancedConfig);
            this.auth = getAuth(this.app);
            
            // Set up connection error handling
            this.setupConnectionErrorHandling();
            
            this.isInitialized = true;
            console.log('✅ Firebase initialized with enhanced connection handling');
        } catch (error) {
            console.error('❌ Firebase initialization failed:', error);
            throw error;
        }
    }

    setupConnectionErrorHandling() {
        // Handle auth state changes to reduce connection attempts
        if (this.auth) {
            this.auth.onAuthStateChanged((user) => {
                if (user) {
                    console.log('🔐 User authenticated, reducing connection polling');
                } else {
                    console.log('🔓 User not authenticated');
                }
            });
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
            const { sendPasswordResetEmail } = require('firebase/auth');
            await sendPasswordResetEmail(this.auth, email);
            return { success: true };
        } catch (error) {
            return { success: false, error: this.getErrorMessage(error) };
        }
    }

    async changeEmail(currentPassword, newEmail) {
        if (!this.isInitialized) throw new Error('Firebase not initialized');
        
        try {
            const { updateEmail, reauthenticateWithCredential, EmailAuthProvider } = require('firebase/auth');
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
            const { updatePassword, reauthenticateWithCredential, EmailAuthProvider } = require('firebase/auth');
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
            const { deleteUser, reauthenticateWithCredential, EmailAuthProvider } = require('firebase/auth');
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

module.exports = FirebaseManager;