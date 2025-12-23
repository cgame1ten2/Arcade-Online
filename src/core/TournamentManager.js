/* src/core/TournamentManager.js */

import { GAME_LIST } from '../GameRegistry.js';

export default class TournamentManager {
    constructor(gameRunner, uiManager, playerManager, onExitCallback) {
        this.runner = gameRunner;
        this.ui = uiManager;
        this.players = playerManager;
        this.onExitCallback = onExitCallback;

        this.isActive = false;
        this.roundsTotal = 0;
        this.currentRoundIdx = 0;
        this.gameQueue = [];
        this.standings = [];
        
        // Listen for Replay requests from Main (handled in GameRunner generally, but here for context)
    }

    startTournament(numberOfGames) {
        this.isActive = true;
        this.roundsTotal = numberOfGames;
        this.currentRoundIdx = 0;

        // Reset Standings - Initialize with 0
        this.standings = this.players.getActivePlayers().map(p => ({
            id: p.id,
            points: 0,
            prevPoints: 0 // New field for animation
        }));

        this.draftGames(numberOfGames);
        this.showNextRoundScreen();
    }

    draftGames(count) {
        let pool = [...GAME_LIST];
        this.gameQueue = [];
        for (let i = 0; i < count; i++) {
            if (pool.length === 0) pool = [...GAME_LIST];
            const idx = Math.floor(Math.random() * pool.length);
            this.gameQueue.push(pool[idx]);
            pool.splice(idx, 1);
        }
    }

    showNextRoundScreen() {
        const nextGame = this.gameQueue[this.currentRoundIdx];
        const title = `Game ${this.currentRoundIdx + 1} of ${this.roundsTotal}`;
        const subtitle = `Next Up: ${nextGame.title}`;

        this.runner.audioManager.setTrack('lobby');

        // Pass the max possible points for scaling
        // Max points per round is 3. Total possible = rounds * 3.
        const maxPossible = this.roundsTotal * 3;

        this.ui.showTournamentStandings(this.standings, this.players.getActivePlayers(), title, subtitle, maxPossible, () => {
            this.runner.audioManager.setTrack('game');
            this.launchGame(nextGame);
        });
    }

    launchGame(gameConfig) {
        const rules = {
            winValue: 3, 
            livesPerRound: 1
        };

        if (gameConfig.id === 'red-light') rules.winValue = 3; 
        if (gameConfig.id === 'code-breaker') rules.winValue = 1; 

        // Launch with autoStart: false (controlled by Main for tutorial/countdown)
        // Note: Main.js triggers the tutorial overlay via `enterGameMode`. 
        // TournamentManager actually bypasses Main's `enterGameMode` usually.
        // We need to trigger the countdown here or let Main handle it.
        // To keep it simple: We mount via runner, then manually trigger countdown.
        
        window.dispatchEvent(new CustomEvent('tournament-game-start', { detail: gameConfig }));
        
        this.runner.mount(
            gameConfig.class,
            'game-canvas-container',
            'tournament',
            (results) => this.handleGameComplete(results),
            rules
        );
    }

    handleGameComplete(gameResults) {
        const sorted = [...gameResults].sort((a, b) => b.score - a.score);

        // Update Previous Points before adding new ones
        this.standings.forEach(s => s.prevPoints = s.points);

        sorted.forEach((p, index) => {
            let points = 0;
            if (index === 0) points = 3;
            else if (index === 1) points = 2;
            else if (index === 2) points = 1;

            const standing = this.standings.find(s => s.id === p.id);
            if (standing) standing.points += points;
        });

        this.currentRoundIdx++;

        if (this.currentRoundIdx >= this.roundsTotal) {
            this.endTournament();
        } else {
            this.showNextRoundScreen();
        }
    }

    endTournament() {
        this.isActive = false;
        const finalResults = this.players.getActivePlayers().map(p => {
            const s = this.standings.find(stat => stat.id === p.id);
            return { ...p, score: s.points };
        });

        this.runner.audioManager.setTrack('victory');

        this.ui.showPodium(finalResults, "Back to Hub", () => {
            if (this.onExitCallback) {
                this.onExitCallback();
            } else {
                location.reload(); 
            }
        });
    }
}
