export const DAMAGE_RULES = Object.freeze({
  bossAttackAtOrBelow: 50,
  sharedDamageUntil: 65,
  sharedDamageTotal: 12,
  maximumDamage: 40,
});

function roundDamage(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Translate an estimated transcript match into in-battle damage only.
 * Null/invalid scores deliberately produce no damage on either side.
 */
export function calculateDamage(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return { playerDamage: 0, bossDamage: 0, outcome: 'unrated' };
  }

  const boundedScore = Math.min(100, Math.max(0, score));
  const { bossAttackAtOrBelow, sharedDamageUntil, sharedDamageTotal, maximumDamage } = DAMAGE_RULES;

  if (boundedScore <= bossAttackAtOrBelow) {
    const progress = (bossAttackAtOrBelow - boundedScore) / bossAttackAtOrBelow;
    return {
      playerDamage: 0,
      bossDamage: roundDamage(sharedDamageTotal + progress * (maximumDamage - sharedDamageTotal)),
      outcome: 'boss',
    };
  }

  if (boundedScore < sharedDamageUntil) {
    const playerShare = (boundedScore - bossAttackAtOrBelow) / (sharedDamageUntil - bossAttackAtOrBelow);
    const playerDamage = roundDamage(sharedDamageTotal * playerShare);
    return {
      playerDamage,
      bossDamage: roundDamage(sharedDamageTotal - playerDamage),
      outcome: 'shared',
    };
  }

  const progress = (boundedScore - sharedDamageUntil) / (100 - sharedDamageUntil);
  return {
    playerDamage: roundDamage(sharedDamageTotal + progress * (maximumDamage - sharedDamageTotal)),
    bossDamage: 0,
    outcome: 'player',
  };
}

/** Boss damage never removes access to another try; player HP remains an in-fight display. */
export function applyDamage({ bossHp, playerHp }, damage) {
  if (!damage || damage.outcome === 'unrated') return { bossHp, playerHp };
  return {
    bossHp: Math.max(0, roundDamage(bossHp - damage.playerDamage)),
    playerHp: Math.max(1, roundDamage(playerHp - damage.bossDamage)),
  };
}
