/* src/games/AvatarMatch.js */
import BaseGame from './BaseGame.js';
import AvatarSystem from '../core/AvatarSystem.js';

export default class AvatarMatch extends BaseGame {

    onSetup() {
        this.config.winCondition = 'CUSTOM';
        this.config.livesPerRound = 1; 
        this.config.turnBased = true;
        this.config.turnBasedBackgroundColor = true;

        this.CARD_SIZE = 150; 
        this.GAP = 20;
        this.ANIM_SPEED = 0.15;
        this.avatars = new AvatarSystem(this.p);
    }

    onRoundStart() {
        this.cards = [];
        this.flippedCards = [];
        this.matchesFound = 0;
        this.generateBoard();
    }

    // NEW: Handle Virtual Cursor Clicks (Mobile)
    onCursorClick(playerId, x, y) {
        if (this.state.phase !== 'PLAYING') return;
        
        // Ensure it's this player's turn
        const currentPlayer = this.players[this.state.activePlayerIndex];
        if (currentPlayer.id !== playerId) return;

        this.checkCardClick(x, y);
    }

    onDraw() {
        const p = this.p;
        
        // Draw Cards
        for (let i = 0; i < this.cards.length; i++) {
            this.drawCard(this.cards[i]);
        }

        // Mouse Logic (Desktop)
        if (this.mode !== 'demo' && p.mouseIsPressed) {
            const vx = (p.mouseX - this.transX) / this.scaleFactor;
            const vy = (p.mouseY - this.transY) / this.scaleFactor;
            
            // Check turn for mouse (Local Player)
            const currentPlayer = this.players[this.state.activePlayerIndex];
            if (currentPlayer.type === 'local') {
                this.checkCardClick(vx, vy);
            }
            p.mouseIsPressed = false; 
        }
    }

    checkCardClick(vx, vy) {
        if (this.flippedCards.length >= 2) return; // Wait for animation

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

    // ... (Rest of logic: flipCard, checkMatch, generateBoard, drawCard identical to before) ...
    // Note: Ensure flipCard calls nextTurn() properly on mismatch.
    
    flipCard(card) {
        this.playSound('click');
        card.flipState = 'flipping_in';
        this.flippedCards.push(card);
    }

    // Included for completeness
    generateBoard() { /* ... same as before ... */ 
        const pCount = this.players.length;
        this.totalPairs = (pCount <= 2) ? 12 : 18;
        const pairs = [];
        for (let i = 0; i < this.totalPairs; i++) {
            const c = this.generateRandomConfig(i);
            pairs.push({ ...c }); pairs.push({ ...c });
        }
        this.shuffle(pairs);
        const cols = 6; const rows = Math.ceil(pairs.length / cols);
        const totalW = cols * this.CARD_SIZE + (cols - 1) * this.GAP;
        const totalH = rows * this.CARD_SIZE + (rows - 1) * this.GAP;
        const startX = (this.V_WIDTH - totalW) / 2 + this.CARD_SIZE / 2;
        const startY = (this.V_HEIGHT - totalH) / 2 + this.CARD_SIZE / 2;
        
        pairs.forEach((data, i) => {
            const x = startX + (i % cols) * (this.CARD_SIZE + this.GAP);
            const y = startY + Math.floor(i / cols) * (this.CARD_SIZE + this.GAP);
            this.cards.push({ x, y, data, isFlipped:false, isMatched:false, scaleX:1, flipState:'back' });
        });
    }
    
    generateRandomConfig(id) {
        return { color: this.p.random(['#FF6B6B', '#4D96FF', '#FFD93D']), accessory: this.p.random(AvatarSystem.ACCESSORIES), variant: 'default', id };
    }
    
    drawCard(card) { /* ... same as before ... */
        const p = this.p; p.push(); p.translate(card.x, card.y);
        if (card.flipState === 'flipping_in') { card.scaleX -= this.ANIM_SPEED; if(card.scaleX<=0){card.scaleX=0; card.isFlipped=!card.isFlipped; card.flipState='flipping_out';} }
        else if (card.flipState === 'flipping_out') { card.scaleX += this.ANIM_SPEED; if(card.scaleX>=1){card.scaleX=1; card.flipState='idle'; if(this.flippedCards.length===2 && card.isFlipped) this.checkMatch();} }
        p.scale(card.scaleX, 1);
        p.fill(0, 30); p.noStroke(); p.rectMode(p.CENTER); p.rect(6,6,this.CARD_SIZE,this.CARD_SIZE,16);
        if(!card.isFlipped && !card.isMatched) { p.fill('#fff'); p.rect(0,0,this.CARD_SIZE,this.CARD_SIZE,16); p.fill('#eee'); p.circle(0,0,90); p.fill('#ccc'); p.textSize(70); p.textAlign(p.CENTER,p.CENTER); p.text('?',0,6); }
        else { p.fill(card.isMatched?card.matchOwner:'#fff'); p.stroke(255); p.strokeWeight(6); p.rect(0,0,this.CARD_SIZE,this.CARD_SIZE,16); this.avatars.draw({x:0,y:15,size:90,color:card.data.color,variant:card.data.variant,accessory:card.data.accessory,expression:card.isMatched?'happy':'idle'}); }
        p.pop();
    }
    
    checkMatch() {
        const c1=this.flippedCards[0]; const c2=this.flippedCards[1];
        if(c1.data.id === c2.data.id) {
            setTimeout(()=>{
                const p = this.players[this.state.activePlayerIndex];
                c1.isMatched=true; c2.isMatched=true; c1.matchOwner=p.color; c2.matchOwner=p.color;
                this.playSound('win'); p.score++; this.updateUI();
                this.flippedCards=[]; this.matchesFound++;
                if(this.matchesFound===this.totalPairs) this.finishGame();
            },400);
        } else {
            setTimeout(()=>{
                this.playSound('bump'); c1.flipState='flipping_in'; c2.flipState='flipping_in';
                this.flippedCards=[]; this.nextTurn();
            },800);
        }
    }
    shuffle(a) { for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} }
}
