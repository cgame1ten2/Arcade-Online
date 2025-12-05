/* src/core/NetworkManager.js */

export default class NetworkManager {
    constructor(playerManager, inputManager) {
        this.players = playerManager;
        this.input = inputManager;
        this.peer = null;
        this.connections = new Map(); // Map<peerId, { conn, playerId, lastHeartbeat, rtt }>
        this.roomId = null;
        this.systemLag = 0; 
        
        // Start Heartbeat Loop (Latency + Zombie Check)
        setInterval(() => this.maintenanceLoop(), 1000);
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
        
        this.peer.on('connection', (c) => this.handleRawConnection(c));
    }

    handleRawConnection(conn) {
        // We do NOT add a player yet. We wait for the Handshake.
        conn.on('open', () => {
            // Ask for credentials
            conn.send({ type: 'WHO_ARE_YOU' });
        });

        conn.on('data', (data) => this.handleDataPacket(conn, data));
        
        conn.on('close', () => {
            this.disconnectPeer(conn.peer);
        });
        
        conn.on('error', () => {
            this.disconnectPeer(conn.peer);
        });
    }

    handleDataPacket(conn, data) {
        // 1. HANDSHAKE (The most important part)
        if (data.type === 'HELLO') {
            const uuid = data.uuid;
            this.registerPlayer(conn, uuid);
            return;
        }

        // 2. STANDARD PACKETS (Require registered connection)
        const client = this.connections.get(conn.peer);
        
        // Security: Ignore packets from unregistered peers
        if (!client) return; 

        // Update Heartbeat
        client.lastHeartbeat = performance.now();

        switch (data.type) {
            case 'PONG':
                client.rtt = performance.now() - data.ts;
                break;
                
            case 'INPUT':
                this.input.triggerInput(client.playerId, data.action, true, data.payload);
                break;
                
            case 'UPDATE_PROFILE':
                this.players.updatePlayer(client.playerId, data.payload);
                window.dispatchEvent(new CustomEvent('player-update')); 
                break;
                
            case 'COMMAND':
                window.dispatchEvent(new CustomEvent('remote-command', { detail: data }));
                break;
        }
    }

    registerPlayer(conn, uuid) {
        // Check if this UUID exists (Reconnection)
        const existingPlayer = this.players.getPlayerByUUID(uuid);

        if (existingPlayer) {
            console.log(`♻️ Player Reconnected: ${existingPlayer.name} (${uuid})`);
            
            // Check if there is an old stale connection for this player and kill it
            for (const [peerId, client] of this.connections.entries()) {
                if (client.playerId === existingPlayer.id && peerId !== conn.peer) {
                    this.connections.delete(peerId);
                }
            }

            // Bind new connection to existing ID
            this.connections.set(conn.peer, { 
                conn, 
                playerId: existingPlayer.id, 
                lastHeartbeat: performance.now(), 
                rtt: 0 
            });

            // Send State Sync immediately
            this.syncPlayerState(conn, existingPlayer);

        } else {
            console.log(`✨ New Player: ${uuid}`);
            // New Player
            const newPlayer = this.players.addPlayer('mobile', uuid);
            
            this.connections.set(conn.peer, { 
                conn, 
                playerId: newPlayer.id, 
                lastHeartbeat: performance.now(), 
                rtt: 0 
            });

            // Send Init
            this.syncPlayerState(conn, newPlayer);
            window.dispatchEvent(new CustomEvent('player-update'));
        }
    }

    syncPlayerState(conn, player) {
        // Send identity
        this.sendToPhone(conn, {
            type: 'INIT', 
            playerId: player.id,
            color: player.color, 
            name: player.name,
            accessory: player.accessory, 
            variant: player.variant
        });

        // Send current game state context (Lobby/Game/etc) logic handled by main.js broadcasting
        // But we should trigger a refresh on the host side to ensure this specific phone gets updated
        // For now, main.js loop handles general broadcast.
    }

    disconnectPeer(peerId) {
        // We do NOT remove the player immediately. 
        // We just remove the connection. The player might reconnect in 2 seconds.
        // The "Zombie Reaper" will remove the player if they don't return.
        if (this.connections.has(peerId)) {
            console.log(`🔌 Connection Dropped: ${peerId}`);
            this.connections.delete(peerId);
            this.recalculateLag();
        }
    }

    maintenanceLoop() {
        const now = performance.now();
        
        // 1. Send Pings & Check Zombies
        this.connections.forEach((client, peerId) => {
            if (client.conn.open) {
                client.conn.send({ type: 'PING', ts: now });
            }

            // Zombie Check: If no heartbeat for 10 seconds, Kick Player
            // (Increased from 5s to 10s to be generous with laggy phones)
            if (now - client.lastHeartbeat > 10000) {
                console.log(`💀 Zombie Reaper: Kicking Player ${client.playerId}`);
                this.players.removePlayerById(client.playerId);
                this.connections.delete(peerId);
                window.dispatchEvent(new CustomEvent('player-update'));
            }
        });

        this.recalculateLag();
    }

    recalculateLag() {
        if (this.connections.size === 0) { this.systemLag = 0; return; }
        let totalRTT = 0;
        this.connections.forEach(c => totalRTT += c.rtt);
        this.systemLag = Math.floor((totalRTT / this.connections.size) / 2);
    }

    // --- BROADCAST ---
    broadcastState(stateType, context = 'IDLE', payload = {}) {
        this.connections.forEach((client) => {
            const player = this.players.getPlayerById(client.playerId);
            if(!player) return; // Player might have been reaped
            const packet = {
                type: 'STATE_CHANGE', 
                state: stateType, 
                context: context,
                player: { 
                    color: player.color, name: player.name, 
                    accessory: player.accessory, variant: player.variant 
                },
                ...payload
            };
            if(client.conn.open) client.conn.send(packet);
        });
    }

    sendToPhone(conn, data) { if (conn && conn.open) conn.send(data); }
}
