import BaseGame from './BaseGame.js';
import AvatarSystem from '../core/AvatarSystem.js';

export default class RedLightGreenLight extends BaseGame {

    onSetup() {
        this.config.winCondition = 'ROUNDS';
        this.config.winValue = 3;

        this.config.livesPerRound = 1;
        this.config.eliminateOnDeath = false;
        this.config.roundEndCriteria = 'NONE';

        // --- CONSTANTS ---
        this.TRACK_LENGTH = 1600;
        this.START_LINE_X = 200;
        this.RUN_SPEED = 2.8;
        this.GRACE_PERIOD = 200;

        this.avatars = new AvatarSystem(this.p);
        this.particles = [];

        // Game State
        this.lightState = 'RED';
        this.nextSwitchTime = 0;
        this.lastSwitchTime = 0;
        this.endTimerStart = 0;
        this.ROUND_TIME_LIMIT = 10000;

        // Robot
        this.robotAnim = 0;
        this.judgeColor = '#e74c3c';
        this.judgeFacing = -1;
    }

    onRoundStart() {
        this.lightState = 'RED';
        this.nextSwitchTime = this.p.millis() + 2000;
        this.finishedCount = 0;
        this.endTimerStart = 0;

        // Center Track Vertically in the 1200px space
        const totalHeight = (this.players.length) * 150;
        const startY = this.CY - (totalHeight / 2) + 75;

        this.gamePlayers = this.players.map((basePlayer, index) => ({
            id: basePlayer.id,
            idx: index,
            config: basePlayer,
            x: this.START_LINE_X,
            y: startY + (index * 150),
            isEliminated: false,
            finished: false,
            finishRank: 0,
            animFrame: 0,
            expression: 'idle',
            facing: 1,
            resetTimer: 0,
            isRunning: false
        }));
    }

    onPlayerInput(player, type) {
        const gp = this.gamePlayers.find(p => p.id === player.id);
        if (!gp || gp.finished || gp.isEliminated) return;

        if (type === 'PRESS') {
            gp.isRunning = true;
        } else if (type === 'RELEASE') {
            gp.isRunning = false;
        }
    }

    runDemoAI() {
        this.gamePlayers.forEach(p => {
            if (p.finished) return;

            if (this.lightState === 'GREEN' || this.lightState === 'YELLOW') {
                p.isRunning = true;
            } else {
                p.isRunning = false;
                if (this.p.random() < 0.005) p.isRunning = true;
            }
        });
    }

    onDraw() {
        this.updateGameLogic();

        this.drawEnvironment();
        this.drawRobot();
        this.drawPlayers();
        this.updateAndDrawParticles();
        this.drawTrafficLightUI();
    }

    updateGameLogic() {
        const t = this.p.millis();

        // 1. LIGHT LOGIC
        if (t > this.nextSwitchTime) {
            this.switchLight();
        }

        // 2. COUNTDOWN LOGIC
        if (this.endTimerStart > 0) {
            const timeLeft = this.ROUND_TIME_LIMIT - (t - this.endTimerStart);
            if (timeLeft <= 0) {
                const sorted = [...this.gamePlayers].sort((a, b) => {
                    if (a.finished && !b.finished) return -1;
                    if (!a.finished && b.finished) return 1;
                    return b.x - a.x;
                });
                const winner = this.players[sorted[0].idx];
                this.endRound(winner);
                return;
            }
        }

        // 3. PLAYER LOGIC
        let activeCount = 0;

        this.gamePlayers.forEach(p => {
            if (p.isEliminated || p.finished) return;
            activeCount++;

            if (p.resetTimer > 0) {
                p.resetTimer--;
                p.isRunning = false;
                return;
            }

            if (p.isRunning) {
                let currentSpeed = this.RUN_SPEED;
                if (this.lightState === 'YELLOW') currentSpeed *= 0.5;

                p.x += currentSpeed;
                p.animFrame += 0.2;

                if (this.lightState === 'RED') {
                    if (t > this.lastSwitchTime + this.GRACE_PERIOD) {
                        this.resetPlayer(p);
                    }
                }
            } else {
                p.animFrame = 0;
            }

            if (p.x >= this.TRACK_LENGTH) {
                this.handleFinish(p);
            }
        });

        if (activeCount === 0 && this.state.phase === 'PLAYING') {
            if (this.finishedCount === this.gamePlayers.length) {
                const winner = this.players[this.gamePlayers.find(p => p.finishRank === 1).idx];
                this.endRound(winner);
            }
        }
    }

