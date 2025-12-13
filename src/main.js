import PlayerManager from './core/PlayerManager.js';
import InputManager from './core/InputManager.js';
import UIManager from './core/UIManager.js';
import GameRunner from './core/GameRunner.js';
import AudioManager from './core/AudioManager.js';
import AvatarSystem from './core/AvatarSystem.js';
import TournamentManager from './core/TournamentManager.js';
import { GAME_LIST } from './GameRegistry.js';

const players = new PlayerManager();
const inputs = new InputManager(players);
const ui = new UIManager();
const audio = new AudioManager();
const runner = new GameRunner(players, inputs, ui, audio);
const tournament = new TournamentManager(runner, ui, players);

let currentMode = 'hub';
let lobbyInstances = [];
let demoInstances = []; 

// DOM Elements
const hubGrid = document.getElementById('hub-grid');
const gameStage = document.getElementById('game-stage');
const backBtn = document.getElementById('back-to-hub-btn');
const setupBtn = document.getElementById('settings-btn');
const setupOverlay = document.getElementById('setup-overlay');
const savePlayersBtn = document.getElementById('save-players-btn');
const addPlayerBtn = document.getElementById('add-player-btn');
const playerConfigGrid = document.getElementById('player-config-grid');

function init() {
    console.log("🚀 Wonder Arcade Engine Started");

    const startAudio = () => {
        audio.init();
        audio.setTrack('lobby');
        document.removeEventListener('click', startAudio);
    };
    document.addEventListener('click', startAudio);

    createTournamentBanner();
    GAME_LIST.forEach(game => createGameCard(game));
    setupListeners();
    setupLobby();
    attachGlobalSoundListeners();
}

function createTournamentBanner() {
    const banner = document.createElement('div');
    banner.id = 'tournament-banner';
    banner.innerHTML = `
        <div class="banner-content">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                <path d="M4 22h16"></path>
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
            </svg>
            <div class="banner-text">
                <h3>TOURNAMENT MODE</h3>
                <p>Play a series of random games to crown a champion!</p>
            </div>
            <button class="banner-btn">START</button>
        </div>
    `;
    banner.onclick = () => showTournamentSetup();
    hubGrid.appendChild(banner);
}

function pauseDemos() {
    demoInstances.forEach(p5inst => p5inst.noLoop());
}

function resumeDemos() {
    demoInstances.forEach(p5inst => p5inst.loop());
}

function showTournamentSetup() {
    audio.play('click');

    ui.centerMessage.innerHTML = `
        <div class="message-card">
            <h1>Tournament Setup</h1>
            <p>How many rounds?</p>
            <div class="tourney-opts">
                <button class="tourney-btn" onclick="window.startTourney(3)"><span>3</span>Rounds</button>
                <button class="tourney-btn" onclick="window.startTourney(5)"><span>5</span>Rounds</button>
                <button class="tourney-btn" onclick="window.startTourney(7)"><span>7</span>Rounds</button>
            </div>
            <button id="cancel-tourney" class="secondary-btn">Cancel</button>
        </div>
    `;
    ui.centerMessage.classList.add('visible');

    window.startTourney = (rounds) => {
        ui.hideMessage();
        audio.play('click');
        enterGameMode();
        tournament.startTournament(rounds);
    };

    document.getElementById('cancel-tourney').onclick = () => {
        audio.play('click');
        ui.hideMessage();
    };
}

function createGameCard(gameConfig) {
    const card = document.createElement('div');
    card.className = 'game-card';
    const canvasId = 'card-' + gameConfig.id;

    card.innerHTML = `
        <div class="card-canvas-wrapper" id="${canvasId}"></div>
        <div class="card-info">
            <h3>${gameConfig.title}</h3>
            <p>${gameConfig.description}</p>
        </div>
    `;

    card.addEventListener('click', () => {
        audio.play('click');
        enterGameMode();
        runner.mount(gameConfig.class, 'game-canvas-container', 'active');
    });

    hubGrid.appendChild(card);
    
    const p5inst = runner.mount(gameConfig.class, canvasId, 'demo');
    demoInstances.push(p5inst);
}

function enterGameMode() {
    currentMode = 'game';
    audio.setTrack('game');
    gameStage.classList.remove('hidden');
    pauseDemos();
}

function returnToHub() {
    audio.play('click');
    location.reload();
}

function setupLobby() {
    setupBtn.addEventListener('click', () => {
        audio.play('click');
        audio.setTrack('config'); 
        renderVisualLobby();
        setupOverlay.classList.remove('hidden');
        pauseDemos();
    });

    savePlayersBtn.addEventListener('click', () => {
        audio.play('click');
        audio.setTrack('lobby');
        setupOverlay.classList.add('hidden');
        cleanupLobby();
        location.reload(); 
    });

    addPlayerBtn.addEventListener('click', () => {
        audio.play('click');
        players.addPlayer();
        renderVisualLobby();
    });
}

function cleanupLobby() {
    lobbyInstances.forEach(p => p.remove());
    lobbyInstances = [];
}

