/* src/core/PlayerManager.js */

export default class PlayerManager {
    constructor() {
        // Default Local Players
        // We added a 'type' field to distinguish between keyboard users and phone users
        this.players = [
            { id: 0, type: 'local', name: 'Red', color: '#E24A4A', key: 'Shift', label: 'L-Shift', variant: 'default', accessory: 'Cat Ears' },
            { id: 1, type: 'local', name: 'Yellow', color: '#F4B84D', key: ' ', label: 'Space', variant: 'feminine', accessory: 'Bow' }
        ];

        // Palette for new players
        this.colors = ['#2ecc71', '#e67e22', '#1abc9c', '#e84393', '#9b59b6', '#3498db'];

        // Load saved players (Persistence)
        const saved = localStorage.getItem('arcade_players');
        if (saved) {
            try {
                // Only restore local players. Mobile players must reconnect every session.
                const parsed = JSON.parse(saved);
                this.players = parsed.filter(p => p.type === 'local');
            } catch (e) {
                console.error("Failed to load players", e);
            }
        }
    }

    getActivePlayers() { return this.players; }

    getPlayer(index) { return this.players[index]; }

    getPlayerById(id) { return this.players.find(p => p.id === id); }

    savePlayers() {
        // We only save local players to localStorage
        const localOnly = this.players.filter(p => p.type === 'local');
        localStorage.setItem('arcade_players', JSON.stringify(localOnly));
    }

    /**
     * Add a new player to the session.
     * @param {string} type - 'local' or 'mobile'
     */
    addPlayer(type = 'local') {
        // Determine next ID (safely handles gaps if players leave)
        const nextId = this.players.length > 0 ? Math.max(...this.players.map(p => p.id)) + 1 : 0;

        // Find next unused color
        const usedColors = this.players.map(p => p.color);
        const color = this.colors.find(c => !usedColors.includes(c)) || '#333';

        // Setup Input Keys (only for local)
        // This is a simple pool of keys for local co-op
        const inputPool = [
            { key: 'Shift', label: 'L-Shift' },
            { key: ' ', label: 'Space' },
            { key: '+', label: '+' },
            { key: 'Enter', label: 'Enter' },
            { key: 'z', label: 'Z' },
            { key: 'm', label: 'M' }
        ];

        let keyConfig = { key: null, label: 'Mobile' };

        if (type === 'local') {
            // Find first unused key
            const usedKeys = this.players.map(p => p.key);
            const available = inputPool.find(i => !usedKeys.includes(i.key));
            if (available) {
                keyConfig = available;
            } else {
                return null; // No more local keys available
            }
        }

        const newPlayer = {
            id: nextId,
            type: type,
            name: `P${nextId + 1}`,
            color: color,
            key: keyConfig.key,
            label: keyConfig.label,
            variant: 'default',
            accessory: 'Bear Ears'
        };

        this.players.push(newPlayer);

        if (type === 'local') this.savePlayers();

        return newPlayer;
    }

    removePlayer(index) {
        // Used by Lobby UI (index based)
        // Prevent removing the last 2 players if they are local, just for safety
        if (this.players.length <= 2 && this.players[index].type === 'local') return;

        const p = this.players[index];
        this.players.splice(index, 1);

        if (p.type === 'local') this.savePlayers();
    }

    removePlayerById(id) {
        // Used by NetworkManager
        const p = this.players.find(pl => pl.id === id);
        if (p) {
            this.players = this.players.filter(pl => pl.id !== id);
            if (p.type === 'local') this.savePlayers();
        }
    }

    updatePlayer(indexOrId, data) {
        // Handle both Array Index (from Lobby UI) and ID (from Network)
        let idx = -1;

        // Check if indexOrId is an ID (IDs are numbers, indices are numbers... tricky)
        // But our Lobby UI passes dataset indices (strings) or numbers.
        // Network passes ID.
        // Let's assume if it exists in the array at that index, use it, else search by ID.

        if (this.players[indexOrId]) {
            idx = indexOrId;
        } else {
            idx = this.players.findIndex(p => p.id === indexOrId);
        }

        if (idx !== -1) {
            this.players[idx] = { ...this.players[idx], ...data };
            if (this.players[idx].type === 'local') this.savePlayers();
        }
    }
}
