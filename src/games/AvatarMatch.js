/* src/games/AvatarMatch.js */

import BaseGame from './BaseGame.js';
import AvatarSystem from '../core/AvatarSystem.js';

export default class AvatarMatch extends BaseGame {

    onSetup() {
        this.config.winCondition = 'CUSTOM';
        this.config.livesPerRound = 1; 
        this.config.eliminateOnDeath = false;
        this.config.turnBased = true;
        this.config.turnBasedBackgroundColor = true;

        this.CARD_SIZE = 150;
        this.GAP = 20;
        this.ANIM_SPEED = 0.15;

        this.avatars = new AvatarSystem(this.p);
        this.cards = [];
        this.flippedCards = [];
        this.matchesFound = 0;
        this.totalPairs = 0;
        this.canClick = true;
    }

    onRoundStart() {
        this.cards = [];
        this.flippedCards = [];
        this.matchesFound = 0;
        this.canClick = true;
        this.generateBoard();
    }

    onPlayerInput(player, type, payload) {
        // Handle Mobile Touch (Normalized 0.0-1.0)
        if (type === 'TOUCH' && payload) {
            // Convert to Game Virtual Coordinates
            const vx = payload.x * this.V_WIDTH;
            const vy = payload.y * this.V_HEIGHT;
            this.handleInputClick(vx, vy);
        }
    }

