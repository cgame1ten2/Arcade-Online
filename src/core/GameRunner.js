export default class GameRunner {
    constructor(playerManager, inputManager, uiManager, audioManager) {
        this.realPlayerManager = playerManager; 
        this.inputManager = inputManager;
        this.uiManager = uiManager; // Real UI Manager
        this.audioManager = audioManager;
        
        this.activeGame = null;
        this.activeP5 = null;
        
        // Mock UI for Demos so they don't hijack the scoreboard
        this.mockUI = {
            updateScoreboard: () => {},
            showMessage: () => {},
            showTurnMessage: () => {},
            hideMessage: () => {},
            showPodium: () => {},
            showTournamentStandings: () => {}
        };

        this.context = {
            players: null, 
            input: this.inputManager,
            ui: null, // Will be set in mount
            audio: this.audioManager,
            p5: null
        };
    }

    mount(GameClass, containerId, mode = 'active', onComplete = null, ruleOverrides = {}) {
        // 1. UI CLEANUP (Only for Active games)
        if (mode !== 'demo') {
            this.uiManager.hideMessage();
        }

        // 2. ACTIVE GAME CLEANUP
        // Only kill previous ACTIVE game, don't touch demos running in background here
        if (mode !== 'demo') {
            if (this.activeGame) {
                if (this.activeGame.destroy) this.activeGame.destroy();
                this.activeGame = null;
            }
            if (this.activeP5) {
                this.activeP5.remove();
                this.activeP5 = null;
            }
        }

        const container = document.getElementById(containerId);
        if (container) container.innerHTML = '';

        // 3. CONFIGURE SESSION
        let sessionPlayerManager;
        let sessionUI;

        if (mode === 'demo') {
            sessionUI = this.mockUI; // ISOLATE UI
            sessionPlayerManager = {
                getActivePlayers: () => [
                    { id: 0, name: 'NPC 1', color: '#FF6B6B', variant: 'default', accessory: 'Cat Ears' },
                    { id: 1, name: 'NPC 2', color: '#4D96FF', variant: 'feminine', accessory: 'Bow' },
                    { id: 2, name: 'NPC 3', color: '#6BCB77', variant: 'default', accessory: 'Headphones' }
                ],
                getPlayer: (id) => null
            };
        } else {
            sessionUI = this.uiManager; // Real UI
            sessionPlayerManager = this.realPlayerManager;
        }

        const sketch = (p) => {
            const gameContext = { 
                ...this.context, 
                players: sessionPlayerManager,
                ui: sessionUI,
                p5: p 
            };
            
            const fullRules = { mode: mode, ...ruleOverrides };
            
            const game = new GameClass(gameContext, fullRules);
            game.onGameComplete = onComplete;

            // BIND INPUTS
            this.inputManager.setGameListener((playerId, action) => {
                // Only route inputs to the Active game or if specifically needed
                if (mode !== 'demo' && game && game.handleInput) {
                    game.handleInput(playerId, action);
                }
            });

            p.setup = () => {
                p.pixelDensity(1);
                game.setup();
                if (mode === 'demo') p.frameRate(30); 
            };

            p.draw = () => {
                game.draw();
            };
            
            p.windowResized = () => {
                if (container) {
                    p.resizeCanvas(container.offsetWidth, container.offsetHeight);
                    game.calculateLayout();
                }
            };

            if (mode !== 'demo') this.activeGame = game;
        };

        const p5Instance = new p5(sketch, containerId);
        
        if (mode === 'active' || mode === 'tournament') {
            this.activeP5 = p5Instance;
        }

        // Return instance so Main.js can track and pause demos
        return p5Instance; 
    }
}