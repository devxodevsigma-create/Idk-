// Roblox's official genre taxonomy (rolled out October 2024).
// https://create.roblox.com/docs/production/publishing/experience-genres
const TAXONOMY = [
  ['Action', ['Battlegrounds & Fighting', 'Music & Rhythm', 'Open World Action']],
  ['Adventure', ['Exploration', 'Scavenger Hunt', 'Story']],
  ['Education', []],
  ['Entertainment', ['Music & Audio', 'Showcase & Hub', 'Video']],
  ['Obby & Platformer', ['Classic Obby', 'Runner', 'Tower Obby']],
  ['Party & Casual', ['Childhood Game', 'Coloring & Drawing', 'Minigame', 'Quiz']],
  ['Puzzle', ['Escape Room', 'Match & Merge', 'Word']],
  ['Roleplay & Avatar Sim', ['Animal Sim', 'Dress Up', 'Life', 'Morph Roleplay', 'Pet Care']],
  ['RPG', ['Action RPG', 'Open World & Survival RPG', 'Turn-based RPG']],
  ['Shooter', ['Battle Royale', 'Deathmatch Shooter', 'PvE Shooter']],
  ['Shopping', ['Avatar Shopping']],
  ['Simulation', ['Idle', 'Incremental Simulator', 'Physics Sim', 'Sandbox', 'Tycoon', 'Vehicle Sim']],
  ['Social', ['Communication', 'Content Sharing', 'Hangout']],
  ['Sports & Racing', ['Racing', 'Sports']],
  ['Strategy', ['Board & Card Games', 'Tower Defense']],
  ['Survival', ['1 vs All', 'Escape']],
  ['Utility & Other', []],
];

export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const GENRES = TAXONOMY.map(([name, subgenres]) => ({ id: slugify(name), name, subgenres }));
export const genreById = new Map(GENRES.map((genre) => [genre.id, genre]));
