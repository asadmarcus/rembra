const Store = require('electron-store');
const { BrowserWindow } = require('electron');

class ClientManager {
    constructor() {
        this.store = new Store();
        this.clients = this.loadClients();
        this.notifyTimeout = null;
    }

    loadClients() {
        return this.store.get('rembra_clients', []);
    }

    saveClients() {
        this.store.set('rembra_clients', this.clients);
        // Notify all windows about client updates
        this.notifyClientsUpdated();
    }

    notifyClientsUpdated() {
        // Get all windows and notify them, but throttle to prevent spam
        if (this.notifyTimeout) {
            clearTimeout(this.notifyTimeout);
        }
        
        this.notifyTimeout = setTimeout(() => {
            BrowserWindow.getAllWindows().forEach(window => {
                if (!window.isDestroyed()) {
                    try {
                        window.webContents.send('clients-updated');
                    } catch (error) {
                        // Window might be destroyed between check and send
                        console.log('Failed to notify window (non-critical):', error.message);
                    }
                }
            });
            this.notifyTimeout = null;
        }, 100); // Throttle notifications to every 100ms
    }

    setupIPC(ipcMain) {
        // Handle client operations from renderer processes
        ipcMain.handle('get-clients', () => {
            return this.getAllClients();
        });

        ipcMain.handle('add-client', (event, clientData) => {
            return this.addClient(clientData);
        });

        ipcMain.handle('update-client', (event, clientId, updates) => {
            return this.updateClient(clientId, updates);
        });

        ipcMain.handle('delete-client', (event, clientId) => {
            this.deleteClient(clientId);
            return { success: true };
        });

        ipcMain.handle('add-brief-to-client', (event, clientId, brief) => {
            return this.addBriefToClient(clientId, brief);
        });
    }

    addClient(client) {
        const newClient = {
            id: Date.now().toString(),
            name: client.name,
            company: client.company,
            industry: client.industry || '',
            email: client.email || '',
            notes: client.notes || '',
            topics: client.topics || ['General'],
            briefHistory: [],
            createdAt: new Date()
        };
        
        this.clients.push(newClient);
        this.saveClients();
        return newClient;
    }

    updateClient(clientId, updates) {
        const index = this.clients.findIndex(c => c.id === clientId);
        if (index !== -1) {
            this.clients[index] = { ...this.clients[index], ...updates };
            this.saveClients();
            return this.clients[index];
        }
        return null;
    }

    deleteClient(clientId) {
        this.clients = this.clients.filter(c => c.id !== clientId);
        this.saveClients();
    }

    addBriefToClient(clientId, brief) {
        const client = this.clients.find(c => c.id === clientId);
        if (client) {
            const newBrief = {
                id: Date.now().toString(),
                title: brief.title,
                objective: brief.objective,
                content: brief.content,
                topic: brief.topic || 'General',
                isFollowUp: brief.isFollowUp || false,
                createdAt: new Date()
            };
            
            client.briefHistory.push(newBrief);
            this.saveClients();
            return newBrief;
        }
        return null;
    }

    addTopicToClient(clientId, topic) {
        const client = this.clients.find(c => c.id === clientId);
        if (client && !client.topics.includes(topic)) {
            client.topics.push(topic);
            this.saveClients();
        }
    }

    getClient(clientId) {
        return this.clients.find(c => c.id === clientId);
    }

    getAllClients() {
        return this.clients;
    }

    cleanup() {
        if (this.notifyTimeout) {
            clearTimeout(this.notifyTimeout);
            this.notifyTimeout = null;
        }
    }
}

module.exports = ClientManager;