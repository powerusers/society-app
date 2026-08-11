-- Onboarding a society needed SETUP_TOKEN, which is one shared secret for the
-- whole platform: handing it to a secretary lets them create societies for
-- ever, and revoking it revokes everyone. An invite is the thing you can
-- actually give away — one society, one use, with an expiry.

CREATE TABLE society_invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Only the hash. The code is a bearer credential: whoever holds it can create
  -- a society, so a read of this table must not yield working codes. It is
  -- shown once, when issued, and cannot be recovered afterwards.
  code_hash    text NOT NULL UNIQUE,
  -- What the operator called it, so an outstanding code is recognisable in a
  -- list without being readable.
  label        text NOT NULL DEFAULT '',
  -- Optional pins. A code issued for one society should not be usable to
  -- create a different one, or by someone other than the intended secretary.
  society_name text,
  email        citext,
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  used_by      uuid REFERENCES societies(id) ON DELETE SET NULL,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- The only lookup that matters: codes still open for redemption.
CREATE INDEX society_invites_open_idx ON society_invites (expires_at)
  WHERE used_at IS NULL AND revoked_at IS NULL;
