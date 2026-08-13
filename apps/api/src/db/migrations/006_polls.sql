-- Polls, which lived in the browser alongside the notice board and had the same
-- problem: a vote counted only on the device that cast it.

CREATE TABLE polls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id  uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  question    text NOT NULL,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  closes_at   timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX polls_society_idx ON polls (society_id, created_at DESC);

CREATE TABLE poll_options (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text    text NOT NULL,
  sort    int NOT NULL DEFAULT 0
);
CREATE INDEX poll_options_idx ON poll_options (poll_id, sort);

-- One row per person per poll, and the primary key is what enforces "one vote
-- per registered resident" — not the client, and not a check the API could
-- forget. Changing your mind updates the row; it cannot add a second.
CREATE TABLE poll_votes (
  poll_id   uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  voted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);
CREATE INDEX poll_votes_option_idx ON poll_votes (option_id);
