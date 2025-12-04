import BaseGame from './BaseGame.js';
import AvatarSystem from '../core/AvatarSystem.js';

export default class NinjaReflex extends BaseGame {

    onSetup() {
        this.config.winCondition = 'SCORE';
        this.config.winValue = 7;

        this.config.roundEndCriteria = 'SURVIVAL';
        this.config.livesPerRound = 1;
        this.config.eliminateOnDeath = true;
        this.config.roundResetType = 'RESET_ALL';

        this.avatars = new AvatarSystem(this.p);

        this.gameState = 'WAITING'; // WAITING, FLASH, END_DELAY
        this.flashTime = 0;
        this.nextFakeTime = 0;

        this.bgAlpha = 0;
        this.fakeAlpha = 0;
        this.fakeType = 0;
        this.fakeAnim = 0;

        this.skyColor = [44, 62, 80];
        this.roundWinner = null;
        this.winAnimTimer = 0; // Tracks the "Slash" duration
    }

    onRoundStart() {
        this.gameState = 'WAITING';
        this.roundWinner = null;
        this.bgAlpha = 0;
        this.fakeAlpha = 0;
        this.winAnimTimer = 0;

        this.skyColor = this.p.random([
            [44, 62, 80],   // Night
            [255, 127, 80], // Sunset
            [135, 206, 235] // Day
        ]);

        const now = this.p.millis();
        this.flashTime = now + this.p.random(3000, 8000);

        this.scheduleNextFake(now);

        this.gamePlayers = this.players.map((p, i) => ({
            id: p.id,
            idx: i,
            config: p,
            x: 0,
            y: 0,
            anim: 'IDLE',
            expression: 'angry',
            reactionTime: null
        }));

        this.calculatePositions();
    }

    scheduleNextFake(currentTime) {
        this.fakeType = Math.floor(this.p.random(0, 3));
        this.nextFakeTime = currentTime + this.p.random(1500, 3000);
    }

    calculatePositions() {
        const count = this.gamePlayers.length;
        const spacing = 300;
        const totalW = (count - 1) * spacing;
        const startX = this.CX - totalW / 2;

        this.gamePlayers.forEach((p, i) => {
            p.x = startX + i * spacing;
            p.y = this.CY + 100;
        });
    }

    onPlayerInput(player, type) {
        if (type !== 'PRESS') return;

        const gp = this.gamePlayers.find(p => p.id === player.id);
        if (!gp || this.players[gp.idx].isEliminated || gp.reactionTime !== null) return;

        if (this.gameState === 'WAITING') {
            this.handleFalseStart(gp);
        } else if (this.gameState === 'FLASH' || this.gameState === 'END_DELAY') {
            this.handleStrike(gp);
        }
    }

    handleFalseStart(gp) {
        this.playSound('bump');
        this.shake(10, 10);

        gp.anim = 'DIZZY';
        gp.expression = 'stunned';
        gp.reactionTime = "FAIL";

        this.ui.showTurnMessage(`${gp.config.name} moved too early!`, '#e74c3c');
        this.eliminatePlayer(gp.idx);
    }

    handleStrike(gp) {
        const reaction = Math.floor(this.p.millis() - this.flashTime);
        gp.reactionTime = reaction;

        if (!this.roundWinner) {
            this.roundWinner = gp;
            this.gameState = 'END_DELAY';

            this.playSound('jump'); // Sword sound

            // --- ANIMATION SEQUENCE ---
            // 1. Strike!
            gp.anim = 'ATTACK';
            gp.expression = 'angry';
            this.winAnimTimer = this.p.millis() + 600; // Strike for 600ms

            // 2. Set losers to cower
            this.gamePlayers.forEach(p => {
                if (p !== gp && !this.players[p.idx].isEliminated) {
                    p.anim = 'LOSE';
                    p.expression = 'stunned';
                }
            });

            this.ui.showTurnMessage(`${gp.config.name} Wins! (${reaction}ms)`, '#2ecc71');
            this.updateUI();

            setTimeout(() => {
                this.endRound(this.players[gp.idx]);
            }, 2000);

        } else {
            // Late swing
            gp.anim = 'ATTACK';
            gp.expression = 'idle';
            this.playSound('click');
        }
    }

    runDemoAI() {
        const t = this.p.millis();

        this.gamePlayers.forEach(gp => {
            if (this.players[gp.idx].isEliminated || gp.reactionTime !== null) return;

            if (this.gameState === 'WAITING' && this.fakeAlpha > 100 && this.p.random() < 0.1) {
                this.simulateInput(gp.idx, 'PRESS');
            }

            if (this.gameState === 'FLASH' || this.gameState === 'END_DELAY') {
                const reflex = 200 + (gp.idx * 50) + this.p.random(0, 150);
                if (t > this.flashTime + reflex) {
                    this.simulateInput(gp.idx, 'PRESS');
                }
            }
        });
    }

