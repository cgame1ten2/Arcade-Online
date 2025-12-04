import { GAME_LIST } from '../GameRegistry.js';

export default class TournamentManager {
    constructor(gameRunner, uiManager, playerManager) {
        this.runner = gameRunner;
        this.ui = uiManager;
        this.players = playerManager;

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

        this.ui.showTournamentStandings(this.standings, this.players.getActivePlayers(), title, subtitle, () => {
            this.runner.audioManager.setTrack('game');
            this.launchGame(nextGame);
        });
    }

    launchGame(gameConfig) {
        // DEFINE RULES based on game type
        // We want short, punchy games for tournaments.
        const rules = {
            winValue: 3, // Default: First to 3 points/wins
            livesPerRound: 1
        };

        // Custom tweaks per game ID if needed
        if (gameConfig.id === 'red-light') rules.winValue = 3; // 3 Races
        if (gameConfig.id === 'code-breaker') rules.winValue = 1; // 1 Correct guess wins? Or points.

        this.runner.mount(
            gameConfig.class,
            'game-canvas-container',
            'tournament',
            (results) => this.handleGameComplete(results),
            rules
        );
    }

    handleGameComplete(gameResults) {
        // gameResults is the array of players from BaseGame, with their local .score populated
        const sorted = [...gameResults].sort((a, b) => b.score - a.score);

        // Award Tournament Points (3, 2, 1)
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
            location.reload();
        });
    }
}