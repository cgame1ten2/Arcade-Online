import BaseGame from './BaseGame.js';
import AvatarSystem from '../core/AvatarSystem.js';

export default class PaintParty extends BaseGame {

    onSetup() {
        // --- GAME RULES ---
        // We use 'TIME' mode so BaseGame handles the countdown.
        // We override checkWinCondition to track rounds won manually.
        this.config.winCondition = 'TIME'; 
        this.config.roundDuration = 45000; // 45 Seconds per round
        
        this.config.livesPerRound = 1;
        this.config.eliminateOnDeath = false; // Just stun
        
        this.config.turnBased = false; // Simultaneous
        this.config.showRoundResultUI = true;

        // --- CONSTANTS ---
        this.CELL_SIZE = 120; // 16x10 Grid
        this.GRID_COLS = Math.ceil(this.V_WIDTH / this.CELL_SIZE);
        this.GRID_ROWS = Math.ceil(this.V_HEIGHT / this.CELL_SIZE);
        this.MOVE_SPEED = 9; 
        
        this.avatars = new AvatarSystem(this.p);
        this.grid = []; 
        this.particles = [];
        
        // Track Round Wins separately (since p.score is used for Tile Count)
        this.roundWins = this.players.map(() => 0); 
    }

    onRoundStart() {
        this.particles = [];
        
        // 1. Reset Tile Scores for the new round
        this.players.forEach(p => p.score = 0);
        
        // 2. Initialize Grid
        this.grid = [];
        for (let x = 0; x < this.GRID_COLS; x++) {
            this.grid[x] = [];
            for (let y = 0; y < this.GRID_ROWS; y++) {
                this.grid[x][y] = -1;
            }
        }

        // 3. Spawn Players
        this.gamePlayers = this.players.map((basePlayer, index) => {
            // Random start away from edges
            const gx = this.p.floor(this.p.random(1, this.GRID_COLS - 1));
            const gy = this.p.floor(this.p.random(1, this.GRID_ROWS - 1));
            
            // Paint starting tile
            this.grid[gx][gy] = index;
            basePlayer.score = 1;

            return {
                id: basePlayer.id,
                idx: index,
                config: basePlayer,
                x: gx * this.CELL_SIZE + this.CELL_SIZE/2,
                y: gy * this.CELL_SIZE + this.CELL_SIZE/2,
                dir: index % 4, // 0:Up, 1:Right, 2:Down, 3:Left
                stunTimer: 0,
                anim: 'IDLE',
                expression: 'happy'
            };
        });
        
        this.updateUI();
    }

    onPlayerInput(player, type) {
        if (type === 'PRESS') {
            const gp = this.gamePlayers.find(p => p.id === player.id);
            if (gp && gp.stunTimer <= 0) {
                gp.dir = (gp.dir + 1) % 4;
                this.snapToGrid(gp);
            }
        }
    }

    snapToGrid(gp) {
        const gx = Math.floor(gp.x / this.CELL_SIZE);
        const gy = Math.floor(gp.y / this.CELL_SIZE);
        gp.x = gx * this.CELL_SIZE + this.CELL_SIZE / 2;
        gp.y = gy * this.CELL_SIZE + this.CELL_SIZE / 2;
    }

    runDemoAI() {
        this.gamePlayers.forEach(gp => {
            if (gp.stunTimer > 0) return;

            const lookX = Math.floor(gp.x / this.CELL_SIZE) + (gp.dir === 1 ? 1 : gp.dir === 3 ? -1 : 0);
            const lookY = Math.floor(gp.y / this.CELL_SIZE) + (gp.dir === 2 ? 1 : gp.dir === 0 ? -1 : 0);

            const hitWall = lookX < 0 || lookX >= this.GRID_COLS || lookY < 0 || lookY >= this.GRID_ROWS;
            
            // Turn if hitting wall or randomly to chaos
            if (hitWall || this.p.random() < 0.03) {
                this.simulateInput(gp.idx, 'PRESS');
            } 
        });
    }

    onDraw() {
        this.updateGameLogic();

        this.drawFloor();
        this.drawPlayers();
        this.drawParticles();
        this.drawUIOverlay();
    }

    updateGameLogic() {
        // BaseGame handles the Timer tick in its draw() loop.
        // We just handle movement here.
        const p = this.p;

        this.gamePlayers.forEach(gp => {
            if (gp.stunTimer > 0) {
                gp.stunTimer--;
                gp.anim = 'DIZZY';
                gp.expression = 'stunned';
                return;
            }

            gp.anim = 'RUN';
            gp.expression = 'happy';

            // --- PREDICTIVE MOVEMENT ---
            let nextX = gp.x;
            let nextY = gp.y;

            if (gp.dir === 0) nextY -= this.MOVE_SPEED;
            else if (gp.dir === 1) nextX += this.MOVE_SPEED;
            else if (gp.dir === 2) nextY += this.MOVE_SPEED;
            else if (gp.dir === 3) nextX -= this.MOVE_SPEED;

            // --- WALL BOUNCE ---
            const buffer = this.CELL_SIZE * 0.3; 
            if (nextX < buffer || nextX > this.V_WIDTH - buffer || nextY < buffer || nextY > this.V_HEIGHT - buffer) {
                this.stunPlayer(gp);
                gp.dir = (gp.dir + 2) % 4; // 180 flip
                return; 
            }

            gp.x = nextX;
            gp.y = nextY;

            // --- PAINT LOGIC ---
            const gx = Math.floor(gp.x / this.CELL_SIZE);
            const gy = Math.floor(gp.y / this.CELL_SIZE);

            if (gx >= 0 && gx < this.GRID_COLS && gy >= 0 && gy < this.GRID_ROWS) {
                const currentOwner = this.grid[gx][gy];
                
                if (currentOwner !== gp.idx) {
                    // Steal: Remove point from old owner
                    if (currentOwner !== -1) {
                        this.players[currentOwner].score--;
                        if (p.frameCount % 15 === 0) this.playSound('pop');
                    }
                    
                    // Award: Add point to new owner
                    this.grid[gx][gy] = gp.idx;
                    this.players[gp.idx].score++;
                    
                    this.spawnPaintParticles(gp.x, gp.y, gp.config.color);
                    this.updateUI(); // Live Score Update
                }
            }

            // --- PLAYER COLLISION ---
            this.gamePlayers.forEach(other => {
                if (other === gp) return;
                const d = p.dist(gp.x, gp.y, other.x, other.y);
                if (d < this.CELL_SIZE * 0.6) {
                    this.playSound('bump');
                    this.stunPlayer(gp);
                    this.stunPlayer(other);
                    gp.dir = (gp.dir + 2) % 4;
                    other.dir = (other.dir + 2) % 4;
                    gp.x -= (other.x - gp.x) * 0.5; // Push apart
                    gp.y -= (other.y - gp.y) * 0.5;
                }
            });
        });
    }

