import {
  Profile,
  Wallet,
  MockCreditRequest,
  Battle,
  Bet,
  BattleSettlement,
  LedgerEntry,
  BattleSide,
} from '../types/database';
import { calculatePoolSummary } from './pari-mutuel';

const STORAGE_KEY = 'pari_mutuel_engine_state_v1';

export interface Persona {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  avatar: string;
}

export const PRESET_PERSONAS: Persona[] = [
  {
    id: 'e1000000-0000-0000-0000-000000000001',
    username: 'ArbiterAdmin',
    email: 'admin@battledome.test',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'e2000000-0000-0000-0000-000000000002',
    username: 'FlipTopAlpha',
    email: 'alpha@battledome.test',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'e3000000-0000-0000-0000-000000000003',
    username: 'BarangayBravo',
    email: 'bravo@battledome.test',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'e4000000-0000-0000-0000-000000000004',
    username: 'RookieCharlie',
    email: 'charlie@battledome.test',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
  },
];

export interface EngineState {
  profiles: Profile[];
  wallets: Wallet[];
  mock_credit_requests: MockCreditRequest[];
  battles: Battle[];
  bets: Bet[];
  battle_settlements: BattleSettlement[];
  ledger_entries: LedgerEntry[];
  currentUserId: string;
}

// Initial seed data generator
function getInitialSeed(): EngineState {
  const now = new Date();

  // Battle 1: Open, closes in 45 minutes, starts in 1 hour 45 minutes
  const battle1Starts = new Date(now.getTime() + 105 * 60 * 1000).toISOString();
  const battle1Closes = new Date(new Date(battle1Starts).getTime() - 60 * 60 * 1000).toISOString();

  // Battle 2: Open, closes in 3 hours, starts in 4 hours
  const battle2Starts = new Date(now.getTime() + 240 * 60 * 1000).toISOString();
  const battle2Closes = new Date(new Date(battle2Starts).getTime() - 60 * 60 * 1000).toISOString();

  // Battle 3: Locked (betting closed 10 mins ago, starts in 50 mins)
  const battle3Starts = new Date(now.getTime() + 50 * 60 * 1000).toISOString();
  const battle3Closes = new Date(new Date(battle3Starts).getTime() - 60 * 60 * 1000).toISOString();

  // Battle 4: Settled in the past
  const battle4Starts = new Date(now.getTime() - 120 * 60 * 1000).toISOString();
  const battle4Closes = new Date(new Date(battle4Starts).getTime() - 60 * 60 * 1000).toISOString();
  const battle4Settled = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

  const b1Id = 'b1000000-0000-0000-0000-000000000001';
  const b2Id = 'b2000000-0000-0000-0000-000000000002';
  const b3Id = 'b3000000-0000-0000-0000-000000000003';
  const b4Id = 'b4000000-0000-0000-0000-000000000004';

  const profiles: Profile[] = PRESET_PERSONAS.map((p) => ({
    id: p.id,
    username: p.username,
    role: p.role,
    created_at: new Date(now.getTime() - 86400000 * 5).toISOString(),
  }));

  const wallets: Wallet[] = [
    { user_id: PRESET_PERSONAS[0].id, simulated_balance: 50000.0, updated_at: now.toISOString() },
    { user_id: PRESET_PERSONAS[1].id, simulated_balance: 14500.0, updated_at: now.toISOString() },
    { user_id: PRESET_PERSONAS[2].id, simulated_balance: 8200.0, updated_at: now.toISOString() },
    { user_id: PRESET_PERSONAS[3].id, simulated_balance: 1500.0, updated_at: now.toISOString() },
  ];

  const battles: Battle[] = [
    {
      id: b1Id,
      title: 'Ahon 14 Championship Main Event',
      emcee_a: 'Loonie',
      emcee_b: 'Sinio',
      emcee_a_photo_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=400&auto=format&fit=crop&q=80',
      emcee_b_photo_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
      starts_at: battle1Starts,
      betting_closes_at: battle1Closes,
      status: 'open',
      fee_rate: 0.1,
      winner_side: null,
      cancellation_reason: null,
      locked_at: null,
      settled_at: null,
      created_by: PRESET_PERSONAS[0].id,
      created_at: new Date(now.getTime() - 86400000).toISOString(),
    },
    {
      id: b2Id,
      title: 'Bwelta Balentong X - Clash of Eras',
      emcee_a: 'Batas',
      emcee_b: 'Dello',
      emcee_a_photo_url: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=400&auto=format&fit=crop&q=80',
      emcee_b_photo_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=80',
      starts_at: battle2Starts,
      betting_closes_at: battle2Closes,
      status: 'open',
      fee_rate: 0.1,
      winner_side: null,
      cancellation_reason: null,
      locked_at: null,
      settled_at: null,
      created_by: PRESET_PERSONAS[0].id,
      created_at: new Date(now.getTime() - 43200000).toISOString(),
    },
    {
      id: b3Id,
      title: 'Unibersikulo Semifinals - Technical Wordplay Showdown',
      emcee_a: 'Tipsy D',
      emcee_b: 'Poison13',
      emcee_a_photo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
      emcee_b_photo_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80',
      starts_at: battle3Starts,
      betting_closes_at: battle3Closes,
      status: 'locked',
      fee_rate: 0.1,
      winner_side: null,
      cancellation_reason: null,
      locked_at: battle3Closes,
      settled_at: null,
      created_by: PRESET_PERSONAS[0].id,
      created_at: new Date(now.getTime() - 72000000).toISOString(),
    },
    {
      id: b4Id,
      title: 'Isabuhay Tournament - Grand Finals',
      emcee_a: 'Smugglaz',
      emcee_b: 'Shehyee',
      emcee_a_photo_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80',
      emcee_b_photo_url: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=400&auto=format&fit=crop&q=80',
      starts_at: battle4Starts,
      betting_closes_at: battle4Closes,
      status: 'settled',
      fee_rate: 0.1,
      winner_side: 'A',
      cancellation_reason: null,
      locked_at: battle4Closes,
      settled_at: battle4Settled,
      created_by: PRESET_PERSONAS[0].id,
      created_at: new Date(now.getTime() - 172800000).toISOString(),
    },
  ];

  const bets: Bet[] = [
    // Bets on Battle 1
    {
      id: 'bet-01',
      battle_id: b1Id,
      user_id: PRESET_PERSONAS[1].id,
      side: 'A',
      stake: 3500.0,
      status: 'accepted',
      idempotency_key: 'idem-b1-alpha-1',
      accepted_at: new Date(now.getTime() - 1200000).toISOString(),
      snapshot_pool_a: 3500.0,
      snapshot_pool_b: 0.0,
      snapshot_total_pool: 3500.0,
      snapshot_indicative_odds: 0.9,
      gross_payout: 0,
      net_profit: 0,
      settled_at: null,
      created_at: new Date(now.getTime() - 1200000).toISOString(),
    },
    {
      id: 'bet-02',
      battle_id: b1Id,
      user_id: PRESET_PERSONAS[2].id,
      side: 'B',
      stake: 2800.0,
      status: 'accepted',
      idempotency_key: 'idem-b1-bravo-1',
      accepted_at: new Date(now.getTime() - 900000).toISOString(),
      snapshot_pool_a: 3500.0,
      snapshot_pool_b: 2800.0,
      snapshot_total_pool: 6300.0,
      snapshot_indicative_odds: 2.025,
      gross_payout: 0,
      net_profit: 0,
      settled_at: null,
      created_at: new Date(now.getTime() - 900000).toISOString(),
    },
    {
      id: 'bet-03',
      battle_id: b1Id,
      user_id: PRESET_PERSONAS[3].id,
      side: 'A',
      stake: 500.0,
      status: 'accepted',
      idempotency_key: 'idem-b1-charlie-1',
      accepted_at: new Date(now.getTime() - 400000).toISOString(),
      snapshot_pool_a: 4000.0,
      snapshot_pool_b: 2800.0,
      snapshot_total_pool: 6800.0,
      snapshot_indicative_odds: 1.53,
      gross_payout: 0,
      net_profit: 0,
      settled_at: null,
      created_at: new Date(now.getTime() - 400000).toISOString(),
    },
    // Bets on Battle 3 (Locked)
    {
      id: 'bet-04',
      battle_id: b3Id,
      user_id: PRESET_PERSONAS[1].id,
      side: 'A',
      stake: 2000.0,
      status: 'accepted',
      idempotency_key: 'idem-b3-alpha-1',
      accepted_at: new Date(now.getTime() - 3600000).toISOString(),
      snapshot_pool_a: 2000.0,
      snapshot_pool_b: 0.0,
      snapshot_total_pool: 2000.0,
      snapshot_indicative_odds: 0.9,
      gross_payout: 0,
      net_profit: 0,
      settled_at: null,
      created_at: new Date(now.getTime() - 3600000).toISOString(),
    },
    {
      id: 'bet-05',
      battle_id: b3Id,
      user_id: PRESET_PERSONAS[2].id,
      side: 'B',
      stake: 3000.0,
      status: 'accepted',
      idempotency_key: 'idem-b3-bravo-1',
      accepted_at: new Date(now.getTime() - 3000000).toISOString(),
      snapshot_pool_a: 2000.0,
      snapshot_pool_b: 3000.0,
      snapshot_total_pool: 5000.0,
      snapshot_indicative_odds: 1.5,
      gross_payout: 0,
      net_profit: 0,
      settled_at: null,
      created_at: new Date(now.getTime() - 3000000).toISOString(),
    },
    // Bets on Battle 4 (Settled)
    {
      id: 'bet-06',
      battle_id: b4Id,
      user_id: PRESET_PERSONAS[1].id,
      side: 'A',
      stake: 2000.0,
      status: 'settled_won',
      idempotency_key: 'idem-b4-alpha-1',
      accepted_at: new Date(now.getTime() - 10000000).toISOString(),
      snapshot_pool_a: 2000.0,
      snapshot_pool_b: 0.0,
      snapshot_total_pool: 2000.0,
      snapshot_indicative_odds: 0.9,
      gross_payout: 3600.0,
      net_profit: 1600.0,
      settled_at: battle4Settled,
      created_at: new Date(now.getTime() - 10000000).toISOString(),
    },
    {
      id: 'bet-07',
      battle_id: b4Id,
      user_id: PRESET_PERSONAS[2].id,
      side: 'B',
      stake: 2000.0,
      status: 'settled_lost',
      idempotency_key: 'idem-b4-bravo-1',
      accepted_at: new Date(now.getTime() - 9000000).toISOString(),
      snapshot_pool_a: 2000.0,
      snapshot_pool_b: 2000.0,
      snapshot_total_pool: 4000.0,
      snapshot_indicative_odds: 1.8,
      gross_payout: 0.0,
      net_profit: -2000.0,
      settled_at: battle4Settled,
      created_at: new Date(now.getTime() - 9000000).toISOString(),
    },
  ];

  const battle_settlements: BattleSettlement[] = [
    {
      battle_id: b4Id,
      idempotency_key: 'settle_b4_official',
      outcome_type: 'settled',
      winner_side: 'A',
      pool_a: 2000.0,
      pool_b: 2000.0,
      total_pool: 4000.0,
      platform_fee: 400.0,
      distributable_pool: 3600.0,
      total_payouts: 3600.0,
      rounding_remainder_allocated: 0.0,
      created_at: battle4Settled,
    },
  ];

  const ledger_entries: LedgerEntry[] = [
    {
      id: 'led-01',
      user_id: PRESET_PERSONAS[1].id,
      battle_id: null,
      bet_id: null,
      entry_type: 'mock_credit_approved',
      amount: 20000.0,
      balance_after: 20000.0,
      idempotency_key: 'mock_credit_init_alpha',
      created_at: new Date(now.getTime() - 86400000 * 3).toISOString(),
    },
    {
      id: 'led-02',
      user_id: PRESET_PERSONAS[2].id,
      battle_id: null,
      bet_id: null,
      entry_type: 'mock_credit_approved',
      amount: 15000.0,
      balance_after: 15000.0,
      idempotency_key: 'mock_credit_init_bravo',
      created_at: new Date(now.getTime() - 86400000 * 3).toISOString(),
    },
    {
      id: 'led-03',
      user_id: PRESET_PERSONAS[3].id,
      battle_id: null,
      bet_id: null,
      entry_type: 'mock_credit_approved',
      amount: 2000.0,
      balance_after: 2000.0,
      idempotency_key: 'mock_credit_init_charlie',
      created_at: new Date(now.getTime() - 86400000 * 3).toISOString(),
    },
    {
      id: 'led-04',
      user_id: PRESET_PERSONAS[1].id,
      battle_id: b1Id,
      bet_id: 'bet-01',
      entry_type: 'bet_stake_reserve',
      amount: -3500.0,
      balance_after: 16500.0,
      idempotency_key: 'reserve_idem-b1-alpha-1',
      created_at: new Date(now.getTime() - 1200000).toISOString(),
    },
    {
      id: 'led-05',
      user_id: PRESET_PERSONAS[2].id,
      battle_id: b1Id,
      bet_id: 'bet-02',
      entry_type: 'bet_stake_reserve',
      amount: -2800.0,
      balance_after: 12200.0,
      idempotency_key: 'reserve_idem-b1-bravo-1',
      created_at: new Date(now.getTime() - 900000).toISOString(),
    },
    {
      id: 'led-06',
      user_id: PRESET_PERSONAS[3].id,
      battle_id: b1Id,
      bet_id: 'bet-03',
      entry_type: 'bet_stake_reserve',
      amount: -500.0,
      balance_after: 1500.0,
      idempotency_key: 'reserve_idem-b1-charlie-1',
      created_at: new Date(now.getTime() - 400000).toISOString(),
    },
    {
      id: 'led-07',
      user_id: null,
      battle_id: b4Id,
      bet_id: null,
      entry_type: 'platform_fee',
      amount: 400.0,
      balance_after: null,
      idempotency_key: 'fee_b4_official',
      created_at: battle4Settled,
    },
    {
      id: 'led-08',
      user_id: PRESET_PERSONAS[1].id,
      battle_id: b4Id,
      bet_id: 'bet-06',
      entry_type: 'bet_payout',
      amount: 3600.0,
      balance_after: 14500.0,
      idempotency_key: 'payout_bet-06_idem',
      created_at: battle4Settled,
    },
  ];

  const mock_credit_requests: MockCreditRequest[] = [
    {
      id: 'req-01',
      user_id: PRESET_PERSONAS[3].id,
      amount: 1000.0,
      mock_reference_code: 'GCASH-REF-892411',
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date(now.getTime() - 1800000).toISOString(),
    },
    {
      id: 'req-02',
      user_id: PRESET_PERSONAS[2].id,
      amount: 5000.0,
      mock_reference_code: 'MAYA-REF-559102',
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date(now.getTime() - 600000).toISOString(),
    },
  ];

  return {
    profiles,
    wallets,
    mock_credit_requests,
    battles,
    bets,
    battle_settlements,
    ledger_entries,
    currentUserId: PRESET_PERSONAS[1].id, // Default to Alpha
  };
}

