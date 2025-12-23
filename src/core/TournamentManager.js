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
    }

    startTournament(numberOfGames) {
        this.isActive = true;
        this.roundsTotal = numberOfGames;
        this.currentRoundIdx = 0;

        // Reset Standings
        this.standings = this.players.getActivePlayers().map(p => ({
            id: p.id,
            points: 0
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

        const displayData = this.standings.map(s => ({
            id: s.id,
            oldPoints: s.points,
            newPoints: s.points
        }));

        this.ui.showTournamentStandings(displayData, this.players.getActivePlayers(), title, subtitle, () => {
            this.runner.audioManager.setTrack('game');
            this.launchGame(nextGame);
        }, this.roundsTotal * 3);
    }

    launchGame(gameConfig) {
        const rules = {
            winValue: 3, 
            livesPerRound: 1
        };

        if (gameConfig.id === 'red-light') rules.winValue = 3; 
        if (gameConfig.id === 'code-breaker') rules.winValue = 1; 

        // UPDATED: Determine Controller type
        let screenType = 'CONTROLLER';
        if (gameConfig.id === 'avatar-match') {
            screenType = 'TOUCHPAD';
        }
        
        // Notify main.js to update network state
        window.dispatchEvent(new CustomEvent('update-screen-type', { detail: screenType }));

        // Standardized Transition & Tutorial Flow
        this.ui.showTransition(() => {
            this.runner.mount(
                gameConfig.class,
                'game-canvas-container',
                'tournament',
                (results) => this.handleGameComplete(results),
                { ...rules, autoStart: false } // Mount Frozen
            );

            this.ui.showTutorial(gameConfig, 3500, () => {
                this.ui.hideTransition();
                // UNFREEZE
                if (this.runner.activeGame) {
                    this.runner.activeGame.beginGameplay();
                }
            });
        });
    }

    handleGameComplete(gameResults) {
        const sorted = [...gameResults].sort((a, b) => b.score - a.score);
        
        const pointsAdded = {};
        sorted.forEach((p, index) => {
            let pts = 0;
            if (index === 0) pts = 3;
            else if (index === 1) pts = 2;
            else if (index === 2) pts = 1;
            pointsAdded[p.id] = pts;
        });

        const displayData = this.standings.map(s => {
            const added = pointsAdded[s.id] || 0;
            const old = s.points;
            s.points += added; 
            return {
                id: s.id,
                oldPoints: old,
                newPoints: s.points
            };
        });

        this.currentRoundIdx++;

        const title = `Round ${this.currentRoundIdx} Results`;
        let subtitle = (this.currentRoundIdx >= this.roundsTotal) ? "Final Standings!" : "Next Round Coming Up...";

        this.ui.showTournamentStandings(displayData, this.players.getActivePlayers(), title, subtitle, () => {
            if (this.currentRoundIdx >= this.roundsTotal) {
                this.endTournament();
            } else {
                this.showNextRoundScreen();
            }
        }, this.roundsTotal * 3);
    }

    endTournament() {
        this.isActive = false;
        const finalResults = this.players.getActivePlayers().map(p => {
            const s = this.standings.find(stat => stat.id === p.id);
            return { ...p, score: s.points };
        });

        this.runner.audioManager.setTrack('victory');

        this.ui.showPodium(finalResults, "Back to Hub", () => {
            // FIXED: Use callback to prevent page reload/disconnect
            if (this.onExitCallback) {
                this.onExitCallback();
            }
        });
    }
}
