/* src/core/NetworkManager.js */

export default class NetworkManager {
    constructor(playerManager, inputManager) {
        this.players = playerManager;
        this.input = inputManager;

        this.peer = null; // PeerJS instance
        this.connections = new Map(); // Map<peerId, { conn, playerId, rtt }>
        this.roomId = null;

        // The calculated delay (in ms) to apply to local keyboard players to match network lag
        this.systemLag = 0;

        // Start the Heartbeat loop immediately (checks every 1 second)
        setInterval(() => this.measureLatency(), 1000);
    }

    /**
     * Initialize the Host session.
     * Generates a random 4-character room code and opens a PeerJS connection.
     */
    async hostGame() {
        // Generate a 4-char ID (Avoiding O/0, I/1 for readability)
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        this.roomId = '';
        for (let i = 0; i < 4; i++) {
            this.roomId += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Initialize PeerJS with a specific ID format
        // Note: Requires <script src="https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js"></script> in index.html
        this.peer = new window.Peer(`wonder-${this.roomId}`);

        this.peer.on('open', (id) => {
            console.log(`📡 Host Started. Room: ${this.roomId} (PeerID: ${id})`);
            if (this.onHostReady) this.onHostReady(this.roomId);
        });

        this.peer.on('connection', (conn) => this.handleConnection(conn));

        this.peer.on('error', (err) => {
            console.error("PeerJS Error:", err);
            // In a production app, handle collision (extremely rare) or network errors here
        });
    }

    /**
     * Handle a new mobile device connecting to the host.
     * @param {DataConnection} conn 
     */
    handleConnection(conn) {
        conn.on('open', () => {
            console.log(`📱 Phone Connected: ${conn.peer}`);

            // 1. Create a new Player for this phone
            // We pass 'mobile' type so PlayerManager knows not to assign keyboard keys
            const newPlayer = this.players.addPlayer('mobile');

            // 2. Store Connection Data
            this.connections.set(conn.peer, {
                conn: conn,
                playerId: newPlayer.id,
                rtt: 0 // Round Trip Time, starts at 0
            });

            // 3. Send Initial Configuration to Phone
            // This tells the phone who they are (Color, Name, ID)
            this.sendToPhone(conn, {
                type: 'INIT',
                playerId: newPlayer.id,
                color: newPlayer.color,
                name: newPlayer.name,
                accessory: newPlayer.accessory,
                variant: newPlayer.variant
            });

            // 4. Trigger a UI update on the Host to show the new player
            window.dispatchEvent(new CustomEvent('player-update'));
        });

        conn.on('data', (data) => this.handleData(conn.peer, data));

        conn.on('close', () => {
            console.log(`📱 Phone Disconnected: ${conn.peer}`);
            const data = this.connections.get(conn.peer);
            if (data) {
                // Remove player from game logic
                this.players.removePlayerById(data.playerId);
                this.connections.delete(conn.peer);

                // Recalculate lag since a device left
                this.recalculateLag();

                // Update UI
                window.dispatchEvent(new CustomEvent('player-update'));
            }
        });
    }

    /**
     * Process incoming data packets from phones.
     * @param {string} peerId 
     * @param {object} data 
     */
    handleData(peerId, data) {
        const client = this.connections.get(peerId);
        if (!client) return;

        switch (data.type) {
            case 'PONG':
                // Latency Response
                const now = performance.now();
                client.rtt = now - data.ts;
                this.recalculateLag();
                break;

            case 'INPUT':
                // Game Input (Press/Release/Touch)
                // We pass 'true' as 3rd arg to InputManager to skip the artificial delay
                // because this signal has already traveled over the network.
                this.input.triggerInput(client.playerId, data.action, true, data.payload);
                break;

            case 'UPDATE_PROFILE':
                // User changed color/name/accessory in the Mobile Lobby
                this.players.updatePlayer(client.playerId, data.payload);
                window.dispatchEvent(new CustomEvent('player-update'));
                break;
        }
    }

    /**
     * Broadcast a global state change to all connected phones.
     * Used to switch screens from Lobby -> Controller -> Touchpad.
     * @param {string} stateType - 'LOBBY', 'CONTROLLER', 'TOUCHPAD'
     * @param {object} payload - Optional extra data (e.g., game specific config)
     */
    broadcastState(stateType, payload = {}) {
        this.connections.forEach((client) => {
            // Fetch latest player data to ensure phone is synced
            const player = this.players.getPlayerById(client.playerId);
            if (!player) return;

            const packet = {
                type: 'STATE_CHANGE',
                state: stateType,
                player: {
                    color: player.color,
                    name: player.name,
                    accessory: player.accessory,
                    variant: player.variant
                },
                ...payload
            };

            if (client.conn.open) client.conn.send(packet);
        });
    }

    /**
     * Helper to send data to a specific connection
     */
    sendToPhone(conn, data) {
        if (conn && conn.open) conn.send(data);
    }

    /**
     * Periodic check to measure network latency.
     */
    measureLatency() {
        if (this.connections.size === 0) {
            this.systemLag = 0;
            return;
        }

        const now = performance.now();
        this.connections.forEach(client => {
            if (client.conn.open) {
                client.conn.send({ type: 'PING', ts: now });
            }
        });
    }

    /**
     * Calculates the "Fairness Delay".
     * It takes the average RTT (Round Trip Time) of all phones, divides by 2 (One-Way Trip),
     * and sets that as the artificial delay for local keyboard players.
     */
    recalculateLag() {
        if (this.connections.size === 0) {
            this.systemLag = 0;
            return;
        }

        let totalRTT = 0;
        this.connections.forEach(c => totalRTT += c.rtt);
        const avgRTT = totalRTT / this.connections.size;

        // One-way trip is roughly RTT / 2.
        this.systemLag = Math.floor(avgRTT / 2);
    }
}