    generateBoard() {
        // ... (Same as before) ...
        const pCount = this.players.length;
        if (pCount <= 2) this.totalPairs = 12;
        else if (pCount === 3) this.totalPairs = 15;
        else this.totalPairs = 18;

        const pairs = [];
        const usedConfigs = new Set();

        for (let i = 0; i < this.totalPairs; i++) {
            let config;
            let hash;
            let attempts = 0;
            do {
                config = this.generateRandomConfig(i);
                hash = `${config.color}-${config.accessory}-${config.variant}`;
                attempts++;
            } while (usedConfigs.has(hash) && attempts < 200);
            
            usedConfigs.add(hash);
            pairs.push({ ...config });
            pairs.push({ ...config });
        }

        this.shuffle(pairs);

        const totalCards = pairs.length;
        const cols = 6; 
        const rows = Math.ceil(totalCards / cols);
        const totalW = cols * this.CARD_SIZE + (cols - 1) * this.GAP;
        const totalH = rows * this.CARD_SIZE + (rows - 1) * this.GAP;
        const startX = (this.V_WIDTH - totalW) / 2 + this.CARD_SIZE / 2;
        const startY = (this.V_HEIGHT - totalH) / 2 + this.CARD_SIZE / 2;

        let idx = 0;
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if (idx >= pairs.length) break;
                this.cards.push({
                    x: startX + x * (this.CARD_SIZE + this.GAP),
                    y: startY + y * (this.CARD_SIZE + this.GAP),
                    data: pairs[idx],
                    isFlipped: false, isMatched: false, matchOwner: null, scaleX: 1, flipState: 'back'
                });
                idx++;
            }
        }
    }

    generateRandomConfig(id) {
        const colors = ['#FF6B6B', '#4D96FF', '#FFD93D', '#6BCB77', '#A66CFF', '#FF9F43', '#54a0ff', '#5f27cd', '#ff9ff3', '#00d2d3', '#ffcccc', '#cd84f1', '#ffb8b8', '#32ff7e', '#18dcff', '#7d5fff', '#3ae374', '#ff3838'];
        const accs = AvatarSystem.ACCESSORIES;
        return {
            color: this.p.random(colors),
            accessory: this.p.random(accs),
            variant: this.p.random(['default', 'feminine']),
            id: id
        };
    }

    onDraw() {
        const p = this.p;
        for (let i = 0; i < this.cards.length; i++) this.drawCard(this.cards[i]);

        // Handle Mouse (Local Computer)
        if (this.mode !== 'demo' && p.mouseIsPressed) {
            const vx = (p.mouseX - this.transX) / this.scaleFactor;
            const vy = (p.mouseY - this.transY) / this.scaleFactor;
            this.handleInputClick(vx, vy);
            p.mouseIsPressed = false; 
        }
    }

    runDemoAI() {
        if (this.p.frameCount % 60 === 0 && this.flippedCards.length < 2) {
            const available = this.cards.filter(c => !c.isMatched && !c.isFlipped);
            if (available.length > 0) this.flipCard(this.p.random(available));
        }
    }

    drawCard(card) {
        const p = this.p;
        p.push();
        p.translate(card.x, card.y);

        if (card.flipState === 'flipping_in') {
            card.scaleX -= this.ANIM_SPEED;
            if (card.scaleX <= 0) { card.scaleX = 0; card.isFlipped = !card.isFlipped; card.flipState = 'flipping_out'; }
        } else if (card.flipState === 'flipping_out') {
            card.scaleX += this.ANIM_SPEED;
            if (card.scaleX >= 1) { 
                card.scaleX = 1; card.flipState = 'idle'; 
                if (this.flippedCards.length === 2 && card.isFlipped) this.checkMatch(); 
            }
        }

        p.scale(card.scaleX, 1);
        p.noStroke(); p.fill(0, 30); p.rectMode(p.CENTER); p.rect(6, 6, this.CARD_SIZE, this.CARD_SIZE, 16);

        if (!card.isFlipped && !card.isMatched) {
            p.fill('#fff'); p.rect(0, 0, this.CARD_SIZE, this.CARD_SIZE, 16);
            p.fill('#f0f0f0'); p.circle(0, 0, 90);
            p.fill('#ccc'); p.textSize(70); p.textAlign(p.CENTER, p.CENTER); p.textStyle(p.BOLD); p.text('?', 0, 6);
        } else {
            if (card.isMatched) { p.fill(card.matchOwner || '#fff'); p.stroke(255); p.strokeWeight(6); } else { p.fill('#fff'); p.noStroke(); }
            p.rect(0, 0, this.CARD_SIZE, this.CARD_SIZE, 16);
            this.avatars.draw({ x: 0, y: 15, size: 90, color: card.data.color, variant: card.data.variant, accessory: card.data.accessory, expression: card.isMatched ? 'happy' : 'idle' });
        }
        p.pop();
    }

    handleInputClick(vx, vy) {
        if (!this.canClick) return;
        for (let i = this.cards.length - 1; i >= 0; i--) {
            const c = this.cards[i];
            if (c.isMatched || c.isFlipped) continue;
            const half = this.CARD_SIZE / 2;
            if (vx > c.x - half && vx < c.x + half && vy > c.y - half && vy < c.y + half) {
                this.flipCard(c);
                break;
            }
        }
    }

    flipCard(card) {
        this.playSound('click');
        if (this.flippedCards.length >= 2) return;
        card.flipState = 'flipping_in';
        this.flippedCards.push(card);
    }

    checkMatch() {
        const c1 = this.flippedCards[0];
        const c2 = this.flippedCards[1];

        if (c1.data.id === c2.data.id) {
            this.canClick = false;
            setTimeout(() => {
                const player = this.players[this.state.activePlayerIndex];
                c1.isMatched = true; c2.isMatched = true;
                c1.matchOwner = player.color; c2.matchOwner = player.color;
                this.playSound('win');
                player.score++;
                this.updateUI();
                this.flippedCards = [];
                this.matchesFound++;
                this.canClick = true;
                if (this.matchesFound === this.totalPairs) this.finishGame();
            }, 400);
        } else {
            this.canClick = false;
            setTimeout(() => {
                this.playSound('bump');
                c1.flipState = 'flipping_in'; c2.flipState = 'flipping_in';
                this.flippedCards = [];
                this.nextTurn();
                this.canClick = true;
            }, 800);
        }
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}
