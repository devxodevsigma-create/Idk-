// Mock data source. It has the same shape the real collector + database will
// have later (see "Data contract" in the README), so the analytics and the
// frontend don't need to change when live data is plugged in.

import { extractKeywords } from '../lib/keywords.js';
import { hashString, mulberry32 } from '../lib/random.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const HISTORY_HOURS = 168;

// Fictional games shaped like what's popular on Roblox right now.
// [name, genre id, subgenre, typical players in thousands, created N days ago]
const CURATED = [
  ['Steal a Brainrot Base', 'simulation', 'Tycoon', 950, 140],
  ['Grow a Garden Empire', 'simulation', 'Idle', 520, 210],
  ['Egg Heist Simulator', 'simulation', 'Incremental Simulator', 380, 9],
  ['Brainrot Merge Lab', 'simulation', 'Idle', 160],
  ['Supercar Garage Tycoon', 'simulation', 'Tycoon', 140],
  ['Dragon Egg Tycoon', 'simulation', 'Tycoon', 120, 38],
  ['Pet Valley Farm', 'simulation', 'Idle', 95],
  ['Mining Valley Simulator', 'simulation', 'Incremental Simulator', 70],
  ['Build a Sky Base', 'simulation', 'Sandbox', 60],
  ['Fishing Valley', 'simulation', 'Idle', 55],
  ['Brainrot Bakery Tycoon', 'simulation', 'Tycoon', 40, 22],
  ['Truck Haul Simulator', 'simulation', 'Vehicle Sim', 35],
  ['Ragdoll Physics Playground', 'simulation', 'Physics Sim', 30],
  ['Garden Tycoon 2', 'simulation', 'Tycoon', 22],
  ['Steal a Valley Egg', 'simulation', 'Tycoon', 18, 0.6],
  ['Survive the Valley Nights', 'survival', 'Escape', 310, 26],
  ['Escape the Brainrot', 'survival', 'Escape', 260, 90],
  ['Hide from the Egg Monster', 'survival', '1 vs All', 140, 4],
  ['Killer vs Survivors: Night Shift', 'survival', '1 vs All', 110],
  ['Escape the Haunted Base', 'survival', 'Escape', 55],
  ['Flood Escape Tower', 'survival', 'Escape', 25],
  ['Maple Valley Town', 'roleplay-avatar-sim', 'Life', 240],
  ['Brainrot Town RP', 'roleplay-avatar-sim', 'Morph Roleplay', 130, 60],
  ['Dress to Slay: Runway', 'roleplay-avatar-sim', 'Dress Up', 120],
  ['Pet Café Life', 'roleplay-avatar-sim', 'Pet Care', 95],
  ['Adopt an Egg Pet', 'roleplay-avatar-sim', 'Pet Care', 70, 15],
  ['Larp Kingdom Roleplay', 'roleplay-avatar-sim', 'Morph Roleplay', 40, 18],
  ['Medieval Larp Village', 'roleplay-avatar-sim', 'Life', 25, 33],
  ['Brainrot Battlegrounds', 'action', 'Battlegrounds & Fighting', 150, 75],
  ['Strongest Valley Fighters', 'action', 'Battlegrounds & Fighting', 120],
  ['Larp Battlegrounds', 'action', 'Battlegrounds & Fighting', 45, 12],
  ['Open World Heist City', 'action', 'Open World Action', 40],
  ['Beat Drop Rhythm', 'action', 'Music & Rhythm', 25],
  ['Escape the Egg Obby', 'obby-platformer', 'Classic Obby', 70, 20],
  ['Brainrot Tower of Doom', 'obby-platformer', 'Tower Obby', 60],
  ['Parkour Valley Runner', 'obby-platformer', 'Runner', 45],
  ['Mega Easy Obby', 'obby-platformer', 'Classic Obby', 40],
  ['Speed Parkour League', 'obby-platformer', 'Runner', 30],
  ['Tower of Rage Remix', 'obby-platformer', 'Tower Obby', 15],
  ['Frontline Arena', 'shooter', 'Deathmatch Shooter', 110],
  ['Egg Hunt Royale', 'shooter', 'Battle Royale', 60, 28],
  ['Zombie Valley Defense', 'shooter', 'PvE Shooter', 45],
  ['Sniper Duels Pro', 'shooter', 'Deathmatch Shooter', 25],
  ['Dragon Valley Quest', 'rpg', 'Open World & Survival RPG', 80],
  ['Blade Legends Online', 'rpg', 'Action RPG', 60],
  ['Pirate Seas Saga', 'rpg', 'Action RPG', 35],
  ['Card Kingdoms Tactics', 'rpg', 'Turn-based RPG', 15],
  ['Brainrot Tower Defense', 'strategy', 'Tower Defense', 90, 45],
  ['Egg Defenders TD', 'strategy', 'Tower Defense', 40, 19],
  ['Base Wars TD', 'strategy', 'Tower Defense', 30],
  ['Chess Night Club', 'strategy', 'Board & Card Games', 10],
  ['Minigame Mayhem', 'party-casual', 'Minigame', 35],
  ['Guess the Brainrot', 'party-casual', 'Quiz', 45, 50],
  ['Color the Egg', 'party-casual', 'Coloring & Drawing', 25, 24],
  ['Red Light Valley', 'party-casual', 'Childhood Game', 15],
  ['Ragdoll Soccer Cup', 'sports-racing', 'Sports', 45],
  ['Street Drift Racing', 'sports-racing', 'Racing', 30],
  ['Hoops Legends', 'sports-racing', 'Sports', 20],
  ['Car Racing Valley', 'sports-racing', 'Racing', 15],
  ['Vibe Hangout Lounge', 'social', 'Hangout', 40],
  ['Voice Chat Plaza', 'social', 'Communication', 30],
  ['Photo Booth Hangout', 'social', 'Content Sharing', 10],
  ['Find the Brainrots', 'adventure', 'Scavenger Hunt', 22, 40],
  ['Lost Egg Expedition', 'adventure', 'Exploration', 20, 27],
  ['The Valley Story', 'adventure', 'Story', 8],
  ['Escape Room Valley', 'puzzle', 'Escape Room', 15],
  ['Merge the Eggs', 'puzzle', 'Match & Merge', 10, 21],
  ['Word Chain Duel', 'puzzle', 'Word', 5],
  ['Concert Hall Live', 'entertainment', 'Music & Audio', 12],
  ['Brainrot Showcase', 'entertainment', 'Showcase & Hub', 8],
  ['Avatar Outfit Mall', 'shopping', 'Avatar Shopping', 18],
  ['UGC Limited Hunt', 'shopping', 'Avatar Shopping', 7],
  ['Space Science Lab', 'education', null, 3],
  ['Studio Test Place', 'utility-other', null, 1],
];

