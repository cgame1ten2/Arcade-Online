export default class InputManager {
    constructor(playerManager) {
        this.playerManager = playerManager;
        this.activeGameListener = null; // Callback for the active game

        // Bind Window Events
        window.addEventListener('keydown', (e) => this.handleKey(e, 'PRESS'));
        window.addEventListener('keyup', (e) => this.handleKey(e, 'RELEASE'));
    }

    setGameListener(callback) {
        this.activeGameListener = callback;
    }

    handleKey(e, type) {
        // 1. Prevent Default Scrolling
        if (['Space', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
            e.preventDefault();
        }

        // 2. Map Key to Player
        let key = e.key;
        // Handle Aliases
        if (e.code === 'NumpadAdd' || e.code === 'Equal') key = '+';

        const players = this.playerManager.getActivePlayers();
        // Determine if we are in a mode where we check keys (Active/Tournament)
        // Note: In 'demo', there are no physical keys mapped to the NPCs, 
        // so this naturally ignores keyboard input for NPCs.
        const player = players.find(p => p.key === key);

        // 3. Fire Callback
        if (player && this.activeGameListener) {
            this.activeGameListener(player.id, type);
        }
    }
}