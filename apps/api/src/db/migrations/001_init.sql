-- Core society model: tenants, people, gate traffic, money, helpdesk, audit.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TABLE societies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  address     text NOT NULL DEFAULT '',
  reg_no      text NOT NULL DEFAULT '',
  gstin       text NOT NULL DEFAULT '',
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,
  bank        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id  uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  device      text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'online',
  features    text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gates_society_idx ON gates (society_id);

CREATE TABLE flats (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id    uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  code          text NOT NULL,
  block         text NOT NULL,
  floor         int  NOT NULL DEFAULT 1,
  type          text NOT NULL DEFAULT '2BHK',
  area          int  NOT NULL CHECK (area > 0),
  occupancy     text NOT NULL DEFAULT 'owner-occupied',
  parking_slots int  NOT NULL DEFAULT 1 CHECK (parking_slots >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (society_id, code)
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id    uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  name          text NOT NULL,
  email         citext NOT NULL,
  phone         text NOT NULL DEFAULT '',
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('admin','committee','staff','guard','resident')),
  designation   text,
  relation      text,
  flat_id       uuid REFERENCES flats(id) ON DELETE SET NULL,
  gate_id       uuid REFERENCES gates(id) ON DELETE SET NULL,
  shift         text,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  notify        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (society_id, email)
);
CREATE INDEX users_flat_idx ON users (flat_id);

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- only the hash is stored, so a database leak does not hand over live sessions
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

CREATE TABLE registrations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id    uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  name          text NOT NULL,
  flat_code     text NOT NULL,
  relation      text NOT NULL,
  phone         text NOT NULL,
  email         citext NOT NULL,
  password_hash text NOT NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reason        text,
  decided_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX registrations_status_idx ON registrations (society_id, status);

CREATE TABLE visitors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id   uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  flat_id      uuid NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
  gate_id      uuid REFERENCES gates(id) ON DELETE SET NULL,
  name         text NOT NULL,
  category     text NOT NULL CHECK (category IN ('delivery','guest','service','cab','staff')),
  status       text NOT NULL CHECK (status IN ('waiting','pending','approved','pre-approved','inside','exited','denied')),
  purpose      text NOT NULL DEFAULT '',
  phone        text NOT NULL DEFAULT '',
  vehicle      text NOT NULL DEFAULT '',
  pass_code    text,
  allowed_mins int,
  recurring    text NOT NULL DEFAULT 'once',
  expected_at  timestamptz,
  raised_by    text NOT NULL DEFAULT '',
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  verified_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  deny_reason  text,
  sent_at      timestamptz,
  approved_at  timestamptz,
  entry_at     timestamptz,
  exit_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX visitors_flat_idx ON visitors (flat_id, status);
CREATE INDEX visitors_society_status_idx ON visitors (society_id, status);
-- a live pass code must be unique; spent ones may repeat
CREATE UNIQUE INDEX visitors_active_pass_idx ON visitors (society_id, pass_code)
  WHERE pass_code IS NOT NULL AND status IN ('pre-approved','approved','inside');

CREATE TABLE charge_heads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id  uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  code        text NOT NULL,
  name        text NOT NULL,
  basis       text NOT NULL CHECK (basis IN ('per_sqft','flat','per_slot','tenant_only')),
  rate        numeric(12,2) NOT NULL CHECK (rate >= 0),
  gst         numeric(5,2) NOT NULL DEFAULT 0 CHECK (gst >= 0),
  active      boolean NOT NULL DEFAULT true,
  sort        int NOT NULL DEFAULT 0,
  UNIQUE (society_id, code)
);

CREATE TABLE bills (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id   uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  flat_id      uuid NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
  cycle        text NOT NULL CHECK (cycle ~ '^\d{4}-\d{2}$'),
  items        jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal     numeric(12,2) NOT NULL DEFAULT 0,
  gst          numeric(12,2) NOT NULL DEFAULT 0,
  late_fee     numeric(12,2) NOT NULL DEFAULT 0,
  total        numeric(12,2) NOT NULL DEFAULT 0,
  due_date     date NOT NULL,
  status       text NOT NULL CHECK (status IN ('pending-approval','issued','overdue','paid')),
  maker_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at  timestamptz,
  issued_at    timestamptz,
  paid_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- one bill per flat per cycle; a repeated billing run cannot double-charge
  UNIQUE (flat_id, cycle),
  -- the checker must not be the maker, enforced by the database as well as the API
  CONSTRAINT bills_maker_is_not_checker CHECK (approved_by IS NULL OR approved_by <> maker_id)
);
CREATE INDEX bills_cycle_idx ON bills (society_id, cycle, status);

CREATE TABLE payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id    uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  bill_id       uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  flat_id       uuid NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
  amount        numeric(12,2) NOT NULL CHECK (amount > 0),
  mode          text NOT NULL,
  txn_id        text NOT NULL,
  receipt_no    text NOT NULL,
  narration     text NOT NULL,
  paid_at       timestamptz NOT NULL DEFAULT now(),
  settled_at    timestamptz,
  reconciled    boolean NOT NULL DEFAULT false,
  reconciled_at timestamptz,
  paid_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  -- a bill can only be paid once; a double-submitted payment hits this and rolls back
  UNIQUE (bill_id)
);
CREATE INDEX payments_reconcile_idx ON payments (society_id, reconciled);

CREATE TABLE ledger_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id  uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  entry_date  timestamptz NOT NULL DEFAULT now(),
  head        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('income','expense')),
  amount      numeric(12,2) NOT NULL,
  flat_id     uuid REFERENCES flats(id) ON DELETE SET NULL,
  vendor      text,
  mode        text,
  tds         numeric(12,2) NOT NULL DEFAULT 0,
  note        text NOT NULL DEFAULT '',
  ref_id      uuid,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_date_idx ON ledger_entries (society_id, entry_date);

-- Ticket reference numbers. A sequence hands out each number exactly once, so
-- two residents submitting at the same moment cannot collide on HD-xxxx.
CREATE SEQUENCE ticket_ref_seq START 2045;

CREATE TABLE tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id  uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  ref         text NOT NULL,
  flat_id     uuid REFERENCES flats(id) ON DELETE SET NULL,
  title       text NOT NULL,
  body        text NOT NULL DEFAULT '',
  category    text NOT NULL,
  priority    text NOT NULL CHECK (priority IN ('high','medium','low')),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in-progress','resolved','closed')),
  source      text NOT NULL DEFAULT 'app',
  raised_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  sla_due_at  timestamptz NOT NULL,
  resolved_at timestamptz,
  rating      int CHECK (rating BETWEEN 1 AND 5),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (society_id, ref)
);
CREATE INDEX tickets_status_idx ON tickets (society_id, status);

CREATE TABLE ticket_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  text       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_comments_ticket_idx ON ticket_comments (ticket_id);

CREATE TABLE incidents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id    uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  gate_id       uuid REFERENCES gates(id) ON DELETE SET NULL,
  type          text NOT NULL,
  severity      text NOT NULL CHECK (severity IN ('high','medium','low')),
  involves      text NOT NULL DEFAULT '',
  note          text NOT NULL DEFAULT '',
  recording_ref text,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  raised_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  closed_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX incidents_status_idx ON incidents (society_id, status);

-- Append-only. No UPDATE or DELETE path exists in the API.
CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  society_id uuid REFERENCES societies(id) ON DELETE CASCADE,
  actor_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  action     text NOT NULL,
  entity     text NOT NULL DEFAULT '',
  entity_id  text,
  detail     text NOT NULL DEFAULT '',
  ip         text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_created_idx ON audit_log (society_id, created_at DESC);