// Daily growth rate per title keyword. This is what makes trends show up in the mock data.
const MOMENTUM = {
  egg: 0.16,
  larp: 0.12,
  valley: 0.08,
  brainrot: 0.05,
  ragdoll: 0.04,
  parkour: 0.03,
  base: 0.02,
  defense: 0.02,
  tycoon: 0.01,
  tower: -0.01,
  obby: -0.02,
  garden: -0.07,
};

// Extra daily growth per genre, so some genres rise while others cool off.
const GENRE_MOMENTUM = {
  'roleplay-avatar-sim': 0.03,
  survival: 0.02,
  'obby-platformer': -0.02,
  rpg: -0.02,
  'sports-racing': -0.03,
  social: -0.03,
  shooter: -0.04,
  strategy: -0.05,
};

// Long tail of small games, built as "<prefix><word> <suffix>".
const TAIL_PREFIXES = ['', '', '', 'Mega ', 'Super ', 'Ultimate ', 'Tiny ', 'Crazy '];
const TAIL_WORDS = [
  'Brainrot', 'Brainrot', 'Egg', 'Egg', 'Egg', 'Valley', 'Larp', 'Parkour', 'Garden', 'Garden',
  'Base', 'Ragdoll', 'Pet', 'Car', 'Dragon', 'Ninja', 'Pirate', 'Candy', 'Space', 'Anime',
];
// [weight, genre id, subgenre, name suffix]
const TAIL_FORMATS = [
  [3, 'simulation', 'Tycoon', 'Tycoon'],
  [2, 'simulation', 'Incremental Simulator', 'Simulator'],
  [1, 'simulation', 'Idle', 'Clicker'],
  [2, 'obby-platformer', 'Classic Obby', 'Obby'],
  [1, 'obby-platformer', 'Tower Obby', 'Tower'],
  [1, 'obby-platformer', 'Runner', 'Run'],
  [1.5, 'survival', 'Escape', 'Escape'],
  [1, 'survival', '1 vs All', 'Hide and Seek'],
  [1.5, 'roleplay-avatar-sim', 'Morph Roleplay', 'Roleplay'],
  [1, 'strategy', 'Tower Defense', 'Tower Defense'],
  [1, 'action', 'Battlegrounds & Fighting', 'Battlegrounds'],
  [0.7, 'shooter', 'Battle Royale', 'Royale'],
  [0.7, 'party-casual', 'Minigame', 'Party'],
  [0.5, 'sports-racing', 'Racing', 'Racing'],
];
const TAIL_ATTEMPTS = 150;

