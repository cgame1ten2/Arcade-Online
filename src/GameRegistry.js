/* src/GameRegistry.js */

import SumoDiscs from './games/SumoDiscs.js';
import HopHero from './games/HopHero.js';
import AvatarMatch from './games/AvatarMatch.js';
import CrateStackers from './games/CrateStackers.js';
import CodeBreaker from './games/CodeBreaker.js';
import RedLightGreenLight from './games/RedLightGreenLight.js';
import BombTag from './games/BombTag.js';
import NinjaReflex from './games/NinjaReflex.js';
import PaintParty from './games/PaintParty.js';

export const GAME_LIST = [
    { 
        id: 'sumo-discs', title: 'Sumo Discs', 
        description: 'Bump friends off the dojo!', 
        tutorial: 'Hold button to charge. Release to bump!',
        class: SumoDiscs 
    },
    { 
        id: 'hop-hero', title: 'Hop Hero', 
        description: 'Cross the road, dodge the cars!', 
        tutorial: 'Tap to hop forward. Don\'t get squashed!',
        class: HopHero 
    },
    { 
        id: 'bomb-tag', title: 'Bomb Tag', 
        description: 'Pass the bomb before it blows!', 
        tutorial: 'Run into players to pass the bomb!',
        class: BombTag 
    },
    { 
        id: 'crate-stackers', title: 'Crate Stackers', 
        description: 'Build a tower of wobbly crates!', 
        tutorial: 'Time your drop to stack the crates high!',
        class: CrateStackers 
    },
    { 
        id: 'avatar-match', title: 'Avatar Match', 
        description: 'Find the matching faces!', 
        tutorial: 'Find the matching pairs!',
        class: AvatarMatch 
    },
    { 
        id: 'code-breaker', title: 'Code Breaker', 
        description: 'Crack the secret number code!', 
        tutorial: 'Pick a number. Higher or Lower?',
        class: CodeBreaker 
    },
    { 
        id: 'red-light', title: 'Red Light, Green Light', 
        description: 'Run on Green. Freeze on Red!', 
        tutorial: 'Hold to Run. Release to Stop. Watch the light!',
        class: RedLightGreenLight 
    },
    { 
        id: 'ninja-reflex', title: 'Ninja Reflex', 
        description: 'Wait for the flash... STRIKE!', 
        tutorial: 'Wait for the signal... then TAP FAST!',
        class: NinjaReflex 
    },
    { 
        id: 'paint-party', title: 'Paint Party', 
        description: 'Cover the floor with your color!', 
        tutorial: 'Tap to turn right. Paint the most tiles!',
        class: PaintParty 
    }
];
