import BaseGame from './BaseGame.js';
import AvatarSystem from '../core/AvatarSystem.js';

export default class SumoDiscs extends BaseGame {

    onSetup() {
        // --- GAME RULES CONFIGURATION ---
        // GAME WIN: First player to reach 5 points wins the Game
        this.config.winCondition = 'SCORE';
        this.config.winValue = 5;

        // ROUND END: Round ends when 1 player is left
        this.config.roundEndCriteria = 'SURVIVAL';

        this.config.eliminateOnDeath = true;

        // Physics Setup
        this.DOJO_RADIUS = 500;
        this.PLAYER_SIZE = 110;
        this.BOOST_FORCE = 0.05;
        this.FRICTION = 0.04;

        this.avatars = new AvatarSystem(this.p);
        this.particles = [];

        const { Engine, World, Bodies, Composite, Events } = Matter;
        this.engine = Engine.create();
        this.world = this.engine.world;
        this.engine.gravity.y = 0;

        this.dojo = Bodies.circle(this.CX, this.CY, this.DOJO_RADIUS, {
            isStatic: true, isSensor: true, label: 'dojo'
        });
        Composite.add(this.world, this.dojo);

        Events.on(this.engine, 'collisionStart', (e) => this.handleCollisions(e));
    }

    runDemoAI() {
        const p = this.p;
        const activeBots = this.gamePlayers.filter(gp => !gp.isDead && !this.players[gp.idx].isEliminated);

        activeBots.forEach(bot => {
            const botPos = bot.body.position;
            const distFromCenter = p.dist(botPos.x, botPos.y, this.CX, this.CY);
            if (distFromCenter > this.DOJO_RADIUS * 0.7) {
                const angleToCenter = Math.atan2(this.CY - botPos.y, this.CX - botPos.x);
                this.steerBot(bot, angleToCenter);
                return;
            }

            let target = null;
            let minDist = 9999;
            activeBots.forEach(enemy => {
                if (enemy === bot) return;
                const d = p.dist(botPos.x, botPos.y, enemy.body.position.x, enemy.body.position.y);
                if (d < minDist) {
                    minDist = d;
                    target = enemy;
                }
            });

            if (target) {
                const angleToEnemy = Math.atan2(target.body.position.y - botPos.y, target.body.position.x - botPos.x);
                this.steerBot(bot, angleToEnemy);
            }
        });
    }

    steerBot(bot, targetAngle) {
        let currentAngle = bot.angle % (Math.PI * 2);
        if (currentAngle < 0) currentAngle += Math.PI * 2;
        let target = targetAngle % (Math.PI * 2);
        if (target < 0) target += Math.PI * 2;
        const diff = target - currentAngle;

        if (Math.abs(diff) < 0.3 || Math.abs(diff) > 6.0) {
            if (this.p.random() < 0.2) {
                this.simulateInput(bot.idx, 'PRESS');
                setTimeout(() => this.simulateInput(bot.idx, 'RELEASE'), 600);
            }
        }
    }

    onPlayerInput(player, type) {
        if (!this.gamePlayers) return;
        const gp = this.gamePlayers.find(p => p.id === player.id);
        if (!gp || gp.isDead) return;

        if (type === 'PRESS') gp.isBoosting = true;
        if (type === 'RELEASE') gp.isBoosting = false;
    }

    onRoundStart() {
        Matter.Composite.clear(this.world, false, true);
        Matter.Composite.add(this.world, this.dojo);
        this.particles = [];

        this.gamePlayers = this.players.map((pState, index) => {
            if (pState.isEliminated) return null;

            const angle = (this.p.TWO_PI / this.players.length) * index;
            const dist = 350;

            const body = Matter.Bodies.circle(
                this.CX + Math.cos(angle) * dist,
                this.CY + Math.sin(angle) * dist,
                this.PLAYER_SIZE / 2,
                {
                    restitution: 1.1,
                    frictionAir: this.FRICTION,
                    label: `player-${index}`,
                    density: 0.002
                }
            );
            Matter.Composite.add(this.world, body);

            return {
                id: pState.id,
                idx: index,
                body: body,
                angle: angle + this.p.PI,
                expression: 'idle',
                expressionTimer: 0,
                config: pState,
                isBoosting: false,
                isDead: false
            };
        }).filter(p => p !== null);
    }

    onDraw() {
        Matter.Engine.update(this.engine, 1000 / 60);
        this.drawDojo();
        this.updatePlayers();
        this.updateParticles();
    }

