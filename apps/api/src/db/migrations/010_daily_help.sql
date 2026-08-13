-- Daily help — maids, cooks, drivers — and the attendance the gate records for
-- them. One person works at several flats, and each of those households wants
-- to know whether they have arrived today.

CREATE TABLE daily_help (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id      uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  name            text NOT NULL,
  role            text NOT NULL DEFAULT 'Maid',
  phone           text NOT NULL DEFAULT '',
  -- What the gate scans. Two staff sharing a code is a check-in credited to the
  -- wrong person, in the register a resident relies on.
  card_code       text NOT NULL,
  biometric       boolean NOT NULL DEFAULT false,
  police_verified boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (society_id, card_code)
);

-- One person, several households. The browser version kept an array of flat
-- codes on the record, so two flats adding the same maid produced two people
-- as far as the gate was concerned.
CREATE TABLE daily_help_flats (
  help_id  uuid NOT NULL REFERENCES daily_help(id) ON DELETE CASCADE,
  flat_id  uuid NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (help_id, flat_id)
);

CREATE TABLE help_attendance (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  help_id    uuid NOT NULL REFERENCES daily_help(id) ON DELETE CASCADE,
  in_at      timestamptz NOT NULL DEFAULT now(),
  out_at     timestamptz,
  mode       text NOT NULL DEFAULT 'qr' CHECK (mode IN ('qr','biometric','manual')),
  gate_id    uuid REFERENCES gates(id) ON DELETE SET NULL,
  marked_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  CHECK (out_at IS NULL OR out_at >= in_at)
);

-- Whether someone is inside is *this row existing*, not a status column that
-- can drift away from the register. Two guards on two gates both tapping
-- "check in" would otherwise open two visits, and the flat would see a person
-- who arrived twice and left once.
CREATE UNIQUE INDEX help_open_attendance_once
  ON help_attendance (help_id)
  WHERE out_at IS NULL;

CREATE INDEX help_attendance_day_idx ON help_attendance (society_id, in_at DESC);

-- A rating is a household's opinion, so it is a row per flat and the record
-- carries the average. The browser version stored one number that whichever
-- flat rated last overwrote — "visible to other flats" meant replacing them.
CREATE TABLE help_ratings (
  help_id  uuid NOT NULL REFERENCES daily_help(id) ON DELETE CASCADE,
  flat_id  uuid NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
  stars    integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
  rated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (help_id, flat_id)
);