    onDraw() {
        const p = this.p;
        const t = p.millis();

        // 1. Logic Update
        if (this.gameState === 'WAITING') {
            if (t >= this.flashTime) {
                this.gameState = 'FLASH';
                this.playSound('click');
                this.bgAlpha = 255;
            }
            else if (t >= this.nextFakeTime && t < this.flashTime - 1000) {
                this.playSound('pop');
                this.fakeAlpha = 255;
                this.fakeAnim = 0;
                this.scheduleNextFake(t);
            }
        }

        // --- ANIMATION UPDATE ---
        // If Winner finished striking, switch to Victory Jump
        if (this.gameState === 'END_DELAY' && this.roundWinner) {
            if (t > this.winAnimTimer && this.roundWinner.anim === 'ATTACK') {
                this.roundWinner.anim = 'WIN';
                this.roundWinner.expression = 'happy';
            }
        }

        // 2. Background
        p.background(this.skyColor);
        p.noStroke();
        p.fill(255, 255, 255, 50);
        p.circle(this.CX, this.CY - 200, 400);

        p.fill('#f6e58d');
        p.rect(-5000, this.CY + 100, 10000, this.V_HEIGHT);

        p.stroke('#bcaaa4'); p.strokeWeight(8);
        for (let x = -2000; x < 4000; x += 300) {
            p.line(x, this.CY + 100, x, this.V_HEIGHT);
        }

        p.noStroke();
        p.fill('#2c3e50');
        p.rect(-5000, this.CY + 80, 10000, 40);

        // 3. Players
        this.gamePlayers.forEach(gp => {
            p.push();
            p.translate(gp.x, gp.y);

            p.fill(0, 50); p.noStroke();
            p.ellipse(0, 70, 80, 20);

            this.avatars.applyTransform(gp.anim);

            this.avatars.draw({
                x: 0, y: 0,
                size: 140,
                color: gp.config.color,
                variant: gp.config.variant,
                accessory: gp.config.accessory,
                expression: gp.expression,
                facing: 1
            });

            if (gp.reactionTime !== null) {
                p.push();
                p.translate(0, -120);

                p.fill(0, 150);
                p.noStroke();
                p.rectMode(p.CENTER);
                p.rect(0, 0, 120, 50, 10);
                p.triangle(-10, 25, 10, 25, 0, 35);

                p.fill(255);
                p.textAlign(p.CENTER, p.CENTER);
                p.textSize(28);
                p.textStyle(p.BOLD);

                let timeStr = gp.reactionTime === "FAIL" ? "X" : gp.reactionTime;
                p.text(timeStr, 0, 0);

                if (gp === this.roundWinner) {
                    p.fill('#f1c40f');
                    p.textSize(20);
                    p.text("WIN", 0, -40);
                }
                p.pop();
            }
            p.pop();
        });

        // 4. Fakeout Visuals
        if (this.fakeAlpha > 0) {
            this.fakeAlpha -= 6;
            this.fakeAnim += 0.1;

            p.fill(0, 0, 0, this.fakeAlpha * 0.3);
            p.rect(-5000, -5000, 10000, 10000);

            p.push();
            p.translate(this.CX, this.CY - 150);

            const scale = 1 + Math.sin(this.fakeAnim) * 0.2;
            p.scale(scale);

            p.textSize(150);
            p.textAlign(p.CENTER, p.CENTER);
            p.textStyle(p.BOLD);
            p.noStroke();

            if (this.fakeType === 0) {
                p.fill('#f1c40f'); // Yellow
                p.text("?", 0, 0);
            } else if (this.fakeType === 1) {
                p.fill('#9b59b6'); // Purple
                p.text("☠", 0, 0);
            } else {
                p.fill('#95a5a6'); // Grey
                p.textSize(120);
                p.text("Zzz", 0, 0);
            }
            p.pop();
        }

        // 5. Real Flash
        if (this.bgAlpha > 0) {
            p.fill(255, 255, 255, this.bgAlpha);
            p.rect(-5000, -5000, 10000, 10000);
            this.bgAlpha -= 15;
        }

        // 6. Signal
        if (this.gameState === 'FLASH' || this.gameState === 'END_DELAY') {
            p.push();
            p.translate(this.CX, this.CY - 150);
            p.scale(1 + Math.sin(t * 0.05) * 0.1);

            p.fill('#e74c3c');
            p.noStroke();
            p.rectMode(p.CENTER);
            p.rect(0, -20, 40, 100, 10);
            p.circle(0, 60, 40);

            p.pop();
        }
    }
}