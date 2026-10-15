-- ==============================================================================
-- PARI-MUTUEL BATTLE WAGERING ENGINE - PRODUCTION SUPABASE SQL MIGRATION
-- Framework: PostgreSQL 15+ / Supabase Auth / Storage / Realtime / RPC
-- Security: Anon-Safe, Zero-Client Trust, Strict RLS Lockdown, Atomic RPCs
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PUBLIC TABLES

-- Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wallets Table (Simulated balance only, no negative balances allowed)
CREATE TABLE IF NOT EXISTS public.wallets (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    simulated_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (simulated_balance >= 0.00),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mock Credit Requests (Top-up requests requiring admin review)
CREATE TABLE IF NOT EXISTS public.mock_credit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0.00),
    mock_reference_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Battles Table
CREATE TABLE IF NOT EXISTS public.battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    emcee_a TEXT NOT NULL,
    emcee_b TEXT NOT NULL,
    emcee_a_photo_url TEXT NOT NULL,
    emcee_b_photo_url TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    betting_closes_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'settled', 'cancelled')),
    fee_rate NUMERIC(5,4) NOT NULL DEFAULT 0.1000 CHECK (fee_rate = 0.1000),
    winner_side TEXT CHECK (winner_side IN ('A', 'B')),
    cancellation_reason TEXT,
    locked_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_betting_closes_one_hour_before CHECK (betting_closes_at = starts_at - INTERVAL '1 hour')
);

-- Bets Table
CREATE TABLE IF NOT EXISTS public.bets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    battle_id UUID NOT NULL REFERENCES public.battles(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    side TEXT NOT NULL CHECK (side IN ('A', 'B')),
    stake NUMERIC(12,2) NOT NULL CHECK (stake > 0.00),
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'refunded', 'settled_won', 'settled_lost')),
    idempotency_key TEXT NOT NULL UNIQUE,
    accepted_at TIMESTAMPTZ,
    snapshot_pool_a NUMERIC(12,2),
    snapshot_pool_b NUMERIC(12,2),
    snapshot_total_pool NUMERIC(12,2),
    snapshot_indicative_odds NUMERIC(10,4),
    gross_payout NUMERIC(12,2) DEFAULT 0.00,
    net_profit NUMERIC(12,2) DEFAULT 0.00,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Battle Settlements Table (Official audit record of settled or cancelled battle pools)
