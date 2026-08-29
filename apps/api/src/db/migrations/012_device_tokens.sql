-- Push notification targets.
--
-- A gate request is the one thing in this app that is worthless late: a guard is
-- standing at the gate with a visitor while the flat decides. Until now the only
-- way a resident learned about one was by having the app open, which is not how
-- anybody uses a phone.
--
-- One row per device, not per user. A household is several devices and a person
-- may carry two, so a send fans out over every token the flat owns.

CREATE TABLE device_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- FCM registration tokens are long and have no documented maximum, so this is
  -- deliberately untyped text rather than a guessed varchar(n).
  token        text NOT NULL,
  platform     text NOT NULL DEFAULT 'android' CHECK (platform IN ('android','ios','web')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),

  -- Globally unique, not unique per user. A phone that signs out and a colleague
  -- signs in keeps the same FCM token, and two rows would go on delivering the
  -- first person's visitors to the second person's screen. Registering re-points
  -- the existing row at whoever is signed in now.
  UNIQUE (token)
);

CREATE INDEX device_tokens_user_idx ON device_tokens (user_id);

-- Sending to a flat is "every token belonging to every member of that flat",
-- which is a join through users on flat_id. Without this the send scans the
-- whole table on a gate that is busy precisely when it must not be slow.
CREATE INDEX device_tokens_user_seen_idx ON device_tokens (user_id, last_seen_at DESC);
