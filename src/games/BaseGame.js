/* src/core/BaseGame.js */

export default class BaseGame {
    constructor(context, rules = {}) {
        this.p = context.p5;
        this.audio = context.audio;
        this.ui = context.ui;
        this.context = context;

        this.allPlayers = context.players.getActivePlayers();
        
        this.mode = rules.mode || 'active';
        this.config = {
            winCondition: 'SCORE', 
            winValue: rules.winValue || 5,
            roundDuration: 60000, 
            roundEndCriteria: 'NONE', 
            scoreSorting: 'DESC', 
            roundResetType: 'RESET_ALL', 
            livesPerRound: 1,
            eliminateOnDeath: true, 
            autoLoop: true,
            showRoundResultUI: true,
            turnBased: false,
            turnBasedBackgroundColor: false,
            ...rules
        };

        this.players = this.allPlayers.map(p => ({ 
            ...p, 
            score: 0, 
            lives: this.config.livesPerRound,
            isEliminated: false,
            isPermEliminated: false
        }));

        this.state = {
            phase: 'SETUP',
            round: 0,
            activePlayerIndex: 0,
            winner: null,
            isRoundActive: false,
            timer: 0 
        };

        // Virtual Cursors for Mobile
        this.cursors = new Map(); // Map<playerId, {x, y, isDown, color}>

        this.V_WIDTH = 1920;
        this.V_HEIGHT = 1200;
        this.CX = this.V_WIDTH / 2;
        this.CY = this.V_HEIGHT / 2;
        this.scaleFactor = 1;
        this.transX = 0;
        this.transY = 0;
        this.shakeTimer = 0;
        this.bgColor = [240, 234, 214];
        this.isDestroyed = false;
    }

    setup() {
        if (this.isDestroyed) return;
        const parent = this.p.canvas.parentElement;
        this.p.createCanvas(parent.clientWidth, parent.clientHeight);
        this.calculateLayout();

        this.state.round = 0;
        this.state.winner = null;
        this.players.forEach(p => { p.score = 0; p.isPermEliminated = false; });

        if (this.audio && this.mode !== 'demo') this.audio.setTrack('game');

        // Init Cursors at center
        this.players.forEach(p => {
            this.cursors.set(p.id, { x: this.CX, y: this.CY, isDown: false, color: p.color });
        });

        this.onSetup(); 
        this.updateUI(); 
        this.startNewRound();
    }

    // --- INPUT HANDLING ---
    handleInput(playerId, type, payload) {
        if (this.isDestroyed) return;

        // Cursor Movement (Always update, even if dead, so they can play next round)
        if (type === 'TOUCH_MOVE') {
            const cursor = this.cursors.get(playerId);
            if (cursor) {
                // Apply movement relative to scaled canvas
                cursor.x = Math.max(0, Math.min(this.V_WIDTH, cursor.x + payload.dx * 1.5)); // 1.5x sensitivity
                cursor.y = Math.max(0, Math.min(this.V_HEIGHT, cursor.y + payload.dy * 1.5));
            }
            return;
        }

        // Handle Clicks via Virtual Cursor
        if (type === 'TOUCH_CLICK') {
            const cursor = this.cursors.get(playerId);
            if (cursor) {
                cursor.isDown = payload.down;
                if (payload.down && this.onCursorClick) {
                    this.onCursorClick(playerId, cursor.x, cursor.y);
                }
            }
            // Also trigger standard 'PRESS' for hybrid games
            if(payload.down) type = 'PRESS';
            else type = 'RELEASE';
        }

        if (this.state.phase !== 'PLAYING') return;

        const p = this.players.find(pl => pl.id === playerId);
        if (!p || p.isEliminated || p.isPermEliminated) return;
        
        if (this.config.turnBased) {
            const activeP = this.players[this.state.activePlayerIndex];
            if (activeP.id !== playerId) return;
        }

        this.onPlayerInput(p, type); 
    }

    draw() {
        if (this.isDestroyed) return;
        const p = this.p;
        
        p.background(this.bgColor);
        p.push();
        
        let sx = 0, sy = 0;
        if (this.shakeTimer > 0) {
            this.shakeTimer--;
            sx = p.random(-1, 1) * 20 * (this.shakeTimer / 20);
            sy = p.random(-1, 1) * 20 * (this.shakeTimer / 20);
        }

        p.translate(this.transX + sx, this.transY + sy);
        p.scale(this.scaleFactor);

        if (this.mode === 'demo' && this.state.phase === 'PLAYING') {
            this.runDemoAI();
        }

        this.onDraw();
        this.drawCursors(); // Draw on top of game
        
        p.pop();
    }