    switchLight() {
        const t = this.p.millis();
        this.lastSwitchTime = t;

        if (this.lightState === 'RED') {
            // RED -> GREEN
            this.lightState = 'GREEN';
            this.judgeColor = '#2ecc71';
            this.judgeFacing = 1;
            this.nextSwitchTime = t + this.p.random(2000, 5000);
            this.playSound('jump');

        } else if (this.lightState === 'GREEN') {
            // --- UPDATE: 70% Chance to FAKE OUT (Skip Yellow) ---
            if (this.p.random() < 0.7) {
                // INSTANT RED!
                this.lightState = 'RED';
                this.judgeColor = '#e74c3c';
                this.judgeFacing = -1;
                this.nextSwitchTime = t + this.p.random(2000, 4000);
                this.playSound('bump');
            } else {
                // YELLOW
                this.lightState = 'YELLOW';
                this.judgeColor = '#f1c40f';
                this.judgeFacing = -1;
                this.nextSwitchTime = t + this.p.random(1500, 2500);
                this.playSound('click');
            }

        } else {
            // YELLOW -> RED
            this.lightState = 'RED';
            this.judgeColor = '#e74c3c';
            this.judgeFacing = -1;
            this.nextSwitchTime = t + this.p.random(2000, 4000);
            this.playSound('bump');
        }
    }

    resetPlayer(p) {
        this.playSound('pop');
        this.shake(5, 10);
        for (let i = 0; i < 10; i++) this.addParticle(p.x, p.y, p.config.color);

        p.x = this.START_LINE_X;
        p.resetTimer = 60;
        p.expression = 'stunned';
        setTimeout(() => { p.expression = 'idle'; }, 1000);
    }

    handleFinish(p) {
        p.finished = true;
        this.finishedCount++;
        p.finishRank = this.finishedCount;

        this.playSound('win');

        if (this.finishedCount === 1) {
            this.endTimerStart = this.p.millis();
        }

        let points = 0;
        if (p.finishRank === 1) points = 3;
        else if (p.finishRank === 2) points = 2;
        else if (p.finishRank === 3) points = 1;

        if (points > 0) {
            this.players[p.idx].score += points;
            this.updateUI();
        }
    }

    // --- VISUALS ---

    drawEnvironment() {
        const p = this.p;

        const trackTop = this.gamePlayers[0].y - 75;
        const trackHeight = this.gamePlayers.length * 150;

        p.fill('#dcd0c0'); p.noStroke();
        p.rect(0, trackTop, this.V_WIDTH, trackHeight);

        p.stroke(255, 100); p.strokeWeight(4);
        this.gamePlayers.forEach((gp, i) => {
            if (i > 0) {
                const ly = gp.y - 75;
                p.line(this.START_LINE_X, ly, this.TRACK_LENGTH, ly);
            }
        });

        p.stroke('#2ecc71'); p.strokeWeight(8);
        p.line(this.START_LINE_X, trackTop, this.START_LINE_X, trackTop + trackHeight);

        const checkSize = 25;
        const rows = Math.ceil(trackHeight / checkSize);

        p.noStroke();
        for (let i = 0; i < rows; i++) {
            const y = trackTop + (i * checkSize);
            p.fill((i % 2 === 0) ? '#000' : '#fff');
            p.rect(this.TRACK_LENGTH, y, checkSize, checkSize);
            p.fill((i % 2 === 0) ? '#fff' : '#000');
            p.rect(this.TRACK_LENGTH + checkSize, y, checkSize, checkSize);
        }
    }

    drawRobot() {
        const p = this.p;
        const x = this.TRACK_LENGTH + 200;

        // Calculate vertical center based on player positions
        // This ensures the robot is always centered regardless of player count
        const minY = this.gamePlayers[0].y;
        const maxY = this.gamePlayers[this.gamePlayers.length - 1].y;
        const centerY = (minY + maxY) / 2 - 100;

        this.robotAnim += 0.05;
        const hover = Math.sin(this.robotAnim) * 15;

        p.push();
        p.translate(x, centerY + hover);

        p.noStroke();
        p.fill(0, 30);
        p.ellipse(0, 200 - hover, 200, 50);

        p.fill(50);
        p.rectMode(p.CENTER);
        p.rect(0, 0, 160, 200, 30);

        p.stroke(50); p.strokeWeight(10);
        p.line(0, -100, 0, -150);
        p.fill(this.judgeColor); p.noStroke();
        p.circle(0, -150, 30);

        p.fill(20);
        p.circle(0, -20, 120);

        p.drawingContext.shadowBlur = 50;
        p.drawingContext.shadowColor = this.judgeColor;
        p.fill(this.judgeColor);
        p.circle(0, -20, 90);
        p.drawingContext.shadowBlur = 0;

        p.fill(0, 100);
        if (this.lightState === 'RED') {
            p.rect(0, -20, 60, 20);
        } else if (this.lightState === 'YELLOW') {
            p.rect(0, -20, 60, 10);
        } else {
            p.arc(0, -20, 60, 60, 0, p.PI);
        }

        if (this.lightState === 'RED') {
            p.stroke(50); p.strokeWeight(20);
            p.line(-80, 0, -140, -40);
            p.line(80, 0, 140, -40);
            p.fill('#e74c3c'); p.noStroke();
            p.circle(-140, -40, 30);
            p.circle(140, -40, 30);
        } else {
            p.stroke(50); p.strokeWeight(20);
            p.line(-80, 0, -100, 60);
            p.line(80, 0, 100, 60);
        }

        p.pop();
    }

