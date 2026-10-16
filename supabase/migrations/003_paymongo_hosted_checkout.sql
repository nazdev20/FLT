-- PayMongo Hosted Checkout integration for FLT bets.
-- This migration changes only the quoted "FLT" schema.
-- Apply after the existing FLT core schema and battle-management migration.

ALTER TABLE "FLT".bet_payment_submissions
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paymongo_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS paymongo_checkout_url text,
  ADD COLUMN IF NOT EXISTS paymongo_payment_id text,
  ADD COLUMN IF NOT EXISTS paymongo_livemode boolean;

ALTER TABLE "FLT".bet_payment_submissions
  DROP CONSTRAINT IF EXISTS bet_payment_submissions_status_check;

ALTER TABLE "FLT".bet_payment_submissions
  ADD CONSTRAINT bet_payment_submissions_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'paid', 'failed'));

ALTER TABLE "FLT".bet_payment_submissions
  DROP CONSTRAINT IF EXISTS bet_payment_submissions_payment_status_check;

ALTER TABLE "FLT".bet_payment_submissions
  ADD CONSTRAINT bet_payment_submissions_payment_status_check
  CHECK (payment_status IN ('pending', 'paid', 'failed'));

CREATE UNIQUE INDEX IF NOT EXISTS bet_payment_submissions_paymongo_session_uidx
  ON "FLT".bet_payment_submissions(paymongo_checkout_session_id)
  WHERE paymongo_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bet_payment_submissions_paymongo_payment_uidx
  ON "FLT".bet_payment_submissions(paymongo_payment_id)
  WHERE paymongo_payment_id IS NOT NULL;

-- The server validates the user's Supabase access token before calling this RPC
-- with the service-role client. This function creates the bet and payment row atomically.
CREATE OR REPLACE FUNCTION "FLT".create_paymongo_bet(
  p_user_id uuid,
  p_battle_id uuid,
  p_side text,
  p_amount numeric,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_battle "FLT".battles%ROWTYPE;
  v_bet "FLT".bets%ROWTYPE;
  v_payment "FLT".bet_payment_submissions%ROWTYPE;
  v_reference text;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;
  IF p_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM "FLT".profiles WHERE id = p_user_id AND role = 'user'
  ) THEN
    RAISE EXCEPTION 'USER_NOT_ALLOWED_TO_BET';
  END IF;
  IF p_side NOT IN ('A', 'B') OR p_amount IS NULL
     OR p_amount < 10 OR p_amount > 100000
     OR p_amount <> ROUND(p_amount, 2) THEN
    RAISE EXCEPTION 'INVALID_BET_AMOUNT';
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 16 THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY';
  END IF;

  SELECT * INTO v_bet
  FROM "FLT".bets
  WHERE idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_bet.user_id <> p_user_id THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_CONFLICT';
    END IF;
    SELECT * INTO v_payment
    FROM "FLT".bet_payment_submissions
    WHERE bet_id = v_bet.id;
    RETURN jsonb_build_object(
      'bet_id', v_bet.id,
      'payment_id', v_payment.id,
      'payment_reference', v_payment.payment_reference,
      'checkout_url', v_payment.paymongo_checkout_url,
      'paymongo_livemode', v_payment.paymongo_livemode,
      'payment_status', v_payment.payment_status,
      'bet_status', v_bet.status,
      'reused', true
    );
  END IF;

  SELECT * INTO v_battle
  FROM "FLT".battles
  WHERE id = p_battle_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BATTLE_NOT_FOUND'; END IF;
  IF v_battle.status <> 'open' OR v_battle.betting_closes_at IS NULL
     OR now() >= v_battle.betting_closes_at THEN
    RAISE EXCEPTION 'BETTING_WINDOW_CLOSED';
  END IF;

  v_reference := 'FLT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));

  INSERT INTO "FLT".bets (
    battle_id, user_id, side, stake, status, idempotency_key
  ) VALUES (
    p_battle_id, p_user_id, p_side, p_amount, 'pending_verification', p_idempotency_key
  ) RETURNING * INTO v_bet;

  INSERT INTO "FLT".bet_payment_submissions (
    bet_id, user_id, amount, payment_reference, status, payment_status
  ) VALUES (
    v_bet.id, p_user_id, p_amount, v_reference, 'pending', 'pending'
  ) RETURNING * INTO v_payment;

  RETURN jsonb_build_object(
    'bet_id', v_bet.id,
    'payment_id', v_payment.id,
    'payment_reference', v_reference,
    'checkout_url', NULL,
    'paymongo_livemode', NULL,
    'payment_status', 'pending',
    'bet_status', v_bet.status,
    'reused', false
  );
