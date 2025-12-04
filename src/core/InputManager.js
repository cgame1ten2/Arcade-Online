/* src/core/InputManager.js */

export default class InputManager {
    constructor(playerManager) {
        this.playerManager = playerManager;
        this.activeGameListener = null; // Callback function provided by the active Game instance

        // Reference to NetworkManager to read systemLag
        this.networkManager = null;

        // Bind Window Events for Local Keyboard
        window.addEventListener('keydown', (e) => this.handleKey(e, 'PRESS'));
        window.addEventListener('keyup', (e) => this.handleKey(e, 'RELEASE'));
    }

    /**
     * Connects the NetworkManager so we can read the calculated lag.
     */
    setNetworkManager(nm) {
        this.networkManager = nm;
    }

    /**
     * Sets the callback that fires when an input occurs.
     * Usually bound by GameRunner.js.
     */
    setGameListener(callback) {
        this.activeGameListener = callback;
    }

    /**
     * Process raw keyboard events.
     */
    handleKey(e, type) {
        // Prevent default scrolling for game keys
        if (['Space', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
            e.preventDefault();
        }

        // Map Key to Player
        let key = e.key;
        // Handle Numpad edge cases
        if (e.code === 'NumpadAdd' || e.code === 'Equal') key = '+';

        const players = this.playerManager.getActivePlayers();
        // Only look for players with a defined 'key' (Local Players)
        const player = players.find(p => p.key === key);

        if (player) {
            // Local Input -> Needs artificial delay if phones are connected
            // isNetworkInput = false
            this.triggerInput(player.id, type, false);
        }
    }

    /**
     * The central funnel for all game inputs (Keyboard AND Network).
     * 
     * @param {number} playerId - The ID of the player
     * @param {string} type - 'PRESS', 'RELEASE', or 'TOUCH'
     * @param {boolean} isNetworkInput - True if coming from Phone, False if Local Keyboard
     * @param {object} payload - Optional data (e.g. touch coordinates)
     */
    triggerInput(playerId, type, isNetworkInput, payload = null) {
        if (!this.activeGameListener) return;

        if (isNetworkInput) {
            // 1. Network Input: Execute Immediately
            // It has already suffered physical network latency, so it is "fair" now.
            this.activeGameListener(playerId, type, payload);
        } else {
            // 2. Local Input: Check for Fairness Delay
            const delay = this.networkManager ? this.networkManager.systemLag : 0;

            if (delay > 0) {
                // Apply artificial lag to match the phones
                setTimeout(() => {
                    this.activeGameListener(playerId, type, payload);
                }, delay);
            } else {
                // Instant execution if no phones connected
                this.activeGameListener(playerId, type, payload);
            }
        }
    }
}
