/* src/core/NetworkManager.js */

export default class NetworkManager {
    constructor(playerManager, inputManager) {
        this.players = playerManager;
        this.input = inputManager;
        this.peer = null;
        this.connections = new Map();
        this.roomId = null;
        this.systemLag = 0; 
        setInterval(() => this.measureLatency(), 1000);
    }

    async hostGame() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        this.roomId = '';
        for (let i = 0; i < 4; i++) this.roomId += chars.charAt(Math.floor(Math.random() * chars.length));

        this.peer = new window.Peer(`wonder-${this.roomId}`);
        this.peer.on('open', (id) => {
            console.log(`📡 Host Started: ${this.roomId}`);
            if (this.onHostReady) this.onHostReady(this.roomId);
        });
        this.peer.on('connection', (c) => this.handleConnection(c));
    }

    handleConnection(conn) {
        conn.on('open', () => {
            const newPlayer = this.players.addPlayer('mobile'); 
            this.connections.set(conn.peer, { conn, playerId: newPlayer.id, rtt: 0 });
            this.sendToPhone(conn, {
                type: 'INIT', playerId: newPlayer.id,
                color: newPlayer.color, name: newPlayer.name,
                accessory: newPlayer.accessory, variant: newPlayer.variant
            });
            window.dispatchEvent(new CustomEvent('player-update'));
        });

        conn.on('data', (data) => this.handleData(conn.peer, data));
        
        conn.on('close', () => {
            const data = this.connections.get(conn.peer);
            if (data) {
                this.players.removePlayerById(data.playerId);
                this.connections.delete(conn.peer);
                this.recalculateLag();
                window.dispatchEvent(new CustomEvent('player-update'));
            }
        });
    }

    handleData(peerId, data) {
        const client = this.connections.get(peerId);
        if (!client) return;

        switch (data.type) {
            case 'PONG':
                client.rtt = performance.now() - data.ts;
                this.recalculateLag();
                break;
            case 'INPUT':
                this.input.triggerInput(client.playerId, data.action, true, data.payload);
                break;
            case 'UPDATE_PROFILE':
                this.players.updatePlayer(client.playerId, data.payload);
                window.dispatchEvent(new CustomEvent('player-update')); 
                break;
            // NEW: COMMAND HANDLING
            case 'COMMAND':
                window.dispatchEvent(new CustomEvent('remote-command', { detail: data.action }));
                break;
        }
    }

    broadcastState(stateType, payload = {}) {
        this.connections.forEach((client) => {
            const player = this.players.getPlayerById(client.playerId);
            if(!player) return;
            const packet = {
                type: 'STATE_CHANGE', state: stateType, 
                player: { color: player.color, name: player.name, accessory: player.accessory, variant: player.variant },
                ...payload
            };
            if(client.conn.open) client.conn.send(packet);
        });
    }

    sendToPhone(conn, data) { if (conn && conn.open) conn.send(data); }

    measureLatency() {
        if (this.connections.size === 0) { this.systemLag = 0; return; }
        const now = performance.now();
        this.connections.forEach(client => { if (client.conn.open) client.conn.send({ type: 'PING', ts: now }); });
    }

    recalculateLag() {
        if (this.connections.size === 0) { this.systemLag = 0; return; }
        let totalRTT = 0;
        this.connections.forEach(c => totalRTT += c.rtt);
        this.systemLag = Math.floor((totalRTT / this.connections.size) / 2);
    }
}
