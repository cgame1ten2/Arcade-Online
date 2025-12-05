/* src/games/BaseGame.js */

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
            // NEW: Define Controller Type to show/hide cursors
            controllerType: rules.controllerType || 'ONE_BUTTON', // 'ONE_BUTTON' or 'TOUCHPAD'
            ...rules
        };

        this.players = this.allPlayers.map(p => ({ 
            ...p, 
            score: 0, 
            lives: this.config.livesPerRound,
            isEliminated: false,
            isPermEliminated: false,
            wasPressed: false,
            // NEW: Virtual Input State
            cursorX: this.V_WIDTH / 2,
            cursorY: this.V_HEIGHT / 2,
            isClicking: false
        }));

        this.state = {
            phase: 'SETUP',
            round: 0,
            activePlayerIndex: 0,
            winner: null,
            isRoundActive: false,
            timer: 0 
        };

        this.V_WIDTH = 1920;
        this.V_HEIGHT = 1200;
        this.CX = this.V_WIDTH / 2;
        this.CY = this.V_HEIGHT / 2;
        this.scaleFactor = 1;
        this.transX = 0;
        this.transY = 0;
        this.shakeTimer = 0;
        
        this.bgColor = [240, 234, 214];
        this.targetBgColor = [240, 234, 214];

        this.isDestroyed = false;
        this.timerLastTick = 0;
    }

    setup() {
        if (this.isDestroyed) return;

        const parent = this.p.canvas.parentElement;
        this.p.createCanvas(parent.clientWidth, parent.clientHeight);
        this.calculateLayout();

        this.state.round = 0;
        this.state.winner = null;
        this.players.forEach(p => {
            p.score = 0;
            p.isPermEliminated = false;
            // Reset Cursors to center
            p.cursorX = this.CX;
            p.cursorY = this.CY;
        });

        if (this.audio && this.mode !== 'demo') this.audio.setTrack('game');

        this.onSetup(); 
        this.updateUI(); 
        this.startNewRound();
        
        if (this.mode !== 'demo') {
            window.dispatchEvent(new CustomEvent('game-state-change', { detail: 'PLAYING' }));
        }
    }

    draw() {
        if (this.isDestroyed) return;
        const p = this.p;
        
        if (this.state.phase === 'PLAYING' && this.config.winCondition === 'TIME') {
            const now = p.millis();
            const delta = now - this.timerLastTick;
            this.timerLastTick = now;
            this.state.timer -= delta;
            if (this.state.timer <= 0) {
                this.state.timer = 0;
                this.handleTimeUp();
            }
        } else {
            this.timerLastTick = p.millis();
        }

        if (this.config.turnBasedBackgroundColor && this.mode !== 'demo') {
            this.bgColor[0] = p.lerp(this.bgColor[0], this.targetBgColor[0], 0.05);
            this.bgColor[1] = p.lerp(this.bgColor[1], this.targetBgColor[1], 0.05);
            this.bgColor[2] = p.lerp(this.bgColor[2], this.targetBgColor[2], 0.05);
            p.background(this.bgColor);
        } else {
            p.background(this.getBgColor());
        }

        p.push();
        let sx = 0, sy = 0;
        if (this.shakeTimer > 0) {
            this.shakeTimer--;
            const damp = this.shakeTimer / 20;
            sx = p.random(-1, 1) * 20 * damp;
            sy = p.random(-1, 1) * 20 * damp;
        }
        p.translate(this.transX + sx, this.transY + sy);
        p.scale(this.scaleFactor);

        if (this.mode === 'demo' && this.state.phase === 'PLAYING') {
            this.runDemoAI();
        }

        this.onDraw();
        
        // NEW: Draw Virtual Cursors (Only if enabled and not demo)
        if (this.mode !== 'demo' && this.config.controllerType === 'TOUCHPAD') {
            this.drawCursors();
        }

        p.pop();
    }

    drawCursors() {
        const p = this.p;
        this.players.forEach(pl => {
            // Draw cursor for every player (even keyboard/mouse users can have one for consistency)
            // But specifically useful for mobile.
            if(pl.isEliminated) return;

            p.push();
            p.translate(pl.cursorX, pl.cursorY);
            p.fill(pl.color);
            p.stroke(255); p.strokeWeight(3);
            
            // Draw standard cursor arrow
            p.beginShape();
            p.vertex(0, 0);
            p.vertex(0, 25);
            p.vertex(8, 18);
            p.vertex(16, 28);
            p.vertex(20, 24);
            p.vertex(12, 16);
            p.vertex(20, 14);
            p.endShape(p.CLOSE);
            
            // Click Ripple
            if(pl.isClicking) {
                p.noFill(); p.stroke(pl.color); p.strokeWeight(2);
                p.circle(5, 5, 40);
            }
            p.pop();
        });
    }

    updateUI() {
        if (!this.isDestroyed && this.ui) {
            this.ui.updateScoreboard(this.players);
        }
    }

    handleInput(playerId, type, payload) {
        if (this.isDestroyed || this.state.phase !== 'PLAYING') return;

        const p = this.players.find(pl => pl.id === playerId);
        if (!p || p.isEliminated || p.isPermEliminated) return;
        
        if (this.config.turnBased) {
            const activeP = this.players[this.state.activePlayerIndex];
            if (activeP.id !== playerId) return;
        }

        // --- NEW: Handle Virtual Cursor Movement ---
        if (type === 'VECTOR' && payload) {
            // payload.x and payload.y are -1 to 1 (Joystick normalized)
            // Move cursor speed
            const speed = 15; 
            p.cursorX += payload.x * speed;
            p.cursorY += payload.y * speed;
            
            // Clamp to screen
            p.cursorX = Math.max(0, Math.min(this.V_WIDTH, p.cursorX));
            p.cursorY = Math.max(0, Math.min(this.V_HEIGHT, p.cursorY));
        }
        else if (type === 'PRESS') {
            p.isClicking = true;
        }
        else if (type === 'RELEASE') {
            p.isClicking = false;
        }

        // Pass to specific game logic
        this.onPlayerInput(p, type, payload); 
    }

    simulateInput(playerIndex, action) {
        const p = this.players[playerIndex];
        if (p) this.onPlayerInput(p, action);
    }
    
    runDemoAI() {}

    startNewRound() {
        if (this.isDestroyed) return;

        this.state.phase = 'INTRO';
        this.state.round++;
        this.state.isRoundActive = true;
        this.state.timer = this.config.roundDuration; 
        
        this.players.forEach(p => {
            if (this.config.roundResetType === 'ELIMINATION' && p.isPermEliminated) {
                p.isEliminated = true;
                return;
            }
            p.lives = this.config.livesPerRound;
            p.isEliminated = false;
            p.statusType = (this.config.livesPerRound > 1) ? 'hearts' : 'score';
            p.customStatus = (this.config.livesPerRound > 1) ? p.lives : undefined;
            // Reset click state
            p.isClicking = false;
        });

        if (this.config.turnBased) {
            this.validateTurn(true); 
        }

        if (this.config.roundResetType === 'ELIMINATION') {
            const survivors = this.players.filter(p => !p.isPermEliminated);
            if (survivors.length <= 1) {
                this.finishGame(); 
                return;
            }
        }
        
        this.updateUI();
        this.onRoundStart();

        if (this.mode !== 'demo') {
            window.dispatchEvent(new CustomEvent('game-state-change', { detail: 'PLAYING' }));
        }

        const delay = this.mode === 'demo' ? 100 : 800;
        setTimeout(() => {
            if (!this.isDestroyed) {
                this.state.phase = 'PLAYING';
                this.timerLastTick = this.p.millis();
            }
        }, delay);
    }

    nextTurn() {
        if (!this.config.turnBased || this.isDestroyed) return;
        let attempts = 0;
        const total = this.players.length;
        do {
            this.state.activePlayerIndex = (this.state.activePlayerIndex + 1) % total;
            attempts++;
        } while (
            (this.players[this.state.activePlayerIndex].isEliminated || 
             this.players[this.state.activePlayerIndex].isPermEliminated) && 
            attempts < total
        );
        this.updateTurnVisuals();
    }

    validateTurn(randomize = false) {
        const activePlayers = this.players.filter(p => !p.isEliminated && !p.isPermEliminated);
        if (activePlayers.length === 0) return;
        const current = this.players[this.state.activePlayerIndex];
        if (randomize || current.isEliminated || current.isPermEliminated) {
            const nextP = activePlayers[Math.floor(Math.random() * activePlayers.length)];
            this.state.activePlayerIndex = this.players.indexOf(nextP);
            this.updateTurnVisuals();
        }
    }

    updateTurnVisuals() {
        if (this.isDestroyed) return;
        const current = this.players[this.state.activePlayerIndex];
        if (!current) return;
        if (this.mode !== 'demo') this.ui.showTurnMessage(`${current.name}'s Turn!`, current.color);
        if (this.config.turnBasedBackgroundColor) this.targetBgColor = this.hexToRgb(current.color);
    }

    eliminatePlayer(playerIdx) {
        if (!this.state.isRoundActive || this.state.phase !== 'PLAYING' || this.isDestroyed) return;
        const p = this.players[playerIdx];
        if (!p || p.isEliminated) return;
        p.lives--;
        if (this.config.livesPerRound > 1) {
            p.customStatus = p.lives; 
            this.updateUI();
        }
        if (p.lives <= 0) {
            if (this.config.eliminateOnDeath) {
                p.isEliminated = true;
                if (this.config.roundResetType === 'ELIMINATION') {
                    p.isPermEliminated = true;
                    if (this.checkWinCondition()) {
                        setTimeout(() => this.finishGame(), 1000);
                        return;
                    }
                }
                this.onPlayerEliminated(p);
            }
            this.checkRoundEnd();
        }
    }

    handleTimeUp() {
        const sorted = [...this.players].sort((a, b) => b.score - a.score);
        this.endRound(sorted[0]);
    }

    checkRoundEnd() {
        if (this.isDestroyed) return;
        const active = this.players.filter(p => !p.isEliminated);
        
        if (this.config.roundEndCriteria === 'SURVIVAL' && active.length <= 1) {
            this.endRound(active.length === 1 ? active[0] : null);
        } else if (this.config.roundEndCriteria === 'ALL_DEAD' && active.length === 0) {
            const sorted = [...this.players].sort((a, b) => b.score - a.score);
            this.endRound(sorted[0]); 
        }
    }

    endRound(roundWinner) {
        if (!this.state.isRoundActive || this.isDestroyed) return;
        this.state.isRoundActive = false;
        this.state.phase = 'ROUND_OVER';
        
        if (this.mode !== 'demo') {
            window.dispatchEvent(new CustomEvent('game-state-change', { detail: 'ROUND_OVER' }));
        }
        
        if (roundWinner && this.mode !== 'demo') {
            if (this.config.roundEndCriteria === 'SURVIVAL') {
                roundWinner.score++;
            }
            this.playSound('win');
        }

        this.updateUI();
        this.onRoundEnd(); 

        setTimeout(() => {
            if (this.isDestroyed) return;
            
            if (this.checkWinCondition()) {
                this.finishGame();
            } else if (this.config.autoLoop) {
                if (this.mode !== 'demo' && this.config.showRoundResultUI) {
                    const title = roundWinner ? `${roundWinner.name} Wins!` : "Draw";
                    this.ui.showMessage(title, "Next Round", "Next", () => this.startNewRound());
                } else {
                    setTimeout(() => this.startNewRound(), 2000);
                }
            }
        }, 500);
    }

    checkWinCondition() {
        if (this.mode === 'demo') return false; 
        const sorted = [...this.players].sort((a, b) => {
            return this.config.scoreSorting === 'ASC' ? a.score - b.score : b.score - a.score;
        });
        const leader = sorted[0];
        if (this.config.winCondition === 'SCORE' && leader.score >= this.config.winValue) {
            this.state.winner = leader;
            return true;
        }
        if (this.config.winCondition === 'ROUNDS' && this.state.round >= this.config.winValue) {
            this.state.winner = leader;
            return true;
        }
        if (this.config.winCondition === 'SURVIVAL') {
            const survivors = this.players.filter(p => !p.isPermEliminated);
            if (survivors.length <= 1) {
                this.state.winner = survivors[0] || leader;
                return true;
            }
        }
        if (this.config.winCondition === 'TIME') return false; 
        return false;
    }

    finishGame() {
        if (this.isDestroyed) return;
        this.state.phase = 'GAME_OVER';
        
        if (this.mode !== 'demo') {
            window.dispatchEvent(new CustomEvent('game-state-change', { detail: 'GAME_OVER' }));
        }

        if (this.audio && this.mode !== 'demo') this.audio.setTrack('victory');
        
        if (this.mode === 'tournament' && this.onGameComplete) {
            this.onGameComplete(this.players); 
        } else if (this.mode === 'active') {
            this.ui.showPodium(this.players, "Play Again", () => this.setup());
        } else {
            this.setup();
        }
    }

    destroy() {
        this.isDestroyed = true;
    }

    calculateLayout() {
        const w = this.p.width;
        const h = this.p.height;
        this.scaleFactor = Math.min(w / this.V_WIDTH, h / this.V_HEIGHT);
        this.transX = (w - (this.V_WIDTH * this.scaleFactor)) / 2;
        this.transY = (h - (this.V_HEIGHT * this.scaleFactor)) / 2;
    }

    hexToRgb(hex) {
        const bigint = parseInt(hex.replace('#', ''), 16);
        return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    }

    shake(intensity, duration = 20) { this.shakeTimer = duration; }
    playSound(name) { if (this.audio && this.mode !== 'demo') this.audio.play(name); }

    onSetup() {}
    onRoundStart() {}
    onRoundEnd() {}
    onPlayerEliminated(player) {}
    onPlayerInput(player, type, payload) {} 
    onDraw() {}
    getBgColor() { return '#F0EAD6'; }
}