    drawCursors() {
        // Only draw cursors if using touchpad mode OR explicitly requested
        // But drawing them always is fine for feedback
        const p = this.p;
        this.cursors.forEach((c, id) => {
            // Don't draw if not moved recently? (Optional optimization)
            p.push();
            p.translate(c.x, c.y);
            
            p.fill(c.color);
            p.stroke(255); p.strokeWeight(3);
            
            // Draw Hand Pointer
            p.beginShape();
            p.vertex(0, 0);
            p.vertex(15, 45);
            p.vertex(0, 35);
            p.vertex(-15, 45);
            p.endShape(p.CLOSE);
            
            // Click Ripple
            if(c.isDown) {
                p.noFill(); p.stroke(c.color); p.strokeWeight(4);
                p.circle(0, 0, 50);
            }
            p.pop();
        });
    }

    // ... (Existing startNewRound, checkRoundEnd, etc methods kept same) ...

    startNewRound() {
        if (this.isDestroyed) return;
        this.state.phase = 'INTRO';
        this.state.round++;
        this.state.isRoundActive = true;
        
        this.players.forEach(p => {
            if (this.config.roundResetType === 'ELIMINATION' && p.isPermEliminated) {
                p.isEliminated = true; return;
            }
            p.lives = this.config.livesPerRound;
            p.isEliminated = false;
            p.statusType = (this.config.livesPerRound > 1) ? 'hearts' : 'score';
            p.customStatus = (this.config.livesPerRound > 1) ? p.lives : undefined;
        });

        if (this.config.turnBased) this.validateTurn(true); 
        this.updateUI();
        this.onRoundStart();

        setTimeout(() => {
            if (!this.isDestroyed) {
                this.state.phase = 'PLAYING';
            }
        }, 800);
    }

    // Modified EndRound to trigger Mobile Screen Update
    endRound(roundWinner) {
        if (!this.state.isRoundActive || this.isDestroyed) return;
        this.state.isRoundActive = false;
        this.state.phase = 'ROUND_OVER';
        
        if (roundWinner && this.mode !== 'demo') this.playSound('win');
        this.updateUI();
        this.onRoundEnd(); 

        setTimeout(() => {
            if (this.isDestroyed) return;
            
            if (this.checkWinCondition()) {
                this.finishGame();
            } else {
                // If not game over, tell phones it's Round Over (Show Next Button)
                if (this.mode !== 'demo') {
                    // We need access to network manager to broadcast.
                    // Access via global or context?
                    // Context has input, input has network.
                    const net = this.context.input.networkManager;
                    if(net) net.broadcastState('ROUND_OVER');
                    
                    // Show Desktop UI too
                    const title = roundWinner ? `${roundWinner.name} Wins!` : "Draw";
                    this.ui.showMessage(title, "Waiting for Next Round...", "Next Round", () => this.startNewRound());
                } else {
                    setTimeout(() => this.startNewRound(), 2000);
                }
            }
        }, 500);
    }

    finishGame() {
        if (this.isDestroyed) return;
        this.state.phase = 'GAME_OVER';
        if (this.audio && this.mode !== 'demo') this.audio.setTrack('victory');
        
        const net = this.context.input.networkManager;
        if(net) net.broadcastState('GAME_OVER');

        this.ui.showPodium(this.players, "Play Again", () => this.setup());
    }

    // ... (rest of helper methods) ...
    calculateLayout() {
        const w = this.p.width;
        const h = this.p.height;
        this.scaleFactor = Math.min(w / this.V_WIDTH, h / this.V_HEIGHT);
        this.transX = (w - (this.V_WIDTH * this.scaleFactor)) / 2;
        this.transY = (h - (this.V_HEIGHT * this.scaleFactor)) / 2;
    }
    
    // Stub
    onCursorClick(id, x, y) {}
    simulateInput(playerIndex, action) {}
    onPlayerInput(player, type) {}
    onRoundStart() {}
    onRoundEnd() {}
    onPlayerEliminated() {}
    onDraw() {}
    shake(i, d) { this.shakeTimer = d; }
    playSound(n) { if (this.audio && this.mode !== 'demo') this.audio.play(n); }
    validateTurn() {}
    updateUI() { if(this.ui) this.ui.updateScoreboard(this.players); }
    checkWinCondition() { return false; } // Override me
}