    updatePlayers() {
        const p = this.p;
        if (!this.gamePlayers) return;

        this.gamePlayers.forEach(gp => {
            if (gp.isDead) return;
            const basePlayer = this.players[gp.idx];
            if (!basePlayer || basePlayer.isEliminated) return;

            if (gp.isBoosting) {
                const force = p5.Vector.fromAngle(gp.angle).mult(this.BOOST_FORCE);
                Matter.Body.applyForce(gp.body, gp.body.position, { x: force.x, y: force.y });

                gp.expression = 'angry';
                gp.expressionTimer = 10;

                if (p.frameCount % 10 === 0) this.playSound('jump');
                if (p.frameCount % 3 === 0) this.addParticle(gp.body.position.x, gp.body.position.y, '#fff', 15);
            } else {
                gp.angle += 0.08;
            }

            const dist = p.dist(gp.body.position.x, gp.body.position.y, this.CX, this.CY);
            if (dist > this.DOJO_RADIUS + this.PLAYER_SIZE / 4) {
                this.killPlayer(gp);
            }

            p.push();
            p.translate(gp.body.position.x, gp.body.position.y);
            this.drawArrow(gp);
            let anim = 'IDLE';
            if (gp.isBoosting) anim = 'RUN';
            if (gp.expression === 'stunned') anim = 'DIZZY';

            this.avatars.applyTransform(anim);
            this.avatars.draw({
                x: 0, y: 0, size: this.PLAYER_SIZE,
                color: gp.config.color, variant: gp.config.variant,
                accessory: gp.config.accessory,
                expression: gp.expression,
                facing: Math.cos(gp.angle) > 0 ? 1 : -1
            });
            p.pop();

            if (gp.expressionTimer > 0) {
                gp.expressionTimer--;
                if (gp.expressionTimer <= 0) gp.expression = 'idle';
            }
        });
    }

    killPlayer(gp) {
        if (gp.isDead) return;
        gp.isDead = true;

        Matter.Composite.remove(this.world, gp.body);
        this.playSound('pop');
        this.shake(10, 15);
        for (let i = 0; i < 10; i++) this.addParticle(gp.body.position.x, gp.body.position.y, gp.config.color, 20);

        this.eliminatePlayer(gp.idx);
    }

    handleCollisions(event) {
        const pairs = event.pairs;
        pairs.forEach(pair => {
            if (pair.bodyA.label.startsWith('player') && pair.bodyB.label.startsWith('player')) {
                this.playSound('bump');
                const midX = (pair.bodyA.position.x + pair.bodyB.position.x) / 2;
                const midY = (pair.bodyA.position.y + pair.bodyB.position.y) / 2;
                for (let i = 0; i < 5; i++) this.addParticle(midX, midY, '#ff0', 10);

                if (!this.gamePlayers) return;
                const pA = this.gamePlayers.find(p => p.body === pair.bodyA);
                const pB = this.gamePlayers.find(p => p.body === pair.bodyB);
                if (pA && !pA.isDead) { pA.expression = 'stunned'; pA.expressionTimer = 20; }
                if (pB && !pB.isDead) { pB.expression = 'stunned'; pB.expressionTimer = 20; }
            }
        });
    }

    drawDojo() {
        const p = this.p;
        p.push();
        p.translate(this.CX, this.CY);
        p.noStroke(); p.fill(220); p.circle(0, 0, this.DOJO_RADIUS * 2 + 40);
        p.fill('#fdf6e3'); p.stroke('#d2b48c'); p.strokeWeight(8);
        p.circle(0, 0, this.DOJO_RADIUS * 2);
        p.noFill(); p.stroke(255, 255, 255, 100); p.strokeWeight(15);
        p.circle(0, 0, this.DOJO_RADIUS * 1.6);
        p.pop();
    }

    drawArrow(player) {
        const p = this.p;
        const r = this.PLAYER_SIZE / 2 + 30;
        p.push();
        p.rotate(player.angle);
        p.translate(r, 0);
        p.fill(player.config.color);
        p.stroke(255); p.strokeWeight(2);
        p.triangle(10, 0, -5, -8, -5, 8);
        p.pop();
    }

    addParticle(x, y, color, size) {
        this.particles.push({ x, y, color, size, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, life: 1.0 });
    }

    updateParticles() {
        const p = this.p;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let part = this.particles[i];
            part.x += part.vx; part.y += part.vy; part.life -= 0.05;
            if (part.life <= 0) {
                this.particles.splice(i, 1);
            } else {
                p.noStroke(); p.fill(p.color(part.color)); p.circle(part.x, part.y, part.size * part.life);
            }
        }
    }

    destroy() {
        Matter.World.clear(this.world);
        Matter.Engine.clear(this.engine);
    }
}