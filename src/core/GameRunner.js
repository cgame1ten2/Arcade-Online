/* src/core/GameRunner.js */

export default class GameRunner {
    constructor(playerManager, inputManager, uiManager, audioManager) {
        this.realPlayerManager = playerManager; 
        this.inputManager = inputManager;
        this.uiManager = uiManager; 
        this.audioManager = audioManager;
        
        this.activeGame = null;
        this.activeP5 = null;
        
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
            ui: null, 
            audio: this.audioManager,
            p5: null
        };
    }

    mount(GameClass, containerId, mode = 'active', onComplete = null, ruleOverrides = {}) {
        if (mode !== 'demo') {
            this.uiManager.hideMessage();
            if (this.activeGame) {
                if (this.activeGame.destroy) this.activeGame.destroy();
                this.activeGame = null;
            }
            if (this.activeP5) {
                this.activeP5.remove();
                this.activeP5 = null;
            }
        }

        // --- FIX: STOP HERE IF NO GAME CLASS PROVIDED ---
        if (!GameClass) return null;

        const container = document.getElementById(containerId);
        if (container) container.innerHTML = '';

        let sessionPlayerManager;
        let sessionUI;

        if (mode === 'demo') {
            sessionUI = this.mockUI; 
            sessionPlayerManager = {
                getActivePlayers: () => [
                    { id: 0, name: 'NPC 1', color: '#FF6B6B', variant: 'default', accessory: 'Cat Ears' },
                    { id: 1, name: 'NPC 2', color: '#4D96FF', variant: 'feminine', accessory: 'Bow' },
                    { id: 2, name: 'NPC 3', color: '#6BCB77', variant: 'default', accessory: 'Headphones' }
                ],
                getPlayer: (id) => null
            };
        } else {
            sessionUI = this.uiManager; 
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

            this.inputManager.setGameListener((playerId, action, payload) => {
                if (mode !== 'demo' && game && game.handleInput) {
                    game.handleInput(playerId, action, payload);
                }
            });

            p.setup = () => {
                p.pixelDensity(1);
                game.setup();
                if (mode === 'demo') p.frameRate(30); 
            };

            p.draw = () => { game.draw(); };
            
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

        return p5Instance; 
    }
}