    stunPlayer(gp) {
        if (gp.stunTimer > 0) return;
        this.playSound('crash');
        this.shake(5, 10);
        gp.stunTimer = 45; 
    }

    spawnPaintParticles(x, y, color) {
        if (this.p.random() > 0.3) return; 
        this.particles.push({
            x: x, y: y,
            vx: this.p.random(-2, 2),
            vy: this.p.random(-2, 2),
            size: this.p.random(15, 30),
            color: color,
            life: 1.0
        });
    }

    // Called automatically by BaseGame when timer hits 0
    onRoundEnd() {
        // 1. Find who has the most tiles (p.score)
        const sorted = [...this.players].sort((a, b) => b.score - a.score);
        const winner = sorted[0];
        
        // 2. Award a Round Win
        // We use a custom array because p.score is being used for tiles
        this.roundWins[winner.id]++;
        
        // 3. Show message manually since we are overriding standard logic
        this.ui.showTurnMessage(`${winner.name} Wins Round!`, winner.color);
    }

    // Override BaseGame check to look at roundWins instead of score
    checkWinCondition() {
        if (this.mode === 'demo') return false;
        
        // First to 3 Round Wins
        const winnerIdx = this.roundWins.findIndex(w => w >= 3);
        if (winnerIdx !== -1) {
            this.state.winner = this.players[winnerIdx];
            return true;
        }
        return false;
    }

    // --- VISUALS ---

    drawFloor() {
        const p = this.p;
        p.noStroke();
        p.fill(230);
        p.rect(0, 0, this.V_WIDTH, this.V_HEIGHT);

        for (let x = 0; x < this.GRID_COLS; x++) {
            for (let y = 0; y < this.GRID_ROWS; y++) {
                const owner = this.grid[x][y];
                const cx = x * this.CELL_SIZE;
                const cy = y * this.CELL_SIZE;

                if (owner !== -1) {
                    const color = this.gamePlayers[owner].config.color;
                    p.fill(color);
                    // Slight overlap to prevent cracks
                    p.rect(cx, cy, this.CELL_SIZE + 1, this.CELL_SIZE + 1);
                } else {
                    if ((x + y) % 2 === 0) {
                        p.fill(215); 
                        p.rect(cx, cy, this.CELL_SIZE, this.CELL_SIZE);
                    }
                }
            }
        }
    }

    drawPlayers() {
        const p = this.p;
        this.gamePlayers.forEach(gp => {
            p.push();
            p.translate(gp.x, gp.y);

            const rotation = [ -p.PI/2, 0, p.PI/2, p.PI ][gp.dir];
            const bob = Math.sin(p.millis() * 0.02) * 5;
            p.translate(0, bob);

            p.fill(0, 30); p.noStroke();
            p.ellipse(0, 30, 60, 25);

            this.avatars.applyTransform(gp.anim);
            
            p.push();
            if (gp.dir === 3) p.scale(-1, 1);
            
            this.avatars.draw({
                x: 0, y: 0, 
                size: 90, 
                color: gp.config.color, 
                variant: gp.config.variant, 
                accessory: gp.config.accessory, 
                expression: gp.expression,
                facing: 1
            });
            p.pop();

            // Arrow
            p.rotate(rotation);
            p.fill(255, 180);
            p.triangle(50, 0, 20, -20, 20, 20);

            p.pop();
        });
    }

    drawParticles() {
        const p = this.p;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let part = this.particles[i];
            part.life -= 0.05;
            part.x += part.vx;
            part.y += part.vy;
            
            if (part.life <= 0) {
                this.particles.splice(i, 1);
            } else {
                p.fill(part.color);
                p.noStroke();
                p.circle(part.x, part.y, part.size * part.life);
            }
        }
    }

    drawUIOverlay() {
        const p = this.p;
        // Timer is now managed by BaseGame state
        const timeLeft = Math.ceil(this.state.timer / 1000);
        
        p.push();
        p.translate(this.CX, 60);
        p.fill(255); 
        p.stroke(0, 50); p.strokeWeight(4);
        p.rectMode(p.CENTER);
        p.rect(0, 0, 140, 80, 20);
        
        p.fill(timeLeft <= 10 ? '#e74c3c' : '#2c3e50');
        p.noStroke();
        p.textSize(50);
        p.textAlign(p.CENTER, p.CENTER);
        p.textStyle(p.BOLD);
        p.text(timeLeft, 0, 5);
        p.pop();
    }
}