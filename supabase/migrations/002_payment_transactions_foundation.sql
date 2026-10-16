-- FLT payment transaction foundation.
-- This migration records payment lifecycle separately from the bet lifecycle.
-- It does not connect a payment provider or enable real-money processing.

CREATE TABLE IF NOT EXISTS "FLT".transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bet_id UUID NOT NULL REFERENCES "FLT".bets(id) ON DELETE RESTRICT,
    payment_submission_id UUID NOT NULL UNIQUE
        REFERENCES "FLT".bet_payment_submissions(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'PHP' CHECK (currency = 'PHP'),
    provider TEXT NOT NULL DEFAULT 'manual_transfer'
        CHECK (provider IN ('manual_transfer', 'sandbox', 'paymongo')),
    provider_reference TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled', 'expired', 'refunded')),
    status_source TEXT NOT NULL DEFAULT 'manual_review'
        CHECK (status_source IN ('manual_review', 'provider_webhook', 'provider_api', 'system')),
    failure_reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    paid_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_user_created_idx
    ON "FLT".transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS transactions_status_created_idx
    ON "FLT".transactions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS transactions_bet_id_idx
    ON "FLT".transactions (bet_id);

ALTER TABLE "FLT".transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transactions_select_own ON "FLT".transactions;
CREATE POLICY transactions_select_own
    ON "FLT".transactions FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM "FLT".profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- The browser may read its own transactions, but cannot create or alter payment records.
REVOKE INSERT, UPDATE, DELETE ON "FLT".transactions FROM anon, authenticated;
GRANT SELECT ON "FLT".transactions TO authenticated;

CREATE OR REPLACE FUNCTION "FLT".sync_transaction_from_payment_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_transaction_status TEXT;
    v_status_source TEXT := 'manual_review';
BEGIN
    v_transaction_status := CASE NEW.status
        WHEN 'approved' THEN 'succeeded'
        WHEN 'rejected' THEN 'failed'
        ELSE 'pending'
    END;

    INSERT INTO "FLT".transactions (
        bet_id,
        payment_submission_id,
        user_id,
        amount,
        provider,
        provider_reference,
        status,
        status_source,
        failure_reason,
        paid_at,
        failed_at,
        metadata
    ) VALUES (
        NEW.bet_id,
        NEW.id,
        NEW.user_id,
        NEW.amount,
        'manual_transfer',
        NULLIF(BTRIM(NEW.payment_reference), ''),
        v_transaction_status,
        v_status_source,
        CASE WHEN NEW.status = 'rejected' THEN NULLIF(BTRIM(NEW.review_note), '') ELSE NULL END,
        CASE WHEN NEW.status = 'approved' THEN COALESCE(NEW.reviewed_at, NOW()) ELSE NULL END,
        CASE WHEN NEW.status = 'rejected' THEN COALESCE(NEW.reviewed_at, NOW()) ELSE NULL END,
        jsonb_build_object('source', 'bet_payment_submissions')
    )
    ON CONFLICT (payment_submission_id) DO UPDATE
    SET status = CASE
            WHEN "FLT".transactions.status_source IN ('provider_webhook', 'provider_api')
                THEN "FLT".transactions.status
            ELSE EXCLUDED.status
        END,
        status_source = CASE
            WHEN "FLT".transactions.status_source IN ('provider_webhook', 'provider_api')
                THEN "FLT".transactions.status_source
            ELSE EXCLUDED.status_source
        END,
        provider_reference = COALESCE(EXCLUDED.provider_reference, "FLT".transactions.provider_reference),
        failure_reason = CASE
            WHEN "FLT".transactions.status_source IN ('provider_webhook', 'provider_api')
                THEN "FLT".transactions.failure_reason
            ELSE EXCLUDED.failure_reason
        END,
        paid_at = CASE
            WHEN "FLT".transactions.status_source IN ('provider_webhook', 'provider_api')
                THEN "FLT".transactions.paid_at
            WHEN EXCLUDED.status = 'succeeded'
                THEN COALESCE("FLT".transactions.paid_at, EXCLUDED.paid_at)
            ELSE "FLT".transactions.paid_at
        END,
        failed_at = CASE
            WHEN "FLT".transactions.status_source IN ('provider_webhook', 'provider_api')
                THEN "FLT".transactions.failed_at
            WHEN EXCLUDED.status = 'failed'
                THEN COALESCE("FLT".transactions.failed_at, EXCLUDED.failed_at)
            ELSE "FLT".transactions.failed_at
        END,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_transaction_from_payment_submission
    ON "FLT".bet_payment_submissions;

CREATE TRIGGER sync_transaction_from_payment_submission
AFTER INSERT OR UPDATE OF status, amount, payment_reference, review_note, reviewed_at
ON "FLT".bet_payment_submissions
FOR EACH ROW
EXECUTE FUNCTION "FLT".sync_transaction_from_payment_submission();

-- Backfill existing submissions so historical payments are visible in the transaction ledger.
INSERT INTO "FLT".transactions (
    bet_id,
    payment_submission_id,
    user_id,
    amount,
    provider,
    provider_reference,
    status,
    status_source,
    failure_reason,
    paid_at,
    failed_at,
    metadata
)
SELECT
    s.bet_id,
    s.id,
    s.user_id,
    s.amount,
    'manual_transfer',
    NULLIF(BTRIM(s.payment_reference), ''),
    CASE s.status
        WHEN 'approved' THEN 'succeeded'
        WHEN 'rejected' THEN 'failed'
        ELSE 'pending'
    END,
    'manual_review',
    CASE WHEN s.status = 'rejected' THEN NULLIF(BTRIM(s.review_note), '') ELSE NULL END,
    CASE WHEN s.status = 'approved' THEN COALESCE(s.reviewed_at, NOW()) ELSE NULL END,
    CASE WHEN s.status = 'rejected' THEN COALESCE(s.reviewed_at, NOW()) ELSE NULL END,
    jsonb_build_object('source', 'backfill')
FROM "FLT".bet_payment_submissions s
ON CONFLICT (payment_submission_id) DO NOTHING;
