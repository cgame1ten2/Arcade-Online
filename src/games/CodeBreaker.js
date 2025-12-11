import BaseGame from './BaseGame.js';
import AvatarSystem from '../core/AvatarSystem.js';

export default class CodeBreaker extends BaseGame {

    onSetup() {
        // --- GAME RULES ---
        // First to 5 Points wins the Game.
        this.config.winCondition = 'SCORE'; 
        this.config.winValue = 5; 
        
        // We handle round flow manually to allow infinite guesses per round
        this.config.roundEndCriteria = 'NONE'; 
        this.config.livesPerRound = 1;
        this.config.eliminateOnDeath = false;
        
        // Disable auto-loop UI because we manage the specific "Winner Found" popup
        this.config.showRoundResultUI = false;

        this.avatars = new AvatarSystem(this.p);
        
        this.secretNumber = 0;
        this.playerStates = [];
        this.activeJudges = [];
        this.gameState = 'GUESSING'; // GUESSING, REVEAL, ROUND_OVER
        
        // Track if we need a new number for the next round
        this.needNewSecret = true;
    }

    onRoundStart() {
        // Only pick a new number if someone actually won the previous round
        if (this.needNewSecret) {
            this.secretNumber = Math.floor(this.p.random(0, 100));
            // console.log("New Secret:", this.secretNumber); // For Debugging
            this.needNewSecret = false;
            this.activeJudges = [];
            
            // Hard Reset Players for fresh round
            this.playerStates = this.players.map((p, i) => ({
                id: p.id,
                config: p,
                index: i,
                phase: 'tens', 
                digit: 0,
                digitTimer: 0,
                tens: 0,
                ones: 0,
                guess: null,
                diff: 100,
                isClosest: false,
                lastRoundGuess: null,
                lastRoundFeedback: null // null, 'low', 'high', 'win'
            }));
        } else {
            // Soft Reset: Keep previous guess/feedback visible so they can deduce
            this.gameState = 'GUESSING';
            this.playerStates.forEach(ps => {
                ps.phase = 'tens';
                ps.digit = 0;
                // Keep lastRoundFeedback intact!
            });
        }
    }

    onPlayerInput(player, type) {
        if (type === 'PRESS' && this.gameState === 'GUESSING') {
            const ps = this.playerStates.find(state => state.id === player.id);
            if (ps) this.lockDigit(ps);
        }
    }

    runDemoAI() {
        this.playerStates.forEach(ps => {
            if (ps.phase !== 'locked' && ps.phase !== 'done' && this.p.random() < 0.02) {
                this.lockDigit(ps);
            }
        });
    }

    onDraw() {
        const p = this.p;
        
        if (this.gameState === 'GUESSING') {
            this.updateSpinners();
            this.checkAllLocked();
        }

        this.updateJudges();
        this.drawJudges();
        this.drawPlayerColumns();
    }

    updateSpinners() {
        const p = this.p;
        const interval = 600; 
        
        this.playerStates.forEach(ps => {
            if (ps.phase === 'locked' || ps.phase === 'done') return;
            if (p.millis() - ps.digitTimer > interval) {
                ps.digit = (ps.digit + 1) % 10;
                ps.digitTimer = p.millis();
            }
        });
    }

    lockDigit(ps) {
        if (ps.phase === 'locked') return;

        this.playSound('click');

        if (ps.phase === 'tens') {
            ps.tens = ps.digit;
            ps.phase = 'ones';
            ps.digit = 0;
            ps.digitTimer = this.p.millis();
        } else if (ps.phase === 'ones') {
            ps.ones = ps.digit;
            ps.guess = ps.tens * 10 + ps.ones;
            ps.phase = 'locked';
        }
    }

    checkAllLocked() {
        const allLocked = this.playerStates.every(ps => ps.phase === 'locked');
        if (allLocked) {
            this.gameState = 'REVEAL';
            setTimeout(() => this.evaluateGuesses(), 1000);
        }
    }

    evaluateGuesses() {
        this.activeJudges = [];

        let exactMatch = false;
        let winnerName = "";
        let bestDiff = 100;

        // 1. Calculate Diff & Feedback
        this.playerStates.forEach(ps => {
            const diff = ps.guess - this.secretNumber;
            ps.diff = Math.abs(diff);
            ps.lastRoundGuess = ps.guess;

            if (diff === 0) { 
                ps.lastRoundFeedback = 'win'; 
                exactMatch = true; 
                winnerName = ps.config.name;
            }
            else if (diff < 0) ps.lastRoundFeedback = 'low'; // Guessed low, need UP arrow
            else ps.lastRoundFeedback = 'high'; // Guessed high, need DOWN arrow

            if (ps.diff < bestDiff) bestDiff = ps.diff;
            ps.phase = 'done';
            ps.isClosest = false;
        });

        // 2. Determine "Closest" for visual robot (even if not exact)
        const availableW = this.V_WIDTH - 400;
        const colW = availableW / this.playerStates.length;
        const startX = 200;

        this.playerStates.forEach(ps => {
            if (ps.diff === bestDiff) {
                ps.isClosest = true;
                this.activeJudges.push({
                    x: this.CX,
                    targetX: startX + colW * ps.index + colW / 2,
                    anim: 0,
                    label: exactMatch ? "WINNER!" : "CLOSEST!"
                });
            }
        });

        // 3. Logic Branch
        if (exactMatch) {
            // --- SOMEONE WON THE ROUND ---
            this.playSound('win');
            
            // Award Points (BaseGame handles win condition automatically)
            this.playerStates.forEach(ps => {
                if (ps.diff === 0) {
                    const pObj = this.players[ps.index];
                    if (pObj) pObj.score++; 
                }
            });
            this.updateUI();

            this.needNewSecret = true; // Prepare fresh number for next round

            // Wait 2 seconds to see results, then popup
            setTimeout(() => {
                if (this.mode !== 'demo') {
                    // Check if Game is Over first? BaseGame checks this usually.
                    // But we want to show the specific number reveal.
                    this.ui.showMessage(`Number Found: ${this.secretNumber}!`, `${winnerName} got it!`, "Next Round", () => {
                        this.endRound(); 
                    });
                } else {
                    this.endRound();
                }
            }, 2000);

        } else {
            // --- NO WINNER, CONTINUE GUESSING ---
            this.playSound('bump');
            this.needNewSecret = false; // Keep same number!
            
            // Wait 2 seconds, then let them guess again
            // We use startNewRound() to trigger the soft reset logic
            setTimeout(() => {
                this.startNewRound(); 
            }, 2000);
        }
    }

