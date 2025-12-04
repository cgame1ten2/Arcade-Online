export default class PlayerManager {
    constructor() {
        // Default Config - Scalable and Editable
        this.players = [
            { id: 0, name: 'Red', color: '#E24A4A', key: 'Shift', label: 'L-Shift', variant: 'default', accessory: 'Cat Ears' },
            { id: 1, name: 'Yellow', color: '#F4B84D', key: ' ', label: 'Space', variant: 'feminine', accessory: 'Bow' },
            { id: 2, name: 'Blue', color: '#4D7BF4', key: '+', label: '+', variant: 'default', accessory: 'Headphones' },
            { id: 3, name: 'Purple', color: '#9D5ED4', key: 'Enter', label: 'Enter', variant: 'feminine', accessory: 'Sprout' }
        ];

        // Key Map Pool for Expansion
        this.availableInputs = [
            { key: 'Shift', label: 'L-Shift' },
            { key: ' ', label: 'Space' },
            { key: '+', label: '+' },
            { key: 'Enter', label: 'Enter' },
            { key: 'z', label: 'Z' },
            { key: 'm', label: 'M' },
            { key: 'q', label: 'Q' },
            { key: 'p', label: 'P' }
        ];

        // Persistence
        const saved = localStorage.getItem('arcade_players');
        if (saved) {
            try { this.players = JSON.parse(saved); } catch (e) { }
        }
    }

    getActivePlayers() { return this.players; }
    getPlayer(index) { return this.players[index]; }

    savePlayers() {
        localStorage.setItem('arcade_players', JSON.stringify(this.players));
    }

    addPlayer() {
        if (this.players.length >= this.availableInputs.length) return;

        const nextIdx = this.players.length;
        const input = this.availableInputs[nextIdx];

        const colors = ['#2ecc71', '#e67e22', '#1abc9c', '#e84393'];
        const color = colors[nextIdx % colors.length] || '#333';

        this.players.push({
            id: nextIdx,
            name: `P${nextIdx + 1}`,
            color: color,
            key: input.key,
            label: input.label,
            variant: 'default',
            accessory: 'Bear Ears'
        });

        this.savePlayers();
    }

    removePlayer(index) {
        if (this.players.length <= 2) return;
        this.players.splice(index, 1);

        // Re-index keys so they match physical layout order
        this.players.forEach((p, i) => {
            p.id = i;
            p.key = this.availableInputs[i].key;
            p.label = this.availableInputs[i].label;
        });

        this.savePlayers();
    }

    updatePlayer(index, data) {
        this.players[index] = { ...this.players[index], ...data };
        this.savePlayers();
    }
}