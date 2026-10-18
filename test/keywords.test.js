import assert from 'node:assert/strict';
import test from 'node:test';
import { extractKeywords } from '../server/lib/keywords.js';

test('drops tags, short words, stopwords and punctuation', () => {
  assert.deepEqual(extractKeywords('[🎃 UPDATE] Steal a Brainrot Base!'), ['steal', 'brainrot', 'base']);
  assert.deepEqual(extractKeywords('Hide and Seek (NEW)'), ['hide', 'seek']);
});

test('merges simple plurals', () => {
  assert.deepEqual(extractKeywords('Find the Brainrots'), ['find', 'brainrot']);
  assert.deepEqual(extractKeywords('Egg Defenders TD'), ['egg', 'defender']);
  assert.deepEqual(extractKeywords('Chess Night Club'), ['chess', 'night', 'club']);
});

test('strips accents and repeats', () => {
  assert.deepEqual(extractKeywords('Pet Café Life'), ['pet', 'cafe', 'life']);
  assert.deepEqual(extractKeywords('Egg Egg Eggs'), ['egg']);
});