    updateJudges() {
        this.activeJudges.forEach(j => {
            j.x = this.p.lerp(j.x, j.targetX, 0.05);
            j.anim += 0.1;
        });
    }

    drawJudges() {
        this.activeJudges.forEach(j => this.drawJudge(j));
    }

    drawJudge(j) {
        const p = this.p;
        p.push();
        p.translate(j.x, 200); 
        p.translate(0, Math.sin(j.anim) * 5);
        
        p.fill(50); p.noStroke();
        p.rectMode(p.CENTER); p.rect(0, 0, 60, 60, 8);
        p.fill(0); p.rect(0, -8, 45, 30);
        p.fill('#0f0'); p.circle(-12, -8, 6); p.circle(12, -8, 6);
        p.fill(100); p.rect(0, -38, 8, 15);
        p.push(); p.translate(0, -45); p.rotate(j.anim * 2); p.rect(0, 0, 90, 8); p.pop();

        if (Math.abs(j.x - j.targetX) < 10) {
            p.fill(255); p.noStroke();
            p.rect(0, -75, 140, 40, 8);
            p.triangle(0, -55, -8, -40, 8, -40);
            p.fill(0); p.textSize(18); p.textAlign(p.CENTER, p.CENTER);
            p.text(j.label, 0, -75);
        }
        p.pop();
    }

    drawPlayerColumns() {
        const p = this.p;
        const availableW = this.V_WIDTH - 400;
        const colW = availableW / this.playerStates.length;
        const startX = 200;

        this.playerStates.forEach((ps, i) => {
            const cx = startX + i * colW + colW / 2;
            p.push();
            p.translate(cx, 0);

            let exp = 'idle';
            if (ps.lastRoundFeedback === 'win') exp = 'happy';
            else if (ps.isClosest) exp = 'happy';

            this.avatars.draw({
                x: 0, y: 350, size: 110,
                color: ps.config.color, variant: ps.config.variant,
                accessory: ps.config.accessory,
                expression: exp
            });

            if (ps.lastRoundFeedback) {
                p.push();
                p.translate(0, 600);
                if (ps.lastRoundFeedback === 'win') {
                    p.fill(ps.config.color); p.noStroke();
                    p.circle(0, 0, 160);
                    p.fill(255); p.textSize(80); p.textAlign(p.CENTER, p.CENTER);
                    p.text("★", 0, 8);
                } else {
                    p.fill(ps.config.color); p.noStroke();
                    p.circle(0, 0, 140);
                    p.fill(255); p.textSize(60); p.textStyle(p.BOLD); p.textAlign(p.CENTER, p.CENTER);
                    p.text(ps.lastRoundGuess, 0, 5);
                    
                    const isUp = ps.lastRoundFeedback === 'low'; 
                    const yOff = isUp ? -110 : 110;
                    p.push();
                    p.translate(0, yOff);
                    if (!isUp) p.rotate(p.PI);
                    p.fill(ps.config.color); p.noStroke();
                    p.beginShape();
                    p.vertex(0, -40); p.bezierVertex(20, -40, 40, 0, 40, 15);
                    p.vertex(40, 15); p.vertex(20, 15); p.vertex(20, 40);
                    p.vertex(-20, 40); p.vertex(-20, 15); p.vertex(-40, 15);
                    p.bezierVertex(-40, 0, -20, -40, 0, -40);
                    p.endShape(p.CLOSE);
                    p.pop();
                }
                p.pop();
            }

            const spinY = 900;
            p.stroke(ps.config.color); p.strokeWeight(6); p.fill(255);
            p.rectMode(p.CENTER);
            
            p.fill(ps.phase === 'tens' ? '#fff' : '#eee');
            p.rect(-50, spinY, 90, 130, 15);
            
            p.fill(ps.phase === 'ones' ? '#fff' : '#eee');
            p.rect(50, spinY, 90, 130, 15);

            p.fill(0); p.noStroke(); p.textSize(80); p.textAlign(p.CENTER, p.CENTER);
            
            let tVal = ps.phase === 'tens' ? ps.digit : ps.tens;
            let oVal = ps.phase === 'ones' ? ps.digit : (ps.phase === 'tens' ? '-' : ps.ones);
            
            // If guessing, show digits. If we have feedback, show that instead?
            // Actually, showing the GUESS is correct during 'done' phase.
            if (ps.phase === 'locked' || ps.phase === 'done') {
                tVal = Math.floor(ps.guess / 10);
                oVal = ps.guess % 10;
            }
            
            p.text(tVal, -50, spinY);
            p.text(oVal, 50, spinY);
            
            p.textSize(24); p.fill(100);
            let status = "";
            if (ps.phase === 'tens') status = "PICK TENS";
            else if (ps.phase === 'ones') status = "PICK ONES";
            else status = "LOCKED";
            p.text(status, 0, spinY + 100);
            
            p.pop();
        });
    }
}
