-- FLT-only battle administration: editable pre-bet matchups and official result recording.
-- This migration intentionally does not alter public or any other application schema.

ALTER TABLE "FLT".battles
  ADD COLUMN IF NOT EXISTS emcee_a_score integer,
  ADD COLUMN IF NOT EXISTS emcee_b_score integer;

CREATE OR REPLACE FUNCTION "FLT".update_battle(
  p_battle_id uuid,
  p_title text,
  p_emcee_a text,
  p_emcee_b text,
  p_emcee_a_photo_url text,
  p_emcee_b_photo_url text,
  p_starts_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_updated_id uuid;
BEGIN
  IF v_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM "FLT".profiles WHERE id = v_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Administrator access is required.';
  END IF;

  IF COALESCE(BTRIM(p_title), '') = '' OR COALESCE(BTRIM(p_emcee_a), '') = '' OR COALESCE(BTRIM(p_emcee_b), '') = '' THEN
    RAISE EXCEPTION 'Match title and both emcee names are required.';
  END IF;
  IF p_starts_at IS NULL OR p_starts_at <= NOW() + INTERVAL '1 hour' THEN
    RAISE EXCEPTION 'Battle start time must be at least one hour in the future.';
  END IF;

  UPDATE "FLT".battles b
  SET title = BTRIM(p_title),
      emcee_a = BTRIM(p_emcee_a),
      emcee_b = BTRIM(p_emcee_b),
      emcee_a_photo_url = COALESCE(NULLIF(BTRIM(COALESCE(p_emcee_a_photo_url, '')), ''), b.emcee_a_photo_url),
      emcee_b_photo_url = COALESCE(NULLIF(BTRIM(COALESCE(p_emcee_b_photo_url, '')), ''), b.emcee_b_photo_url),
      starts_at = p_starts_at,
      betting_closes_at = p_starts_at - INTERVAL '1 hour'
  WHERE b.id = p_battle_id
    AND b.status = 'open'
    AND NOT EXISTS (SELECT 1 FROM "FLT".bets bt WHERE bt.battle_id = b.id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Battle not found, not open, or already has bets. Matchups can only be edited before any bets are submitted.';
  END IF;

  RETURN jsonb_build_object('success', true, 'battle_id', p_battle_id);
END;
$$;

CREATE OR REPLACE FUNCTION "FLT".record_battle_result(
  p_battle_id uuid,
  p_winner_side text,
  p_emcee_a_score integer,
  p_emcee_b_score integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_battle "FLT".battles%ROWTYPE;
BEGIN
  IF v_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM "FLT".profiles WHERE id = v_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Administrator access is required.';
  END IF;

  IF p_winner_side NOT IN ('A', 'B') THEN
    RAISE EXCEPTION 'Winner side must be A or B.';
  END IF;
  IF p_emcee_a_score IS NULL OR p_emcee_b_score IS NULL OR p_emcee_a_score < 0 OR p_emcee_b_score < 0 THEN
    RAISE EXCEPTION 'Both scores must be non-negative whole numbers.';
  END IF;
  IF p_emcee_a_score = p_emcee_b_score THEN
    RAISE EXCEPTION 'A tied score cannot be recorded with a single winner.';
  END IF;
  IF (p_winner_side = 'A' AND p_emcee_a_score < p_emcee_b_score)
     OR (p_winner_side = 'B' AND p_emcee_b_score < p_emcee_a_score) THEN
    RAISE EXCEPTION 'Selected winner must match the higher score.';
  END IF;

  SELECT * INTO v_battle FROM "FLT".battles WHERE id = p_battle_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Battle not found.';
  END IF;
  IF v_battle.status <> 'locked' THEN
    RAISE EXCEPTION 'Lock betting after the battle before recording its official result.';
  END IF;

  UPDATE "FLT".battles
  SET emcee_a_score = p_emcee_a_score,
      emcee_b_score = p_emcee_b_score,
      winner_side = p_winner_side,
      status = 'settled',
      settled_at = NOW()
  WHERE id = p_battle_id;

  -- Intentionally no wallet, ledger, or payout mutation here. Manual payouts are a separate workflow.
  RETURN jsonb_build_object(
    'success', true,
    'battle_id', p_battle_id,
    'winner_side', p_winner_side,
    'emcee_a_score', p_emcee_a_score,
    'emcee_b_score', p_emcee_b_score,
    'status', 'settled',
    'payouts_processed', false
  );
END;
$$;

-- Keep the application's FLT schema calls aligned with the database objects.
-- Preserve the existing composite return types used by the frontend.
CREATE OR REPLACE FUNCTION "FLT".create_battle(
  p_title text,
  p_emcee_a text,
  p_emcee_b text,
  p_emcee_a_photo_url text,
  p_emcee_b_photo_url text,
  p_starts_at timestamptz
)
RETURNS "FLT".battles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_battle "FLT".battles;
BEGIN
  IF v_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM "FLT".profiles WHERE id = v_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Administrator access is required.';
  END IF;
  IF COALESCE(BTRIM(p_title), '') = '' OR COALESCE(BTRIM(p_emcee_a), '') = '' OR COALESCE(BTRIM(p_emcee_b), '') = '' THEN
    RAISE EXCEPTION 'Match title and both emcee names are required.';
  END IF;
  IF p_starts_at IS NULL OR p_starts_at <= NOW() + INTERVAL '1 hour' THEN
    RAISE EXCEPTION 'Battle start time must be at least one hour in the future.';
  END IF;

  INSERT INTO "FLT".battles (
    title, emcee_a, emcee_b, emcee_a_photo_url, emcee_b_photo_url,
    starts_at, betting_closes_at, status, fee_rate, created_by
  ) VALUES (
    BTRIM(p_title), BTRIM(p_emcee_a), BTRIM(p_emcee_b),
    COALESCE(NULLIF(BTRIM(COALESCE(p_emcee_a_photo_url, '')), ''), 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=400&auto=format&fit=crop&q=80'),
    COALESCE(NULLIF(BTRIM(COALESCE(p_emcee_b_photo_url, '')), ''), 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80'),
    p_starts_at, p_starts_at - INTERVAL '1 hour', 'open', 0.1000, v_admin_id
  ) RETURNING * INTO v_battle;

  RETURN v_battle;
END;
$$;

CREATE OR REPLACE FUNCTION "FLT".lock_battle(p_battle_id uuid)
RETURNS "FLT".battles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_battle "FLT".battles;
BEGIN
  IF v_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM "FLT".profiles WHERE id = v_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Administrator access is required.';
  END IF;
  SELECT * INTO v_battle FROM "FLT".battles WHERE id = p_battle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Battle not found.'; END IF;
  IF v_battle.status = 'open' THEN
    UPDATE "FLT".battles SET status = 'locked', locked_at = NOW()
    WHERE id = p_battle_id RETURNING * INTO v_battle;
  END IF;
  RETURN v_battle;
END;
$$;

-- Prevent admin accounts from creating wagers even when the RPC is called directly.
CREATE OR REPLACE FUNCTION "FLT".submit_bet_payment(
  p_battle_id uuid,
  p_side text,
  p_amount numeric,
  p_idempotency_key text,
  p_payment_reference text,
  p_receipt_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_battle "FLT".battles;
  v_bet "FLT".bets;
  v_payment "FLT".bet_payment_submissions;
BEGIN
  PERFORM set_config('lock_timeout', '3s', true);
  PERFORM set_config('statement_timeout', '5s', true);
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF EXISTS (SELECT 1 FROM "FLT".profiles WHERE id = v_user_id AND role = 'admin') THEN
    RAISE EXCEPTION 'ADMINS_CANNOT_BET';
  END IF;
  IF p_idempotency_key IS NULL OR LENGTH(TRIM(p_idempotency_key)) < 8 THEN RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY'; END IF;
  IF p_payment_reference IS NULL OR LENGTH(TRIM(p_payment_reference)) < 4 THEN RAISE EXCEPTION 'PAYMENT_REFERENCE_REQUIRED'; END IF;
  IF p_side NOT IN ('A', 'B') OR p_amount IS NULL OR p_amount <= 0 OR p_amount <> ROUND(p_amount, 2) THEN RAISE EXCEPTION 'INVALID_BET'; END IF;

  SELECT * INTO v_bet FROM "FLT".bets WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_bet.user_id <> v_user_id THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_CONFLICT'; END IF;
    SELECT * INTO v_payment FROM "FLT".bet_payment_submissions WHERE bet_id = v_bet.id;
    RETURN jsonb_build_object('bet', to_jsonb(v_bet), 'payment', to_jsonb(v_payment));
  END IF;

  SELECT * INTO v_battle FROM "FLT".battles WHERE id = p_battle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BATTLE_NOT_FOUND'; END IF;
  IF v_battle.status = 'open' AND (v_battle.betting_closes_at IS NULL OR NOW() >= v_battle.betting_closes_at) THEN
    UPDATE "FLT".battles SET status = 'locked', locked_at = COALESCE(betting_closes_at, NOW()) WHERE id = p_battle_id;
    RAISE EXCEPTION 'BETTING_WINDOW_CLOSED';
  END IF;
  IF v_battle.status <> 'open' THEN RAISE EXCEPTION 'BATTLE_NOT_OPEN'; END IF;

  INSERT INTO "FLT".bets(battle_id, user_id, side, stake, status, idempotency_key)
    VALUES(p_battle_id, v_user_id, p_side, p_amount, 'pending_verification', p_idempotency_key)
    RETURNING * INTO v_bet;
  INSERT INTO "FLT".bet_payment_submissions(bet_id, user_id, amount, payment_reference, receipt_url)
    VALUES(v_bet.id, v_user_id, p_amount, TRIM(p_payment_reference), NULLIF(TRIM(p_receipt_url), ''))
    RETURNING * INTO v_payment;

  RETURN jsonb_build_object('bet', to_jsonb(v_bet), 'payment', to_jsonb(v_payment), 'message', 'Payment submitted for admin verification; this bet is not yet in the pool.');
END;
$$;

REVOKE ALL ON FUNCTION "FLT".create_battle(text, text, text, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "FLT".submit_bet_payment(uuid, text, numeric, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION "FLT".lock_battle(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION "FLT".update_battle(uuid, text, text, text, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "FLT".record_battle_result(uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "FLT".create_battle(text, text, text, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION "FLT".submit_bet_payment(uuid, text, numeric, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION "FLT".lock_battle(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "FLT".update_battle(uuid, text, text, text, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION "FLT".record_battle_result(uuid, text, integer, integer) TO authenticated;
