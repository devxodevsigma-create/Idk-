// Turns a game title into the keywords used for trend tracking.
// "[🎃 UPDATE] Steal a Brainrot Base!" -> ["steal", "brainrot", "base"]

const STOPWORDS = new Set([
  'and', 'the', 'for', 'from', 'with', 'into', 'your', 'our', 'its', 'are',
  'new', 'update', 'upd', 'event', 'beta', 'alpha', 'demo', 'release', 'game', 'roblox',
  'mega', 'super', 'ultimate', 'tiny', 'crazy', 'pro',
]);

export function extractKeywords(title) {
  const cleaned = title
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ') // "[UPDATE 5]", "(NEW)" and similar tags
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z\s]/g, ' ');

  const keywords = new Set();
  for (const word of cleaned.split(/\s+/)) {
    if (word.length < 3 || STOPWORDS.has(word)) continue;
    keywords.add(singular(word));
  }
  return [...keywords];
}

function singular(word) {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}
