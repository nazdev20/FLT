import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import {
  Battle,
  Bet,
  BetPaymentSubmission,
  Profile,
  BattlePoolSummary,
  BattleSide,
} from '../types/database';

// Next.js exposes only NEXT_PUBLIC_* variables to browser code.
const ENV_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ENV_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

const CONFIG_STORAGE_KEY = 'flt_supabase_config_override';
const LOCAL_STORAGE_DB_KEY = 'flt_local_db_state_v2';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

export function getSavedConfig(): SupabaseConfig {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.url && parsed.anonKey) {
        return { url: parsed.url, anonKey: parsed.anonKey, isConfigured: true };
      }
    }
  } catch {
    // ignore
  }

  const isConfigured = Boolean(ENV_URL && ENV_KEY && ENV_URL.startsWith('http'));
  return {
    url: ENV_URL,
    anonKey: ENV_KEY,
    isConfigured,
  };
}

export function saveSupabaseConfig(url: string, anonKey: string) {
  localStorage.setItem(
    CONFIG_STORAGE_KEY,
    JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() })
  );
  initClient();
}

let supabaseClient: any = null;

export function initClient(): any {
  const config = getSavedConfig();
  if (config.isConfigured) {
    try {
      supabaseClient = createClient(config.url, config.anonKey, {
        db: {
          schema: 'FLT', // Exact FLT PostgreSQL schema
        },
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      return supabaseClient;
    } catch (e) {
      console.warn('Failed to initialize Supabase client:', e);
      supabaseClient = null;
    }
  }
  return null;
}

export function getClient(): any {
  if (!supabaseClient) {
    return initClient();
  }
  return supabaseClient;
}

// ==========================================
// SEED & LOCAL REPOSITORY FOR ZERO-CRASH DEV
// ==========================================
interface LocalDBState {
  battles: Battle[];
  bets: Bet[];
  submissions: BetPaymentSubmission[];
  profiles: Profile[];
  currentUserId: string;
}

function getInitialLocalState(): LocalDBState {
  const now = Date.now();
  const starts1 = new Date(now + 2 * 3600 * 1000).toISOString();
  const closes1 = new Date(now + 1 * 3600 * 1000).toISOString();

  const starts2 = new Date(now + 5 * 3600 * 1000).toISOString();
  const closes2 = new Date(now + 4 * 3600 * 1000).toISOString();

  const starts3 = new Date(now + 40 * 60 * 1000).toISOString();
  const closes3 = new Date(now - 20 * 60 * 1000).toISOString();

  const adminId = 'a1111111-1111-1111-1111-111111111111';
  const userId = 'u2222222-2222-2222-2222-222222222222';

  const b1Id = 'b1111111-0000-0000-0000-000000000001';
  const b2Id = 'b2222222-0000-0000-0000-000000000002';
  const b3Id = 'b3333333-0000-0000-0000-000000000003';

  return {
    currentUserId: userId,
    profiles: [
      {
        id: adminId,
        username: 'FlipTopArbiter',
        role: 'admin',
        created_at: new Date(now - 86400000 * 10).toISOString(),
      },
      {
        id: userId,
        username: 'BettorKalibre',
        role: 'user',
        created_at: new Date(now - 86400000 * 5).toISOString(),
      },
    ],
    battles: [
      {
        id: b1Id,
        title: 'Ahon 14 - Battle of the Year Clash',
        emcee_a: 'Loonie',
        emcee_b: 'Sinio',
        emcee_a_photo_url:
          'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=400&auto=format&fit=crop&q=80',
        emcee_b_photo_url:
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
        starts_at: starts1,
        betting_closes_at: closes1,
        status: 'open',
        fee_rate: 0.1,
        pool_a: 5000,
        pool_b: 3500,
        total_pool: 8500,
        accepted_bets_count: 5,
        unique_bettors_count: 4,
        platform_fee: 850,
        distributable_pool: 7650,
        odds_a: 1.53,
        odds_b: 2.1857,
        winner_side: null,
        cancellation_reason: null,
        locked_at: null,
        settled_at: null,
        created_by: adminId,
        created_at: new Date(now - 86400000).toISOString(),
      },
      {
        id: b2Id,
        title: 'Bwelta Balentong X - Freestyle Masterclass',
        emcee_a: 'Batas',
        emcee_b: 'Dello',
        emcee_a_photo_url:
          'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=400&auto=format&fit=crop&q=80',
        emcee_b_photo_url:
          'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=80',
        starts_at: starts2,
        betting_closes_at: closes2,
        status: 'open',
        fee_rate: 0.1,
        pool_a: 2000,
        pool_b: 2500,
        total_pool: 4500,
        accepted_bets_count: 3,
        unique_bettors_count: 3,
        platform_fee: 450,
        distributable_pool: 4050,
        odds_a: 2.025,
        odds_b: 1.62,
        winner_side: null,
        cancellation_reason: null,
        locked_at: null,
        settled_at: null,
        created_by: adminId,
        created_at: new Date(now - 43200000).toISOString(),
      },
      {
        id: b3Id,
        title: 'Unibersikulo Semifinals - Wordplay Clinic',
        emcee_a: 'Tipsy D',
        emcee_b: 'Poison13',
        emcee_a_photo_url:
          'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
        emcee_b_photo_url:
          'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80',
        starts_at: starts3,
        betting_closes_at: closes3,
        status: 'locked',
        fee_rate: 0.1,
        pool_a: 4000,
        pool_b: 3000,
        total_pool: 7000,
        accepted_bets_count: 4,
        unique_bettors_count: 3,
        platform_fee: 700,
        distributable_pool: 6300,
        odds_a: 1.575,
        odds_b: 2.1,
        winner_side: null,
        cancellation_reason: null,
        locked_at: closes3,
        settled_at: null,
        created_by: adminId,
        created_at: new Date(now - 72000000).toISOString(),
      },
    ],
    bets: [
      {
        id: 'bet-local-1',
        battle_id: b1Id,
        user_id: userId,
        side: 'A',
        stake: 1000,
        status: 'accepted',
        idempotency_key: 'idem-b1-1000-a',
        accepted_at: new Date(now - 3600000).toISOString(),
        snapshot_pool_a: 5000,
        snapshot_pool_b: 3500,
        snapshot_total_pool: 8500,
        snapshot_distributable_pool: 7650,
        snapshot_indicative_odds: 1.53,
        gross_payout: 0,
        net_profit: 0,
        settled_at: null,
        created_at: new Date(now - 4000000).toISOString(),
      },
      {
        id: 'bet-local-2',
        battle_id: b1Id,
        user_id: userId,
        side: 'B',
        stake: 500,
        status: 'pending_verification',
        idempotency_key: 'idem-b1-500-b',
        accepted_at: null,
        snapshot_pool_a: null,
        snapshot_pool_b: null,
        snapshot_total_pool: null,
        snapshot_distributable_pool: null,
        snapshot_indicative_odds: null,
        gross_payout: 0,
        net_profit: 0,
        settled_at: null,
        created_at: new Date(now - 600000).toISOString(),
      },
    ],
    submissions: [
      {
        id: 'sub-local-1',
        bet_id: 'bet-local-2',
        user_id: userId,
        amount: 500,
        payment_reference: 'GCASH-REF-892147',
        receipt_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400',
        status: 'pending',
        review_note: null,
        reviewed_by: null,
        reviewed_at: null,
        created_at: new Date(now - 600000).toISOString(),
        battle_title: 'Ahon 14 - Battle of the Year Clash',
        emcee_a: 'Loonie',
        emcee_b: 'Sinio',
        side: 'B',
        bettor_username: 'BettorKalibre',
      },
    ],
  };
}

class LocalFLTRepository {
  private state: LocalDBState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): LocalDBState {
    try {
      const s = localStorage.getItem(LOCAL_STORAGE_DB_KEY);
      if (s) {
        return JSON.parse(s);
      }
    } catch {
      // ignore
    }
    const init = getInitialLocalState();
    this.saveState(init);
    return init;
  }

  public saveState(s: LocalDBState) {
    try {
      localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(s));
    } catch {
      // ignore
    }
    this.state = s;
    this.notify();
  }

  public subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    for (const cb of this.listeners) {
      cb();
    }
  }

  public getState() {
    return this.state;
  }

  public setCurrentUser(userId: string) {
    this.saveState({ ...this.state, currentUserId: userId });
  }

  public reset() {
    localStorage.removeItem(LOCAL_STORAGE_DB_KEY);
    const init = getInitialLocalState();
    this.saveState(init);
  }
}

