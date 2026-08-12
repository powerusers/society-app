-- The notice board, which until now lived in each browser's local storage: a
-- notice posted by the secretary was visible to anyone signing in on that same
-- browser and to nobody else, which reads exactly like a working notice board
-- until someone opens the app on their phone.

CREATE TABLE notices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id  uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  kind        text NOT NULL DEFAULT 'notice' CHECK (kind IN ('notice','event','payment','alert')),
  title       text NOT NULL,
  body        text NOT NULL,
  -- Kept when the author leaves the society: a notice with no author still
  -- belongs on the board, and deleting one because a secretary moved out would
  -- lose the reason a rule exists.
  author_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  priority    text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','high')),
  pinned      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- The board is always read newest-first with pinned items on top.
CREATE INDEX notices_board_idx ON notices (society_id, pinned DESC, created_at DESC);

CREATE TABLE notice_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id  uuid NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notice_comments_idx ON notice_comments (notice_id, created_at);

-- A row per person rather than an array on the notice: two people opening a
-- notice at once cannot overwrite each other's read, and "read by 14" becomes
-- a count of facts instead of whatever the last client wrote back.
CREATE TABLE notice_reads (
  notice_id uuid NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notice_id, user_id)
);

-- Likewise a row per person per emoji, so a reaction is something a named
-- resident did and can undo, not a number anyone can increment repeatedly.
CREATE TABLE notice_reactions (
  notice_id uuid NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji     text NOT NULL,
  PRIMARY KEY (notice_id, user_id, emoji)
);
