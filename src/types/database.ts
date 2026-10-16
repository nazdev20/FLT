export type UserRole = 'user' | 'admin';

export interface Profile {
  id: string;
  username: string | null;
  role: UserRole;
  created_at: string;
}

export type BattleStatus = 'open' | 'locked' | 'settled' | 'cancelled';
export type BattleSide = 'A' | 'B';

export interface Battle {
  id: string;
  title: string;
  emcee_a: string;
  emcee_b: string;
  emcee_a_photo_url: string;
  emcee_b_photo_url: string;
  starts_at: string;
  betting_closes_at: string;
  status: BattleStatus;
  fee_rate: number;
  pool_a?: number;
  pool_b?: number;
  total_pool?: number;
  accepted_bets_count?: number;
  unique_bettors_count?: number;
  platform_fee?: number;
  distributable_pool?: number;
  odds_a?: number;
  odds_b?: number;
  winner_side: BattleSide | null;
  emcee_a_score?: number | null;
  emcee_b_score?: number | null;
  cancellation_reason: string | null;
  locked_at: string | null;
  settled_at: string | null;
  created_by: string | null;
  created_at: string;
}

export type BetStatus =
  | 'pending_verification'
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'settled_won'
  | 'settled_lost';

export interface Bet {
  id: string;
  battle_id: string;
  user_id: string;
  side: BattleSide;
  stake: number;
  status: BetStatus;
  idempotency_key: string;
  accepted_at: string | null;
  snapshot_pool_a: number | null;
  snapshot_pool_b: number | null;
  snapshot_total_pool: number | null;
  snapshot_distributable_pool?: number | null;
  snapshot_indicative_odds: number | null;
  gross_payout: number;
  net_profit: number;
  settled_at: string | null;
  created_at: string;
  // joined fields for display
  battle?: Battle;
  payment_submission?: BetPaymentSubmission;
}

export type PaymentSubmissionStatus = 'pending' | 'approved' | 'rejected' | 'paid' | 'failed';

export interface BetPaymentSubmission {
  id: string;
  bet_id: string;
  user_id: string;
  amount: number;
  payment_reference: string;
  receipt_url: string | null;
  status: PaymentSubmissionStatus;
  payment_status?: 'pending' | 'paid' | 'failed';
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  // joined fields
  battle_title?: string;
  emcee_a?: string;
  emcee_b?: string;
  side?: BattleSide;
  bettor_username?: string;
}

export interface BattleSettlement {
  battle_id: string;
  idempotency_key: string;
  outcome_type: 'settled' | 'cancelled_refunded';
  winner_side: BattleSide | null;
  pool_a: number;
  pool_b: number;
  total_pool: number;
  platform_fee: number;
  distributable_pool: number;
  total_payouts: number;
  rounding_remainder_allocated: number;
  created_at: string;
}

export interface Wallet {
  user_id: string;
  simulated_balance: number;
  updated_at: string;
}

export interface LedgerEntry {
  id: string;
  user_id: string | null;
  battle_id: string | null;
  bet_id: string | null;
  entry_type: string;
  amount: number;
  balance_after: number | null;
  idempotency_key: string;
  created_at: string;
}

export interface BattlePoolSummary {
  pool_a: number;
  pool_b: number;
  total_pool: number;
  distributable_pool: number;
  odds_a: number;
  odds_b: number;
  bets_count_a: number;
  bets_count_b: number;
  unique_bettors_count?: number;
}

export interface PoolSummary {
  pool_a: number;
  pool_b: number;
  total_pool: number;
  distributable_pool: number;
  odds_a: number;
  odds_b: number;
  bets_count_a: number;
  bets_count_b: number;
  unique_bettors_count?: number;

  poolA: number;
  poolB: number;
  totalPool: number;
  distributablePool: number;
  platformFee: number;
  feeRate: number;
  oddsA: number;
  oddsB: number;
  percentageA: number;
  percentageB: number;
  betsCountA: number;
  betsCountB: number;
}

export interface MockCreditRequest {
  id: string;
  user_id: string;
  amount: number;
  mock_reference_code: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  username?: string;
}
