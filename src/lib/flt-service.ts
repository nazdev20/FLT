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
  return { battles: [], bets: [], submissions: [], profiles: [], currentUserId: '' };
}

class LocalFLTRepository {
  private state: LocalDBState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): LocalDBState {
    try { localStorage.removeItem(LOCAL_STORAGE_DB_KEY); } catch { /* ignore */ }
    return getInitialLocalState();
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
    if (!client) return { user: null, profile: null };
    try {
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) return { user: null, profile: null };
      const { data: profile, error: profileError } = await client.schema('FLT').from('profiles')
        .select('id, username, role, created_at').eq('id', user.id).maybeSingle();
      if (profileError || !profile) return { user, profile: null };
      return { user, profile: profile as Profile };
    } catch (err) {
      console.warn('Unable to load authenticated profile:', err);
      return { user: null, profile: null };
    }
  },

  // Check admin privileges via FLT.is_admin() RPC
  async checkIsAdmin(): Promise<boolean> {
    const client = getClient();
    if (!client) return false;
    const { user, profile } = await this.getCurrentUser();
    if (!user || !profile || profile.role !== 'admin') return false;
    try {
      const { data, error } = await client.schema('FLT').rpc('is_admin');
      return !error && data === true;
    } catch { return false; }
  },

  // 1. Fetch Battles from FLT.battles
  async fetchBattles(): Promise<Battle[]> {
    const client = getClient();
    if (!client) throw new Error('The battle service is unavailable. Please try again later.');
    const { data, error } = await client.schema('FLT').from('battles').select('*').order('starts_at', { ascending: true });
    if (error) throw new Error('Unable to load battles right now.');
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
    if (!client) throw new Error('The battle service is unavailable. Please try again later.');
    const { data, error } = await client.schema('FLT').rpc('get_battle_pool_summary', { p_battle_id: battleId });
    if (error || !data) throw new Error('Unable to load battle totals right now.');
    return data as BattlePoolSummary;
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

    throw new Error('Sign in and connect to the account service before submitting a payment.');
    // Local fallback implementation
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
  },

  // 5. Fetch My Bets & Payment Submissions
  async fetchMyBets(userId: string): Promise<Bet[]> {
    const client = getClient();
    if (!client) throw new Error('Sign in to view your bets.');
    const { user } = await this.getCurrentUser();
    if (!user) throw new Error('Sign in to view your bets.');
    if (userId !== user.id) throw new Error('You can only view your own bets.');
    const { data, error } = await client.schema('FLT').from('bets')
      .select('*, battle:battle_id(*), payment_submission:bet_payment_submissions(*)')
      .eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) throw new Error('Unable to load your bets right now.');
    return (data || []) as Bet[];
  },

  // 6. Fetch Admin Payment Submissions
  async fetchPaymentSubmissions(statusFilter?: 'pending' | 'approved' | 'rejected'): Promise<BetPaymentSubmission[]> {
    const client = getClient();
    if (!client || !(await this.checkIsAdmin())) throw new Error('Administrator access is required.');
    let query = client.schema('FLT').from('bet_payment_submissions')
      .select('*, bet:bet_id(*, battle:battle_id(*)), profile:user_id(username)')
      .order('created_at', { ascending: false });
    if (statusFilter) query = query.eq('status', statusFilter);
    const { data, error } = await query;
    if (error) throw new Error('Unable to load payment submissions.');
    return (data || []).map((d: any) => ({
      ...d, battle_title: d.bet?.battle?.title, emcee_a: d.bet?.battle?.emcee_a,
      emcee_b: d.bet?.battle?.emcee_b, side: d.bet?.side, bettor_username: d.profile?.username,
    }));
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

    throw new Error('Administrator actions require a live authenticated session.');
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

    throw new Error('Administrator actions require a live authenticated session.');
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

    throw new Error('Administrator actions require a live authenticated session.');
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
