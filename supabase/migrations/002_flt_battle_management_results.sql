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
  IF p_starts_at IS NULL OR p_starts_at <= NOW() THEN
    RAISE EXCEPTION 'Battle start time must be in the future.';
  END IF;

  UPDATE "FLT".battles b
  SET title = BTRIM(p_title),
      emcee_a = BTRIM(p_emcee_a),
      emcee_b = BTRIM(p_emcee_b),
      emcee_a_photo_url = NULLIF(BTRIM(COALESCE(p_emcee_a_photo_url, '')), ''),
      emcee_b_photo_url = NULLIF(BTRIM(COALESCE(p_emcee_b_photo_url, '')), ''),
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

REVOKE ALL ON FUNCTION "FLT".update_battle(uuid, text, text, text, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION "FLT".record_battle_result(uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "FLT".update_battle(uuid, text, text, text, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION "FLT".record_battle_result(uuid, text, integer, integer) TO authenticated;