const STUDIOS = [
  'Brickforge Studio', 'Lumen Games', 'Sunday Club', 'Pixel Orchard', 'Nightowl Interactive',
  'Blocky Bros', 'Tidewater Games', 'Ember & Oak', 'Cloud Nine Studio', 'Paper Plane Games',
  'Moonlit Works', 'Gumdrop Labs', 'Northpeak', 'Rocket Otter Games', 'Velvet Cube',
  'Studio Kettle', 'Mint Condition', 'Lowpoly Lane', 'Big Snack Games', 'Starfruit Studio',
  'Quiet Quarry', 'Happy Hammer', 'Two Left Feet Games', 'Lantern Bay',
].map((name, i) => ({ type: 'group', id: 2_000_000 + i * 7919, name }));

export function createMockStore({ now = Date.now(), seed = 20241001 } = {}) {
  const end = Math.floor(now / HOUR) * HOUR;
  const timeline = Array.from({ length: HISTORY_HOURS + 1 }, (_, i) => end - (HISTORY_HOURS - i) * HOUR);
  const rand = mulberry32(seed);

  const specs = [
    ...CURATED.map(([name, genre, subgenre, popK, createdDaysAgo]) => ({ name, genre, subgenre, popK, createdDaysAgo })),
    ...longTail(rand),
  ];
  const entries = specs.map((spec) => buildGame(spec, rand, end));
  const games = entries.map((entry) => entry.game);
  const series = new Map(entries.map((entry) => [entry.game.id, buildSeries(entry.model, timeline, end)]));

  return {
    source: 'mock',
    listGames: () => games,
    getTimeline: () => timeline,
    getSeries: (id) => series.get(id) ?? [],
  };
}

function longTail(rand) {
  const totalWeight = TAIL_FORMATS.reduce((sum, [weight]) => sum + weight, 0);
  const pickFormat = () => {
    let roll = rand() * totalWeight;
    for (const format of TAIL_FORMATS) {
      roll -= format[0];
      if (roll <= 0) return format;
    }
    return TAIL_FORMATS.at(-1);
  };
  const pick = (list) => list[Math.floor(rand() * list.length)];

  const taken = new Set(CURATED.map(([name]) => name));
  const specs = [];
  for (let i = 0; i < TAIL_ATTEMPTS; i++) {
    const [, genre, subgenre, suffix] = pickFormat();
    const name = `${pick(TAIL_PREFIXES)}${pick(TAIL_WORDS)} ${suffix}`;
    if (taken.has(name)) continue;
    taken.add(name);
    specs.push({
      name,
      genre,
      subgenre,
      popK: 0.2 + rand() ** 3 * 12,
      createdDaysAgo: rand() < 0.35 ? rand() * 30 : 30 + rand() * 900,
    });
  }
  return specs;
}

function buildGame({ name, genre, subgenre, popK, createdDaysAgo }, rand, end) {
  const ageDays = createdDaysAgo ?? 60 + rand() * 1400;
  const createdAt = end - ageDays * DAY;

  const rates = extractKeywords(name).map((word) => MOMENTUM[word]).filter((rate) => rate !== undefined);
  let momentum = (rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0)
    + (GENRE_MOMENTUM[genre] ?? 0)
    + (rand() - 0.5) * 0.06;
  if (ageDays < 10) momentum += 0.05 + rand() * 0.15; // fresh releases tend to climb

  const game = {
    id: 9_000_000_000 + Math.floor(rand() * 900_000_000),
    name,
    genre,
    subgenre,
    creator: STUDIOS[Math.floor(rand() * STUDIOS.length)],
    created: new Date(createdAt).toISOString(),
    maxPlayers: [8, 12, 16, 20, 24, 30, 50][Math.floor(rand() * 7)],
    iconUrl: null,
  };
  return { game, model: { base: popK * 1000, momentum, createdAt, seed: hashString(name) } };
}

// Hourly player counts: growth trend x daily cycle (peaks ~20:00 UTC) x noise,
// ramping up from zero for games released inside the window.
function buildSeries({ base, momentum, createdAt, seed }, timeline, end) {
  return timeline.map((t) => {
    if (t < createdAt) return 0;
    const level = base * Math.exp((momentum * (t - end)) / DAY);
    const cycle = 1 + 0.3 * Math.cos((2 * Math.PI * (new Date(t).getUTCHours() - 20)) / 24);
    const ramp = 1 - Math.exp(-(t - createdAt) / (12 * HOUR));
    const noise = 1 + 0.06 * (mulberry32(seed ^ (t / HOUR))() - 0.5);
    return Math.round(level * cycle * ramp * noise);
  });
}
