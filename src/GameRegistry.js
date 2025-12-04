import SumoDiscs from './games/SumoDiscs.js';
import HopHero from './games/HopHero.js';
import AvatarMatch from './games/AvatarMatch.js';
import CrateStackers from './games/CrateStackers.js';
import CodeBreaker from './games/CodeBreaker.js';
import RedLightGreenLight from './games/RedLightGreenLight.js';
import BombTag from './games/BombTag.js';
import NinjaReflex from './games/NinjaReflex.js';
import PaintParty from './games/PaintParty.js'; // NEW

export const GAME_LIST = [
    { id: 'sumo-discs', title: 'Sumo Discs', description: 'Bump friends off the dojo!', class: SumoDiscs },
    { id: 'hop-hero', title: 'Hop Hero', description: 'Cross the road, dodge the cars!', class: HopHero },
    { id: 'bomb-tag', title: 'Bomb Tag', description: 'Pass the bomb before it blows!', class: BombTag },
    { id: 'crate-stackers', title: 'Crate Stackers', description: 'Build a tower of wobbly crates!', class: CrateStackers },
    { id: 'avatar-match', title: 'Avatar Match', description: 'Find the matching faces!', class: AvatarMatch },
    { id: 'code-breaker', title: 'Code Breaker', description: 'Crack the secret number code!', class: CodeBreaker },
    { id: 'red-light', title: 'Red Light, Green Light', description: 'Run on Green. Freeze on Red!', class: RedLightGreenLight },
    { id: 'ninja-reflex', title: 'Ninja Reflex', description: 'Wait for the flash... STRIKE!', class: NinjaReflex },
    { id: 'paint-party', title: 'Paint Party', description: 'Cover the floor with your color!', class: PaintParty } // NEW
];