END;
$$;

-- Called only after the webhook handler has verified the PayMongo signature,
-- retrieved the Checkout Session from PayMongo, and validated amount/currency/mode.
CREATE OR REPLACE FUNCTION "FLT".confirm_paymongo_bet_payment(
  p_payment_reference text,
  p_checkout_session_id text,
  p_paymongo_payment_id text,
  p_amount_minor bigint,
  p_currency text,
  p_livemode boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_payment "FLT".bet_payment_submissions%ROWTYPE;
  v_bet "FLT".bets%ROWTYPE;
  v_battle "FLT".battles%ROWTYPE;
  v_a numeric(12,2);
  v_b numeric(12,2);
  v_total numeric(12,2);
  v_fee numeric(12,2);
  v_distributable numeric(12,2);
  v_count integer;
  v_users integer;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;
  IF COALESCE(trim(p_payment_reference), '') = ''
     OR COALESCE(trim(p_checkout_session_id), '') = ''
     OR COALESCE(trim(p_paymongo_payment_id), '') = ''
     OR upper(COALESCE(p_currency, '')) <> 'PHP' THEN
    RAISE EXCEPTION 'INVALID_PAYMONGO_PAYMENT';
  END IF;

  SELECT * INTO v_payment
  FROM "FLT".bet_payment_submissions
  WHERE payment_reference = p_payment_reference
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_REFERENCE_NOT_FOUND'; END IF;

  IF v_payment.paymongo_checkout_session_id IS DISTINCT FROM p_checkout_session_id THEN
    RAISE EXCEPTION 'CHECKOUT_SESSION_MISMATCH';
  END IF;
  IF round(v_payment.amount * 100)::bigint <> p_amount_minor THEN
    RAISE EXCEPTION 'PAYMENT_AMOUNT_MISMATCH';
  END IF;
  IF v_payment.paymongo_livemode IS DISTINCT FROM p_livemode THEN
    RAISE EXCEPTION 'PAYMENT_MODE_MISMATCH';
  END IF;

  IF v_payment.payment_status = 'paid' THEN
    IF v_payment.paymongo_payment_id IS DISTINCT FROM p_paymongo_payment_id THEN
      RAISE EXCEPTION 'PAYMONGO_PAYMENT_ID_MISMATCH';
    END IF;
    SELECT * INTO v_bet FROM "FLT".bets WHERE id = v_payment.bet_id;
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'payment_status', 'paid',
      'bet_status', v_bet.status,
      'bet_id', v_bet.id
    );
  END IF;
  IF v_payment.payment_status <> 'pending' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_PENDING';
  END IF;

  SELECT * INTO v_bet FROM "FLT".bets WHERE id = v_payment.bet_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BET_NOT_FOUND'; END IF;
  SELECT * INTO v_battle FROM "FLT".battles WHERE id = v_bet.battle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BATTLE_NOT_FOUND'; END IF;

  UPDATE "FLT".bet_payment_submissions
  SET payment_status = 'paid',
      status = 'paid',
      paymongo_payment_id = p_paymongo_payment_id,
      review_note = CASE
        WHEN v_battle.status = 'open' AND now() < v_battle.betting_closes_at
          THEN 'Payment verified directly with PayMongo.'
        ELSE 'Payment verified by PayMongo after betting closed. Bet was not accepted; manual refund review is required.'
      END,
      reviewed_at = now()
  WHERE id = v_payment.id;

  IF v_battle.status <> 'open' OR v_battle.betting_closes_at IS NULL
     OR now() >= v_battle.betting_closes_at THEN
    UPDATE "FLT".bets
    SET status = 'rejected', settled_at = now()
    WHERE id = v_bet.id;
    RETURN jsonb_build_object(
      'success', true,
      'payment_status', 'paid',
      'bet_status', 'rejected',
      'refund_review_required', true,
      'bet_id', v_bet.id
    );
  END IF;

  UPDATE "FLT".bets
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_bet.id
  RETURNING * INTO v_bet;

  SELECT
    COALESCE(sum(stake) FILTER (WHERE side = 'A'), 0),
    COALESCE(sum(stake) FILTER (WHERE side = 'B'), 0),
    count(*),
    count(DISTINCT user_id)
  INTO v_a, v_b, v_count, v_users
  FROM "FLT".bets
  WHERE battle_id = v_bet.battle_id AND status = 'accepted';

  v_total := v_a + v_b;
  v_fee := round(v_total * v_battle.fee_rate, 2);
  v_distributable := v_total - v_fee;

  UPDATE "FLT".battles
  SET pool_a = v_a,
      pool_b = v_b,
      total_pool = v_total,
      accepted_bets_count = v_count,
      unique_bettors_count = v_users,
      platform_fee = v_fee,
      distributable_pool = v_distributable,
      odds_a = CASE WHEN v_a > 0 THEN trunc(v_distributable / v_a, 4) END,
      odds_b = CASE WHEN v_b > 0 THEN trunc(v_distributable / v_b, 4) END
  WHERE id = v_bet.battle_id;

  UPDATE "FLT".bets
  SET snapshot_pool_a = v_a,
      snapshot_pool_b = v_b,
      snapshot_total_pool = v_total,
      snapshot_distributable_pool = v_distributable,
      snapshot_indicative_odds = CASE
        WHEN v_bet.side = 'A' AND v_a > 0 THEN trunc(v_distributable / v_a, 4)
        WHEN v_bet.side = 'B' AND v_b > 0 THEN trunc(v_distributable / v_b, 4)
        ELSE NULL
      END
  WHERE id = v_bet.id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_status', 'paid',
    'bet_status', 'accepted',
    'refund_review_required', false,
    'bet_id', v_bet.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION "FLT".mark_paymongo_bet_failed(
  p_payment_reference text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_payment "FLT".bet_payment_submissions%ROWTYPE;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;

  SELECT * INTO v_payment
  FROM "FLT".bet_payment_submissions
  WHERE payment_reference = p_payment_reference
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_REFERENCE_NOT_FOUND'; END IF;

  IF v_payment.payment_status = 'pending' THEN
    UPDATE "FLT".bet_payment_submissions
    SET payment_status = 'failed',
        status = 'failed',
        review_note = left(COALESCE(NULLIF(trim(p_reason), ''), 'PayMongo checkout could not be created.'), 500),
        reviewed_at = now()
    WHERE id = v_payment.id;

    UPDATE "FLT".bets
    SET status = 'rejected', settled_at = now()
    WHERE id = v_payment.bet_id AND status = 'pending_verification';
  END IF;

  RETURN jsonb_build_object('success', true, 'payment_status', 'failed');
END;
$$;

-- Do not allow a manual admin review or client-side write to mark an unverified payment paid.
CREATE OR REPLACE FUNCTION "FLT".guard_paymongo_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $
BEGIN
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
     AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'PAYMONGO_VERIFICATION_REQUIRED';
  END IF;
  IF NEW.status = 'paid' AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'PAYMONGO_VERIFICATION_REQUIRED';
  END IF;
  IF NEW.status = 'paid' AND NEW.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'PAYMONGO_VERIFICATION_REQUIRED';
  END IF;
  IF NEW.status = 'approved' AND NEW.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'PAYMONGO_VERIFICATION_REQUIRED';
  END IF;
  RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS guard_paymongo_payment_status ON "FLT".bet_payment_submissions;
CREATE TRIGGER guard_paymongo_payment_status
BEFORE UPDATE OF status, payment_status ON "FLT".bet_payment_submissions
FOR EACH ROW
EXECUTE FUNCTION "FLT".guard_paymongo_payment_status();

-- Disable the former manual-reference submission path. New bets must use the server route.
REVOKE ALL ON FUNCTION "FLT".submit_bet_payment(uuid, text, numeric, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "FLT".review_bet_payment(uuid, boolean, text)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION "FLT".create_paymongo_bet(uuid, uuid, text, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "FLT".confirm_paymongo_bet_payment(text, text, text, bigint, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "FLT".mark_paymongo_bet_failed(text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION "FLT".create_paymongo_bet(uuid, uuid, text, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION "FLT".confirm_paymongo_bet_payment(text, text, text, bigint, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION "FLT".mark_paymongo_bet_failed(text, text) TO service_role;
