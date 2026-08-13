-- The residents' own board — discussions, recommendations and classifieds —
-- which lived in local storage like the notice board and the polls did. A
-- listing offering a wardrobe for sale reached nobody: the neighbour who would
-- have bought it was on a different device, looking at an empty Market tab.

CREATE TABLE posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id  uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  type        text NOT NULL DEFAULT 'discussion'
              CHECK (type IN ('discussion','recommendation','classified')),
  title       text NOT NULL,
  body        text NOT NULL DEFAULT '',
  -- Only a classified is priced, and the check says so rather than leaving a
  -- stray amount on a discussion for a later reader to puzzle over. Zero is a
  -- real price: "free to a good home" is the commonest listing on these boards.
  price       integer CHECK (price IS NULL OR (price >= 0 AND type = 'classified')),
  author_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX posts_board_idx ON posts (society_id, created_at DESC);

CREATE TABLE post_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  text       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX post_comments_idx ON post_comments (post_id, created_at);

-- A like is a person, not a counter. The browser version incremented a number
-- on every tap, so one resident could like a post eleven times — and did, in
-- the seeded data.
CREATE TABLE post_likes (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  liked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
