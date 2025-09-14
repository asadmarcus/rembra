/**
 * Beta Usage Manager - Enforces beta user limits across all features
 */

class BetaUsageManager {
    constructor() {
        this.limits = {
            transcription: 120, // minutes per month
            briefs: 15,         // briefs per month  
            emails: 20,         // emails per month
            aiAssist: 30        // AI assist requests per month
        };
    }

    getCurrentMonth() {
        const now = new Date();
        return `${now.getFullYear()}-${now.getMonth()}`;
    }

    getUsageKey(feature) {
        return `usage_${feature}_${this.getCurrentMonth()}`;
    }

    getCurrentUsage(feature) {
        return parseInt(localStorage.getItem(this.getUsageKey(feature)) || '0');
    }

    incrementUsage(feature, amount = 1) {
        const currentUsage = this.getCurrentUsage(feature);
        const newUsage = currentUsage + amount;
        localStorage.setItem(this.getUsageKey(feature), newUsage.toString());
        
        // Update the monthly totals for settings display
        const monthlyKey = `${feature}_used_this_month`;
        localStorage.setItem(monthlyKey, newUsage.toString());
        
        return newUsage;
    }

    checkLimit(feature, requestedAmount = 1) {
        const currentUsage = this.getCurrentUsage(feature);
        const limit = this.limits[feature];
        
        if (currentUsage + requestedAmount > limit) {
            return {
                allowed: false,
                currentUsage,
                limit,
                remaining: limit - currentUsage
            };
        }
        
        return {
            allowed: true,
            currentUsage,
            limit,
            remaining: limit - currentUsage - requestedAmount
        };
    }

    async enforceLimit(feature, requestedAmount = 1) {
        const check = this.checkLimit(feature, requestedAmount);
        
        if (!check.allowed) {
            const error = new Error(`Beta limit reached for ${feature}. Used: ${check.currentUsage}/${check.limit}`);
            error.code = 'BETA_LIMIT_EXCEEDED';
            error.feature = feature;
            error.usage = check;
            throw error;
        }
        
        // Increment usage and return success
        this.incrementUsage(feature, requestedAmount);
        return check;
    }

    getUsageStats() {
        return {
            transcription: {
                used: this.getCurrentUsage('transcription'),
                limit: this.limits.transcription,
                percentage: Math.round((this.getCurrentUsage('transcription') / this.limits.transcription) * 100)
            },
            briefs: {
                used: this.getCurrentUsage('briefs'),
                limit: this.limits.briefs,
                percentage: Math.round((this.getCurrentUsage('briefs') / this.limits.briefs) * 100)
            },
            emails: {
                used: this.getCurrentUsage('emails'),
                limit: this.limits.emails,
                percentage: Math.round((this.getCurrentUsage('emails') / this.limits.emails) * 100)
            },
            aiAssist: {
                used: this.getCurrentUsage('aiAssist'),
                limit: this.limits.aiAssist,
                percentage: Math.round((this.getCurrentUsage('aiAssist') / this.limits.aiAssist) * 100)
            }
        };
    }

    showLimitExceededDialog(feature, usage) {
        const { ipcRenderer } = require('electron');
        
        const messages = {
            transcription: `You've reached your beta limit of ${usage.limit} minutes of transcription this month. Used: ${usage.currentUsage} minutes.`,
            briefs: `You've reached your beta limit of ${usage.limit} briefs this month. Used: ${usage.currentUsage} briefs.`,
            emails: `You've reached your beta limit of ${usage.limit} emails this month. Used: ${usage.currentUsage} emails.`,
            aiAssist: `You've reached your beta limit of ${usage.limit} AI assist requests this month. Used: ${usage.currentUsage} requests.`
        };

        ipcRenderer.invoke('show-message-box', {
            type: 'warning',
            title: 'Beta Limit Reached',
            message: messages[feature] || 'Beta limit reached for this feature.',
            detail: 'Upgrade to premium when available for unlimited access!',
            buttons: ['OK', 'View Usage']
        }).then(result => {
            if (result.response === 1) {
                // Open settings to usage tab
                ipcRenderer.send('show-settings', 'usage');
            }
        });
    }
}

// Export singleton instance
module.exports = new BetaUsageManager();