    drawPlayers() {
        const p = this.p;
        const sorted = [...this.gamePlayers].sort((a, b) => a.y - b.y);

        sorted.forEach(player => {
            p.push();

            let bounce = 0;
            if (player.animFrame > 0) bounce = Math.abs(Math.sin(player.animFrame)) * 15;

            p.translate(player.x, player.y - bounce);

            let exp = player.expression;
            if (player.finished) exp = 'happy';
            else if (this.lightState === 'RED' && player.animFrame > 0) exp = 'stunned';
            else if (this.lightState === 'YELLOW') exp = 'angry';

            if (player.resetTimer > 0) {
                player.resetTimer--;
                exp = 'stunned';
                if (player.resetTimer % 10 < 5) p.tint(255, 100);
            }

            let anim = 'IDLE';
            if (player.resetTimer > 0) anim = 'LOSE';
            else if (player.animFrame > 0) anim = 'RUN';

            this.avatars.applyTransform(anim);

            this.avatars.draw({
                x: 0, y: 0,
                size: 90,
                color: player.config.color,
                variant: player.config.variant,
                accessory: player.config.accessory,
                expression: exp,
                facing: 1
            });

            if (player.animFrame > 0 && p.frameCount % 5 === 0) {
                this.addParticle(player.x - 40, player.y + 40, '#dcd0c0');
            }

            p.pop();
        });
    }

    drawTrafficLightUI() {
        const p = this.p;
        const w = 240;
        const h = 90;
        const x = this.CX;

        // Calculate Top of Track to position UI
        const trackTop = this.gamePlayers[0].y - 75;
        const uiY = trackTop - 100; // Floating above track

        // TIMER
        if (this.endTimerStart > 0) {
            const timeLeft = Math.ceil((this.ROUND_TIME_LIMIT - (p.millis() - this.endTimerStart)) / 1000);

            p.push();
            p.translate(x, uiY + 80);

            const pulse = 1 + Math.sin(p.millis() * 0.01) * 0.1;

            p.fill('#e74c3c');
            p.textSize(40);
            p.textAlign(p.CENTER, p.CENTER);
            p.textStyle(p.BOLD);

            p.scale(pulse);
            p.text(timeLeft, 0, 0);

            p.textSize(16);
            p.scale(1 / pulse);
            p.fill(200);
            p.text("HURRY UP!", 0, 35);

            p.pop();
        }

        // TRAFFIC LIGHT
        p.push();
        p.translate(x, uiY);
        p.fill(30); p.noStroke();
        p.rectMode(p.CENTER);
        p.rect(0, 0, w, h, 40);

        p.noStroke();

        if (this.lightState === 'RED') {
            p.fill('#ff0000');
            p.drawingContext.shadowBlur = 30; p.drawingContext.shadowColor = '#ff0000';
            p.circle(-70, 0, 60);
        } else {
            p.fill('#550000'); p.drawingContext.shadowBlur = 0;
            p.circle(-70, 0, 50);
        }

        if (this.lightState === 'YELLOW') {
            p.fill('#ffff00');
            p.drawingContext.shadowBlur = 30; p.drawingContext.shadowColor = '#ffff00';
            p.circle(0, 0, 60);
        } else {
            p.fill('#555500'); p.drawingContext.shadowBlur = 0;
            p.circle(0, 0, 50);
        }

        if (this.lightState === 'GREEN') {
            p.fill('#00ff00');
            p.drawingContext.shadowBlur = 30; p.drawingContext.shadowColor = '#00ff00';
            p.circle(70, 0, 60);
        } else {
            p.fill('#005500'); p.drawingContext.shadowBlur = 0;
            p.circle(70, 0, 50);
        }

        p.drawingContext.shadowBlur = 0;
        p.pop();
    }

    addParticle(x, y, color) {
        this.particles.push({
            x: x, y: y,
            vx: this.p.random(-2, 2),
            vy: this.p.random(-5, -1),
            color: color,
            life: 1.0,
            size: this.p.random(10, 20)
        });
    }

    updateAndDrawParticles() {
        const p = this.p;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let part = this.particles[i];
            part.x += part.vx;
            part.y += part.vy;
            part.vy += 0.2;
            part.life -= 0.05;
            if (part.life <= 0) {
                this.particles.splice(i, 1);
            } else {
                p.noStroke();
                p.fill(part.color);
                p.circle(part.x, part.y, part.size * part.life);
            }
        }
    }
}