CREATE TABLE IF NOT EXISTS public.battle_settlements (
    battle_id UUID PRIMARY KEY REFERENCES public.battles(id) ON DELETE RESTRICT,
    idempotency_key TEXT NOT NULL UNIQUE,
    outcome_type TEXT NOT NULL CHECK (outcome_type IN ('settled', 'cancelled_refunded')),
    winner_side TEXT CHECK (winner_side IN ('A', 'B')),
    pool_a NUMERIC(12,2) NOT NULL,
    pool_b NUMERIC(12,2) NOT NULL,
    total_pool NUMERIC(12,2) NOT NULL,
    platform_fee NUMERIC(12,2) NOT NULL,
    distributable_pool NUMERIC(12,2) NOT NULL,
    total_payouts NUMERIC(12,2) NOT NULL,
    rounding_remainder_allocated NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ledger Entries Table (Double-entry financial audit record)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id), -- NULL for platform fee entries
    battle_id UUID REFERENCES public.battles(id),
    bet_id UUID REFERENCES public.bets(id),
    entry_type TEXT NOT NULL CHECK (entry_type IN ('mock_credit_approved', 'bet_stake_reserve', 'bet_payout', 'bet_refund', 'platform_fee')),
    amount NUMERIC(12,2) NOT NULL,
    balance_after NUMERIC(12,2),
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. STORAGE BUCKET CONFIGURATION (emcee-photos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('emcee-photos', 'emcee-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "Public Read emcee-photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'emcee-photos');

CREATE POLICY "Admin Upload emcee-photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'emcee-photos' AND
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 4. ROW LEVEL SECURITY (RLS) LOCKDOWN
-- ZERO client direct INSERT/UPDATE/DELETE. Writes are strictly channeled through Security Definer RPCs.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_credit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone can read usernames/roles; user can read own
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);

-- Wallets: Users can only see their own wallet; Admins can view all
DROP POLICY IF EXISTS "wallets_select_own" ON public.wallets;
CREATE POLICY "wallets_select_own" ON public.wallets FOR SELECT
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Mock Credit Requests: User can see own requests; Admins can see all
DROP POLICY IF EXISTS "mock_credit_select" ON public.mock_credit_requests;
CREATE POLICY "mock_credit_select" ON public.mock_credit_requests FOR SELECT
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Battles: Public can view all battles
DROP POLICY IF EXISTS "battles_select_public" ON public.battles;
CREATE POLICY "battles_select_public" ON public.battles FOR SELECT USING (true);

-- Bets: Users can view their own bets; Admins can view all bets (anonymized pools public via RPC)
DROP POLICY IF EXISTS "bets_select_own" ON public.bets;
CREATE POLICY "bets_select_own" ON public.bets FOR SELECT
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Battle Settlements: Publicly readable for audit verification
DROP POLICY IF EXISTS "settlements_select_public" ON public.battle_settlements;
CREATE POLICY "settlements_select_public" ON public.battle_settlements FOR SELECT USING (true);

-- Ledger Entries: Users can see own transactions; Admins can see all transactions
DROP POLICY IF EXISTS "ledger_select_own" ON public.ledger_entries;
CREATE POLICY "ledger_select_own" ON public.ledger_entries FOR SELECT
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 5. TRIGGER: AUTOMATIC PROFILE & WALLET CREATION FOR NEW USERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, username, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        'user'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.wallets (user_id, simulated_balance)
    VALUES (NEW.id, 0.00)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. SECURITY DEFINER RPC FUNCTIONS (ANON-SAFE FINANCIAL LOGIC)

-- RPC 1: Request Mock Credit (User submits simulated reference code)
CREATE OR REPLACE FUNCTION public.request_mock_credit(
    p_amount NUMERIC,
    p_reference_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_req_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF p_amount <= 0.00 THEN
        RAISE EXCEPTION 'Amount must be greater than zero.';
    END IF;

    IF TRIM(p_reference_code) = '' THEN
        RAISE EXCEPTION 'Reference code is required.';
    END IF;

    INSERT INTO public.mock_credit_requests (user_id, amount, mock_reference_code, status)
    VALUES (v_user_id, ROUND(p_amount, 2), TRIM(p_reference_code), 'pending')
    RETURNING id INTO v_req_id;

    RETURN jsonb_build_object('success', true, 'request_id', v_req_id, 'status', 'pending');
END;
$$;

-- RPC 2: Approve Mock Credit (Admin only; credits simulated_balance with row lock)
CREATE OR REPLACE FUNCTION public.approve_mock_credit(
    p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_req RECORD;
    v_new_balance NUMERIC(12,2);
    v_idempotency TEXT;
BEGIN
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Administrator privileges required.';
    END IF;

    SELECT * INTO v_req
    FROM public.mock_credit_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mock credit request not found.';
    END IF;

    IF v_req.status != 'pending' THEN
        RAISE EXCEPTION 'Request has already been processed (status: %).', v_req.status;
    END IF;

    UPDATE public.wallets
    SET simulated_balance = simulated_balance + v_req.amount,
        updated_at = NOW()
    WHERE user_id = v_req.user_id
    RETURNING simulated_balance INTO v_new_balance;

    UPDATE public.mock_credit_requests
    SET status = 'approved',
        reviewed_by = v_admin_id,
        reviewed_at = NOW()
    WHERE id = p_request_id;

    v_idempotency := 'mock_credit_' || p_request_id::text;

    INSERT INTO public.ledger_entries (
        user_id,
        entry_type,
        amount,
        balance_after,
        idempotency_key
    ) VALUES (
        v_req.user_id,
        'mock_credit_approved',
        v_req.amount,
        v_new_balance,
        v_idempotency
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'user_id', v_req.user_id,
        'credited_amount', v_req.amount,
        'new_balance', v_new_balance
    );
END;
$$;

-- RPC 3: Reject Mock Credit (Admin only)
CREATE OR REPLACE FUNCTION public.reject_mock_credit(
    p_request_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
BEGIN
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Administrator privileges required.';
    END IF;

    UPDATE public.mock_credit_requests
    SET status = 'rejected',
        reviewed_by = v_admin_id,
        reviewed_at = NOW()
    WHERE id = p_request_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or not in pending status.';
    END IF;

    RETURN jsonb_build_object('success', true, 'request_id', p_request_id, 'status', 'rejected');
END;
$$;

-- RPC 4: Create Battle (Admin only; enforces betting_closes_at 1 hour prior to starts_at)
CREATE OR REPLACE FUNCTION public.create_battle(
    p_title TEXT,
    p_emcee_a TEXT,
    p_emcee_b TEXT,
    p_emcee_a_photo_url TEXT,
    p_emcee_b_photo_url TEXT,
    p_starts_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_battle_id UUID;
    v_betting_closes_at TIMESTAMPTZ;
BEGIN
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Administrator privileges required.';
    END IF;

    IF p_starts_at <= NOW() THEN
        RAISE EXCEPTION 'Battle start time must be in the future.';
    END IF;

    v_betting_closes_at := p_starts_at - INTERVAL '1 hour';

    INSERT INTO public.battles (
        title,
        emcee_a,
        emcee_b,
        emcee_a_photo_url,
        emcee_b_photo_url,
        starts_at,
        betting_closes_at,
        status,
        fee_rate,
        created_by
    ) VALUES (
        TRIM(p_title),
        TRIM(p_emcee_a),
        TRIM(p_emcee_b),
        TRIM(p_emcee_a_photo_url),
        TRIM(p_emcee_b_photo_url),
        p_starts_at,
        v_betting_closes_at,
        'open',
        0.1000,
        v_admin_id
    )
    RETURNING id INTO v_battle_id;

    RETURN jsonb_build_object(
        'success', true,
        'battle_id', v_battle_id,
        'betting_closes_at', v_betting_closes_at
    );
END;
$$;

-- RPC 5: Place Bet (Zero client trust: reads auth.uid(), checks status & closes_at, locks wallet, snapshots odds)
CREATE OR REPLACE FUNCTION public.place_bet(
    p_battle_id UUID,
    p_side TEXT,
    p_stake NUMERIC,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_battle RECORD;
    v_balance NUMERIC(12,2);
    v_bet_id UUID;
    v_pool_a NUMERIC(12,2) := 0.00;
    v_pool_b NUMERIC(12,2) := 0.00;
    v_total_pool NUMERIC(12,2) := 0.00;
    v_distributable NUMERIC(12,2) := 0.00;
    v_indicative_odds NUMERIC(10,4) := 0.0000;
    v_new_balance NUMERIC(12,2);
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF p_side NOT IN ('A', 'B') THEN
        RAISE EXCEPTION 'Invalid side. Choose A or B.';
    END IF;

    IF p_stake <= 0.00 THEN
        RAISE EXCEPTION 'Stake must be greater than zero.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.bets WHERE idempotency_key = p_idempotency_key) THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Bet already processed (idempotent)',
            'idempotency_key', p_idempotency_key
        );
    END IF;

    SELECT * INTO v_battle
    FROM public.battles
    WHERE id = p_battle_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Battle not found.';
    END IF;

    IF v_battle.status != 'open' THEN
        RAISE EXCEPTION 'Battle is not open for wagering (status: %).', v_battle.status;
    END IF;

    IF NOW() >= v_battle.betting_closes_at THEN
        RAISE EXCEPTION 'Betting has closed for this battle.';
    END IF;

    SELECT simulated_balance INTO v_balance
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF v_balance < p_stake THEN
        RAISE EXCEPTION 'Insufficient simulated balance. Current: %, Stake: %', v_balance, p_stake;
    END IF;

    UPDATE public.wallets
    SET simulated_balance = simulated_balance - p_stake,
        updated_at = NOW()
    WHERE user_id = v_user_id
    RETURNING simulated_balance INTO v_new_balance;

    SELECT
        COALESCE(SUM(CASE WHEN side = 'A' THEN stake ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN side = 'B' THEN stake ELSE 0 END), 0.00)
    INTO v_pool_a, v_pool_b
    FROM public.bets
    WHERE battle_id = p_battle_id AND status = 'accepted';

    IF p_side = 'A' THEN
        v_pool_a := v_pool_a + p_stake;
    ELSE
        v_pool_b := v_pool_b + p_stake;
    END IF;

    v_total_pool := v_pool_a + v_pool_b;
    v_distributable := v_total_pool * (1.0000 - v_battle.fee_rate);

    IF p_side = 'A' AND v_pool_a > 0 THEN
        v_indicative_odds := ROUND((v_distributable / v_pool_a), 4);
    ELSIF p_side = 'B' AND v_pool_b > 0 THEN
        v_indicative_odds := ROUND((v_distributable / v_pool_b), 4);
    END IF;

    INSERT INTO public.bets (
        battle_id,
        user_id,
        side,
        stake,
        status,
        idempotency_key,
        accepted_at,
        snapshot_pool_a,
        snapshot_pool_b,
        snapshot_total_pool,
        snapshot_indicative_odds
    ) VALUES (
        p_battle_id,
        v_user_id,
        p_side,
        p_stake,
        'accepted',
        p_idempotency_key,
        NOW(),
        v_pool_a,
        v_pool_b,
        v_total_pool,
        v_indicative_odds
    )
    RETURNING id INTO v_bet_id;

    INSERT INTO public.ledger_entries (
        user_id,
        battle_id,
        bet_id,
        entry_type,
        amount,
        balance_after,
        idempotency_key
    ) VALUES (
        v_user_id,
        p_battle_id,
        v_bet_id,
        'bet_stake_reserve',
        -p_stake,
        v_new_balance,
        'reserve_' || p_idempotency_key
    );

    RETURN jsonb_build_object(
        'success', true,
        'bet_id', v_bet_id,
        'battle_id', p_battle_id,
        'stake', p_stake,
        'side', p_side,
        'snapshot_indicative_odds', v_indicative_odds,
        'new_balance', v_new_balance
    );
END;
$$;

-- RPC 6: Lock Battle
CREATE OR REPLACE FUNCTION public.lock_battle(
    p_battle_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
BEGIN
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Administrator privileges required.';
    END IF;

    UPDATE public.battles
    SET status = 'locked',
        locked_at = NOW()
    WHERE id = p_battle_id AND status = 'open';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Battle not found or cannot be locked.';
    END IF;

    RETURN jsonb_build_object('success', true, 'battle_id', p_battle_id, 'status', 'locked');
END;
$$;

-- RPC 7: Settle Battle
CREATE OR REPLACE FUNCTION public.settle_battle(
    p_battle_id UUID,
    p_winner_side TEXT,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_battle RECORD;
    v_pool_a NUMERIC(12,2) := 0.00;
    v_pool_b NUMERIC(12,2) := 0.00;
    v_total_pool NUMERIC(12,2) := 0.00;
    v_platform_fee NUMERIC(12,2) := 0.00;
    v_distributable_pool NUMERIC(12,2) := 0.00;
    v_winning_pool NUMERIC(12,2) := 0.00;
    v_total_payouts NUMERIC(12,2) := 0.00;
    v_remainder NUMERIC(12,2) := 0.00;
    v_bet RECORD;
    v_user_share NUMERIC;
    v_raw_payout NUMERIC;
    v_gross_payout NUMERIC(12,2);
    v_net_profit NUMERIC(12,2);
    v_new_balance NUMERIC(12,2);
BEGIN
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Administrator privileges required.';
    END IF;

    IF p_winner_side NOT IN ('A', 'B') THEN
        RAISE EXCEPTION 'Winner side must be A or B.';
    END IF;

    SELECT * INTO v_battle
    FROM public.battles
    WHERE id = p_battle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Battle not found.';
    END IF;

    IF v_battle.status NOT IN ('open', 'locked') THEN
        RAISE EXCEPTION 'Battle status is %, cannot settle.', v_battle.status;
    END IF;

    IF EXISTS (SELECT 1 FROM public.battle_settlements WHERE idempotency_key = p_idempotency_key) THEN
        RETURN jsonb_build_object('success', true, 'message', 'Settlement already executed (idempotent)');
    END IF;

    SELECT
        COALESCE(SUM(CASE WHEN side = 'A' THEN stake ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN side = 'B' THEN stake ELSE 0 END), 0.00)
    INTO v_pool_a, v_pool_b
    FROM public.bets
    WHERE battle_id = p_battle_id AND status = 'accepted';

    v_total_pool := v_pool_a + v_pool_b;
    v_winning_pool := CASE WHEN p_winner_side = 'A' THEN v_pool_a ELSE v_pool_b END;

    IF v_total_pool = 0.00 OR v_winning_pool = 0.00 THEN
        FOR v_bet IN
            SELECT * FROM public.bets WHERE battle_id = p_battle_id AND status = 'accepted' FOR UPDATE
        LOOP
            UPDATE public.wallets
            SET simulated_balance = simulated_balance + v_bet.stake,
                updated_at = NOW()
            WHERE user_id = v_bet.user_id
            RETURNING simulated_balance INTO v_new_balance;

            UPDATE public.bets
            SET status = 'refunded',
                settled_at = NOW()
            WHERE id = v_bet.id;

            INSERT INTO public.ledger_entries (
                user_id, battle_id, bet_id, entry_type, amount, balance_after, idempotency_key
            ) VALUES (
                v_bet.user_id, p_battle_id, v_bet.id, 'bet_refund', v_bet.stake, v_new_balance,
                'refund_' || v_bet.id::text || '_' || p_idempotency_key
            );
        END LOOP;

        UPDATE public.battles
        SET status = 'cancelled',
            winner_side = NULL,
            cancellation_reason = 'Zero winning pool - Full refund distributed',
            settled_at = NOW()
        WHERE id = p_battle_id;

        INSERT INTO public.battle_settlements (
            battle_id, idempotency_key, outcome_type, winner_side, pool_a, pool_b,
            total_pool, platform_fee, distributable_pool, total_payouts, rounding_remainder_allocated
        ) VALUES (
            p_battle_id, p_idempotency_key, 'cancelled_refunded', NULL, v_pool_a, v_pool_b,
            v_total_pool, 0.00, 0.00, v_total_pool, 0.00
        );

        RETURN jsonb_build_object(
            'success', true,
            'outcome_type', 'cancelled_refunded',
            'reason', 'No winning bets found. All stakes refunded.'
        );
    END IF;

    v_platform_fee := ROUND(v_total_pool * v_battle.fee_rate, 2);
    v_distributable_pool := v_total_pool - v_platform_fee;

    INSERT INTO public.ledger_entries (
        user_id, battle_id, bet_id, entry_type, amount, balance_after, idempotency_key
    ) VALUES (
        NULL, p_battle_id, NULL, 'platform_fee', v_platform_fee, NULL,
        'fee_' || p_battle_id::text || '_' || p_idempotency_key
    );

    FOR v_bet IN
        SELECT * FROM public.bets WHERE battle_id = p_battle_id AND status = 'accepted' AND side = p_winner_side FOR UPDATE
    LOOP
        v_user_share := v_bet.stake / v_winning_pool;
        v_raw_payout := v_user_share * v_distributable_pool;
        v_gross_payout := TRUNC(v_raw_payout, 2);
        v_net_profit := v_gross_payout - v_bet.stake;

        v_total_payouts := v_total_payouts + v_gross_payout;

        UPDATE public.wallets
        SET simulated_balance = simulated_balance + v_gross_payout,
            updated_at = NOW()
        WHERE user_id = v_bet.user_id
        RETURNING simulated_balance INTO v_new_balance;

        UPDATE public.bets
        SET status = 'settled_won',
            gross_payout = v_gross_payout,
            net_profit = v_net_profit,
            settled_at = NOW()
        WHERE id = v_bet.id;

        INSERT INTO public.ledger_entries (
            user_id, battle_id, bet_id, entry_type, amount, balance_after, idempotency_key
        ) VALUES (
            v_bet.user_id, p_battle_id, v_bet.id, 'bet_payout', v_gross_payout, v_new_balance,
            'payout_' || v_bet.id::text || '_' || p_idempotency_key
        );
    END LOOP;

    UPDATE public.bets
    SET status = 'settled_lost',
        gross_payout = 0.00,
        net_profit = -stake,
        settled_at = NOW()
    WHERE battle_id = p_battle_id AND status = 'accepted' AND side != p_winner_side;

    v_remainder := v_distributable_pool - v_total_payouts;

    INSERT INTO public.battle_settlements (
        battle_id,
        idempotency_key,
        outcome_type,
        winner_side,
        pool_a,
        pool_b,
        total_pool,
        platform_fee,
        distributable_pool,
        total_payouts,
        rounding_remainder_allocated
    ) VALUES (
        p_battle_id,
        p_idempotency_key,
        'settled',
        p_winner_side,
        v_pool_a,
        v_pool_b,
        v_total_pool,
        v_platform_fee,
        v_distributable_pool,
        v_total_payouts,
        v_remainder
    );

    UPDATE public.battles
    SET status = 'settled',
        winner_side = p_winner_side,
        settled_at = NOW()
    WHERE id = p_battle_id;

    RETURN jsonb_build_object(
        'success', true,
        'battle_id', p_battle_id,
        'winner_side', p_winner_side,
        'total_pool', v_total_pool,
        'platform_fee', v_platform_fee,
        'distributable_pool', v_distributable_pool,
        'total_payouts', v_total_payouts,
        'rounding_remainder', v_remainder
    );
END;
$$;

-- RPC 8: Cancel & Refund Battle
CREATE OR REPLACE FUNCTION public.cancel_battle(
    p_battle_id UUID,
    p_reason TEXT,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_bet RECORD;
    v_new_balance NUMERIC(12,2);
    v_total_refunded NUMERIC(12,2) := 0.00;
BEGIN
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Administrator privileges required.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.battle_settlements WHERE idempotency_key = p_idempotency_key) THEN
        RETURN jsonb_build_object('success', true, 'message', 'Cancellation already processed (idempotent)');
    END IF;

    FOR v_bet IN
        SELECT * FROM public.bets WHERE battle_id = p_battle_id AND status = 'accepted' FOR UPDATE
    LOOP
        UPDATE public.wallets
        SET simulated_balance = simulated_balance + v_bet.stake,
            updated_at = NOW()
        WHERE user_id = v_bet.user_id
        RETURNING simulated_balance INTO v_new_balance;

        UPDATE public.bets
        SET status = 'refunded',
            settled_at = NOW()
        WHERE id = v_bet.id;

        v_total_refunded := v_total_refunded + v_bet.stake;

        INSERT INTO public.ledger_entries (
            user_id, battle_id, bet_id, entry_type, amount, balance_after, idempotency_key
        ) VALUES (
            v_bet.user_id, p_battle_id, v_bet.id, 'bet_refund', v_bet.stake, v_new_balance,
            'refund_' || v_bet.id::text || '_' || p_idempotency_key
        );
    END LOOP;

    UPDATE public.battles
    SET status = 'cancelled',
        cancellation_reason = p_reason,
        settled_at = NOW()
    WHERE id = p_battle_id;

    INSERT INTO public.battle_settlements (
        battle_id, idempotency_key, outcome_type, winner_side, pool_a, pool_b,
        total_pool, platform_fee, distributable_pool, total_payouts, rounding_remainder_allocated
    ) VALUES (
        p_battle_id, p_idempotency_key, 'cancelled_refunded', NULL, 0.00, 0.00,
        v_total_refunded, 0.00, 0.00, v_total_refunded, 0.00
    );

    RETURN jsonb_build_object(
        'success', true,
        'battle_id', p_battle_id,
        'status', 'cancelled',
        'total_refunded', v_total_refunded
    );
END;
$$;

-- RPC 9: Public helper to read active pool totals and indicative odds
CREATE OR REPLACE FUNCTION public.get_battle_odds(
    p_battle_id UUID
)
RETURNS TABLE (
    pool_a NUMERIC(12,2),
    pool_b NUMERIC(12,2),
    total_pool NUMERIC(12,2),
    distributable_pool NUMERIC(12,2),
    odds_a NUMERIC(10,4),
    odds_b NUMERIC(10,4),
    bets_count_a BIGINT,
    bets_count_b BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH pool_data AS (
        SELECT
            COALESCE(SUM(CASE WHEN side = 'A' THEN stake ELSE 0 END), 0.00) AS raw_pool_a,
            COALESCE(SUM(CASE WHEN side = 'B' THEN stake ELSE 0 END), 0.00) AS raw_pool_b,
            COUNT(CASE WHEN side = 'A' THEN 1 END) AS count_a,
            COUNT(CASE WHEN side = 'B' THEN 1 END) AS count_b
        FROM public.bets
        WHERE battle_id = p_battle_id AND status IN ('accepted', 'settled_won', 'settled_lost')
    ),
    calcs AS (
        SELECT
            raw_pool_a,
            raw_pool_b,
            (raw_pool_a + raw_pool_b) AS calc_total,
            ((raw_pool_a + raw_pool_b) * 0.9000) AS calc_distributable,
            count_a,
            count_b
        FROM pool_data
    )
    SELECT
        raw_pool_a,
        raw_pool_b,
        calc_total,
        calc_distributable,
        CASE WHEN raw_pool_a > 0 THEN ROUND((calc_distributable / raw_pool_a), 4) ELSE 0.0000 END,
        CASE WHEN raw_pool_b > 0 THEN ROUND((calc_distributable / raw_pool_b), 4) ELSE 0.0000 END,
        count_a,
        count_b
    FROM calcs;
$$;

-- 7. SUPABASE REALTIME CONFIGURATION
ALTER PUBLICATION supabase_realtime ADD TABLE public.battles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mock_credit_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ledger_entries;