export const localRepo = new LocalFLTRepository();

// ==========================================
// FLT SERVICE (SUPABASE WITH FALLBACK)
// ==========================================

export const FLTService = {
  // Check if live Supabase is active
  isLiveSupabase(): boolean {
    return Boolean(getClient());
  },

  // Auth: Get current session / user
  async getCurrentUser(): Promise<{ user: User | null; profile: Profile | null }> {
    const client = getClient();
    if (client) {
      try {
        const { data: { user } } = await client.auth.getUser();
        if (user) {
          const { data: profile } = await client
            .schema('FLT')
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          return { user, profile: profile as Profile };
        }
      } catch (err) {
        console.warn('Supabase auth getUser error:', err);
      }
    }

    // Local persona
    const local = localRepo.getState();
    const prof = local.profiles.find((p) => p.id === local.currentUserId) || local.profiles[1];
    const mockUser: any = {
      id: prof.id,
      email: `${prof.username?.toLowerCase() || 'user'}@fliptop.test`,
      created_at: prof.created_at,
    };
    return { user: mockUser, profile: prof };
  },

  // Check admin privileges via FLT.is_admin() RPC
  async checkIsAdmin(): Promise<boolean> {
    const client = getClient();
    if (client) {
      try {
        const { data, error } = await client.schema('FLT').rpc('is_admin');
        if (!error && typeof data === 'boolean') {
          return data;
        }
      } catch (err) {
        console.warn('FLT.is_admin RPC failed:', err);
      }
    }
    const { profile } = await this.getCurrentUser();
    return profile?.role === 'admin';
  },

  // 1. Fetch Battles from FLT.battles
  async fetchBattles(): Promise<Battle[]> {
    const client = getClient();
    if (!client) {
      throw new Error('Supabase is not configured. Configure the FLT Supabase URL and public key before loading battles.');
    }

    const { data, error } = await client
      .schema('FLT')
      .from('battles')
      .select('*')
      .order('starts_at', { ascending: true });

    if (error) {
      throw new Error(`Unable to load battles from FLT.battles: ${error.message}`);
    }
    return (data || []) as Battle[];
  },

  // 2. Fetch Single Battle with calculations
  async fetchBattleById(battleId: string): Promise<Battle | null> {
    const battles = await this.fetchBattles();
    return battles.find((b) => b.id === battleId) || null;
  },

  // 3. FLT.get_battle_pool_summary(p_battle_id)
  async getBattlePoolSummary(battleId: string): Promise<BattlePoolSummary> {
    const client = getClient();
    if (client) {
      try {
        const { data, error } = await client
          .schema('FLT')
          .rpc('get_battle_pool_summary', { p_battle_id: battleId });

        if (!error && data) {
          return data as BattlePoolSummary;
        }
      } catch (err) {
        console.warn('FLT.get_battle_pool_summary RPC failed, falling back:', err);
      }
    }

    const state = localRepo.getState();
    const battle = state.battles.find((b) => b.id === battleId);
    const acceptedBets = state.bets.filter(
      (b) => b.battle_id === battleId && ['accepted', 'settled_won', 'settled_lost'].includes(b.status)
    );

    let poolA = 0;
    let poolB = 0;
    let countA = 0;
    let countB = 0;
    const bettorSet = new Set<string>();

    for (const b of acceptedBets) {
      bettorSet.add(b.user_id);
      if (b.side === 'A') {
        poolA += Number(b.stake);
        countA++;
      } else {
        poolB += Number(b.stake);
        countB++;
      }
    }

    const total = poolA + poolB;
    const distributable = total * (1 - (battle?.fee_rate || 0.1));
    const oddsA = poolA > 0 ? Math.round((distributable / poolA) * 10000) / 10000 : 0;
    const oddsB = poolB > 0 ? Math.round((distributable / poolB) * 10000) / 10000 : 0;

    return {
      pool_a: poolA,
      pool_b: poolB,
      total_pool: total,
      distributable_pool: distributable,
      odds_a: oddsA,
      odds_b: oddsB,
      bets_count_a: countA,
      bets_count_b: countB,
      unique_bettors_count: bettorSet.size,
    };
  },

  // 4. FLT.submit_bet_payment
  // Core user workflow step 8: User submits bet with payment reference
  async submitBetPayment(
    battleId: string,
    side: BattleSide,
    amount: number,
    idempotencyKey: string,
    paymentReference: string,
    receiptUrl: string | null = null
  ): Promise<{ bet_id: string; payment_id: string; status: string }> {
    const client = getClient();
    if (client) {
      try {
        const { data, error } = await client.schema('FLT').rpc('submit_bet_payment', {
          p_battle_id: battleId,
          p_side: side,
          p_amount: amount,
          p_idempotency_key: idempotencyKey,
          p_payment_reference: paymentReference,
          p_receipt_url: receiptUrl,
        });

        if (error) throw error;
        return data as any;
      } catch (err: any) {
        throw new Error(err?.message || 'Error submitting bet payment to FLT.submit_bet_payment');
      }
    }

    throw new Error('Supabase is not configured. Bet submissions must be saved to FLT through the database; local mock submissions are disabled.');

    /* Local fallback implementation intentionally disabled.
    const state = localRepo.getState();
    const { user } = await this.getCurrentUser();
    if (!user) throw new Error('Authentication required.');

    const battle = state.battles.find((b) => b.id === battleId);
    if (!battle) throw new Error('Battle not found.');
    if (battle.status !== 'open') throw new Error('Battle is not open for wagering.');
    if (Date.now() >= new Date(battle.betting_closes_at).getTime()) {
      throw new Error('Betting has closed for this battle (1 hour lockout).');
    }

    // Ensure unique payment reference
    const exists = state.submissions.some((s) => s.payment_reference === paymentReference);
    if (exists) throw new Error('Payment reference has already been submitted.');

    const betId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const newBet: Bet = {
      id: betId,
      battle_id: battleId,
      user_id: user.id,
      side,
      stake: amount,
      status: 'pending_verification', // Must NOT enter pool until approved!
      idempotency_key: idempotencyKey,
      accepted_at: null,
      snapshot_pool_a: null,
      snapshot_pool_b: null,
      snapshot_total_pool: null,
      snapshot_distributable_pool: null,
      snapshot_indicative_odds: null,
      gross_payout: 0,
      net_profit: 0,
      settled_at: null,
      created_at: nowIso,
    };

    const newSub: BetPaymentSubmission = {
      id: paymentId,
      bet_id: betId,
      user_id: user.id,
      amount,
      payment_reference: paymentReference,
      receipt_url: receiptUrl,
      status: 'pending',
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: nowIso,
      battle_title: battle.title,
      emcee_a: battle.emcee_a,
      emcee_b: battle.emcee_b,
      side,
      bettor_username: user.email?.split('@')[0] || 'User',
    };

    localRepo.saveState({
      ...state,
      bets: [newBet, ...state.bets],
      submissions: [newSub, ...state.submissions],
    });

    return { bet_id: betId, payment_id: paymentId, status: 'pending_verification' };
    */
  },

  // 5. Fetch My Bets & Payment Submissions
  async fetchMyBets(userId: string): Promise<Bet[]> {
    const client = getClient();
    if (client) {
      try {
        const { data, error } = await client
          .schema('FLT')
          .from('bets')
          .select('*, battle:battle_id(*), payment_submission:bet_payment_submissions(*)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data as Bet[];
        }
      } catch (err) {
        console.warn('Error fetching FLT.bets:', err);
      }
    }

    const state = localRepo.getState();
    return state.bets
      .filter((b) => b.user_id === userId)
      .map((b) => ({
        ...b,
        battle: state.battles.find((bat) => bat.id === b.battle_id),
        payment_submission: state.submissions.find((s) => s.bet_id === b.id),
      }));
  },

  // 6. Fetch Admin Payment Submissions
  async fetchPaymentSubmissions(statusFilter?: 'pending' | 'approved' | 'rejected'): Promise<BetPaymentSubmission[]> {
    const client = getClient();
    if (client) {
      try {
        let query = client
          .schema('FLT')
          .from('bet_payment_submissions')
          .select('*, bet:bet_id(*, battle:battle_id(*)), profile:user_id(username)')
          .order('created_at', { ascending: false });

        if (statusFilter) {
          query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data.map((d: any) => ({
            ...d,
            battle_title: d.bet?.battle?.title,
            emcee_a: d.bet?.battle?.emcee_a,
            emcee_b: d.bet?.battle?.emcee_b,
            side: d.bet?.side,
            bettor_username: d.profile?.username,
          }));
        }
      } catch (err) {
        console.warn('Error fetching FLT.bet_payment_submissions:', err);
      }
    }

    const state = localRepo.getState();
    let subs = state.submissions;
    if (statusFilter) {
      subs = subs.filter((s) => s.status === statusFilter);
    }
    return subs;
  },

  // 7. FLT.review_bet_payment
  // Admin workflow step 12: Admin verifies payment against receiving account and reviews
  async reviewBetPayment(
    paymentId: string,
    approve: boolean,
    reviewNote: string
  ): Promise<{ success: boolean; message: string }> {
    const client = getClient();
    if (client) {
      try {
        const { data, error } = await client.schema('FLT').rpc('review_bet_payment', {
          p_payment_id: paymentId,
          p_approve: approve,
          p_review_note: reviewNote,
        });

        if (error) throw error;
        return { success: true, message: data?.message || 'Payment review completed.' };
      } catch (err: any) {
        throw new Error(err?.message || 'FLT.review_bet_payment failed');
      }
    }

    // Local fallback
    const state = localRepo.getState();
    const { user, profile } = await this.getCurrentUser();
    if (profile?.role !== 'admin') {
      throw new Error('Unauthorized: Admin role required for review_bet_payment');
    }

    const sub = state.submissions.find((s) => s.id === paymentId);
    if (!sub) throw new Error('Payment submission not found');
    if (sub.status !== 'pending') throw new Error(`Already processed (status: ${sub.status})`);

    const nowIso = new Date().toISOString();
    const newSubStatus = approve ? 'approved' : 'rejected';
    const newBetStatus = approve ? 'accepted' : 'rejected';

    // Update submission
    const updatedSubs = state.submissions.map((s) =>
      s.id === paymentId
        ? {
            ...s,
            status: newSubStatus as any,
            review_note: reviewNote,
            reviewed_by: user?.id || null,
            reviewed_at: nowIso,
          }
        : s
    );

    // Update bet status
    const targetBet = state.bets.find((b) => b.id === sub.bet_id);
    let updatedBets = state.bets.map((b) =>
      b.id === sub.bet_id
        ? {
            ...b,
            status: newBetStatus as any,
            accepted_at: approve ? nowIso : null,
          }
        : b
    );

    // If approved, update battle pool totals in FLT.battles
    let updatedBattles = state.battles;
    if (approve && targetBet) {
      updatedBattles = state.battles.map((bat) => {
        if (bat.id === targetBet.battle_id) {
          const poolA = (bat.pool_a || 0) + (targetBet.side === 'A' ? targetBet.stake : 0);
          const poolB = (bat.pool_b || 0) + (targetBet.side === 'B' ? targetBet.stake : 0);
          const total = poolA + poolB;
          const dist = total * (1 - bat.fee_rate);
          const oddsA = poolA > 0 ? dist / poolA : 0;
          const oddsB = poolB > 0 ? dist / poolB : 0;

          return {
            ...bat,
            pool_a: poolA,
            pool_b: poolB,
            total_pool: total,
            distributable_pool: dist,
            odds_a: Math.round(oddsA * 10000) / 10000,
            odds_b: Math.round(oddsB * 10000) / 10000,
            accepted_bets_count: (bat.accepted_bets_count || 0) + 1,
          };
        }
        return bat;
      });
    }

    localRepo.saveState({
      ...state,
      submissions: updatedSubs,
      bets: updatedBets,
      battles: updatedBattles,
    });

    return {
      success: true,
      message: approve ? 'Payment verified & bet accepted into pool!' : 'Payment rejected.',
    };
  },

  // 8. FLT.create_battle
  async createBattle(
    title: string,
    emceeA: string,
    emceeB: string,
    emceeAPhoto: string,
    emceeBPhoto: string,
    startsAtIso: string
  ): Promise<Battle> {
    const client = getClient();
    if (client) {
      try {
        const { data, error } = await client.schema('FLT').rpc('create_battle', {
          p_title: title.trim(),
          p_emcee_a: emceeA.trim(),
          p_emcee_b: emceeB.trim(),
          p_emcee_a_photo_url: emceeAPhoto.trim(),
          p_emcee_b_photo_url: emceeBPhoto.trim(),
          p_starts_at: startsAtIso,
        });

        if (error) throw error;
        // Refetch battles
        const battles = await this.fetchBattles();
        return battles.find((b) => b.id === data?.battle_id) || (data as any);
      } catch (err: any) {
        throw new Error(err?.message || 'FLT.create_battle RPC failed');
      }
    }

    // Local fallback
    const state = localRepo.getState();
    const { user, profile } = await this.getCurrentUser();
    if (profile?.role !== 'admin') {
      throw new Error('Unauthorized: Administrator privileges required.');
    }

    const startsAt = new Date(startsAtIso);
    const closesAt = new Date(startsAt.getTime() - 60 * 60 * 1000).toISOString();

    const newBattle: Battle = {
      id: crypto.randomUUID(),
      title: title.trim(),
      emcee_a: emceeA.trim(),
      emcee_b: emceeB.trim(),
      emcee_a_photo_url: emceeAPhoto.trim(),
      emcee_b_photo_url: emceeBPhoto.trim(),
      starts_at: startsAt.toISOString(),
      betting_closes_at: closesAt,
      status: 'open',
      fee_rate: 0.1,
      pool_a: 0,
      pool_b: 0,
      total_pool: 0,
      accepted_bets_count: 0,
      unique_bettors_count: 0,
      platform_fee: 0,
      distributable_pool: 0,
      odds_a: 0,
      odds_b: 0,
      winner_side: null,
      cancellation_reason: null,
      locked_at: null,
      settled_at: null,
      created_by: user?.id || null,
      created_at: new Date().toISOString(),
    };

    localRepo.saveState({
      ...state,
      battles: [newBattle, ...state.battles],
    });

    return newBattle;
  },

  // 9. FLT.lock_battle
  async lockBattle(battleId: string): Promise<void> {
    const client = getClient();
    if (client) {
      try {
        const { error } = await client
          .schema('FLT')
          .rpc('lock_battle', { p_battle_id: battleId });
        if (error) throw error;
        return;
      } catch (err: any) {
        throw new Error(err?.message || 'FLT.lock_battle RPC failed');
      }
    }

    const state = localRepo.getState();
    const updated = state.battles.map((b) =>
      b.id === battleId ? { ...b, status: 'locked' as const, locked_at: new Date().toISOString() } : b
    );
    localRepo.saveState({ ...state, battles: updated });
  },

  // 10. FLT.sync_battle_lock
  async syncBattleLock(battleId: string): Promise<void> {
    const client = getClient();
    if (client) {
      try {
        await client.schema('FLT').rpc('sync_battle_lock', { p_battle_id: battleId });
      } catch (err) {
        console.warn('sync_battle_lock error:', err);
      }
    }
  },
};
