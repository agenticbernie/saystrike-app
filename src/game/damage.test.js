import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDamage, calculateDamage } from './damage.js';

test('50% is the boss attack boundary', () => {
  assert.deepEqual(calculateDamage(50), {
    playerDamage: 0,
    bossDamage: 12,
    outcome: 'boss',
  });
});

test('65% is the learner attack boundary', () => {
  assert.deepEqual(calculateDamage(65), {
    playerDamage: 12,
    bossDamage: 0,
    outcome: 'player',
  });
});

test('damage is shared evenly at the midpoint and continuously around both edges', () => {
  assert.deepEqual(calculateDamage(57.5), {
    playerDamage: 6,
    bossDamage: 6,
    outcome: 'shared',
  });
  assert.ok(calculateDamage(50.1).playerDamage > 0);
  assert.ok(calculateDamage(50.1).bossDamage > calculateDamage(50.1).playerDamage);
  assert.ok(calculateDamage(64.9).bossDamage > 0);
  assert.ok(calculateDamage(64.9).playerDamage > calculateDamage(64.9).bossDamage);
});

test('very low and high matches increase in-battle damage without leaving bounds', () => {
  assert.deepEqual(calculateDamage(0), { playerDamage: 0, bossDamage: 40, outcome: 'boss' });
  assert.deepEqual(calculateDamage(100), { playerDamage: 40, bossDamage: 0, outcome: 'player' });
  assert.deepEqual(calculateDamage(120), calculateDamage(100));
  assert.deepEqual(calculateDamage(-5), calculateDamage(0));
});

test('unrated attempts apply no damage to either fighter', () => {
  const startingHealth = { bossHp: 100, playerHp: 100 };
  assert.deepEqual(calculateDamage(null), { playerDamage: 0, bossDamage: 0, outcome: 'unrated' });
  assert.deepEqual(applyDamage(startingHealth, calculateDamage(null)), startingHealth);
});

test('boss damage cannot lock retry by reducing player health below one', () => {
  assert.deepEqual(
    applyDamage({ bossHp: 100, playerHp: 3 }, calculateDamage(0)),
    { bossHp: 100, playerHp: 1 },
  );
});