function renderVisualLobby() {
    cleanupLobby();

    const controls = document.querySelector('.lobby-controls');
    const existingSettings = document.querySelector('.lobby-settings');
    if (existingSettings) existingSettings.remove();

    const settingsDiv = document.createElement('div');
    settingsDiv.className = 'lobby-settings';
    settingsDiv.innerHTML = `
        <button id="toggle-music" class="setting-toggle ${audio.musicEnabled ? 'active' : ''}">Music: ${audio.musicEnabled ? 'ON' : 'OFF'}</button>
        <button id="toggle-sfx" class="setting-toggle ${audio.sfxEnabled ? 'active' : ''}">SFX: ${audio.sfxEnabled ? 'ON' : 'OFF'}</button>
    `;
    controls.insertBefore(settingsDiv, controls.firstChild);

    document.getElementById('toggle-music').onclick = (e) => {
        const newState = !audio.musicEnabled;
        audio.toggleMusic(newState);
        e.target.textContent = `Music: ${newState ? 'ON' : 'OFF'}`;
        e.target.classList.toggle('active', newState);
        audio.play('click');
        if (newState) audio.setTrack('config');
    };

    document.getElementById('toggle-sfx').onclick = (e) => {
        const newState = !audio.sfxEnabled;
        audio.toggleSfx(newState);
        e.target.textContent = `SFX: ${newState ? 'ON' : 'OFF'}`;
        e.target.classList.toggle('active', newState);
        audio.play('click');
    };

    playerConfigGrid.innerHTML = '';
    const activePlayers = players.getActivePlayers();

    activePlayers.forEach((p, index) => {
        const card = document.createElement('div');
        card.className = 'player-setup-card';
        const previewId = `preview-${index}`;

        card.innerHTML = `
            <div class="setup-preview" id="${previewId}"></div>
            <div class="setup-inputs">
                <input type="text" value="${p.name}" class="name-input" data-idx="${index}">
                <input type="range" min="0" max="360" value="${getHueFromHex(p.color)}" class="hue-slider" data-idx="${index}">
            </div>
            <div class="setup-opts">
                <button class="setup-btn var-btn" data-idx="${index}">${p.variant === 'default' ? 'Boy' : 'Girl'}</button>
                <button class="setup-btn acc-btn" data-idx="${index}">${p.accessory}</button>
            </div>
            ${activePlayers.length > 2 ? `<button class="del-btn" data-idx="${index}">Remove</button>` : ''}
        `;

        playerConfigGrid.appendChild(card);

        const sketch = (sketchP) => {
            const avatars = new AvatarSystem(sketchP);
            let expression = 'idle';
            let nextBlink = 0;

            sketchP.setup = () => {
                sketchP.createCanvas(200, 200);
            };
            sketchP.draw = () => {
                sketchP.clear();
                sketchP.push();
                sketchP.translate(100, 100);
                const t = sketchP.millis();
                const breath = sketchP.sin(t * 0.003) * 0.03;
                sketchP.scale(1 + breath, 1 - breath);

                if (t > nextBlink) {
                    const exps = ['idle', 'happy', 'stunned'];
                    expression = sketchP.random(exps);
                    nextBlink = t + sketchP.random(2000, 5000);
                    setTimeout(() => expression = 'idle', 1000);
                }

                // FIX: Get FRESH player data directly from manager every frame
                const freshP = players.getPlayer(index); 
                if (freshP) {
                    avatars.draw({
                        x: 0, y: 0, size: 90,
                        color: freshP.color, variant: freshP.variant, accessory: freshP.accessory, expression: expression
                    });
                }
                sketchP.pop();
            };
        };
        lobbyInstances.push(new p5(sketch, previewId));
    });

    bindLobbyInputs();
}

function bindLobbyInputs() {
    const accessories = AvatarSystem.ACCESSORIES;

    // NAME INPUT
    const nameInputs = document.querySelectorAll('.name-input');
    nameInputs.forEach(el => {
        el.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            players.updatePlayer(idx, { name: e.target.value });
        });
    });

    // COLOR SLIDER
    const hueSliders = document.querySelectorAll('.hue-slider');
    hueSliders.forEach(el => {
        el.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const hue = e.target.value;
            const color = hslToHex(hue, 85, 60);
            players.updatePlayer(idx, { color: color });
        });
    });

    // VARIANT BUTTON
    const varBtns = document.querySelectorAll('.var-btn');
    varBtns.forEach(el => {
        el.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const p = players.getPlayer(idx);
            const newVar = p.variant === 'default' ? 'feminine' : 'default';
            players.updatePlayer(idx, { variant: newVar });
            e.target.textContent = newVar === 'default' ? 'Boy' : 'Girl';
            audio.play('click');
        });
    });

    // ACCESSORY BUTTON
    const accBtns = document.querySelectorAll('.acc-btn');
    accBtns.forEach(el => {
        el.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const p = players.getPlayer(idx);
            let currIdx = accessories.indexOf(p.accessory);
            if (currIdx === -1) currIdx = 0;
            let nextAcc = accessories[(currIdx + 1) % accessories.length];
            players.updatePlayer(idx, { accessory: nextAcc });
            e.target.textContent = nextAcc;
            audio.play('click');
        });
    });

    // REMOVE BUTTON
    const delBtns = document.querySelectorAll('.del-btn');
    delBtns.forEach(el => {
        el.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            audio.play('click');
            players.removePlayer(idx);
            renderVisualLobby(); // Re-render grid
        });
    });
}

function hslToHex(h, s, l) {
    l /= 100; const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function getHueFromHex(hex) {
    let r = parseInt(hex.substring(1, 3), 16) / 255;
    let g = parseInt(hex.substring(3, 5), 16) / 255;
    let b = parseInt(hex.substring(5, 7), 16) / 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max == min) { h = s = 0; }
    else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return h * 360;
}

function setupListeners() {
    backBtn.textContent = "Exit Game";
    backBtn.addEventListener('click', returnToHub);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && currentMode === 'game') returnToHub();
    });
}

function attachGlobalSoundListeners() {
    document.body.addEventListener('mouseover', (e) => {
        if (e.target.matches('button, .game-card, input, .banner-btn, .icon-btn')) {
            audio.play('ui-hover');
        }
    });
    document.body.addEventListener('click', (e) => {
        if (e.target.matches('button, .game-card, .banner-btn, .icon-btn')) {
            audio.play('click');
        }
    });
}

init();
