import { Bet, Battle, PoolSummary, BattleSide } from '../types/database';

/**
 * Calculates current pari-mutuel pool metrics from a set of bets.
 * STRICT ISOLATION: Only bets with status = 'accepted' (or settled won/lost) count!
 * Pending, rejected, cancelled, and refunded bets NEVER inflate pools or odds.
 */
export function calculatePoolSummary(
  bets: Bet[],
  battleId: string,
  feeRate: number = 0.1000
): PoolSummary {
  const eligibleBets = bets.filter(
    (b) =>
      b.battle_id === battleId &&
      ['accepted', 'settled_won', 'settled_lost'].includes(b.status)
  );

  let poolA = 0;
  let poolB = 0;
  let betsCountA = 0;
  let betsCountB = 0;

  for (const bet of eligibleBets) {
    if (bet.side === 'A') {
      poolA += Number(bet.stake);
      betsCountA++;
    } else if (bet.side === 'B') {
      poolB += Number(bet.stake);
      betsCountB++;
    }
  }

  // Round pools to 2 decimals to avoid floating drift
  poolA = Math.round(poolA * 100) / 100;
  poolB = Math.round(poolB * 100) / 100;
  const totalPool = Math.round((poolA + poolB) * 100) / 100;

  const platformFee = Math.round(totalPool * feeRate * 100) / 100;
  const distributablePool = Math.max(0, Math.round((totalPool - platformFee) * 100) / 100);

  // Pari-Mutuel Indicative Odds formula:
  // Distributable Pool / Side Pool
  let oddsA = 0;
  let oddsB = 0;

  if (poolA > 0 && distributablePool > 0) {
    oddsA = Math.round((distributablePool / poolA) * 10000) / 10000;
  }
  if (poolB > 0 && distributablePool > 0) {
    oddsB = Math.round((distributablePool / poolB) * 10000) / 10000;
  }

  const percentageA = totalPool > 0 ? Math.round((poolA / totalPool) * 100) : 50;
  const percentageB = totalPool > 0 ? 100 - percentageA : 50;

  return {
    poolA,
    poolB,
    totalPool,
    distributablePool,
    platformFee,
    feeRate,
    oddsA,
    oddsB,
    percentageA,
    percentageB,
    betsCountA,
    betsCountB,
    // snake_case aliases
    pool_a: poolA,
    pool_b: poolB,
    total_pool: totalPool,
    distributable_pool: distributablePool,
    odds_a: oddsA,
    odds_b: oddsB,
    bets_count_a: betsCountA,
    bets_count_b: betsCountB,
  };
}

/**
 * Predicts the shift in pool and odds if a user stakes a hypothetical amount on side A or B.
 */
export function simulateBetImpact(
  currentSummary: PoolSummary,
  side: BattleSide,
  additionalStake: number
) {
  if (additionalStake <= 0) {
    return {
      newOdds: side === 'A' ? currentSummary.oddsA : currentSummary.oddsB,
      newPoolA: currentSummary.poolA,
      newPoolB: currentSummary.poolB,
      newTotalPool: currentSummary.totalPool,
      estimatedGrossReturn: 0,
      estimatedNetProfit: 0,
    };
  }

  const newPoolA = side === 'A' ? currentSummary.poolA + additionalStake : currentSummary.poolA;
  const newPoolB = side === 'B' ? currentSummary.poolB + additionalStake : currentSummary.poolB;
  const newTotalPool = newPoolA + newPoolB;
  const newPlatformFee = Math.round(newTotalPool * currentSummary.feeRate * 100) / 100;
  const newDistributable = Math.max(0, Math.round((newTotalPool - newPlatformFee) * 100) / 100);

  const targetSidePool = side === 'A' ? newPoolA : newPoolB;
  const newOdds = targetSidePool > 0 ? Math.round((newDistributable / targetSidePool) * 10000) / 10000 : 0;

  // Estimated gross return:
  // user_stake / target_side_pool * distributable
  const userShare = targetSidePool > 0 ? additionalStake / targetSidePool : 0;
  const estimatedGrossReturn = Math.floor(userShare * newDistributable * 100) / 100;
  const estimatedNetProfit = Math.round((estimatedGrossReturn - additionalStake) * 100) / 100;

  return {
    newOdds,
    newPoolA,
    newPoolB,
    newTotalPool,
    estimatedGrossReturn,
    estimatedNetProfit,
  };
}

/**
 * Helper to format currency in Philippine Pesos (₱) with commas.
 */
export function formatPHP(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