export class PariMutuelEngine {
  private state: EngineState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): EngineState {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    const initial = getInitialSeed();
    this.saveState(initial);
    return initial;
  }

  private saveState(state: EngineState) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
    this.state = state;
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public resetToDefault() {
    localStorage.removeItem(STORAGE_KEY);
    const initial = getInitialSeed();
    this.saveState(initial);
  }

  public getState(): EngineState {
    return this.state;
  }

  public getCurrentUser(): Persona {
    return (
      PRESET_PERSONAS.find((p) => p.id === this.state.currentUserId) ||
      PRESET_PERSONAS[1]
    );
  }

  public switchPersona(personaId: string) {
    this.saveState({
      ...this.state,
      currentUserId: personaId,
    });
  }

  public getWallet(userId: string): Wallet {
    let wallet = this.state.wallets.find((w) => w.user_id === userId);
    if (!wallet) {
      wallet = {
        user_id: userId,
        simulated_balance: 0.0,
        updated_at: new Date().toISOString(),
      };
      this.state.wallets.push(wallet);
      this.saveState(this.state);
    }
    return wallet;
  }

  // ==========================================
  // TRANSACTIONAL RPC METHODS (MATCHING POSTGRES RPCs)
  // ==========================================

  /**
   * RPC 1: request_mock_credit(p_amount, p_reference_code)
   * Submits a pending top up request. Does NOT touch simulated_balance.
   */
  public requestMockCredit(amount: number, referenceCode: string): { success: boolean; message: string } {
    const user = this.getCurrentUser();
    if (amount <= 0) {
      throw new Error('Amount must be greater than zero.');
    }
    if (!referenceCode.trim()) {
      throw new Error('Reference code is required.');
    }

    const newRequest: MockCreditRequest = {
      id: crypto.randomUUID(),
      user_id: user.id,
      amount: Math.round(amount * 100) / 100,
      mock_reference_code: referenceCode.trim(),
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
    };

    const updated = {
      ...this.state,
      mock_credit_requests: [newRequest, ...this.state.mock_credit_requests],
    };

    this.saveState(updated);
    return { success: true, message: 'Mock credit request submitted for admin review.' };
  }

  /**
   * RPC 2: approve_mock_credit(p_request_id)
   * ADMIN ONLY: Row locks wallet, adds funds, updates status, writes ledger entry.
   */
  public approveMockCredit(requestId: string): { success: boolean; creditedAmount: number } {
    const admin = this.getCurrentUser();
    if (admin.role !== 'admin') {
      throw new Error('Unauthorized: Administrator privileges required.');
    }

    const req = this.state.mock_credit_requests.find((r) => r.id === requestId);
    if (!req) {
      throw new Error('Mock credit request not found.');
    }
    if (req.status !== 'pending') {
      throw new Error(`Request has already been processed (status: ${req.status}).`);
    }

    const wallet = this.getWallet(req.user_id);
    const newBalance = Math.round((wallet.simulated_balance + req.amount) * 100) / 100;

    // Update wallet
    const updatedWallets = this.state.wallets.map((w) =>
      w.user_id === req.user_id
        ? { ...w, simulated_balance: newBalance, updated_at: new Date().toISOString() }
        : w
    );

    // Update request
    const updatedRequests = this.state.mock_credit_requests.map((r) =>
      r.id === requestId
        ? {
            ...r,
            status: 'approved' as const,
            reviewed_by: admin.id,
            reviewed_at: new Date().toISOString(),
          }
        : r
    );

    // Write double-entry ledger record
    const ledgerEntry: LedgerEntry = {
      id: crypto.randomUUID(),
      user_id: req.user_id,
      battle_id: null,
      bet_id: null,
      entry_type: 'mock_credit_approved',
      amount: req.amount,
      balance_after: newBalance,
      idempotency_key: `mock_credit_${requestId}`,
      created_at: new Date().toISOString(),
    };

    this.saveState({
      ...this.state,
      wallets: updatedWallets,
      mock_credit_requests: updatedRequests,
      ledger_entries: [ledgerEntry, ...this.state.ledger_entries],
    });

    return { success: true, creditedAmount: req.amount };
  }

  /**
   * RPC 3: reject_mock_credit(p_request_id, p_reason)
   */
  public rejectMockCredit(requestId: string, _reason?: string): { success: boolean } {
    const admin = this.getCurrentUser();
    if (admin.role !== 'admin') {
      throw new Error('Unauthorized: Administrator privileges required.');
    }

    const req = this.state.mock_credit_requests.find((r) => r.id === requestId);
    if (!req || req.status !== 'pending') {
      throw new Error('Request not found or not in pending status.');
    }

    const updatedRequests = this.state.mock_credit_requests.map((r) =>
      r.id === requestId
        ? {
            ...r,
            status: 'rejected' as const,
            reviewed_by: admin.id,
            reviewed_at: new Date().toISOString(),
          }
        : r
    );

    this.saveState({
      ...this.state,
      mock_credit_requests: updatedRequests,
    });

    return { success: true };
  }

  /**
   * RPC 4: create_battle(p_title, p_emcee_a, p_emcee_b, p_emcee_a_photo, p_emcee_b_photo, p_starts_at)
   * ADMIN ONLY: Enforces betting_closes_at = starts_at - 1 hour
   */
  public createBattle(
    title: string,
    emceeA: string,
    emceeB: string,
    emceeAPhoto: string,
    emceeBPhoto: string,
    startsAtIso: string
  ): Battle {
    const admin = this.getCurrentUser();
    if (admin.role !== 'admin') {
      throw new Error('Unauthorized: Administrator privileges required.');
    }

    const startsAt = new Date(startsAtIso);
    if (isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      throw new Error('Battle start time must be in the future.');
    }

    // Strict constraint: closes exactly 1 hour before start
    const bettingClosesAt = new Date(startsAt.getTime() - 60 * 60 * 1000).toISOString();

    const newBattle: Battle = {
      id: crypto.randomUUID(),
      title: title.trim(),
      emcee_a: emceeA.trim(),
      emcee_b: emceeB.trim(),
      emcee_a_photo_url: emceeAPhoto.trim(),
      emcee_b_photo_url: emceeBPhoto.trim(),
      starts_at: startsAt.toISOString(),
      betting_closes_at: bettingClosesAt,
      status: 'open',
      fee_rate: 0.1,
      winner_side: null,
      cancellation_reason: null,
      locked_at: null,
      settled_at: null,
      created_by: admin.id,
      created_at: new Date().toISOString(),
    };

    this.saveState({
      ...this.state,
      battles: [newBattle, ...this.state.battles],
    });

    return newBattle;
  }

  /**
   * RPC 5: place_bet(p_battle_id, p_side, p_stake, p_idempotency_key)
   * ZERO CLIENT TRUST: Validates status, time window, locks wallet, takes snapshot, writes ledger.
   */
  public placeBet(
    battleId: string,
    side: BattleSide,
    stake: number,
    idempotencyKey: string
  ): Bet {
    const user = this.getCurrentUser();
    if (side !== 'A' && side !== 'B') {
      throw new Error('Invalid side. Choose A or B.');
    }
    if (stake <= 0) {
      throw new Error('Stake must be greater than zero.');
    }

    // Check idempotency
    const existingBet = this.state.bets.find((b) => b.idempotency_key === idempotencyKey);
    if (existingBet) {
      return existingBet;
    }

    // Check battle status and time window
    const battle = this.state.battles.find((b) => b.id === battleId);
    if (!battle) {
      throw new Error('Battle not found.');
    }
    if (battle.status !== 'open') {
      throw new Error(`Battle is not open for wagering (status: ${battle.status}).`);
    }

    const now = Date.now();
    const closesAt = new Date(battle.betting_closes_at).getTime();
    if (now >= closesAt) {
      throw new Error('Betting has closed for this battle (1-hour lock enforced).');
    }

    // Check balance
    const wallet = this.getWallet(user.id);
    if (wallet.simulated_balance < stake) {
      throw new Error(
        `Insufficient simulated balance. Available: ₱${wallet.simulated_balance.toFixed(2)}, Required: ₱${stake.toFixed(2)}`
      );
    }

    const newBalance = Math.round((wallet.simulated_balance - stake) * 100) / 100;

    // Calculate snapshot
    const currentSummary = calculatePoolSummary(this.state.bets, battleId, battle.fee_rate);
    const snapPoolA = side === 'A' ? currentSummary.poolA + stake : currentSummary.poolA;
    const snapPoolB = side === 'B' ? currentSummary.poolB + stake : currentSummary.poolB;
    const snapTotal = snapPoolA + snapPoolB;
    const snapDist = snapTotal * (1 - battle.fee_rate);
    const targetPool = side === 'A' ? snapPoolA : snapPoolB;
    const snapOdds = targetPool > 0 ? Math.round((snapDist / targetPool) * 10000) / 10000 : 0;

    const betId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const newBet: Bet = {
      id: betId,
      battle_id: battleId,
      user_id: user.id,
      side,
      stake,
      status: 'accepted',
      idempotency_key: idempotencyKey,
      accepted_at: nowIso,
      snapshot_pool_a: snapPoolA,
      snapshot_pool_b: snapPoolB,
      snapshot_total_pool: snapTotal,
      snapshot_indicative_odds: snapOdds,
      gross_payout: 0,
      net_profit: 0,
      settled_at: null,
      created_at: nowIso,
    };

    // Update wallet
    const updatedWallets = this.state.wallets.map((w) =>
      w.user_id === user.id
        ? { ...w, simulated_balance: newBalance, updated_at: nowIso }
        : w
    );

    // Ledger reserve entry
    const ledgerEntry: LedgerEntry = {
      id: crypto.randomUUID(),
      user_id: user.id,
      battle_id: battleId,
      bet_id: betId,
      entry_type: 'bet_stake_reserve',
      amount: -stake,
      balance_after: newBalance,
      idempotency_key: `reserve_${idempotencyKey}`,
      created_at: nowIso,
    };

    this.saveState({
      ...this.state,
      wallets: updatedWallets,
      bets: [newBet, ...this.state.bets],
      ledger_entries: [ledgerEntry, ...this.state.ledger_entries],
    });

    return newBet;
  }

  /**
   * RPC 6: lock_battle(p_battle_id)
   * ADMIN ONLY
   */
  public lockBattle(battleId: string): Battle {
    const admin = this.getCurrentUser();
    if (admin.role !== 'admin') {
      throw new Error('Unauthorized: Administrator privileges required.');
    }

    const battle = this.state.battles.find((b) => b.id === battleId);
    if (!battle) {
      throw new Error('Battle not found.');
    }
    if (battle.status !== 'open') {
      throw new Error(`Battle cannot be locked (status: ${battle.status}).`);
    }

    const nowIso = new Date().toISOString();
    const updatedBattles = this.state.battles.map((b) =>
      b.id === battleId ? { ...b, status: 'locked' as const, locked_at: nowIso } : b
    );

    this.saveState({
      ...this.state,
      battles: updatedBattles,
    });

    return { ...battle, status: 'locked', locked_at: nowIso };
  }

  /**
   * RPC 7: settle_battle(p_battle_id, p_winner_side, p_idempotency_key)
   * ADMIN ONLY: High-precision pari-mutuel distribution.
   */
  public settleBattle(
    battleId: string,
    winnerSide: BattleSide,
    idempotencyKey: string
  ): BattleSettlement {
    const admin = this.getCurrentUser();
    if (admin.role !== 'admin') {
      throw new Error('Unauthorized: Administrator privileges required.');
    }

    const battle = this.state.battles.find((b) => b.id === battleId);
    if (!battle) {
      throw new Error('Battle not found.');
    }
    if (battle.status !== 'open' && battle.status !== 'locked') {
      throw new Error(`Battle cannot be settled (status: ${battle.status}).`);
    }

    // Check idempotency
    const existingSettlement = this.state.battle_settlements.find(
      (s) => s.idempotency_key === idempotencyKey
    );
    if (existingSettlement) {
      return existingSettlement;
    }

    const nowIso = new Date().toISOString();
    const eligibleBets = this.state.bets.filter(
      (b) => b.battle_id === battleId && b.status === 'accepted'
    );

    const poolA = eligibleBets
      .filter((b) => b.side === 'A')
      .reduce((sum, b) => sum + Number(b.stake), 0);
    const poolB = eligibleBets
      .filter((b) => b.side === 'B')
      .reduce((sum, b) => sum + Number(b.stake), 0);
    const totalPool = Math.round((poolA + poolB) * 100) / 100;
    const winningPool = winnerSide === 'A' ? poolA : poolB;

    let updatedWallets = [...this.state.wallets];
    let updatedBets = [...this.state.bets];
    let newLedgerEntries: LedgerEntry[] = [];

    // CASE 1: No bets placed or NO winning bets placed -> 100% refund
    if (totalPool === 0 || winningPool === 0) {
      for (const bet of eligibleBets) {
        const wallet = updatedWallets.find((w) => w.user_id === bet.user_id);
        const newBal = wallet
          ? Math.round((wallet.simulated_balance + bet.stake) * 100) / 100
          : bet.stake;

        updatedWallets = updatedWallets.map((w) =>
          w.user_id === bet.user_id ? { ...w, simulated_balance: newBal, updated_at: nowIso } : w
        );

        updatedBets = updatedBets.map((b) =>
          b.id === bet.id ? { ...b, status: 'refunded' as const, settled_at: nowIso } : b
        );

        newLedgerEntries.push({
          id: crypto.randomUUID(),
          user_id: bet.user_id,
          battle_id: battleId,
          bet_id: bet.id,
          entry_type: 'bet_refund',
          amount: bet.stake,
          balance_after: newBal,
          idempotency_key: `refund_${bet.id}_${idempotencyKey}`,
          created_at: nowIso,
        });
      }

      const settlement: BattleSettlement = {
        battle_id: battleId,
        idempotency_key: idempotencyKey,
        outcome_type: 'cancelled_refunded',
        winner_side: null,
        pool_a: poolA,
        pool_b: poolB,
        total_pool: totalPool,
        platform_fee: 0,
        distributable_pool: 0,
        total_payouts: totalPool,
        rounding_remainder_allocated: 0,
        created_at: nowIso,
      };

      const updatedBattles = this.state.battles.map((b) =>
        b.id === battleId
          ? {
              ...b,
              status: 'cancelled' as const,
              cancellation_reason: 'Zero winning pool - Full refund distributed to all bettors',
              settled_at: nowIso,
            }
          : b
      );

      this.saveState({
        ...this.state,
        wallets: updatedWallets,
        bets: updatedBets,
        battles: updatedBattles,
        battle_settlements: [settlement, ...this.state.battle_settlements],
        ledger_entries: [...newLedgerEntries, ...this.state.ledger_entries],
      });

      return settlement;
    }

    // CASE 2: Pari-Mutuel Settlement Calculation
    const platformFee = Math.round(totalPool * battle.fee_rate * 100) / 100;
    const distributablePool = Math.round((totalPool - platformFee) * 100) / 100;

    // Platform fee entry
    newLedgerEntries.push({
      id: crypto.randomUUID(),
      user_id: null,
      battle_id: battleId,
      bet_id: null,
      entry_type: 'platform_fee',
      amount: platformFee,
      balance_after: null,
      idempotency_key: `fee_${battleId}_${idempotencyKey}`,
      created_at: nowIso,
    });

    let totalPayouts = 0;

    // Process winning bets
    const winningBets = eligibleBets.filter((b) => b.side === winnerSide);
    for (const bet of winningBets) {
      const userShare = bet.stake / winningPool;
      const rawPayout = userShare * distributablePool;
      // Truncate to cents (floor) to prevent fractional cent creation
      const grossPayout = Math.floor(rawPayout * 100) / 100;
      const netProfit = Math.round((grossPayout - bet.stake) * 100) / 100;
      totalPayouts += grossPayout;

      const wallet = updatedWallets.find((w) => w.user_id === bet.user_id);
      const newBal = wallet
        ? Math.round((wallet.simulated_balance + grossPayout) * 100) / 100
        : grossPayout;

      updatedWallets = updatedWallets.map((w) =>
        w.user_id === bet.user_id ? { ...w, simulated_balance: newBal, updated_at: nowIso } : w
      );

      updatedBets = updatedBets.map((b) =>
        b.id === bet.id
          ? {
              ...b,
              status: 'settled_won' as const,
              gross_payout: grossPayout,
              net_profit: netProfit,
              settled_at: nowIso,
            }
          : b
      );

      newLedgerEntries.push({
        id: crypto.randomUUID(),
        user_id: bet.user_id,
        battle_id: battleId,
        bet_id: bet.id,
        entry_type: 'bet_payout',
        amount: grossPayout,
        balance_after: newBal,
        idempotency_key: `payout_${bet.id}_${idempotencyKey}`,
        created_at: nowIso,
      });
    }

    // Process losing bets
    const losingBets = eligibleBets.filter((b) => b.side !== winnerSide);
    for (const bet of losingBets) {
      updatedBets = updatedBets.map((b) =>
        b.id === bet.id
          ? {
              ...b,
              status: 'settled_lost' as const,
              gross_payout: 0,
              net_profit: -bet.stake,
              settled_at: nowIso,
            }
          : b
      );
    }

    totalPayouts = Math.round(totalPayouts * 100) / 100;
    const roundingRemainder = Math.round((distributablePool - totalPayouts) * 100) / 100;

    const settlement: BattleSettlement = {
      battle_id: battleId,
      idempotency_key: idempotencyKey,
      outcome_type: 'settled',
      winner_side: winnerSide,
      pool_a: poolA,
      pool_b: poolB,
      total_pool: totalPool,
      platform_fee: platformFee,
      distributable_pool: distributablePool,
      total_payouts: totalPayouts,
      rounding_remainder_allocated: roundingRemainder,
      created_at: nowIso,
    };

    const updatedBattles = this.state.battles.map((b) =>
      b.id === battleId
        ? {
            ...b,
            status: 'settled' as const,
            winner_side: winnerSide,
            settled_at: nowIso,
          }
        : b
    );

    this.saveState({
      ...this.state,
      wallets: updatedWallets,
      bets: updatedBets,
      battles: updatedBattles,
      battle_settlements: [settlement, ...this.state.battle_settlements],
      ledger_entries: [...newLedgerEntries, ...this.state.ledger_entries],
    });

    return settlement;
  }

  /**
   * RPC 8: cancel_battle(p_battle_id, p_reason, p_idempotency_key)
   * ADMIN ONLY: 100% refund of all accepted bets.
   */
  public cancelBattle(battleId: string, reason: string, idempotencyKey: string): { success: boolean; totalRefunded: number } {
    const admin = this.getCurrentUser();
    if (admin.role !== 'admin') {
      throw new Error('Unauthorized: Administrator privileges required.');
    }

    const battle = this.state.battles.find((b) => b.id === battleId);
    if (!battle) {
      throw new Error('Battle not found.');
    }

    const nowIso = new Date().toISOString();
    const eligibleBets = this.state.bets.filter(
      (b) => b.battle_id === battleId && b.status === 'accepted'
    );

    let updatedWallets = [...this.state.wallets];
    let updatedBets = [...this.state.bets];
    let newLedgerEntries: LedgerEntry[] = [];
    let totalRefunded = 0;

    for (const bet of eligibleBets) {
      totalRefunded += bet.stake;
      const wallet = updatedWallets.find((w) => w.user_id === bet.user_id);
      const newBal = wallet
        ? Math.round((wallet.simulated_balance + bet.stake) * 100) / 100
        : bet.stake;

      updatedWallets = updatedWallets.map((w) =>
        w.user_id === bet.user_id ? { ...w, simulated_balance: newBal, updated_at: nowIso } : w
      );

      updatedBets = updatedBets.map((b) =>
        b.id === bet.id ? { ...b, status: 'refunded' as const, settled_at: nowIso } : b
      );

      newLedgerEntries.push({
        id: crypto.randomUUID(),
        user_id: bet.user_id,
        battle_id: battleId,
        bet_id: bet.id,
        entry_type: 'bet_refund',
        amount: bet.stake,
        balance_after: newBal,
        idempotency_key: `refund_${bet.id}_${idempotencyKey}`,
        created_at: nowIso,
      });
    }

    totalRefunded = Math.round(totalRefunded * 100) / 100;

    const settlement: BattleSettlement = {
      battle_id: battleId,
      idempotency_key: idempotencyKey,
      outcome_type: 'cancelled_refunded',
      winner_side: null,
      pool_a: 0,
      pool_b: 0,
      total_pool: totalRefunded,
      platform_fee: 0,
      distributable_pool: 0,
      total_payouts: totalRefunded,
      rounding_remainder_allocated: 0,
      created_at: nowIso,
    };

    const updatedBattles = this.state.battles.map((b) =>
      b.id === battleId
        ? {
            ...b,
            status: 'cancelled' as const,
            cancellation_reason: reason.trim() || 'Admin cancellation',
            settled_at: nowIso,
          }
        : b
    );

    this.saveState({
      ...this.state,
      wallets: updatedWallets,
      bets: updatedBets,
      battles: updatedBattles,
      battle_settlements: [settlement, ...this.state.battle_settlements],
      ledger_entries: [...newLedgerEntries, ...this.state.ledger_entries],
    });

    return { success: true, totalRefunded };
  }
}

export const engineInstance = new PariMutuelEngine();
